// Pure-logic tests for the agent tool infrastructure: risk gating, SQL
// validation, redaction, path allowlist, cost estimation. No I/O — these
// run without mocking the database or filesystem.

import { describe, it, expect } from 'vitest';

describe('risk gating', () => {
  it('hasHighApproval matches affirmatives', async () => {
    const { hasHighApproval } = await import('../netlify/functions/_shared/agent-tools/risk.js');
    expect(hasHighApproval([{ role: 'user', content: 'yes go ahead' }])).toBe(true);
    expect(hasHighApproval([{ role: 'user', content: 'do it' }])).toBe(true);
    expect(hasHighApproval([{ role: 'user', content: 'approved' }])).toBe(true);
    expect(hasHighApproval([{ role: 'user', content: 'maybe later' }])).toBe(false);
    expect(hasHighApproval([])).toBe(false);
    expect(hasHighApproval([{ role: 'assistant', content: 'yes' }])).toBe(false);
  });

  it('hasCriticalApproval requires both token and affirmative', async () => {
    const { hasCriticalApproval } = await import('../netlify/functions/_shared/agent-tools/risk.js');
    expect(hasCriticalApproval([{ role: 'user', content: 'yes drop table profiles' }], 'profiles')).toBe(true);
    expect(hasCriticalApproval([{ role: 'user', content: 'profiles' }], 'profiles')).toBe(false); // no yes
    expect(hasCriticalApproval([{ role: 'user', content: 'yes' }], 'profiles')).toBe(false); // no token
    expect(hasCriticalApproval([{ role: 'user', content: 'STRIPE_SECRET_KEY approved' }], 'STRIPE_SECRET_KEY')).toBe(true);
  });

  it('parseBatchApproval picks up scoped declarations', async () => {
    const { parseBatchApproval } = await import('../netlify/functions/_shared/agent-tools/risk.js');
    expect(parseBatchApproval('yes for the next 5')).toEqual({ count: 5 });
    expect(parseBatchApproval('auto for all')).toEqual({ scope: 'all' });
    expect(parseBatchApproval('approve all this session')).toBeTruthy();
    expect(parseBatchApproval('auto for write_file in this convo')).toEqual({ tool: 'write_file' });
    expect(parseBatchApproval('something else')).toBeNull();
  });
});

describe('SQL validation', () => {
  it('isReadOnly accepts SELECT, WITH...SELECT, EXPLAIN SELECT', async () => {
    const { isReadOnly } = await import('../netlify/functions/_shared/agent-tools/sql-validate.js');
    expect(isReadOnly('SELECT * FROM profiles')).toBe(true);
    expect(isReadOnly('with x as (select 1) select * from x')).toBe(true);
    expect(isReadOnly('  EXPLAIN SELECT * FROM profiles')).toBe(true);
    expect(isReadOnly('SHOW tables')).toBe(true);
  });

  it('isReadOnly rejects mutations + DDL', async () => {
    const { isReadOnly } = await import('../netlify/functions/_shared/agent-tools/sql-validate.js');
    expect(isReadOnly('INSERT INTO profiles VALUES (1)')).toBe(false);
    expect(isReadOnly('UPDATE profiles SET name=$1')).toBe(false);
    expect(isReadOnly('DELETE FROM profiles')).toBe(false);
    expect(isReadOnly('DROP TABLE profiles')).toBe(false);
    expect(isReadOnly('CREATE TABLE x (id int)')).toBe(false);
    expect(isReadOnly('ALTER TABLE profiles ADD COLUMN x int')).toBe(false);
    expect(isReadOnly('SELECT * INTO new_table FROM profiles')).toBe(false);
  });

  it('isDDL + extractDDLTarget work', async () => {
    const { isDDL, extractDDLTarget } = await import('../netlify/functions/_shared/agent-tools/sql-validate.js');
    expect(isDDL('DROP TABLE profiles')).toBe(true);
    expect(extractDDLTarget('DROP TABLE profiles')).toBe('profiles');
    expect(extractDDLTarget('CREATE TABLE IF NOT EXISTS public.agent_actions (id uuid)')).toBe('agent_actions');
    expect(isDDL('SELECT 1')).toBe(false);
  });
});

