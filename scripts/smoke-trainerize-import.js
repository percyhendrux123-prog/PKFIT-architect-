#!/usr/bin/env node
// Standalone smoke test for the Trainerize importer. Runs the orchestrator
// against the in-memory fake Supabase and prints a human-readable report.
//
// Why a standalone script: pkfit-app does not have Vitest yet (Issue #16).
// This file lets us exercise the importer end-to-end with `node` today and
// keeps a permanent CLI hook for "is the wiring still healthy?" gut checks.
//
// Usage:
//   node scripts/smoke-trainerize-import.js
//   node scripts/smoke-trainerize-import.js --fixture=path/to/trainerize.json
//   node scripts/smoke-trainerize-import.js --runs=2     # confirm idempotency
//
// Exit codes:
//   0 — every assertion passed.
//   1 — a wiring assertion failed (read the printed reason).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { runImport } from '../netlify/functions/trainerize-import.js';
import { makeFakeAdmin } from '../tests/support/fakeSupabase.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : fallback;
}

const fixturePath = arg('fixture', join(__dirname, '..', 'tests', 'fixtures', 'trainerize-sample.json'));
const runs = Number(arg('runs', '2'));
const fixture = JSON.parse(readFileSync(fixturePath, 'utf-8'));

const admin = makeFakeAdmin();
const reports = [];

for (let i = 0; i < runs; i++) {
  const r = await runImport({
    admin,
    coachId: '00000000-0000-0000-0000-00000000c0ac',
    payload: fixture,
    dryRun: false,
  });
  reports.push(r);
}

const r1 = reports[0];
const r2 = reports[1];

let failures = 0;
function assert(label, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
  if (!ok) failures += 1;
}

console.log('─'.repeat(72));
console.log(`Smoke run — ${runs} iteration(s) of ${fixturePath}`);
console.log('─'.repeat(72));
console.log('First-run imported:', r1.imported);
console.log('First-run skipped: ', JSON.stringify(r1.skipped, null, 2));
console.log('First-run warnings:', r1.warnings);
console.log('First-run status:  ', r1.status);
console.log('First-run client:  ', r1.client_id_supabase);
console.log('');

assert('first run imported 2 programs',                 r1.imported.programs === 2);
assert('first run imported 2 workout sessions',         r1.imported.sessions === 2);
assert('first run imported 2 check-ins',                r1.imported.checkins === 2);
assert('first run imported 2 meals',                    r1.imported.meals === 2);
assert('first run imported 2 meal-adherence rows',      r1.imported.meal_adherence === 2);
assert('first run imported 1 photo',                    r1.imported.photos === 1);
assert('first run imported 3 messages',                 r1.imported.messages === 3);
assert('first run flags orphan adherence',              r1.skipped.meal_adherence.length === 1);
assert('first run status === "partial" (orphan)',       r1.status === 'partial');
assert('photo went into baseline-photos bucket',        admin._storage['baseline-photos']?.size === 1);
assert('exactly one dm_thread for the client',          admin._tables.dm_threads.length === 1);

if (r2) {
  console.log('');
  console.log('Second-run imported:', r2.imported);
  console.log('Second-run status:  ', r2.status);
  const beforeDmCount = admin._tables.dm_messages.length;
  assert('second run imports 0 programs',          r2.imported.programs === 0);
  assert('second run imports 0 sessions',          r2.imported.sessions === 0);
  assert('second run imports 0 check-ins',         r2.imported.checkins === 0);
  assert('second run imports 0 meals',             r2.imported.meals === 0);
  assert('second run imports 0 messages',          r2.imported.messages === 0);
  assert('second run does not duplicate dms',      beforeDmCount === 3);
  assert('second run does not duplicate photos',   admin._storage['baseline-photos']?.size === 1);
}

console.log('');
console.log(`Final row counts: ${admin._countAllRows()} total`);
for (const [t, rows] of Object.entries(admin._tables)) {
  if (rows.length > 0) console.log(`  ${t.padEnd(20)} ${rows.length}`);
}

console.log('─'.repeat(72));
if (failures > 0) {
  console.log(`SMOKE FAILED — ${failures} assertion(s) red`);
  process.exit(1);
}
console.log('SMOKE OK');
