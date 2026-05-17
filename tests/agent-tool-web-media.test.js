// web_search / web_fetch / generate_image / voice_tts — all four mock the
// global fetch and exercise the success + not-configured paths.

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('web_search', () => {
  it('returns "not configured" when TAVILY_API_KEY missing', async () => {
    delete process.env.TAVILY_API_KEY;
    const { web_search } = await import('../netlify/functions/_shared/agent-tools/tools/web.js');
    const res = await web_search.execute({ query: 'hi' });
    expect(res.error).toMatch(/not configured/);
    expect(res.results).toEqual([]);
  });

  it('parses Tavily response into normalized results', async () => {
    process.env.TAVILY_API_KEY = 'tvly-test';
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        answer: 'forty-two',
        results: [
          { title: 'A', url: 'https://a', content: 'snippet A' },
          { title: 'B', url: 'https://b', snippet: 'snippet B' },
        ],
      }),
    }));
    const { web_search } = await import('../netlify/functions/_shared/agent-tools/tools/web.js');
    const res = await web_search.execute({ query: 'meaning of life' });
    expect(res.results).toHaveLength(2);
    expect(res.results[0].snippet).toBe('snippet A');
    expect(res.answer).toBe('forty-two');
  });
});

describe('web_fetch', () => {
  it('rejects non-http URLs', async () => {
    const { web_fetch } = await import('../netlify/functions/_shared/agent-tools/tools/web.js');
    const res = await web_fetch.execute({ url: 'file:///etc/passwd' });
    expect(res.error).toMatch(/http/);
  });

  it('strips script tags and reports status', async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: new Map([['content-type', 'text/html']]),
      text: async () => '<html><script>evil()</script><body>hi</body></html>',
    }));
    // fetch's Response uses headers.get; our mock uses Map which has .get.
    const { web_fetch } = await import('../netlify/functions/_shared/agent-tools/tools/web.js');
    const res = await web_fetch.execute({ url: 'https://example.com' });
    expect(res.status).toBe(200);
    expect(res.html).not.toContain('<script>');
    expect(res.html).toContain('hi');
  });
});

describe('generate_image', () => {
  it('errors when FAL_API_KEY missing', async () => {
    delete process.env.FAL_API_KEY;
    const { generate_image } = await import('../netlify/functions/_shared/agent-tools/tools/media.js');
    const res = await generate_image.execute({ prompt: 'a cat' });
    expect(res.error).toMatch(/not configured/);
  });

  it('proxies to fal.ai and surfaces the URL', async () => {
    process.env.FAL_API_KEY = 'fal_test';
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ images: [{ url: 'https://fal.media/abc.png' }] }),
      text: async () => '',
    }));
    const { generate_image } = await import('../netlify/functions/_shared/agent-tools/tools/media.js');
    const res = await generate_image.execute({ prompt: 'a cat', aspect: '1:1' });
    expect(res.url).toBe('https://fal.media/abc.png');
    expect(res.cost_credits).toBeGreaterThan(0);
  });
});

describe('voice_tts', () => {
  it('errors when OPENAI_API_KEY missing', async () => {
    delete process.env.OPENAI_API_KEY;
    const { voice_tts } = await import('../netlify/functions/_shared/agent-tools/tools/media.js');
    const res = await voice_tts.execute({ text: 'hello' });
    expect(res.error).toMatch(/not configured/);
  });

  it('synthesizes speech and returns a data URL', async () => {
    process.env.OPENAI_API_KEY = 'sk-test';
    const buf = new Uint8Array([1, 2, 3, 4, 5]);
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => buf.buffer,
      text: async () => '',
    }));
    const { voice_tts } = await import('../netlify/functions/_shared/agent-tools/tools/media.js');
    const res = await voice_tts.execute({ text: 'hello' });
    expect(res.audio_url).toMatch(/^data:audio\/mp3;base64,/);
    expect(res.bytes).toBe(5);
    expect(res.voice).toBe('onyx');
  });
});
