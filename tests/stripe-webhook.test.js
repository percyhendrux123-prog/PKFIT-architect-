// Stripe webhook tests.
//
// Coverage targets (Issue #16):
//   1. signature validates / rejects given the webhook secret
//   2. idempotency: insert + 23505 dedup short-circuits a re-delivered event
//   3. invoice.payment_failed transitions a profile to past_due
//   4. customer.subscription.updated writes the correct customer_id
//      (the brief asks for customer.subscription.created, but the function
//      only handles `updated` — see notes in PR body)
//   5. missing STRIPE_WEBHOOK_SECRET → 500 (so Stripe will retry)
//
// We mock both the Stripe client (signature verification) and the Supabase
// admin client. No network, no real keys.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from './helpers/supabase-mock.js';

// Hold mocks at module scope so vi.mock factories can read them by reference.
const supabaseMock = createSupabaseMock();
const stripeMock = {
  webhooks: {
    constructEvent: vi.fn(),
  },
};

vi.mock('../netlify/functions/_shared/supabase-admin.js', () => ({
  getAdminClient: () => supabaseMock,
  getAnonClient: () => supabaseMock,
}));

vi.mock('../netlify/functions/_shared/stripe.js', () => ({
  getStripe: () => stripeMock,
}));

// Build a minimal Netlify event shaped like the real one.
function makeEvent({ method = 'POST', headers = {}, body = '{}', isBase64Encoded = false } = {}) {
  return {
    httpMethod: method,
    headers: { 'stripe-signature': 'sig_mock', ...headers },
    body,
    isBase64Encoded,
  };
}

async function loadHandler() {
  const mod = await import('../netlify/functions/stripe-webhook.js');
  return mod.handler;
}

beforeEach(() => {
  supabaseMock.__reset();
  stripeMock.webhooks.constructEvent.mockReset();
});

