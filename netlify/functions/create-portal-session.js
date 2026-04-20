import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getStripe } from './_shared/stripe.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const admin = getAdminClient();
    const { data: payment } = await admin
      .from('payments')
      .select('stripe_customer_id')
      .eq('client_id', user.id)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!payment?.stripe_customer_id) {
      return jsonResponse(400, { error: 'No Stripe customer found for this account' });
    }

    const siteUrl = process.env.VITE_SITE_URL || process.env.URL || 'http://localhost:5173';
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: payment.stripe_customer_id,
      return_url: `${siteUrl}/billing`,
    });
    return jsonResponse(200, { url: portal.url });
  } catch (e) {
    return errorResponse(e);
  }
};
