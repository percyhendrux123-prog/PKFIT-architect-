-- ════════════════════════════════════════════════════════════════════════════
-- 0059_agent_tools_source_surface.sql
-- ════════════════════════════════════════════════════════════════════════════
-- PURPOSE
-- ────────
-- The agent-tools toolkit (offer_workbook / offer_qualifier /
-- offer_consultation / generate_micro_plan) needs to work across multiple
-- surfaces: /standard (and siblings /structure, /system, /protocol, /align)
-- today, the audit app tomorrow, future keyword surfaces after that.
--
-- Two changes:
--
--   1. Drop the diagnose_sessions FK on consultation_requests.session_id.
--      Different surfaces have different session tables (the audit app has
--      its own table), and we don't want consultation rows to be tied to
--      one specific table by FK. The session_id stays as a free-form uuid
--      pointer; source_surface tells you which table to join against.
--
--   2. Add consultation_requests.source_surface (text, default 'standard').
--      Constrained to the current allowlist; expand as surfaces are added.
--      Indexed for funnel queries ("show me all audit-origin consults").
--
-- DEPENDS ON
-- ──────────
-- - 0058_consultation_requests.sql
-- ════════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ─── consultation_requests: polymorphic session_id ──────────────────────

alter table public.consultation_requests
  drop constraint if exists consultation_requests_session_id_fkey;

-- ─── consultation_requests: source_surface ──────────────────────────────

alter table public.consultation_requests
  add column if not exists source_surface text not null default 'standard';

-- Drop any prior check so this migration is idempotent across reruns.
alter table public.consultation_requests
  drop constraint if exists consultation_requests_source_surface_check;

alter table public.consultation_requests
  add constraint consultation_requests_source_surface_check
  check (source_surface in ('standard','structure','system','protocol','align','audit'));

create index if not exists consultation_requests_source_surface_idx
  on public.consultation_requests (source_surface);
