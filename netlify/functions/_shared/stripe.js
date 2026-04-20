import Stripe from 'stripe';

let client = null;
export function getStripe() {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  client = new Stripe(key, { apiVersion: '2024-09-30.acacia' });
  return client;
}

export const PLAN_AMOUNTS = {
  performance: { monthly: 250, annual: 2490 },
  identity: { monthly: 350, annual: 3486 },
  full: { monthly: 450, annual: 4482 },
  premium: { monthly: 750, annual: 7470 },
};

export function priceIdFor(tier, interval) {
  const key = `STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`;
  const priceId = process.env[key];
  if (!priceId) throw new Error(`Price env var ${key} is not set`);
  return priceId;
}
