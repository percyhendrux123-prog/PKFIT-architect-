-- 0044_nutrition.sql
-- PK•FIT v1 — Block Δ schema additions.
-- Nutrition support: client targets + meal log.
--
--   client_nutrition_targets → coach-set macro/calorie targets per client,
--                              with effective_from/effective_to windows so
--                              targets can be revised without losing history.
--                              Currently active row: effective_to is null.
--
--   meal_log                 → client-logged meals. Client owns rw; coach
--                              has read-only access for review. source
--                              tracks origin (in-app, trainerize import,
--                              manual coach entry).
--
-- v1 single-coach assumption (PKFIT v1 has one coach: Percy). Coach access
-- is gated via public.is_coach() — matches the convention used in 0037,
-- 0038, etc. If multi-coach support is introduced later, swap for an
-- assigned-coach helper in a follow-up migration.
--
-- Depends on: profiles (0001), is_coach() (existing helper).
-- Followed by:  0045_lock_role.sql.
--
-- DO NOT APPLY via files-only flow — this migration IS applied via
-- supabase apply_migration in Block Δ.

-- ═══ client_nutrition_targets ════════════════════════════════════════════
create table if not exists public.client_nutrition_targets (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  daily_calories  integer not null
                  check (daily_calories > 0 and daily_calories < 10000),
  protein_g       integer not null
                  check (protein_g >= 0 and protein_g <= 1000),
  carbs_g         integer not null
                  check (carbs_g >= 0 and carbs_g <= 2000),
  fat_g           integer not null
                  check (fat_g >= 0 and fat_g <= 1000),
  effective_from  date not null default current_date,
  effective_to    date,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles(id) on delete set null
);

comment on table public.client_nutrition_targets is
  'Coach-set macro/calorie targets per client. Effective windows preserve history. Active row has effective_to null.';
comment on column public.client_nutrition_targets.effective_to is
  'Null = currently active. Set on supersede.';
comment on column public.client_nutrition_targets.created_by is
  'Coach who set the target. on delete set null preserves history if the coach profile is removed.';

-- Active row lookup index — nulls first puts the active row at the top.
create index if not exists client_nutrition_targets_client_active_idx
  on public.client_nutrition_targets (client_id, effective_to nulls first);

-- Touch updated_at on every UPDATE.
create or replace function public.client_nutrition_targets_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_nutrition_targets_touch_updated_at
  on public.client_nutrition_targets;
create trigger client_nutrition_targets_touch_updated_at
  before update on public.client_nutrition_targets
  for each row execute function public.client_nutrition_targets_touch_updated_at();

-- RLS
alter table public.client_nutrition_targets enable row level security;

-- Coach: full CRUD across all clients.
drop policy if exists "client_nutrition_targets coach rw" on public.client_nutrition_targets;
create policy "client_nutrition_targets coach rw" on public.client_nutrition_targets
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- Client: read own targets only. No write — targets are coach-managed.
drop policy if exists "client_nutrition_targets client read own" on public.client_nutrition_targets;
create policy "client_nutrition_targets client read own" on public.client_nutrition_targets
  for select
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- ═══ meal_log ════════════════════════════════════════════════════════════
create table if not exists public.meal_log (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  logged_at   timestamptz not null default now(),
  meal_name   text,
  calories    integer
              check (calories >= 0 and calories <= 10000),
  protein_g   numeric(6,2)
              check (protein_g >= 0 and protein_g <= 1000),
  carbs_g     numeric(6,2)
              check (carbs_g >= 0 and carbs_g <= 2000),
  fat_g       numeric(6,2)
              check (fat_g >= 0 and fat_g <= 1000),
  photo_url   text,
  notes       text,
  source      text not null default 'app'
              check (source in ('app', 'trainerize_import', 'manual')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.meal_log is
  'Client-logged meals. Client rw on own. Coach read-only — coach cannot author or modify a client meal entry.';
comment on column public.meal_log.source is
  'app | trainerize_import | manual. Origin of the entry — drives reconciliation logic.';

-- Time-ordered lookup (most recent first) by client.
create index if not exists meal_log_client_logged_idx
  on public.meal_log (client_id, logged_at desc);

-- Touch updated_at on every UPDATE.
create or replace function public.meal_log_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists meal_log_touch_updated_at on public.meal_log;
create trigger meal_log_touch_updated_at
  before update on public.meal_log
  for each row execute function public.meal_log_touch_updated_at();

-- RLS
alter table public.meal_log enable row level security;

-- Client: full CRUD on own meals only.
drop policy if exists "meal_log client rw own" on public.meal_log;
create policy "meal_log client rw own" on public.meal_log
  for all
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  )
  with check (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- Coach: read-only across all client meals. Coach cannot insert/update/delete.
drop policy if exists "meal_log coach read all" on public.meal_log;
create policy "meal_log coach read all" on public.meal_log
  for select
  using (public.is_coach());

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration. NOTE: dropping tables drops
-- their data — confirm before running in any non-dev environment.
--
-- drop policy if exists "meal_log coach read all" on public.meal_log;
-- drop policy if exists "meal_log client rw own" on public.meal_log;
-- alter table public.meal_log disable row level security;
-- drop trigger if exists meal_log_touch_updated_at on public.meal_log;
-- drop function if exists public.meal_log_touch_updated_at();
-- drop index if exists meal_log_client_logged_idx;
-- drop table if exists public.meal_log;
--
-- drop policy if exists "client_nutrition_targets client read own" on public.client_nutrition_targets;
-- drop policy if exists "client_nutrition_targets coach rw" on public.client_nutrition_targets;
-- alter table public.client_nutrition_targets disable row level security;
-- drop trigger if exists client_nutrition_targets_touch_updated_at on public.client_nutrition_targets;
-- drop function if exists public.client_nutrition_targets_touch_updated_at();
-- drop index if exists client_nutrition_targets_client_active_idx;
-- drop table if exists public.client_nutrition_targets;
