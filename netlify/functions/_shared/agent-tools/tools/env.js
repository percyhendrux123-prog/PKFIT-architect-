// set_env_var — Pattern A from the spec. The API-key install workflow.
//
// Supported scopes:
//   netlify-production  → uses Netlify API (NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID)
//   netlify-preview     → same API, scope: "deploy-preview"
//   local-env           → writes to a file under an allowlisted path
//
// Critical key handling:
//   STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, ANTHROPIC_API_KEY,
//   SUPABASE_SERVICE_ROLE_KEY, BYO_KEY_SECRET, MEDICAL_ENC_SECRET,
//   VAPID_PRIVATE_KEY → CRITICAL. Require typed confirmation matching the
//   key name exactly. Enforced by the orchestrator.
//
// Audit: logs scope, key name, last4 of value. Value is NEVER stored anywhere
// readable.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { RISK } from '../risk.js';
import { isCriticalKey, detectKeyType, suggestInstall } from '../redact.js';
import { validatePath } from '../paths.js';

const NETLIFY_API = 'https://api.netlify.com/api/v1';

async function setNetlifyEnv({ scope, key, value }) {
  const token = process.env.NETLIFY_AUTH_TOKEN;
  const siteId = process.env.NETLIFY_SITE_ID;
  if (!token || !siteId) {
    return {
      ok: false,
      error: 'set_env_var (netlify) not configured — set NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID. ' +
        '(Generate the PAT at https://app.netlify.com/user/applications#personal-access-tokens. ' +
        'NETLIFY_SITE_ID is on the site\'s "Site configuration" page.)',
    };
  }
  // Netlify scopes: builds, functions, runtime, post-processing. We map our
  // scope param to a contexts array.
  const contexts = scope === 'netlify-preview' ? ['deploy-preview', 'branch-deploy'] : ['production'];
  try {
    // POST creates a new env var; PATCH updates an existing one. The API has
    // separate endpoints — we try PATCH first, fall back to POST.
    const patchRes = await fetch(`${NETLIFY_API}/accounts/_/env/${encodeURIComponent(key)}?site_id=${siteId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        key,
        values: contexts.map((context) => ({ value, context })),
      }),
    });
    if (patchRes.status === 404 || patchRes.status === 400) {
      // Try create.
      const postRes = await fetch(`${NETLIFY_API}/accounts/_/env?site_id=${siteId}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          {
            key,
            scopes: ['builds', 'functions', 'runtime', 'post-processing'],
            values: contexts.map((context) => ({ value, context })),
          },
        ]),
      });
      if (!postRes.ok) {
        return { ok: false, error: `Netlify API ${postRes.status}: ${(await postRes.text()).slice(0, 400)}` };
      }
      return { ok: true, action: 'created', contexts };
    }
    if (!patchRes.ok) {
      return { ok: false, error: `Netlify API ${patchRes.status}: ${(await patchRes.text()).slice(0, 400)}` };
    }
    return { ok: true, action: 'updated', contexts };
  } catch (e) {
    return { ok: false, error: `Netlify API call failed: ${e?.message ?? String(e)}` };
  }
}

async function setLocalEnv({ targetPath, key, value }) {
  const check = validatePath(targetPath, { writeIntent: true });
  if (!check.ok) return { ok: false, error: `target_path denied: ${check.reason}` };
  let existing = '';
  try {
    existing = await readFile(check.normalized, 'utf8');
  } catch (e) {
    if (e?.code !== 'ENOENT') return { ok: false, error: `read failed: ${e.message}` };
  }
  const lines = existing.split('\n');
  const escapedValue = /[\s"'#$]/.test(value) ? `"${value.replace(/"/g, '\\"')}"` : value;
  const newLine = `${key}=${escapedValue}`;
  const keyRe = new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=`);
  let replaced = false;
  const next = lines.map((line) => {
    if (keyRe.test(line)) {
      replaced = true;
      return newLine;
    }
    return line;
  });
  if (!replaced) {
    if (next.length && next[next.length - 1] !== '') next.push('');
    next.push(newLine);
  }
  try {
    await mkdir(dirname(check.normalized), { recursive: true });
    await writeFile(check.normalized, next.join('\n'), 'utf8');
    return { ok: true, action: replaced ? 'replaced' : 'appended', path: check.normalized };
  } catch (e) {
    return { ok: false, error: `write failed: ${e.message}` };
  }
}

export const set_env_var = {
  name: 'set_env_var',
  description:
    'Set an environment variable. Scopes: "netlify-production", "netlify-preview", "local-env". ' +
    'The value is masked in display (last 4 only). Critical keys (STRIPE_SECRET_KEY, ANTHROPIC_API_KEY, ' +
    'SUPABASE_SERVICE_ROLE_KEY, etc.) require typed CRITICAL confirmation. ' +
    'For local-env, target_path is required and must be under the allowlist (typically a .env file in a repo).',
  risk: RISK.HIGH,
  approval: 'high',
  input_schema: {
    type: 'object',
    properties: {
      scope: { type: 'string', enum: ['netlify-production', 'netlify-preview', 'local-env'] },
      key: { type: 'string', description: 'Env var name (e.g. OPENAI_API_KEY).' },
      value: { type: 'string', description: 'Env var value. Will be masked in display.' },
      target_path: {
        type: 'string',
        description: 'Required for local-env scope. Path to the .env file (or similar).',
      },
    },
    required: ['scope', 'key', 'value'],
  },
  isCritical({ key, scope }) {
    return scope === 'netlify-production' && isCriticalKey(key);
  },
  criticalToken({ key }) {
    return key;
  },
  // Helper used by the agent before calling: classify the value and suggest
  // a placement. The agent can describe this in the confirmation prompt.
  classify({ value }) {
    const keyType = detectKeyType(value);
    return { key_type: keyType, ...suggestInstall(keyType) };
  },
  async execute({ scope, key, value, target_path }) {
    if (!scope || !key || !value) return { error: 'scope, key, and value are all required' };
    if (typeof value !== 'string' || value.length === 0) return { error: 'value must be a non-empty string' };
    const last4 = value.slice(-4);
    if (scope === 'netlify-production' || scope === 'netlify-preview') {
      const result = await setNetlifyEnv({ scope, key, value });
      if (!result.ok) return { error: result.error, key_last_4: last4 };
      return {
        saved: true,
        scope,
        key,
        key_last_4: last4,
        action: result.action,
        contexts: result.contexts,
        summary: `${result.action === 'created' ? 'Created' : 'Updated'} ${key} on Netlify (${result.contexts.join(', ')}). Last 4: ...${last4}.`,
      };
    }
    if (scope === 'local-env') {
      if (!target_path) return { error: 'target_path required for local-env scope' };
      const result = await setLocalEnv({ targetPath: target_path, key, value });
      if (!result.ok) return { error: result.error, key_last_4: last4 };
      return {
        saved: true,
        scope,
        key,
        key_last_4: last4,
        action: result.action,
        path: result.path,
        summary: `${result.action === 'replaced' ? 'Replaced' : 'Appended'} ${key} in ${result.path}. Last 4: ...${last4}.`,
      };
    }
    return { error: `unknown scope: ${scope}` };
  },
};
