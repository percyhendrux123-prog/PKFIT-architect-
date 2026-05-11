-- 0037_client_notes.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Coach internal notes per client. Two record types:
--   'note'         → quick observation, multi-row per client over time.
--   'consultation' → consultation report; longer body, structured.
--
-- Per engineering scope §2.2 / §2.3 — these contain PII. Coach has full
-- CRUD; the client has read-only access to their own rows so they can see
-- the same record their coach is referencing in conversation. Tighten this
-- to coach-only-read in a follow-up if any consult body should stay
-- private to the coach.
--
-- Depends on: profiles (0001).
-- Followed by:  0038_client_attachments.sql.
--
-- DO NOT APPLY in this block. File-write only.

create table if not exists public.client_notes (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references public.profiles(id) on delete cascade,
  author_id   uuid not null references public.profiles(id) on delete cascade,
  type        text not null
              check (type in ('note', 'consultation')),
  title       text,
  body        text not null,
  is_pinned   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

comment on table public.client_notes is
  'Coach internal notes per client. PII-bearing. note | consultation. Coach rw, client read own.';
comment on column public.client_notes.author_id is
  'The coach who wrote the note. on delete cascade — if a coach profile is removed, their notes go with them.';
comment on column public.client_notes.type is
  'note (multi-row, free-form) | consultation (structured report).';

create index if not exists client_notes_client_created_idx
  on public.client_notes (client_id, created_at desc);
create index if not exists client_notes_client_type_idx
  on public.client_notes (client_id, type);
create index if not exists client_notes_pinned_idx
  on public.client_notes (client_id, is_pinned)
  where is_pinned;

-- Touch updated_at on every UPDATE.
create or replace function public.client_notes_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists client_notes_touch_updated_at on public.client_notes;
create trigger client_notes_touch_updated_at
  before update on public.client_notes
  for each row execute function public.client_notes_touch_updated_at();

-- RLS
alter table public.client_notes enable row level security;

-- Coach: full CRUD on every client's notes.
drop policy if exists "client_notes coach rw" on public.client_notes;
create policy "client_notes coach rw" on public.client_notes
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- Client: read-only on notes about themselves. No write — clients cannot
-- author or modify a coach note.
drop policy if exists "client_notes client read own" on public.client_notes;
create policy "client_notes client read own" on public.client_notes
  for select
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "client_notes client read own" on public.client_notes;
-- drop policy if exists "client_notes coach rw" on public.client_notes;
-- alter table public.client_notes disable row level security;
-- drop trigger if exists client_notes_touch_updated_at on public.client_notes;
-- drop function if exists public.client_notes_touch_updated_at();
-- drop index if exists client_notes_pinned_idx;
-- drop index if exists client_notes_client_type_idx;
-- drop index if exists client_notes_client_created_idx;
-- drop table if exists public.client_notes;