describe('redaction', () => {
  it('masks secret-looking keys and values', async () => {
    const { redactInputs, maskValue, looksLikeSecret } = await import('../netlify/functions/_shared/agent-tools/redact.js');
    expect(looksLikeSecret('sk-ant-abcdefghijklmnopqrstuvwxyz0123')).toBe(true);
    expect(looksLikeSecret('hello world')).toBe(false);
    const masked = maskValue('sk-ant-abcdefghijklmnopqrstuvwxyz0123');
    expect(masked).toContain('***');
    expect(masked).toContain('0123');
    const out = redactInputs({
      message: 'hi',
      api_key: 'plain-but-key-named',
      password: 'whatever',
      token: 'short',
      value: 'sk-ant-abcdefghijklmnopqrstuvwxyz0123',
      nested: { secret: 'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ012345' },
    });
    expect(out.api_key).toMatch(/\*\*\*/);
    expect(out.password).toMatch(/\*\*\*/);
    expect(out.token).toMatch(/\*\*\*/);
    expect(out.value).toMatch(/\*\*\*0123/);
    expect(out.nested.secret).toMatch(/\*\*\*2345/);
    expect(out.message).toBe('hi');
  });

  it('detectKeyType identifies common formats', async () => {
    const { detectKeyType, suggestInstall, isCriticalKey } = await import('../netlify/functions/_shared/agent-tools/redact.js');
    expect(detectKeyType('sk-ant-' + 'a'.repeat(40))).toBe('anthropic');
    expect(detectKeyType('sk-proj-' + 'a'.repeat(40))).toBe('openai');
    expect(detectKeyType('sk_live_' + 'a'.repeat(40))).toBe('stripe_secret_live');
    expect(detectKeyType('whsec_' + 'a'.repeat(40))).toBe('stripe_webhook');
    expect(detectKeyType('AIza' + 'a'.repeat(40))).toBe('gemini');
    expect(detectKeyType('re_' + 'a'.repeat(40))).toBe('resend');
    expect(detectKeyType('not-a-key')).toBe(null);
    expect(suggestInstall('openai').suggested_key).toBe('OPENAI_API_KEY');
    expect(suggestInstall('openai').suggested_scope).toBe('netlify-production');
    expect(isCriticalKey('STRIPE_SECRET_KEY')).toBe(true);
    expect(isCriticalKey('FOO_BAR')).toBe(false);
  });
});

describe('path allowlist', () => {
  it('normalizes tilde and validates', async () => {
    const { validatePath } = await import('../netlify/functions/_shared/agent-tools/paths.js');
    // /tmp is always allowed.
    expect(validatePath('/tmp/foo.txt').ok).toBe(true);
    // /etc is always denied.
    expect(validatePath('/etc/passwd').ok).toBe(false);
    // ~/.ssh/* denied.
    expect(validatePath(`${process.env.HOME ?? '/Users/percystewart'}/.ssh/id_rsa`).ok).toBe(false);
    // .pem denied.
    expect(validatePath('/tmp/foo.pem').ok).toBe(false);
    // .key denied.
    expect(validatePath('/tmp/secret.key').ok).toBe(false);
    // /var/task allowed for read.
    expect(validatePath('/var/task/index.js').ok).toBe(true);
    // /var/task denied for write.
    expect(validatePath('/var/task/index.js', { writeIntent: true }).ok).toBe(false);
  });
});

describe('cost estimation', () => {
  it('estimateUsd uses model-specific rates', async () => {
    const { estimateUsd } = await import('../netlify/functions/_shared/agent-tools/cost.js');
    const opus = estimateUsd({
      model: 'claude-opus-4-7',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(opus).toBeCloseTo(90.0, 1);
    const haiku = estimateUsd({
      model: 'claude-haiku-4-5-20251001',
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    });
    expect(haiku).toBeCloseTo(6.0, 1);
  });

  it('LIMITS reflect spec values', async () => {
    const { LIMITS } = await import('../netlify/functions/_shared/agent-tools/cost.js');
    expect(LIMITS.OWNER_SOFT_PROMPT_USD).toBe(5.0);
    expect(LIMITS.TIER4_HARD_CAP_PER_CONV_USD).toBe(10.0);
    expect(LIMITS.TIER4_INCLUDED_TOKENS_PER_MONTH).toBe(5_000_000);
    expect(LIMITS.TIER4_OVERAGE_USD_PER_1K_TOKENS).toBeCloseTo(0.012);
  });
});
