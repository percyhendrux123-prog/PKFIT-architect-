#!/usr/bin/env node
// Smoke test: load the v3 system prompt + render with a session context
// header. Verifies the prompt file is readable, has all per-state blocks,
// and the rendered output is structurally sane.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const promptPath = resolve(here, '..', 'netlify', 'functions', '_prompts', 'diagnose.md');
const prompt = readFileSync(promptPath, 'utf8');

let pass = 0, fail = 0;
function check(condition, label) {
  if (condition) { pass++; return; }
  fail++;
  console.error(`✗ ${label}`);
}

// Per-state blocks present
const requiredStates = [
  'awaiting_name', 'awaiting_age', 'awaiting_why',
  'awaiting_goal', 'awaiting_experience', 'awaiting_occupation',
  'diagnostic_landing', 'awaiting_permission', 'price_pivot_delivered',
  'awaiting_investment_ready', 'awaiting_fit_check', 'email_capture',
];
for (const s of requiredStates) {
  check(prompt.includes(`STATE: ${s}`), `prompt has STATE block for ${s}`);
}

// Branch detection block at awaiting_why
check(prompt.includes('BRANCH A — REAL FRICTION'), 'awaiting_why has Branch A');
check(prompt.includes('BRANCH B — CURIOUS'), 'awaiting_why has Branch B');
check(prompt.includes('BRANCH C — OPERATOR'), 'awaiting_why has Branch C');
check(prompt.includes('BRANCH D — ATHLETE'), 'awaiting_why has Branch D');

// Objection library
const objections = [
  'PRICE OBJECTION', 'TIME OBJECTION', 'MOTIVATION OBJECTION',
  'SPOUSE / IDENTITY OBJECTION', 'GUARANTEE OBJECTION', 'FREE-INFO OBJECTION',
  'HOSTILE / UNSERIOUS', 'ASKS FOR PERCY DIRECTLY',
];
for (const o of objections) {
  check(prompt.includes(o), `objection: ${o}`);
}

// Safety boundaries
check(prompt.includes('988 lifeline'), 'safety: 988 lifeline referral');
check(prompt.includes('MEDICAL / MENTAL HEALTH CRISIS'), 'safety: medical block');
check(prompt.includes('Quote any price other than $250'), 'safety: $250 lock');
check(prompt.includes('Claim to be Percy'), 'safety: no Percy impersonation');
check(prompt.includes('Percy does the coaching'), 'phrase: "Percy does the coaching"');

// Signals section has the rubric
check(prompt.includes('"clear_goal"'), 'signals: clear_goal listed');
check(prompt.includes('"coaching_interest"'), 'signals: coaching_interest listed');
check(prompt.includes('"accepts_price"'), 'signals: accepts_price listed');
check(prompt.includes('"cannot_afford"'), 'signals: cannot_afford listed');
check(prompt.includes('"hostile"'), 'signals: hostile listed');

// META JSON contract
check(prompt.includes('state_to'), 'META: state_to field documented');
check(prompt.includes('slot_updates'), 'META: slot_updates field documented');
check(prompt.includes('score_signals'), 'META: score_signals field documented');

// Banned phrase list
check(prompt.includes('let\'s go'), 'banned: "let\'s go"');
check(prompt.includes('crush it'), 'banned: "crush it"');
check(prompt.includes('limited spots'), 'banned: "limited spots"');

// Locked phrases present
check(prompt.includes('Discipline didn\'t fail. Structure did.'), 'locked: discipline phrase');
check(prompt.includes('Coaching starts at $250 a month'), 'locked: $250 line');
check(prompt.includes('I review every one of these myself'), 'locked: Percy reviews line');
check(prompt.includes('I\'m /standard. I find the breakdown. Percy does the coaching.'), 'locked: identity disclosure line');

// No banned tokens in the prompt itself (defensive check)
check(!/[\u{1F300}-\u{1FAFF}]/u.test(prompt), 'prompt has no emojis');
// HTML comment delimiters `<!--` legitimately use `!`. Strip them out, then
// check for stray exclamation marks in actual voice content.
const promptWithoutHtmlComments = prompt.replace(/<!--[\s\S]*?-->/g, '');
check(!/!/.test(promptWithoutHtmlComments), 'prompt has no exclamation points in voice content');

// Render with session context — simulate awaiting_goal mid-flow
const ctx = `SESSION CONTEXT (turn 4)
Current state: awaiting_goal
Slots captured so far:
  name: "Marcus"
  age: 34
  why_typed: "restart loop"
  lane: "identity"
Running lead score: 5

Your job this turn: read the visitor's latest message...`;
const rendered = [ctx, '', prompt].join('\n');

check(rendered.includes('SESSION CONTEXT (turn 4)'), 'render: includes session context');
check(rendered.includes('Current state: awaiting_goal'), 'render: includes current state');
check(rendered.length < 50000, `render: under 50k chars (actual ${rendered.length})`);
check(rendered.length > 5000, `render: substantive (actual ${rendered.length})`);

console.log(`\n${pass} passed, ${fail} failed.`);
console.log(`Prompt size: ${prompt.length} chars (~${Math.round(prompt.length / 4)} tokens estimate)`);
if (fail) process.exit(1);
