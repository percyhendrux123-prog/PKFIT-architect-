import { createHash, randomUUID } from 'node:crypto';
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

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const ALLOWED_KEYS = new Set(['standard', 'structure', 'system', 'protocol', 'align']);

// Model: Sonnet 4.6 per spec. Opus upgrade is left for a later iteration.
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 600;
const TEMPERATURE = 0.4;

// Per-turn input cap and per-session message cap. Bound the surface so a
// single bad actor can't blow Anthropic spend on one session.
const MAX_USER_MESSAGE_CHARS = 2000;
const MAX_MESSAGES_PER_SESSION = 40;

// IP throttle (per public_rate_limits): 30 req / 10 min and 200 req / day.
const IP_BURST_MAX = 30;
const IP_BURST_WINDOW_SEC = 600;
const IP_DAILY_MAX = 200;
const IP_DAILY_WINDOW_SEC = 86_400;

const META_RE = /<!--META:(\{[^]*?\})-->\s*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const subscriberId = typeof body.subscriber_id === 'string' ? body.subscriber_id.slice(0, 100) : null;
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

  // Two-tier IP throttle: burst + daily.
  const burst = await checkPublicRateLimit({
    key: ipKey,
    bucket: 'diagnose_burst',
    max: IP_BURST_MAX,
    windowSec: IP_BURST_WINDOW_SEC,
  });
  if (!burst.allowed) {
    return json(429, { error: 'rate limited' }, { 'Retry-After': String(burst.retryAfterSec ?? 60) });
  }
  const daily = await checkPublicRateLimit({
    key: ipKey,
    bucket: 'diagnose_daily',
    max: IP_DAILY_MAX,
    windowSec: IP_DAILY_WINDOW_SEC,
  });
  if (!daily.allowed) {
    return json(429, { error: 'daily limit reached' }, { 'Retry-After': String(daily.retryAfterSec ?? 3600) });
  }

  const admin = getAdminClient();

  // Load (or create) the session row. Source of truth for transcript.
  const { data: existing } = await admin
    .from('diagnose_sessions')
    .select('id, keyword, messages, intent_level')
    .eq('id', sessionId)
    .maybeSingle();

  let messages = [];
  let sessionKeyword = key;
  if (existing) {
    messages = Array.isArray(existing.messages) ? existing.messages : [];
    sessionKeyword = existing.keyword || key;
    if (messages.length >= MAX_MESSAGES_PER_SESSION) {
      return json(429, { error: 'session length limit reached' });
    }
  } else {
    const { error: insertErr } = await admin
      .from('diagnose_sessions')
      .insert({
        id: sessionId,
        keyword: key,
        referrer,
        subscriber_id: subscriberId,
        ip_hash: ipKey,
        user_agent: userAgent,
        messages: [],
      });
    if (insertErr) {
      // Race: another request may have inserted it. Refetch and proceed.
      const { data: refetched } = await admin
        .from('diagnose_sessions')
        .select('keyword, messages')
        .eq('id', sessionId)
        .maybeSingle();
      if (!refetched) {
        return json(500, { error: 'session create failed' });
      }
      messages = Array.isArray(refetched.messages) ? refetched.messages : [];
      sessionKeyword = refetched.keyword || key;
    }
  }

  const turnTimestamp = new Date().toISOString();
  const nextMessages = [
    ...messages,
    { role: 'user', content: message, at: turnTimestamp },
  ];

  // Call Claude. The full conversation goes in; system prompt comes from
  // the keyword-aware template.
  const anthropic = getAnthropic();
  let completion;
  try {
    completion = await anthropic.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      system: buildSystemPrompt(sessionKeyword),
      messages: nextMessages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });
  } catch (err) {
    return json(502, { error: 'model error', detail: err?.message || 'unknown' });
  }

  const raw = completion?.content?.[0]?.type === 'text'
    ? completion.content[0].text
    : '';
  const { reply, meta } = parseMeta(raw);

  if (!reply) {
    return json(502, { error: 'empty model reply' });
  }

  const finalMessages = [
    ...nextMessages,
    { role: 'assistant', content: reply, meta, at: new Date().toISOString() },
  ];

  const update = {
    messages: finalMessages,
    last_message_at: new Date().toISOString(),
  };
  if (meta?.level) update.intent_level = meta.level;

  const { error: updateErr } = await admin
    .from('diagnose_sessions')
    .update(update)
    .eq('id', sessionId);
  if (updateErr) {
    // Persistence failed but we already paid for the model call. Return
    // the reply so the visitor isn't dead-ended; surface a soft warning.
    return json(200, {
      reply,
      intent_level: meta?.level ?? null,
      warning: 'persist_failed',
    });
  }

  return json(200, {
    reply,
    intent_level: meta?.level ?? null,
    session_id: sessionId,
  });
};

// Helper exported for tests; not used at runtime.
export const __test__ = { parseMeta, hashIp, ALLOWED_KEYS };
