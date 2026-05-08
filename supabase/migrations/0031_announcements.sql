-- 0031_announcements.sql
-- PK•FIT v1 — Block 0 community surface RIP.
-- Coach broadcasts move from `community_posts` (a social-feed shape) to a
-- dedicated, read-only `announcements` table. Community surface is RIPed
-- per locked decision #9 in pkfit-app-engineering-scope-v1.md.
--
-- This migration only ADDS the new table and policies. The legacy
-- community_* tables are NOT dropped here — that is a separate FK-aware,
-- gated migration (see scope §6 Block 0 step 6 / Block 1).
--
-- DO NOT APPLY in this block. File-write only. Apply order is governed by
-- Block 1 of the build sequence (after migrations 0031–0037).

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text,
  body text not null,
  -- 'all'    → every authenticated client
  -- 'active' → clients whose profile.plan resolves to an active subscription tier
  -- a tier slug ('trial' | 'performance' | 'identity' | 'full' | 'premium')
  --   → clients on that exact tier (mirrors community_posts.target_plan)
  audience text not null default 'all',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.announcements is
  'Coach-authored broadcast notes. Read-only for clients. Replaces the community_posts feed surface in v1.';
comment on column public.announcements.audience is
  'all | active | <plan-slug>. Determines which clients can read the row.';
comment on column public.announcements.published_at is
  'Null until the coach publishes. Drafts (published_at is null) only the author can read.';

create index if not exists announcements_coach_idx
  on public.announcements (coach_id);
create index if not exists announcements_published_idx
  on public.announcements (published_at desc nulls last);

-- Touch updated_at on every UPDATE.
create or replace function public.announcements_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists announcements_touch_updated_at on public.announcements;
create trigger announcements_touch_updated_at
  before update on public.announcements
  for each row execute function public.announcements_touch_updated_at();

-- RLS
alter table public.announcements enable row level security;

-- Coach: full CRUD on their own rows.
drop policy if exists "announcements coach write own" on public.announcements;
create policy "announcements coach write own" on public.announcements
  for all
  using (
    public.is_coach()
    and coach_id = auth.uid()
  )
  with check (
    public.is_coach()
    and coach_id = auth.uid()
  );

-- Coach: can read every coach-authored row (drafts + published).
drop policy if exists "announcements coach read all" on public.announcements;
create policy "announcements coach read all" on public.announcements
  for select
  using (public.is_coach());

-- Client: can read published rows whose audience matches them.
-- Mirrors the targeting logic of community_posts.target_plan from
-- migration 0009 so cohort behaviour is preserved when Coach Announcements
-- is repointed at this table.
drop policy if exists "announcements client read targeted" on public.announcements;
create policy "announcements client read targeted" on public.announcements
  for select
  using (
    auth.role() = 'authenticated'
    and published_at is not null
    and (
      audience = 'all'
      or (
        audience = 'active'
        and exists (
          select 1 from public.profiles p
          where p.id = auth.uid()
            and p.plan in ('trial', 'performance', 'identity', 'full', 'premium')
        )
      )
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.plan = announcements.audience
      )
    )
  );
