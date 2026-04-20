-- Optional image attachment on a community post. Photos live in a public
-- bucket so every authenticated member can view without signed URLs. Writes
-- are still owner-prefix only via storage.objects RLS.

alter table public.community_posts
  add column if not exists image_path text;

insert into storage.buckets (id, name, public)
values ('community-photos', 'community-photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "community-photos read public" on storage.objects;
create policy "community-photos read public" on storage.objects
  for select
  using (bucket_id = 'community-photos');

drop policy if exists "community-photos write own" on storage.objects;
create policy "community-photos write own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "community-photos update own" on storage.objects;
create policy "community-photos update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "community-photos delete own" on storage.objects;
create policy "community-photos delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'community-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
