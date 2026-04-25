// Tests for netlify/functions/generate-workout.js
//
// Coverage targets (Issue #16):
//   - Auth gate: unauthenticated requests rejected
//   - Method gate: non-POST rejected
//   - Authorization: client cannot generate for another client
//   - Happy path: AI returns JSON program, function archives existing active
//     programs and inserts the new row.
//   - Missing API key fallback: when ANTHROPIC_API_KEY is missing, the
//     function returns 500 with an error (the function uses the
//     errorResponse helper, so the user gets a JSON body, not a crash).
//   - Bad AI output → 502 (unparseable program)

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from './helpers/supabase-mock.js';
import { stubAuthenticatedUser, stubInvalidUser } from './helpers/auth-mock.js';

const supabaseMock = createSupabaseMock();
const anthropicMock = {
  messages: {
    create: vi.fn(),
  },
};

vi.mock('../netlify/functions/_shared/supabase-admin.js', () => ({
  getAdminClient: () => supabaseMock,
  getAnonClient: () => supabaseMock,
}));

// Mock the anthropic shared module. Tests can override loadPrompt's behavior
// per-test via `loadPromptMock.mockReturnValueOnce(...)`.
const loadPromptMock = vi.fn(() => 'system-prompt');
vi.mock('../netlify/functions/_shared/anthropic.js', () => ({
  getAnthropic: () => anthropicMock,
  loadPrompt: (...args) => loadPromptMock(...args),
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
  const mod = await import('../netlify/functions/generate-workout.js');
  return mod.handler;
}

beforeEach(() => {
  supabaseMock.__reset();
  anthropicMock.messages.create.mockReset();
  loadPromptMock.mockReturnValue('system-prompt');
});

describe('generate-workout', () => {
  it('rejects non-POST with 405', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ method: 'GET' }));
    expect(res.statusCode).toBe(405);
  });

  it('rejects requests without an auth bearer token (401)', async () => {
    const handler = await loadHandler();
    const res = await handler(makeEvent({ headers: { authorization: undefined } }));
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/bearer/i);
  });

  it('rejects when supabase says the token is invalid (401)', async () => {
    stubInvalidUser(supabaseMock);
    const handler = await loadHandler();
    const res = await handler(makeEvent());
    expect(res.statusCode).toBe(401);
    expect(JSON.parse(res.body).error).toMatch(/invalid session/i);
  });

  it('forbids a client from generating for a different client (403)', async () => {
    stubAuthenticatedUser(supabaseMock, { userId: 'me', role: 'client' });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { clientId: 'someone-else' } }));
    expect(res.statusCode).toBe(403);
  });

  it('allows a coach to generate for any client', async () => {
    stubAuthenticatedUser(supabaseMock, { userId: 'coach-1', role: 'coach' });
    anthropicMock.messages.create.mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            title: 'Push/Pull/Legs',
            week_number: 1,
            schedule: { title: 'PPL' },
            exercises: [{ name: 'Squat', sets: 3 }],
          }),
        },
      ],
    });
    // programs.update (archive) → ok; programs.insert → returns the row.
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'profiles' && op === 'select') {
        return { data: { id: 'coach-1', role: 'coach' }, error: null };
      }
      if (table === 'rate_limits') return { data: null, error: null };
      if (table === 'programs' && op === 'insert') {
        return { data: { id: 'p-1', client_id: 'someone-else' }, error: null };
      }
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { clientId: 'someone-else' } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.program.title).toBe('Push/Pull/Legs');
    expect(body.program.id).toBe('p-1');
  });

  it('happy path: parses AI output, archives existing active, inserts new program', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [
        {
          text: JSON.stringify({
            title: 'Recomp Block',
            week_number: 2,
            schedule: { title: 'RB' },
            exercises: [],
          }),
        },
      ],
    });
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'profiles' && op === 'select') {
        return { data: { id: 'user-123', role: 'client' }, error: null };
      }
      if (table === 'rate_limits') return { data: null, error: null };
      if (table === 'programs' && op === 'insert') {
        return { data: { id: 'p-new', week_number: 2, status: 'active' }, error: null };
      }
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: { goal: 'cut', training_days: 5 } }));
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.program.id).toBe('p-new');
    expect(body.program.title).toBe('Recomp Block');

    // Archive call must have run before insert: programs.update({ status: 'archived' })
    const archive = supabaseMock.__calls.find(
      (c) => c.method === 'programs.update' && c.args[0]?.status === 'archived',
    );
    expect(archive).toBeDefined();
  });

  it('extracts JSON from prose-wrapped AI output (regex fallback)', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [
        {
          text: 'Here you go!\n\n{"title":"X","week_number":1,"schedule":{"title":"X"},"exercises":[]}\n\nGood luck.',
        },
      ],
    });
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'profiles' && op === 'select') {
        return { data: { id: 'user-123', role: 'client' }, error: null };
      }
      if (table === 'rate_limits') return { data: null, error: null };
      if (table === 'programs' && op === 'insert') {
        return { data: { id: 'p-2' }, error: null };
      }
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).program.title).toBe('X');
  });

  it('returns 502 when AI output cannot be parsed at all', async () => {
    stubAuthenticatedUser(supabaseMock);
    anthropicMock.messages.create.mockResolvedValue({
      content: [{ text: 'not json at all, no braces here' }],
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.body).error).toMatch(/unparseable/i);
  });

  it('returns 429 when the rate limit is exceeded', async () => {
    stubAuthenticatedUser(supabaseMock);
    // Override the rate_limits response so checkRateLimit reports denied.
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'profiles' && op === 'select') {
        return { data: { id: 'user-123', role: 'client' }, error: null };
      }
      if (table === 'rate_limits' && op === 'select') {
        return {
          data: { window_start: new Date().toISOString(), count: 999 },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(429);
    expect(res.headers['Retry-After']).toBeDefined();
  });

  it('returns 500 when ANTHROPIC_API_KEY is missing (no fallback path)', async () => {
    // Reset the modules so anthropic.js re-evaluates its env-read.
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;

    // Re-mock supabase-admin with the same shared mock and
    // re-mock anthropic so the real getAnthropic runs but messages.create
    // never fires (it should throw before).
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => supabaseMock,
      getAnonClient: () => supabaseMock,
    }));
    // Use the real anthropic shared module so getAnthropic() throws.
    vi.doUnmock('../netlify/functions/_shared/anthropic.js');

    stubAuthenticatedUser(supabaseMock);
    const mod = await import('../netlify/functions/generate-workout.js');
    const res = await mod.handler(makeEvent({ body: {} }));
    expect(res.statusCode).toBe(500);
    expect(JSON.parse(res.body).error).toMatch(/ANTHROPIC_API_KEY/);
  });
});
