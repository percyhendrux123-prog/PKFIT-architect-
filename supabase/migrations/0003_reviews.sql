-- Weekly reviews. One row per client per week. The generator reads the
-- client's last seven days of check-ins, programs, and habit history, then
-- writes a review row. Clients read their own reviews; coaches read all.

create table if not exists public.reviews (
  id              uuid primary key default gen_random_uuid(),
  client_id       uuid not null references public.profiles(id) on delete cascade,
  week_starting   date not null,
  summary         text,
  constraints     jsonb not null default '[]'::jsonb,
  adjustments     jsonb not null default '[]'::jsonb,
  metrics         jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  unique (client_id, week_starting)
);
create index if not exists reviews_client_id_idx on public.reviews(client_id, week_starting desc);

alter table public.reviews enable row level security;

drop policy if exists "reviews client rw" on public.reviews;
create policy "reviews client rw" on public.reviews
  for all using (client_id = auth.uid() or public.is_coach())
         with check (client_id = auth.uid() or public.is_coach());
