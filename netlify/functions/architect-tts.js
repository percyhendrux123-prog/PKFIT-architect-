import { getAnonClient } from './_shared/supabase-admin.js';

// On-demand TTS for the /assistant page. Authenticated clients POST text and
// get back an audio/mpeg body that the browser plays in an <audio> element.
//
// We return raw bytes (not a base64 data URL) so the response is half the
// size and the browser can stream-decode while the rest is still on the wire.
// The handler is intentionally simple: one OpenAI tts-1-hd call, no caching,
// no retries. Per-message caching lives in the client.

const MAX_TEXT_CHARS = 4000;
const ALLOWED_VOICES = new Set(['onyx', 'alloy', 'echo', 'fable', 'nova', 'shimmer']);
const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function authenticate(req) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    const err = new Error('Missing Authorization bearer token');
    err.statusCode = 401;
    throw err;
  }
  const token = header.slice('Bearer '.length).trim();
  const anon = getAnonClient();
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Invalid session');
    err.statusCode = 401;
    throw err;
  }
  return data.user;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  try {
    await authenticate(req);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.statusCode ?? 401,
      headers: JSON_HEADERS,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: 'TTS not configured — OPENAI_API_KEY missing' }),
      { status: 503, headers: JSON_HEADERS },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const rawText = typeof body?.text === 'string' ? body.text : '';
  const text = rawText.trim();
  if (!text) {
    return new Response(JSON.stringify({ error: 'text is required' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const voice = ALLOWED_VOICES.has(body?.voice) ? body.voice : 'onyx';
  const speed = Number.isFinite(body?.speed) ? Math.max(0.25, Math.min(4.0, body.speed)) : 1.0;
  const truncated = text.slice(0, MAX_TEXT_CHARS);

  try {
    const upstream = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: truncated,
        voice,
        speed,
        response_format: 'mp3',
      }),
    });

    if (!upstream.ok) {
      const errText = await upstream.text();
      return new Response(
        JSON.stringify({
          error: `OpenAI tts ${upstream.status}`,
          detail: errText.slice(0, 400),
        }),
        { status: 502, headers: JSON_HEADERS },
      );
    }

    const buf = await upstream.arrayBuffer();
    return new Response(buf, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'private, no-store',
        'X-Voice': voice,
        'X-Char-Count': String(truncated.length),
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ error: `TTS request failed: ${e?.message ?? String(e)}` }),
      { status: 500, headers: JSON_HEADERS },
    );
  }
};
