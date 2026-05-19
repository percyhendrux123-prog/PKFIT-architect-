-- 0052_fix_agent_sql_exec_role_switch.sql
-- The previous migration tried SET LOCAL ROLE agent_sql_readonly inside a
-- SECURITY DEFINER function. Postgres rejects that pattern in this version:
--   "cannot set parameter \"role\" within security-definer function"
--
-- Defense-in-depth is now enforced via:
--   1. Static keyword check (regex rejects insert/update/delete/merge/truncate/
--      drop/create/alter/grant/revoke/reindex/copy)
--   2. service_role-only EXECUTE grant on the function
--   3. statement_timeout = 10s
--
-- The agent_sql_readonly role still exists from 0051 but is now unused.

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

  trimmed := regexp_replace(query_sql, '^\s+', '');
  trimmed := regexp_replace(trimmed, ';\s*$', '');

  if not (trimmed ~* '^(select|with)\s') then
    raise exception 'only SELECT/WITH allowed (got: %)', left(trimmed, 40);
  end if;

  if trimmed ~* '\m(insert|update|delete|merge|truncate|drop|create|alter|grant|revoke|reindex|copy)\M' then
    raise exception 'forbidden keyword detected in read-only statement';
  end if;

  set local statement_timeout = '10s';
  set local lock_timeout = '2s';
  set local idle_in_transaction_session_timeout = '15s';

  execute format('select coalesce(jsonb_agg(to_jsonb(_t)), ''[]''::jsonb) from (%s) _t', trimmed)
    into rows_json;

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
end;
$func$;

comment on function public.agent_exec_sql_readonly(text) is
  'Owner-agent read path. SELECT/WITH only. Defense via static keyword check + service_role gate + 10s timeout. (SET LOCAL ROLE removed: not allowed in SECURITY DEFINER.)';
