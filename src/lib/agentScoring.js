// Pure scoring + routing module for /standard v3 intake agent.
//
// No React. No Node-only APIs. No Supabase imports. Bundles cleanly into both
// Vite client builds (for type-aware UI mapping if ever needed) and Netlify
// function bundles (for runtime use in diagnose.js).
//
// The backend is the source of truth for state, slots, and lead_score. The
// agent emits per-turn deltas in its META JSON; this module owns the math.
//
// Reference: ~/Documents/PKFIT/Content/standard-agent-v3-spec.md

// ─── State machine ──────────────────────────────────────────────────────

export const STATES = Object.freeze({
  ENTRY: 'entry',
  AWAITING_NAME: 'awaiting_name',
  AWAITING_AGE: 'awaiting_age',
  AWAITING_WHY: 'awaiting_why',
  AWAITING_GOAL: 'awaiting_goal',
  AWAITING_EXPERIENCE: 'awaiting_experience',
  AWAITING_OCCUPATION: 'awaiting_occupation',
  DIAGNOSTIC_LANDING: 'diagnostic_landing',
  AWAITING_PERMISSION: 'awaiting_permission',
  PRICE_PIVOT_DELIVERED: 'price_pivot_delivered',
  AWAITING_INVESTMENT_READY: 'awaiting_investment_ready',
  AWAITING_FIT_CHECK: 'awaiting_fit_check',
  EMAIL_CAPTURE: 'email_capture',
  // Terminals
  BOOKING_HANDOFF_PERCY: 'booking_handoff_percy',
  NURTURE_EXIT: 'nurture_exit',
  AXIOM_HANDOFF: 'axiom_handoff',
  ATHLETE_QUALIFIER: 'athlete_qualifier',
  QUALIFIER_ROUTE: 'qualifier_route',
  // Side-channel terminals
  MEDICAL_REFERRAL: 'medical_referral',
  PERCY_REQUEST: 'percy_request',
  HOSTILE_EXIT: 'hostile_exit',
});

export const TERMINAL_STATES = new Set([
  STATES.BOOKING_HANDOFF_PERCY,
  STATES.NURTURE_EXIT,
  STATES.AXIOM_HANDOFF,
  STATES.ATHLETE_QUALIFIER,
  STATES.QUALIFIER_ROUTE,
  STATES.MEDICAL_REFERRAL,
  STATES.PERCY_REQUEST,
  STATES.HOSTILE_EXIT,
]);

// Side-channel terminals can be reached from any non-terminal state. Listed
// separately so validateTransition allows them without enumeration.
const SIDE_CHANNEL_TERMINALS = new Set([
  STATES.MEDICAL_REFERRAL,
  STATES.PERCY_REQUEST,
  STATES.HOSTILE_EXIT,
]);

// Legal forward transitions. Backward transitions are not allowed — the agent
// drives the conversation forward; if it gets confused mid-state, it stays in
// place rather than reverting.
const LEGAL_TRANSITIONS = Object.freeze({
  [STATES.ENTRY]: new Set([STATES.AWAITING_NAME]),
  [STATES.AWAITING_NAME]: new Set([STATES.AWAITING_AGE]),
  [STATES.AWAITING_AGE]: new Set([STATES.AWAITING_WHY]),
  [STATES.AWAITING_WHY]: new Set([
    STATES.AWAITING_GOAL,        // Branch A: real friction
    STATES.NURTURE_EXIT,         // Branch B: curious
    STATES.AXIOM_HANDOFF,        // Lane B: operator
    STATES.ATHLETE_QUALIFIER,    // Lane C: athlete
  ]),
  [STATES.AWAITING_GOAL]: new Set([STATES.AWAITING_EXPERIENCE]),
  [STATES.AWAITING_EXPERIENCE]: new Set([STATES.AWAITING_OCCUPATION]),
  [STATES.AWAITING_OCCUPATION]: new Set([STATES.DIAGNOSTIC_LANDING]),
  [STATES.DIAGNOSTIC_LANDING]: new Set([STATES.AWAITING_PERMISSION]),
  [STATES.AWAITING_PERMISSION]: new Set([
    STATES.PRICE_PIVOT_DELIVERED,  // visitor signaled wanting more
    STATES.NURTURE_EXIT,           // visitor went quiet / reflective
  ]),
  [STATES.PRICE_PIVOT_DELIVERED]: new Set([STATES.AWAITING_INVESTMENT_READY]),
  [STATES.AWAITING_INVESTMENT_READY]: new Set([
    STATES.AWAITING_FIT_CHECK,   // YES
    STATES.NURTURE_EXIT,          // NO, dignified exit
  ]),
  [STATES.AWAITING_FIT_CHECK]: new Set([
    STATES.EMAIL_CAPTURE,         // YES
    STATES.QUALIFIER_ROUTE,       // NO immediate but still wants qualifier
    STATES.NURTURE_EXIT,          // NO and not wanting qualifier
  ]),
  [STATES.EMAIL_CAPTURE]: new Set([STATES.BOOKING_HANDOFF_PERCY]),
});

