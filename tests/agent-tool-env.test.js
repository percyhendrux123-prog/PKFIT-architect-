// set_env_var — the API-key install pattern.

import { describe, it, expect, vi, afterEach, beforeAll, afterAll } from 'vitest';
import { mkdir, readFile, rm } from 'node:fs/promises';

const TMPROOT = `/tmp/pkfit-agent-env-test-${Date.now()}`;
const originalFetch = globalThis.fetch;

beforeAll(async () => {
  await mkdir(TMPROOT, { recursive: true });
});
afterAll(async () => {
  await rm(TMPROOT, { recursive: true, force: true });
});
afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('set_env_var — local-env', () => {
  it('appends a key=value line to a new .env file under allowlist', async () => {
    const path = `${TMPROOT}/.env.test`;
    const { set_env_var } = await import('../netlify/functions/_shared/agent-tools/tools/env.js');
    const res = await set_env_var.execute({
      scope: 'local-env',
      key: 'OPENAI_API_KEY',
      value: 'sk-proj-' + 'a'.repeat(40) + 'n6Lw',
      target_path: path,
    });
    expect(res.saved).toBe(true);
    expect(res.key_last_4).toBe('n6Lw');
    const written = await readFile(path, 'utf8');
    expect(written).toMatch(/OPENAI_API_KEY=/);
    // value never appears anywhere in the response object.
    expect(JSON.stringify(res)).not.toContain('sk-proj-');
  });

  it('replaces an existing key instead of duplicating', async () => {
    const path = `${TMPROOT}/.env.replace`;
    const { set_env_var } = await import('../netlify/functions/_shared/agent-tools/tools/env.js');
    await set_env_var.execute({ scope: 'local-env', key: 'FOO', value: 'old', target_path: path });
    const res = await set_env_var.execute({ scope: 'local-env', key: 'FOO', value: 'newx', target_path: path });
    expect(res.action).toBe('replaced');
    const written = await readFile(path, 'utf8');
    const matches = written.match(/^FOO=/gm) || [];
    expect(matches).toHaveLength(1);
    expect(written).toContain('FOO=newx');
  });

  it('rejects paths outside the allowlist', async () => {
    const { set_env_var } = await import('../netlify/functions/_shared/agent-tools/tools/env.js');
    const res = await set_env_var.execute({
      scope: 'local-env',
      key: 'X',
      value: 'y',
      target_path: '/etc/shadow',
    });
    expect(res.error).toMatch(/denied/);
  });
});

describe('set_env_var — classify', () => {
  it('detects key types and suggests install locations', async () => {
    const { set_env_var } = await import('../netlify/functions/_shared/agent-tools/tools/env.js');
    const c = set_env_var.classify({ value: 'sk-ant-' + 'a'.repeat(40) });
    expect(c.key_type).toBe('anthropic');
    expect(c.suggested_key).toBe('ANTHROPIC_API_KEY');
    expect(c.suggested_scope).toBe('netlify-production');
  });

  it('marks critical key names', async () => {
    const { set_env_var } = await import('../netlify/functions/_shared/agent-tools/tools/env.js');
    expect(set_env_var.isCritical({ key: 'STRIPE_SECRET_KEY', scope: 'netlify-production' })).toBe(true);
    expect(set_env_var.isCritical({ key: 'FOO', scope: 'netlify-production' })).toBe(false);
    expect(set_env_var.isCritical({ key: 'STRIPE_SECRET_KEY', scope: 'local-env' })).toBe(false);
    expect(set_env_var.criticalToken({ key: 'STRIPE_SECRET_KEY' })).toBe('STRIPE_SECRET_KEY');
  });
});

describe('set_env_var — netlify path errors when unconfigured', () => {
  it('returns a setup hint when NETLIFY_AUTH_TOKEN is missing', async () => {
    delete process.env.NETLIFY_AUTH_TOKEN;
    delete process.env.NETLIFY_SITE_ID;
    const { set_env_var } = await import('../netlify/functions/_shared/agent-tools/tools/env.js');
    const res = await set_env_var.execute({
      scope: 'netlify-production',
      key: 'FOO',
      value: 'somevalue',
    });
    expect(res.error).toMatch(/NETLIFY_AUTH_TOKEN/);
  });
});
