-- 0060: qualifier_applications
--
-- Native qualifier intake — replaces the external Typeform that pkfitelite.co.site
-- has been pointing to. Captures both HOT leads (ready_to_invest=true → talk to
-- Percy direct) and SOFT leads (ready_to_invest=false → workbook / diagnose path).
--
-- Public-facing: anonymous visitors can INSERT via the server-side Netlify
-- function (which uses the service role). Only the owner can SELECT.

create table if not exists public.qualifier_applications (
  id uuid primary key default gen_random_uuid(),

  -- Lead identity
  name text not null,
  email text not null,
  goals text not null,
  experience text not null check (experience in ('beginner', 'intermediate', 'advanced')),
  training_days text not null,

  -- The price-anchor gate. True = hot lead, route to Percy direct.
  ready_to_invest boolean not null,

  -- Yes-branch only: how to reach them when Percy follows up.
  preferred_contact text,

  -- Tracking
  source text default 'operatefitness.app/qualifier',
  referrer text,
  ip_hash text,
  user_agent text,
  status text not null default 'new' check (status in ('new', 'contacted', 'booked', 'closed', 'archived')),

  created_at timestamptz not null default now()
);

create index if not exists qualifier_applications_status_idx
  on public.qualifier_applications (status, created_at desc);

create index if not exists qualifier_applications_email_idx
  on public.qualifier_applications (email);

create index if not exists qualifier_applications_hot_idx
  on public.qualifier_applications (ready_to_invest, created_at desc)
  where ready_to_invest = true;

alter table public.qualifier_applications enable row level security;

-- The server-side Netlify function inserts via service role (bypasses RLS).
-- No anon insert policy needed — keeps the table closed at the database level
-- and forces all writes through the validated server endpoint.

-- Owner reads everything.
drop policy if exists "owner reads all qualifier applications" on public.qualifier_applications;
create policy "owner reads all qualifier applications"
  on public.qualifier_applications for select
  using (public.is_owner());

-- Owner updates status / notes.
drop policy if exists "owner updates qualifier applications" on public.qualifier_applications;
create policy "owner updates qualifier applications"
  on public.qualifier_applications for update
  using (public.is_owner())
  with check (public.is_owner());
