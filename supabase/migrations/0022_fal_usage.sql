-- fal.ai per-call usage log. One row per generate-image invocation.
-- Server-only writes via service role; clients never read or write this
-- table directly. Aggregation jobs / dashboards run server-side too.

create table if not exists public.fal_usage (
  id            bigserial primary key,
  user_id       uuid not null references public.profiles(id) on delete cascade,
  model         text not null,
  num_images    integer not null default 1,
  cost_usd      numeric(10,4) not null default 0,
  prompt_chars  integer not null default 0,
  latency_ms    integer,
  aspect_ratio  text,
  created_at    timestamptz not null default now()
);

create index if not exists fal_usage_user_id_created_at_idx
  on public.fal_usage (user_id, created_at desc);

create index if not exists fal_usage_created_at_idx
  on public.fal_usage (created_at desc);

alter table public.fal_usage enable row level security;
-- No policies: only server (service role) reads/writes, which bypasses RLS.
