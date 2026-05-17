// web_search + web_fetch
//
// Tavily by default. If TAVILY_API_KEY isn't set, the tool returns a
// structured "not configured" error so Percy knows to install the key.

import { RISK } from '../risk.js';

export const web_search = {
  name: 'web_search',
  description:
    'Search the web via Tavily. Returns up to 10 results: { title, url, snippet }. Use when you need ' +
    'current information beyond your training data.',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      max_results: { type: 'integer', description: 'Default 5, max 10.' },
    },
    required: ['query'],
  },
  async execute({ query, max_results = 5 }) {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return {
        error: 'web_search not configured — set TAVILY_API_KEY in env (Tavily.com → API key, free tier ok).',
        results: [],
      };
    }
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: apiKey,
          query: String(query).slice(0, 400),
          max_results: Math.max(1, Math.min(10, max_results)),
          search_depth: 'basic',
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { error: `Tavily error ${res.status}: ${errText.slice(0, 400)}` };
      }
      const data = await res.json();
      const results = (data?.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        snippet: r.content ?? r.snippet ?? '',
      }));
      return {
        results,
        answer: data?.answer ?? null,
        summary: `Tavily: ${results.length} result(s) for "${String(query).slice(0, 60)}".`,
      };
    } catch (e) {
      return { error: `web_search failed: ${e?.message ?? String(e)}` };
    }
  },
};

export const web_fetch = {
  name: 'web_fetch',
  description:
    'Fetch a single URL and return its body. Follows up to 5 redirects. Strips JavaScript. Returns ' +
    'status, content_type, and html (truncated to 200_000 chars).',
  risk: RISK.LOW,
  approval: 'autonomous',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      max_chars: { type: 'integer' },
    },
    required: ['url'],
  },
  async execute({ url, max_chars = 200_000 }) {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) {
      return { error: 'url must be an http(s) URL' };
    }
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: { 'User-Agent': 'PKFIT-Architect-Agent/1.0' },
      });
      const content_type = res.headers.get('content-type') ?? 'application/octet-stream';
      const text = await res.text();
      const trimmed = text
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .slice(0, max_chars);
      return {
        status: res.status,
        content_type,
        html: trimmed,
        bytes: text.length,
        truncated: text.length > max_chars,
        summary: `Fetched ${url} (${res.status}, ${text.length} bytes).`,
      };
    } catch (e) {
      return { error: `web_fetch failed: ${e?.message ?? String(e)}` };
    }
  },
};
