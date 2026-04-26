import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { generateWithMedia } from './_shared/gemini.js';
import { checkRateLimit } from './_shared/rate-limit.js';

// Voice → transcript. Body: { audio: <base64>, mimeType: 'audio/webm' }.
// Returns: { transcript: string }.
//
// The client posts the recording, gets a transcript back, then sends the
// transcript through the existing /client-assistant streaming endpoint.
// Splitting transcribe + chat keeps the streaming path unchanged.

const PROMPT = [
  'Transcribe the spoken audio verbatim. Return only the transcript, no',
  'speaker labels, no timestamps, no commentary. If the audio is silent or',
  'unintelligible, return an empty string.',
].join(' ');

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, role } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');
    const audio = body.audio;
    const mimeType = body.mimeType || 'audio/webm';
    if (!audio || typeof audio !== 'string') {
      return jsonResponse(400, { error: 'audio (base64) required' });
    }
    if (!/^audio\/(webm|mp4|mpeg|wav|ogg|flac|m4a|aac)$/i.test(mimeType)) {
      return jsonResponse(400, { error: 'Unsupported audio type' });
    }

    const limit = role === 'owner' ? { allowed: true } : await checkRateLimit({
      userId: user.id,
      bucket: 'gemini-voice-turn',
      max: 60,
      windowSec: 3600,
    });
    if (!limit.allowed) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfterSec ?? 60) },
        body: JSON.stringify({ error: `Rate limit. Wait ${limit.retryAfterSec ?? 60}s.` }),
      };
    }

    const transcript = (await generateWithMedia({
      role,
      prompt: PROMPT,
      data: audio,
      mimeType,
      generationConfig: { temperature: 0.0 },
    }))?.trim() ?? '';

    return jsonResponse(200, { transcript });
  } catch (e) {
    return errorResponse(e);
  }
};
