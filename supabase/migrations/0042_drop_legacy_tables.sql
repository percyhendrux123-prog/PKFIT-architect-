-- 0042_drop_legacy_tables.sql
-- PK•FIT v1 — Block 1 schema additions.
-- Drop legacy tables that v1 does not use:
--   community_*       → community feed RIPed per locked decision #9
--                       (engineering scope §0.locked-decisions).
--   conversations,
--   conversation_messages → AI-assistant conversation log; out of v1.
--   fal_usage         → fal.ai image-gen usage log; out of v1.
--
-- pe_* tables are intentionally LEFT IN PLACE per scope §2.1 recommendation
-- (separate lead-intake product, not referenced by pkfit-app routes). If a
-- later block decides to migrate them to a separate Supabase project, that
-- becomes its own migration.
--
-- This migration is idempotent (DROP IF EXISTS) and FK-aware (drops
-- dependent rows first). Wrapped in a transaction so partial failure
-- rolls back cleanly.
--
-- Depends on: nothing structural — but apply LAST in Block 1 so that any
--   net-new policies / FKs from 0032–0041 are already in place and any
--   stragglers attempting to reference these tables fail loudly before
--   the drop.
-- Followed by:  0043_drop_legacy_columns.sql.
--
-- DO NOT APPLY in this block. File-write only.

begin;

-- ─── community_* (locked decision #9) ────────────────────────────────────
-- Drop reactions and comments first; both reference community_posts.
drop table if exists public.community_reactions cascade;
drop table if exists public.community_comments  cascade;
drop table if exists public.community_posts     cascade;

-- ─── conversation_* (AI assistant — out of v1) ───────────────────────────
-- Drop messages first; references conversations.
drop table if exists public.conversation_messages cascade;
drop table if exists public.conversations         cascade;

-- ─── fal_usage (image-gen log — out of v1) ───────────────────────────────
drop table if exists public.fal_usage cascade;

-- Note: `cascade` is belt-and-braces. In a clean Block 0 where the app
-- code that references these tables is already deleted, no objects should
-- depend on them. cascade ensures any leftover view/policy/trigger goes
-- with the table rather than blocking the drop.

commit;

-- ─── DOWN (rollback) ─────────────────────────────────────────────────────
-- Tables cannot be restored without their original DDL. The original
-- definitions live in:
--   community_posts     → 0001_init.sql, modified by 0009_announcement_targeting.sql
--   community_comments  → 0001_init.sql
--   community_reactions → 0001_init.sql
--   conversations       → 0004_conversations.sql, modified by 0018_conversation_context.sql
--   conversation_messages → 0004_conversations.sql
--   fal_usage           → 0022_fal_usage.sql
--
-- To roll back, re-run those original migrations. Data is not preserved —
-- this is a destructive operation.
