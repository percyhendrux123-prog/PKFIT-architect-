// migration-recovery
//
// Coverage targets the decision-table (pickBranch) and the worker loop:
//   1. email_sent ≥ 7d, never reminded → reminder_day_7
//   2. email_sent ≥ 3d, < 7d, never reminded → reminder_day_3
//   3. clicked ≥ 24h, no signin → reminder_day_3 (clicked_no_signin_24h)
//   4. transferred ≥ 7d, no nudge → onboarding_no_signin
//   5. nothing fires when no row meets a branch
//   6. when RESEND_API_KEY is unset, the worker counts skipped_no_provider
//      and does NOT bump the touch column (so the next run can retry)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from './helpers/supabase-mock.js';

const supabaseMock = createSupabaseMock();
vi.mock('../netlify/functions/_shared/supabase-admin.js', () => ({
  getAdminClient: () => supabaseMock,
  getAnonClient: () => supabaseMock,
}));

const originalFetch = global.fetch;
let okFetch;

beforeEach(() => {
  supabaseMock.__reset();
  okFetch = vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ id: 'em_1' }),
    text: () => Promise.resolve(''),
  });
  global.fetch = okFetch;
});

afterEach(() => {
  global.fetch = originalFetch;
  delete process.env.RESEND_API_KEY;
});

const NOW = new Date('2026-05-15T12:00:00Z').getTime();

function rowEmailSent({ daysAgo, reminders = {} }) {
  const sent = new Date(NOW - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  return {
    id: `mig-${daysAgo}`,
    email: `client${daysAgo}@example.com`,
    state: 'email_sent',
    migration_token: '11111111-1111-1111-1111-111111111111',
    email_sent_at: sent,
    updated_at: sent,
    reminder_3d_sent_at: reminders.day3 ?? null,
    reminder_7d_sent_at: reminders.day7 ?? null,
    onboarding_nudge_sent_at: null,
    account_a_renewal_date: '2026-06-01',
    stripe_b_price_id: 'price_perf_m',
  };
}

describe('pickBranch', () => {
  it('returns null for fresh rows (under 3 days)', async () => {
    const { pickBranch } = await import('../netlify/functions/migration-recovery.js');
    expect(pickBranch(rowEmailSent({ daysAgo: 1 }), NOW)).toBeNull();
  });

  it('fires reminder_day_3 for 3-day-old emails', async () => {
    const { pickBranch } = await import('../netlify/functions/migration-recovery.js');
    const decision = pickBranch(rowEmailSent({ daysAgo: 3 }), NOW);
    expect(decision).toMatchObject({
      template: 'reminder_day_3',
      branch: 'email_no_click_3d',
      touchColumn: 'reminder_3d_sent_at',
    });
  });

  it('skips reminder_day_3 if already sent', async () => {
    const { pickBranch } = await import('../netlify/functions/migration-recovery.js');
    const r = rowEmailSent({ daysAgo: 4, reminders: { day3: '2026-05-13T12:00:00Z' } });
    expect(pickBranch(r, NOW)).toBeNull();
  });

  it('fires reminder_day_7 for 7-day-old emails (priority over day_3)', async () => {
    const { pickBranch } = await import('../netlify/functions/migration-recovery.js');
    const r = rowEmailSent({ daysAgo: 7 });
    const decision = pickBranch(r, NOW);
    expect(decision.template).toBe('reminder_day_7');
  });

  it('fires reminder_day_3 for clicked-but-stalled rows ≥ 24h', async () => {
    const { pickBranch } = await import('../netlify/functions/migration-recovery.js');
    const updated = new Date(NOW - 26 * 60 * 60 * 1000).toISOString();
    const decision = pickBranch(
      {
        id: 'mig-clicked',
        email: 'c@example.com',
        state: 'clicked',
        migration_token: 'tok',
        email_sent_at: updated,
        updated_at: updated,
        reminder_3d_sent_at: null,
        reminder_7d_sent_at: null,
        onboarding_nudge_sent_at: null,
      },
      NOW,
    );
    expect(decision.branch).toBe('clicked_no_signin_24h');
  });

  it('fires onboarding_no_signin for transferred rows ≥ 7d', async () => {
    const { pickBranch } = await import('../netlify/functions/migration-recovery.js');
    const updated = new Date(NOW - 8 * 24 * 60 * 60 * 1000).toISOString();
    const decision = pickBranch(
      {
        id: 'mig-onboarding',
        email: 'c@example.com',
        state: 'transferred',
        migration_token: 'tok',
        email_sent_at: updated,
        updated_at: updated,
        onboarding_nudge_sent_at: null,
      },
      NOW,
    );
    expect(decision.template).toBe('onboarding_no_signin');
    expect(decision.touchColumn).toBe('onboarding_nudge_sent_at');
  });
});

describe('runRecovery', () => {
  it('counts skipped_no_provider when RESEND_API_KEY is unset', async () => {
    delete process.env.RESEND_API_KEY;
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') {
        return { data: [rowEmailSent({ daysAgo: 4 })], error: null };
      }
      return { data: null, error: null };
    });

    const { runRecovery } = await import('../netlify/functions/migration-recovery.js');
    const res = await runRecovery({ admin: supabaseMock, now: NOW });
    expect(res.statusCode).toBe(200);
    const summary = JSON.parse(res.body);
    expect(summary.total).toBe(1);
    expect(summary.skipped_no_provider).toBe(1);
    expect(summary.reminder_day_3).toBe(0);

    // Critical: no touch column was bumped, so the next run will retry.
    const updates = supabaseMock.__calls.filter((c) => c.method === 'migration_state.update');
    expect(updates).toHaveLength(0);
  });

  it('sends + bumps the touch column when RESEND_API_KEY is set', async () => {
    process.env.RESEND_API_KEY = 're_test';
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') {
        return { data: [rowEmailSent({ daysAgo: 4 })], error: null };
      }
      return { data: null, error: null };
    });

    const { runRecovery } = await import('../netlify/functions/migration-recovery.js');
    const res = await runRecovery({ admin: supabaseMock, now: NOW });
    expect(res.statusCode).toBe(200);
    const summary = JSON.parse(res.body);
    expect(summary.reminder_day_3).toBe(1);

    expect(okFetch).toHaveBeenCalledTimes(1);
    expect(okFetch.mock.calls[0][0]).toBe('https://api.resend.com/emails');

    const updates = supabaseMock.__calls.filter((c) => c.method === 'migration_state.update');
    expect(updates).toHaveLength(1);
    expect(updates[0].args[0]).toHaveProperty('reminder_3d_sent_at');

    const eventInsert = supabaseMock.__calls.find((c) => c.method === 'migration_events.insert');
    expect(eventInsert.args[0].event_type).toBe('recovery_email_reminder_day_3');
  });

  it('returns total=0 when no rows match', async () => {
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'migration_state' && op === 'select') {
        return { data: [], error: null };
      }
      return { data: null, error: null };
    });
    const { runRecovery } = await import('../netlify/functions/migration-recovery.js');
    const res = await runRecovery({ admin: supabaseMock, now: NOW });
    expect(JSON.parse(res.body).total).toBe(0);
  });
});
