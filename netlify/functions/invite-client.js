// invite-client
//
// Sends a magic-link onboarding email to a new client. Called from the
// coach roster page when Percy adds someone (and from any future bulk
// admin tool). The function:
//
//   1. Auth-gates to coach/owner roles via requireUser.
//   2. Looks up the auth.users row by email; creates it (email_confirm=true,
//      so no Supabase confirmation noise) when missing. The handle_new_user
//      trigger on auth.users (0001) + activate_new_client trigger on
//      profiles (0053) bind the coach + clone the starter programs.
//   3. Generates a magic-link via the admin API. We don't use Supabase's
//      built-in invite mailer because the sender domain and copy need to be
//      PKFIT's, not the default Supabase template.
//   4. Sends the email via Resend from coach@operatefitness.app, with
//      reply-to set to Percy's inbox so client replies land somewhere a
//      human reads.
//
// Env required:
//   SUPABASE_SERVICE_ROLE_KEY
//   VITE_SUPABASE_URL (or SUPABASE_URL)
//   RESEND_API_KEY                     (verified for operatefitness.app)
//   VITE_SITE_URL                      (e.g. https://app.pkfit.app)
//   INVITE_FROM_EMAIL                  default: coach@operatefitness.app
//   INVITE_REPLY_TO                    default: percyhendrux123@gmail.com

import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { loadPrompt } from './_shared/anthropic.js';

const DEFAULT_FROM = 'coach@operatefitness.app';
const DEFAULT_REPLY_TO = 'percyhendrux123@gmail.com';
const FROM_NAME = 'Percy';

export const handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    const { role } = await requireUser(event);
    if (role !== 'coach' && role !== 'owner') {
      return jsonResponse(403, { error: 'Coach or owner only' });
    }

    const payload = safeJson(event.body);
    const email = String(payload?.email ?? '').trim().toLowerCase();
    const name = String(payload?.name ?? '').trim();
    if (!email || !email.includes('@')) {
      return jsonResponse(400, { error: 'Valid email required' });
    }

    const admin = getAdminClient();

    // 1. Ensure an auth.users row exists. createUser returns an error when
    //    the email is already taken — we treat that as "already exists" and
    //    fall through to magic-link generation. Any other failure bubbles up.
    let createdUserId = null;
    {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: name ? { name } : {},
      });
      if (error) {
        const msg = String(error.message ?? '').toLowerCase();
        const alreadyExists =
          msg.includes('already') || msg.includes('exists') || msg.includes('registered');
        if (!alreadyExists) throw error;
      } else {
        createdUserId = data?.user?.id ?? null;
      }
    }

    // 2. Generate a magic link. redirectTo lands the client on /home,
    //    which is gated by ProtectedRoute + RequiresActiveSubscription.
    //    The subscription gate is the next blocker but is out of P0 scope.
    const siteUrl = process.env.VITE_SITE_URL || 'https://app.pkfit.app';
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
      options: { redirectTo: `${siteUrl}/home` },
    });
    if (linkErr) throw linkErr;
    const magicUrl = linkData?.properties?.action_link ?? linkData?.action_link ?? null;
    if (!magicUrl) throw new Error('Failed to generate magic link');

    // 3. Render + send the email.
    const firstName = name ? name.split(' ')[0] : email.split('@')[0];
    const { subject, body } = renderInvite({ firstName, magicUrl });
    const send = await sendInviteEmail({ to: email, subject, body });

    if (!send.sent) {
      // RESEND_API_KEY unset on the env. Surface the magic_url so Percy
      // can still hand it off out-of-band rather than silently failing.
      return jsonResponse(500, {
        error: 'Email transport not configured (RESEND_API_KEY missing)',
        magic_url: magicUrl,
      });
    }

    return jsonResponse(200, {
      ok: true,
      email,
      auth_user_id: createdUserId,
      email_id: send.id ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
};

function safeJson(s) {
  if (!s) return {};
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}

export function renderInvite({ firstName, magicUrl }) {
  const raw = loadPrompt('invite-client.txt');
  const lines = raw.split('\n');
  const subjectLine = lines.find((l) => l.startsWith('SUBJECT:'));
  const subject = (subjectLine ?? 'SUBJECT: Your PKFIT app is ready')
    .slice('SUBJECT:'.length)
    .trim();
  const dividerIdx = lines.findIndex((l) => l.trim() === '---');
  const bodyRaw = dividerIdx >= 0 ? lines.slice(dividerIdx + 1).join('\n') : raw;
  const body = bodyRaw
    .replace(/\{\{\s*first_name\s*\}\}/g, firstName)
    .replace(/\{\{\s*magic_url\s*\}\}/g, magicUrl)
    .replace(/^\n+/, '');
  return { subject, body };
}

async function sendInviteEmail({ to, subject, body }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVITE_FROM_EMAIL || DEFAULT_FROM;
  const replyTo = process.env.INVITE_REPLY_TO || DEFAULT_REPLY_TO;

  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.warn(`[invite-client] RESEND_API_KEY unset — would send "${subject}" to ${to}`);
    return { sent: false, reason: 'no_provider' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${from}>`,
      to: [to],
      reply_to: replyTo,
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
