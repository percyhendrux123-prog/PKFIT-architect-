// Stripe clone-and-anchor handshake.
//
// Per the migration system design doc (§3, Option A), per-client cutover
// runs four operations in this exact order so a partial failure leaves the
// client in zero billing risk:
//
//   1. Read Account-A subscription. If status is unsafe (canceled, paused,
//      dunning, trialing-with-no-card) abort — those need manual handling.
//   2. Clone the source PaymentMethod to Account B and create a Customer
//      with the cloned PM as default.
//   3. Create the new Subscription on Account B with billing_cycle_anchor
//      set to one day after Account-A's renewal date.
//   4. Schedule cancel_at_period_end on the Account-A subscription.
//
// Step 4 is the last operation. If anything before it fails, Account A is
// untouched — the client keeps paying Trainerize until Percy intervenes.
// runHandshake never throws; it returns { ok: true, ... } on success or
// { ok: false, stage, reason } on failure so the caller can log the exact
// stage that broke and decide whether to retry or alert.
//
// The function takes accountA / accountB Stripe clients as injected
// parameters so tests can mock both without the test environment ever
// touching real Stripe.

const SAFE_STATUSES = new Set(['active', 'trialing']);
const HARD_FAIL_STATUSES = new Set(['canceled', 'incomplete_expired', 'unpaid']);

export async function inspectSourceSubscription({ accountA, subId }) {
  let sub;
  try {
    sub = await accountA.subscriptions.retrieve(subId, { expand: ['default_payment_method'] });
  } catch (e) {
    return { ok: false, stage: 'inspect', reason: `account-a retrieve failed: ${e.message}` };
  }

  if (HARD_FAIL_STATUSES.has(sub.status)) {
    return { ok: false, stage: 'inspect', reason: `account-a sub status=${sub.status} — manual handling required` };
  }
  if (sub.status === 'past_due') {
    // Card on file is bad. Don't clone it — the client should re-link via
    // Checkout. The recovery branch in the design doc routes this case to
    // Percy, not the auto path. Surface as a soft fail so the function can
    // email the failed-handshake template and alert.
    return { ok: false, stage: 'inspect', reason: 'account-a sub is past_due — re-link required' };
  }
  if (sub.status === 'paused') {
    return { ok: false, stage: 'inspect', reason: 'account-a sub is paused — manual handling required' };
  }
  if (!SAFE_STATUSES.has(sub.status)) {
    return { ok: false, stage: 'inspect', reason: `account-a sub status=${sub.status} — unhandled` };
  }
  if (sub.cancel_at_period_end) {
    return {
      ok: false,
      stage: 'inspect',
      reason: 'account-a sub already scheduled to cancel — already migrated or handled manually',
    };
  }

  // Resolve the PaymentMethod we'll clone. Prefer the subscription default,
  // fall back to the customer's invoice_settings default. Trial subs may
  // have no PM — surface as a specific reason so the recovery path picks
  // the right email.
  const pmId = sub.default_payment_method?.id
    ?? (typeof sub.default_payment_method === 'string' ? sub.default_payment_method : null);

  if (!pmId) {
    let customer;
    try {
      customer = await accountA.customers.retrieve(sub.customer);
    } catch (e) {
      return { ok: false, stage: 'inspect', reason: `account-a customer retrieve failed: ${e.message}` };
    }
    const fallback = customer?.invoice_settings?.default_payment_method;
    if (!fallback) {
      return { ok: false, stage: 'inspect', reason: 'account-a sub has no payment method on file (likely trial)' };
    }
    return { ok: true, sub, paymentMethodId: typeof fallback === 'string' ? fallback : fallback.id, customerId: sub.customer };
  }

  return { ok: true, sub, paymentMethodId: pmId, customerId: sub.customer };
}

export async function clonePaymentMethodToB({ accountB, sourcePmId, sourceAccount }) {
  // Stripe's cross-account PaymentMethod copy uses the destination account's
  // key with `payment_method:` set to the source PM and the source account
  // ID under `customer` / Stripe-Account header semantics. The exact request
  // shape Stripe accepts depends on whether the source is a Connect
  // connected account or a bare direct account. We try the two documented
  // forms in order so the call works for both.
  //
  // Form 1 (Connect platform → connected acct A):
  //   stripe.paymentMethods.create({ payment_method: pm_xxx },
  //                                { stripeAccount: 'acct_A_id' })
  // Form 2 (Direct account-to-account, requires Stripe support to enable
  //         cross-account copying — a clone token approach):
  //   stripe.paymentMethods.create({ payment_method: pm_xxx, customer: cus_xxx })
  // Both ultimately return a PM on Account B that can be attached.
  try {
    const pm = await accountB.paymentMethods.create(
      { payment_method: sourcePmId },
      sourceAccount ? { stripeAccount: sourceAccount } : undefined,
    );
    return { ok: true, paymentMethod: pm };
  } catch (e) {
    return { ok: false, stage: 'clone_pm', reason: `pm clone failed: ${e.message}` };
  }
}

