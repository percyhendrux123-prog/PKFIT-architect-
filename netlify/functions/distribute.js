// netlify/functions/distribute.js
//
// /api/distribute — the AXIOM Distributor's posting endpoint.
//
// Mirrors the existing /generate-image and /generate-meal-plan shape:
//   - Auth-gated (Supabase JWT via requireUser)
//   - Per-user rate-limited (rate_limits table; 30/min, 500/day buckets)
//   - Server-side Buffer auth (BUFFER_ACCESS_TOKEN env, redacted from logs)
//   - Optional Anthropic-powered brand-canon check pre-publish
//   - Idempotent on (producer_task_id, buffer_channel_id) — 409 on conflict
//
// Spec: see PR description for the full integration spec doc path. Buffer's
// public API is GraphQL, single-tenant Bearer-token auth, in beta. TikTok is
// not in the supported-platforms list — TikTok-bound posts are forced to
// `mode: draft` for manual publish from the Buffer app.

import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { checkRateLimit } from './_shared/rate-limit.js';
import { canonCheck } from './_shared/canon-check.js';
import { slackAlert } from './_shared/slack.js';

// Buffer GraphQL endpoint (verified 2026-04 per spec §1).
const BUFFER_API_URL = 'https://api.buffer.com';

// Per-platform constraints — source of truth for the pre-Buffer validator.
// Caption/hashtag caps come from Buffer's docs (spec §2). If Buffer relaxes
// these we relax here too; if they tighten, this rejects before burning a
// Buffer rate-limit slot.
const PLATFORM_LIMITS = {
  instagram: { caption_max: 2200,  hashtag_max: 30 },
  linkedin:  { caption_max: 3000,  hashtag_max: 30 },
  youtube:   { caption_max: 5000,  hashtag_max: 15 },
  twitter:   { caption_max: 4000,  hashtag_max: 30 },
  threads:   { caption_max: 500,   hashtag_max: 30 },
  facebook:  { caption_max: 63206, hashtag_max: 30 },
  pinterest: { caption_max: 500,   hashtag_max: 20 },
  bluesky:   { caption_max: 300,   hashtag_max: 30 },
  // tiktok is allowed but not in PLATFORM_LIMITS — see TIKTOK_DRAFT_MODE.
};

const TIKTOK_DRAFT_MODE = true;
const CANON_THRESHOLD_HARD = 0.70;
const CANON_THRESHOLD_SOFT = 0.90;

const RATE_LIMIT_PER_MIN = 30;
const RATE_LIMIT_PER_DAY = 500;

