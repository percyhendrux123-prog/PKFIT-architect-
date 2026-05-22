-- 0053_client_activation.sql
-- Activation loop, P0: when a new client profile lands, two things should
-- be automatic so the coach view is alive and the client has something to
-- open the first time they sign in.
--
--   1. Bind the client to a coach via coach_client_assignments (default
--      coach = the first profile with role='coach', stable across re-runs).
--   2. Clone every program_template marked is_default=true into a new
--      `programs` row owned by the client, status='active'.
--
-- Both happen in a single AFTER INSERT trigger on profiles. The trigger is
-- security definer so it bypasses RLS — the new client's session has no
-- insert grant on coach_client_assignments and would not otherwise be
-- allowed to materialise its own assignment row.
--
-- The migration also seeds the first three default templates (Darryl Pilot
-- Week 1: Push / Pull / Legs), and backfills assignments + programs for any
-- existing client profile that's missing them (the four dormant pilots that
-- exist today).
--
-- Idempotent end-to-end: re-running this file is a no-op.
--
-- Depends on: profiles (0001), programs (0001), coach_client_assignments
--             (0033), exercises (0002 — for the seed names).
--
-- DO NOT auto-apply. Run from the Supabase SQL editor or `supabase db push`.

-- ─── PROGRAM TEMPLATES ───────────────────────────────────────────────────
-- Template catalogue. Mirrors the programs row shape (schedule + exercises
-- jsonb) but with no client_id. is_default rows are cloned to every new
-- client; non-default rows are kept here for the coach to assign manually
-- via a future UI.
create table if not exists public.program_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  schedule    jsonb not null default '{}'::jsonb,
  exercises   jsonb not null default '[]'::jsonb,
  is_default  boolean not null default false,
  order_index int  not null default 0,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists program_templates_default_idx
  on public.program_templates (is_default, order_index)
  where is_default = true;

create or replace function public.program_templates_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists program_templates_touch_updated_at on public.program_templates;
create trigger program_templates_touch_updated_at
  before update on public.program_templates
  for each row execute function public.program_templates_touch_updated_at();

alter table public.program_templates enable row level security;

-- Any authenticated user can read templates — they're catalogue data.
drop policy if exists "program_templates read authenticated" on public.program_templates;
create policy "program_templates read authenticated" on public.program_templates
  for select using (auth.role() = 'authenticated');

-- Coaches can edit the catalogue. Clients cannot.
drop policy if exists "program_templates coach write" on public.program_templates;
create policy "program_templates coach write" on public.program_templates
  for all using (public.is_coach()) with check (public.is_coach());

-- ─── DEFAULT COACH RESOLUTION ────────────────────────────────────────────
-- The "default coach" is the oldest profile with role='coach'. v1 is single-
-- coach (Percy); when multi-coach lands, swap this to read from a settings
-- table without touching the trigger.
create or replace function public.default_coach_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.profiles
   where role = 'coach'
   order by created_at asc
   limit 1;
$$;

-- ─── ACTIVATION TRIGGER ──────────────────────────────────────────────────
-- Fires AFTER INSERT on profiles. Only acts on client rows. Idempotent —
-- coach_client_assignments has a (coach_id, client_id) unique; we ON CONFLICT
-- DO NOTHING. Starter program cloning checks for any existing program row
-- on this client before inserting so re-running the trigger logic against
-- a backfilled client is a no-op.
create or replace function public.activate_new_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coach uuid;
begin
  if new.role <> 'client' then
    return new;
  end if;

  coach := public.default_coach_id();

  -- 1. Coach assignment. Skip silently if no coach exists yet (single-tenant
  --    cold-start: the first row inserted into profiles is the coach himself).
  if coach is not null and coach <> new.id then
    insert into public.coach_client_assignments (coach_id, client_id, is_primary, access_tier)
    values (coach, new.id, true, 'full')
    on conflict (coach_id, client_id) do nothing;
  end if;

  -- 2. Starter programs. Only clone if the client has zero programs yet —
  --    avoids duplicates when the trigger is re-run (e.g. through backfill).
  if not exists (select 1 from public.programs where client_id = new.id) then
    insert into public.programs (client_id, week_number, schedule, exercises, status)
    select new.id, 1, schedule, exercises, 'active'
      from public.program_templates
     where is_default = true
     order by order_index asc, created_at asc;
  end if;

  return new;
end;
$$;

drop trigger if exists activate_new_client_after_insert on public.profiles;
create trigger activate_new_client_after_insert
  after insert on public.profiles
  for each row execute function public.activate_new_client();

-- ─── SEED: DARRYL PILOT WEEK 1 (Push / Pull / Legs) ──────────────────────
-- Three templates, all is_default=true, ordered Push → Pull → Legs. Every
-- new client gets all three cloned active. Exercise names are pulled from
-- the seeded exercise library (0002) so the workout viewer can resolve cues
-- and YouTube IDs from public.exercises by name match.
--
-- Re-runs: ON CONFLICT (name) DO NOTHING via a unique partial index below
-- so a second apply does not double-seed. We add the index here rather than
-- in the column DDL because lower(name) gives us case-insensitive uniqueness
-- without forcing case on writes.
create unique index if not exists program_templates_name_lower_idx
  on public.program_templates (lower(name));

