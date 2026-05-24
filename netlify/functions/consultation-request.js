import { createHash } from 'node:crypto';
import { getAdminClient } from './_shared/supabase-admin.js';
import { AGENT_SURFACES, isValidSurface } from '../../src/lib/agentTools.js';

// Generic consultation-request endpoint. Surface-agnostic: any agent-toolkit
// consumer (diagnose siblings today, audit app + future keyword pages later)
// can POST here as long as it passes `surface` matching the toolkit allowlist.
//
// Body shape:
//   { session_id: uuid, lead_email: string, preferred_times: string,
//     surface?: string  // default 'standard'; must be in AGENT_SURFACES }
//
// Side effects:
//   - INSERT into consultation_requests with a snapshot of the conversation
//     (transcript pulled per-surface) and source_surface tagged.
//   - For diagnose surfaces (standard/structure/system/protocol/align): also
//     UPDATE diagnose_sessions: consultation_requested=true, lead_email.
//   - For audit (and future non-diagnose surfaces): skip the diagnose_sessions
//     update — the consuming surface owns its own session table.
//   - Resend email to percyhendrux123@gmail.com with the full transcript.
//
// The Resend dispatch is best-effort. If RESEND_API_KEY is unset the row still
// lands in consultation_requests (Percy will see it in the dashboard) and the
// response includes warning:'email_skipped' so the caller knows.

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_EMAIL_CHARS = 254;
const MAX_TIMES_CHARS = 1000;

// Light IP throttle — three submissions per hour from one IP is plenty.
const IP_MAX = 3;
const IP_WINDOW_SEC = 3600;

const OWNER_EMAIL = 'percyhendrux123@gmail.com';
const FROM_NAME = 'PKFIT Diagnose';
const FROM_EMAIL_FALLBACK = 'coach@pkfit.app';

// Surfaces that share the diagnose_sessions table. Other surfaces in
// AGENT_SURFACES (e.g. 'audit') will provide their own session resolver in a
// follow-up — for now they get a 501 if they POST here.
const DIAGNOSE_SURFACES = new Set(['standard', 'structure', 'system', 'protocol', 'align']);

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

async function checkRateLimit(admin, ipKey) {
  const now = Date.now();
  const bucket = 'consultation';
  const { data: existing } = await admin
    .from('public_rate_limits')
    .select('window_start,count')
    .eq('key', ipKey)
    .eq('bucket', bucket)
    .maybeSingle();
  const windowStart = existing ? new Date(existing.window_start).getTime() : now;
  const withinWindow = now - windowStart < IP_WINDOW_SEC * 1000;

  if (!existing || !withinWindow) {
    await admin
      .from('public_rate_limits')
      .upsert(
        { key: ipKey, bucket, window_start: new Date().toISOString(), count: 1 },
        { onConflict: 'key,bucket' },
      );
    return { allowed: true };
  }
  if (existing.count >= IP_MAX) {
    const retryAfterSec = Math.ceil((windowStart + IP_WINDOW_SEC * 1000 - now) / 1000);
    return { allowed: false, retryAfterSec };
  }
  await admin
    .from('public_rate_limits')
    .update({ count: existing.count + 1 })
    .eq('key', ipKey)
    .eq('bucket', bucket);
  return { allowed: true };
}

function formatTranscript(messages, sessionKeyword) {
  const lines = [];
  lines.push(`PKFIT /${sessionKeyword || 'standard'} — full transcript`);
  lines.push('');
  for (const m of messages || []) {
    const role = m.role === 'user' ? 'VISITOR' : 'PKFIT';
    const at = m.at ? ` (${m.at})` : '';
    lines.push(`[${role}${at}]`);
    if (typeof m.content === 'string' && m.content.trim()) {
      lines.push(m.content.trim());
    }
    if (Array.isArray(m.tool_calls) && m.tool_calls.length) {
      for (const tc of m.tool_calls) {
        lines.push(`  → tool: ${tc.name}`);
        if (tc.input?.framing) lines.push(`    framing: ${tc.input.framing}`);
        if (tc.input?.identified_pain) lines.push(`    pain: ${tc.input.identified_pain}`);
      }
    }
    if (m.meta?.level) lines.push(`  · intent_level=${m.meta.level} tag=${m.meta.tag ?? '-'}`);
    lines.push('');
  }
  return lines.join('\n');
}

// Per-surface session lookup. Each branch returns a normalized
// { messages, intent_level, surfaceLabel } object (or null on miss).
// Extending to a new surface = add a branch here that hits the right table.
async function resolveSession({ admin, sessionId, surface }) {
  if (DIAGNOSE_SURFACES.has(surface)) {
    const { data } = await admin
      .from('diagnose_sessions')
      .select('id, keyword, messages, intent_level')
      .eq('id', sessionId)
      .maybeSingle();
    if (!data) return null;
    return {
      messages: data.messages,
      intent_level: data.intent_level,
      surfaceLabel: data.keyword || surface,
    };
  }
  // Future: branch for audit surface using its own session table.
  return null;
}

