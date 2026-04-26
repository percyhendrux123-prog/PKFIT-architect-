// Daily migration recovery worker.
//
// Scheduled via netlify.toml. Walks the active migration_state rows and fires
// the right reminder email for each branch in §5 of the design doc:
//
//   - email_sent ≥ 3 days, no click       → reminder_day_3
//   - email_sent ≥ 7 days, no click       → reminder_day_7
//   - clicked ≥ 24h, no sign_in           → reminder_day_3 (reuses copy;
//                                            front-end will surface the
//                                            "fresh sign-in link" UX)
//   - signed_in ≥ 24h, no consent         → in-app banner trigger (no email
//                                            here — the front-end handles it)
//   - transferred ≥ 7 days, never logged in → onboarding_no_signin
//   - transferred ≥ 7 days, signed in but
//     no activity                          → onboarding_no_activity
//
// The worker is intentionally idempotent — each branch checks a sent_at
// column on migration_state before firing, so a same-day re-run won't
// double-send. It updates that timestamp on success.
//
// All emails go through the same render+send pipeline as the inline
// confirmation email; if RESEND_API_KEY isn't set the worker logs and skips.

import { jsonResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { renderEmail, sendEmail } from './_shared/migration-emails.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const SITE_URL = process.env.VITE_SITE_URL || 'https://app.pkfit.app';
const CALENDLY_URL = process.env.MIGRATION_CALENDLY_URL || 'https://calendly.com/percyfitness/15min';

function ageMs(iso, now = Date.now()) {
  if (!iso) return Infinity;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return Infinity;
  return now - t;
}

function ctaUrl(token) {
  return `${SITE_URL}/migrate/${token}`;
}

function deadlineDate() {
  // 14 days from today, ISO date. Used for the urgency line in reminder
  // emails. Computed at send time so a stale email blast doesn't carry a
  // past deadline.
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 14);
  return d.toISOString().slice(0, 10);
}

function firstNameFromEmail(email) {
  return (email || '').split('@')[0];
}

export const handler = async () => {
  return runRecovery({ admin: getAdminClient() }).catch((e) => jsonResponse(500, { error: e.message }));
};

export async function runRecovery({ admin, now = Date.now() }) {
  // Pull every row that is *not* in a terminal state. The "dormant" state is
  // explicitly out — Wave 1 handles its own re-engagement cadence.
  const { data: rows, error } = await admin
    .from('migration_state')
    .select('*')
    .in('state', ['email_sent', 'clicked', 'signed_in', 'consented', 'transferred']);
  if (error) return jsonResponse(500, { error: error.message });

  const summary = {
    total: rows.length,
    reminder_day_3: 0,
    reminder_day_7: 0,
    onboarding_no_signin: 0,
    onboarding_no_activity: 0,
    skipped_no_provider: 0,
    skipped: 0,
  };

  for (const row of rows ?? []) {
    const decision = pickBranch(row, now);
    if (!decision) {
      summary.skipped += 1;
      continue;
    }

    let res;
    try {
      const { subject, body } = renderEmail(decision.template, {
        first_name: firstNameFromEmail(row.email),
        cta_url: ctaUrl(row.migration_token),
        deadline_date: deadlineDate(),
        calendly_url: CALENDLY_URL,
      });
      res = await sendEmail({ to: row.email, subject, body });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[migration-recovery] send failed for ${row.email}:`, e.message);
      summary.skipped += 1;
      continue;
    }

    if (!res.sent) {
      summary.skipped_no_provider += 1;
      continue;
    }

    summary[decision.template] = (summary[decision.template] ?? 0) + 1;

    await admin
      .from('migration_state')
      .update({ [decision.touchColumn]: new Date().toISOString() })
      .eq('id', row.id);

    await admin.from('migration_events').insert({
      migration_state_id: row.id,
      event_type: `recovery_email_${decision.template}`,
      metadata: { branch: decision.branch },
    });
  }

  return jsonResponse(200, summary);
}

// Decision table. Returns null if no action is needed — keep the structure
// flat so adding a branch is a one-liner. Order matters: a row that qualifies
// for both the day-7 reminder and the day-3 reminder should fire the day-7
// one (further along the funnel takes precedence).
export function pickBranch(row, now = Date.now()) {
  const sentMs = ageMs(row.email_sent_at, now);
  const stateMs = ageMs(row.updated_at, now);

  // day-7 reminder: email_sent ≥ 7d, never clicked, day-7 reminder not yet sent.
  if (
    row.state === 'email_sent'
    && row.email_sent_at
    && sentMs >= 7 * DAY_MS
    && !row.reminder_7d_sent_at
  ) {
    return { template: 'reminder_day_7', touchColumn: 'reminder_7d_sent_at', branch: 'email_no_click_7d' };
  }

  // day-3 reminder: email_sent ≥ 3d, never clicked, day-3 reminder not yet sent.
  if (
    row.state === 'email_sent'
    && row.email_sent_at
    && sentMs >= 3 * DAY_MS
    && !row.reminder_3d_sent_at
  ) {
    return { template: 'reminder_day_3', touchColumn: 'reminder_3d_sent_at', branch: 'email_no_click_3d' };
  }

  // clicked-but-stalled: clicked ≥ 24h, OTP wasn't completed.
  if (
    row.state === 'clicked'
    && stateMs >= DAY_MS
    && !row.reminder_3d_sent_at
  ) {
    return { template: 'reminder_day_3', touchColumn: 'reminder_3d_sent_at', branch: 'clicked_no_signin_24h' };
  }

  // transferred ≥ 7d, no onboarding nudge yet. We can't easily tell here
  // whether the client signed in — pick the no-signin variant by default.
  // The signed-in-no-activity variant is fired manually by Percy from the
  // admin dashboard for those clients. (Auto-detecting "no activity" needs
  // a join across workout_sessions + check_ins + dm_messages, out of
  // scope for the recovery cron.)
  if (
    row.state === 'transferred'
    && stateMs >= 7 * DAY_MS
    && !row.onboarding_nudge_sent_at
  ) {
    return {
      template: 'onboarding_no_signin',
      touchColumn: 'onboarding_nudge_sent_at',
      branch: 'transferred_dormant_7d',
    };
  }

  return null;
}
