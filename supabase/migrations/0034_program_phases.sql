-- 0034_program_phases.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Replace the legacy `programs.week_number int` model with named, dated
-- phases. A program is a 16-week (or arbitrary) cycle composed of multiple
-- phases — accumulation, intensification, peak, deload, etc. Each phase
-- carries its own dates and an optional ordered position within the program.
--
-- Depends on: programs (existing, 0001).
-- Followed by:  0035_client_metrics.sql.
--
-- The legacy `programs.week_number` column stays in place — coach builder
-- writes phases here and ignores week_number. A future migration can drop
-- week_number once the read path is fully cut over (out of scope for v1).
--
-- DO NOT APPLY in this block. File-write only.

create table if not exists public.program_phases (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  name         text not null,
  start_date   date not null,
  end_date     date not null,
  order_index  int  not null default 0,
  notes        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- A phase must end on or after it starts. Coach builder enforces this in
  -- UI; the constraint is the floor.
  check (end_date >= start_date)
);

comment on table public.program_phases is
  'Named, dated phases of a program. Replaces programs.week_number with phase-level structure.';
comment on column public.program_phases.order_index is
  'Display order within a program. Phases with the same order_index sort by start_date asc.';

create index if not exists program_phases_program_idx
  on public.program_phases (program_id);
create index if not exists program_phases_program_order_idx
  on public.program_phases (program_id, order_index, start_date);

-- Touch updated_at on every UPDATE.
create or replace function public.program_phases_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists program_phases_touch_updated_at on public.program_phases;
create trigger program_phases_touch_updated_at
  before update on public.program_phases
  for each row execute function public.program_phases_touch_updated_at();

-- RLS
alter table public.program_phases enable row level security;

-- Coach: full CRUD on every phase.
drop policy if exists "program_phases coach rw" on public.program_phases;
create policy "program_phases coach rw" on public.program_phases
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- Client: read-only on phases that belong to their own program. RLS
-- inherits visibility from the parent `programs.client_id` row.
drop policy if exists "program_phases client read own" on public.program_phases;
create policy "program_phases client read own" on public.program_phases
  for select
  using (
    auth.role() = 'authenticated'
    and exists (
      select 1 from public.programs p
      where p.id = program_phases.program_id
        and p.client_id = auth.uid()
    )
  );

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "program_phases client read own" on public.program_phases;
-- drop policy if exists "program_phases coach rw" on public.program_phases;
-- alter table public.program_phases disable row level security;
-- drop trigger if exists program_phases_touch_updated_at on public.program_phases;
-- drop function if exists public.program_phases_touch_updated_at();
-- drop index if exists program_phases_program_order_idx;
-- drop index if exists program_phases_program_idx;
-- drop table if exists public.program_phases;