/**
 * Validate a proposed state transition.
 *
 * Side-channel terminals (medical, percy_request, hostile_exit) are allowed
 * from any non-terminal state. Self-transitions (stay in same state) are
 * always legal — the agent may need an extra turn in a state before
 * advancing.
 *
 * @param {string} fromState
 * @param {string} toState
 * @returns {boolean}
 */
export function validateTransition(fromState, toState) {
  if (!fromState || !toState) return false;
  if (fromState === toState) return true;
  if (TERMINAL_STATES.has(fromState)) return false; // terminal is sticky
  if (SIDE_CHANNEL_TERMINALS.has(toState)) return true;
  const allowed = LEGAL_TRANSITIONS[fromState];
  return Boolean(allowed && allowed.has(toState));
}

// ─── Lead scoring ───────────────────────────────────────────────────────

// Per-signal deltas. The agent emits one or more signal names per turn in its
// META JSON; the backend looks them up here. Single source of truth for the
// scoring rubric documented in the v3 spec.
export const SCORE_SIGNALS = Object.freeze({
  // Positive
  clear_goal:                +2,
  consistency_problem:       +2,
  has_tried_before:          +1,
  coaching_interest:         +3,
  ready_this_month:          +2,
  accepts_price:             +3,
  detailed_answer:           +1,
  identity_relationship:     +2,

  // Negative
  free_info_only:            -3,
  cannot_afford:             -5,
  hostile:                   -5,
  wants_guarantee:           -4,
  refuses_structure:         -4,
  vague_repeated:            -2,
});

// Clamp range — defensive bound so a hallucinated delta can't blow up the
// running score. Real possible range is roughly [-23, +16] across a full
// conversation; ±50 leaves wide latitude without runaway.
const SCORE_MIN = -50;
const SCORE_MAX = 50;

/**
 * Apply a signed delta to a running score, clamped to safe bounds.
 *
 * @param {number} current  Running score (defaults to 0 if not a number).
 * @param {number} delta    Signed integer delta (defaults to 0 if not a number).
 * @returns {number}        New running score, clamped to [SCORE_MIN, SCORE_MAX].
 */
export function applyScoreDelta(current, delta) {
  const c = Number.isFinite(current) ? current : 0;
  const d = Number.isFinite(delta) ? delta : 0;
  const next = c + d;
  if (next < SCORE_MIN) return SCORE_MIN;
  if (next > SCORE_MAX) return SCORE_MAX;
  return next;
}

/**
 * Sum the score deltas implied by a list of signal names.
 *
 * @param {string[]} signals
 * @returns {number} The summed delta (may be negative).
 */
export function deltaForSignals(signals) {
  if (!Array.isArray(signals)) return 0;
  let total = 0;
  for (const s of signals) {
    const d = SCORE_SIGNALS[s];
    if (Number.isFinite(d)) total += d;
  }
  return total;
}

