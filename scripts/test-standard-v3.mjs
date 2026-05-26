#!/usr/bin/env node
// Local end-to-end smoke test for /standard v3 state machine.
//
// No Supabase. No Anthropic. We exercise the pure layers — agentScoring,
// parseMeta, renderSessionContext, and the state-transition + score-merge
// logic from diagnose.js — against the canonical Marcus transcript and
// three edge scenarios (medical, hostile, ask-for-Percy).
//
// Run from the worktree root:
//   node scripts/test-standard-v3.mjs

import {
  STATES,
  TERMINAL_STATES,
  applyScoreDelta,
  computeRouteStatus,
  deltaForSignals,
  deriveLeadFields,
  validateTransition,
  SCORE_SIGNALS,
} from '../src/lib/agentScoring.js';

import { __test__ } from '../netlify/functions/diagnose.js';
const { parseMeta, renderSessionContext, sanitizeSlotUpdates, KNOWN_SLOT_KEYS } = __test__;

// ─── tiny assert helpers ─────────────────────────────────────────────────

let pass = 0;
let fail = 0;
const failures = [];

function eq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { pass++; return; }
  fail++;
  failures.push({ label, actual, expected });
  console.error(`✗ ${label}`);
  console.error(`  expected: ${JSON.stringify(expected)}`);
  console.error(`  actual:   ${JSON.stringify(actual)}`);
}

function ok(condition, label) {
  if (condition) { pass++; return; }
  fail++;
  failures.push({ label });
  console.error(`✗ ${label}`);
}

// ─── 1. State machine: every legal transition resolves ───────────────────

console.log('─── 1. State machine transitions ───');

ok(validateTransition(STATES.ENTRY, STATES.AWAITING_NAME), 'entry → awaiting_name');
ok(validateTransition(STATES.AWAITING_NAME, STATES.AWAITING_AGE), 'awaiting_name → awaiting_age');
ok(validateTransition(STATES.AWAITING_AGE, STATES.AWAITING_WHY), 'awaiting_age → awaiting_why');
ok(validateTransition(STATES.AWAITING_WHY, STATES.AWAITING_GOAL), 'awaiting_why → awaiting_goal (Branch A)');
ok(validateTransition(STATES.AWAITING_WHY, STATES.NURTURE_EXIT), 'awaiting_why → nurture_exit (Branch B)');
ok(validateTransition(STATES.AWAITING_WHY, STATES.AXIOM_HANDOFF), 'awaiting_why → axiom_handoff (Lane B)');
ok(validateTransition(STATES.AWAITING_WHY, STATES.ATHLETE_QUALIFIER), 'awaiting_why → athlete_qualifier (Lane C)');
ok(validateTransition(STATES.AWAITING_GOAL, STATES.AWAITING_EXPERIENCE), 'awaiting_goal → awaiting_experience');
ok(validateTransition(STATES.AWAITING_OCCUPATION, STATES.DIAGNOSTIC_LANDING), 'awaiting_occupation → diagnostic_landing');
ok(validateTransition(STATES.DIAGNOSTIC_LANDING, STATES.AWAITING_PERMISSION), 'diagnostic_landing → awaiting_permission');
ok(validateTransition(STATES.AWAITING_PERMISSION, STATES.PRICE_PIVOT_DELIVERED), 'awaiting_permission → price_pivot_delivered');
ok(validateTransition(STATES.AWAITING_PERMISSION, STATES.NURTURE_EXIT), 'awaiting_permission → nurture_exit');
ok(validateTransition(STATES.PRICE_PIVOT_DELIVERED, STATES.AWAITING_INVESTMENT_READY), 'price_pivot → awaiting_investment_ready');
ok(validateTransition(STATES.AWAITING_INVESTMENT_READY, STATES.AWAITING_FIT_CHECK), 'investment YES → fit_check');
ok(validateTransition(STATES.AWAITING_INVESTMENT_READY, STATES.NURTURE_EXIT), 'investment NO → nurture_exit');
ok(validateTransition(STATES.AWAITING_FIT_CHECK, STATES.EMAIL_CAPTURE), 'fit YES → email_capture');
ok(validateTransition(STATES.AWAITING_FIT_CHECK, STATES.QUALIFIER_ROUTE), 'fit NO → qualifier_route');
ok(validateTransition(STATES.EMAIL_CAPTURE, STATES.BOOKING_HANDOFF_PERCY), 'email_capture → booking_handoff');