const ERR = {
  INVALID_AUTH: 'INVALID_AUTH',
  RATE_LIMITED: 'RATE_LIMITED',
  INVALID_PAYLOAD: 'INVALID_PAYLOAD',
  MEDIA_UNREACHABLE: 'MEDIA_UNREACHABLE',
  CANON_CHECK_FAILED: 'CANON_CHECK_FAILED',
  PLATFORM_NOT_SUPPORTED: 'PLATFORM_NOT_SUPPORTED',
  DUPLICATE_DISTRIBUTION: 'DUPLICATE_DISTRIBUTION',
  BUFFER_API_ERROR: 'BUFFER_API_ERROR',
  BUFFER_AUTH_ERROR: 'BUFFER_AUTH_ERROR',
  BUFFER_RATE_LIMITED: 'BUFFER_RATE_LIMITED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
};

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return jsonResponse(405, { error: 'Method not allowed' });
  }

  let user;
  try {
    ({ user } = await requireUser(event));
  } catch (e) {
    return errorResponse(e);
  }

  // Two-bucket per-user rate limit. Both buckets must allow.
  const rlMin = await checkRateLimit({
    userId: user.id, bucket: 'distribute-min', max: RATE_LIMIT_PER_MIN, windowSec: 60,
  });
  if (!rlMin.allowed) return rateLimitedResponse(rlMin.retryAfterSec);
  const rlDay = await checkRateLimit({
    userId: user.id, bucket: 'distribute-day', max: RATE_LIMIT_PER_DAY, windowSec: 86400,
  });
  if (!rlDay.allowed) return rateLimitedResponse(rlDay.retryAfterSec);

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return jsonError(400, ERR.INVALID_PAYLOAD, 'Body is not valid JSON');
  }

  const validation = validatePayload(payload);
  if (!validation.ok) {
    return jsonError(400, ERR.INVALID_PAYLOAD, validation.error);
  }

  const {
    platform,
    channel_id,
    content_type,
    media_urls,
    thumbnail_url,
    caption,
    schedule_mode,
    schedule_at,
    metadata,
    skip_canon_check,
  } = payload;

  if (!PLATFORM_LIMITS[platform] && platform !== 'tiktok') {
    return jsonError(400, ERR.PLATFORM_NOT_SUPPORTED, `Platform ${platform} is not supported`);
  }

  const constraintCheck = checkPlatformConstraints(platform, caption);
  if (!constraintCheck.ok) {
    return jsonError(400, ERR.INVALID_PAYLOAD, constraintCheck.error);
  }

  // Fail-fast on missing Buffer token. We check here (not at module load) so
  // the test environment can import the function without stubbing the env.
  const bufferToken = process.env.BUFFER_ACCESS_TOKEN;
  if (!bufferToken) {
    return jsonResponse(500, { error: 'BUFFER_ACCESS_TOKEN missing' });
  }

  const admin = getAdminClient();

  // Idempotency check — same producer task to same channel returns the
  // existing row instead of double-posting.
  const { data: existing } = await admin
    .from('distributed_posts')
    .select('id, buffer_post_id, scheduled_at, buffer_status')
    .eq('producer_task_id', metadata.producer_task_id)
    .eq('buffer_channel_id', channel_id)
    .maybeSingle();

  if (existing) {
    return jsonError(409, ERR.DUPLICATE_DISTRIBUTION, 'This task was already distributed to this channel', {
      existing_post_id: existing.buffer_post_id,
      scheduled_at: existing.scheduled_at,
      buffer_status: existing.buffer_status,
    });
  }

  // Media reachability — Buffer fetches the URL at publish time, which can be
  // hours/days after we schedule. A 404 here is much better than a Bucket-D
  // error after the fact.
  if (Array.isArray(media_urls)) {
    for (const url of media_urls) {
      const reachable = await checkUrlReachable(url);
      if (!reachable) {
        return jsonError(400, ERR.MEDIA_UNREACHABLE, `Media URL not reachable: ${url}`);
      }
    }
  }

  // Brand-canon gate. skip_canon_check is for Producer agents that already
  // ran the same check before handing off — never set by the Distributor
  // agent itself (see system prompt in spec §9).
  let canonResult = { score: 1.0, violations: [], suggestions: [] };
  if (!skip_canon_check) {
    try {
      canonResult = await canonCheck({
        caption,
        platform,
        content_pillar: metadata.content_pillar,
        canon_version: metadata.canon_version,
      });
    } catch (e) {
      // Anthropic outage / parse failure — surface, do not silently publish.
      return jsonError(500, ERR.INTERNAL_ERROR, `Canon check failed: ${e.message}`);
    }

    if (canonResult.score < CANON_THRESHOLD_HARD) {
      return jsonError(422, ERR.CANON_CHECK_FAILED,
        `Caption scored ${canonResult.score.toFixed(2)}, below hard threshold ${CANON_THRESHOLD_HARD}`,
        {
          canon_score: canonResult.score,
          violations: canonResult.violations,
          suggestions: canonResult.suggestions,
        });
    }
  }

  // TikTok forces draft mode (spec §10) — Buffer's GraphQL surface doesn't
  // publish to TikTok, but draft creation lands the asset in the Buffer app
  // for Percy to one-tap publish.
  const effectiveMode = (platform === 'tiktok' && TIKTOK_DRAFT_MODE)
    ? 'draft'
    : schedule_mode;

  const bufferInput = buildCreatePostInput({
    text: caption,
    channel_id,
    schedule_mode: effectiveMode,
    schedule_at,
    media_urls,
    thumbnail_url,
    content_type,
  });

  let bufferResult;
  try {
    bufferResult = await callBufferCreatePost(bufferInput, bufferToken);
  } catch (e) {
    await slackAlert('WARN',
      `Buffer API call failed for task ${metadata.producer_task_id} on ${platform}: ${e.message}`);
    return jsonError(502, ERR.BUFFER_API_ERROR, 'Buffer API request failed', { retry_safe: true });
  }

  // GraphQL transport-level errors
  if (bufferResult.errors?.length) {
    const err = bufferResult.errors[0];
    if (err.extensions?.code === 'RATE_LIMIT_EXCEEDED') {
      return jsonError(429, ERR.BUFFER_RATE_LIMITED, err.message ?? 'Buffer rate limit', {
        retryAfter: err.extensions.retryAfter,
      });
    }
    const msg = err.message ?? '';
    if (msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('auth')) {
      await slackAlert('CRITICAL', 'Buffer API auth failed — check BUFFER_ACCESS_TOKEN');
      return jsonError(401, ERR.BUFFER_AUTH_ERROR, 'Buffer rejected our credentials');
    }
    return jsonError(502, ERR.BUFFER_API_ERROR, msg || 'Buffer API error');
  }

  // GraphQL response is a union: PostActionSuccess | MutationError.
  // MutationError surfaces as a typename + message on the same field.
  const result = bufferResult.data?.createPost;
  if (!result || (result.message && !result.post)) {
    const message = result?.message ?? 'Unknown Buffer error';
    await slackAlert('WARN',
      `Buffer rejected post for task ${metadata.producer_task_id} on ${platform}: ${message}`);
    return jsonError(422, ERR.BUFFER_API_ERROR, message);
  }

  const post = result.post;

  // Persist the Observer-correlation row. If this insert fails after Buffer
  // accepted the post, we have a real-but-unrecorded post in Buffer — alert
  // CRITICAL but don't fail the request (the post is real and scheduled).
  let rowId;
  try {
    const { data: row, error: insertError } = await admin
      .from('distributed_posts')
      .insert({
        buffer_post_id: post.id,
        buffer_channel_id: channel_id,
        platform,
        scheduled_at: post.dueAt ?? schedule_at ?? null,
        buffer_status: effectiveMode === 'draft' ? 'draft' : 'scheduled',
        producer_task_id: metadata.producer_task_id,
        source_asset_id: metadata.source_asset_id ?? null,
        canon_version: metadata.canon_version,
        content_pillar: metadata.content_pillar,
        generation_model: metadata.generation_model ?? null,
        generation_prompt_hash: metadata.generation_prompt_hash ?? null,
        caption_canon_score: canonResult.score,
        distributor_agent_version: metadata.distributor_agent_version ?? null,
        metadata_json: metadata,
      })
      .select('id')
      .single();

    if (insertError) {
      await slackAlert('CRITICAL',
        `Posted to Buffer (id=${post.id}) but failed to record in distributed_posts: ${insertError.message}`);
    } else {
      rowId = row?.id;
    }
  } catch (e) {
    await slackAlert('CRITICAL',
      `Posted to Buffer (id=${post.id}) but exception recording row: ${e.message}`);
  }

  const flagged = !skip_canon_check && canonResult.score < CANON_THRESHOLD_SOFT;

  return jsonResponse(200, {
    ok: true,
    post_id: post.id,
    scheduled_at: post.dueAt ?? schedule_at ?? null,
    status: effectiveMode === 'draft' ? 'draft' : 'scheduled',
    canon_score: canonResult.score,
    canon_flagged: flagged,
    canon_violations: flagged ? canonResult.violations : undefined,
    distributed_post_row_id: rowId,
    note: platform === 'tiktok'
      ? 'TikTok routes via Buffer drafts; manual publish required from Buffer app'
      : undefined,
  });
};

