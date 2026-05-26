import { createHash } from 'node:crypto';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getAnthropic, loadPrompt } from './_shared/anthropic.js';
import {
  agentToolDefinitions,
  AGENT_TOOL_NAMES,
  handleToolUse,
} from '../../src/lib/agentTools.js';
import {
  STATES,
  TERMINAL_STATES,
  applyScoreDelta,
  computeRouteStatus,
  deltaForSignals,
  deriveLeadFields,
  validateTransition,
} from '../../src/lib/agentScoring.js';

// Public-facing AI intake. No auth. The keyword routes a visitor from
// ManyChat (or any link) into a Claude-driven conversation with PKFIT.
//
// Body shape:
//   { session_id: uuid, key: 'standard'|'structure'|..., message: string,
//     referrer?: string, subscriber_id?: string }
//
// Server is the source of truth for the transcript. The client tracks
// messages locally for render, but every turn re-fetches the persisted
// transcript and writes back. That keeps a hostile client from injecting
// fabricated "assistant" turns into the context.
//
// Tool use: Claude can call one of four UI tools per turn:
//   offer_workbook | offer_qualifier | offer_consultation | generate_micro_plan
// Tool calls are pure UI side effects — no information flows back to the
// model. We inject synthetic tool_result blocks on subsequent turns to keep
// the API happy. capture_lead is server-side only (not exposed to Claude):
// any tool call updates diagnose_sessions.tools_invoked and the relevant
// click/request flag.

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const ALLOWED_KEYS = new Set(['standard', 'structure', 'system', 'protocol', 'align']);

// Sonnet 4.6 with tool use enabled. Sonnet's tool-call structured output is
// dependable for the small input schemas we use here; Opus is overkill.
const MODEL = 'claude-sonnet-4-6';
// 2000 leaves room for generate_micro_plan's structured input (7 days × 2
// short fields each) plus a 5-line Percy-voice text reply. The previous
// 600-token cap was tight even before tools.
const MAX_TOKENS = 2000;
const TEMPERATURE = 0.4;

const MAX_USER_MESSAGE_CHARS = 2000;
const MAX_MESSAGES_PER_SESSION = 40;

const IP_BURST_MAX = 30;
const IP_BURST_WINDOW_SEC = 600;
const IP_DAILY_MAX = 200;
const IP_DAILY_WINDOW_SEC = 86_400;

const META_RE = /<!--META:(\{[^]*?\})-->\s*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Tool definitions + dispatcher live in src/lib/agentTools.js so other Claude
// surfaces (the audit app, future keyword pages) can share them. The diagnose
// surface routes 'standard' and its siblings — each maps to source_surface=
// keyword on consultation_requests when the user submits the form.

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function getClientIp(req) {
  const headers = req.headers;
  return (
    headers.get('x-nf-client-connection-ip') ||
    headers.get('cf-connecting-ip') ||
    (headers.get('x-forwarded-for') || '').split(',')[0].trim() ||
    'unknown'
  );
}

