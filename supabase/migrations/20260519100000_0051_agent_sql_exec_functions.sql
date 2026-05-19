-- 0046_agent_sql_exec_functions.sql
-- Architect v2 — Owner-Agentic Phase 1 unblock for supabase_query_read/write.
--
-- Adds the two Postgres functions the agent tool layer expects:
--
--   agent_exec_sql_readonly(query_sql text)
--     → Read-only SQL execution. SELECT/WITH only. statement_timeout = 10s.
--     → Returns jsonb { rows: jsonb[], columns: text[] }.
--
--   agent_exec_sql_write(query_sql text, expected_change text)
--     → DML execution. Accepts only INSERT/UPDATE/DELETE (no MERGE, no CTE-
--       prefixed writes). Rejects DDL. statement_timeout = 30s.
--     → Returns jsonb { affected_rows: int, expected_change: text }.
--
-- Both are SECURITY DEFINER. Execute is granted ONLY to service_role; revoked
-- from anon + authenticated. The Netlify functions layer holds the
-- service_role key and is the only legitimate caller.
--
-- Defence-in-depth:
--   1. Pre-flight keyword validation rejects mismatched statements early.
--   2. statement_timeout caps runaway queries.
--   3. The read function sets `SET LOCAL ROLE agent_sql_readonly` — a NOLOGIN
--      role with SELECT-only grants on public.*. Even if static keyword
--      checks are bypassed, the role lacks privileges to mutate.
--   4. The write function additionally rejects DDL keywords
--      (CREATE/DROP/ALTER/TRUNCATE) — DDL flows through a separate CRITICAL
--      typed-confirmation path in the agent orchestrator, never this function.
--   5. EXECUTE privilege gated to service_role.
--
-- DDL escalation note:
--   DDL is intentionally NOT supported here. The agent orchestrator escalates
--   any DDL statement to CRITICAL approval (typed table-name confirmation).
--   When that flow lands in Phase 2, it will use a separate function or run
--   raw SQL via a per-call elevated path. For now, DDL = hard reject.
--
-- Audit log note:
--   The calling Netlify function (`netlify/functions/_shared/agent-tools/audit.js`)
--   is the authoritative auditor — it writes to agent_actions with full user
--   context BEFORE invoking these functions. We don't duplicate that here:
--   the function has no auth.uid() context (SECURITY DEFINER strips it),
--   and adding a user_id parameter would deviate from the spec'd 2-arg shape.

-- ═══════════════════════════════════════════════════════════════════════════
-- Read-only role
-- ═══════════════════════════════════════════════════════════════════════════
-- NOLOGIN role with only SELECT grants on public.*. agent_exec_sql_readonly
-- switches into this role via SET LOCAL ROLE before executing the caller's
-- query. Even if static keyword checks somehow miss a mutation payload, the
-- role lacks privileges and Postgres rejects the write at the engine level.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'agent_sql_readonly') then
    create role agent_sql_readonly nologin;
  end if;
end$$;

grant usage  on schema public to agent_sql_readonly;
grant select on all tables    in schema public to agent_sql_readonly;
grant select on all sequences in schema public to agent_sql_readonly;
alter default privileges in schema public
  grant select on tables    to agent_sql_readonly;
alter default privileges in schema public
  grant select on sequences to agent_sql_readonly;

-- The function owner needs role membership to SET ROLE. Supabase migrations
-- run as `postgres`; grant to `supabase_admin` too in case the function ends
-- up owned by it on remote deploys. supabase_admin may not exist locally —
-- swallow the error if so.
grant agent_sql_readonly to postgres;
do $$
begin
  begin
    execute 'grant agent_sql_readonly to supabase_admin';
  exception when others then
    null;
  end;
