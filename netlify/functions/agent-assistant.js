// Owner-agentic assistant — full tool-use loop.
//
// This endpoint is the owner-only agentic surface. Only emails in OWNER_EMAILS
// (server-side check) or accounts with profiles.tier4_agent_owner=true can
// hit it. Everyone else gets 403.
//
// Architecture:
//   - SSE stream (same shape as client-assistant.js).
//   - Event types: meta, delta, tool_call, tool_result, approval_request, soft_prompt, done, error.
//   - Tool-use loop runs up to MAX_TOOL_ITER iterations.
//   - Token usage tracked per turn; ceilings enforced before each iteration.
//   - Conversation history reused (conversation_messages table). The full
//     tool_use/tool_result pairs are kept in memory for this turn only; only
//     the final assistant text is persisted to the table (consistent with the
//     existing client-assistant.js storage pattern).

import { getAdminClient, getAnonClient } from './_shared/supabase-admin.js';
import { getAnthropic, loadPrompt } from './_shared/anthropic.js';
import { isOwnerEmail } from './_shared/owner.js';
import {
  getAnthropicTools,
  runTool,
} from './_shared/agent-tools/index.js';
import {
  recordTokenUsage,
  checkCeilings,
  LIMITS,
} from './_shared/agent-tools/cost.js';

const MODEL = 'claude-opus-4-7';
const MAX_TOOL_ITER = 8;
const MAX_CONTEXT_MESSAGES = 30;
// Per-iteration token budget. Netlify Functions cap synchronous execution at
// 26s on Pro. Opus 4.7 at 4096 max_tokens can take 30–40s for a single
// iteration, which guarantees a mid-stream kill. 2048 keeps a single
// iteration under ~20s and lets the tool loop make at least one follow-up
// call before the function's wall-clock budget runs out.
const MAX_TOKENS_PER_TURN = 2048;

const JSON_HEADERS = { 'Content-Type': 'application/json' };

