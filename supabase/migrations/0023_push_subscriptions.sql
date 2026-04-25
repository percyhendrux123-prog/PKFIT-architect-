-- Web Push subscriptions.
-- One row per (user, endpoint) — the endpoint is the unique browser identifier.
-- A single user can have multiple subscriptions (phone + laptop). RLS limits
-- read/insert/delete to self. The Netlify push-send function uses the service
-- role to read across users.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Users can read only their own subscriptions.
drop policy if exists "push_subscriptions_select_own" on public.push_subscriptions;
create policy "push_subscriptions_select_own"
  on public.push_subscriptions
  for select
  to authenticated
  using (user_id = auth.uid());

-- Users can insert subscriptions for themselves only.
drop policy if exists "push_subscriptions_insert_own" on public.push_subscriptions;
create policy "push_subscriptions_insert_own"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (user_id = auth.uid());

-- Users can update only their own subscription rows
-- (used when the same endpoint re-registers with new keys).
drop policy if exists "push_subscriptions_update_own" on public.push_subscriptions;
create policy "push_subscriptions_update_own"
  on public.push_subscriptions
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete only their own subscriptions.
drop policy if exists "push_subscriptions_delete_own" on public.push_subscriptions;
create policy "push_subscriptions_delete_own"
  on public.push_subscriptions
  for delete
  to authenticated
  using (user_id = auth.uid());

-- Bump updated_at on update.
create or replace function public.touch_push_subscriptions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_subscriptions_touch on public.push_subscriptions;
create trigger trg_push_subscriptions_touch
  before update on public.push_subscriptions
  for each row execute function public.touch_push_subscriptions_updated_at();
