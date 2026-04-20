-- Storage bucket for baseline photos and any future client-uploaded assets.
-- Each file is stored under a path `<client_id>/<filename>`. RLS policies on
-- storage.objects enforce that a client can only read/write their own prefix;
-- coaches can read all baseline photos but not write on a client's behalf.

insert into storage.buckets (id, name, public)
values ('baseline-photos', 'baseline-photos', false)
on conflict (id) do nothing;

-- Read: owner of the prefix OR any coach.
drop policy if exists "baseline-photos read own or coach" on storage.objects;
create policy "baseline-photos read own or coach" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'baseline-photos'
    and (
      public.is_coach()
      or (storage.foldername(name))[1] = auth.uid()::text
    )
  );

-- Insert / update / delete: only owner of the prefix.
drop policy if exists "baseline-photos write own" on storage.objects;
create policy "baseline-photos write own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'baseline-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "baseline-photos update own" on storage.objects;
create policy "baseline-photos update own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'baseline-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "baseline-photos delete own" on storage.objects;
create policy "baseline-photos delete own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'baseline-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Store a pointer on the profile for quick lookup.
alter table public.profiles
  add column if not exists baseline_photo_path text;
