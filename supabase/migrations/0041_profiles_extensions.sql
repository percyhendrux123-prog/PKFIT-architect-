-- 0041_profiles_extensions.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Extend `profiles` with the v1 columns called out in engineering scope
-- §2.1 + §2.2 + the operator brief:
--   status            → active | inactive | archived (roster filter).
--   archived_at       → set when status flips to 'archived'; null otherwise.
--   phone             → free-text phone string (E.164 advisory, not enforced).
--   timezone          → IANA tz, default 'UTC'. Used by reminders + cadence.
--   client_tier       → full | dm_only (mirrors coach_client_assignments.access_tier
--                       at the profile level so a client knows their own tier).
--   location_id       → FK locations.id. Soft-grouping for roster.
--   last_sign_in_at   → mirrored from auth.users on session create
--                       (server-side worker; clients cannot write).
--   channel_preference→ app | email | sms | push. Notification routing.
--
-- Role enum: NOT upgraded in this migration. Engineering scope §2.1 is
-- explicit that v1 needs only `client` and `coach` (existing `user_role`
-- enum). Owner is email-list gated. If a future block needs `admin`,
-- add a separate, narrowly-scoped migration that does
--   alter type user_role add value 'admin'
-- inside a do-block (alter type add value cannot run inside a transaction
-- in some PG setups — see PG docs).
--
-- Depends on: profiles (0001), locations (0032).
-- Followed by:  0042_drop_legacy_tables.sql.
--
-- DO NOT APPLY in this block. File-write only.

-- ─── columns ─────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists status text
    default 'active'
    check (status in ('active', 'inactive', 'archived')),
  add column if not exists archived_at      timestamptz,
  add column if not exists phone            text,
  add column if not exists timezone         text default 'UTC',
  add column if not exists client_tier      text
    default 'full'
    check (client_tier in ('full', 'dm_only')),
  add column if not exists location_id      uuid
    references public.locations(id) on delete set null,
  add column if not exists last_sign_in_at  timestamptz,
  add column if not exists channel_preference text
    default 'app'
    check (channel_preference in ('app', 'email', 'sms', 'push'));

comment on column public.profiles.status is
  'active | inactive | archived. Coach roster filter.';
comment on column public.profiles.archived_at is
  'Set when status flips to archived. Null otherwise. Application-managed.';
comment on column public.profiles.timezone is
  'IANA tz string. Default UTC. Used for reminders + form cadence.';
comment on column public.profiles.client_tier is
  'full | dm_only. Mirrors coach_client_assignments.access_tier so the client app can self-render its tier.';
comment on column public.profiles.location_id is
  'Soft-grouping for roster. on delete set null preserves the profile when a location is removed.';
comment on column public.profiles.last_sign_in_at is
  'Server-mirrored from auth.users on session create. Clients cannot write — privileged column (see migration 0020 pattern).';
comment on column public.profiles.channel_preference is
  'Default notification channel. app | email | sms | push.';

-- Helpful indexes for roster + reporting.
create index if not exists profiles_status_idx
  on public.profiles (status);
create index if not exists profiles_location_idx
  on public.profiles (location_id);
create index if not exists profiles_role_status_idx
  on public.profiles (role, status);

-- ─── client read on locations (deferred from 0032) ───────────────────────
-- Now that profiles.location_id exists, a client can read the location
-- they're assigned to without needing a coach round-trip.
drop policy if exists "locations client read own" on public.locations;
create policy "locations client read own" on public.locations
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.location_id = locations.id
    )
  );

-- ─── privileged column lock (mirrors 0020 pattern) ───────────────────────
-- Migration 0020 locks plan/loop_stage/start_date/role from client writes.
-- Apply the same restraint to last_sign_in_at + status (admin-only). The
-- existing 0020 mechanism likely uses a row-level / column-level pattern;
-- here we add a guard trigger as a belt-and-braces measure. If 0020 is
-- already comprehensive, this is a defense-in-depth no-op.
create or replace function public.profiles_block_privileged_writes()
returns trigger language plpgsql as $$
begin
  -- Service role + coach can write anything.
  if (auth.role() = 'service_role') or public.is_coach() then
    return new;
  end if;
  -- Otherwise: clients cannot change last_sign_in_at, status, archived_at.
  if (new.last_sign_in_at is distinct from old.last_sign_in_at) then
    raise exception 'profiles.last_sign_in_at is server-managed';
  end if;
  if (new.status is distinct from old.status) then
    raise exception 'profiles.status is coach-managed';
  end if;
  if (new.archived_at is distinct from old.archived_at) then
    raise exception 'profiles.archived_at is coach-managed';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_block_privileged_writes on public.profiles;
create trigger profiles_block_privileged_writes
  before update on public.profiles
  for each row execute function public.profiles_block_privileged_writes();

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration. NOTE: dropping columns drops
-- their data — confirm before running in any non-dev environment.
--
-- drop trigger if exists profiles_block_privileged_writes on public.profiles;
-- drop function if exists public.profiles_block_privileged_writes();
-- drop policy if exists "locations client read own" on public.locations;
-- drop index if exists profiles_role_status_idx;
-- drop index if exists profiles_location_idx;
-- drop index if exists profiles_status_idx;
-- alter table public.profiles
--   drop column if exists channel_preference,
--   drop column if exists last_sign_in_at,
--   drop column if exists location_id,
--   drop column if exists client_tier,
--   drop column if exists timezone,
--   drop column if exists phone,
--   drop column if exists archived_at,
--   drop column if exists status;
