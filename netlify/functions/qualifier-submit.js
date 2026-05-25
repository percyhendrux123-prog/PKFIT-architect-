import { createHash } from 'node:crypto';
import { getAdminClient } from './_shared/supabase-admin.js';

// Public POST endpoint for the native qualifier at operatefitness.app/qualifier.
// Replaces the external Typeform that pkfitelite.co.site has been routing to.
//
// Body shape:
//   {
//     name: string,
//     email: string,
//     goals: string,
//     experience: 'beginner' | 'intermediate' | 'advanced',
//     training_days: string,
//     ready_to_invest: boolean,
//     preferred_contact?: string  // only when ready_to_invest=true
//   }
//
// Side effects:
//   - INSERT into qualifier_applications
//   - Email percyhendrux123@gmail.com with the full application (subject signals
//     HOT vs SOFT so it's scannable in inbox)
//
// Light rate limit (3 per IP per hour) to prevent form-spam.

const JSON_HEADERS = { 'Content-Type': 'application/json' };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_EXPERIENCE = new Set(['beginner', 'intermediate', 'advanced']);

const MAX_NAME = 120;
const MAX_EMAIL = 254;
const MAX_GOALS = 2000;
const MAX_TRAINING_DAYS = 50;
const MAX_PREFERRED_CONTACT = 500;

const IP_MAX = 3;
const IP_WINDOW_SEC = 3600;

const OWNER_EMAIL = 'percyhendrux123@gmail.com';
const FROM_NAME = 'PKFIT Qualifier';
const FROM_EMAIL_FALLBACK = 'command@operatefitness.app';

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
  const salt = process.env.IP_HASH_SALT || 'pkfit-qualifier-v1';
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32);
}

async function checkRateLimit(admin, ipKey) {
  const now = Date.now();
  const bucket = 'qualifier';
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

async function sendResendEmail({ to, subject, body, replyTo }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(
      `[qualifier-submit] RESEND_API_KEY unset — would send "${subject}" to ${to}.`,
    );
    return { sent: false, reason: 'no_provider' };
  }
  const sender = process.env.QUALIFIER_FROM_EMAIL || FROM_EMAIL_FALLBACK;
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

  // Validation
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, MAX_NAME) : '';
  const email = typeof body.email === 'string'
    ? body.email.trim().toLowerCase().slice(0, MAX_EMAIL)
    : '';
  const goals = typeof body.goals === 'string' ? body.goals.trim().slice(0, MAX_GOALS) : '';
  const experience = typeof body.experience === 'string' ? body.experience.trim().toLowerCase() : '';
  const trainingDays = typeof body.training_days === 'string'
    ? body.training_days.trim().slice(0, MAX_TRAINING_DAYS)
    : '';
  const readyToInvest = body.ready_to_invest === true;
  const preferredContact = typeof body.preferred_contact === 'string'
    ? body.preferred_contact.trim().slice(0, MAX_PREFERRED_CONTACT)
    : null;

  if (!name) return json(400, { error: 'name required' });
  if (!email || !EMAIL_RE.test(email)) return json(400, { error: 'invalid email' });
  if (!goals) return json(400, { error: 'goals required' });
  if (!VALID_EXPERIENCE.has(experience)) return json(400, { error: 'invalid experience' });
  if (!trainingDays) return json(400, { error: 'training_days required' });
  if (readyToInvest && !preferredContact) {
    return json(400, { error: 'preferred_contact required when ready_to_invest=true' });
  }

  const admin = getAdminClient();

  // Rate limit
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

  // Capture light context
  const referrer = req.headers.get('referer') || null;
  const userAgent = req.headers.get('user-agent')?.slice(0, 500) || null;

  // Insert
  const { data: inserted, error: insertErr } = await admin
    .from('qualifier_applications')
    .insert({
      name,
      email,
      goals,
      experience,
      training_days: trainingDays,
      ready_to_invest: readyToInvest,
      preferred_contact: readyToInvest ? preferredContact : null,
      referrer,
      ip_hash: ipKey,
      user_agent: userAgent,
    })
    .select('id, created_at')
    .maybeSingle();
  if (insertErr || !inserted) {
    return json(500, {
      error: 'application persist failed',
      detail: insertErr?.message || 'unknown',
    });
  }

  // Build email
  const isHot = readyToInvest;
  const subject = isHot
    ? `🔥 HOT qualifier — ${name} (ready to invest)`
    : `Qualifier — ${name} (not yet)`;

  const emailBody = [
    `New PKFIT qualifier application.`,
    ``,
    `${isHot ? 'HOT LEAD — ready to invest $250+' : 'Soft lead — not ready to invest yet'}`,
    ``,
    `Name: ${name}`,
    `Email: ${email}`,
    `Experience: ${experience}`,
    `Training days/week: ${trainingDays}`,
    `Ready to invest: ${readyToInvest ? 'YES' : 'NO'}`,
    isHot && preferredContact ? `Preferred contact: ${preferredContact}` : null,
    ``,
    `Goals:`,
    goals,
    ``,
    `─────────────────────────────────────────────────`,
    `Application id: ${inserted.id}`,
    `Submitted: ${inserted.created_at}`,
    referrer ? `Referrer: ${referrer}` : null,
  ].filter(Boolean).join('\n');

  let emailResult;
  try {
    emailResult = await sendResendEmail({
      to: OWNER_EMAIL,
      subject,
      body: emailBody,
      replyTo: email,
    });
  } catch (err) {
    // Persistence succeeded. Surface the email failure but return 200 — the
    // lead is captured; Percy can pull it from the dashboard / table.
    return json(200, {
      ok: true,
      application_id: inserted.id,
      ready_to_invest: readyToInvest,
      warning: 'email_failed',
      detail: err?.message || 'unknown',
    });
  }

  return json(200, {
    ok: true,
    application_id: inserted.id,
    ready_to_invest: readyToInvest,
    email_sent: emailResult.sent,
  });
};
