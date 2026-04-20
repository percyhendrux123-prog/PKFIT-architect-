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

export function loadPrompt(name) {
  const path = resolve(here, '..', '_prompts', name);
  return readFileSync(path, 'utf8');
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
