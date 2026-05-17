// Redaction helpers used before logging tool inputs to agent_actions and
// before surfacing tool calls in any user-visible audit view.
//
// Heuristics:
//   - Keys named like "value", "password", "secret", "token", "*_key",
//     "credentials", "api_key", "private_key" → masked.
//   - String values that look like API keys (sk_/sk-/pk_/AIza.../re_.../
//     ghp_.../whsec_.../...) → masked.
//   - Bearer tokens, JWTs, base64-looking long strings → masked.
//
// Masked form: keeps only the last 4 chars and total length: "***xxxx (28 chars)".

const SENSITIVE_KEY_RE = /(password|secret|token|credential|api[_-]?key|private[_-]?key|webhook|auth|bearer|access)/i;
// Match common key formats. Order matters — most specific first.
const KEY_VALUE_PATTERNS = [
  /^sk-(ant-|proj-)?[A-Za-z0-9_-]{20,}/,        // OpenAI / Anthropic
  /^sk_(live|test)_[A-Za-z0-9]{20,}/,            // Stripe secret
  /^pk_(live|test)_[A-Za-z0-9]{20,}/,            // Stripe publishable
  /^rk_(live|test)_[A-Za-z0-9]{20,}/,            // Stripe restricted
  /^whsec_[A-Za-z0-9]{20,}/,                     // Stripe webhook
  /^AIza[A-Za-z0-9_-]{30,}/,                     // Google / Gemini
  /^re_[A-Za-z0-9_-]{20,}/,                      // Resend
  /^ghp_[A-Za-z0-9]{30,}/,                       // GitHub PAT
  /^ghs_[A-Za-z0-9]{30,}/,                       // GitHub server token
  /^fal_[A-Za-z0-9_-]{20,}/,                     // fal.ai
  /^xoxb-[A-Za-z0-9-]{20,}/,                     // Slack bot
  /^xoxp-[A-Za-z0-9-]{20,}/,                     // Slack user
  /^xkeysib-[A-Za-z0-9]{40,}/,                   // Brevo (formerly Sendinblue)
  /^AC[a-f0-9]{30,}/,                            // Twilio Account SID
  /^SK[a-f0-9]{30,}/,                            // Twilio signing key
  /^apify_api_[A-Za-z0-9_-]{20,}/,               // Apify
  /^[A-Za-z0-9]{32,}$/,                          // generic long alphanum (e.g. hex tokens)
  /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/, // JWT
];

export function looksLikeSecret(value) {
  if (typeof value !== 'string') return false;
  if (value.length < 16) return false;
  for (const re of KEY_VALUE_PATTERNS) if (re.test(value)) return true;
  return false;
}

export function maskValue(value) {
  if (typeof value !== 'string') return '***';
  const last4 = value.slice(-4);
  return `***${last4} (${value.length} chars)`;
}

// Detect the key type for the API-key install pattern. Returns one of:
//   'openai', 'anthropic', 'stripe_secret', 'stripe_pub', 'stripe_restricted',
//   'stripe_webhook', 'gemini', 'resend', 'github', 'fal', 'slack_bot',
//   'slack_user', 'twilio_sid', 'apify', 'supabase_service_role', 'jwt',
//   'generic_hex', null.
export function detectKeyType(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (/^sk-ant-/.test(v)) return 'anthropic';
  if (/^sk-(proj-)?[A-Za-z0-9_-]{20,}/.test(v)) return 'openai';
  if (/^sk_live_/.test(v)) return 'stripe_secret_live';
  if (/^sk_test_/.test(v)) return 'stripe_secret_test';
  if (/^rk_/.test(v)) return 'stripe_restricted';
  if (/^pk_/.test(v)) return 'stripe_publishable';
  if (/^whsec_/.test(v)) return 'stripe_webhook';
  if (/^AIza/.test(v)) return 'gemini';
  if (/^re_/.test(v)) return 'resend';
  if (/^ghp_|^ghs_|^github_pat_/.test(v)) return 'github';
  if (/^fal_/.test(v)) return 'fal';
  if (/^xoxb-/.test(v)) return 'slack_bot';
  if (/^xoxp-/.test(v)) return 'slack_user';
  if (/^AC[a-f0-9]{30,}/.test(v)) return 'twilio_sid';
  if (/^apify_api_/.test(v)) return 'apify';
  if (/^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/.test(v)) {
    return 'jwt';
  }
  return null;
}

