// Tests for netlify/functions/client-assistant.js
//
// This function differs from the others: it uses the Fetch API (Request /
// Response) and streams SSE chunks. We mock the Anthropic streaming client
// with an async iterable that yields a single text delta, and assert on the
// final SSE bytestream.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from './helpers/supabase-mock.js';

const supabaseMock = createSupabaseMock();
const anthropicMock = {
  messages: {
    stream: vi.fn(),
  },
};

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

function makeRequest({ method = 'POST', auth = 'Bearer tok', body = '{}' } = {}) {
  const headers = new Headers();
  if (auth) headers.set('authorization', auth);
  headers.set('content-type', 'application/json');
  return new Request('http://test.local/client-assistant', {
    method,
    headers,
    body: method === 'GET' ? undefined : body,
  });
}

async function loadHandler() {
  const mod = await import('../netlify/functions/client-assistant.js');
  return mod.default;
}

// Build an async-iterable mock stream that yields chunk events.
function fakeStream(deltas) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const d of deltas) {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: d } };
      }
    },
  };
}

async function readSse(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let out = '';
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

beforeEach(() => {
  supabaseMock.__reset();
  anthropicMock.messages.stream.mockReset();
  supabaseMock.auth.getUser = vi.fn(async () => ({
    data: { user: { id: 'user-9' } },
    error: null,
  }));
});

describe('client-assistant', () => {
  it('rejects non-POST with 405', async () => {
    const handler = await loadHandler();
    const res = await handler(makeRequest({ method: 'GET' }));
    expect(res.status).toBe(405);
  });

  it('rejects requests without an Authorization header (401)', async () => {
    const handler = await loadHandler();
    const res = await handler(makeRequest({ auth: null }));
    expect(res.status).toBe(401);
  });

  it('rejects when supabase says the token is invalid', async () => {
    supabaseMock.auth.getUser = vi.fn(async () => ({
      data: null,
      error: { message: 'bad' },
    }));
    const handler = await loadHandler();
    const res = await handler(makeRequest({ body: JSON.stringify({ message: 'hi' }) }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on malformed JSON body', async () => {
    const handler = await loadHandler();
    const res = await handler(makeRequest({ body: 'not json' }));
    expect(res.status).toBe(400);
  });

  it('requires a non-empty message', async () => {
    const handler = await loadHandler();
    const res = await handler(makeRequest({ body: JSON.stringify({ message: '   ' }) }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'message required' });
  });

  it('returns 429 when rate limit denies', async () => {
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'rate_limits' && op === 'select') {
        return {
          data: { window_start: new Date().toISOString(), count: 9999 },
          error: null,
        };
      }
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(makeRequest({ body: JSON.stringify({ message: 'hello' }) }));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).not.toBeNull();
  });

  it('rejects with 404 when conversationId belongs to another user', async () => {
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'rate_limits' && op === 'select') return { data: null, error: null };
      if (table === 'conversations' && op === 'select') {
        return { data: { id: 'c-1', client_id: 'someone-else', context: [] }, error: null };
      }
      return { data: null, error: null };
    });
    const handler = await loadHandler();
    const res = await handler(
      makeRequest({ body: JSON.stringify({ message: 'hi', conversationId: 'c-1' }) }),
    );
    expect(res.status).toBe(404);
  });

  it('happy path: streams SSE meta → delta → done events', async () => {
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'rate_limits' && op === 'select') return { data: null, error: null };
      if (table === 'conversations' && op === 'insert') {
        return { data: { id: 'conv-new' }, error: null };
      }
      if (table === 'conversation_messages' && op === 'select') {
        return { data: [{ role: 'user', content: 'hi' }], error: null };
      }
      return { data: null, error: null };
    });

    anthropicMock.messages.stream.mockReturnValue(fakeStream(['Hel', 'lo.']));

    const handler = await loadHandler();
    const res = await handler(
      makeRequest({ body: JSON.stringify({ message: 'hi' }) }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toMatch(/event-stream/);

    const sse = await readSse(res);
    expect(sse).toContain('event: meta');
    expect(sse).toContain('"conversationId":"conv-new"');
    expect(sse).toContain('event: delta');
    expect(sse).toContain('"text":"Hel"');
    expect(sse).toContain('"text":"lo."');
    expect(sse).toContain('event: done');

    // Persisted assistant message should have been written.
    const persisted = supabaseMock.__calls.find(
      (c) =>
        c.method === 'conversation_messages.insert' &&
        Array.isArray(c.args[0]) === false &&
        c.args[0]?.role === 'assistant',
    );
    expect(persisted).toBeDefined();
    expect(persisted.args[0].content).toBe('Hello.');
  });

  it('emits an SSE error event when the AI stream throws', async () => {
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'rate_limits' && op === 'select') return { data: null, error: null };
      if (table === 'conversations' && op === 'insert') {
        return { data: { id: 'conv-err' }, error: null };
      }
      if (table === 'conversation_messages' && op === 'select') {
        return { data: [{ role: 'user', content: 'hi' }], error: null };
      }
      return { data: null, error: null };
    });

    anthropicMock.messages.stream.mockImplementation(() => {
      throw new Error('rate exceeded');
    });

    const handler = await loadHandler();
    const res = await handler(
      makeRequest({ body: JSON.stringify({ message: 'hi' }) }),
    );
    const sse = await readSse(res);
    expect(sse).toContain('event: error');
    expect(sse).toContain('rate exceeded');
  });

  it('returns 500-style SSE error when ANTHROPIC_API_KEY is missing', async () => {
    vi.resetModules();
    delete process.env.ANTHROPIC_API_KEY;
    vi.doMock('../netlify/functions/_shared/supabase-admin.js', () => ({
      getAdminClient: () => supabaseMock,
      getAnonClient: () => supabaseMock,
    }));
    vi.doUnmock('../netlify/functions/_shared/anthropic.js');

    supabaseMock.auth.getUser = vi.fn(async () => ({
      data: { user: { id: 'user-9' } },
      error: null,
    }));
    supabaseMock.__setHandler(({ table, op }) => {
      if (table === 'rate_limits' && op === 'select') return { data: null, error: null };
      if (table === 'conversations' && op === 'insert') {
        return { data: { id: 'conv-x' }, error: null };
      }
      if (table === 'conversation_messages' && op === 'select') {
        return { data: [{ role: 'user', content: 'hi' }], error: null };
      }
      return { data: null, error: null };
    });

    const mod = await import('../netlify/functions/client-assistant.js');
    const res = await mod.default(
      makeRequest({ body: JSON.stringify({ message: 'hi' }) }),
    );
    // The handler returns a 200 stream; the missing key surfaces inside the
    // SSE error event because getAnthropic() throws once the stream task
    // begins.
    const sse = await readSse(res);
    expect(sse).toContain('event: error');
    expect(sse).toContain('ANTHROPIC_API_KEY');
  });
});
