import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { generateWithMedia, parseJsonLoose } from './_shared/gemini.js';
import { checkRateLimit } from './_shared/rate-limit.js';

// Snap-a-meal estimator. Body: { image: <base64>, mimeType: 'image/jpeg' }.
// Returns: { items: [{name, grams, kcal, p, c, f}], total: {kcal,p,c,f},
//           confidence: 0..1, notes }.
//
// The user confirms or edits the result before it's persisted; the client
// app pre-fills the Meals form. We never write directly from this endpoint.

const PROMPT = [
  'You are a sports nutritionist. The image shows a meal.',
  '',
  'Identify each visible food item, estimate its weight in grams, and compute',
  'kilocalories and macronutrients (protein, carbs, fat — grams) using',
  'standard published values. Use US units. Be specific (e.g. "grilled',
  'chicken breast" not "chicken").',
  '',
  'Return ONLY a JSON object with this exact shape (no prose, no markdown):',
  '{',
  '  "items": [{ "name": string, "grams": number, "kcal": number,',
  '             "p": number, "c": number, "f": number }],',
  '  "total": { "kcal": number, "p": number, "c": number, "f": number },',
  '  "confidence": number,',
  '  "notes": string',
  '}',
  '',
  'confidence is 0-1 reflecting how clearly the food + portion are visible.',
  'notes is short — at most one sentence — flag any guesses or ambiguity.',
].join('\n');

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user, role } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');
    const image = body.image;
    const mimeType = body.mimeType || 'image/jpeg';
    if (!image || typeof image !== 'string') {
      return jsonResponse(400, { error: 'image (base64) required' });
    }
    if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(mimeType)) {
      return jsonResponse(400, { error: 'Unsupported image type' });
    }

    const limit = role === 'owner' ? { allowed: true } : await checkRateLimit({
      userId: user.id,
      bucket: 'gemini-meal-photo',
      max: 30,
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
      prompt: PROMPT,
      data: image,
      mimeType,
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    });

    const parsed = parseJsonLoose(text);
    if (!parsed?.items) {
      return jsonResponse(502, { error: 'Vision returned unparseable estimate', raw: text?.slice(0, 200) });
    }
    return jsonResponse(200, parsed);
  } catch (e) {
    return errorResponse(e);
  }
};
