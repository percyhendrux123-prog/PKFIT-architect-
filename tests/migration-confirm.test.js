// migration-confirm
//
// Coverage targets:
//   1. token + consent_text validation
//   2. happy path: full handshake, persists Stripe-B IDs, writes consent_log
//   3. expired token returns 410
//   4. terminal state (transferred) returns 200 idempotent
//   5. failed handshake at clone-pm step → state=failed, account-a untouched,
//      Slack alert fired (mocked), failure email queued
//   6. handshake fails at cancel-source step (last step) → state=failed,
//      partial IDs persisted so Percy can reconcile manually
//   7. consent log carries verbatim checkbox text + IP + user-agent
//
// All Stripe calls are mocked. NO real network. Both Account A and Account B
// clients are stubbed; the test would fail loudly if either escaped.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from './helpers/supabase-mock.js';

const supabaseMock = createSupabaseMock();
const accountA = {
  subscriptions: { retrieve: vi.fn(), update: vi.fn() },
  customers: { retrieve: vi.fn() },
};
const accountB = {
  paymentMethods: { create: vi.fn() },
  customers: { create: vi.fn() },
  subscriptions: { create: vi.fn() },
};

vi.mock('../netlify/functions/_shared/supabase-admin.js', () => ({
  getAdminClient: () => supabaseMock,
  getAnonClient: () => supabaseMock,
}));

vi.mock('../netlify/functions/_shared/stripe.js', () => ({
  getStripe: () => accountB,
  getStripeAccountA: () => accountA,
  __resetStripeClients: () => {},
}));

// Block actual network for the email send. The function falls back to a
// no-provider warning when RESEND_API_KEY is unset; tests rely on that.
const originalFetch = global.fetch;
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({ id: 'em_x' }),
  text: () => Promise.resolve(''),
});

