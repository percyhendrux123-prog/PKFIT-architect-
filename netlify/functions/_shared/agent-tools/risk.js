// Risk-level constants + approval-gate logic for the owner agentic surface.
//
// Each tool declares one of four risk levels. The tool-use loop consults
// this map before executing.
//
//   LOW       autonomous; just log
//   MEDIUM    one-line confirm; single-tap yes
//   HIGH      bot states action in English; explicit "yes" / "go" / "approved"
//   CRITICAL  bot states action + irreversibility; typed token match
//
// The approval check inspects the most recent user message(s) in the
// conversation history (passed in by the caller) for an affirmative token.
// If absent for HIGH/CRITICAL, the tool wrapper returns a "blocked" tool
// result instructing the agent to first describe the action and wait for
// confirmation. This forces the conversational gate without a separate UI
// state machine.

export const RISK = Object.freeze({
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
});

// Tokens that count as explicit user confirmation for HIGH-risk actions.
const HIGH_AFFIRMATIVE_RE = /\b(yes|yep|yeah|yup|go|do it|proceed|approved?|confirm(ed)?|ok|okay|do that|send it|ship it|run it|fire|execute)\b/i;

// Batch-approval declarations: "yes for the next 5", "auto for write_file
// in this convo", "approve all reads", etc.
const BATCH_APPROVAL_RE = /(yes|auto|approve|allow)\s+(for\s+)?(the\s+)?(next\s+(\d+)|all|everything|this\s+session|this\s+convo|this\s+conversation)/i;
const TOOL_SCOPED_RE = /(auto|approve|allow|yes)\s+(?:for\s+)?([a-z_]+)\s+(?:in\s+)?(this\s+(convo|conversation|session))/i;

// Returns true if the previous user message includes an affirmative for
// HIGH-risk approval. We only inspect the most recent user turn (the one
// that prompted this tool call) — the agent is expected to have surfaced
// the planned action right before the user replied.
export function hasHighApproval(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return false;
  // Find the most recent user message.
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    const text = typeof m.content === 'string' ? m.content : '';
    return HIGH_AFFIRMATIVE_RE.test(text.trim());
  }
  return false;
}

// CRITICAL: requires the user to type a specific token (e.g., table name
// for DDL, or the exact env var key for production env mutations).
export function hasCriticalApproval(messages, requiredToken) {
  if (!requiredToken || typeof requiredToken !== 'string') return false;
  if (!Array.isArray(messages) || messages.length === 0) return false;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== 'user') continue;
    const text = typeof m.content === 'string' ? m.content : '';
    // Exact match (case-sensitive) of the required token, plus an
    // affirmative somewhere in the same message.
    if (!text.includes(requiredToken)) return false;
    if (!HIGH_AFFIRMATIVE_RE.test(text)) return false;
    return true;
  }
  return false;
}

// Parse batch-approval declarations from the current user message. Returns
// either { count: N }, { scope: 'all' }, { tool: 'write_file' }, or null.
export function parseBatchApproval(text) {
  if (typeof text !== 'string') return null;
  const m1 = BATCH_APPROVAL_RE.exec(text);
  if (m1) {
    const count = m1[5] ? parseInt(m1[5], 10) : null;
    if (count) return { count };
    return { scope: 'all' };
  }
  const m2 = TOOL_SCOPED_RE.exec(text);
  if (m2) return { tool: m2[2] };
  return null;
}
