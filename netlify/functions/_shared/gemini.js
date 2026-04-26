import { GoogleGenerativeAI } from '@google/generative-ai';

// Tier → Gemini model. Owner gets the highest-reasoning model with the
// largest context. Everyone else gets the fast/cheap variant since tier is
// only meant to gate Anthropic spend, not Gemini multimodal access. If you
// want to reverse this, override per call site by passing `model` explicitly.
export const GEMINI_MODEL_BY_ROLE = {
  owner: 'gemini-2.5-pro',
  coach: 'gemini-2.5-flash',
  client: 'gemini-2.5-flash',
};

export function pickGeminiModel(role) {
  return GEMINI_MODEL_BY_ROLE[role] || GEMINI_MODEL_BY_ROLE.client;
}

let defaultClient = null;
export function getGemini(apiKeyOverride) {
  if (apiKeyOverride) return new GoogleGenerativeAI(apiKeyOverride);
  if (defaultClient) return defaultClient;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  defaultClient = new GoogleGenerativeAI(apiKey);
  return defaultClient;
}

// Run a prompt with one inline file (image/audio/video) and return the
// concatenated text from the first candidate. `data` is base64 (no data:
// prefix). `mimeType` examples: image/jpeg, image/png, audio/webm, audio/mp4,
// video/mp4. Errors propagate to the caller.
export async function generateWithMedia({ role, model, prompt, data, mimeType, generationConfig }) {
  const client = getGemini();
  const modelName = model || pickGeminiModel(role);
  const generative = client.getGenerativeModel({
    model: modelName,
    generationConfig: generationConfig ?? { temperature: 0.2 },
  });
  const result = await generative.generateContent([
    { inlineData: { data, mimeType } },
    { text: prompt },
  ]);
  return result.response.text();
}

// Best-effort JSON parser for Gemini responses. Strips markdown fences and
// finds the largest balanced { ... } block if the model wraps prose around
// the JSON. Returns null if nothing parses.
export function parseJsonLoose(text) {
  if (!text) return null;
  const stripped = String(text)
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  try {
    return JSON.parse(stripped);
  } catch {
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