// Suggested env var name and scope based on key type. Returns
// { suggested_key, suggested_scope, description }.
export function suggestInstall(keyType) {
  switch (keyType) {
    case 'openai':
      return { suggested_key: 'OPENAI_API_KEY', suggested_scope: 'netlify-production', description: 'OpenAI (used for tts-1-hd voice synthesis)' };
    case 'anthropic':
      return { suggested_key: 'ANTHROPIC_API_KEY', suggested_scope: 'netlify-production', description: 'Anthropic Claude API (server-side default)' };
    case 'stripe_secret_live':
      return { suggested_key: 'STRIPE_SECRET_KEY', suggested_scope: 'netlify-production', description: 'Stripe live secret — CRITICAL key' };
    case 'stripe_secret_test':
      return { suggested_key: 'STRIPE_SECRET_KEY', suggested_scope: 'netlify-preview', description: 'Stripe test secret' };
    case 'stripe_publishable':
      return { suggested_key: 'VITE_STRIPE_PUBLISHABLE_KEY', suggested_scope: 'netlify-production', description: 'Stripe publishable (exposed in client bundle)' };
    case 'stripe_webhook':
      return { suggested_key: 'STRIPE_WEBHOOK_SECRET', suggested_scope: 'netlify-production', description: 'Stripe webhook signing secret' };
    case 'gemini':
      return { suggested_key: 'GEMINI_API_KEY', suggested_scope: 'netlify-production', description: 'Google Gemini API (vision + voice)' };
    case 'resend':
      return { suggested_key: 'RESEND_API_KEY', suggested_scope: 'netlify-production', description: 'Resend (transactional email)' };
    case 'github':
      return { suggested_key: 'GITHUB_TOKEN', suggested_scope: 'netlify-production', description: 'GitHub PAT (for Axiom Overseer)' };
    case 'fal':
      return { suggested_key: 'FAL_API_KEY', suggested_scope: 'netlify-production', description: 'fal.ai (image generation)' };
    case 'apify':
      return { suggested_key: 'APIFY_API_TOKEN', suggested_scope: 'netlify-production', description: 'Apify (Trainerize import)' };
    case 'slack_bot':
      return { suggested_key: 'SLACK_BOT_TOKEN', suggested_scope: 'netlify-production', description: 'Slack bot token' };
    case 'slack_user':
      return { suggested_key: 'SLACK_USER_TOKEN', suggested_scope: 'netlify-production', description: 'Slack user token' };
    case 'twilio_sid':
      return { suggested_key: 'TWILIO_ACCOUNT_SID', suggested_scope: 'netlify-production', description: 'Twilio account SID' };
    case 'jwt':
      return { suggested_key: 'UNKNOWN_JWT', suggested_scope: 'local-env', description: 'JWT token — not auto-detected. Specify the env var name.' };
    default:
      return { suggested_key: 'UNKNOWN', suggested_scope: 'local-env', description: 'Unknown key format. Specify where to install.' };
  }
}

// Returns true if a key is marked CRITICAL — modifying it requires typed
// confirmation of the key name itself.
export function isCriticalKey(envKey) {
  if (typeof envKey !== 'string') return false;
  const critical = new Set([
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'ANTHROPIC_API_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'BYO_KEY_SECRET',
    'MEDICAL_ENC_SECRET',
    'VAPID_PRIVATE_KEY',
  ]);
  return critical.has(envKey);
}

// Deep redact an inputs object before logging or display. Mutating-safe — we
// build a fresh copy.
export function redactInputs(inputs) {
  if (inputs == null) return inputs;
  if (typeof inputs !== 'object') {
    if (typeof inputs === 'string' && looksLikeSecret(inputs)) return maskValue(inputs);
    return inputs;
  }
  if (Array.isArray(inputs)) return inputs.map((v) => redactInputs(v));
  const out = {};
  for (const [k, v] of Object.entries(inputs)) {
    if (SENSITIVE_KEY_RE.test(k)) {
      if (typeof v === 'string') out[k] = maskValue(v);
      else out[k] = '***';
      continue;
    }
    if (typeof v === 'string' && looksLikeSecret(v)) {
      out[k] = maskValue(v);
      continue;
    }
    if (v && typeof v === 'object') {
      out[k] = redactInputs(v);
      continue;
    }
    out[k] = v;
  }
  return out;
}
