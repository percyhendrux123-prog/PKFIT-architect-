-- Check-in photos. Reuses the existing private baseline-photos bucket. Paths
-- live at `<client_id>/checkin-<timestamp>.<ext>` so the owner-prefix RLS
-- already created in 0007_storage.sql covers them.

alter table public.check_ins
  add column if not exists photo_path text;
