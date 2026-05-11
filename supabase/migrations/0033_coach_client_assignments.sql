-- 0033_coach_client_assignments.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Multi-coach support per client. Each row maps one coach to one client
-- with an optional location and an access tier. v1 ships with a single
-- primary coach per client, but the schema supports multi-coach so DM-only
-- assistants can be added without a schema change.
--
-- This is the join table consulted by RLS policies that need to ask
-- "does this coach have access to this client?" for tightened, segregated
-- rosters in a future block. v1 is multi-coach-everyone-sees-everything;
-- the assignment row is the data of record for billing + reporting.
--
-- Depends on: profiles (0001), locations (0032).
-- Followed by:  0034_program_phases.sql.
--
-- DO NOT APPLY in this block. File-write only.

create table if not exists public.coach_client_assignments (
  id            uuid primary key default gen_random_uuid(),
  coach_id      uuid not null references public.profiles(id) on delete cascade,
  client_id     uuid not null references public.profiles(id) on delete cascade,
  location_id   uuid references public.locations(id) on delete set null,
  is_primary    boolean not null default true,
  -- 'full'    → full coaching access (programs, check-ins, messages, notes).
  -- 'dm_only' → messaging-only (e.g. concierge / overflow coverage).
  access_tier   text not null default 'full'
                check (access_tier in ('full', 'dm_only')),
  started_on    date not null default current_date,
  ended_on      date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (coach_id, client_id)
);

comment on table public.coach_client_assignments is
  'Maps coaches to clients. v1 supports a single primary coach per client; schema permits multi-coach for DM-only assistants.';
comment on column public.coach_client_assignments.access_tier is
  'full | dm_only. dm_only restricts a coach to messaging only — used for concierge/overflow coverage.';
comment on column public.coach_client_assignments.ended_on is
  'Set to a date to soft-end an assignment without deleting the row (for audit). Null while active.';

create index if not exists coach_client_assignments_coach_idx
  on public.coach_client_assignments (coach_id);
create index if not exists coach_client_assignments_client_idx
  on public.coach_client_assignments (client_id);
create index if not exists coach_client_assignments_location_idx
  on public.coach_client_assignments (location_id);
-- Partial index of active assignments — the hot path for "who is X coaching".
create index if not exists coach_client_assignments_active_idx
  on public.coach_client_assignments (coach_id, client_id)
  where ended_on is null;

-- Touch updated_at on every UPDATE.
create or replace function public.coach_client_assignments_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists coach_client_assignments_touch_updated_at on public.coach_client_assignments;
create trigger coach_client_assignments_touch_updated_at
  before update on public.coach_client_assignments
  for each row execute function public.coach_client_assignments_touch_updated_at();

-- RLS
alter table public.coach_client_assignments enable row level security;

-- Coach: full CRUD on assignment rows. v1 multi-coach-everyone-sees-all.
drop policy if exists "assignments coach rw" on public.coach_client_assignments;
create policy "assignments coach rw" on public.coach_client_assignments
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- Client: read-only on their own assignment (so the client app can show
-- "Your coach: <name>"). No write.
drop policy if exists "assignments client read own" on public.coach_client_assignments;
create policy "assignments client read own" on public.coach_client_assignments
  for select
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "assignments client read own" on public.coach_client_assignments;
-- drop policy if exists "assignments coach rw" on public.coach_client_assignments;
-- alter table public.coach_client_assignments disable row level security;
-- drop trigger if exists coach_client_assignments_touch_updated_at on public.coach_client_assignments;
-- drop function if exists public.coach_client_assignments_touch_updated_at();
-- drop index if exists coach_client_assignments_active_idx;
-- drop index if exists coach_client_assignments_location_idx;
-- drop index if exists coach_client_assignments_client_idx;
-- drop index if exists coach_client_assignments_coach_idx;
-- drop table if exists public.coach_client_assignments;
