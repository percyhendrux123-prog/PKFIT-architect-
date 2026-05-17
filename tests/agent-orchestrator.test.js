// Orchestrator gate tests — runTool from the agent-tools index.
// Verifies:
//   - LOW tools execute without approval
//   - MEDIUM tools are blocked without preview/yes
//   - HIGH tools are blocked without explicit yes, executed with it
//   - CRITICAL tools require typed token + yes

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { mkdir, rm } from 'node:fs/promises';

const TMPROOT = `/tmp/pkfit-orch-${Date.now()}`;

beforeEach(async () => {
  await mkdir(TMPROOT, { recursive: true });
  vi.resetModules();
  // Stub the audit module so we don't hit Supabase in these tests.
  vi.doMock('../netlify/functions/_shared/agent-tools/audit.js', () => ({
    startAudit: vi.fn(async () => ({ id: 'audit-stub', error: null })),
    finishAudit: vi.fn(async () => {}),
  }));
  vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
    getAdminClient: () => ({}),
    getAnonClient: () => ({}),
  }));
});

describe('runTool — LOW tools', () => {
  it('executes web_fetch without approval (with stubbed fetch)', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/plain']]),
      text: async () => 'body',
    }));
    try {
      const { runTool } = await import('../netlify/functions/_shared/agent-tools/index.js');
      const res = await runTool(
        { name: 'web_fetch', args: { url: 'https://example.com' } },
        { userId: 'u1', conversationId: 'c1', messages: [] },
      );
      expect(res.blocked).toBeNull();
      expect(res.tool_result.status).toBe(200);
      expect(res.approval_status).toBe('autonomous');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

describe('runTool — HIGH tools', () => {
  it('blocks without a user yes', async () => {
    const { runTool } = await import('../netlify/functions/_shared/agent-tools/index.js');
    const res = await runTool(
      {
        name: 'supabase_query_write',
        args: { sql: 'UPDATE profiles SET name=$1', expected_change: 'rename' },
      },
      { userId: 'u1', conversationId: 'c1', messages: [{ role: 'user', content: 'I am asking a question, not approving' }] },
    );
    // Clearly non-affirmative message.
    expect(res.blocked).toBeTruthy();
    expect(res.blocked.risk).toBe('HIGH');
    expect(res.tool_result.blocked).toBe(true);
  });

  it('executes when user explicitly says yes', async () => {
    vi.doMock('../netlify/functions/_shared/agent-tools/tools/supabase-query.js', async () => {
      const { RISK } = await import('../netlify/functions/_shared/agent-tools/risk.js');
      return {
        supabase_query_read: {
          name: 'supabase_query_read',
          description: '',
          risk: RISK.LOW,
          approval: 'autonomous',
          input_schema: { type: 'object', properties: {} },
          execute: async () => ({ rows: [], summary: 'ok' }),
        },
        supabase_query_write: {
          name: 'supabase_query_write',
          description: '',
          risk: RISK.HIGH,
          approval: 'high',
          input_schema: { type: 'object', properties: {} },
          isCritical: () => false,
          execute: async () => ({ affected_rows: 1, summary: 'updated 1 row' }),
        },
      };
    });
    const { runTool } = await import('../netlify/functions/_shared/agent-tools/index.js');
    const res = await runTool(
      {
        name: 'supabase_query_write',
        args: { sql: 'UPDATE profiles SET name=$1', expected_change: 'rename' },
      },
      { userId: 'u1', conversationId: 'c1', messages: [{ role: 'user', content: 'yes go ahead' }] },
    );
    expect(res.blocked).toBeNull();
    expect(res.tool_result.affected_rows).toBe(1);
    expect(res.approval_status).toBe('approved');
  });
});

describe('runTool — CRITICAL tools', () => {
  it('blocks without typed token match', async () => {
    vi.doMock('../netlify/functions/_shared/agent-tools/tools/supabase-query.js', async () => {
      const { RISK } = await import('../netlify/functions/_shared/agent-tools/risk.js');
      return {
        supabase_query_read: {
          name: 'supabase_query_read',
          description: '',
          risk: RISK.LOW,
          approval: 'autonomous',
          input_schema: { type: 'object', properties: {} },
          execute: async () => ({ rows: [] }),
        },
        supabase_query_write: {
          name: 'supabase_query_write',
          description: '',
          risk: RISK.HIGH,
          approval: 'high',
          input_schema: { type: 'object', properties: {} },
          isCritical: () => true,
          criticalToken: () => 'profiles',
          execute: async () => ({ summary: 'dropped' }),
        },
      };
    });
    const { runTool } = await import('../netlify/functions/_shared/agent-tools/index.js');
    const res = await runTool(
      { name: 'supabase_query_write', args: { sql: 'DROP TABLE profiles', expected_change: 'drop' } },
      { userId: 'u1', conversationId: 'c1', messages: [{ role: 'user', content: 'yes go' }] },
    );
    expect(res.blocked).toBeTruthy();
    expect(res.blocked.risk).toBe('CRITICAL');
    expect(res.blocked.required_token).toBe('profiles');
  });

  it('executes when token + yes are present', async () => {
    vi.doMock('../netlify/functions/_shared/agent-tools/tools/supabase-query.js', async () => {
      const { RISK } = await import('../netlify/functions/_shared/agent-tools/risk.js');
      return {
        supabase_query_read: {
          name: 'supabase_query_read',
          description: '',
          risk: RISK.LOW,
          approval: 'autonomous',
          input_schema: { type: 'object', properties: {} },
          execute: async () => ({ rows: [] }),
        },
        supabase_query_write: {
          name: 'supabase_query_write',
          description: '',
          risk: RISK.HIGH,
          approval: 'high',
          input_schema: { type: 'object', properties: {} },
          isCritical: () => true,
          criticalToken: () => 'profiles',
          execute: async () => ({ summary: 'dropped' }),
        },
      };
    });
    const { runTool } = await import('../netlify/functions/_shared/agent-tools/index.js');
    const res = await runTool(
      { name: 'supabase_query_write', args: { sql: 'DROP TABLE profiles', expected_change: 'drop' } },
      { userId: 'u1', conversationId: 'c1', messages: [{ role: 'user', content: 'yes profiles' }] },
    );
    expect(res.blocked).toBeNull();
    expect(res.tool_result.summary).toBe('dropped');
  });
});

describe('runTool — unknown tool', () => {
  it('returns a structured error', async () => {
    const { runTool } = await import('../netlify/functions/_shared/agent-tools/index.js');
    const res = await runTool({ name: 'bogus_tool', args: {} }, { userId: 'u1', messages: [] });
    expect(res.tool_result.error).toMatch(/unknown/);
  });
});

afterAll(async () => {
  try { await rm(TMPROOT, { recursive: true, force: true }); } catch {}
});
