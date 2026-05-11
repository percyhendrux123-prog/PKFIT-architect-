-- 0038_client_attachments.sql
-- PK•FIT v1 — Block 1 schema additions.
-- File uploads per client (PDFs, blood-work scans, intake forms, body
-- composition reports). Binary lives in the `client-attachments` storage
-- bucket; this row carries the metadata.
--
-- Coach uploads on behalf of the client (most common) and the client can
-- upload their own. Both can read; only the coach can delete.
--
-- Depends on: profiles (0001).
-- Followed by:  0039_forms_and_responses.sql.
--
-- DO NOT APPLY in this block. File-write only.

create table if not exists public.client_attachments (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.profiles(id) on delete cascade,
  uploaded_by   uuid not null references public.profiles(id) on delete cascade,
  storage_path  text not null,
  filename      text not null,
  mime_type     text,
  size_bytes    bigint,
  -- Free-text label so a coach can group ("blood work", "consult notes",
  -- "previous program PDF"). UI surfaces it as a chip.
  category      text,
  notes         text,
  created_at    timestamptz not null default now()
);

comment on table public.client_attachments is
  'File metadata for client-attached documents. Binary in `client-attachments` bucket. Coach rw, client read own + write own.';
comment on column public.client_attachments.uploaded_by is
  'Whoever uploaded the file — coach or client. Distinct from client_id (the subject).';
comment on column public.client_attachments.storage_path is
  'Bucket-relative path. Convention: `${client_id}/${yyyy-mm-dd}/${slug}-${uuid}.${ext}`.';
comment on column public.client_attachments.size_bytes is
  'Stored on insert from the upload response; advisory only — storage layer is the source of truth.';

create index if not exists client_attachments_client_created_idx
  on public.client_attachments (client_id, created_at desc);
create index if not exists client_attachments_uploader_idx
  on public.client_attachments (uploaded_by);
create index if not exists client_attachments_category_idx
  on public.client_attachments (client_id, category);

-- RLS
alter table public.client_attachments enable row level security;

-- Coach: full CRUD on every client's attachments.
drop policy if exists "client_attachments coach rw" on public.client_attachments;
create policy "client_attachments coach rw" on public.client_attachments
  for all
  using (public.is_coach())
  with check (public.is_coach());

-- Client: read on their own attachments.
drop policy if exists "client_attachments client read own" on public.client_attachments;
create policy "client_attachments client read own" on public.client_attachments
  for select
  using (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
  );

-- Client: insert on their own attachments (uploader = self, subject = self).
drop policy if exists "client_attachments client insert own" on public.client_attachments;
create policy "client_attachments client insert own" on public.client_attachments
  for insert
  with check (
    auth.role() = 'authenticated'
    and client_id = auth.uid()
    and uploaded_by = auth.uid()
  );

-- NOTE: Storage bucket `client-attachments` (private) and its path-prefix
-- RLS on storage.objects must be created via the Supabase console or a
-- storage-specific migration. Path convention: `${client_id}/...`.
-- Storage policy for clients: bucket_id = 'client-attachments' and
-- (storage.foldername(name))[1] = auth.uid()::text.

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Uncomment to roll back this migration.
--
-- drop policy if exists "client_attachments client insert own" on public.client_attachments;
-- drop policy if exists "client_attachments client read own" on public.client_attachments;
-- drop policy if exists "client_attachments coach rw" on public.client_attachments;
-- alter table public.client_attachments disable row level security;
-- drop index if exists client_attachments_category_idx;
-- drop index if exists client_attachments_uploader_idx;
-- drop index if exists client_attachments_client_created_idx;
-- drop table if exists public.client_attachments;
