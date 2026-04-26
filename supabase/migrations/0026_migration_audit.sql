-- Self-serve migration audit trail.
--
-- Three tables work together to drive the Trainerize → pkfit-app migration:
--
--   migration_state  — per-client funnel row. Holds current state, the magic
--                      token for the /migrate/:token landing page, the
--                      Account-A subscription details (so the confirm page
--                      can render the side-by-side comparison without a live
--                      Stripe round-trip), and the cloned Stripe-B IDs once
--                      the handshake completes.
--   consent_log      — append-only legal record of GDPR/UK-GDPR consent
--                      events. Never updated, never deleted (PII can be
--                      nulled per data-deletion procedure but the row stays
--                      as legal-basis evidence).
--   migration_events — every funnel transition emitted as a discrete event.
--                      Drives the conversion dashboard and the recovery
--                      worker's "what was the last touch" queries.
--
-- All three are coach-only at the row level — clients never read these
-- directly. The /migrate landing page resolves a token via the service-role
-- Netlify function instead of an authenticated client query, so RLS only
-- has to gate coach reads from the admin route.

create table if not exists public.migration_state (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid references public.profiles(id) on delete set null,
  trainerize_client_id     text not null,
  email                    text not null,
  state                    text not null check (state in (
    'pre_seated','email_sent','clicked','signed_in','consented',
    'transferred','failed','dormant'
  )),
  migration_token          uuid not null unique default gen_random_uuid(),
  token_expires_at         timestamptz not null default (now() + interval '14 days'),
  account_a_sub_id         text not null,
  account_a_renewal_date   date not null,
  account_a_status         text,
  stripe_b_price_id        text not null,
  incentive_variant        text not null default 'ai_coach',
  email_sent_at            timestamptz,
  email_resent_at          timestamptz,
  reminder_3d_sent_at      timestamptz,
  reminder_7d_sent_at      timestamptz,
  onboarding_nudge_sent_at timestamptz,
  consent_clicked_at       timestamptz,
  consent_ip               inet,
  consent_user_agent       text,
  stripe_b_customer_id     text,
  stripe_b_subscription_id text,
  stripe_b_payment_method  text,
  failure_reason           text,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
create index if not exists migration_state_state_idx on public.migration_state (state);
create index if not exists migration_state_email_idx on public.migration_state (email);
create index if not exists migration_state_token_idx on public.migration_state (migration_token);

-- Bump updated_at on every row touch so the recovery worker's
-- "stalled longer than 24h" detection has a clean signal.
create or replace function public.touch_migration_state_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_migration_state_touch on public.migration_state;
create trigger trg_migration_state_touch
  before update on public.migration_state
  for each row execute function public.touch_migration_state_updated_at();

create table if not exists public.consent_log (
  id              uuid primary key default gen_random_uuid(),
  event_type      text not null,
  client_id       uuid references public.profiles(id) on delete set null,
  email           text not null,
  occurred_at     timestamptz not null default now(),
  ip              inet,
  user_agent      text,
  consent_text    text not null,
  metadata        jsonb not null default '{}'::jsonb
);
create index if not exists consent_log_email_idx on public.consent_log (email);
create index if not exists consent_log_event_type_idx on public.consent_log (event_type, occurred_at desc);

create table if not exists public.migration_events (
  id                  bigserial primary key,
  migration_state_id  uuid references public.migration_state(id) on delete cascade,
  event_type          text not null,
  occurred_at         timestamptz not null default now(),
  metadata            jsonb not null default '{}'::jsonb
);
create index if not exists migration_events_state_id_idx
  on public.migration_events (migration_state_id, occurred_at desc);
create index if not exists migration_events_type_idx
  on public.migration_events (event_type, occurred_at desc);

-- ─── ROW-LEVEL SECURITY ──────────────────────────────────────────────────
-- All three tables are server-only from the client perspective. The Netlify
-- functions use the service-role key (which bypasses RLS). Coach-role reads
-- are allowed for the future /admin/migrations route.

alter table public.migration_state  enable row level security;
alter table public.consent_log      enable row level security;
alter table public.migration_events enable row level security;

drop policy if exists "migration_state coach read" on public.migration_state;
create policy "migration_state coach read" on public.migration_state
  for select using (public.is_coach());

drop policy if exists "consent_log coach read" on public.consent_log;
create policy "consent_log coach read" on public.consent_log
  for select using (public.is_coach());

drop policy if exists "migration_events coach read" on public.migration_events;
create policy "migration_events coach read" on public.migration_events
  for select using (public.is_coach());

-- consent_log is append-only by contract. Block updates and deletes via
-- policies so even a privileged accidental query cannot mutate history.
-- (The service-role key bypasses RLS, so a deliberate operation by Percy
-- against the dashboard still works — but no policy exposes update/delete
-- to authenticated callers.)
revoke update, delete on public.consent_log from anon, authenticated;
