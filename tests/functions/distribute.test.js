// Tests for netlify/functions/distribute.js
//
// Covers the gates the spec calls out as critical:
//   - Auth gate (401 on missing/invalid JWT)
//   - Rate limit (429 when per-minute bucket exhausted)
//   - Canon check fail-closed at 0.70
//   - Canon soft-flag between 0.70 and 0.90 (publishes, surfaces canon_flagged)
//   - schedule_at validation (past time, non-ISO)
//   - Buffer transient error → 502 with retry_safe + Slack WARN
//   - Buffer auth error → 401 + Slack CRITICAL
//   - Idempotency (409 on (producer_task_id, channel_id) match)
//   - TikTok routing → draft mode regardless of caller's schedule_mode
//   - Happy path with happy-path Buffer GraphQL response

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '../helpers/supabase-mock.js';

const supabaseMock = createSupabaseMock();
const anthropicMock = { messages: { create: vi.fn() } };
const slackMock = vi.fn(async () => ({ posted: true }));

vi.mock('../../netlify/functions/_shared/supabase-admin.js', () => ({
  getAdminClient: () => supabaseMock,
  getAnonClient: () => supabaseMock,
}));

vi.mock('../../netlify/functions/_shared/anthropic.js', () => ({
  getAnthropic: () => anthropicMock,
  MODEL: 'claude-test-model',
}));

vi.mock('../../netlify/functions/_shared/slack.js', () => ({
  slackAlert: slackMock,
}));

const FUTURE_ISO = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

function basePayload(overrides = {}) {
  return {
    platform: 'instagram',
    channel_id: 'ch_pkfit_ig',
    content_type: 'image',
    media_urls: ['https://supabase.test/storage/v1/object/sign/img.jpg?token=abc'],
    caption: 'Bar path drifts forward at lockout. Brace anterior to fix.',
    schedule_mode: 'customScheduled',
    schedule_at: FUTURE_ISO,
    metadata: {
      producer_task_id: '11111111-1111-1111-1111-111111111111',
      source_asset_id: '22222222-2222-2222-2222-222222222222',
      canon_version: 'canon-v3.2',
      content_pillar: 'PKFIT-form-cues',
      generation_model: 'claude-sonnet-4-5',
      generation_prompt_hash: 'sha256:deadbeef',
      distributor_agent_version: 'distributor-v0.4.1',
    },
    skip_canon_check: false,
    ...overrides,
  };
}

function makeEvent({ method = 'POST', headers = {}, body = basePayload() } = {}) {
  return {
    httpMethod: method,
    headers: { authorization: 'Bearer tok', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

async function loadHandler() {
  const mod = await import('../../netlify/functions/distribute.js');
  return mod.handler;
}

// Builds the supabase __setHandler that satisfies requireUser + checkRateLimit
// + the distribute idempotency select + insert. Tests override individual table
// branches by passing options.
function setupSupabaseHandler({
  user = { id: 'user-123', role: 'distributor' },
  rateLimitRow = null,
  existingDistribution = null,
  insertResult = { data: { id: 'row-uuid-1' }, error: null },
} = {}) {
  supabaseMock.auth.getUser = vi.fn(async () => ({
    data: { user: { id: user.id, email: 'distributor@axiom.test' } },
    error: null,
  }));
  supabaseMock.__setHandler(({ table, op }) => {
    if (table === 'profiles' && op === 'select') {
      return { data: { id: user.id, role: user.role }, error: null };
    }
    if (table === 'rate_limits' && op === 'select') {
      return { data: rateLimitRow, error: null };
    }
    if (table === 'rate_limits' && (op === 'upsert' || op === 'update')) {
      return { data: null, error: null };
    }
    if (table === 'distributed_posts' && op === 'select') {
      return { data: existingDistribution, error: null };
    }
    if (table === 'distributed_posts' && op === 'insert') {
      return insertResult;
    }
    return { data: null, error: null };
  });
}

function bufferSuccessJson() {
  return {
    data: {
      createPost: {
        post: {
          id: 'buffer-post-abc',
          text: 'irrelevant',
          dueAt: FUTURE_ISO,
          channelId: 'ch_pkfit_ig',
          assets: [],
        },
      },
    },
  };
}

// fetch mock that:
//   - HEAD requests to media URLs → 200
//   - POST to api.buffer.com → configurable (default success)
//   - anything else → 404
function installFetchMock({ bufferImpl } = {}) {
  const buffer = bufferImpl ?? (async () => ({
    ok: true,
    status: 200,
    json: async () => bufferSuccessJson(),
    text: async () => '',
  }));
  global.fetch = vi.fn(async (url, opts) => {
    if (opts?.method === 'HEAD') {
      return { ok: true, status: 200 };
    }
    if (typeof url === 'string' && url.startsWith('https://api.buffer.com')) {
      return buffer(url, opts);
    }
    return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
  });
  return global.fetch;
}

beforeEach(() => {
  supabaseMock.__reset();
  anthropicMock.messages.create.mockReset();
  slackMock.mockClear();
  process.env.BUFFER_ACCESS_TOKEN = 'buffer-test-token';
  // Default canon score = 0.95 (publishes cleanly)
  anthropicMock.messages.create.mockResolvedValue({
    content: [{ text: '{"score": 0.95, "violations": [], "suggestions": []}' }],
  });
});

describe('distribute — method gate', () => {
  it('rejects non-POST with 405', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ method: 'GET' }));
    expect(res.statusCode).toBe(405);
  });
});