async function sendResendEmail({ to, subject, body, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      `[consultation-request] RESEND_API_KEY unset — would send "${subject}" to ${to}. TODO: set RESEND_API_KEY in Netlify env.`,
    );
    return { sent: false, reason: 'no_provider' };
  }
  const sender = process.env.MIGRATION_FROM_EMAIL || FROM_EMAIL_FALLBACK;
  const payload = {
    from: `${FROM_NAME} <${sender}>`,
    to: Array.isArray(to) ? to : [to],
    subject,
    text: body,
  };
  if (replyTo) payload.reply_to = replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const out = await res.json().catch(() => ({}));
  return { sent: true, id: out?.id ?? null };
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
  const leadEmail =
    typeof body.lead_email === 'string'
      ? body.lead_email.trim().slice(0, MAX_EMAIL_CHARS)
      : '';
  const preferredTimes =
    typeof body.preferred_times === 'string'
      ? body.preferred_times.trim().slice(0, MAX_TIMES_CHARS)
      : '';
  const surface = isValidSurface(body.surface) ? body.surface : 'standard';

  if (!sessionId || !UUID_RE.test(sessionId)) {
    return json(400, { error: 'invalid session_id' });
  }
  if (!leadEmail || !EMAIL_RE.test(leadEmail)) {
    return json(400, { error: 'invalid email' });
  }
  if (!preferredTimes) {
    return json(400, { error: 'preferred_times required' });
  }
  if (!DIAGNOSE_SURFACES.has(surface)) {
    // Non-diagnose surfaces (e.g. 'audit') need their own session resolver
    // wired before this endpoint can serve them. Fail loud so the integrating
    // surface knows to extend resolveSession() rather than getting a silent
    // session-not-found.
    return json(501, {
      error: 'surface not yet wired',
      surface,
      hint: `Add a session resolver for "${surface}" to consultation-request.js (or pass surface=standard if testing).`,
    });
  }

  const admin = getAdminClient();

  const ip = getClientIp(req);
  const ipKey = hashIp(ip);
  const rate = await checkRateLimit(admin, ipKey);
  if (!rate.allowed) {
    return json(
      429,
      { error: 'too many submissions' },
      { 'Retry-After': String(rate.retryAfterSec ?? 600) },
    );
  }

  // Resolve the session via the per-surface lookup. Currently all diagnose
  // surfaces share diagnose_sessions; the audit/future branches will register
  // their own resolver here.
  const session = await resolveSession({ admin, sessionId, surface });
  if (!session) {
    return json(404, { error: 'session not found' });
  }

  const messages = Array.isArray(session.messages) ? session.messages : [];

  // Insert the consultation request. Server-side write goes through service
  // role, which bypasses the anon-insert RLS check that requires empty
  // full_conversation.
  const { data: inserted, error: insertErr } = await admin
    .from('consultation_requests')
    .insert({
      session_id: sessionId,
      lead_email: leadEmail,
      preferred_times: preferredTimes,
      full_conversation: messages,
      status: 'pending',
      source_surface: surface,
    })
    .select('id, created_at')
    .maybeSingle();
  if (insertErr || !inserted) {
    return json(500, {
      error: 'request persist failed',
      detail: insertErr?.message || 'unknown',
    });
  }

  // For diagnose surfaces, flag the session row and capture the email.
  // Best-effort; failure here doesn't void the consultation row.
  if (DIAGNOSE_SURFACES.has(surface)) {
    await admin
      .from('diagnose_sessions')
      .update({
        consultation_requested: true,
        lead_email: leadEmail,
        last_message_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
  }

  const transcript = formatTranscript(messages, session.surfaceLabel || surface);
  const intentLine = session.intent_level
    ? `Intent level (last turn): ${session.intent_level}`
    : 'Intent level: not captured';

  const emailBody = [
    `New PKFIT consultation request.`,
    ``,
    `From: ${leadEmail}`,
    `Surface: /${surface}`,
    `Session id: ${sessionId}`,
    `Request id: ${inserted.id}`,
    intentLine,
    ``,
    `Preferred times:`,
    preferredTimes,
    ``,
    `─────────────────────────────────────────────────────`,
    ``,
    transcript,
  ].join('\n');

  let emailResult;
  try {
    emailResult = await sendResendEmail({
      to: OWNER_EMAIL,
      subject: `PKFIT consultation request from ${leadEmail} (/${surface})`,
      body: emailBody,
      replyTo: leadEmail,
    });
  } catch (err) {
    // Persistence already succeeded. Surface the email failure but return 200
    // — the lead is captured; Percy can chase it from the dashboard.
    return json(200, {
      ok: true,
      request_id: inserted.id,
      warning: 'email_failed',
      detail: err?.message || 'unknown',
    });
  }

  return json(200, {
    ok: true,
    request_id: inserted.id,
    email_sent: emailResult.sent,
    email_warning: emailResult.sent ? null : emailResult.reason,
  });
};

export const __test__ = { formatTranscript };
