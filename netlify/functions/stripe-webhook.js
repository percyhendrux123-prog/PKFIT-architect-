import { jsonResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getStripe } from './_shared/stripe.js';

// Netlify functions receive the raw request body on `event.body` directly
// (base64-encoded when `event.isBase64Encoded` is true). Stripe signature
// verification needs that raw byte stream — do not JSON.parse it.

function mapStatus(s) {
  const allowed = ['active', 'trialing', 'past_due', 'canceled', 'incomplete'];
  return allowed.includes(s) ? s : 'incomplete';
}

function tierFromPriceId(priceId) {
  const map = {
    [process.env.STRIPE_PRICE_PERFORMANCE_MONTHLY]: 'performance',
    [process.env.STRIPE_PRICE_PERFORMANCE_ANNUAL]: 'performance',
    [process.env.STRIPE_PRICE_IDENTITY_MONTHLY]: 'identity',
    [process.env.STRIPE_PRICE_IDENTITY_ANNUAL]: 'identity',
    [process.env.STRIPE_PRICE_FULL_MONTHLY]: 'full',
    [process.env.STRIPE_PRICE_FULL_ANNUAL]: 'full',
    [process.env.STRIPE_PRICE_PREMIUM_MONTHLY]: 'premium',
    [process.env.STRIPE_PRICE_PREMIUM_ANNUAL]: 'premium',
  };
  return map[priceId] ?? null;
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  const sig = event.headers?.['stripe-signature'] || event.headers?.['Stripe-Signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return jsonResponse(400, { error: 'Missing signature' });

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

  try {
    switch (stripeEvent.type) {
      case 'checkout.session.completed': {
        const session = stripeEvent.data.object;
        const clientId = session.client_reference_id ?? session.metadata?.client_id;
        if (!clientId) break;
        const tier = session.metadata?.tier ?? null;

        await admin.from('payments').upsert(
          {
            client_id: clientId,
            plan: tier,
            amount: session.amount_total ? session.amount_total / 100 : null,
            status: 'active',
            stripe_subscription_id: session.subscription ?? null,
            stripe_customer_id: session.customer ?? null,
          },
          { onConflict: 'stripe_subscription_id' },
        );
        if (tier) {
          await admin.from('profiles').update({ plan: tier }).eq('id', clientId);
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub = stripeEvent.data.object;
        const clientId = sub.metadata?.client_id;
        const priceId = sub.items?.data?.[0]?.price?.id;
        const tier = tierFromPriceId(priceId);
        const amount = sub.items?.data?.[0]?.price?.unit_amount;
        await admin.from('payments').upsert(
          {
            client_id: clientId,
            plan: tier ?? sub.metadata?.tier ?? null,
            amount: amount ? amount / 100 : null,
            status: mapStatus(sub.status),
            stripe_subscription_id: sub.id,
            stripe_customer_id: sub.customer,
            current_period_end: sub.current_period_end
              ? new Date(sub.current_period_end * 1000).toISOString()
              : null,
          },
          { onConflict: 'stripe_subscription_id' },
        );
        if (clientId && tier) {
          await admin.from('profiles').update({ plan: tier }).eq('id', clientId);
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = stripeEvent.data.object;
        const clientId = sub.metadata?.client_id;
        await admin
          .from('payments')
          .update({ status: 'canceled' })
          .eq('stripe_subscription_id', sub.id);
        if (clientId) {
          await admin.from('profiles').update({ plan: null }).eq('id', clientId);
        }
        break;
      }
      default:
        break;
    }
  } catch (e) {
    return jsonResponse(500, { error: e.message });
  }

  return jsonResponse(200, { received: true });
};