insert into public.program_templates (name, is_default, order_index, schedule, exercises, notes)
values
  (
    'Pilot W1 — Push',
    true, 1,
    jsonb_build_object('title', 'Pilot W1 — Push', 'day', 'monday'),
    jsonb_build_array(
      jsonb_build_object('name', 'Bench Press',                      'sets', 4, 'reps', '6-8',  'load', 'RPE 7-8'),
      jsonb_build_object('name', 'Overhead Press',                   'sets', 3, 'reps', '8',    'load', 'RPE 7'),
      jsonb_build_object('name', 'Incline Bench Press',              'sets', 3, 'reps', '10',   'load', 'RPE 7'),
      jsonb_build_object('name', 'Seated Dumbbell Shoulder Press',   'sets', 3, 'reps', '10',   'load', 'RPE 8'),
      jsonb_build_object('name', 'Rope Tricep Pushdown',             'sets', 3, 'reps', '12',   'load', 'RPE 8'),
      jsonb_build_object('name', 'Lateral Raise',                    'sets', 3, 'reps', '15',   'load', 'controlled, no swing')
    ),
    'Pilot week 1, day 1. Calibrate loads on the first set, then push the back-off sets.'
  ),
  (
    'Pilot W1 — Pull',
    true, 2,
    jsonb_build_object('title', 'Pilot W1 — Pull', 'day', 'wednesday'),
    jsonb_build_array(
      jsonb_build_object('name', 'Conventional Deadlift',  'sets', 3, 'reps', '5',    'load', 'RPE 7'),
      jsonb_build_object('name', 'Pull-Up',                'sets', 4, 'reps', '6-10', 'load', 'add load if 10 is clean'),
      jsonb_build_object('name', 'Barbell Row',            'sets', 4, 'reps', '8',    'load', 'RPE 7-8'),
      jsonb_build_object('name', 'Chest-Supported Row',    'sets', 3, 'reps', '10',   'load', 'RPE 8, 1-sec squeeze'),
      jsonb_build_object('name', 'Face Pull',              'sets', 3, 'reps', '15',   'load', 'pause at peak'),
      jsonb_build_object('name', 'EZ-Bar Curl',            'sets', 3, 'reps', '10',   'load', 'RPE 8')
    ),
    'Pilot week 1, day 2. Deadlift first; everything else feeds the back.'
  ),
  (
    'Pilot W1 — Legs',
    true, 3,
    jsonb_build_object('title', 'Pilot W1 — Legs', 'day', 'friday'),
    jsonb_build_array(
      jsonb_build_object('name', 'Back Squat',              'sets', 4, 'reps', '6',     'load', 'RPE 7'),
      jsonb_build_object('name', 'Romanian Deadlift',       'sets', 3, 'reps', '8',     'load', 'RPE 7'),
      jsonb_build_object('name', 'Bulgarian Split Squat',   'sets', 3, 'reps', '10/leg','load', 'dumbbells'),
      jsonb_build_object('name', 'Leg Press',               'sets', 3, 'reps', '12',    'load', 'RPE 8'),
      jsonb_build_object('name', 'Lying Hamstring Curl',    'sets', 3, 'reps', '12',    'load', 'RPE 8, pause at peak'),
      jsonb_build_object('name', 'Standing Calf Raise',     'sets', 4, 'reps', '12',    'load', 'full stretch')
    ),
    'Pilot week 1, day 3. Squat clean, RDL slow, finish through calves.'
  )
on conflict do nothing;

-- ─── BACKFILL ────────────────────────────────────────────────────────────
-- Run the activation logic for every existing client profile so the four
-- dormant pilots show up under Percy's roster and have programs to open
-- the first time they sign in.
--
-- Touch-noop UPDATE re-triggers the AFTER INSERT logic? No — INSERT triggers
-- don't fire on UPDATE. We call the body directly via a do-block instead.
do $$
declare
  c record;
  coach uuid;
begin
  coach := public.default_coach_id();
  if coach is null then
    raise notice 'no coach profile found; skipping backfill';
    return;
  end if;

  for c in select id from public.profiles where role = 'client' loop
    if c.id <> coach then
      insert into public.coach_client_assignments (coach_id, client_id, is_primary, access_tier)
      values (coach, c.id, true, 'full')
      on conflict (coach_id, client_id) do nothing;
    end if;

    if not exists (select 1 from public.programs where client_id = c.id) then
      insert into public.programs (client_id, week_number, schedule, exercises, status)
      select c.id, 1, schedule, exercises, 'active'
        from public.program_templates
       where is_default = true
       order by order_index asc, created_at asc;
    end if;
  end loop;
end $$;

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration. Programs and assignments materialised
-- by the trigger are intentionally NOT removed — those are client data.
--
-- drop trigger  if exists activate_new_client_after_insert on public.profiles;
-- drop function if exists public.activate_new_client();
-- drop function if exists public.default_coach_id();
-- drop policy   if exists "program_templates coach write" on public.program_templates;
-- drop policy   if exists "program_templates read authenticated" on public.program_templates;
-- alter table   public.program_templates disable row level security;
-- drop trigger  if exists program_templates_touch_updated_at on public.program_templates;
-- drop function if exists public.program_templates_touch_updated_at();
-- drop index    if exists program_templates_name_lower_idx;
-- drop index    if exists program_templates_default_idx;
-- drop table    if exists public.program_templates;
