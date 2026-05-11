-- 0035_client_metrics.sql
-- PK•FIT v1 — Block 1 schema additions.
-- The 10-metric progress grid. One row per metric reading. Source kept
-- generic so the same table accepts manual entries, Trainerize imports,
-- and future wearable feeds without a schema change.
--
-- Depends on: profiles (0001).
-- Followed by:  0036_client_photos.sql.
--
-- Metric set per engineering scope §2.2:
--   body_weight, body_fat, lean_mass,
--   steps, sleep_hours, caloric_intake, caloric_burn,
--   resting_hr, systolic_bp, diastolic_bp.
--
-- Unit is per-row free text (e.g. 'kg', 'lb', 'count', 'hours', 'kcal',
-- 'bpm', 'mmHg') — rendering layer normalises. Keeps the schema dumb.
--
-- DO NOT APPLY in this block. File-write only.

do $$ begin
  create type public.metric_type as enum (
    'body_weight',
    'body_fat',
    'lean_mass',
    'steps',
    'sleep_hours',
    'caloric_intake',
    'caloric_burn',
    'resting_hr',
    'systolic_bp',
    'diastolic_bp'
  );
exception when duplicate_object then null; end $$;

create table if not exists public.client_metrics (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.profiles(id) on delete cascade,
  metric       public.metric_type not null,
  value        numeric not null,
  unit         text not null,
  recorded_at  timestamptz not null default now(),
  -- 'manual' | 'trainerize_import' | 'apple_health' | 'whoop' | …
  source       text not null default 'manual',
  notes        text,
  created_at   timestamptz not null default now()
);

comment on table public.client_metrics is
  'One row per metric reading. Powers the progress grid + trend charts.';
comment on column public.client_metrics.unit is
  'Free-text unit (kg, lb, hours, bpm, mmHg, kcal, count). Rendering layer normalises.';
comment on column public.client_metrics.source is
  'Origin of the reading. manual | trainerize_import | apple_health | whoop | …';

-- The hot read path: latest readings for a client + metric, newest first.
create index if not exists client_metrics_client_metric_recorded_idx
  on public.client_metrics (client_id, metric, recorded_at desc);

-- Coach roster surfaces sometimes order by latest reading across metrics.
create index if not exists client_metrics_client_recorded_idx
  on public.client_metrics (client_id, recorded_at desc);

-- RLS
alter table public.client_metrics enable row level security;

-- Client: full CRUD on their own metrics.
drop policy if exists "client_metrics client rw own" on public.client_metrics;
create policy "client_metrics client rw own" on public.client_metrics
  for all
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  )
  with check (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- Coach: full CRUD on every client's metrics.
drop policy if exists "client_metrics coach rw" on public.client_metrics;
create policy "client_metrics coach rw" on public.client_metrics
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "client_metrics coach rw" on public.client_metrics;
-- drop policy if exists "client_metrics client rw own" on public.client_metrics;
-- alter table public.client_metrics disable row level security;
-- drop index if exists client_metrics_client_recorded_idx;
-- drop index if exists client_metrics_client_metric_recorded_idx;
-- drop table if exists public.client_metrics;
-- drop type if exists public.metric_type;
