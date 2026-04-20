-- Tracks the last time each user caught up on the community feed (so we can
-- show an unread badge), plus a path to their avatar in the shared photos
-- bucket. Both columns nullable — older accounts just start at zero and the
-- feed counts everything until they visit it once.

alter table public.profiles
  add column if not exists community_last_seen_at timestamptz,
  add column if not exists avatar_path text;
