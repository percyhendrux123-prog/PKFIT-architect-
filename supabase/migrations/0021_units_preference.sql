-- Per-client unit system preference. Default imperial because the current
-- audience is US. Storage stays canonical (kg, cm) — only display converts.

do $$ begin
  create type unit_system as enum ('metric', 'imperial');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists units unit_system not null default 'imperial';