describe('stripe-webhook', () => {
  describe('HTTP method gate', () => {
    it('rejects non-POST with 405', async () => {
      const handler = await loadHandler();
      const res = await handler(makeEvent({ method: 'GET' }));
      expect(res.statusCode).toBe(405);
    });
  });

  describe('signature header', () => {
    it('rejects with 400 when stripe-signature header is missing', async () => {
      const handler = await loadHandler();
      const res = await handler(makeEvent({ headers: { 'stripe-signature': undefined } }));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/Stripe-Signature/i);
    });

    it('reads stripe-signature in the canonical lowercase form', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_1',
        type: 'unhandled.type',
        data: { object: {} },
      }));
      supabaseMock.__setNext({ data: null, error: null }); // dedup insert OK
      const handler = await loadHandler();
      const res = await handler(
        makeEvent({ headers: { 'stripe-signature': 'sig_abc' }, body: '{}' }),
      );
      expect(stripeMock.webhooks.constructEvent).toHaveBeenCalledWith(
        '{}',
        'sig_abc',
        'whsec_mock',
      );
      expect(res.statusCode).toBe(200);
    });

    it('also accepts the casing Stripe-Signature (defensive)', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_caps',
        type: 'unhandled.type',
        data: { object: {} },
      }));
      supabaseMock.__setNext({ data: null, error: null });
      const handler = await loadHandler();
      const evt = makeEvent({ headers: {}, body: '{}' });
      // Wipe the lower-case key our helper added so we test only the cap form.
      delete evt.headers['stripe-signature'];
      evt.headers['Stripe-Signature'] = 'sig_caps';
      const res = await handler(evt);
      expect(res.statusCode).toBe(200);
    });
  });

  describe('webhook secret env var', () => {
    it('returns 500 (not 4xx) when STRIPE_WEBHOOK_SECRET is missing', async () => {
      delete process.env.STRIPE_WEBHOOK_SECRET;
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error).toMatch(/secret/i);
    });
  });

  describe('signature verification', () => {
    it('returns 400 when constructEvent throws', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching expected scheme');
      });
      const handler = await loadHandler();
      const res = await handler(makeEvent({ body: '{}' }));
      expect(res.statusCode).toBe(400);
      expect(JSON.parse(res.body).error).toMatch(/verification failed/i);
    });

    it('decodes base64-encoded body before verifying', async () => {
      const raw = JSON.stringify({ ping: true });
      const b64 = Buffer.from(raw, 'utf8').toString('base64');
      stripeMock.webhooks.constructEvent.mockImplementation((body) => {
        expect(body).toBe(raw);
        return { id: 'evt_b64', type: 'unhandled.type', data: { object: {} } };
      });
      supabaseMock.__setNext({ data: null, error: null });
      const handler = await loadHandler();
      const res = await handler(makeEvent({ body: b64, isBase64Encoded: true }));
      expect(res.statusCode).toBe(200);
    });
  });

  describe('idempotency (insert + 23505 dedup)', () => {
    it('short-circuits to 200 when stripe_event_id already exists', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_dup',
        type: 'invoice.payment_failed',
        data: { object: { subscription: 'sub_x' } },
      }));
      supabaseMock.__setNext({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.duplicate).toBe(true);

      // Critical: when dedup hits, NO downstream payments mutation runs.
      const paymentsCalls = supabaseMock.__calls.filter((c) => c.method.startsWith('payments.'));
      expect(paymentsCalls).toHaveLength(0);
    });

    it('returns 500 when the dedup insert fails for non-23505 reasons', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_fail',
        type: 'invoice.payment_failed',
        data: { object: { subscription: 'sub_x' } },
      }));
      supabaseMock.__setNext({
        data: null,
        error: { code: '08000', message: 'connection failure' },
      });
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error).toMatch(/connection failure/);
    });

    it('proceeds to event handling when the insert succeeds', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_new',
        type: 'invoice.payment_failed',
        data: { object: { subscription: 'sub_a' } },
      }));
      // Insert OK, then payments.update returns OK.
      supabaseMock.__setHandler(({ table, op }) => {
        if (table === 'stripe_events' && op === 'insert') return { data: null, error: null };
        if (table === 'payments' && op === 'update') return { data: null, error: null };
        return { data: null, error: null };
      });
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body).received).toBe(true);
    });
  });

  describe('invoice.payment_failed → past_due', () => {
    it('updates payments.status to past_due by stripe_subscription_id', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_pf_1',
        type: 'invoice.payment_failed',
        data: { object: { subscription: 'sub_failed', customer: 'cus_x' } },
      }));
      supabaseMock.__setHandler(() => ({ data: null, error: null }));

      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);

      const updateCall = supabaseMock.__calls.find(
        (c) => c.method === 'payments.update',
      );
      expect(updateCall).toBeDefined();
      expect(updateCall.args[0]).toEqual({ status: 'past_due' });

      const eqCall = supabaseMock.__calls.find(
        (c) => c.method === 'payments.eq' && c.args[0] === 'stripe_subscription_id',
      );
      expect(eqCall).toBeDefined();
      expect(eqCall.args[1]).toBe('sub_failed');
    });

    it('falls back to stripe_customer_id when subscription is null', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_pf_2',
        type: 'invoice.payment_failed',
        data: { object: { subscription: null, customer: 'cus_only' } },
      }));
      supabaseMock.__setHandler(() => ({ data: null, error: null }));
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);

      const eqCall = supabaseMock.__calls.find(
        (c) => c.method === 'payments.eq' && c.args[0] === 'stripe_customer_id',
      );
      expect(eqCall).toBeDefined();
      expect(eqCall.args[1]).toBe('cus_only');
    });
  });

  describe('customer.subscription.updated writes customer_id', () => {
    it('upserts payments with stripe_customer_id from the subscription', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_sub_upd',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_xyz',
            customer: 'cus_abc',
            status: 'active',
            current_period_end: 1700000000,
            metadata: { client_id: 'client-1', tier: 'performance' },
            items: { data: [{ price: { id: 'price_perf_m', unit_amount: 25000 } }] },
          },
        },
      }));
      supabaseMock.__setHandler(() => ({ data: null, error: null }));
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);

      const upsertCall = supabaseMock.__calls.find((c) => c.method === 'payments.upsert');
      expect(upsertCall).toBeDefined();
      const row = upsertCall.args[0];
      expect(row.stripe_customer_id).toBe('cus_abc');
      expect(row.stripe_subscription_id).toBe('sub_xyz');
      expect(row.client_id).toBe('client-1');
      expect(row.plan).toBe('performance');
      expect(row.status).toBe('active');
      expect(row.amount).toBe(250);
      expect(upsertCall.args[1]).toEqual({ onConflict: 'stripe_subscription_id' });

      // Profile update happens because we have both client_id and a tier.
      const profileUpdate = supabaseMock.__calls.find((c) => c.method === 'profiles.update');
      expect(profileUpdate).toBeDefined();
      expect(profileUpdate.args[0]).toEqual({ plan: 'performance' });
    });

    it('maps unknown subscription status values to incomplete', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_sub_unknown',
        type: 'customer.subscription.updated',
        data: {
          object: {
            id: 'sub_q',
            customer: 'cus_q',
            status: 'paused', // not in allow-list
            metadata: { client_id: 'c-2' },
            items: { data: [{ price: { id: 'price_unknown', unit_amount: 100 } }] },
          },
        },
      }));
      supabaseMock.__setHandler(() => ({ data: null, error: null }));
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);
      const upsertCall = supabaseMock.__calls.find((c) => c.method === 'payments.upsert');
      expect(upsertCall.args[0].status).toBe('incomplete');
    });
  });

  describe('checkout.session.completed', () => {
    it('upserts payment, updates profile.plan when tier is in metadata', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_cs',
        type: 'checkout.session.completed',
        data: {
          object: {
            client_reference_id: 'client-7',
            metadata: { tier: 'identity' },
            amount_total: 35000,
            subscription: 'sub_z',
            customer: 'cus_z',
          },
        },
      }));
      supabaseMock.__setHandler(() => ({ data: null, error: null }));
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);

      const upsertCall = supabaseMock.__calls.find((c) => c.method === 'payments.upsert');
      expect(upsertCall.args[0]).toMatchObject({
        client_id: 'client-7',
        plan: 'identity',
        amount: 350,
        status: 'active',
        stripe_subscription_id: 'sub_z',
        stripe_customer_id: 'cus_z',
      });
      const profileUpd = supabaseMock.__calls.find((c) => c.method === 'profiles.update');
      expect(profileUpd.args[0]).toEqual({ plan: 'identity' });
    });

    it('skips payment write when client reference is missing', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_cs_noref',
        type: 'checkout.session.completed',
        data: { object: { metadata: {}, amount_total: 0 } },
      }));
      supabaseMock.__setHandler(() => ({ data: null, error: null }));
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);
      const paymentsUpsert = supabaseMock.__calls.find((c) => c.method === 'payments.upsert');
      expect(paymentsUpsert).toBeUndefined();
    });
  });

  describe('customer.subscription.deleted', () => {
    it('marks payment canceled and clears profile.plan', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_sub_del',
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_d', metadata: { client_id: 'c-d' } },
        },
      }));
      supabaseMock.__setHandler(() => ({ data: null, error: null }));
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);
      const updateCall = supabaseMock.__calls.find((c) => c.method === 'payments.update');
      expect(updateCall.args[0]).toEqual({ status: 'canceled' });
      const profUpd = supabaseMock.__calls.find((c) => c.method === 'profiles.update');
      expect(profUpd.args[0]).toEqual({ plan: null });
    });
  });

  describe('unhandled event types', () => {
    it('returns 200 received without doing anything', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_unknown',
        type: 'some.future.event',
        data: { object: {} },
      }));
      supabaseMock.__setNext({ data: null, error: null }); // dedup insert OK
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(200);
      // Only the stripe_events.insert call was made.
      const nonStripe = supabaseMock.__calls.filter(
        (c) => !c.method.startsWith('stripe_events.'),
      );
      expect(nonStripe).toHaveLength(0);
    });
  });

  describe('handler exceptions', () => {
    it('returns 500 when the event handler throws', async () => {
      stripeMock.webhooks.constructEvent.mockImplementation(() => ({
        id: 'evt_throws',
        type: 'invoice.payment_failed',
        data: { object: { subscription: 'sub_t' } },
      }));
      supabaseMock.__setHandler(({ table, op }) => {
        if (table === 'stripe_events' && op === 'insert') return { data: null, error: null };
        if (table === 'payments' && op === 'update') {
          throw new Error('db unavailable');
        }
        return { data: null, error: null };
      });
      const handler = await loadHandler();
      const res = await handler(makeEvent());
      expect(res.statusCode).toBe(500);
      expect(JSON.parse(res.body).error).toMatch(/db unavailable/);
    });
  });
});