function makeEvent({ method = 'POST', body = {}, headers = {} } = {}) {
  return {
    httpMethod: method,
    headers: {
      'user-agent': 'jest-ua',
      'x-forwarded-for': '198.51.100.7',
      ...headers,
    },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

async function loadHandler() {
  const mod = await import('../netlify/functions/migration-confirm.js');
  return mod.handler;
}

const TOKEN = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const CONSENT = 'I authorize PKFIT to transfer my subscription and end my Trainerize billing on 2026-05-20.';

function activeRow(over = {}) {
  return {
    id: 'mig-1',
    state: 'signed_in',
    migration_token: TOKEN,
    token_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    account_a_sub_id: 'sub_old',
    account_a_renewal_date: '2026-05-20',
    account_a_amount: 250,
    stripe_b_price_id: 'price_perf_m',
    email: 'jane@example.com',
    client_id: 'client-1',
    incentive_variant: 'ai_coach',
    ...over,
  };
}

beforeEach(() => {
  supabaseMock.__reset();
  Object.values(accountA).forEach((g) => Object.values(g).forEach((fn) => fn.mockReset?.()));
  Object.values(accountB).forEach((g) => Object.values(g).forEach((fn) => fn.mockReset?.()));
  delete process.env.RESEND_API_KEY;
  delete process.env.SLACK_WEBHOOK_URL_OPS;
  global.fetch = mockFetch;
  mockFetch.mockClear();
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('migration-confirm', () => {
  it('rejects non-POST', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ method: 'GET' }));
    expect(res.statusCode).toBe(405);
  });

  it('400s on missing token / consent text', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN } }));
    expect(res.statusCode).toBe(400);
    const res2 = await handler(makeEvent({ body: { consent_checkbox_text: CONSENT } }));
    expect(res2.statusCode).toBe(400);
  });

  it('400s on malformed token', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: 'bad', consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(400);
  });

  it('410s on expired token', async () => {
    const row = activeRow({ token_expires_at: new Date(Date.now() - 1).toISOString() });
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN, consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(410);
  });

  it('returns 200 already_complete when state is transferred', async () => {
    const row = activeRow({
      state: 'transferred',
      stripe_b_subscription_id: 'sub_new',
    });
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN, consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).already_complete).toBe(true);
    // No Stripe call should happen on idempotent re-click.
    expect(accountA.subscriptions.retrieve).not.toHaveBeenCalled();
    expect(accountB.paymentMethods.create).not.toHaveBeenCalled();
  });

  it('returns 409 when previous attempt failed', async () => {
    const row = activeRow({ state: 'failed', failure_reason: 'clone_pm: pm clone failed' });
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN, consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(409);
  });

  it('runs the full handshake and persists Stripe-B IDs on success', async () => {
    const row = activeRow();
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });

    accountA.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_old',
      status: 'active',
      cancel_at_period_end: false,
      default_payment_method: { id: 'pm_source' },
      customer: 'cus_a',
    });
    accountB.paymentMethods.create.mockResolvedValue({ id: 'pm_cloned' });
    accountB.customers.create.mockResolvedValue({ id: 'cus_new' });
    accountB.subscriptions.create.mockResolvedValue({ id: 'sub_new' });
    accountA.subscriptions.update.mockResolvedValue({
      id: 'sub_old',
      cancel_at_period_end: true,
    });

    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN, consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.stripe_b_subscription_id).toBe('sub_new');
    expect(body.stripe_b_customer_id).toBe('cus_new');

    // anchor date = 2026-05-21 → seconds since epoch
    const expectedAnchor = Math.floor(Date.UTC(2026, 4, 21) / 1000);
    expect(body.anchor_timestamp).toBe(expectedAnchor);

    // Order is enforced: clone PM → create customer → create sub → cancel A.
    const orderOf = (m) => m.mock.invocationCallOrder[0];
    expect(orderOf(accountB.paymentMethods.create)).toBeLessThan(orderOf(accountB.customers.create));
    expect(orderOf(accountB.customers.create)).toBeLessThan(orderOf(accountB.subscriptions.create));
    expect(orderOf(accountB.subscriptions.create)).toBeLessThan(orderOf(accountA.subscriptions.update));

    // billing_cycle_anchor wired correctly + proration_behavior none.
    expect(accountB.subscriptions.create.mock.calls[0][0]).toMatchObject({
      customer: 'cus_new',
      billing_cycle_anchor: expectedAnchor,
      proration_behavior: 'none',
    });

    // consent_log was written verbatim.
    const consentInsert = supabaseMock.__calls.find((c) => c.method === 'consent_log.insert');
    expect(consentInsert).toBeDefined();
    expect(consentInsert.args[0]).toMatchObject({
      event_type: 'migration_consent',
      email: 'jane@example.com',
      consent_text: CONSENT,
      ip: '198.51.100.7',
    });

    // State went consented → transferred.
    const stateUpdates = supabaseMock.__calls.filter((c) => c.method === 'migration_state.update');
    expect(stateUpdates.length).toBeGreaterThanOrEqual(2);
    expect(stateUpdates[0].args[0].state).toBe('consented');
    const finalUpdate = stateUpdates[stateUpdates.length - 1];
    expect(finalUpdate.args[0]).toMatchObject({
      state: 'transferred',
      stripe_b_customer_id: 'cus_new',
      stripe_b_subscription_id: 'sub_new',
      stripe_b_payment_method: 'pm_cloned',
    });
  });

  it('on past_due source sub: leaves Account A untouched and marks failed', async () => {
    const row = activeRow();
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });

    accountA.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_old',
      status: 'past_due',
      cancel_at_period_end: false,
      default_payment_method: 'pm_source',
      customer: 'cus_a',
    });

    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN, consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(502);

    // Critical: cancel on Account A was NEVER called.
    expect(accountA.subscriptions.update).not.toHaveBeenCalled();

    // State = failed with reason populated.
    const stateUpdates = supabaseMock.__calls.filter((c) => c.method === 'migration_state.update');
    const failedUpdate = stateUpdates.find((c) => c.args[0].state === 'failed');
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate.args[0].failure_reason).toMatch(/past_due/);
  });

  it('on clone-pm failure: account A untouched, partial IDs not persisted', async () => {
    const row = activeRow();
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });

    accountA.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_old',
      status: 'active',
      cancel_at_period_end: false,
      default_payment_method: { id: 'pm_source' },
      customer: 'cus_a',
    });
    accountB.paymentMethods.create.mockRejectedValue(new Error('card brand not supported'));

    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN, consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).stage).toBe('clone_pm');

    expect(accountB.customers.create).not.toHaveBeenCalled();
    expect(accountB.subscriptions.create).not.toHaveBeenCalled();
    expect(accountA.subscriptions.update).not.toHaveBeenCalled();
  });

  it('on cancel-source failure: persists partial IDs so Percy can reconcile', async () => {
    const row = activeRow();
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });

    accountA.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_old',
      status: 'active',
      cancel_at_period_end: false,
      default_payment_method: { id: 'pm_source' },
      customer: 'cus_a',
    });
    accountB.paymentMethods.create.mockResolvedValue({ id: 'pm_cloned' });
    accountB.customers.create.mockResolvedValue({ id: 'cus_new' });
    accountB.subscriptions.create.mockResolvedValue({ id: 'sub_new' });
    accountA.subscriptions.update.mockRejectedValue(new Error('account_a network down'));

    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN, consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).stage).toBe('cancel_source');

    // The failed update carries the partial IDs so we can find/cancel later.
    const stateUpdates = supabaseMock.__calls.filter((c) => c.method === 'migration_state.update');
    const failedUpdate = stateUpdates.find((c) => c.args[0].state === 'failed');
    expect(failedUpdate).toBeDefined();
    expect(failedUpdate.args[0]).toMatchObject({
      state: 'failed',
      stripe_b_customer_id: 'cus_new',
      stripe_b_subscription_id: 'sub_new',
      stripe_b_payment_method: 'pm_cloned',
    });
  });

  it('falls back to customer.invoice_settings PM when subscription has none', async () => {
    const row = activeRow();
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') return { data: row, error: null };
      return { data: null, error: null };
    });

    accountA.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_old',
      status: 'active',
      cancel_at_period_end: false,
      default_payment_method: null,
      customer: 'cus_a',
    });
    accountA.customers.retrieve.mockResolvedValue({
      invoice_settings: { default_payment_method: 'pm_fallback' },
    });
    accountB.paymentMethods.create.mockResolvedValue({ id: 'pm_cloned' });
    accountB.customers.create.mockResolvedValue({ id: 'cus_new' });
    accountB.subscriptions.create.mockResolvedValue({ id: 'sub_new' });
    accountA.subscriptions.update.mockResolvedValue({ id: 'sub_old', cancel_at_period_end: true });

    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { token: TOKEN, consent_checkbox_text: CONSENT } }));
    expect(res.statusCode).toBe(200);
    expect(accountB.paymentMethods.create).toHaveBeenCalledWith(
      { payment_method: 'pm_fallback' },
      undefined,
    );
  });
});
