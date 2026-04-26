import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// Resolve "here" lazily — for legacy `export const handler` functions, esbuild
// bundles to CJS where import.meta.url is undefined. Computing this at module
// load would throw before loadPrompt ever runs. Use a getter that returns null
// on any failure; the loader falls back to cwd-based candidates.
function computeHere() {
  try {
    if (typeof import.meta?.url === 'string') {
      return dirname(fileURLToPath(import.meta.url));
    }
  } catch {
    // fall through
  }
  return null;
}
const here = computeHere();

let defaultClient = null;
export function getAnthropic(apiKeyOverride) {
  if (apiKeyOverride) return new Anthropic({ apiKey: apiKeyOverride });
  if (defaultClient) return defaultClient;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY missing');
  defaultClient = new Anthropic({ apiKey });
  return defaultClient;
}

// Resolve the prompt file across dev and the Netlify Lambda bundle. Two
// independent variables can move:
//   1. esbuild can relocate _shared/anthropic.js, so import.meta.url's dirname
//      doesn't always land at netlify/functions/_shared/.
//   2. Legacy `export const handler` functions get bundled as CJS, where
//      import.meta.url is undefined and `here` resolves to null.
// Try every reasonable candidate in order and surface every path tried if
// none match — that error is far easier to diagnose than the bare ENOENT.
export function loadPrompt(name) {
  const candidates = [];
  if (here) {
    candidates.push(
      resolve(here, '..', '_prompts', name),               // dev: functions/_shared -> ../_prompts
      resolve(here, '..', 'functions', '_prompts', name),  // bundle: netlify/_shared -> ../functions/_prompts
      resolve(here, '_prompts', name),                      // co-located
    );
  }
  // Lambda runtime always has cwd === /var/task. Netlify ships included_files
  // at the same relative path under /var/task, so this is the reliable fallback
  // when import.meta.url is unavailable.
  const cwd = process.cwd();
  candidates.push(
    resolve(cwd, 'netlify', 'functions', '_prompts', name),
    resolve(cwd, 'netlify', '_prompts', name),
    resolve(cwd, '_prompts', name),
    resolve('/var/task', 'netlify', 'functions', '_prompts', name),
    resolve('/var/task', 'netlify', '_prompts', name),
  );

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

// Tier → model routing. Tier 1 ($250) gets Haiku 4.5, Tier 2 ($475) gets
// Sonnet 4.6, Tier 3 ($750) gets Opus 4.7. Trial defaults to Haiku.
export const MODEL_BY_TIER = {
  trial: 'claude-haiku-4-5-20251001',
  tier1: 'claude-haiku-4-5-20251001',
  tier2: 'claude-sonnet-4-6',
  tier3: 'claude-opus-4-7',
};

export function pickModel(tier) {
  return MODEL_BY_TIER[tier] || MODEL_BY_TIER.trial;
}

// Back-compat shim: scheduled functions and tests that don't have a caller
// tier (e.g. axiom-overseer cron) fall back to Sonnet.
export const MODEL = MODEL_BY_TIER.tier2;

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
