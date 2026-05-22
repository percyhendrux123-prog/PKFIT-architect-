-- 0053_architect_uploads.sql
-- Operator → Architect image upload surface (per Architect spec, 2026-05-22).
--
-- Storage:
--   private bucket `architect-uploads`
--   path convention: {operator_user_id}/{yyyy-mm-dd}/{uuid}.{ext}
--   RLS: operator can read/write own folder; service_role full access.
--   Retention: 30 days. Daily cron purges objects + rows where
--              expires_at < now() (see netlify/functions/architect-upload-purge.js).
--
-- Table `architect_upload`:
--   metadata row per uploaded image. Binary lives in the bucket; this row
--   carries mime, size, expiry, and the path the agent uses to fetch.
--
-- This migration is additive — safe to apply against prod. The bucket
-- creation and storage policies use ON CONFLICT / IF NOT EXISTS so re-runs
-- are idempotent.

-- ─── BUCKET ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('architect-uploads', 'architect-uploads', false)
on conflict (id) do nothing;

-- ─── TABLE ──────────────────────────────────────────────────────────────
create table if not exists public.architect_upload (
  id            uuid primary key default gen_random_uuid(),
  operator_id   uuid not null references auth.users(id) on delete cascade,
  storage_path  text not null,
  mime          text not null,
  bytes         integer not null,
  context_tag   text,
  created_at    timestamptz not null default now(),
  expires_at    timestamptz not null default now() + interval '30 days'
);

comment on table public.architect_upload is
  'Metadata for operator → Architect image uploads. Binary in `architect-uploads` bucket. Rows expire at expires_at; daily cron purges both.';
comment on column public.architect_upload.storage_path is
  'Bucket-relative path. Convention: ${operator_id}/${yyyy-mm-dd}/${uuid}.${ext}';
comment on column public.architect_upload.context_tag is
  'Optional free-form tag the client sends alongside upload (e.g. "form-check", "progress-photo"). Not user-displayed; agent uses for routing.';

create index if not exists architect_upload_operator_created_idx
  on public.architect_upload (operator_id, created_at desc);
create index if not exists architect_upload_expires_idx
  on public.architect_upload (expires_at);

-- ─── ROW-LEVEL SECURITY (architect_upload table) ────────────────────────
alter table public.architect_upload enable row level security;

-- Operator: full CRUD on own rows.
drop policy if exists "architect_upload operator rw own" on public.architect_upload;
create policy "architect_upload operator rw own" on public.architect_upload
  for all
  using (
    auth.role() = 'authenticated'
    and operator_id = auth.uid()
  )
  with check (
    auth.role() = 'authenticated'
    and operator_id = auth.uid()
  );

-- (service_role bypasses RLS by default — no explicit policy needed.)

-- ─── STORAGE POLICIES (storage.objects, scoped to this bucket) ──────────
-- Operator can read own folder (objects whose first path segment matches
-- their auth.uid()).
drop policy if exists "architect-uploads operator read own" on storage.objects;
create policy "architect-uploads operator read own"
  on storage.objects for select
  using (
    bucket_id = 'architect-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Operator can insert into own folder. (The server uses service_role for
-- writes; this policy is for clients that may upload directly in the future
-- and matches the progress-photos pattern.)
drop policy if exists "architect-uploads operator write own" on storage.objects;
create policy "architect-uploads operator write own"
  on storage.objects for insert
  with check (
    bucket_id = 'architect-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Operator can delete own objects (for client-side undo / explicit purge).
drop policy if exists "architect-uploads operator delete own" on storage.objects;
create policy "architect-uploads operator delete own"
  on storage.objects for delete
  using (
    bucket_id = 'architect-uploads'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ─── DOWN (rollback) ────────────────────────────────────────────────────
-- Uncomment to roll back.
--
-- drop policy if exists "architect-uploads operator delete own" on storage.objects;
-- drop policy if exists "architect-uploads operator write own" on storage.objects;
-- drop policy if exists "architect-uploads operator read own" on storage.objects;
-- drop policy if exists "architect_upload operator rw own" on public.architect_upload;
-- alter table public.architect_upload disable row level security;
-- drop index if exists architect_upload_expires_idx;
-- drop index if exists architect_upload_operator_created_idx;
-- drop table if exists public.architect_upload;
-- delete from storage.buckets where id = 'architect-uploads';