describe('distribute — auth gate', () => {
  it('returns 401 when no Authorization header', async () => {
    const handler = await loadHandler();
    const res = await handler({ httpMethod: 'POST', headers: {}, body: JSON.stringify(basePayload()) });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when Supabase rejects the token', async () => {
    supabaseMock.auth.getUser = vi.fn(async () => ({ data: null, error: { message: 'invalid' } }));
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
  });
});

describe('distribute — rate limit', () => {
  it('returns 429 when the per-minute bucket is exhausted', async () => {
    setupSupabaseHandler({
      // Existing rate-limit row at the cap, within the current 60s window.
      rateLimitRow: { window_start: new Date().toISOString(), count: 30 },
    });
    installFetchMock();
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeDefined();
    const body = JSON.parse(res.body);
    expect(body.error_code).toBe('RATE_LIMITED');
    expect(body.retry_safe).toBe(true);
  });
});

describe('distribute — payload validation', () => {
  it('returns 400 when schedule_at is in the past', async () => {
    setupSupabaseHandler();
    installFetchMock();
    const past = new Date(Date.now() - 60_000).toISOString();
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: basePayload({ schedule_at: past }) }));
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error_code).toBe('INVALID_PAYLOAD');
    expect(body.error_message).toMatch(/future/i);
  });

  it('returns 400 when schedule_at is not a valid ISO datetime', async () => {
    setupSupabaseHandler();
    installFetchMock();
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: basePayload({ schedule_at: 'not-a-date' }) }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error_message).toMatch(/ISO 8601/);
  });

  it('returns 400 when schedule_mode is customScheduled but schedule_at is missing', async () => {
    setupSupabaseHandler();
    installFetchMock();
    const handler = await loadHandler();
    const body = basePayload();
    delete body.schedule_at;
    const res = await handler(makeEvent({ body }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error_message).toMatch(/schedule_at required/);
  });

  it('rejects unknown platform', async () => {
    setupSupabaseHandler();
    installFetchMock();
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: basePayload({ platform: 'snapchat' }) }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error_code).toBe('PLATFORM_NOT_SUPPORTED');
  });

  it('rejects caption that exceeds platform caption_max', async () => {
    setupSupabaseHandler();
    installFetchMock();
    const handler = await loadHandler();
    // Threads cap = 500
    const longCaption = 'x'.repeat(501);
    const res = await handler(makeEvent({
      body: basePayload({ platform: 'threads', caption: longCaption }),
    }));
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error_message).toMatch(/threads limit/);
  });
});

describe('distribute — canon check', () => {
  it('rejects with 422 when canon score is below the hard threshold (0.70)', async () => {
    setupSupabaseHandler();
    installFetchMock();
    anthropicMock.messages.create.mockResolvedValueOnce({
      content: [{
        text: '{"score": 0.55, "violations": ["uses exclamation point", "hype adjective: incredible"], "suggestions": ["drop the !", "swap incredible for specific mechanism"]}',
      }],
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: basePayload({ caption: 'This deadlift cue is incredible!' }) }));
    expect(res.statusCode).toBe(422);
    const body = JSON.parse(res.body);
    expect(body.error_code).toBe('CANON_CHECK_FAILED');
    expect(body.canon_score).toBeCloseTo(0.55, 2);
    expect(body.violations).toHaveLength(2);
    // Buffer must NOT have been called when canon fails closed.
    const bufferCalls = global.fetch.mock.calls.filter(
      ([url, opts]) => typeof url === 'string' && url.startsWith('https://api.buffer.com') && opts?.method === 'POST',
    );
    expect(bufferCalls).toHaveLength(0);
  });

  it('publishes but flags when canon score is between 0.70 and 0.90', async () => {
    setupSupabaseHandler();
    installFetchMock();
    anthropicMock.messages.create.mockResolvedValueOnce({
      content: [{
        text: '{"score": 0.82, "violations": ["soft cliche"], "suggestions": []}',
      }],
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.canon_flagged).toBe(true);
    expect(body.canon_violations).toEqual(['soft cliche']);
  });

  it('skips the canon call when skip_canon_check is true', async () => {
    setupSupabaseHandler();
    installFetchMock();
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: basePayload({ skip_canon_check: true }) }));
    expect(res.statusCode).toBe(200);
    expect(anthropicMock.messages.create).not.toHaveBeenCalled();
  });

  it('returns 500 INTERNAL_ERROR when canon check throws (Anthropic unavailable)', async () => {
    setupSupabaseHandler();
    installFetchMock();
    anthropicMock.messages.create.mockRejectedValueOnce(new Error('Anthropic timeout'));
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error_code).toBe('INTERNAL_ERROR');
  });
});

