// migration-token-validate
//
// Coverage targets:
//   1. token shape validation (missing, malformed)
//   2. happy path: returns personalized payload + flips state to 'clicked'
//   3. expired token returns 410 + expired flag
//   4. terminal states (transferred / dormant / failed) return 409
//   5. unknown token returns 404
//   6. signed_in / consented states do NOT downgrade to 'clicked'
//
// All Supabase calls go through the chainable mock from helpers/supabase-mock.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from './helpers/supabase-mock.js';

const supabaseMock = createSupabaseMock();

vi.mock('../netlify/functions/_shared/supabase-admin.js', () => ({
  getAdminClient: () => supabaseMock,
  getAnonClient: () => supabaseMock,
}));

function makeEvent({ method = 'POST', body = {}, headers = {} } = {}) {
  return {
    httpMethod: method,
    headers: { 'user-agent': 'jest', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

async function loadHandler() {
  const mod = await import('../netlify/functions/migration-token-validate.js');
  return mod.handler;
}

beforeEach(() => {
  supabaseMock.__reset();
});

describe('migration-token-validate', () => {
  it('rejects non-POST', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ method: 'GET' }));
    expect(res.statusCode).toBe(405);
  });

  it('400s on missing token', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(400);
  });

  it('400s on malformed token', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: 'not-a-uuid' } }));
    expect(res.statusCode).toBe(400);
  });

  it('400s on invalid JSON body', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: 'not-json' }));
    expect(res.statusCode).toBe(400);
  });

  it('404s when token does not resolve', async () => {
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: null, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: '11111111-1111-1111-1111-111111111111' } }));
    expect(res.statusCode).toBe(404);
  });

  it('410s on expired token', async () => {
    const expiredRow = {
      id: 'mig-1',
      state: 'pre_seated',
      migration_token: '11111111-1111-1111-1111-111111111111',
      token_expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      account_a_renewal_date: '2026-05-15',
      stripe_b_price_id: 'price_perf_m',
      email: 'jane@example.com',
      incentive_variant: 'ai_coach',
    };
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: expiredRow, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: expiredRow.migration_token } }));
    expect(res.statusCode).toBe(410);
    expect(JSON.parse(res.body).expired).toBe(true);
  });

  it('409s when state is transferred (already complete)', async () => {
    const row = {
      id: 'mig-2',
      state: 'transferred',
      migration_token: '22222222-2222-2222-2222-222222222222',
      token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      account_a_renewal_date: '2026-05-15',
      stripe_b_price_id: 'price_perf_m',
      email: 'jane@example.com',
      incentive_variant: 'ai_coach',
    };
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: row.migration_token } }));
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.body).already_complete).toBe(true);
  });

  it('returns personalized payload + flips state to clicked on first hit', async () => {
    const row = {
      id: 'mig-3',
      state: 'email_sent',
      migration_token: '33333333-3333-3333-3333-333333333333',
      token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      account_a_renewal_date: '2026-05-20',
      stripe_b_price_id: 'price_perf_m',
      email: 'percy@example.com',
      incentive_variant: 'ai_coach',
      client_id: 'client-9',
    };
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      if (table === 'profiles' && op === 'select') {
        return { data: { id: 'client-9', name: 'Percy Stewart', email: 'percy@example.com' }, error: null };
      }
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: row.migration_token } }));
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.client.first_name).toBe('Percy');
    expect(payload.plan.tier).toBe('performance');
    expect(payload.plan.interval).toBe('monthly');
    expect(payload.plan.rate_usd).toBe(250);
    expect(payload.plan.next_renewal_date).toBe('2026-05-20');
    expect(payload.plan.anchor_date).toBe('2026-05-21');
    expect(payload.consent_text).toMatch(/2026-05-20/);
    expect(payload.state).toBe('clicked');

    // State transition fired.
    const updateCall = supabaseMock.__calls.find((c) => c.method === 'migration_state.update');
    expect(updateCall).toBeDefined();
    expect(updateCall.args[0]).toEqual({ state: 'clicked' });

    // Funnel event written.
    const eventInsert = supabaseMock.__calls.find((c) => c.method === 'migration_events.insert');
    expect(eventInsert).toBeDefined();
    expect(eventInsert.args[0].event_type).toBe('link_clicked');
  });

  it('does not downgrade signed_in state to clicked', async () => {
    const row = {
      id: 'mig-4',
      state: 'signed_in',
      migration_token: '44444444-4444-4444-4444-444444444444',
      token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      account_a_renewal_date: '2026-06-01',
      stripe_b_price_id: 'price_perf_m',
      email: 'jane@example.com',
      incentive_variant: 'ai_coach',
    };
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: row.migration_token } }));
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.state).toBe('signed_in');

    // No downgrade update.
    const updates = supabaseMock.__calls.filter((c) => c.method === 'migration_state.update');
    expect(updates).toHaveLength(0);
  });

  it('falls back to email-prefix when profile name is missing', async () => {
    const row = {
      id: 'mig-5',
      state: 'pre_seated',
      migration_token: '55555555-5555-5555-5555-555555555555',
      token_expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      account_a_renewal_date: '2026-05-25',
      stripe_b_price_id: 'price_full_a',
      email: 'somebody@example.com',
      incentive_variant: 'ai_coach',
    };
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: row.migration_token } }));
    expect(res.statusCode).toBe(200);
    const payload = JSON.parse(res.body);
    expect(payload.client.first_name).toBe('somebody');
    expect(payload.plan.tier).toBe('full');
    expect(payload.plan.interval).toBe('annual');
  });
});
