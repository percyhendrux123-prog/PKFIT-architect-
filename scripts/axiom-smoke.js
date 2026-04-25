#!/usr/bin/env node
// scripts/axiom-smoke.js — local dry-run for the AXIOM Overseer function.
// Imports the handler, forces DRY_RUN, prints the rendered markdown to stdout.
// Usage:  GITHUB_TOKEN=ghp_xxx node scripts/axiom-smoke.js
import { handler } from '../netlify/functions/axiom-overseer.js';

process.env.DRY_RUN = '1';

const res = await handler({}, {});
if (res.statusCode !== 200) {
  console.error('FAILED:', res.body);
  process.exit(1);
}
// In DRY_RUN, body IS the rendered markdown.
process.stdout.write(res.body);
