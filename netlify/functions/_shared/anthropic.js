import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

let client = null;
export function getAnthropic() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  client = new Anthropic({ apiKey });
  return client;
}

// Resolve the prompt file across dev and the Netlify Lambda bundle. esbuild
// can relocate _shared/anthropic.js, so import.meta.url's dirname doesn't always
// land at netlify/functions/_shared/. Try the most likely candidates in order
// and surface every path tried if none match — that error is far easier to
// diagnose than the bare ENOENT we used to throw.
export function loadPrompt(name) {
  const candidates = [
    resolve(here, '..', '_prompts', name),                         // dev: functions/_shared/ -> ../_prompts
    resolve(here, '..', 'functions', '_prompts', name),            // bundle: netlify/_shared/ -> ../functions/_prompts
    resolve(here, '_prompts', name),                                // co-located
    resolve(process.cwd(), 'netlify', 'functions', '_prompts', name),
    resolve(process.cwd(), 'netlify', '_prompts', name),
  ];
  let lastErr;
  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `loadPrompt: could not find ${name}. Tried: ${candidates.join(', ')}. Last error: ${lastErr?.message}`,
  );
}

// Latest Claude Sonnet 4 model. "claude-sonnet-4" in the brief maps to this
// dated ID so a dated model is pinned in production.
export const MODEL = 'claude-sonnet-4-5-20250929';

// Strip characters that violate PKFIT voice (emoji, exclamation points).
// Safe to run per-chunk: only character-level substitutions, no trim.
export function sanitizeVoice(text) {
  if (!text) return text;
  return text
    .replace(/!/g, '.')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2700}-\u{27BF}]/gu, '');
}

// Full-reply cleanup: sanitize + trim (for non-streaming paths).
export function bannedTokensCleanup(text) {
  if (!text) return text;
  return sanitizeVoice(text).trim();
}
