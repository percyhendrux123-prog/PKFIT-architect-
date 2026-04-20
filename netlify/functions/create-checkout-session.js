import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getStripe, priceIdFor } from './_shared/stripe.js';

const VALID_TIERS = new Set(['performance', 'identity', 'full', 'premium']);
const VALID_INTERVALS = new Set(['monthly', 'annual']);

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, profile } = await requireUser(event);
    const { tier, interval } = JSON.parse(event.body || '{}');

    if (!VALID_TIERS.has(tier)) return jsonResponse(400, { error: 'Invalid tier' });
    if (!VALID_INTERVALS.has(interval)) return jsonResponse(400, { error: 'Invalid interval' });

    const siteUrl = process.env.VITE_SITE_URL || process.env.URL || 'http://localhost:5173';
    const stripe = getStripe();

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceIdFor(tier, interval), quantity: 1 }],
      client_reference_id: user.id,
      customer_email: profile?.email ?? user.email,
      metadata: { client_id: user.id, tier, interval },
      subscription_data: { metadata: { client_id: user.id, tier, interval } },
      success_url: `${siteUrl}/billing?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${siteUrl}/billing?status=cancelled`,
    });

    return jsonResponse(200, { url: session.url });
  } catch (e) {
    return errorResponse(e);
  }
};
