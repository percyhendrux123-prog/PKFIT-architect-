import Stripe from 'stripe';

const API_VERSION = '2024-09-30.acacia';

let client = null;
export function getStripe() {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY missing');
  client = new Stripe(key, { apiVersion: API_VERSION });
  return client;
}

// Account A is the legacy Stripe account that's billing clients today
// (currently routed through Trainerize Pay / direct Stripe). The migration
// reads PaymentMethods from there and schedules a cancel-at-period-end on
// the live sub. A separate API key is required because Stripe's
// PaymentMethod / Subscription APIs are scoped to one account at a time.
let accountAClient = null;
export function getStripeAccountA() {
  if (accountAClient) return accountAClient;
  const key = process.env.STRIPE_ACCOUNT_A_SECRET_KEY;
  if (!key) throw new Error('STRIPE_ACCOUNT_A_SECRET_KEY missing');
  accountAClient = new Stripe(key, { apiVersion: API_VERSION });
  return accountAClient;
}

// Reset cached clients — used by tests when swapping mocks between cases.
export function __resetStripeClients() {
  client = null;
  accountAClient = null;
}

export const PLAN_AMOUNTS = {
  // Active tiers (tier-aware Claude routing): Haiku / Sonnet / Opus.
  tier1: { monthly: 250, annual: 2490 },
  tier2: { monthly: 475, annual: 4731 },
  tier3: { monthly: 750, annual: 7470 },
  // Legacy plan names retained so historical payments rows still resolve.
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
