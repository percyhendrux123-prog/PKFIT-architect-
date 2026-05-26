-- ════════════════════════════════════════════════════════════════════════════
-- 0061_diagnose_state_machine.sql
-- ════════════════════════════════════════════════════════════════════════════
-- PURPOSE
-- ────────
-- v3 architecture for /standard. Externalizes the agent's intake state machine
-- and lead-scoring layer out of the system prompt and into the database, so
-- the backend (netlify/functions/diagnose.js) is the source of truth for:
--
--   - which conversational state a session is in
--   - which slots (name, age, why, goal, experience, occupation, etc.) have
--     been captured
--   - the running lead score (signed integer, computed via per-turn deltas)
--   - the computed route_status (pending | qualified | nurture | disqualified
--     | human_handoff | medical_referral)
--   - the derived lead_fields blob for downstream consumption (CRM, Percy's
--     dashboard, ManyChat handoff)
--
-- The system prompt becomes per-state-reactive instead of one long narrative.
-- See ~/Documents/PKFIT/Content/standard-agent-v3-spec.md for the full design.
--
-- DEPENDS ON
-- ──────────
-- - 0056_diagnose_sessions.sql (creates the base diagnose_sessions table)
-- - 0058_consultation_requests.sql (adds tools_invoked, lead_email, etc.)
--
-- ROLLBACK
-- ────────
-- Drop the five new columns and the two new indexes. Pre-existing v2 columns
-- and behavior are untouched. v2 sits at commit 9024e2a.
-- ════════════════════════════════════════════════════════════════════════════

set check_function_bodies = off;

-- ─── extend diagnose_sessions with v3 state/scoring columns ─────────────

alter table public.diagnose_sessions
  add column if not exists state         text not null default 'entry',
  add column if not exists slots         jsonb not null default '{}'::jsonb,
  add column if not exists lead_score    integer not null default 0,
  add column if not exists route_status  text not null default 'pending'
                          check (route_status in (
                            'pending',
                            'qualified',
                            'nurture',
                            'disqualified',
                            'human_handoff',
                            'medical_referral'
                          )),
  add column if not exists lead_fields   jsonb not null default '{}'::jsonb;

-- ─── indexes for funnel queries ─────────────────────────────────────────

create index if not exists diagnose_sessions_state_idx
  on public.diagnose_sessions (state);

create index if not exists diagnose_sessions_route_status_idx
  on public.diagnose_sessions (route_status)
  where route_status <> 'pending';

create index if not exists diagnose_sessions_lead_score_idx
  on public.diagnose_sessions (lead_score desc);

-- ─── notes ──────────────────────────────────────────────────────────────
-- The agent_tools_source_surface migration (0059) already added source_surface
-- on consultation_requests, so we don't need a parallel field here. The lead's
-- lineage is: diagnose_sessions.keyword → (via session_id) → consultation_requests.
--
-- No RLS changes required. Existing diagnose_sessions policies cover these
-- columns transparently: the netlify function uses the service-role client
-- (getAdminClient) which bypasses RLS for writes/reads.