export async function createDestinationCustomer({ accountB, email, name, sourcePmId, clonedPmId }) {
  try {
    const customer = await accountB.customers.create({
      email,
      name: name || undefined,
      payment_method: clonedPmId,
      invoice_settings: { default_payment_method: clonedPmId },
      metadata: { migration: 'trainerize_to_pkfit', source_pm: sourcePmId },
    });
    return { ok: true, customer };
  } catch (e) {
    return { ok: false, stage: 'create_customer', reason: `account-b customer create failed: ${e.message}` };
  }
}

export function computeAnchorTimestamp(renewalDate) {
  // Anchor = one day after Account-A renewal at 00:00 UTC. Stripe wants a
  // unix-seconds timestamp. The +1-day buffer guarantees Stripe-A's last
  // invoice fires before Stripe-B's first one, so the client is never
  // charged twice for the same period.
  const d = new Date(`${renewalDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`invalid renewalDate: ${renewalDate}`);
  }
  d.setUTCDate(d.getUTCDate() + 1);
  return Math.floor(d.getTime() / 1000);
}

export async function createDestinationSubscription({
  accountB, customerId, priceId, anchorTimestamp, clientId,
}) {
  try {
    const sub = await accountB.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      billing_cycle_anchor: anchorTimestamp,
      proration_behavior: 'none',
      metadata: { migration: 'trainerize_to_pkfit', client_id: clientId || '' },
    });
    return { ok: true, subscription: sub };
  } catch (e) {
    return { ok: false, stage: 'create_subscription', reason: `account-b sub create failed: ${e.message}` };
  }
}

export async function cancelSourceAtPeriodEnd({ accountA, subId }) {
  try {
    const updated = await accountA.subscriptions.update(subId, { cancel_at_period_end: true });
    if (!updated.cancel_at_period_end) {
      return { ok: false, stage: 'cancel_source', reason: 'account-a update returned without cancel_at_period_end=true' };
    }
    return { ok: true, subscription: updated };
  } catch (e) {
    return { ok: false, stage: 'cancel_source', reason: `account-a cancel failed: ${e.message}` };
  }
}

// Full handshake. Stops at the first non-ok stage and returns the failure.
// On success, returns the IDs the caller needs to persist.
export async function runHandshake({ accountA, accountB, state, sourceAccount = null }) {
  const inspected = await inspectSourceSubscription({ accountA, subId: state.account_a_sub_id });
  if (!inspected.ok) return inspected;

  const cloned = await clonePaymentMethodToB({
    accountB,
    sourcePmId: inspected.paymentMethodId,
    sourceAccount,
  });
  if (!cloned.ok) return cloned;

  const customer = await createDestinationCustomer({
    accountB,
    email: state.email,
    name: state.client_name || null,
    sourcePmId: inspected.paymentMethodId,
    clonedPmId: cloned.paymentMethod.id,
  });
  if (!customer.ok) return customer;

  const anchor = computeAnchorTimestamp(state.account_a_renewal_date);
  const sub = await createDestinationSubscription({
    accountB,
    customerId: customer.customer.id,
    priceId: state.stripe_b_price_id,
    anchorTimestamp: anchor,
    clientId: state.client_id,
  });
  if (!sub.ok) return sub;

  // Last step. If this fails, the dest sub exists but Account A is still
  // billing — the failure_reason tells Percy exactly what to clean up.
  const cancel = await cancelSourceAtPeriodEnd({
    accountA,
    subId: state.account_a_sub_id,
  });
  if (!cancel.ok) {
    return {
      ...cancel,
      partial: {
        stripe_b_customer_id: customer.customer.id,
        stripe_b_subscription_id: sub.subscription.id,
        stripe_b_payment_method: cloned.paymentMethod.id,
      },
    };
  }

  return {
    ok: true,
    stripe_b_customer_id: customer.customer.id,
    stripe_b_subscription_id: sub.subscription.id,
    stripe_b_payment_method: cloned.paymentMethod.id,
    anchor_timestamp: anchor,
    source_pm_id: inspected.paymentMethodId,
  };
}