// ─── Route status computation ───────────────────────────────────────────

/**
 * Compute the route_status for a session given current inputs.
 *
 * Pure function. Routing is conversation-state-primary (reaching the right
 * terminal state) with the score as a confirming filter. Side-channel
 * terminals always win.
 *
 * @param {Object} args
 * @param {string} args.state       Current state (post-transition).
 * @param {number} args.score       Running lead score.
 * @param {Object} args.slots       Current slot store.
 * @returns {string}                One of: pending | qualified | nurture |
 *                                  disqualified | human_handoff |
 *                                  medical_referral
 */
export function computeRouteStatus({ state, score = 0, slots = {} }) {
  // Side-channel terminals take precedence over score.
  if (state === STATES.MEDICAL_REFERRAL) return 'medical_referral';
  if (state === STATES.PERCY_REQUEST) return 'human_handoff';
  if (state === STATES.HOSTILE_EXIT) return 'disqualified';

  // Booking handoff is the qualified terminal — but only if the path through
  // demonstrates real fit (coaching_interest + price_readiness slots set).
  if (state === STATES.BOOKING_HANDOFF_PERCY) {
    if (slots.coaching_interest === true && slots.price_readiness === true) {
      return 'qualified';
    }
    // Edge: reached booking_handoff without confirming both slots — route as
    // human_handoff so Percy can sort it out manually rather than treating
    // as fully qualified.
    return 'human_handoff';
  }

  // Other terminal states map cleanly.
  if (state === STATES.NURTURE_EXIT) return 'nurture';
  if (state === STATES.AXIOM_HANDOFF) return 'human_handoff';
  if (state === STATES.ATHLETE_QUALIFIER) return 'nurture'; // qualifier path is its own nurture
  if (state === STATES.QUALIFIER_ROUTE) return 'nurture';

  // Non-terminal states: score-informed but still "pending" overall.
  // Hostile-but-not-yet-terminal: collapse to disqualified preemptively only
  // when the score is unrecoverable.
  if (score <= -10) return 'disqualified';

  return 'pending';
}

// ─── Lead fields derivation ─────────────────────────────────────────────

/**
 * Build the lead_fields blob for downstream consumption (CRM, Percy's
 * dashboard, ManyChat handoff). Pure projection of a session row.
 *
 * @param {Object} session  A diagnose_sessions row (or subset thereof).
 * @returns {Object}        Lead fields ready to persist to lead_fields jsonb.
 */
export function deriveLeadFields(session = {}) {
  const slots = session.slots ?? {};
  const messages = Array.isArray(session.messages) ? session.messages : [];
  const lastAgent = [...messages]
    .reverse()
    .find((m) => m && m.role === 'assistant' && typeof m.content === 'string');

  const route = session.route_status ?? 'pending';
  const next = nextRecommendedAction(route);

  return {
    instagram_username:      session.subscriber_id ?? null,
    trigger_keyword:         session.keyword ?? null,
    source_context:          session.referrer ?? null,
    current_goal:            slots.goal ?? null,
    main_struggle:           slots.main_struggle ?? null,
    previous_attempts:       slots.previous_attempts ?? null,
    failure_pattern:         slots.failure_pattern ?? null,
    coaching_interest:       slots.coaching_interest ?? null,
    timeline:                slots.timeline ?? null,
    price_readiness:         slots.price_readiness ?? null,
    lead_score:              session.lead_score ?? 0,
    route_status:            route,
    last_agent_message:      lastAgent?.content ?? null,
    next_recommended_action: next,
  };
}

function nextRecommendedAction(routeStatus) {
  switch (routeStatus) {
    case 'qualified':         return 'book_with_percy';
    case 'human_handoff':     return 'notify_percy';
    case 'nurture':           return 'send_workbook';
    case 'disqualified':      return 'clean_exit';
    case 'medical_referral':  return 'no_action_refer_out';
    default:                  return 'continue_conversation';
  }
}
