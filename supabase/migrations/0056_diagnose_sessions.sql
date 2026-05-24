-- ════════════════════════════════════════════════════════════════════════════
-- 0056_diagnose_sessions.sql
-- ════════════════════════════════════════════════════════════════════════════
-- PURPOSE
-- ────────
-- Backs the public Claude-powered intake at operatefitness.app/standard
-- (and /structure, /system, /protocol, /align). Replaces the paid ManyChat
-- AI add-on with a self-hosted chat surface owned by PKFIT.
--
-- The page is anonymous — anyone visiting can start a session. Two tables:
--
--   diagnose_sessions    — one row per visitor session, holds the full
--                          transcript + AI-inferred intent. Anon INSERT
--                          allowed (a session is created on page load).
--                          Server function appends to messages via service
--                          role; only the owner (Percy) can read or update.
--
--   public_rate_limits   — text-keyed fixed-window limiter for anonymous
--                          callers. The existing rate_limits table is uuid-
--                          keyed against profiles, so it cannot throttle by
--                          IP. This table mirrors the same schema with a
--                          text key. Service-role only; no client policies.
--
-- DEPENDS ON
-- ──────────
-- - 0001_init.sql   (profiles, is_owner via 0054)
-- - 0054_rls_three_tier_scope.sql (adds profiles.is_owner — NOT strictly
--                                   required: this migration falls back to
--                                   profiles.role = 'coach' if is_owner is
--                                   absent so it works pre- or post-0054.)
-- ════════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ─── diagnose_sessions ──────────────────────────────────────────────────

create table if not exists public.diagnose_sessions (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  keyword         text not null default 'standard'
                  check (keyword in ('standard','structure','system','protocol','align')),
  referrer        text,
  subscriber_id   text,
  ip_hash         text,
  user_agent      text,
  messages        jsonb not null default '[]'::jsonb,
  intent_level    integer check (intent_level between 1 and 5),
  qualifier_clicked boolean not null default false
);

create index if not exists diagnose_sessions_created_at_idx
  on public.diagnose_sessions (created_at desc);

create index if not exists diagnose_sessions_keyword_idx
  on public.diagnose_sessions (keyword);

create index if not exists diagnose_sessions_intent_idx
  on public.diagnose_sessions (intent_level)
  where intent_level is not null;

alter table public.diagnose_sessions enable row level security;

-- Anonymous visitors can create a fresh session row. The server function
-- inserts via service role normally, but allowing anon insert lets the
-- client side generate a session id and post optimistically if we ever
-- want to skip a round trip. Inserted rows must be empty / fresh.
drop policy if exists "diagnose_sessions_anon_insert" on public.diagnose_sessions;
create policy "diagnose_sessions_anon_insert"
  on public.diagnose_sessions
  for insert
  to anon, authenticated
  with check (
    messages = '[]'::jsonb
    and intent_level is null
    and qualifier_clicked = false
  );

-- Only the owner can read. (No coach/client access — these are leads, not
-- members.) Service role always bypasses RLS for the server-side reads
-- the diagnose function performs.
drop policy if exists "diagnose_sessions_owner_select" on public.diagnose_sessions;
create policy "diagnose_sessions_owner_select"
  on public.diagnose_sessions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          coalesce(p.is_owner, false) = true
          or p.role = 'coach'  -- pre-0054 fallback so this migration is order-independent
        )
    )
  );

drop policy if exists "diagnose_sessions_owner_update" on public.diagnose_sessions;
create policy "diagnose_sessions_owner_update"
  on public.diagnose_sessions
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and (
          coalesce(p.is_owner, false) = true
          or p.role = 'coach'
        )
    )
  );

-- No DELETE policy — service role only.

-- ─── public_rate_limits ─────────────────────────────────────────────────
-- Text-keyed fixed-window limiter. Used by the diagnose function to throttle
-- anonymous traffic by IP. No client policies; service-role writes only.

create table if not exists public.public_rate_limits (
  key           text not null,
  bucket        text not null,
  window_start  timestamptz not null default now(),
  count         integer not null default 0,
  primary key (key, bucket)
);

alter table public.public_rate_limits enable row level security;
-- No policies: service role only.

create index if not exists public_rate_limits_window_idx
  on public.public_rate_limits (window_start);
