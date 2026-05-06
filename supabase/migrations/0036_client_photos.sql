-- 0036_client_photos.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Progress photos. One row per photo, referenced by storage path. The
-- bucket itself (`progress-photos`, private, path-prefix RLS scoped to
-- ${user.id}/*) is created in a follow-up storage migration / Supabase
-- console step — not in this DDL file.
--
-- Depends on: profiles (0001).
-- Followed by:  0037_client_notes.sql.
--
-- DO NOT APPLY in this block. File-write only.

create table if not exists public.client_photos (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  uploaded_by   uuid references public.profiles(id) on delete set null,
  storage_path  text not null,
  view_angle    text not null default 'other'
                check (view_angle in ('front', 'side', 'back', 'other')),
  taken_at      date not null default current_date,
  caption       text,
  created_at    timestamptz not null default now()
);

comment on table public.client_photos is
  'Progress photo metadata. Binary lives in the `progress-photos` storage bucket; this row carries view_angle + taken_at.';
comment on column public.client_photos.uploaded_by is
  'Coach if the coach uploaded on behalf of the client; otherwise the client themself. on delete set null preserves the row in audit.';
comment on column public.client_photos.storage_path is
  'Bucket-relative path. Convention: `${client_id}/${yyyy-mm-dd}/${view_angle}-${uuid}.jpg`.';

create index if not exists client_photos_client_taken_idx
  on public.client_photos (client_id, taken_at desc);
create index if not exists client_photos_client_angle_taken_idx
  on public.client_photos (client_id, view_angle, taken_at desc);

-- RLS
alter table public.client_photos enable row level security;

-- Client: full CRUD on their own photo rows.
drop policy if exists "client_photos client rw own" on public.client_photos;
create policy "client_photos client rw own" on public.client_photos
  for all
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  )
  with check (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- Coach: full CRUD on every client's photos.
drop policy if exists "client_photos coach rw" on public.client_photos;
create policy "client_photos coach rw" on public.client_photos
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- NOTE: Storage bucket `progress-photos` (private) and its path-prefix RLS
-- on storage.objects must be created via the Supabase console or a
-- storage-specific migration (the DDL for storage.objects is not in this
-- schema migration). Path convention enforced by the client uploader:
--   `${auth.uid()}/...`
-- so that a client's storage policy of
--   (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = auth.uid()::text)
-- matches.

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "client_photos coach rw" on public.client_photos;
-- drop policy if exists "client_photos client rw own" on public.client_photos;
-- alter table public.client_photos disable row level security;
-- drop index if exists client_photos_client_angle_taken_idx;
-- drop index if exists client_photos_client_taken_idx;
-- drop table if exists public.client_photos;
