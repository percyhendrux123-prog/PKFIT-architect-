// POST /.netlify/functions/migration-token-validate
//
// Public endpoint — the token IS the auth (one-time-ish UUID, expires after
// 14 days). Resolves a migration_state row to the data the /migrate/:token
// landing page needs to render personalised: client first name, current plan,
// rate, next renewal, anchor date, and the chosen incentive variant.
//
// Side effect: marks the row as `clicked` and emits a `link_clicked` event
// the first time the token is resolved. Subsequent calls don't re-emit; they
// just return the same data.
//
// Returns 410 if the token is expired, 404 if it doesn't resolve, 409 if the
// migration is already in a terminal state (transferred, dormant, failed).

import { jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { PLAN_AMOUNTS } from './_shared/stripe.js';

const TERMINAL_STATES = new Set(['transferred', 'dormant', 'failed']);

// Resolve the rate the client sees on the comparison page. We prefer the
// PLAN_AMOUNTS table because it's the source of truth for what they'll be
// charged on Account B. If the migration_state row carries an explicit
// account_a_amount (set when the row was pre-seated), use that instead.
function resolveRate({ tier, interval, override }) {
  if (typeof override === 'number') return override;
  if (!tier || !interval) return null;
  return PLAN_AMOUNTS[tier]?.[interval] ?? null;
}

function tierIntervalFromPriceId(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_PERFORMANCE_MONTHLY]: ['performance', 'monthly'],
    [process.env.STRIPE_PRICE_PERFORMANCE_ANNUAL]:  ['performance', 'annual'],
    [process.env.STRIPE_PRICE_IDENTITY_MONTHLY]:    ['identity', 'monthly'],
    [process.env.STRIPE_PRICE_IDENTITY_ANNUAL]:     ['identity', 'annual'],
    [process.env.STRIPE_PRICE_FULL_MONTHLY]:        ['full', 'monthly'],
    [process.env.STRIPE_PRICE_FULL_ANNUAL]:         ['full', 'annual'],
    [process.env.STRIPE_PRICE_PREMIUM_MONTHLY]:     ['premium', 'monthly'],
    [process.env.STRIPE_PRICE_PREMIUM_ANNUAL]:      ['premium', 'annual'],
  };
  return map[priceId] ?? [null, null];
}

function firstName(profile) {
  if (!profile) return null;
  if (profile.name) return profile.name.split(/\s+/)[0];
  return null;
}

function anchorDate(renewalDateIso) {
  if (!renewalDateIso) return null;
  const d = new Date(`${renewalDateIso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  return runValidate({ event, admin: getAdminClient() }).catch(errorResponse);
};

// Pulled out so tests can drive it with a fake admin client.
export async function runValidate({ event, admin }) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }
  const token = body.token;
  if (!token || typeof token !== 'string') {
    return jsonResponse(400, { error: 'token required' });
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(token)) {
    return jsonResponse(400, { error: 'token must be a UUID' });
  }

  const { data: state, error } = await admin
    .from('migration_state')
    .select('*')
    .eq('migration_token', token)
    .maybeSingle();
  if (error) return jsonResponse(500, { error: error.message });
  if (!state) return jsonResponse(404, { error: 'Token not found' });

  if (state.token_expires_at && new Date(state.token_expires_at).getTime() < Date.now()) {
    return jsonResponse(410, { error: 'Token expired', expired: true });
  }

  if (TERMINAL_STATES.has(state.state)) {
    return jsonResponse(409, {
      error: `Migration already ${state.state}`,
      state: state.state,
      already_complete: state.state === 'transferred',
    });
  }

  // Pull the client profile for the personalisation. Skip if no client_id
  // — pre_seated rows might not have linked the profile yet.
  let profile = null;
  if (state.client_id) {
    const { data } = await admin
      .from('profiles')
      .select('id, name, email')
      .eq('id', state.client_id)
      .maybeSingle();
    profile = data;
  }

  const [tier, interval] = tierIntervalFromPriceId(state.stripe_b_price_id);
  const rate = resolveRate({ tier, interval, override: state.account_a_amount });

  // First-touch state transition. If we've already advanced past `clicked`
  // (signed_in / consented), don't downgrade. Pre-seated and email_sent are
  // both upgraded to clicked here.
  if (state.state === 'pre_seated' || state.state === 'email_sent') {
    await admin
      .from('migration_state')
      .update({ state: 'clicked' })
      .eq('id', state.id);
    await admin.from('migration_events').insert({
      migration_state_id: state.id,
      event_type: 'link_clicked',
      metadata: { user_agent: event.headers?.['user-agent'] ?? null },
    });
  }

  return jsonResponse(200, {
    state: state.state === 'pre_seated' || state.state === 'email_sent' ? 'clicked' : state.state,
    incentive_variant: state.incentive_variant,
    client: {
      first_name: firstName(profile) ?? state.email.split('@')[0],
      email: state.email,
    },
    plan: {
      tier,
      interval,
      rate_usd: rate,
      next_renewal_date: state.account_a_renewal_date,
      anchor_date: anchorDate(state.account_a_renewal_date),
      stripe_b_price_id: state.stripe_b_price_id,
    },
    consent_text: `I authorize PKFIT to transfer my subscription and end my Trainerize billing on ${state.account_a_renewal_date}.`,
  });
}