end$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- agent_exec_sql_readonly
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.agent_exec_sql_readonly(query_sql text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  trimmed text;
  rows_json jsonb;
  cols_json jsonb;
begin
  if query_sql is null or length(trim(query_sql)) = 0 then
    raise exception 'query_sql is required';
  end if;

  -- Strip leading whitespace and trailing semicolons for matching.
  trimmed := regexp_replace(query_sql, '^\s+', '');
  trimmed := regexp_replace(trimmed, ';\s*$', '');

  -- Must start with SELECT or WITH.
  if not (trimmed ~* '^(select|with)\s') then
    raise exception 'only SELECT/WITH allowed (got: %)', left(trimmed, 40);
  end if;

  -- Belt-and-suspenders: reject mutation/DDL keywords anywhere in the body.
  -- The transaction-level read-only / SELECT-only enforcement comes from the
  -- prefix check above plus the absence of write privileges on the executing
  -- role, but a keyword scan catches obvious abuse early with a clear error.
  if trimmed ~* '\m(insert|update|delete|merge|truncate|drop|create|alter|grant|revoke|reindex|copy)\M' then
    raise exception 'forbidden keyword detected in read-only statement';
  end if;

  -- Per-statement guardrails.
  set local statement_timeout = '10s';
  set local lock_timeout = '2s';
  set local idle_in_transaction_session_timeout = '15s';

  -- Drop to the read-only role for the actual execution. SET LOCAL scopes to
  -- the current transaction, so a subsequent statement in the same tx would
  -- still be downgraded; we RESET ROLE before returning (and in the exception
  -- branch) so the calling tx's role state is fully restored.
  set local role agent_sql_readonly;

  -- Execute the user's SELECT/WITH and aggregate rows into a jsonb array.
  execute format('select coalesce(jsonb_agg(to_jsonb(_t)), ''[]''::jsonb) from (%s) _t', trimmed)
    into rows_json;

  reset role;

  -- Derive column metadata from the first row (cheap, no second query).
  if jsonb_array_length(rows_json) > 0 then
    select jsonb_agg(k order by k)
      into cols_json
      from jsonb_object_keys(rows_json -> 0) k;
  else
    cols_json := '[]'::jsonb;
  end if;

  return jsonb_build_object(
    'rows', rows_json,
    'columns', coalesce(cols_json, '[]'::jsonb),
    'rowCount', jsonb_array_length(rows_json)
  );
exception
  when others then
    -- Best-effort: reset role even if EXECUTE raised. SET LOCAL is also
    -- rolled back on transaction rollback, so this is belt-and-suspenders.
    begin reset role; exception when others then null; end;
    raise;
end;
$func$;

comment on function public.agent_exec_sql_readonly(text) is
  'Owner-agent read path. SELECT/WITH only. SET LOCAL ROLE agent_sql_readonly. 10s statement timeout. service_role EXECUTE only.';

-- ═══════════════════════════════════════════════════════════════════════════
-- agent_exec_sql_write
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.agent_exec_sql_write(query_sql text, expected_change text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $func$
declare
  trimmed text;
  affected bigint;
begin
  if query_sql is null or length(trim(query_sql)) = 0 then
    raise exception 'query_sql is required';
  end if;
  if expected_change is null or length(trim(expected_change)) = 0 then
    raise exception 'expected_change is required (one-line plain-English summary)';
  end if;

  trimmed := regexp_replace(query_sql, '^\s+', '');
  trimmed := regexp_replace(trimmed, ';\s*$', '');

  -- Must be a plain DML statement: INSERT, UPDATE, or DELETE. CTE-prefixed
  -- writes (WITH ... INSERT) and MERGE are intentionally rejected — Phase 1
  -- spec is INSERT/UPDATE/DELETE only. Rewriting a CTE-write into a plain
  -- DML is the agent's job, not this function's.
  if not (trimmed ~* '^(insert|update|delete)\s') then
    raise exception 'only INSERT/UPDATE/DELETE allowed (got: %)', left(trimmed, 40);
  end if;

  -- Reject DDL outright. DDL flows through the CRITICAL typed-confirmation
  -- path in the agent orchestrator, never through this function.
  if trimmed ~* '\m(create|drop|alter|truncate|rename|reindex|grant|revoke|comment\s+on)\M' then
    raise exception 'DDL not allowed here — escalate to the DDL flow with typed table-name confirmation';
  end if;

  -- Block SELECT-only statements so the agent uses the read tool instead.
  if trimmed ~* '^select\s' then
    raise exception 'use agent_exec_sql_readonly for SELECT';
  end if;

  set local statement_timeout = '30s';
  set local lock_timeout = '5s';
  set local idle_in_transaction_session_timeout = '60s';

  execute trimmed;
  get diagnostics affected = row_count;

  return jsonb_build_object(
    'affected_rows', affected,
    'expected_change', expected_change
  );
end;
$func$;

comment on function public.agent_exec_sql_write(text, text) is
  'Owner-agent write path. INSERT/UPDATE/DELETE only. 30s statement timeout. DDL rejected. service_role EXECUTE only.';

-- ═══════════════════════════════════════════════════════════════════════════
-- Privilege gating
-- ═══════════════════════════════════════════════════════════════════════════

revoke all on function public.agent_exec_sql_readonly(text) from public;
revoke all on function public.agent_exec_sql_readonly(text) from anon;
revoke all on function public.agent_exec_sql_readonly(text) from authenticated;
grant execute on function public.agent_exec_sql_readonly(text) to service_role;

revoke all on function public.agent_exec_sql_write(text, text) from public;
revoke all on function public.agent_exec_sql_write(text, text) from anon;
revoke all on function public.agent_exec_sql_write(text, text) from authenticated;
grant execute on function public.agent_exec_sql_write(text, text) to service_role;

-- ═══════════════════════════════════════════════════════════════════════════
-- Smoke tests (paste in Supabase SQL editor or psql after applying)
-- ═══════════════════════════════════════════════════════════════════════════
-- These are not executed by the migration — they require a live DB and are
-- mutation-adjacent (test 3 calls UPDATE, even if no-op).
--
-- -- 1. Valid SELECT → returns rows
-- select public.agent_exec_sql_readonly('select id, role from public.profiles limit 3');
--   -- expect: { rows: [...], columns: ["id","role"], rowCount: <=3 }
--
-- -- 2. SELECT-disguised UPDATE → rejected
-- -- (a) UPDATE passed to read fn → first-token check rejects.
-- select public.agent_exec_sql_readonly('update public.profiles set role = role where false');
--   -- expect: ERROR  only SELECT/WITH allowed (got: update public.profiles ...)
-- -- (b) CTE-disguised mutation → embedded-keyword check rejects.
-- select public.agent_exec_sql_readonly(
--   'with u as (update public.profiles set role = role where false returning id) select * from u'
-- );
--   -- expect: ERROR  forbidden keyword detected in read-only statement
--
-- -- 3. Valid no-op UPDATE on nonexistent id → 0 rows, no error
-- select public.agent_exec_sql_write(
--   'update public.profiles set role = role where id = ''00000000-0000-0000-0000-000000000000''',
--   'no-op probe: update never matches'
-- );
--   -- expect: { "affected_rows": 0, "expected_change": "no-op probe..." }
--
-- -- 4. DROP attempt via write fn → rejected
-- select public.agent_exec_sql_write('drop table public.profiles', 'malicious test');
--   -- expect: ERROR  DDL not allowed here — escalate to the DDL flow ...
