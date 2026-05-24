// architect-tts — synthesize speech for the live voice mode in the
// Architect chat composer.
//
// POST { text: string, voice?: string, format?: 'mp3'|'opus'|'aac' }
// Auth: operator session (Bearer token). Owner or tier4_agent_owner only.
//
// Returns: audio bytes with Content-Type audio/<format>. The browser plays
// the response directly (no base64 envelope).
//
// Provider priority:
//   1. ElevenLabs — if ELEVENLABS_API_KEY and ELEVENLABS_VOICE_ID are set,
//      uses Percy's tuned voice clone.
//   2. OpenAI tts-1-hd — fallback. Default voice "onyx" (closest stock male).
//
// Keep this fast: voice mode runs sentence-by-sentence, so latency budget
// per call is ~1s for natural conversation.

import { getAdminClient, getAnonClient } from './_shared/supabase-admin.js';
import { isOwnerEmail } from './_shared/owner.js';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const ALLOWED_OPENAI_VOICES = new Set(['onyx', 'alloy', 'echo', 'fable', 'nova', 'shimmer']);
const ALLOWED_FORMATS = new Set(['mp3', 'opus', 'aac']);
const MAX_INPUT_CHARS = 1500;

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

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

async function callElevenLabs({ text, format }) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return null;
  const accept = format === 'opus' ? 'audio/ogg' : 'audio/mpeg';
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: accept,
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.2,
        use_speaker_boost: true,
      },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`elevenlabs error ${res.status}: ${detail.slice(0, 400)}`);
    err.statusCode = 502;
    throw err;
  }
  return { stream: res.body, contentType: accept, provider: 'elevenlabs' };
}

async function callOpenAI({ text, voice, format }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('TTS not configured: no OPENAI_API_KEY or ElevenLabs creds.');
    err.statusCode = 503;
    throw err;
  }
  const res = await fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'tts-1-hd',
      input: text,
      voice,
      response_format: format,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    const err = new Error(`openai tts error ${res.status}: ${detail.slice(0, 400)}`);
    err.statusCode = 502;
    throw err;
  }
  const formatToMime = { mp3: 'audio/mpeg', opus: 'audio/ogg', aac: 'audio/aac' };
  return { stream: res.body, contentType: formatToMime[format] || 'audio/mpeg', provider: 'openai' };
}

export default async (req) => {
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  let user;
  try {
    user = await authenticate(req);
  } catch (e) {
    return jsonResponse(e.statusCode ?? 401, { error: e.message });
  }

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('tier4_agent_owner')
    .eq('id', user.id)
    .maybeSingle();
  const isOwner = isOwnerEmail(user.email);
  const isTier4 = profile?.tier4_agent_owner === true;
  if (!isOwner && !isTier4) {
    return jsonResponse(403, { error: 'agent_gate', message: 'TTS is owner-only at this time.' });
  }

  let body;
  try { body = await req.json(); }
  catch { return jsonResponse(400, { error: 'invalid_json' }); }

  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!text) return jsonResponse(400, { error: 'text required' });
  const trimmedText = text.slice(0, MAX_INPUT_CHARS);

  const voiceRaw = typeof body?.voice === 'string' ? body.voice : 'onyx';
  const voice = ALLOWED_OPENAI_VOICES.has(voiceRaw) ? voiceRaw : 'onyx';
  const formatRaw = typeof body?.format === 'string' ? body.format : 'mp3';
  const format = ALLOWED_FORMATS.has(formatRaw) ? formatRaw : 'mp3';

  try {
    const eleven = await callElevenLabs({ text: trimmedText, format }).catch((e) => {
      console.warn('elevenlabs unavailable, falling back to openai:', e?.message);
      return null;
    });
    const result = eleven || (await callOpenAI({ text: trimmedText, voice, format }));
    return new Response(result.stream, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
        'Cache-Control': 'no-store',
        'X-TTS-Provider': result.provider,
      },
    });
  } catch (e) {
    return jsonResponse(e.statusCode ?? 500, { error: 'tts_failed', message: e.message });
  }
};
