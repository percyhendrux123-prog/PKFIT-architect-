// POST /.netlify/functions/migration-confirm
//
// The consent-click handler. Runs the four-step Stripe handshake described
// in the system design doc (§3, Option A — clone-and-anchor) and writes the
// consent log + audit trail.
//
// Request body:
//   { token: <uuid>, consent_checkbox_text: <string> }
//
// The consent_checkbox_text is the literal text the client just confirmed —
// stored verbatim in consent_log so the audit row matches what the user saw.
//
// Order is structurally enforced:
//   1. Resolve & validate token. If state is already `transferred`, return
//      409 with the existing IDs (idempotent re-click).
//   2. Mark state=consented, write consent_log + click event.
//   3. Run the Stripe handshake (inspect → clone PM → create customer →
//      create sub → cancel source). The runHandshake helper aborts on the
//      first failed sub-step; Account A is untouched if anything before the
//      cancel-source step fails.
//   4. On success: mark state=transferred, persist Stripe-B IDs, send the
//      confirmation email, emit the funnel event.
//   5. On failure: mark state=failed, persist failure_reason, send the
//      failed-handshake email, alert via Slack webhook (best-effort).

import { jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getStripe, getStripeAccountA } from './_shared/stripe.js';
import { runHandshake } from './_shared/migration-handshake.js';
import { renderEmail, sendEmail } from './_shared/migration-emails.js';

const TERMINAL_OK = 'transferred';

function clientIp(event) {
  return (
    event.headers?.['x-nf-client-connection-ip']
    ?? (event.headers?.['x-forwarded-for'] ?? '').split(',')[0].trim()
    ?? null
  ) || null;
}

async function postSlackAlert(webhookUrl, text) {
  if (!webhookUrl) return;
  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, mrkdwn: true }),
    });
  } catch (e) {
    // Slack outage shouldn't break the API response. Log and move on.
    // eslint-disable-next-line no-console
    console.warn('[migration-confirm] Slack post failed:', e.message);
  }
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  return runConfirm({
    event,
    admin: getAdminClient(),
    accountA: getStripeAccountA(),
    accountB: getStripe(),
  }).catch(errorResponse);
};