// Side-channel terminals from any non-terminal state
ok(validateTransition(STATES.AWAITING_GOAL, STATES.MEDICAL_REFERRAL), 'goal → medical_referral side-channel');
ok(validateTransition(STATES.AWAITING_EXPERIENCE, STATES.PERCY_REQUEST), 'experience → percy_request side-channel');
ok(validateTransition(STATES.AWAITING_PERMISSION, STATES.HOSTILE_EXIT), 'permission → hostile_exit side-channel');

// Self-transition always allowed
ok(validateTransition(STATES.AWAITING_NAME, STATES.AWAITING_NAME), 'self-transition allowed');

// Illegal transitions blocked
ok(!validateTransition(STATES.AWAITING_NAME, STATES.AWAITING_GOAL), 'name → goal blocked (skip)');
ok(!validateTransition(STATES.AWAITING_AGE, STATES.AWAITING_NAME), 'age → name blocked (backward)');
ok(!validateTransition(STATES.NURTURE_EXIT, STATES.AWAITING_NAME), 'terminal is sticky');
ok(!validateTransition(STATES.BOOKING_HANDOFF_PERCY, STATES.AWAITING_AGE), 'terminal is sticky (booking)');

// ─── 2. Scoring math ─────────────────────────────────────────────────────

console.log('─── 2. Scoring math ───');

eq(applyScoreDelta(0, 5), 5, 'apply +5');
eq(applyScoreDelta(5, -3), 2, 'apply -3');
eq(applyScoreDelta(0, 999), 50, 'clamp positive');
eq(applyScoreDelta(0, -999), -50, 'clamp negative');
eq(applyScoreDelta(NaN, 3), 3, 'NaN current → 0');
eq(applyScoreDelta(5, NaN), 5, 'NaN delta → 0');

eq(deltaForSignals(['detailed_answer']), 1, 'detailed_answer = +1');
eq(deltaForSignals(['coaching_interest', 'detailed_answer']), 4, 'sum two positive');
eq(deltaForSignals(['cannot_afford', 'hostile']), -10, 'sum two negative');
eq(deltaForSignals(['nonexistent_signal']), 0, 'unknown signal = 0');
eq(deltaForSignals(null), 0, 'null safe');

// Verify the rubric matches the spec (sanity check on individual deltas)
eq(SCORE_SIGNALS.clear_goal, 2, 'clear_goal = +2');
eq(SCORE_SIGNALS.coaching_interest, 3, 'coaching_interest = +3');
eq(SCORE_SIGNALS.accepts_price, 3, 'accepts_price = +3');
eq(SCORE_SIGNALS.cannot_afford, -5, 'cannot_afford = -5');
eq(SCORE_SIGNALS.hostile, -5, 'hostile = -5');

// ─── 3. computeRouteStatus ───────────────────────────────────────────────

console.log('─── 3. Route status computation ───');

