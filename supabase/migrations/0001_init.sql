-- PKFIT initial schema: profiles, programs, meals, habits, check_ins,
-- community (posts + reactions + comments), and payments.
-- Row-Level Security is enabled on every table; clients access only their own
-- rows, coaches access everything. Community is readable by any authenticated
-- user and writable by the author.

set check_function_bodies = off;

-- ─── EXTENSIONS ──────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── ENUMS ───────────────────────────────────────────────────────────────
do $$ begin
  create type user_role as enum ('client', 'coach');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('active', 'trialing', 'past_due', 'canceled', 'incomplete');
exception when duplicate_object then null; end $$;

-- ─── HELPERS ─────────────────────────────────────────────────────────────
create or replace function public.is_coach()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'coach'
  );
$$;

-- ─── PROFILES ────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        user_role not null default 'client',
  name        text,
  email       text,
  plan        text,
  start_date  date,
  loop_stage  text,
  created_at  timestamptz not null default now()
);

-- Auto-create a profile row for every new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── PROGRAMS ────────────────────────────────────────────────────────────
create table if not exists public.programs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  week_number int  not null default 1,
  schedule    jsonb not null default '{}'::jsonb,
  exercises   jsonb not null default '[]'::jsonb,
  status      text not null default 'draft',
  created_at  timestamptz not null default now()
);
create index if not exists programs_client_id_idx on public.programs(client_id);

-- ─── MEALS ───────────────────────────────────────────────────────────────
create table if not exists public.meals (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  day         text,
  meal_type   text,
  items       jsonb not null default '[]'::jsonb,
  macros      jsonb not null default '{}'::jsonb,
  date        date,
  created_at  timestamptz not null default now()
);
create index if not exists meals_client_id_idx on public.meals(client_id);

-- ─── HABITS ──────────────────────────────────────────────────────────────
create table if not exists public.habits (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  habit_list    jsonb not null default '[]'::jsonb,
  check_history jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists habits_client_id_idx on public.habits(client_id);

-- ─── CHECK-INS ───────────────────────────────────────────────────────────
create table if not exists public.check_ins (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  date        date not null default (now() at time zone 'utc')::date,
  weight      numeric,
  body_fat    numeric,
  notes       text,
  created_at  timestamptz not null default now()
);
create index if not exists check_ins_client_id_idx on public.check_ins(client_id);

-- ─── COMMUNITY ───────────────────────────────────────────────────────────
create table if not exists public.community_posts (
  id          uuid primary key default gen_random_uuid(),
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  tag         text,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists community_posts_created_idx on public.community_posts(created_at desc);

create table if not exists public.community_reactions (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  type        text not null default 'ack',
  created_at  timestamptz not null default now(),
  unique (post_id, user_id, type)
);

create table if not exists public.community_comments (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid not null references public.community_posts(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists community_comments_post_id_idx on public.community_comments(post_id);

-- ─── PAYMENTS ────────────────────────────────────────────────────────────
create table if not exists public.payments (
  id                       uuid primary key default gen_random_uuid(),
  client_id                uuid not null references public.profiles(id) on delete cascade,
  plan                     text,
  amount                   numeric,
  status                   payment_status,
  stripe_subscription_id   text unique,
  stripe_customer_id       text,
  current_period_end       timestamptz,
  created_at               timestamptz not null default now()
);
create index if not exists payments_client_id_idx on public.payments(client_id);

-- ─── ROW-LEVEL SECURITY ──────────────────────────────────────────────────
alter table public.profiles             enable row level security;
alter table public.programs             enable row level security;
alter table public.meals                enable row level security;
alter table public.habits               enable row level security;
alter table public.check_ins            enable row level security;
alter table public.community_posts      enable row level security;
alter table public.community_reactions  enable row level security;
alter table public.community_comments   enable row level security;
alter table public.payments             enable row level security;

-- profiles
drop policy if exists "profiles self read"  on public.profiles;
create policy "profiles self read" on public.profiles
  for select using (auth.uid() = id or public.is_coach());

drop policy if exists "profiles self write" on public.profiles;
create policy "profiles self write" on public.profiles
  for update using (auth.uid() = id or public.is_coach())
             with check (auth.uid() = id or public.is_coach());

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles
  for insert with check (auth.uid() = id or public.is_coach());

-- programs / meals / habits / check_ins: client owns; coach owns all
do $$
declare tbl text;
begin
  foreach tbl in array array['programs','meals','habits','check_ins'] loop
    execute format('drop policy if exists "%1$s client rw" on public.%1$s;', tbl);
    execute format($f$
      create policy "%1$s client rw" on public.%1$s
        for all using (client_id = auth.uid() or public.is_coach())
               with check (client_id = auth.uid() or public.is_coach());
    $f$, tbl);
  end loop;
end $$;

-- payments: clients read own; only server (service role, bypasses RLS) writes.
drop policy if exists "payments client read" on public.payments;
create policy "payments client read" on public.payments
  for select using (client_id = auth.uid() or public.is_coach());

-- community_posts
drop policy if exists "posts read authenticated" on public.community_posts;
create policy "posts read authenticated" on public.community_posts
  for select using (auth.role() = 'authenticated');

drop policy if exists "posts insert self" on public.community_posts;
create policy "posts insert self" on public.community_posts
  for insert with check (author_id = auth.uid());

drop policy if exists "posts update author or coach" on public.community_posts;
create policy "posts update author or coach" on public.community_posts
  for update using (author_id = auth.uid() or public.is_coach())
             with check (author_id = auth.uid() or public.is_coach());

drop policy if exists "posts delete author or coach" on public.community_posts;
create policy "posts delete author or coach" on public.community_posts
  for delete using (author_id = auth.uid() or public.is_coach());

-- community_reactions
drop policy if exists "reactions read authenticated" on public.community_reactions;
create policy "reactions read authenticated" on public.community_reactions
  for select using (auth.role() = 'authenticated');

drop policy if exists "reactions insert self" on public.community_reactions;
create policy "reactions insert self" on public.community_reactions
  for insert with check (user_id = auth.uid());

drop policy if exists "reactions delete self" on public.community_reactions;
create policy "reactions delete self" on public.community_reactions
  for delete using (user_id = auth.uid() or public.is_coach());

-- community_comments
drop policy if exists "comments read authenticated" on public.community_comments;
create policy "comments read authenticated" on public.community_comments
  for select using (auth.role() = 'authenticated');

drop policy if exists "comments insert self" on public.community_comments;
create policy "comments insert self" on public.community_comments
  for insert with check (author_id = auth.uid());

drop policy if exists "comments update author" on public.community_comments;
create policy "comments update author" on public.community_comments
  for update using (author_id = auth.uid() or public.is_coach())
             with check (author_id = auth.uid() or public.is_coach());

drop policy if exists "comments delete author" on public.community_comments;
create policy "comments delete author" on public.community_comments
  for delete using (author_id = auth.uid() or public.is_coach());

-- ─── REALTIME ────────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.community_posts;
alter publication supabase_realtime add table public.community_comments;
alter publication supabase_realtime add table public.community_reactions;