export async function runConfirm({ event, admin, accountA, accountB }) {
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const token = body.token;
  const consentText = body.consent_checkbox_text;
  if (!token || typeof token !== 'string') return jsonResponse(400, { error: 'token required' });
  if (!consentText || typeof consentText !== 'string') {
    return jsonResponse(400, { error: 'consent_checkbox_text required' });
  }
  if (!/^[0-9a-fA-F-]{36}$/.test(token)) return jsonResponse(400, { error: 'token must be a UUID' });

  const { data: state, error: fetchErr } = await admin
    .from('migration_state')
    .select('*')
    .eq('migration_token', token)
    .maybeSingle();
  if (fetchErr) return jsonResponse(500, { error: fetchErr.message });
  if (!state) return jsonResponse(404, { error: 'Token not found' });

  if (state.token_expires_at && new Date(state.token_expires_at).getTime() < Date.now()) {
    return jsonResponse(410, { error: 'Token expired' });
  }

  if (state.state === TERMINAL_OK) {
    // Idempotent: confirm-click after a previous successful run returns the
    // same payload so the front-end shows the welcome state.
    return jsonResponse(200, {
      already_complete: true,
      stripe_b_subscription_id: state.stripe_b_subscription_id,
    });
  }
  if (state.state === 'failed') {
    return jsonResponse(409, {
      error: 'Previous attempt failed; awaiting manual handling',
      failure_reason: state.failure_reason,
    });
  }

  const ip = clientIp(event);
  const userAgent = event.headers?.['user-agent'] ?? null;
  const consentTimestamp = new Date().toISOString();

  // 1) Mark consented + write the audit row + emit funnel event. If any of
  // these fail we abort before touching Stripe — the audit is the legal
  // basis for everything that follows.
  const { error: updateErr } = await admin
    .from('migration_state')
    .update({
      state: 'consented',
      consent_clicked_at: consentTimestamp,
      consent_ip: ip,
      consent_user_agent: userAgent,
    })
    .eq('id', state.id);
  if (updateErr) return jsonResponse(500, { error: `state update failed: ${updateErr.message}` });

  await admin.from('consent_log').insert({
    event_type: 'migration_consent',
    client_id: state.client_id,
    email: state.email,
    occurred_at: consentTimestamp,
    ip,
    user_agent: userAgent,
    consent_text: consentText,
    metadata: {
      migration_state_id: state.id,
      account_a_sub_id: state.account_a_sub_id,
      account_a_renewal_date: state.account_a_renewal_date,
      stripe_b_price_id: state.stripe_b_price_id,
      incentive_variant: state.incentive_variant,
      button_label: 'Unlock my AI coach →',
    },
  });

  await admin.from('migration_events').insert({
    migration_state_id: state.id,
    event_type: 'consent_clicked',
    metadata: { ip, user_agent: userAgent },
  });

  // 2) Run the handshake.
  const handshake = await runHandshake({
    accountA,
    accountB,
    state,
    sourceAccount: process.env.STRIPE_ACCOUNT_A_CONNECT_ID || null,
  });

  if (!handshake.ok) {
    const failureReason = `${handshake.stage}: ${handshake.reason}`;
    await admin
      .from('migration_state')
      .update({
        state: 'failed',
        failure_reason: failureReason,
        ...(handshake.partial ?? {}),
      })
      .eq('id', state.id);

    await admin.from('migration_events').insert({
      migration_state_id: state.id,
      event_type: 'handshake_failed',
      metadata: { stage: handshake.stage, reason: handshake.reason },
    });

    // Best-effort failure email + Slack alert. The client sees a "we're
    // handling this manually" state on the front-end (the function returns
    // 502 below).
    try {
      const { subject, body: emailBody } = renderEmail('failed_handshake', {
        first_name: state.email.split('@')[0],
      });
      await sendEmail({ to: state.email, subject, body: emailBody });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[migration-confirm] failure email send failed:', e.message);
    }

    await postSlackAlert(
      process.env.SLACK_WEBHOOK_URL_OPS,
      `*Migration handshake failed* ▸ ${state.email} — ${failureReason}`,
    );

    return jsonResponse(502, {
      ok: false,
      stage: handshake.stage,
      reason: handshake.reason,
    });
  }

  // 3) Persist destination IDs + flip state.
  const { error: persistErr } = await admin
    .from('migration_state')
    .update({
      state: TERMINAL_OK,
      stripe_b_customer_id: handshake.stripe_b_customer_id,
      stripe_b_subscription_id: handshake.stripe_b_subscription_id,
      stripe_b_payment_method: handshake.stripe_b_payment_method,
    })
    .eq('id', state.id);
  if (persistErr) {
    // Stripe is in the right state but we couldn't persist. Surface as 500;
    // Percy reconciles via the Stripe dashboard or by re-running with the
    // recorded IDs.
    return jsonResponse(500, {
      ok: false,
      error: `state persist failed after Stripe success: ${persistErr.message}`,
      stripe_b_customer_id: handshake.stripe_b_customer_id,
      stripe_b_subscription_id: handshake.stripe_b_subscription_id,
    });
  }

  await admin.from('migration_events').insert({
    migration_state_id: state.id,
    event_type: 'transferred',
    metadata: {
      stripe_b_customer_id: handshake.stripe_b_customer_id,
      stripe_b_subscription_id: handshake.stripe_b_subscription_id,
      anchor_timestamp: handshake.anchor_timestamp,
    },
  });

  // 4) Confirmation email — best-effort. If the email fails the migration
  // still succeeded and the welcome screen will deliver the same info.
  try {
    const nextBillIso = state.account_a_renewal_date;
    const nextBillDate = new Date(`${nextBillIso}T00:00:00Z`);
    nextBillDate.setUTCDate(nextBillDate.getUTCDate() + 1);
    const renderedNext = nextBillDate.toISOString().slice(0, 10);
    const renderedMonth = renderedNext.slice(0, 7);

    const { subject, body: emailBody } = renderEmail('confirmation', {
      first_name: state.email.split('@')[0],
      current_rate: state.account_a_amount ?? '—',
      next_bill_date: renderedNext,
      current_month: renderedMonth,
      receipt_url: `https://app.pkfit.app/billing`,
    });
    await sendEmail({ to: state.email, subject, body: emailBody });

    await admin.from('migration_events').insert({
      migration_state_id: state.id,
      event_type: 'confirmation_email_sent',
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[migration-confirm] confirmation email send failed:', e.message);
  }

  return jsonResponse(200, {
    ok: true,
    stripe_b_customer_id: handshake.stripe_b_customer_id,
    stripe_b_subscription_id: handshake.stripe_b_subscription_id,
    anchor_timestamp: handshake.anchor_timestamp,
  });
}
