import { getAdminClient } from './supabase-admin.js';

// Fixed-window limiter. Returns { allowed, retryAfterSec }.
// windowSec defines the window length; max is the request cap within it.
export async function checkRateLimit({ userId, bucket, max, windowSec }) {
  const admin = getAdminClient();
  const nowIso = new Date().toISOString();
  const now = Date.now();

  const { data: existing } = await admin
    .from('rate_limits')
    .select('window_start,count')
    .eq('user_id', userId)
    .eq('bucket', bucket)
    .maybeSingle();

  const windowStart = existing ? new Date(existing.window_start).getTime() : now;
  const withinWindow = now - windowStart < windowSec * 1000;

  if (!existing || !withinWindow) {
    await admin
      .from('rate_limits')
      .upsert(
        { user_id: userId, bucket, window_start: nowIso, count: 1 },
        { onConflict: 'user_id,bucket' },
      );
    return { allowed: true };
  }

  if (existing.count >= max) {
    const retryAfterSec = Math.ceil((windowStart + windowSec * 1000 - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  await admin
    .from('rate_limits')
    .update({ count: existing.count + 1 })
    .eq('user_id', userId)
    .eq('bucket', bucket);
  return { allowed: true };
}
