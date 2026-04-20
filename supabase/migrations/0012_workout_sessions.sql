-- Workout sessions. One row per session the client actually performed. Keeps
-- the full exercise snapshot on the row so future program edits do not
-- rewrite history. Also carries optional rpe_avg, duration, and notes.

create table if not exists public.workout_sessions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  program_id    uuid references public.programs(id) on delete set null,
  performed_at  timestamptz not null default now(),
  duration_min  integer,
  rpe_avg       numeric,
  notes         text,
  exercises     jsonb not null default '[]'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists workout_sessions_client_idx
  on public.workout_sessions (client_id, performed_at desc);
create index if not exists workout_sessions_program_idx
  on public.workout_sessions (program_id);

alter table public.workout_sessions enable row level security;

drop policy if exists "sessions client rw" on public.workout_sessions;
create policy "sessions client rw" on public.workout_sessions
  for all using (client_id = auth.uid() or public.is_coach())
         with check (client_id = auth.uid() or public.is_coach());
