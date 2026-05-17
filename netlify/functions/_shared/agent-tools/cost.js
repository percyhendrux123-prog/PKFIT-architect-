// Per-model pricing for usage estimation. Numbers are USD per 1M tokens.
// Source: Anthropic public pricing as of 2026-05. Not authoritative — the
// real invoice wins — but accurate enough to enforce ceilings without
// blocking on an external API.

import { getAdminClient } from '../supabase-admin.js';

export const MODEL_PRICING = Object.freeze({
  // Opus 4.7 — flagship
  'claude-opus-4-7': { input: 15.0, output: 75.0, cache_read: 1.5, cache_creation: 18.75 },
  'claude-opus-4-7[1m]': { input: 15.0, output: 75.0, cache_read: 1.5, cache_creation: 18.75 },
  // Sonnet 4.6 — workhorse
  'claude-sonnet-4-6': { input: 3.0, output: 15.0, cache_read: 0.3, cache_creation: 3.75 },
  // Haiku 4.5 — fast / cheap
  'claude-haiku-4-5-20251001': { input: 1.0, output: 5.0, cache_read: 0.1, cache_creation: 1.25 },
});

// Estimate USD cost from a usage payload. Anthropic's stream emits
// `message_start` and `message_delta` events with token counts; the caller
// is expected to aggregate them and pass the totals here.
export function estimateUsd({ model, input_tokens = 0, output_tokens = 0, cache_read_tokens = 0, cache_creation_tokens = 0 }) {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['claude-sonnet-4-6'];
  const u =
    (input_tokens / 1_000_000) * pricing.input +
    (output_tokens / 1_000_000) * pricing.output +
    (cache_read_tokens / 1_000_000) * pricing.cache_read +
    (cache_creation_tokens / 1_000_000) * pricing.cache_creation;
  return Math.round(u * 10000) / 10000;
}

// Record one turn's token usage into agent_token_usage. Non-blocking on
// error (the user still gets the response).
export async function recordTokenUsage({
  userId,
  conversationId,
  model,
  usage,
}) {
  if (!userId || !usage) return null;
  try {
    const admin = getAdminClient();
    const periodMonth = new Date();
    periodMonth.setUTCDate(1);
    periodMonth.setUTCHours(0, 0, 0, 0);
    const usd = estimateUsd({
      model,
      input_tokens: usage.input_tokens ?? 0,
      output_tokens: usage.output_tokens ?? 0,
      cache_read_tokens: usage.cache_read_input_tokens ?? 0,
      cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
    });
    const { data, error } = await admin
      .from('agent_token_usage')
      .insert({
        user_id: userId,
        conversation_id: conversationId ?? null,
        period_month: periodMonth.toISOString().slice(0, 10),
        input_tokens: usage.input_tokens ?? 0,
        output_tokens: usage.output_tokens ?? 0,
        cache_read_tokens: usage.cache_read_input_tokens ?? 0,
        cache_creation_tokens: usage.cache_creation_input_tokens ?? 0,
        usd_estimate: usd,
        model,
      })
      .select('id, usd_estimate')
      .maybeSingle();
    if (error) return null;
    return data;
  } catch {
    return null;
  }
}

// Returns the running conversation total in USD (sum of agent_token_usage
// rows for this conversation_id).
export async function getConversationUsd({ userId, conversationId }) {
  if (!conversationId) return 0;
  try {
    const admin = getAdminClient();
    const { data, error } = await admin
      .from('agent_token_usage')
      .select('usd_estimate')
      .eq('user_id', userId)
      .eq('conversation_id', conversationId);
    if (error || !data) return 0;
    return data.reduce((sum, r) => sum + Number(r.usd_estimate ?? 0), 0);
  } catch {
    return 0;
  }
}

// Returns the user's monthly token total (for tier4 allowance check).
export async function getMonthlyTokens({ userId }) {
  try {
    const admin = getAdminClient();
    const periodMonth = new Date();
    periodMonth.setUTCDate(1);
    periodMonth.setUTCHours(0, 0, 0, 0);
    const { data, error } = await admin
      .from('agent_token_usage')
      .select('input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens')
      .eq('user_id', userId)
      .eq('period_month', periodMonth.toISOString().slice(0, 10));
    if (error || !data) return 0;
    return data.reduce(
      (sum, r) =>
        sum +
        Number(r.input_tokens ?? 0) +
        Number(r.output_tokens ?? 0) +
        Number(r.cache_read_tokens ?? 0) +
        Number(r.cache_creation_tokens ?? 0),
      0,
    );
  } catch {
    return 0;
  }
}

// Per-user limits.
//   - owner: no hard cap; soft prompt at $5/conversation
//   - tier4: 5M tokens/mo allowance, $0.012/1K overage, $10/conv hard cap
export const LIMITS = Object.freeze({
  OWNER_SOFT_PROMPT_USD: 5.0,
  TIER4_HARD_CAP_PER_CONV_USD: 10.0,
  TIER4_INCLUDED_TOKENS_PER_MONTH: 5_000_000,
  TIER4_OVERAGE_USD_PER_1K_TOKENS: 0.012,
});

// Returns a ceiling-check decision object:
//   { paused: boolean, reason?: string, soft_prompt?: string }
export async function checkCeilings({ userId, conversationId, tier4 = false, isOwner = false }) {
  const convUsd = await getConversationUsd({ userId, conversationId });

  if (tier4 && convUsd >= LIMITS.TIER4_HARD_CAP_PER_CONV_USD) {
    return {
      paused: true,
      reason: `Tier 4 per-conversation cap ($${LIMITS.TIER4_HARD_CAP_PER_CONV_USD.toFixed(2)}) reached. Current: $${convUsd.toFixed(2)}.`,
    };
  }

  if (isOwner && convUsd >= LIMITS.OWNER_SOFT_PROMPT_USD) {
    return {
      paused: false,
      soft_prompt: `API cost in this conversation: $${convUsd.toFixed(2)}. Continue?`,
      conv_usd: convUsd,
    };
  }

  return { paused: false, conv_usd: convUsd };
}
