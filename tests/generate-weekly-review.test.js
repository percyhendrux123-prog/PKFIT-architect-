// Tests for netlify/functions/generate-weekly-review.js

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from './helpers/supabase-mock.js';
import { stubAuthenticatedUser, stubInvalidUser } from './helpers/auth-mock.js';

const supabaseMock = createSupabaseMock();
const anthropicMock = { messages: { create: vi.fn() } };

vi.mock('../netlify/functions/_shared/supabase-admin.js', () => ({
  getAdminClient: () => supabaseMock,
  getAnonClient: () => supabaseMock,
}));

vi.mock('../netlify/functions/_shared/anthropic.js', () => ({
  getAnthropic: () => anthropicMock,
  loadPrompt: () => 'system',
  MODEL: 'claude-test-model',
  MODEL_BY_TIER: {
    trial: 'claude-test-model',
    tier1: 'claude-test-model',
    tier2: 'claude-test-model',
    tier3: 'claude-test-model',
  },
  pickModel: () => 'claude-test-model',
  sanitizeVoice: (t) => t,
  bannedTokensCleanup: (t) => (t ?? '').trim(),
}));

function makeEvent({ method = 'POST', headers = {}, body = {} } = {}) {
  return {
    httpMethod: method,
    headers: { authorization: 'Bearer tok', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  };
}

async function loadHandler() {
  const mod = await import('../netlify/functions/generate-weekly-review.js');
  return mod.handler;
}

// Helper: by default the function's parallel selects all return null/no-op.
function defaultHandler({ table, op }) {
  if (table === 'profiles' && op === 'select') {
    return { data: { id: 'user-123', role: 'client', plan: 'performance', loop_stage: 'identify' }, error: null };
  }
  if (table === 'rate_limits') return { data: null, error: null };
  if (table === 'check_ins') return { data: [], error: null };
  if (table === 'programs') return { data: [], error: null };
  if (table === 'workout_sessions') return { data: [], error: null };
  if (table === 'habits') return { data: null, error: null };
  if (table === 'reviews' && op === 'select') return { data: null, error: null };
  if (table === 'reviews' && op === 'upsert') {
    return { data: { id: 'rev-1', summary: 'great' }, error: null };
  }
  return { data: null, error: null };
}

beforeEach(() => {
  supabaseMock.__reset();
  anthropicMock.messages.create.mockReset();
});

describe('generate-weekly-review', () => {
  it('rejects non-POST', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ method: 'GET' }));
    expect(res.statusCode).toBe(405);
  });

  it('rejects unauthenticated requests', async () => {
    stubInvalidUser(supabaseMock);
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
  });

  it('forbids cross-client by non-coach', async () => {
    stubAuthenticatedUser(supabaseMock, { userId: 'me', role: 'client' });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { clientId: 'other' } }));
    expect(res.statusCode).toBe(403);
  });

  it('happy path: parses review JSON and upserts on (client_id, week_starting)', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            summary: 'Solid week.',
            constraints: ['knee'],
            adjustments: ['add 10g protein'],
            metrics: { adherence: 0.85 },
          }),
        },
      ],
    });
    supabaseMock.__setHandler(defaultHandler);

    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).review.summary).toBe('great');

    const upsertCall = supabaseMock.__calls.find((c) => c.method === 'reviews.upsert');
    expect(upsertCall).toBeDefined();
    expect(upsertCall.args[1]).toEqual({ onConflict: 'client_id,week_starting' });
    expect(upsertCall.args[0].summary).toBe('Solid week.');
    expect(upsertCall.args[0].constraints).toEqual(['knee']);
  });

  it('passes prior review state into the AI prompt as installed/skipped', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [{ text: '{"summary":"ok","constraints":[],"adjustments":[],"metrics":{}}' }],
    });
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'reviews' && op === 'select') {
        return {
          data: {
            week_starting: '2026-04-13',
            summary: 'prior',
            constraints: [],
            adjustments: ['take 1 rest day', 'add cardio'],
            adjustments_state: { 0: true, 1: false },
            metrics: {},
            coach_comment: 'good',
          },
          error: null,
        };
      }
      return defaultHandler({ table, op });
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(200);
    // Check the AI prompt was built with the installed/skipped split.
    const passedToAi = anthropicMock.messages.create.mock.calls[0][0];
    const userMsg = JSON.parse(passedToAi.messages[0].content);
    expect(userMsg.prior_review.adjustments_installed).toEqual(['take 1 rest day']);
    expect(userMsg.prior_review.adjustments_skipped).toEqual(['add cardio']);
  });

  it('returns 502 when AI output cannot be parsed', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [{ text: 'no json here, just words' }],
    });
    supabaseMock.__setHandler(defaultHandler);
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(502);
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    stubAuthenticatedUser(supabaseMock);
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'rate_limits' && op === 'select') {
        return {
          data: { window_start: new Date().toISOString(), count: 999 },
          error: null,
        };
      }
      return defaultHandler({ table, op });
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(429);
  });

  it('returns 500 when ANTHROPIC_API_KEY is missing', async () => {
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => supabaseMock,
      getAnonClient: () => supabaseMock,
    }));
    vi.doUnmock('../netlify/functions/_shared/anthropic.js');
    stubAuthenticatedUser(supabaseMock);
    supabaseMock.__setHandler(defaultHandler);
    const mod = await import('../netlify/functions/generate-weekly-review.js');
    const res = await mod.handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/ANTHROPIC_API_KEY/);
  });
});
