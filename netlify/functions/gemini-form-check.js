import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { generateWithMedia, parseJsonLoose } from './_shared/gemini.js';
import { checkRateLimit } from './_shared/rate-limit.js';

// Form-check on a short lift video. Body: { video: <base64>, mimeType:
// 'video/mp4', exercise: 'back squat' }. Returns:
//   { cues: [{ tag, severity, note }], summary, fix_priority }.
//
// Voice constraint: the prompt enforces PKFIT's Quiet Assassin tone so the
// output reads like the rest of the app. No emoji, no exclamation points.

function buildPrompt(exercise) {
  return [
    `You are reviewing a lifting video clip of: ${exercise || 'an unknown lift'}.`,
    '',
    'Watch the clip and identify form deviations. Use mechanism-first language.',
    'Voice rules: no emoji, no exclamation points, no hype, no rhetorical',
    'questions. State what is happening and what to change.',
    '',
    'Return ONLY a JSON object (no prose, no markdown) with this shape:',
    '{',
    '  "cues": [{ "tag": string, "severity": "low"|"med"|"high", "note": string }],',
    '  "summary": string,',
    '  "fix_priority": string',
    '}',
    '',
    '- cues: 1 to 5 entries; tag is short (e.g. "knee valgus", "bar path",',
    '  "depth", "spinal flexion"); note is one specific sentence.',
    '- summary: one sentence overview.',
    '- fix_priority: the single highest-leverage cue to address first.',
  ].join('\n');
}

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, role } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');
    const video = body.video;
    const mimeType = body.mimeType || 'video/mp4';
    const exercise = typeof body.exercise === 'string' ? body.exercise.slice(0, 80) : '';
    if (!video || typeof video !== 'string') {
      return jsonResponse(400, { error: 'video (base64) required' });
    }
    if (!/^video\/(mp4|quicktime|webm|mpeg)$/i.test(mimeType)) {
      return jsonResponse(400, { error: 'Unsupported video type' });
    }

    const limit = role === 'owner' ? { allowed: true } : await checkRateLimit({
      userId: user.id,
      bucket: 'gemini-form-check',
      max: 20,
      windowSec: 3600,
    });
    if (!limit.allowed) {
      return {
        statusCode: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': String(limit.retryAfterSec ?? 60) },
        body: JSON.stringify({ error: `Rate limit. Wait ${limit.retryAfterSec ?? 60}s.` }),
      };
    }

    const text = await generateWithMedia({
      role,
      prompt: buildPrompt(exercise),
      data: video,
      mimeType,
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    });
    const parsed = parseJsonLoose(text);
    if (!parsed?.cues) {
      return jsonResponse(502, { error: 'Vision returned unparseable form check', raw: text?.slice(0, 200) });
    }
    return jsonResponse(200, parsed);
  } catch (e) {
    return errorResponse(e);
  }
};
