// supabase_query_read + supabase_query_write
//
// Execution path: calls the Postgres functions defined in migration
// 0046_agent_sql_exec_functions.sql:
//   - agent_exec_sql_readonly(query_sql text) → jsonb {rows, columns, rowCount}
//   - agent_exec_sql_write(query_sql text, expected_change text) → jsonb {affected_rows, expected_change}
//
// Both functions are SECURITY DEFINER, EXECUTE granted to service_role only,
// and enforce SELECT-only / DML-only constraints at the database layer (with
// statement_timeout guardrails). The JS validation here is the first defence;
// the DB function is the authoritative gate.

import { getAdminClient } from '../../supabase-admin.js';
import { isReadOnly, isDDL, extractDDLTarget, extractWriteTarget } from '../sql-validate.js';
import { RISK } from '../risk.js';

// Invoke the server-side Postgres functions defined in
// supabase/migrations/0046_agent_sql_exec_functions.sql. If the migration
// hasn't been applied yet, RPC returns a "function does not exist" error and
// we surface the install hint.
async function rpcReadOnly(admin, sql) {
  const { data, error } = await admin.rpc('agent_exec_sql_readonly', { query_sql: sql });
  return { data, error };
}

async function rpcWrite(admin, sql, expectedChange) {
  const { data, error } = await admin.rpc('agent_exec_sql_write', {
    query_sql: sql,
    expected_change: expectedChange,
  });
  return { data, error };
}

export const supabase_query_read = {
  name: 'supabase_query_read',
  description:
    'Run a read-only SELECT query against the Supabase Postgres database. Returns rows + columns + rowCount. ' +
    'Mutations (INSERT/UPDATE/DELETE/DDL) are rejected — use supabase_query_write for those.',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      sql: { type: 'string', description: 'A read-only SQL SELECT statement.' },
      limit: { type: 'integer', description: 'Optional row limit applied to the result (default 200).' },
    },
    required: ['sql'],
  },
  async execute({ sql, limit = 200 }) {
    if (!sql || typeof sql !== 'string') {
      return { error: 'sql parameter required (string)' };
    }
    if (!isReadOnly(sql)) {
      return {
        error: 'rejected: query is not read-only. INSERT/UPDATE/DELETE/DDL must go through supabase_query_write.',
      };
    }
    const admin = getAdminClient();
    const { data, error } = await rpcReadOnly(admin, sql);
    if (!error) {
      const rows = Array.isArray(data?.rows) ? data.rows.slice(0, limit) : Array.isArray(data) ? data.slice(0, limit) : [];
      const columns = data?.columns ?? (rows[0] ? Object.keys(rows[0]) : []);
      return {
        rows,
        columns,
        rowCount: rows.length,
        summary: `Read ${rows.length} row(s) via agent_exec_sql_readonly.`,
      };
    }
    // RPC not available — surface what we tried and what to do.
    return {
      error: `Could not execute arbitrary SQL: ${error.message}. ` +
        'To enable, apply supabase/migrations/0046_agent_sql_exec_functions.sql ' +
        '(creates agent_exec_sql_readonly(query_sql text)).',
      sql_attempted: sql.slice(0, 200),
    };
  },
};

export const supabase_query_write = {
  name: 'supabase_query_write',
  description:
    'Run a mutating SQL statement (INSERT/UPDATE/DELETE). Requires explicit user confirmation. ' +
    'DDL (CREATE/DROP/ALTER) is CRITICAL — requires typed table name match. The expected_change parameter is ' +
    'a one-line plain-English description used as the confirmation prompt.',
  risk: RISK.HIGH,
  approval: 'high',
  input_schema: {
    type: 'object',
    properties: {
      sql: { type: 'string', description: 'INSERT/UPDATE/DELETE/DDL statement.' },
      expected_change: {
        type: 'string',
        description:
          'One-line plain English description of what this mutation will do. Surfaced to the user as the confirmation prompt.',
      },
    },
    required: ['sql', 'expected_change'],
  },
  // Note: risk escalation happens in the tool-use orchestrator. For DDL,
  // the orchestrator calls hasCriticalApproval with the extracted table name.
  isCritical({ sql }) {
    return isDDL(sql);
  },
  criticalToken({ sql }) {
    return extractDDLTarget(sql);
  },
  async execute({ sql, expected_change }) {
    if (!sql || typeof sql !== 'string') {
      return { error: 'sql parameter required (string)' };
    }
    if (!expected_change || typeof expected_change !== 'string') {
      return { error: 'expected_change parameter required (string)' };
    }
    if (isReadOnly(sql)) {
      return {
        error:
          'rejected: this is a read-only query. Use supabase_query_read for SELECT.',
      };
    }
    const admin = getAdminClient();
    const { data, error } = await rpcWrite(admin, sql, expected_change);
    if (!error) {
      const affected = data?.affected_rows ?? data?.rowCount ?? null;
      return {
        affected_rows: affected,
        summary: `${expected_change}${affected != null ? ` (${affected} row(s) affected)` : ''}.`,
        target_table: extractWriteTarget(sql) ?? extractDDLTarget(sql),
      };
    }
    return {
      error: `Could not execute write: ${error.message}. ` +
        'To enable, apply supabase/migrations/0046_agent_sql_exec_functions.sql ' +
        '(creates agent_exec_sql_write(query_sql text, expected_change text)).',
      sql_attempted: sql.slice(0, 200),
      expected_change,
    };
  },
};