eq(computeRouteStatus({ state: STATES.AWAITING_NAME, score: 0 }), 'pending', 'mid-flow = pending');
eq(computeRouteStatus({ state: STATES.NURTURE_EXIT, score: 5 }), 'nurture', 'nurture_exit terminal');
eq(computeRouteStatus({
  state: STATES.BOOKING_HANDOFF_PERCY,
  score: 18,
  slots: { coaching_interest: true, price_readiness: true },
}), 'qualified', 'booking + slots → qualified');
eq(computeRouteStatus({
  state: STATES.BOOKING_HANDOFF_PERCY,
  score: 18,
  slots: {}, // slots missing
}), 'human_handoff', 'booking without slots → human_handoff fallback');
eq(computeRouteStatus({ state: STATES.MEDICAL_REFERRAL, score: 5 }), 'medical_referral', 'medical side-channel');
eq(computeRouteStatus({ state: STATES.PERCY_REQUEST, score: 5 }), 'human_handoff', 'percy_request');
eq(computeRouteStatus({ state: STATES.HOSTILE_EXIT, score: -10 }), 'disqualified', 'hostile_exit');
eq(computeRouteStatus({ state: STATES.AWAITING_GOAL, score: -12 }), 'disqualified', 'score floor disqualifies mid-flow');

// ─── 4. parseMeta — v3 expanded format ───────────────────────────────────

console.log('─── 4. parseMeta v3 format ───');

const v3Reply = `Marcus.
How old are you?
<!--META:{"level":1,"tag":"intent_1_curious","state_to":"awaiting_age","slot_updates":{"name":"Marcus"}}-->`;
const parsed = parseMeta(v3Reply);
eq(parsed.reply, 'Marcus.\nHow old are you?', 'v3 reply text extracted');
eq(parsed.meta.level, 1, 'v3 level');
eq(parsed.meta.state_to, 'awaiting_age', 'v3 state_to');
eq(parsed.meta.slot_updates, { name: 'Marcus' }, 'v3 slot_updates');

// v2 backwards compat
const v2Reply = `That's effort.
<!--META:{"level":3,"tag":"intent_3_qualified"}-->`;
const parsedV2 = parseMeta(v2Reply);
eq(parsedV2.meta.level, 3, 'v2 still parses level');
ok(!parsedV2.meta.state_to, 'v2 has no state_to (correctly absent)');

// Slot key sanitization
const dirty = sanitizeSlotUpdates({ name: 'Marcus', __proto__: 'evil', some_unknown_key: 'data' });
eq(dirty, { name: 'Marcus' }, 'sanitizeSlotUpdates strips unknown keys');

// Empty / invalid slot_updates
eq(sanitizeSlotUpdates(null), null, 'null slot updates → null');
eq(sanitizeSlotUpdates({}), null, 'empty slot updates → null');
eq(sanitizeSlotUpdates({ random: 1 }), null, 'only-unknown slot updates → null');

// ─── 5. Canonical Marcus transcript end-to-end ───────────────────────────

console.log('─── 5. Marcus transcript walkthrough ───');

// Simulate the backend loop: load session → inject context → mock model output
// → parse → apply transition + slots + score → recompute route.

function step({ priorState, priorSlots, priorScore, mockModelMeta }) {
  // Build session context for the prompt (smoke test it renders without error)
  const ctx = renderSessionContext({
    state: priorState,
    slots: priorSlots,
    leadScore: priorScore,
    turnIndex: 1,
  });
  ok(ctx.includes(`Current state: ${priorState}`), `context renders state ${priorState}`);

  // Mock model META output → apply backend logic
  const meta = mockModelMeta;

  let nextState = priorState;
  if (meta.state_to && validateTransition(priorState, meta.state_to)) {
    nextState = meta.state_to;
  }

  const nextSlots = { ...priorSlots, ...(meta.slot_updates || {}) };
  const nextScore = meta.score_signals
    ? applyScoreDelta(priorScore, deltaForSignals(meta.score_signals))
    : priorScore;
  const nextRoute = computeRouteStatus({ state: nextState, score: nextScore, slots: nextSlots });

  return { state: nextState, slots: nextSlots, score: nextScore, route: nextRoute };
}

