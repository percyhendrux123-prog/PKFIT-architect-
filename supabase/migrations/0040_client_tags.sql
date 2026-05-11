-- 0040_client_tags.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Tag taxonomy + assignment table for client triage. Two flavors:
--   manual tags  → coach-applied. Examples: "competing", "high-volume",
--                  "consult-pending", "VIP".
--   auto tags    → applied by background jobs. Examples: "missed-checkin-3d",
--                  "no-session-7d", "PR-this-week", "payment-past-due".
--
-- Auto tags are reconciled by an idempotent worker (write-then-prune); the
-- `is_auto` flag is enough — no separate write path needed.
--
-- Depends on: profiles (0001).
-- Followed by:  0041_profiles_extensions.sql.
--
-- DO NOT APPLY in this block. File-write only.

-- ─── client_tags (taxonomy) ──────────────────────────────────────────────
create table if not exists public.client_tags (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  -- Hex color without leading '#' (e.g. 'C9A84C'). Optional; UI falls
  -- back to a default chip color when null.
  color       text,
  description text,
  is_auto     boolean not null default false,
  created_at  timestamptz not null default now()
);

comment on table public.client_tags is
  'Tag taxonomy. is_auto distinguishes coach-applied tags from worker-applied tags.';
comment on column public.client_tags.is_auto is
  'true if the tag is applied/removed by a background worker (e.g. missed-checkin-3d). false for coach-managed tags.';

create index if not exists client_tags_is_auto_idx
  on public.client_tags (is_auto);

-- ─── client_tag_assignments ──────────────────────────────────────────────
create table if not exists public.client_tag_assignments (
  client_id    uuid not null references public.profiles(id) on delete cascade,
  tag_id       uuid not null references public.client_tags(id) on delete cascade,
  assigned_by  uuid references public.profiles(id) on delete set null,
  assigned_at  timestamptz not null default now(),
  -- Optional context note (e.g. "applied because last 3 check-ins missing").
  reason       text,
  primary key (client_id, tag_id)
);

comment on table public.client_tag_assignments is
  'Maps tags to clients. assigned_by is null for auto-applied tags.';
comment on column public.client_tag_assignments.assigned_by is
  'The coach who applied the tag manually. Null when the tag was applied by an automation.';

create index if not exists client_tag_assignments_tag_idx
  on public.client_tag_assignments (tag_id);
create index if not exists client_tag_assignments_client_idx
  on public.client_tag_assignments (client_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────
alter table public.client_tags enable row level security;
alter table public.client_tag_assignments enable row level security;

-- client_tags: coach full CRUD on the taxonomy.
drop policy if exists "client_tags coach rw" on public.client_tags;
create policy "client_tags coach rw" on public.client_tags
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- client_tags: any authenticated user can read the taxonomy (clients see
-- their own assigned tag chips on /profile or /dashboard).
drop policy if exists "client_tags read authenticated" on public.client_tags;
create policy "client_tags read authenticated" on public.client_tags
  for select
  using (auth.role() = 'authenticated');

-- client_tag_assignments: coach full CRUD.
drop policy if exists "client_tag_assignments coach rw" on public.client_tag_assignments;
create policy "client_tag_assignments coach rw" on public.client_tag_assignments
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- client_tag_assignments: client read on their own assignments.
drop policy if exists "client_tag_assignments client read own" on public.client_tag_assignments;
create policy "client_tag_assignments client read own" on public.client_tag_assignments
  for select
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "client_tag_assignments client read own" on public.client_tag_assignments;
-- drop policy if exists "client_tag_assignments coach rw" on public.client_tag_assignments;
-- drop policy if exists "client_tags read authenticated" on public.client_tags;
-- drop policy if exists "client_tags coach rw" on public.client_tags;
-- alter table public.client_tag_assignments disable row level security;
-- alter table public.client_tags disable row level security;
-- drop index if exists client_tag_assignments_client_idx;
-- drop index if exists client_tag_assignments_tag_idx;
-- drop table if exists public.client_tag_assignments;
-- drop index if exists client_tags_is_auto_idx;
-- drop table if exists public.client_tags;
