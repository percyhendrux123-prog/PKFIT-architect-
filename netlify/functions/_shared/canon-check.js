// Brand-canon check for distributor captions.
//
// Wraps Anthropic to score a caption against the PKFIT/AXIOM brand voice canon.
// Returns { score: 0.0-1.0, violations: [string], suggestions: [string] }.
//
// Thresholds (used by the caller, distribute.js):
//   score >= 0.90  → publish
//   0.70 <= score < 0.90 → publish but flag (canon_flagged in response)
//   score < 0.70   → reject with CANON_CHECK_FAILED
//
// PKFIT canon (Quiet Assassin): no emoji, no exclamation points, no hype
// adjectives ("incredible", "amazing", "transform your life"). Mechanism over
// motivation. The prompt below frames the rules so the model returns a
// consistent score.
//
// On Anthropic failure this throws — the caller treats that as INTERNAL_ERROR
// rather than a canon failure. A network blip should not cause a content
// rejection; it should cause an explicit "we couldn't check" surfaced to ops.

import { getAnthropic, MODEL } from './anthropic.js';

const CANON_RULES = `
You are a brand-canon validator for PKFIT (Percy Keith's fitness coaching brand)
and AXIOM (Percy's positioning consultancy). Both brands share a "Quiet Assassin"
voice with the following hard rules:

HARD RULES (any violation drops the score below 0.70):
- No emoji of any kind.
- No exclamation points.
- No hype adjectives ("incredible", "amazing", "life-changing", "game-changer",
  "transform your life", "unstoppable", "unleash").
- No fitness-bro cliches ("crush it", "beast mode", "no excuses", "grind").
- No false urgency ("act now", "limited time", "don't miss out").

SOFT RULES (each violation drops the score by ~0.05):
- Mechanism over motivation: explain the WHY, not the FEELING.
- Specific over vague: "deadlift bar path drifts forward at lockout" beats
  "improve your deadlift form".
- Diagnose → Program → Lock framing where applicable (DPL).
- Sentence cadence: short clauses, no rhetorical questions stacked.

Score scale:
  1.00 = perfect canon adherence
  0.90 = on-canon, minor stylistic drift
  0.70 = publishable but soft; one or two soft-rule violations
  0.50 = noticeable canon drift; multiple soft-rule violations or one near-hard
  0.00 = hard-rule violation, refuse to publish

Return ONLY a JSON object on a single line:
{"score": <float 0..1>, "violations": [<string>], "suggestions": [<string>]}

Do not wrap the JSON in markdown fences. Do not add any prose before or after.
`;

export async function canonCheck({ caption, platform, content_pillar, canon_version }) {
  const anthropic = getAnthropic();
  const userMessage = JSON.stringify({
    platform,
    content_pillar,
    canon_version,
    caption,
  });

  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: CANON_RULES,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = resp.content?.[0]?.text ?? '';
  const parsed = parseCanonJson(text);
  if (!parsed) {
    throw new Error(`canon-check: unparseable model output: ${text.slice(0, 200)}`);
  }

  const score = clamp01(Number(parsed.score));
  if (Number.isNaN(score)) {
    throw new Error(`canon-check: missing or non-numeric score in: ${text.slice(0, 200)}`);
  }

  return {
    score,
    violations: Array.isArray(parsed.violations) ? parsed.violations.map(String) : [],
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.map(String) : [],
  };
}

function parseCanonJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function clamp01(n) {
  if (Number.isNaN(n)) return NaN;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}