function sseEvent(event, data) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function authenticate(req) {
  const header = req.headers.get('authorization') || req.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) {
    const err = new Error('Missing Authorization bearer token');
    err.statusCode = 401;
    throw err;
  }
  const token = header.slice('Bearer '.length).trim();
  const anon = getAnonClient();
  const { data, error } = await anon.auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error('Invalid session');
    err.statusCode = 401;
    throw err;
  }
  return { user: data.user, token };
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  let auth;
  try {
    auth = await authenticate(req);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.statusCode ?? 401,
      headers: JSON_HEADERS,
    });
  }
  const { user, token: bearerToken } = auth;

  const admin = getAdminClient();
  const { data: profile } = await admin
    .from('profiles')
    .select('plan, role, tier4_agent_owner, byo_anthropic_key_encrypted')
    .eq('id', user.id)
    .maybeSingle();

  const isOwner = isOwnerEmail(user.email);
  const isTier4 = profile?.tier4_agent_owner === true;
  if (!isOwner && !isTier4) {
    return new Response(
      JSON.stringify({
        error: 'agent_gate',
        message:
          'The agentic assistant is owner-only at this time. The Agent Owner tier ($1,500/mo) is in development.',
      }),
      { status: 403, headers: JSON_HEADERS },
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
  if (!userMessage) {
    return new Response(JSON.stringify({ error: 'message required' }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }

  // Conversation resolution (shared with client-assistant.js storage).
  let conversationId = body.conversationId ?? null;
  let createdNewConv = false;
  if (conversationId) {
    const { data: conv } = await admin
      .from('conversations')
      .select('id, client_id')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv || conv.client_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }
  } else {
    const title = userMessage.slice(0, 60);
    const { data: created, error: createErr } = await admin
      .from('conversations')
      .insert({ client_id: user.id, title })
      .select()
      .maybeSingle();
    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), {
        status: 500,
        headers: JSON_HEADERS,
      });
    }
    conversationId = created.id;
    createdNewConv = true;
  }

  const { error: insertErr } = await admin.from('conversation_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
  });

  // Pull history. We persist only user/assistant text. Tool calls are not
  // stored — they're recreated per turn from the agent_actions audit if
  // needed. For Phase 1, the agent works from text history only.
  const { data: history } = await admin
    .from('conversation_messages')
    .select('role,content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(MAX_CONTEXT_MESSAGES);

  const history_messages = (history ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  // eslint-disable-next-line no-console
  console.log('[architect:first-message] agent-assistant', JSON.stringify({
    user: user.id,
    conversationId,
    createdNewConv,
    historyCount: history_messages.length,
    insertErr: insertErr?.message ?? null,
  }));

  // Ceiling check before starting.
  const pre = await checkCeilings({ userId: user.id, conversationId, tier4: isTier4, isOwner });
  if (pre.paused) {
    return new Response(JSON.stringify({ error: 'ceiling_reached', message: pre.reason }), {
      status: 429,
      headers: JSON_HEADERS,
    });
  }

  const system =
    loadPrompt('pkfit-system.md') +
    '\n\n' +
    loadPrompt('owner-agentic.md');
  const tools = getAnthropicTools();
  const anthropic = getAnthropic();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event, data) {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      }

      send('meta', { conversationId, isOwner, isTier4, conv_usd: pre.conv_usd ?? 0 });
      if (pre.soft_prompt) send('soft_prompt', { message: pre.soft_prompt });

      // Working messages array — starts with history + the new user message.
      const messages = [...history_messages];
      let finalText = '';

      try {
        for (let iter = 0; iter < MAX_TOOL_ITER; iter++) {
          // Ceiling check each iteration.
          const ceil = await checkCeilings({ userId: user.id, conversationId, tier4: isTier4, isOwner });
          if (ceil.paused) {
            send('error', { message: ceil.reason });
            break;
          }
          if (ceil.soft_prompt && iter === 0 && !pre.soft_prompt) {
            // Already sent in pre — skip duplicate.
          }

          // Stream the model call so text reaches the user as it generates.
          // Non-streaming `messages.create` waits for the full response (15–40s
          // for Opus 4.7 with sizable max_tokens), which blew past Netlify's
          // function timeout and killed the SSE stream mid-iteration.
          // Prompt caching: system prompt + tool definitions are constant
          // per conversation. Caching them drops input-token cost ~90% on
          // every turn after the first (Opus 4.7 input $15/M -> $1.50/M
          // cached). cache_control on the LAST tool implicitly caches the
          // tool array up to that point. Last-N messages are NOT cached —
          // they change every turn, so caching adds overhead with no win.
          const cachedSystem = [
            { type: 'text', text: system, cache_control: { type: 'ephemeral' } },
          ];
          const cachedTools = tools.length
            ? [
                ...tools.slice(0, -1),
                { ...tools[tools.length - 1], cache_control: { type: 'ephemeral' } },
              ]
            : tools;
          const anthStream = anthropic.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS_PER_TURN,
            system: cachedSystem,
            tools: cachedTools,
            messages,
          });

          let turnText = '';
          for await (const evt of anthStream) {
            if (
              evt.type === 'content_block_delta' &&
              evt.delta?.type === 'text_delta' &&
              typeof evt.delta.text === 'string'
            ) {
              const delta = evt.delta.text;
              if (delta) {
                turnText += delta;
                send('delta', { text: delta });
              }
            }
          }
          const response = await anthStream.finalMessage();
          if (turnText) {
            finalText += (finalText ? '\n\n' : '') + turnText;
          }

          // Track usage.
          if (response.usage) {
            await recordTokenUsage({
              userId: user.id,
              conversationId,
              model: MODEL,
              usage: response.usage,
            });
            send('usage', { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens });
          }

          // Extract tool_use blocks for the orchestration loop. Text already
          // streamed to the user above.
          const toolUseBlocks = [];
          for (const block of response.content ?? []) {
            if (block.type === 'tool_use') toolUseBlocks.push(block);
          }

          // If no tool use, we're done.
          if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
            messages.push({ role: 'assistant', content: response.content });
            break;
          }

          // Push the assistant turn (with tool_use blocks) into messages.
          messages.push({ role: 'assistant', content: response.content });

          // Execute every tool_use block in this turn.
          const toolResults = [];
          for (const tu of toolUseBlocks) {
            send('tool_call', { id: tu.id, name: tu.name, input: tu.input });
            const result = await runTool(
              { name: tu.name, args: tu.input },
              {
                userId: user.id,
                conversationId,
                messages,
                callerToken: bearerToken,
                internalBaseUrl: process.env.URL ?? process.env.DEPLOY_PRIME_URL ?? null,
              },
            );
            if (result.blocked) {
              send('approval_request', {
                tool_call_id: tu.id,
                name: tu.name,
                risk: result.blocked.risk,
                reason: result.blocked.reason,
                required_token: result.blocked.required_token ?? null,
                redacted_inputs: result.tool_result?.redacted_inputs ?? null,
                instruction: result.tool_result?.instruction ?? null,
              });
            } else {
              send('tool_result', {
                tool_call_id: tu.id,
                name: tu.name,
                risk_level: result.risk_level,
                approval_status: result.approval_status,
                audit_id: result.audit_id,
                summary: result.tool_result?.summary ?? null,
                error: result.tool_result?.error ?? null,
                // voice_tts emits playable audio; forward the URL + metadata so
                // the UI can render an inline player. Other tools won't set
                // these and they pass through as undefined.
                audio_url: result.tool_result?.audio_url ?? null,
                duration_seconds: result.tool_result?.duration_seconds ?? null,
                voice: result.tool_result?.voice ?? null,
              });
            }
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify(result.tool_result).slice(0, 24_000),
              is_error: Boolean(result.tool_result?.error),
            });
          }

          messages.push({ role: 'user', content: toolResults });
          // Loop again — Claude will see the tool results and either call
          // more tools or produce a final text response.
        }

        // Persist final assistant text.
        if (finalText) {
          await admin.from('conversation_messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: finalText,
          });
          await admin
            .from('conversations')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', conversationId);
        }

        send('done', { conv_usd: (await checkCeilings({ userId: user.id, conversationId, tier4: isTier4, isOwner })).conv_usd });
      } catch (e) {
        send('error', { message: e?.message ?? 'Agent loop failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
};

// Export limits for tests / introspection.
export { LIMITS };
