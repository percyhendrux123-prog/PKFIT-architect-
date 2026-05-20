#!/usr/bin/env node
/**
 * stripe-audit-product.mjs
 *
 * Creates "The Standard Audit" Stripe Product + $47 one-time Price in TEST
 * MODE. Idempotent — re-running with the same product_code metadata updates
 * the existing product instead of creating a duplicate.
 *
 * Run from pkfit-architect root:
 *
 *   STRIPE_API_KEY=sk_test_xxx node scripts/stripe-audit-product.mjs
 *
 * To force live mode (Phase 3 only, after QA sign-off), set STRIPE_LIVE=1
 * AND pass a sk_live_ key. The script refuses to run with a live key
 * unless STRIPE_LIVE=1 is explicit.
 *
 * Output: prints product_id, price_id, statement_descriptor. Append these
 * to your Netlify env as STRIPE_PRODUCT_STANDARD_AUDIT / STRIPE_PRICE_STANDARD_AUDIT.
 */

import Stripe from 'stripe';

const key = process.env.STRIPE_API_KEY;
if (!key) {
  console.error('STRIPE_API_KEY env var is required (sk_test_xxx for test mode).');
  process.exit(1);
}

if (key.startsWith('sk_live_') && process.env.STRIPE_LIVE !== '1') {
  console.error(
    'Refusing to run against a LIVE key without STRIPE_LIVE=1. ' +
      'Phase 2A is test-mode-only; live mode is gated behind Phase 3 QA.',
  );
  process.exit(1);
}

const stripe = new Stripe(key, { apiVersion: '2025-02-24.acacia' });

const PRODUCT_CODE = 'default_paralysis_diagnostic';

async function findExistingProduct() {
  // Stripe doesn't index custom metadata for search on standard accounts;
  // page through products and match by metadata.product_code.
  let result = await stripe.products.list({ limit: 100, active: true });
  for (;;) {
    const match = result.data.find(
      (p) => p.metadata?.product_code === PRODUCT_CODE,
    );
    if (match) return match;
    if (!result.has_more) return null;
    const last = result.data[result.data.length - 1];
    result = await stripe.products.list({ limit: 100, starting_after: last.id });
  }
}

async function findActiveOneTime47Price(productId) {
  const prices = await stripe.prices.list({
    product: productId,
    active: true,
    limit: 100,
  });
  return (
    prices.data.find(
      (p) =>
        p.unit_amount === 4700 &&
        p.currency === 'usd' &&
        p.type === 'one_time',
    ) ?? null
  );
}

(async () => {
  console.log(
    `Stripe mode: ${key.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`,
  );

  let product = await findExistingProduct();
  if (product) {
    console.log(`Found existing product: ${product.id}. Updating...`);
    product = await stripe.products.update(product.id, {
      name: 'The Standard Audit',
      description:
        'Diagnose the mechanism behind the breakdown. $47 includes the diagnostic, a written verdict, and a 14-day protocol.',
      statement_descriptor: 'PKFIT AUDIT',
      metadata: {
        product_code: PRODUCT_CODE,
        funnel_layer: '3',
        upsell_target: 'performance_standard',
      },
    });
  } else {
    console.log('No existing product. Creating...');
    product = await stripe.products.create({
      name: 'The Standard Audit',
      description:
        'Diagnose the mechanism behind the breakdown. $47 includes the diagnostic, a written verdict, and a 14-day protocol.',
      statement_descriptor: 'PKFIT AUDIT',
      metadata: {
        product_code: PRODUCT_CODE,
        funnel_layer: '3',
        upsell_target: 'performance_standard',
      },
    });
  }

  let price = await findActiveOneTime47Price(product.id);
  if (!price) {
    console.log('Creating $47 one-time price...');
    price = await stripe.prices.create({
      product: product.id,
      unit_amount: 4700,
      currency: 'usd',
      metadata: { product_code: PRODUCT_CODE },
    });
  } else {
    console.log(`Found existing $47 price: ${price.id}`);
  }

  console.log('');
  console.log('─── Phase 2A Stripe Setup ──────────────────────────────');
  console.log(`Product ID:           ${product.id}`);
  console.log(`Price ID:             ${price.id}`);
  console.log(`Statement descriptor: ${product.statement_descriptor}`);
  console.log(`Mode:                 ${key.startsWith('sk_live_') ? 'LIVE' : 'TEST'}`);
  console.log('');
  console.log('Add to Netlify env (pkfit-architect):');
  console.log(`  STRIPE_PRODUCT_STANDARD_AUDIT=${product.id}`);
  console.log(`  STRIPE_PRICE_STANDARD_AUDIT=${price.id}`);
  console.log('');
  console.log('Next: create webhook endpoint in Stripe dashboard pointing at');
  console.log('  https://<netlify-site>/api/webhooks/stripe-audit');
  console.log('Capture the resulting whsec_xxx and set STRIPE_AUDIT_WEBHOOK_SECRET.');
})().catch((err) => {
  console.error('stripe-audit-product failed:', err.message ?? err);
  process.exit(1);
});