// Turn 1: name capture
let s = step({
  priorState: STATES.AWAITING_NAME,
  priorSlots: {},
  priorScore: 0,
  mockModelMeta: {
    state_to: 'awaiting_age',
    slot_updates: { name: 'Marcus' },
  },
});
eq(s.state, 'awaiting_age', 'turn 1: → awaiting_age');
eq(s.slots, { name: 'Marcus' }, 'turn 1: name captured');
eq(s.score, 0, 'turn 1: score 0');

// Turn 2: age capture
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'awaiting_why',
    slot_updates: { age: 34 },
  },
});
eq(s.state, 'awaiting_why', 'turn 2: → awaiting_why');
eq(s.slots.age, 34, 'turn 2: age captured');

// Turn 3: WHY — Branch A real friction
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'awaiting_goal',
    slot_updates: {
      why_typed: 'restart loop, 20lbs back twice, wife mentioned drift',
      lane: 'identity',
    },
    score_signals: ['consistency_problem', 'identity_relationship', 'detailed_answer'],
  },
});
eq(s.state, 'awaiting_goal', 'turn 3: → awaiting_goal');
eq(s.slots.lane, 'identity', 'turn 3: lane locked');
eq(s.score, 5, 'turn 3: score = 2+2+1 = 5');

// Turn 4: goal
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'awaiting_experience',
    slot_updates: { goal: 'Feel like myself. Get the discipline back.' },
    score_signals: ['clear_goal', 'detailed_answer'],
  },
});
eq(s.state, 'awaiting_experience', 'turn 4: → awaiting_experience');
eq(s.score, 8, 'turn 4: score = 5+2+1 = 8');

// Turn 5: experience
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'awaiting_occupation',
    slot_updates: {
      experience: 'Whole30 twice, trainer 4mo in 2024, both broke at week 6',
      previous_attempts: ['Whole30 x2', 'personal trainer 2024'],
      failure_pattern: 'Structure collapses at week 6 with release crunch',
    },
    score_signals: ['has_tried_before', 'detailed_answer'],
  },
});
eq(s.state, 'awaiting_occupation', 'turn 5: → awaiting_occupation');
eq(s.score, 10, 'turn 5: score = 8+1+1 = 10');

// Turn 6: occupation
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'diagnostic_landing',
    slot_updates: { occupation: 'VP eng, series-B, 80 reports' },
    score_signals: ['detailed_answer'],
  },
});
eq(s.state, 'diagnostic_landing', 'turn 6: → diagnostic_landing');
eq(s.score, 11, 'turn 6: score = 10+1 = 11');

// Turn 7: brass line, no commercial pivot
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'awaiting_permission',
    slot_updates: { brass_line_delivered: true },
  },
});
eq(s.state, 'awaiting_permission', 'turn 7: → awaiting_permission');
ok(s.slots.brass_line_delivered === true, 'turn 7: brass line flag set');

// Turn 8: visitor signaled "what's next?" — permission pivot
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'price_pivot_delivered',
    slot_updates: { permission_given: true, coaching_interest: true },
    score_signals: ['coaching_interest'],
  },
});
eq(s.state, 'price_pivot_delivered', 'turn 8: → price_pivot_delivered');
eq(s.score, 14, 'turn 8: score = 11+3 = 14');

// Turn 9: investment readiness YES
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'awaiting_investment_ready',
    slot_updates: {},
  },
});
eq(s.state, 'awaiting_investment_ready', 'turn 9 ask: → awaiting_investment_ready');

s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'awaiting_fit_check',
    slot_updates: { price_readiness: true },
    score_signals: ['accepts_price'],
  },
});
eq(s.state, 'awaiting_fit_check', 'turn 9 answer: → awaiting_fit_check');
eq(s.score, 17, 'turn 9: score = 14+3 = 17');

// Turn 10: immediacy YES
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'email_capture',
    slot_updates: { timeline: 'immediate' },
    score_signals: ['ready_this_month'],
  },
});
eq(s.state, 'email_capture', 'turn 10: → email_capture');
eq(s.score, 19, 'turn 10: score = 17+2 = 19');

