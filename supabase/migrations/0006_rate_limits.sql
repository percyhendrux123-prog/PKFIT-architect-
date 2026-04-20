-- Simple fixed-window rate limiter. One row per (user, bucket); the server
-- resets the window when the current period has elapsed. Writes only happen
-- from server functions (service role), so we leave RLS enabled with no
-- client policies — clients cannot read or write rate_limits directly.

create table if not exists public.rate_limits (
  user_id       uuid not null references public.profiles(id) on delete cascade,
  bucket        text not null,
  window_start  timestamptz not null default now(),
  count         integer not null default 0,
  primary key (user_id, bucket)
);

alter table public.rate_limits enable row level security;
-- No policies: only server (service role) can read/write, which bypasses RLS.
