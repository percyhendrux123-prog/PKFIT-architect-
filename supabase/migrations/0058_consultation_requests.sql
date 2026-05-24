-- ════════════════════════════════════════════════════════════════════════════
-- 0058_consultation_requests.sql
-- ════════════════════════════════════════════════════════════════════════════
-- PURPOSE
-- ────────
-- Backs the new tool-use surfaces on the public diagnose intake (/standard,
-- /structure, /system, /protocol, /align). The Claude agent now emits tool
-- calls — offer_workbook, offer_qualifier, offer_consultation,
-- generate_micro_plan — rendered as UI cards. We need to:
--
--   1. Track which tools fired per session, whether the lead clicked through,
--      and what email (if any) we captured. Extension of diagnose_sessions.
--
--   2. Capture explicit consultation requests with a real email + preferred
--      times. New table consultation_requests, anon INSERT allowed, owner-only
--      read/update. A row here is a hand-raise; Resend fires Percy an email
--      with the full transcript on insert (server-side, from the function).
--
-- DEPENDS ON
-- ──────────
-- - 0056_diagnose_sessions.sql (creates diagnose_sessions + public_rate_limits)
-- - 0054_rls_three_tier_scope.sql (profiles.is_owner)
-- ════════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ─── extend diagnose_sessions ───────────────────────────────────────────
-- New columns capture the lead-tracking surface so /standard can be queried
-- like a funnel without joining to consultation_requests for everything.

alter table public.diagnose_sessions
  add column if not exists lead_email text,
  add column if not exists gumroad_clicked boolean not null default false,
  add column if not exists consultation_requested boolean not null default false,
  add column if not exists tools_invoked jsonb not null default '[]'::jsonb;

create index if not exists diagnose_sessions_lead_email_idx
  on public.diagnose_sessions (lead_email)
  where lead_email is not null;

create index if not exists diagnose_sessions_consultation_idx
  on public.diagnose_sessions (consultation_requested)
  where consultation_requested = true;

-- ─── consultation_requests ──────────────────────────────────────────────

create table if not exists public.consultation_requests (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  session_id        uuid references public.diagnose_sessions(id) on delete set null,
  lead_email        text not null,
  preferred_times   text not null,
  full_conversation jsonb not null default '[]'::jsonb,
  status            text not null default 'pending'
                    check (status in ('pending','contacted','scheduled','closed','dropped'))
);

create index if not exists consultation_requests_created_at_idx
  on public.consultation_requests (created_at desc);

create index if not exists consultation_requests_status_idx
  on public.consultation_requests (status);

create index if not exists consultation_requests_session_idx
  on public.consultation_requests (session_id)
  where session_id is not null;

alter table public.consultation_requests enable row level security;

-- Anonymous visitors can request a consultation. The function inserts via
-- service role normally, but anon insert is allowed for parity with
-- diagnose_sessions. Inserted rows must be fresh — status='pending', empty
-- full_conversation. The function will populate full_conversation server-side
-- from diagnose_sessions, so anon-inserted rows arrive empty and the server
-- can refuse to dispatch email unless the row contains a real transcript.
drop policy if exists "consultation_requests_anon_insert" on public.consultation_requests;
create policy "consultation_requests_anon_insert"
  on public.consultation_requests
  for insert
  to anon, authenticated
  with check (
    status = 'pending'
    and full_conversation = '[]'::jsonb
  );

-- Only the owner (Percy) can read. These are unverified leads, not members,
-- so coaches don't see them either. Service role bypasses RLS for the
-- function's server-side writes/reads.
drop policy if exists "consultation_requests_owner_select" on public.consultation_requests;
create policy "consultation_requests_owner_select"
  on public.consultation_requests
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_owner, false) = true
    )
  );

drop policy if exists "consultation_requests_owner_update" on public.consultation_requests;
create policy "consultation_requests_owner_update"
  on public.consultation_requests
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and coalesce(p.is_owner, false) = true
    )
  );

-- No DELETE policy — service role only.
