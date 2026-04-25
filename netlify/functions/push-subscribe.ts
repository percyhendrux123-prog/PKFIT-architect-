// netlify/functions/push-subscribe.ts
//
// POST   { subscription: PushSubscriptionJSON, userAgent?: string }
//   → upsert a push subscription for the authenticated user.
// DELETE { endpoint: string }
//   → delete that endpoint for the authenticated user.
//
// Auth: Supabase JWT in the Authorization header (handled by the shared helper).

import type { Handler } from '@netlify/functions';
// Shared helpers are JS — TS imports work via esbuild bundling at build time.
// @ts-expect-error JS module without types
import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
// @ts-expect-error JS module without types
import { getAdminClient } from './_shared/supabase-admin.js';

interface PushSubscriptionJSON {
  endpoint: string;
  keys?: {
    p256dh?: string;
    auth?: string;
  };
}

interface SubscribeBody {
  subscription?: PushSubscriptionJSON;
  userAgent?: string | null;
}

interface UnsubscribeBody {
  endpoint?: string;
}

export const handler: Handler = async (event) => {
  try {
    const method = event.httpMethod?.toUpperCase();

    if (method !== 'POST' && method !== 'DELETE') {
      return jsonResponse(405, { error: 'Method not allowed' });
    }

    const { user } = await requireUser(event);
    const admin = getAdminClient();

    if (method === 'POST') {
      const body = parseBody<SubscribeBody>(event.body);
      const sub = body.subscription;
      if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
        return jsonResponse(400, { error: 'Invalid subscription payload' });
      }

      const row = {
        user_id: user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: body.userAgent ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await admin
        .from('push_subscriptions')
        .upsert(row, { onConflict: 'user_id,endpoint' });

      if (error) return jsonResponse(500, { error: error.message });
      return jsonResponse(200, { ok: true });
    }

    // DELETE
    const body = parseBody<UnsubscribeBody>(event.body);
    if (!body.endpoint) return jsonResponse(400, { error: 'endpoint required' });

    const { error } = await admin
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', body.endpoint);

    if (error) return jsonResponse(500, { error: error.message });
    return jsonResponse(200, { ok: true });
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
