-- 0043_drop_legacy_columns.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Drop legacy columns orphaned by the community RIP (locked decision #9).
--
-- The 1 column called out in engineering scope §2.2 (legacy 0038):
--   profiles.community_last_seen_at  → introduced by migration 0010,
--     consumed by `useUnreadCommunity.js` and the community feed surface.
--     Both gone in Block 0 and 0042 — column is now dead weight.
--
-- This migration must run AFTER 0042 (which drops community_* tables).
-- Any FK or view that referenced this column should already be gone.
--
-- Depends on: 0042_drop_legacy_tables.sql.
-- This is the last migration in Block 1.
--
-- DO NOT APPLY in this block. File-write only.

begin;

alter table public.profiles
  drop column if exists community_last_seen_at;

commit;

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Restore the column shape from migration 0010_last_seen_and_avatar.sql.
-- Data is not recoverable.
--
-- begin;
-- alter table public.profiles
--   add column if not exists community_last_seen_at timestamptz;
-- commit;
