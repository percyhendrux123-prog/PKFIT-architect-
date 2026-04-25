// netlify/functions/push-send.ts
//
// POST { toUserId: string, payload: { title, body, url?, tag?, data? } }
//   → looks up every push subscription for that user and delivers a Web Push.
//
// Caller must be authenticated and have role === 'coach'.
// On 404/410 from the push service the subscription is purged.
//
// Required env vars:
//   VAPID_PUBLIC_KEY    — base64url, also exposed to client as VITE_VAPID_PUBLIC_KEY
//   VAPID_PRIVATE_KEY   — base64url, server-only
//   VAPID_SUBJECT       — mailto:coach@pkfit.app (or https://pkfit.app)

import type { Handler } from '@netlify/functions';
// @ts-expect-error JS module without types
import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
// @ts-expect-error JS module without types
import { getAdminClient } from './_shared/supabase-admin.js';
import webpush from 'web-push';

interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

interface SendBody {
  toUserId?: string;
  payload?: PushPayload;
}

interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod?.toUpperCase() !== 'POST') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    const { role } = await requireUser(event);
    if (role !== 'coach') {
      return jsonResponse(403, { error: 'Coach role required' });
    }

    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT || 'mailto:coach@pkfit.app';
    if (!publicKey || !privateKey) {
      return jsonResponse(500, { error: 'VAPID keys not configured' });
    }
    webpush.setVapidDetails(subject, publicKey, privateKey);

    const body = parseBody<SendBody>(event.body);
    if (!body.toUserId || !body.payload?.title) {
      return jsonResponse(400, { error: 'toUserId and payload.title are required' });
    }

    const admin = getAdminClient();
    const { data: subs, error } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', body.toUserId);

    if (error) return jsonResponse(500, { error: error.message });
    if (!subs || subs.length === 0) {
      return jsonResponse(200, { ok: true, sent: 0, removed: 0 });
    }

    const payloadStr = JSON.stringify(body.payload);
    const results = await Promise.allSettled(
      (subs as SubscriptionRow[]).map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payloadStr,
        ),
      ),
    );

    let sent = 0;
    const stale: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        sent += 1;
      } else {
        const status = (r.reason as { statusCode?: number })?.statusCode;
        if (status === 404 || status === 410) stale.push((subs as SubscriptionRow[])[i].id);
      }
    });

    if (stale.length > 0) {
      await admin.from('push_subscriptions').delete().in('id', stale);
    }

    return jsonResponse(200, { ok: true, sent, removed: stale.length });
  } catch (e) {
    return errorResponse(e);
  }
};

function parseBody<T>(raw: string | null | undefined): T {
  if (!raw) return {} as T;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return {} as T;
  }
}
