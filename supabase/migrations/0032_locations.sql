-- 0032_locations.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Coach training locations / studios. A `location` groups clients under a
-- physical or logical operating site (e.g. "PKFIT — Studio A", "Online").
-- Each location has a single owner (a coach). Used by
-- `coach_client_assignments.location_id` (0033) and `profiles.location_id`
-- (0041) for roster grouping and reporting.
--
-- Depends on: profiles (existing, 0001).
-- Followed by:  0033_coach_client_assignments.sql.
--
-- DO NOT APPLY in this block. File-write only. Apply order is governed by
-- the Block 1 sequence after Block 0 (0031_announcements.sql) lands.

create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  owner_id    uuid not null references public.profiles(id) on delete restrict,
  -- Optional descriptive fields. Kept thin in v1 — extend on demand.
  timezone    text default 'UTC',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.locations is
  'Coach-owned training locations. Groups clients for roster + reporting. Owner is a coach profile.';
comment on column public.locations.owner_id is
  'The coach who owns this location. on delete restrict — block deletion of a coach with locations until reassigned.';

create index if not exists locations_owner_idx
  on public.locations (owner_id);

-- Touch updated_at on every UPDATE.
create or replace function public.locations_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists locations_touch_updated_at on public.locations;
create trigger locations_touch_updated_at
  before update on public.locations
  for each row execute function public.locations_touch_updated_at();

-- RLS
alter table public.locations enable row level security;

-- Coach: full CRUD across all locations (multi-coach reality of v1 — see
-- engineering scope §2.3). If cohort introduces coach-segregated rosters,
-- tighten this to `owner_id = auth.uid()` or join `coach_client_assignments`.
drop policy if exists "locations coach rw" on public.locations;
create policy "locations coach rw" on public.locations
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- Client read on locations is added in 0041 after `profiles.location_id`
-- exists. Avoids a forward-reference if these migrations are applied out
-- of order.

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "locations coach rw" on public.locations;
-- alter table public.locations disable row level security;
-- drop trigger if exists locations_touch_updated_at on public.locations;
-- drop function if exists public.locations_touch_updated_at();
-- drop index if exists locations_owner_idx;
-- drop table if exists public.locations;
