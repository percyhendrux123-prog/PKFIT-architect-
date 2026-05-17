// supabase_query_read / supabase_query_write / mcp_call

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('supabase_query_read', () => {
  beforeEach(() => vi.resetModules());

  it('rejects non-SELECT statements', async () => {
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({ rpc: vi.fn() }),
      getAnonClient: () => ({}),
    }));
    const { supabase_query_read } = await import('../netlify/functions/_shared/agent-tools/tools/supabase-query.js');
    const res = await supabase_query_read.execute({ sql: 'DELETE FROM profiles' });
    expect(res.error).toMatch(/not read-only/);
  });

  it('proxies to agent_exec_sql_readonly with query_sql param when available', async () => {
    const rpc = vi.fn(async () => ({ data: { rows: [{ id: 1 }], columns: ['id'] }, error: null }));
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({ rpc }),
      getAnonClient: () => ({}),
    }));
    const { supabase_query_read } = await import('../netlify/functions/_shared/agent-tools/tools/supabase-query.js');
    const res = await supabase_query_read.execute({ sql: 'SELECT id FROM profiles' });
    expect(res.rowCount).toBe(1);
    expect(res.columns).toEqual(['id']);
    expect(rpc).toHaveBeenCalledWith('agent_exec_sql_readonly', { query_sql: 'SELECT id FROM profiles' });
  });

  it('surfaces the install hint when the RPC is missing', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'function not found' } }));
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({ rpc }),
      getAnonClient: () => ({}),
    }));
    const { supabase_query_read } = await import('../netlify/functions/_shared/agent-tools/tools/supabase-query.js');
    const res = await supabase_query_read.execute({ sql: 'SELECT 1' });
    expect(res.error).toMatch(/0046_agent_sql_exec_functions/);
  });
});

describe('supabase_query_write', () => {
  beforeEach(() => vi.resetModules());

  it('rejects read-only SQL', async () => {
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({ rpc: vi.fn() }),
      getAnonClient: () => ({}),
    }));
    const { supabase_query_write } = await import('../netlify/functions/_shared/agent-tools/tools/supabase-query.js');
    const res = await supabase_query_write.execute({ sql: 'SELECT 1', expected_change: 'noop' });
    expect(res.error).toMatch(/read-only query/);
  });

  it('escalates DDL to CRITICAL via isCritical + criticalToken', async () => {
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({ rpc: vi.fn() }),
      getAnonClient: () => ({}),
    }));
    const { supabase_query_write } = await import('../netlify/functions/_shared/agent-tools/tools/supabase-query.js');
    expect(supabase_query_write.isCritical({ sql: 'DROP TABLE x' })).toBe(true);
    expect(supabase_query_write.isCritical({ sql: 'UPDATE x SET a=1' })).toBe(false);
    expect(supabase_query_write.criticalToken({ sql: 'DROP TABLE clients' })).toBe('clients');
  });

  it('proxies to agent_exec_sql_write with query_sql + expected_change params', async () => {
    const rpc = vi.fn(async () => ({ data: { affected_rows: 0, expected_change: 'No-op test' }, error: null }));
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({ rpc }),
      getAnonClient: () => ({}),
    }));
    const { supabase_query_write } = await import('../netlify/functions/_shared/agent-tools/tools/supabase-query.js');
    const res = await supabase_query_write.execute({
      sql: "UPDATE profiles SET loop_stage = loop_stage WHERE id = 'nonexistent-id'",
      expected_change: 'No-op test',
    });
    expect(res.affected_rows).toBe(0);
    expect(res.target_table).toBe('profiles');
    expect(rpc).toHaveBeenCalledWith('agent_exec_sql_write', {
      query_sql: "UPDATE profiles SET loop_stage = loop_stage WHERE id = 'nonexistent-id'",
      expected_change: 'No-op test',
    });
  });

  it('surfaces the install hint when the write RPC is missing', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'function not found' } }));
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => ({ rpc }),
      getAnonClient: () => ({}),
    }));
    const { supabase_query_write } = await import('../netlify/functions/_shared/agent-tools/tools/supabase-query.js');
    const res = await supabase_query_write.execute({
      sql: 'UPDATE profiles SET a = 1 WHERE id = 1',
      expected_change: 'test',
    });
    expect(res.error).toMatch(/0046_agent_sql_exec_functions/);
  });
});

describe('mcp_call risk inheritance', () => {
  it('classifies known tools', async () => {
    const { mcp_call } = await import('../netlify/functions/_shared/agent-tools/tools/mcp.js');
    expect(mcp_call.computeRisk({ server: 'slack', tool: 'send_message' })).toBe('HIGH');
    expect(mcp_call.computeRisk({ server: 'notion', tool: 'get_page' })).toBe('LOW');
    expect(mcp_call.computeRisk({ server: 'manychat', tool: 'send_broadcast' })).toBe('CRITICAL');
  });

  it('uses semantic defaults for unknown tools', async () => {
    const { mcp_call } = await import('../netlify/functions/_shared/agent-tools/tools/mcp.js');
    expect(mcp_call.computeRisk({ server: 'whatever', tool: 'list_things' })).toBe('LOW');
    expect(mcp_call.computeRisk({ server: 'whatever', tool: 'send_thing' })).toBe('HIGH');
    expect(mcp_call.computeRisk({ server: 'whatever', tool: 'do_something' })).toBe('MEDIUM');
  });
});
