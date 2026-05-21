// stripe-audit-webhook.js
// Endpoint: /.netlify/functions/stripe-audit-webhook (also exposed at
// /api/webhooks/stripe-audit via netlify.toml redirect).
//
// Phase 2A scope: verify signature, insert audit row + log event. Magic-link
// generation + Kit tagging + transactional email all land in Phase 2B.
// This is intentionally a foundation stub — the surface and idempotency
// guarantees are wired so Phase 2B can extend without touching plumbing.
//
// Architecture reference: ~/Documents/PKFIT/Funnel/ARCHITECTURE.md §2.7

import { jsonResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getStripe } from './_shared/stripe.js';
import crypto from 'node:crypto';

const AUDIT_WEBHOOK_SECRET_ENV = 'STRIPE_AUDIT_WEBHOOK_SECRET';
const AUDIT_PRICE_ENV = 'STRIPE_PRICE_STANDARD_AUDIT';

function issueMagicLinkToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  const sig = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'];
  if (!sig) return jsonResponse(400, { error: 'Missing Stripe-Signature header' });

  const secret = process.env[AUDIT_WEBHOOK_SECRET_ENV];
  if (!secret) {
    console.error(`${AUDIT_WEBHOOK_SECRET_ENV} is not configured`);
    return jsonResponse(500, { error: 'Webhook secret not configured' });
  }

  const stripe = getStripe();
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;

  let stripeEvent;
  try {
    stripeEvent = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return jsonResponse(400, { error: `Webhook verification failed: ${err.message}` });
  }

  const admin = getAdminClient();

  // Idempotency via the existing stripe_events table (migration 0014).
  const { error: dedupErr } = await admin
    .from('stripe_events')
    .insert({ stripe_event_id: stripeEvent.id, type: stripeEvent.type });
  if (dedupErr?.code === '23505') {
    return jsonResponse(200, { received: true, duplicate: true });
  }
  if (dedupErr) {
    return jsonResponse(500, { error: dedupErr.message });
  }

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;

        // Guard: only handle sessions tied to the audit price.
        const expectedPrice = process.env[AUDIT_PRICE_ENV];
        const lineItemPrice = session.metadata?.price_id
          || session.metadata?.product_code;
        if (expectedPrice && lineItemPrice && lineItemPrice !== expectedPrice
            && session.metadata?.product_code !== 'default_paralysis_diagnostic') {
          // Different product flowed through the same endpoint by mistake.
          // Acknowledge and move on so Stripe stops retrying.
          return jsonResponse(200, { received: true, skipped: 'wrong_product' });
        }

        const email = session.customer_email
          || session.customer_details?.email
          || session.metadata?.email
          || null;
        if (!email) {
          console.error('audit webhook: checkout.session.completed missing email', session.id);
          return jsonResponse(200, { received: true, skipped: 'no_email' });
        }

        const firstName = session.custom_fields?.find?.(
          (f) => f.key === 'first_name',
        )?.text?.value
          || session.metadata?.first_name
          || null;

        const partneredRaw = session.custom_fields?.find?.(
          (f) => f.key === 'partnered',
        )?.dropdown?.value;
        const partnered = partneredRaw === 'yes' ? true
          : partneredRaw === 'no' ? false
          : null;

        const magicLinkToken = issueMagicLinkToken();
        const magicLinkExpires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

        const { error: insertErr } = await admin.from('audits').insert({
          email,
          stripe_id: session.id,
          magic_link_token: magicLinkToken,
          magic_link_expires: magicLinkExpires,
          status: 'purchased',
          first_name: firstName,
          partnered,
        });
        if (insertErr && insertErr.code !== '23505') {
          console.error('audit insert failed', insertErr);
          return jsonResponse(500, { error: insertErr.message });
        }

        // Lead mirror: upsert into leads with audit_purchased tag.
        await admin.from('leads').upsert(
          {
            email,
            first_name: firstName,
            partnered,
            source: session.metadata?.source ?? 'diagnostic_landing',
            status: 'audit_purchased',
            tags: ['audit_purchased'],
            last_active: new Date().toISOString(),
          },
          { onConflict: 'email' },
        );

        // Event log.
        await admin.from('events').insert({
          name: 'audit_purchased',
          subject_id: email,
          email,
          properties: {
            stripe_session_id: session.id,
            amount_total: session.amount_total,
            first_name: firstName,
            partnered,
          },
          funnel_layer: 3,
          source: 'stripe',
        });

        // Phase 2B will: trigger Kit tag `audit_purchased`, send the magic
        // link via Kit broadcast, and surface `magic_link_token` in the
        // welcome email. For now the token is persisted; the buyer journey
        // resumes once Phase 2B lands the messaging layer.
        return jsonResponse(200, {
          received: true,
          audit_id_persisted: true,
          phase: '2A',
        });
      }
      case 'checkout.session.expired':
      case 'checkout.session.async_payment_failed': {
        const session = stripeEvent.data.object;
        await admin.from('events').insert({
          name: 'audit_checkout_failed',
          subject_id: session.customer_email ?? null,
          email: session.customer_email ?? null,
          properties: {
            stripe_session_id: session.id,
            reason: stripeEvent.type,
          },
          funnel_layer: 3,
          source: 'stripe',
        });
        return jsonResponse(200, { received: true });
      }
      default:
        return jsonResponse(200, { received: true, ignored: stripeEvent.type });
    }
  } catch (err) {
    console.error('stripe-audit-webhook handler error', err);
    return jsonResponse(500, { error: err.message ?? 'internal_error' });
  }
};
