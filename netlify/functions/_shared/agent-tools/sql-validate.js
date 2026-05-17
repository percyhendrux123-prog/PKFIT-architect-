// SQL classification for supabase_query_read vs supabase_query_write.
//
// Postgres / Supabase doesn't have a SQL parser available in pure JS, so we
// use a conservative regex pre-flight check. Anything not clearly a SELECT
// (or WITH ... SELECT) is rejected by the read path; anything that looks
// like DDL escalates the write path to CRITICAL.
//
// This is belt-and-suspenders: server-side, the read path is also executed
// via a Supabase Postgres function that runs with a READ ONLY transaction,
// so even if the regex misses something, the database refuses to mutate.

const READ_PREFIX_RE = /^\s*(with[\s\S]*?\bselect\b|select|explain\s+select|show|values)\b/i;

// Anything containing one of these strongly suggests mutation.
const MUTATION_KEYWORDS = [
  'insert',
  'update',
  'delete',
  'merge',
  'truncate',
  'copy',
  'grant',
  'revoke',
  'do\\s+',  // DO $$ ... $$ blocks
  'call\\s+',
];
const MUTATION_RE = new RegExp(`\\b(${MUTATION_KEYWORDS.join('|')})\\b`, 'i');

// DDL keywords — CRITICAL.
const DDL_KEYWORDS = [
  'create',
  'drop',
  'alter',
  'rename',
  'comment\\s+on',
  'reindex',
];
const DDL_RE = new RegExp(`\\b(${DDL_KEYWORDS.join('|')})\\s+`, 'i');

export function isReadOnly(sql) {
  if (typeof sql !== 'string' || !sql.trim()) return false;
  if (!READ_PREFIX_RE.test(sql)) return false;
  // Even SELECT can contain a SELECT INTO that creates a new table; reject.
  if (/\bselect\b[\s\S]+\binto\b\s+\w/i.test(sql)) return false;
  if (MUTATION_RE.test(sql)) return false;
  if (DDL_RE.test(sql)) return false;
  return true;
}

export function isDDL(sql) {
  if (typeof sql !== 'string') return false;
  return DDL_RE.test(sql);
}

// Best-effort extract of the target table name from a DDL statement, used
// for CRITICAL typed confirmation (the user must type the table name).
export function extractDDLTarget(sql) {
  if (typeof sql !== 'string') return null;
  const m = sql.match(/\b(create|drop|alter|rename)\s+(?:table|index|view|materialized\s+view|sequence|function|schema)?\s*(?:if\s+(?:not\s+)?exists\s+)?(?:public\.)?["']?(\w+)["']?/i);
  return m ? m[2] : null;
}

// Best-effort extract of the first target table from a write statement
// (INSERT/UPDATE/DELETE), used for the expected_change preview.
export function extractWriteTarget(sql) {
  if (typeof sql !== 'string') return null;
  const insertM = sql.match(/\binsert\s+into\s+(?:public\.)?["']?(\w+)["']?/i);
  if (insertM) return insertM[1];
  const updateM = sql.match(/\bupdate\s+(?:public\.)?["']?(\w+)["']?/i);
  if (updateM) return updateM[1];
  const deleteM = sql.match(/\bdelete\s+from\s+(?:public\.)?["']?(\w+)["']?/i);
  if (deleteM) return deleteM[1];
  return null;
}