// Submit → booking handoff
s = step({
  priorState: s.state,
  priorSlots: s.slots,
  priorScore: s.score,
  mockModelMeta: {
    state_to: 'booking_handoff_percy',
    slot_updates: {},
  },
});
eq(s.state, 'booking_handoff_percy', 'final: → booking_handoff_percy');
eq(s.route, 'qualified', 'final: route_status = qualified');

// ─── 6. Edge: hostile mid-conversation ───────────────────────────────────

console.log('─── 6. Hostile mid-conversation ───');

s = step({
  priorState: STATES.AWAITING_WHY,
  priorSlots: { name: 'Anon', age: 28 },
  priorScore: 0,
  mockModelMeta: {
    state_to: 'hostile_exit',
    score_signals: ['hostile'],
  },
});
eq(s.state, 'hostile_exit', 'hostile: → hostile_exit');
eq(s.route, 'disqualified', 'hostile: route_status = disqualified');
eq(s.score, -5, 'hostile: score = -5');

// ─── 7. Edge: medical referral ───────────────────────────────────────────

console.log('─── 7. Medical referral side-channel ───');

s = step({
  priorState: STATES.AWAITING_EXPERIENCE,
  priorSlots: { name: 'Anon', age: 34, lane: 'identity', goal: '...' },
  priorScore: 5,
  mockModelMeta: {
    state_to: 'medical_referral',
    // Score signals intentionally absent for medical scenarios
  },
});
eq(s.state, 'medical_referral', 'medical: → medical_referral');
eq(s.route, 'medical_referral', 'medical: route_status = medical_referral');
eq(s.score, 5, 'medical: score unchanged');

// ─── 8. Edge: asks for Percy directly ────────────────────────────────────

console.log('─── 8. Ask for Percy directly ───');

s = step({
  priorState: STATES.AWAITING_WHY,
  priorSlots: { name: 'Anon', age: 34 },
  priorScore: 0,
  mockModelMeta: {
    state_to: 'percy_request',
  },
});
eq(s.state, 'percy_request', 'percy_request reached');
eq(s.route, 'human_handoff', 'percy_request: route_status = human_handoff');

// ─── 9. deriveLeadFields ──────────────────────────────────────────────────

console.log('─── 9. deriveLeadFields ───');

const lf = deriveLeadFields({
  keyword: 'standard',
  referrer: 'https://instagram.com/...',
  subscriber_id: 'mc_subscriber_123',
  slots: {
    goal: 'Get back to myself',
    main_struggle: 'restart loop',
    coaching_interest: true,
    price_readiness: true,
    timeline: 'immediate',
  },
  lead_score: 18,
  route_status: 'qualified',
  messages: [
    { role: 'user', content: 'hi' },
    { role: 'assistant', content: 'last agent line' },
  ],
});
eq(lf.trigger_keyword, 'standard', 'lead_fields: trigger_keyword');
eq(lf.instagram_username, 'mc_subscriber_123', 'lead_fields: instagram_username');
eq(lf.coaching_interest, true, 'lead_fields: coaching_interest');
eq(lf.price_readiness, true, 'lead_fields: price_readiness');
eq(lf.timeline, 'immediate', 'lead_fields: timeline');
eq(lf.lead_score, 18, 'lead_fields: lead_score');
eq(lf.route_status, 'qualified', 'lead_fields: route_status');
eq(lf.next_recommended_action, 'book_with_percy', 'lead_fields: next_recommended_action');
eq(lf.last_agent_message, 'last agent line', 'lead_fields: last_agent_message');

// ─── Summary ─────────────────────────────────────────────────────────────

console.log(`\n${pass} passed, ${fail} failed.`);
if (fail) {
  console.error('\nFAILED:');
  for (const f of failures) console.error(`  - ${f.label}`);
  process.exit(1);
}
process.exit(0);
