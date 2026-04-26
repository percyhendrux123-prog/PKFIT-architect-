import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { checkRateLimit } from './_shared/rate-limit.js';

// Apify-driven Trainerize import. Body: { sourceUrl }.
//
// Triggers the configured Trainerize Apify actor with the user's source URL,
// polls until the run completes, fetches the dataset items, normalizes into
// a `programs` row, and inserts. Trainerize is the only supported source in
// v1 — generalize the dispatcher when other actors land.
//
// Env:
//   APIFY_API_TOKEN              required
//   APIFY_TRAINERIZE_ACTOR_ID    e.g. "username~trainerize-program-scraper"
//
// Polling is bounded to ~110s (Netlify Function timeout is ~10s by default
// for sync handlers; this function runs as a Netlify Background Function or
// the call returns 202 with the runId for the client to poll). For v1 we do
// the simplest thing — short poll with hard cap, return 202 if still running.

const POLL_INTERVAL_MS = 5_000;
const MAX_POLLS = 18; // ~90s total

async function gh(url, opts = {}) {
  const res = await fetch(url, opts);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Apify ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, role } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : '';
    if (!/^https?:\/\//i.test(sourceUrl)) {
      return jsonResponse(400, { error: 'sourceUrl (https) required' });
    }

    const token = process.env.APIFY_API_TOKEN;
    const actorId = process.env.APIFY_TRAINERIZE_ACTOR_ID;
    if (!token || !actorId) {
      return jsonResponse(500, { error: 'Apify is not configured server-side' });
    }

    const limit = role === 'owner' ? { allowed: true } : await checkRateLimit({
      userId: user.id,
      bucket: 'apify-import',
      max: 5,
      windowSec: 3600,
    });
    if (!limit.allowed) {
      return jsonResponse(429, { error: `Rate limit. Wait ${limit.retryAfterSec ?? 60}s.` });
    }

    // Kick off the actor synchronously up to 60s, then poll if needed.
    const startUrl = `https://api.apify.com/v2/acts/${encodeURIComponent(actorId)}/runs?token=${token}&waitForFinish=60`;
    const startRes = await gh(startUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ startUrls: [{ url: sourceUrl }] }),
    });
    const runId = startRes?.data?.id;
    let status = startRes?.data?.status;
    let datasetId = startRes?.data?.defaultDatasetId;

    for (let i = 0; i < MAX_POLLS && status !== 'SUCCEEDED' && status !== 'FAILED' && status !== 'ABORTED'; i += 1) {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      const poll = await gh(`https://api.apify.com/v2/actor-runs/${runId}?token=${token}`);
      status = poll?.data?.status;
      datasetId = poll?.data?.defaultDatasetId;
    }

    if (status !== 'SUCCEEDED') {
      return jsonResponse(202, { runId, status, message: 'Import is still running. Poll the runId to retrieve.' });
    }

    const items = await gh(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${token}&format=json&clean=1`);
    const first = Array.isArray(items) ? items[0] : null;
    if (!first) {
      return jsonResponse(502, { error: 'Apify run returned no items' });
    }

    const admin = getAdminClient();
    const { data, error } = await admin
      .from('programs')
      .insert({
        client_id: user.id,
        week_number: Number(first.week_number ?? 1),
        schedule: first.schedule ?? { title: first.title ?? 'Imported program', source: 'trainerize' },
        exercises: Array.isArray(first.exercises) ? first.exercises : [],
        status: 'draft',
      })
      .select()
      .maybeSingle();
    if (error) return jsonResponse(500, { error: error.message });

    return jsonResponse(200, { program: data });
  } catch (e) {
    return errorResponse(e);
  }
};
