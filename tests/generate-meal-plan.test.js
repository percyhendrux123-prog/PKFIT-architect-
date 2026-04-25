// Tests for netlify/functions/generate-meal-plan.js

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
  const mod = await import('../netlify/functions/generate-meal-plan.js');
  return mod.handler;
}

beforeEach(() => {
  supabaseMock.__reset();
  anthropicMock.messages.create.mockReset();
});

describe('generate-meal-plan', () => {
  it('rejects non-POST with 405', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ method: 'PUT' }));
    expect(res.statusCode).toBe(405);
  });

  it('rejects unauthenticated requests', async () => {
    stubInvalidUser(supabaseMock);
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
  });

  it('forbids cross-client generation by a non-coach', async () => {
    stubAuthenticatedUser(supabaseMock, { userId: 'me', role: 'client' });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { clientId: 'other' } }));
    expect(res.statusCode).toBe(403);
  });

  it('happy path: parses plan, inserts one row per meal per day', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            days: [
              {
                day: 'Mon',
                meals: [
                  { meal_type: 'breakfast', items: ['oats'], macros: { p: 30 } },
                  { meal_type: 'lunch', items: ['chicken'], macros: { p: 50 } },
                ],
              },
              {
                day: 'Tue',
                meals: [{ meal_type: 'dinner', items: ['salmon'], macros: { p: 40 } }],
              },
            ],
          }),
        },
      ],
    });

    let mealsInsertArgs = null;
    supabaseMock.__setHandler(({ table, op, args }) => {
      if (table === 'profiles' && op === 'select') {
        return { data: { id: 'user-123', role: 'client' }, error: null };
      }
      if (table === 'rate_limits') return { data: null, error: null };
      if (table === 'meals' && op === 'insert') {
        mealsInsertArgs = args.rows;
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { kcal_target: 2200 } }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).plan.days).toHaveLength(2);
    expect(mealsInsertArgs).toHaveLength(3); // 2 + 1 meals
    expect(mealsInsertArgs[0]).toMatchObject({
      client_id: 'user-123',
      day: 'Mon',
      meal_type: 'breakfast',
    });
  });

  it('returns 502 when AI plan has no days', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [{ text: '{"days":null}' }],
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(502);
  });

  it('extracts JSON from prose-wrapped AI output', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [
        {
          text: 'Sure thing.\n\n{"days":[{"day":"Wed","meals":[]}]}\n\nDone.',
        },
      ],
    });
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'profiles' && op === 'select') {
        return { data: { id: 'user-123', role: 'client' }, error: null };
      }
      if (table === 'rate_limits') return { data: null, error: null };
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).plan.days[0].day).toBe('Wed');
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
    const mod = await import('../netlify/functions/generate-meal-plan.js');
    const res = await mod.handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/ANTHROPIC_API_KEY/);
  });
});
