import { createHash } from 'node:crypto';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getAnthropic, loadPrompt } from './_shared/anthropic.js';

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

const TOOL_NAMES = new Set([
  'offer_workbook',
  'offer_qualifier',
  'offer_consultation',
  'generate_micro_plan',
]);

const TOOLS = [
  {
    name: 'offer_workbook',
    description:
      "Surface the free PKFIT diagnostic workbook (Gumroad) as a card in the chat. Call when the user has shared SPECIFIC pain AND seems unsure about coaching (level 2-3). Do not ask the user first — call the tool and the UI handles the offer.",
    input_schema: {
      type: 'object',
      properties: {
        framing: {
          type: 'string',
          description:
            'One short line in Percy voice that names the value of the workbook — no marketing speak, no URL, no exclamation points. Example: "It walks the breakdown — appetite, system, structure, standard."',
        },
      },
      required: ['framing'],
    },
  },
  {
    name: 'offer_qualifier',
    description:
      'Surface the pkfitelite.co.site qualifier as a card. Call when the user has explicitly asked about coaching, program, price, or how to start (level 4-5).',
    input_schema: {
      type: 'object',
      properties: {
        framing: {
          type: 'string',
          description:
            'One short line in Percy voice framing what happens next. Example: "I review every submission personally."',
        },
      },
      required: ['framing'],
    },
  },
  {
    name: 'offer_consultation',
    description:
      'Surface an inline form (email + preferred times) the user can submit to request a direct consultation. Call ONLY when the user is decisively ready (level 5) AND has shown specific intent (asked about start dates or said they are ready).',
    input_schema: {
      type: 'object',
      properties: {
        framing: {
          type: 'string',
          description:
            'One short line in Percy voice telling them what happens after they submit.',
        },
      },
      required: ['framing'],
    },
  },
  {
    name: 'generate_micro_plan',
    description:
      "Build and surface a structured 5-7 day starter plan as an inline card. Call at level 3-4 when the conversation has covered enough depth (2+ exchanges) that you can produce a plan SPECIFIC to the user's stated pain — not generic. The cliffhanger sets up the full system at the qualifier.",
    input_schema: {
      type: 'object',
      properties: {
        identified_pain: {
          type: 'string',
          description: 'The specific pain the user described, named back in Percy voice.',
        },
        week_goal: {
          type: 'string',
          description: 'The single standard they should be holding by end of week 1.',
        },
        days: {
          type: 'array',
          minItems: 5,
          maxItems: 7,
          items: {
            type: 'object',
            properties: {
              day: { type: 'integer', minimum: 1, maximum: 7 },
              focus: { type: 'string', description: 'The mechanism this day addresses.' },
              action: { type: 'string', description: 'The exact action they take that day.' },
            },
            required: ['day', 'focus', 'action'],
          },
        },
        cliffhanger: {
          type: 'string',
          description:
            'A closing line in Percy voice naming that this is week 1 and the full system goes through the qualifier.',
        },
      },
      required: ['identified_pain', 'week_goal', 'days', 'cliffhanger'],
    },
  },
];

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

function parseMeta(text) {
  if (!text) return { reply: '', meta: null };
  const m = text.match(META_RE);
  if (!m) return { reply: text.trim(), meta: null };
  let meta = null;
  try {
    const parsed = JSON.parse(m[1]);
    const level = Number(parsed.level);
    if (Number.isInteger(level) && level >= 1 && level <= 5) {
      meta = { level, tag: typeof parsed.tag === 'string' ? parsed.tag : null };
    }
  } catch {
    // ignore parse errors; reply still gets returned without intent
  }
  const reply = text.slice(0, m.index).trim();
  return { reply, meta };
}

function buildSystemPrompt(key) {
  const base = loadPrompt('diagnose.md');
  return base
    .replaceAll('{{KEYWORD}}', key)
    .replaceAll('{{KEYWORD_UPPER}}', key.toUpperCase());
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
      'id, keyword, messages, intent_level, tools_invoked, qualifier_clicked, gumroad_clicked, consultation_requested',
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

  if (existing) {
    messages = Array.isArray(existing.messages) ? existing.messages : [];
    sessionKeyword = existing.keyword || key;
    existingToolsInvoked = Array.isArray(existing.tools_invoked) ? existing.tools_invoked : [];
    prevFlags = {
      qualifier_clicked: Boolean(existing.qualifier_clicked),
      gumroad_clicked: Boolean(existing.gumroad_clicked),
      consultation_requested: Boolean(existing.consultation_requested),
    };
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
    });
    if (insertErr) {
      const { data: refetched } = await admin
        .from('diagnose_sessions')
        .select('keyword, messages, tools_invoked')
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
    }
  }

  const apiMessages = rebuildApiMessages(messages, message);

  const anthropic = getAnthropic();
  let completion;
  try {
    completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: buildSystemPrompt(sessionKeyword),
      tools: TOOLS,
      messages: apiMessages,
    });
  } catch (err) {
    return json(502, { error: 'model error', detail: err?.message || 'unknown' });
  }

  // Split the response into text + tool_use blocks. The text holds the
  // Percy-voice reply (+ the META line); the tool_use blocks drive the UI.
  let rawText = '';
  const toolUses = [];
  for (const block of completion.content ?? []) {
    if (block.type === 'text' && typeof block.text === 'string') {
      rawText += block.text;
    } else if (block.type === 'tool_use' && TOOL_NAMES.has(block.name)) {
      toolUses.push({
        id: block.id,
        name: block.name,
        input: block.input ?? {},
      });
    }
  }

  const { reply, meta } = parseMeta(rawText);

  if (!reply && toolUses.length === 0) {
    return json(502, { error: 'empty model reply' });
  }

  const turnTimestamp = new Date().toISOString();
  const assistantTurn = {
    role: 'assistant',
    content: reply,
    meta,
    at: new Date().toISOString(),
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

  const { error: updateErr } = await admin
    .from('diagnose_sessions')
    .update(update)
    .eq('id', sessionId);
  if (updateErr) {
    return json(200, {
      reply,
      intent_level: meta?.level ?? null,
      tool_calls: toolUses,
      warning: 'persist_failed',
    });
  }

  return json(200, {
    reply,
    intent_level: meta?.level ?? null,
    tool_calls: toolUses,
    session_id: sessionId,
  });
};

// Helper exports for tests; not used at runtime.
export const __test__ = {
  parseMeta,
  hashIp,
  rebuildApiMessages,
  buildLeadCaptureUpdate,
  TOOLS,
  TOOL_NAMES,
  ALLOWED_KEYS,
};
