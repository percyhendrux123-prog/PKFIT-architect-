// Migration email rendering and dispatch.
//
// Templates live as plain text under netlify/functions/_prompts/migration-emails/
// in the format:
//
//     SUBJECT: <one line>
//
//     ---
//
//     <body, with {{var}} placeholders>
//
// renderEmail(name, vars) returns { subject, body } with placeholders
// substituted. Unknown placeholders are left as-is so missing-data bugs surface
// at QA time instead of silently dropping fields.
//
// sendEmail({ to, subject, body }) dispatches via Resend if RESEND_API_KEY is
// set; otherwise it returns { sent: false, reason: 'no_provider' } and logs.
// That keeps the recovery worker callable in environments where the email
// transport is not yet wired (e.g. local dev, the early Wave-0 pilot before
// the sender domain is warmed) without crashing.
//
// loadPrompt is reused from _shared/anthropic.js — it already handles the
// dev/Lambda path resolution gymnastics.

import { loadPrompt } from './anthropic.js';

const TEMPLATE_FILES = {
  trigger:                'migration-emails/01-trigger.txt',
  reminder_day_3:         'migration-emails/02-reminder-day-3.txt',
  reminder_day_7:         'migration-emails/03-reminder-day-7.txt',
  confirmation:           'migration-emails/04-confirmation.txt',
  onboarding_no_signin:   'migration-emails/05a-onboarding-no-signin.txt',
  onboarding_no_activity: 'migration-emails/05b-onboarding-no-activity.txt',
  failed_handshake:       'migration-emails/06-failed-handshake.txt',
};

export function listTemplateNames() {
  return Object.keys(TEMPLATE_FILES);
}

function interpolate(text, vars) {
  return text.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key) && vars[key] != null) {
      return String(vars[key]);
    }
    return `{{${key}}}`;
  });
}

export function renderEmail(name, vars = {}) {
  const file = TEMPLATE_FILES[name];
  if (!file) throw new Error(`Unknown migration email template: ${name}`);
  const raw = loadPrompt(file);

  // Split on the first delimiter line — `---` on its own line.
  const lines = raw.split('\n');
  const subjectLine = lines.find((l) => l.startsWith('SUBJECT:'));
  if (!subjectLine) throw new Error(`Template ${name} missing SUBJECT line`);
  const subject = interpolate(subjectLine.slice('SUBJECT:'.length).trim(), vars);

  const dividerIdx = lines.findIndex((l) => l.trim() === '---');
  const bodyRaw = dividerIdx >= 0 ? lines.slice(dividerIdx + 1).join('\n') : raw;
  const body = interpolate(bodyRaw, vars).replace(/^\n+/, '');

  return { subject, body };
}

export async function sendEmail({ to, subject, body, fromName = 'Percy', fromEmail }) {
  const apiKey = process.env.RESEND_API_KEY;
  const sender = fromEmail || process.env.MIGRATION_FROM_EMAIL || 'coach@pkfit.app';

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(`[migration-email] RESEND_API_KEY unset — would send "${subject}" to ${to}`);
    return { sent: false, reason: 'no_provider' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${fromName} <${sender}>`,
      to: Array.isArray(to) ? to : [to],
      subject,
      text: body,
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Resend ${res.status}: ${errBody.slice(0, 200)}`);
  }
  const json = await res.json();
  return { sent: true, id: json?.id ?? null };
}

// Convenience: render and send in one call. Returns the same shape as sendEmail
// with the rendered subject/body included for logging.
export async function renderAndSend({ to, name, vars }) {
  const { subject, body } = renderEmail(name, vars);
  const result = await sendEmail({ to, subject, body });
  return { ...result, subject, body };
}