function hashIp(ip) {
  const salt = process.env.IP_HASH_SALT || 'pkfit-diagnose-v1';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

async function checkPublicRateLimit({ key, bucket, max, windowSec }) {
  const admin = getAdminClient();
  const now = Date.now();
  const { data: existing } = await admin
    .from('public_rate_limits')
    .select('window_start,count')
    .eq('key', key)
    .eq('bucket', bucket)
    .maybeSingle();

  const windowStart = existing ? new Date(existing.window_start).getTime() : now;
  const withinWindow = now - windowStart < windowSec * 1000;

  if (!existing || !withinWindow) {
    await admin
      .from('public_rate_limits')
      .upsert(
        { key, bucket, window_start: new Date().toISOString(), count: 1 },
        { onConflict: 'key,bucket' },
      );
    return { allowed: true };
  }
  if (existing.count >= max) {
    const retryAfterSec = Math.ceil((windowStart + windowSec * 1000 - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  await admin
    .from('public_rate_limits')
    .update({ count: existing.count + 1 })
    .eq('key', key)
    .eq('bucket', bucket);
  return { allowed: true };
}

// Allow-list of slot keys the model can populate via slot_updates. Unknown
// keys are silently dropped to defend against hallucinated slot names.
const KNOWN_SLOT_KEYS = new Set([
  'name', 'age', 'why_typed', 'lane',
  'goal', 'experience', 'occupation',
  'main_struggle', 'failure_pattern', 'previous_attempts',
  'coaching_interest', 'price_readiness', 'timeline',
  'brass_line_delivered', 'permission_given',
]);

function sanitizeSlotUpdates(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const clean = {};
  let any = false;
  for (const [k, v] of Object.entries(raw)) {
    if (!KNOWN_SLOT_KEYS.has(k)) continue;
    clean[k] = v;
    any = true;
  }
  return any ? clean : null;
}

// v3 META JSON shape:
//   {
//     level: 1-5,                          (legacy, derived from state)
//     tag:   "intent_N_label",             (legacy display)
//     state_to: "awaiting_age",            (state transition the model proposes)
//     slot_updates: { name: "Marcus" },    (slot writes for this turn)
//     score_signals: ["detailed_answer"]   (named signals → backend maps to deltas)
//   }
// All v3 fields are optional. v2 prompt output continues to parse cleanly
// (just no state/slot/score updates), so legacy sessions don't break mid-flight.
function parseMeta(text) {
  if (!text) return { reply: '', meta: null };
  const m = text.match(META_RE);
  if (!m) return { reply: text.trim(), meta: null };
  let meta = null;
  try {
    const parsed = JSON.parse(m[1]);
    const level = Number(parsed.level);
    meta = {};
    if (Number.isInteger(level) && level >= 1 && level <= 5) {
      meta.level = level;
      meta.tag = typeof parsed.tag === 'string' ? parsed.tag : null;
    }
    if (typeof parsed.state_to === 'string') {
      meta.state_to = parsed.state_to;
    }
    const slotUpdates = sanitizeSlotUpdates(parsed.slot_updates);
    if (slotUpdates) meta.slot_updates = slotUpdates;
    if (Array.isArray(parsed.score_signals)) {
      meta.score_signals = parsed.score_signals.filter((s) => typeof s === 'string');
    }
  } catch {
    // ignore parse errors; reply still gets returned without meta
  }
  const reply = text.slice(0, m.index).trim();
  return { reply, meta };
}

// Render the per-turn session context that prefixes the static system prompt.
// The backend owns the source of truth for state/slots/score, so we inject
// them explicitly each turn rather than relying on the model to remember.
function renderSessionContext({ state, slots, leadScore, turnIndex }) {
  const slotEntries = Object.entries(slots || {})
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)}`)
    .join('\n');
  const slotsBlock = slotEntries ? `\n${slotEntries}` : ' {}';

  return `SESSION CONTEXT (turn ${turnIndex})
Current state: ${state}
Slots captured so far:${slotsBlock}
Running lead score: ${leadScore}

Your job this turn: read the visitor's latest message, follow the per-state
instructions below for state "${state}", and end your META JSON with a
state_to transition, slot_updates (for any new slot values), and
score_signals (named signals — see SIGNALS section). If you are uncertain
about the state, stay in it (state_to equal to current state is valid).`;
}

function buildSystemPrompt(key, sessionCtx) {
  const base = loadPrompt('diagnose.md');
  const ctx = renderSessionContext(sessionCtx);
  return [
    ctx,
    '',
    base
      .replaceAll('{{KEYWORD}}', key)
      .replaceAll('{{KEYWORD_UPPER}}', key.toUpperCase()),
  ].join('\n');
}

// Reconstruct API-shaped messages from persisted transcript. Persisted shape:
//   { role: 'user'|'assistant', content: string, tool_calls?: [...], ... }
// If the previous assistant turn included tool_use blocks, the next user
// turn must include matching tool_result blocks or the API 400s. We synthesize
// generic "card rendered" results since these tools are pure UI side effects.
function rebuildApiMessages(transcript, newUserMessage) {
  const apiMessages = [];
  let pendingToolResults = null;

  for (const m of transcript) {
    if (m.role === 'user') {
      const text = typeof m.content === 'string' ? m.content : '';
      if (pendingToolResults) {
        apiMessages.push({
          role: 'user',
          content: [...pendingToolResults, { type: 'text', text }],
        });
        pendingToolResults = null;
      } else {
        apiMessages.push({ role: 'user', content: text });
      }
    } else if (m.role === 'assistant') {
      const blocks = [];
      const text = typeof m.content === 'string' ? m.content : '';
      if (text) blocks.push({ type: 'text', text });
      const toolCalls = Array.isArray(m.tool_calls) ? m.tool_calls : [];
      for (const tc of toolCalls) {
        blocks.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.name,
          input: tc.input ?? {},
        });
      }
      apiMessages.push({
        role: 'assistant',
        content: blocks.length ? blocks : text,
      });
      if (toolCalls.length) {
        pendingToolResults = toolCalls.map((tc) => ({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: 'Card rendered to user.',
        }));
      } else {
        pendingToolResults = null;
      }
    }
  }

  if (pendingToolResults) {
    apiMessages.push({
      role: 'user',
      content: [...pendingToolResults, { type: 'text', text: newUserMessage }],
    });
  } else {
    apiMessages.push({ role: 'user', content: newUserMessage });
  }
  return apiMessages;
}

// Server-side lead capture. NEVER exposed as a tool to Claude — fires
// automatically whenever any client-facing tool fires. Updates the session
// row's funnel columns and appends to tools_invoked.
function buildLeadCaptureUpdate({ existingToolsInvoked, toolCalls, prevFlags }) {
  if (!toolCalls.length) return null;
  const now = new Date().toISOString();
  const tools_invoked = [
    ...(Array.isArray(existingToolsInvoked) ? existingToolsInvoked : []),
    ...toolCalls.map((tc) => ({ name: tc.name, at: now })),
  ];
  const update = { tools_invoked };
  for (const tc of toolCalls) {
    if (tc.name === 'offer_qualifier' && !prevFlags.qualifier_clicked) {
      // Qualifier was offered (not yet clicked — click tracked elsewhere if we
      // ever wire it). Leaving the click flag for an actual outbound click.
    }
    if (tc.name === 'offer_consultation') {
      // Surfacing the form ≠ submitting it. The consultation-request function
      // sets consultation_requested=true on actual submission.
    }
  }
  return update;
}

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }
  if (req.method !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON body' });
  }

  const sessionId = typeof body.session_id === 'string' ? body.session_id : null;
  const key = typeof body.key === 'string' ? body.key.toLowerCase() : 'standard';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null;
  const subscriberId =
    typeof body.subscriber_id === 'string' ? body.subscriber_id.slice(0, 100) : null;
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 500);

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return json(400, { error: 'invalid session_id' });
  }
  if (!ALLOWED_KEYS.has(key)) {
    return json(400, { error: 'invalid key' });
  }
  if (!message) {
    return json(400, { error: 'message required' });
  }
  if (message.length > MAX_USER_MESSAGE_CHARS) {
    return json(400, { error: `message too long (max ${MAX_USER_MESSAGE_CHARS} chars)` });
  }

  const ip = getClientIp(req);
  const ipKey = hashIp(ip);

  const burst = await checkPublicRateLimit({
    key: ipKey,
    bucket: 'diagnose_burst',
    max: IP_BURST_MAX,
    windowSec: IP_BURST_WINDOW_SEC,
  });
  if (!burst.allowed) {
    return json(
      429,
      { error: 'rate limited' },
      { 'Retry-After': String(burst.retryAfterSec ?? 60) },
    );
  }
  const daily = await checkPublicRateLimit({
    key: ipKey,
    bucket: 'diagnose_daily',
    max: IP_DAILY_MAX,
    windowSec: IP_DAILY_WINDOW_SEC,
  });
  if (!daily.allowed) {
    return json(
      429,
      { error: 'daily limit reached' },
      { 'Retry-After': String(daily.retryAfterSec ?? 3600) },
    );
  }

  const admin = getAdminClient();

  const { data: existing } = await admin
    .from('diagnose_sessions')
    .select(
      'id, keyword, messages, intent_level, tools_invoked, qualifier_clicked, gumroad_clicked, consultation_requested, state, slots, lead_score, route_status, lead_fields, referrer, subscriber_id',
    )
    .eq('id', sessionId)
    .maybeSingle();

  let messages = [];
  let sessionKeyword = key;
  let existingToolsInvoked = [];
  let prevFlags = {
    qualifier_clicked: false,
    gumroad_clicked: false,
    consultation_requested: false,
  };
  // v3 state machine fields. Defaults match the migration defaults.
  let sessionState = STATES.ENTRY;
  let sessionSlots = {};
  let sessionScore = 0;
  let sessionRouteStatus = 'pending';
  let sessionRowForLeadFields = null;

  if (existing) {
    messages = Array.isArray(existing.messages) ? existing.messages : [];
    sessionKeyword = existing.keyword || key;
    existingToolsInvoked = Array.isArray(existing.tools_invoked) ? existing.tools_invoked : [];
    prevFlags = {
      qualifier_clicked: Boolean(existing.qualifier_clicked),
      gumroad_clicked: Boolean(existing.gumroad_clicked),
      consultation_requested: Boolean(existing.consultation_requested),
    };
    if (typeof existing.state === 'string' && existing.state) {
      sessionState = existing.state;
    }
    if (existing.slots && typeof existing.slots === 'object') {
      sessionSlots = { ...existing.slots };
    }
    if (Number.isFinite(existing.lead_score)) {
      sessionScore = existing.lead_score;
    }
    if (typeof existing.route_status === 'string') {
      sessionRouteStatus = existing.route_status;
    }
    sessionRowForLeadFields = existing;
    if (messages.length >= MAX_MESSAGES_PER_SESSION) {
      return json(429, { error: 'session length limit reached' });
    }
  } else {
    const { error: insertErr } = await admin.from('diagnose_sessions').insert({
      id: sessionId,
      keyword: key,
      referrer,
      subscriber_id: subscriberId,
      ip_hash: ipKey,
      user_agent: userAgent,
      messages: [],
      // state, slots, lead_score, route_status, lead_fields use column defaults
    });
    if (insertErr) {
      const { data: refetched } = await admin
        .from('diagnose_sessions')
        .select('keyword, messages, tools_invoked, state, slots, lead_score, route_status, referrer, subscriber_id')
        .eq('id', sessionId)
        .maybeSingle();
      if (!refetched) {
        return json(500, { error: 'session create failed' });
      }
      messages = Array.isArray(refetched.messages) ? refetched.messages : [];
      sessionKeyword = refetched.keyword || key;
      existingToolsInvoked = Array.isArray(refetched.tools_invoked)
        ? refetched.tools_invoked
        : [];
      if (typeof refetched.state === 'string' && refetched.state) sessionState = refetched.state;
      if (refetched.slots && typeof refetched.slots === 'object') sessionSlots = { ...refetched.slots };
      if (Number.isFinite(refetched.lead_score)) sessionScore = refetched.lead_score;
      if (typeof refetched.route_status === 'string') sessionRouteStatus = refetched.route_status;
      sessionRowForLeadFields = refetched;
    }
  }

  // Fresh session: the greeting card has already asked the name, so the
  // entry state's first observable user message lands the visitor in
  // awaiting_name on the server side. We advance entry → awaiting_name
  // optimistically; the model's job is to receive that first message,
  // capture the name slot, and transition to awaiting_age.
  if (sessionState === STATES.ENTRY) {
    sessionState = STATES.AWAITING_NAME;
  }

  const apiMessages = rebuildApiMessages(messages, message);

  // Turn index = number of prior assistant turns + 1. Cheap derivation from
  // the persisted transcript (avoids a separate counter column).
  const turnIndex = messages.filter((m) => m && m.role === 'assistant').length + 1;

  const anthropic = getAnthropic();
  let completion;
  try {
    completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: buildSystemPrompt(sessionKeyword, {
        state: sessionState,
        slots: sessionSlots,
        leadScore: sessionScore,
        turnIndex,
      }),
      tools: agentToolDefinitions,
      messages: apiMessages,
    });
  } catch (err) {
    return json(502, { error: 'model error', detail: err?.message || 'unknown' });
  }

  // Split the response into text + tool_use blocks. Each tool_use block goes
  // through the shared handleToolUse dispatcher so the resulting envelope
  // matches every other surface that consumes the toolkit. surface=sessionKeyword
  // tags the source for consultation_requests and any future capture sink.
  let rawText = '';
  const rawToolUses = [];
  for (const block of completion.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      rawText += block.text;
    } else if (block.type === 'tool_use' && AGENT_TOOL_NAMES.has(block.name)) {
      rawToolUses.push(block);
    }
  }

  const toolUses = [];
  for (const block of rawToolUses) {
    const envelope = await handleToolUse({
      toolName: block.name,
      toolInput: block.input ?? {},
      sessionId,
      context: { surface: sessionKeyword },
    });
    if (envelope.ok) {
      toolUses.push({
        id: block.id,
        name: envelope.name,
        kind: envelope.kind,
        input: envelope.input,
      });
    }
  }

  const { reply, meta } = parseMeta(rawText);

  if (!reply && toolUses.length === 0) {
    return json(502, { error: 'empty model reply' });
  }

  // ─── v3: apply state machine transition + slot merge + score delta ────
  // The model proposes state_to / slot_updates / score_signals in META JSON.
  // Backend is the source of truth: validate the transition, drop unknown
  // slot keys (already filtered by parseMeta), sum the score signals, and
  // recompute route_status from the final state + score + slots.

  let nextState = sessionState;
  if (meta?.state_to && meta.state_to !== sessionState) {
    if (validateTransition(sessionState, meta.state_to)) {
      nextState = meta.state_to;
    }
    // Illegal transition: stay in current state. Model gets another chance
    // next turn. We don't surface this to the visitor — the conversation
    // continues unaffected.
  }

  const nextSlots = { ...sessionSlots };
  if (meta?.slot_updates) {
    Object.assign(nextSlots, meta.slot_updates);
  }

  let nextScore = sessionScore;
  if (Array.isArray(meta?.score_signals) && meta.score_signals.length) {
    const delta = deltaForSignals(meta.score_signals);
    nextScore = applyScoreDelta(nextScore, delta);
  }

  // Side-channel: if a tool fires that implies a route, ensure state is at
  // the right terminal. offer_consultation in a non-terminal state means
  // the model jumped ahead — promote to EMAIL_CAPTURE / BOOKING_HANDOFF.
  if (toolUses.some((t) => t.name === 'offer_consultation') && !TERMINAL_STATES.has(nextState)) {
    if (validateTransition(nextState, STATES.EMAIL_CAPTURE)) {
      nextState = STATES.EMAIL_CAPTURE;
    } else if (validateTransition(nextState, STATES.BOOKING_HANDOFF_PERCY)) {
      nextState = STATES.BOOKING_HANDOFF_PERCY;
    }
  }
  if (toolUses.some((t) => t.name === 'offer_workbook') && !TERMINAL_STATES.has(nextState)) {
    if (validateTransition(nextState, STATES.NURTURE_EXIT)) {
      nextState = STATES.NURTURE_EXIT;
    }
  }
  if (toolUses.some((t) => t.name === 'offer_qualifier') && !TERMINAL_STATES.has(nextState)) {
    if (validateTransition(nextState, STATES.QUALIFIER_ROUTE)) {
      nextState = STATES.QUALIFIER_ROUTE;
    } else if (validateTransition(nextState, STATES.ATHLETE_QUALIFIER)) {
      nextState = STATES.ATHLETE_QUALIFIER;
    }
  }

  const nextRouteStatus = computeRouteStatus({
    state: nextState,
    score: nextScore,
    slots: nextSlots,
  });

  const turnTimestamp = new Date().toISOString();
  const assistantTurn = {
    role: 'assistant',
    content: reply,
    meta,
    at: new Date().toISOString(),
    state: nextState,
    score_after_turn: nextScore,
  };
  if (toolUses.length) {
    assistantTurn.tool_calls = toolUses;
  }

  const finalMessages = [
    ...messages,
    { role: 'user', content: message, at: turnTimestamp },
    assistantTurn,
  ];

  const update = {
    messages: finalMessages,
    last_message_at: new Date().toISOString(),
    state: nextState,
    slots: nextSlots,
    lead_score: nextScore,
    route_status: nextRouteStatus,
  };
  if (meta?.level) update.intent_level = meta.level;

  const leadUpdate = buildLeadCaptureUpdate({
    existingToolsInvoked,
    toolCalls: toolUses,
    prevFlags,
  });
  if (leadUpdate) {
    Object.assign(update, leadUpdate);
  }

  // Derive lead_fields off the post-update snapshot. The deriveLeadFields
  // helper reads slots, route_status, keyword, referrer, subscriber_id, and
  // the last assistant message, so we synthesize that snapshot inline.
  update.lead_fields = deriveLeadFields({
    keyword: sessionKeyword,
    referrer: sessionRowForLeadFields?.referrer ?? referrer,
    subscriber_id: sessionRowForLeadFields?.subscriber_id ?? subscriberId,
    slots: nextSlots,
    lead_score: nextScore,
    route_status: nextRouteStatus,
    messages: finalMessages,
  });

  const { error: updateErr } = await admin
    .from('diagnose_sessions')
    .update(update)
    .eq('id', sessionId);
  if (updateErr) {
    return json(200, {
      reply,
      intent_level: meta?.level ?? null,
      tool_calls: toolUses,
      state: nextState,
      route_status: nextRouteStatus,
      warning: 'persist_failed',
    });
  }

  return json(200, {
    reply,
    intent_level: meta?.level ?? null,
    tool_calls: toolUses,
    session_id: sessionId,
    state: nextState,
    route_status: nextRouteStatus,
  });
};

// Helper exports for tests; not used at runtime.
export const __test__ = {
  parseMeta,
  hashIp,
  rebuildApiMessages,
  buildLeadCaptureUpdate,
  renderSessionContext,
  sanitizeSlotUpdates,
  KNOWN_SLOT_KEYS,
  ALLOWED_KEYS,
};