describe('distribute — Buffer error paths', () => {
  it('on transport failure → 502 BUFFER_API_ERROR with retry_safe + Slack WARN', async () => {
    setupSupabaseHandler();
    installFetchMock({
      bufferImpl: async () => { throw new Error('ECONNRESET'); },
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(502);
    const body = JSON.parse(res.body);
    expect(body.error_code).toBe('BUFFER_API_ERROR');
    expect(body.retry_safe).toBe(true);
    expect(slackMock).toHaveBeenCalledWith(
      'WARN',
      expect.stringMatching(/Buffer API call failed/),
    );
  });

  it('on Buffer auth error → 401 BUFFER_AUTH_ERROR + Slack CRITICAL', async () => {
    setupSupabaseHandler();
    installFetchMock({
      bufferImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({ errors: [{ message: 'Unauthorized: invalid bearer token' }] }),
        text: async () => '',
      }),
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error_code).toBe('BUFFER_AUTH_ERROR');
    expect(slackMock).toHaveBeenCalledWith(
      'CRITICAL',
      expect.stringMatching(/Buffer API auth failed/),
    );
  });

  it('on MutationError branch → 422 BUFFER_API_ERROR + Slack WARN', async () => {
    setupSupabaseHandler();
    installFetchMock({
      bufferImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          data: { createPost: { message: 'Channel disconnected — please reconnect Instagram in Buffer.' } },
        }),
        text: async () => '',
      }),
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(422);
    expect(JSON.parse(res.body).error_message).toMatch(/Channel disconnected/);
    expect(slackMock).toHaveBeenCalledWith('WARN', expect.any(String));
  });

  it('on Buffer rate limit error → 429 BUFFER_RATE_LIMITED', async () => {
    setupSupabaseHandler();
    installFetchMock({
      bufferImpl: async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          errors: [{
            message: 'Rate limit exceeded',
            extensions: { code: 'RATE_LIMIT_EXCEEDED', retryAfter: 42 },
          }],
        }),
        text: async () => '',
      }),
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(429);
    const body = JSON.parse(res.body);
    expect(body.error_code).toBe('BUFFER_RATE_LIMITED');
    expect(body.retryAfter).toBe(42);
  });
});

describe('distribute — idempotency', () => {
  it('returns 409 DUPLICATE_DISTRIBUTION when the same task already published to the channel', async () => {
    setupSupabaseHandler({
      existingDistribution: {
        id: 'row-existing',
        buffer_post_id: 'buffer-post-prior',
        scheduled_at: FUTURE_ISO,
        buffer_status: 'scheduled',
      },
    });
    installFetchMock();
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.body);
    expect(body.error_code).toBe('DUPLICATE_DISTRIBUTION');
    expect(body.existing_post_id).toBe('buffer-post-prior');
  });
});

describe('distribute — TikTok routing', () => {
  it('forces draft mode for TikTok regardless of caller schedule_mode', async () => {
    setupSupabaseHandler();
    const fetchMock = installFetchMock();
    const handler = await loadHandler();
    const res = await handler(makeEvent({
      body: basePayload({ platform: 'tiktok', schedule_mode: 'customScheduled' }),
    }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('draft');
    expect(body.note).toMatch(/TikTok/);

    // Inspect the payload sent to Buffer — mode should be 'draft', not customScheduled.
    const bufferCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.startsWith('https://api.buffer.com'),
    );
    const sentBody = JSON.parse(bufferCall[1].body);
    expect(sentBody.variables.input.mode).toBe('draft');
  });
});

describe('distribute — happy path', () => {
  it('schedules a post and returns the canonical success shape', async () => {
    setupSupabaseHandler();
    const fetchMock = installFetchMock();
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toMatchObject({
      ok: true,
      post_id: 'buffer-post-abc',
      status: 'scheduled',
      canon_flagged: false,
      distributed_post_row_id: 'row-uuid-1',
    });
    expect(body.canon_score).toBeGreaterThanOrEqual(0.9);

    // Buffer was called once with a Bearer token (redacted check: header present).
    const bufferCall = fetchMock.mock.calls.find(
      ([url]) => typeof url === 'string' && url.startsWith('https://api.buffer.com'),
    );
    expect(bufferCall[1].headers['Authorization']).toBe('Bearer buffer-test-token');
    expect(slackMock).not.toHaveBeenCalled();
  });

  it('returns 500 when BUFFER_ACCESS_TOKEN is missing', async () => {
    delete process.env.BUFFER_ACCESS_TOKEN;
    setupSupabaseHandler();
    installFetchMock();
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/BUFFER_ACCESS_TOKEN/);
  });

  it('returns 400 MEDIA_UNREACHABLE when a media URL HEAD fails', async () => {
    setupSupabaseHandler();
    global.fetch = vi.fn(async (_url, opts) => {
      if (opts?.method === 'HEAD') return { ok: false, status: 404 };
      return { ok: false, status: 404, text: async () => '', json: async () => ({}) };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error_code).toBe('MEDIA_UNREACHABLE');
  });
});
