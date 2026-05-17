// read_client_data / run_generator / compare_periods / aggregate_clients.
//
// These tools hit the Supabase admin client. We mock that single module so
// the entire registry sees the same fake.

import { describe, it, expect, vi, beforeEach } from 'vitest';

function buildAdminMock(tableResponses) {
  return {
    from(table) {
      const responses = tableResponses[table] ?? [{ data: [], error: null }];
      let idx = 0;
      const consume = () => {
        const r = responses[Math.min(idx, responses.length - 1)];
        idx += 1;
        return r;
      };
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        in() { return builder; },
        gte() { return builder; },
        lte() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle() { return Promise.resolve(consume()); },
        then(resolve, reject) {
          try { return Promise.resolve(consume()).then(resolve, reject); }
          catch (e) { return reject ? reject(e) : Promise.reject(e); }
        },
      };
      return builder;
    },
  };
}

describe('read_client_data', () => {
  beforeEach(() => vi.resetModules());

  it('reads a single dataset with a summary', async () => {
    const admin = buildAdminMock({
      check_ins: [{ data: [{ date: '2026-05-10', weight: 80 }], error: null }],
    });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => admin,
      getAnonClient: () => admin,
    }));
    const { read_client_data } = await import('../netlify/functions/_shared/agent-tools/tools/client-data.js');
    const res = await read_client_data.execute({ client_id: 'c1', dataset: 'check_ins' });
    expect(res.error).toBeUndefined();
    expect(res.data.check_ins).toHaveLength(1);
    expect(res.summary).toMatch(/check_ins/);
  });

  it('rejects unknown datasets', async () => {
    const admin = buildAdminMock({});
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => admin,
      getAnonClient: () => admin,
    }));
    const { read_client_data } = await import('../netlify/functions/_shared/agent-tools/tools/client-data.js');
    const res = await read_client_data.execute({ client_id: 'c1', dataset: 'not_a_thing' });
    expect(res.error).toMatch(/unknown dataset/);
  });
});

describe('aggregate_clients', () => {
  beforeEach(() => vi.resetModules());

  it('filters by tier', async () => {
    const admin = buildAdminMock({
      profiles: [{ data: [{ id: 'a', plan: 'tier1', role: 'client' }, { id: 'b', plan: 'tier1', role: 'client' }], error: null }],
    });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => admin,
      getAnonClient: () => admin,
    }));
    const { aggregate_clients } = await import('../netlify/functions/_shared/agent-tools/tools/client-data.js');
    const res = await aggregate_clients.execute({ filter: { tier: 'tier1' } });
    expect(res.count).toBe(2);
  });
});

describe('compare_periods', () => {
  beforeEach(() => vi.resetModules());

  it('returns numeric deltas when both periods have data', async () => {
    const admin = buildAdminMock({
      check_ins: [
        { data: [{ weight: 80 }, { weight: 79 }], error: null },
        { data: [{ weight: 78 }, { weight: 77 }], error: null },
      ],
    });
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => admin,
      getAnonClient: () => admin,
    }));
    const { compare_periods } = await import('../netlify/functions/_shared/agent-tools/tools/client-data.js');
    const res = await compare_periods.execute({
      client_id: 'c1',
      metric: 'weight',
      period_a: 'last_4_weeks',
      period_b: 'previous_4_weeks',
    });
    expect(res.delta).toBeTruthy();
    expect(res.summary).toMatch(/weight/);
  });
});

describe('run_generator', () => {
  beforeEach(() => vi.resetModules());

  it('proxies to the matching netlify function', async () => {
    const admin = buildAdminMock({});
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => admin,
      getAnonClient: () => admin,
    }));
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ id: 'gen-1', plan: 'mock' }),
    }));
    try {
      const { run_generator } = await import('../netlify/functions/_shared/agent-tools/tools/client-data.js');
      const res = await run_generator.execute(
        { client_id: 'c1', generator: 'workout' },
        { internalBaseUrl: 'http://test.local', callerToken: 'tok' },
      );
      expect(res.error).toBeUndefined();
      expect(res.generation_id).toBe('gen-1');
      expect(res.cost_estimate).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('errors on unknown generator', async () => {
    const admin = buildAdminMock({});
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => admin,
      getAnonClient: () => admin,
    }));
    const { run_generator } = await import('../netlify/functions/_shared/agent-tools/tools/client-data.js');
    const res = await run_generator.execute({ client_id: 'c1', generator: 'nope' });
    expect(res.error).toMatch(/unknown generator/);
  });
});