// ─── Buffer call ──────────────────────────────────────────────────────────────

const CREATE_POST_MUTATION = `
  mutation CreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      ... on PostActionSuccess {
        post {
          id
          text
          dueAt
          channelId
          assets { id mimeType source }
        }
      }
      ... on MutationError { message }
    }
  }
`;

async function callBufferCreatePost(input, token) {
  const res = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query: CREATE_POST_MUTATION, variables: { input } }),
  });
  // Surface non-2xx as a thrown error so the handler treats it as transient.
  // GraphQL errors come back as 200 with an `errors` array; those are handled
  // in the success branch.
  if (!res.ok && res.status >= 500) {
    throw new Error(`Buffer ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

// ─── Input shaping ────────────────────────────────────────────────────────────

function buildCreatePostInput({ text, channel_id, schedule_mode, schedule_at, media_urls, thumbnail_url, content_type }) {
  const input = {
    text,
    channelId: channel_id,
    schedulingType: 'automatic',
    mode: schedule_mode,
  };

  if (schedule_mode === 'customScheduled') {
    input.dueAt = schedule_at;
  }

  if (content_type === 'image' && media_urls?.length) {
    input.assets = { images: media_urls.map((url) => ({ url })) };
  } else if (content_type === 'video' && media_urls?.length) {
    input.assets = {
      videos: media_urls.map((url) => ({
        url,
        ...(thumbnail_url ? { thumbnailUrl: thumbnail_url } : {}),
      })),
    };
  } else if (content_type === 'carousel' && media_urls?.length) {
    input.assets = { images: media_urls.map((url) => ({ url })) };
  }

  return input;
}

// ─── Validators ───────────────────────────────────────────────────────────────

function validatePayload(p) {
  if (!p || typeof p !== 'object') return { ok: false, error: 'Body must be an object' };
  if (!p.platform) return { ok: false, error: 'platform required' };
  if (!p.channel_id) return { ok: false, error: 'channel_id required' };
  if (!p.content_type) return { ok: false, error: 'content_type required' };
  if (!['text', 'image', 'video', 'carousel'].includes(p.content_type)) {
    return { ok: false, error: 'content_type must be text|image|video|carousel' };
  }
  if (p.content_type !== 'text' && (!Array.isArray(p.media_urls) || p.media_urls.length === 0)) {
    return { ok: false, error: 'media_urls required for non-text content' };
  }
  if (typeof p.caption !== 'string') return { ok: false, error: 'caption required (use empty string for none)' };
  if (!['addToQueue', 'customScheduled', 'draft'].includes(p.schedule_mode)) {
    return { ok: false, error: 'schedule_mode must be addToQueue|customScheduled|draft' };
  }
  if (p.schedule_mode === 'customScheduled' && !p.schedule_at) {
    return { ok: false, error: 'schedule_at required for customScheduled mode' };
  }
  if (p.schedule_at) {
    const t = Date.parse(p.schedule_at);
    if (Number.isNaN(t)) return { ok: false, error: 'schedule_at must be ISO 8601 datetime' };
    if (t <= Date.now()) return { ok: false, error: 'schedule_at must be in the future' };
  }
  if (!p.metadata?.producer_task_id) return { ok: false, error: 'metadata.producer_task_id required' };
  if (!p.metadata?.canon_version) return { ok: false, error: 'metadata.canon_version required' };
  if (!p.metadata?.content_pillar) return { ok: false, error: 'metadata.content_pillar required' };
  return { ok: true };
}

function checkPlatformConstraints(platform, caption) {
  const limits = PLATFORM_LIMITS[platform];
  if (!limits) return { ok: true };

  if (caption.length > limits.caption_max) {
    return {
      ok: false,
      error: `Caption exceeds ${platform} limit of ${limits.caption_max} chars (got ${caption.length})`,
    };
  }
  const hashtagCount = (caption.match(/#\w+/g) ?? []).length;
  if (hashtagCount > limits.hashtag_max) {
    return {
      ok: false,
      error: `Caption has ${hashtagCount} hashtags, exceeds ${platform} max of ${limits.hashtag_max}`,
    };
  }
  return { ok: true };
}

async function checkUrlReachable(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Response helpers ─────────────────────────────────────────────────────────

function rateLimitedResponse(retryAfterSec) {
  const retry = retryAfterSec ?? 60;
  return {
    statusCode: 429,
    headers: { 'Content-Type': 'application/json', 'Retry-After': String(retry) },
    body: JSON.stringify({
      ok: false,
      error_code: ERR.RATE_LIMITED,
      error_message: `Rate limit. Wait ${retry}s.`,
      retry_safe: true,
      retryAfter: retry,
    }),
  };
}

function jsonError(statusCode, code, message, extra = {}) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ok: false,
      error_code: code,
      error_message: message,
      retry_safe: statusCode >= 500 || code === ERR.RATE_LIMITED || code === ERR.BUFFER_RATE_LIMITED,
      ...extra,
    }),
  };
}

// Exported for tests — the handler is the only public surface in production.
export const __internals = {
  validatePayload,
  checkPlatformConstraints,
  buildCreatePostInput,
  PLATFORM_LIMITS,
  CANON_THRESHOLD_HARD,
  CANON_THRESHOLD_SOFT,
  ERR,
};
