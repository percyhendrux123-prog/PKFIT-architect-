import { getAdminClient, getAnonClient } from './_shared/supabase-admin.js';
import { getAnthropic, loadPrompt, sanitizeVoice, bannedTokensCleanup } from './_shared/anthropic.js';
import { resolveModelAndKey } from './_shared/tier.js';
import { isOwnerEmail } from './_shared/owner.js';
import { checkRateLimit } from './_shared/rate-limit.js';

const MAX_CONTEXT_MESSAGES = 24;
const ASSISTANT_RPM = 20;
const ASSISTANT_WINDOW_SEC = 60;

// Render a pinned context array into a compact text block for the system
// prompt. Each entry is { type, data } where type is 'program' | 'check_in'
// | 'review' | 'habits' | 'note'. The server never trusts the shape — it
// stringifies whatever the client stored.
function renderPinnedContext(pins) {
  if (!Array.isArray(pins) || pins.length === 0) return '';
  const sections = [];
  for (const pin of pins) {
    if (!pin || typeof pin !== 'object') continue;
    const type = String(pin.type ?? 'note');
    let block = `[${type.toUpperCase()}]`;
    try {
      block += '\n' + JSON.stringify(pin.data ?? pin, null, 2).slice(0, 4000);
    } catch {
      block += '\n(context unreadable)';
    }
    sections.push(block);
  }
  if (!sections.length) return '';
  return [
    '',
    '--- PINNED CLIENT CONTEXT (use when relevant, do not recite verbatim) ---',
    ...sections,
    '--- END PINNED CONTEXT ---',
    '',
  ].join('\n');
}

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
  return data.user;
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: JSON_HEADERS,
    });
  }

  let user;
  try {
    user = await authenticate(req);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: e.statusCode ?? 401,
      headers: JSON_HEADERS,
    });
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

  const isOwner = isOwnerEmail(user.email);

  const limit = isOwner ? { allowed: true } : await checkRateLimit({
    userId: user.id,
    bucket: 'assistant',
    max: ASSISTANT_RPM,
    windowSec: ASSISTANT_WINDOW_SEC,
  });
  if (!limit.allowed) {
    return new Response(JSON.stringify({ error: `Rate limit. Wait ${limit.retryAfterSec ?? 30}s.` }), {
      status: 429,
      headers: { ...JSON_HEADERS, 'Retry-After': String(limit.retryAfterSec ?? 30) },
    });
  }

  const admin = getAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('plan, byo_anthropic_key_encrypted')
    .eq('id', user.id)
    .maybeSingle();
  const role = isOwner ? 'owner' : profile?.role ?? 'client';
  const { model, apiKeyOverride } = resolveModelAndKey(profile, role);

  let conversationId = body.conversationId ?? null;
  let conversationContext = [];
  if (conversationId) {
    const { data: conv } = await admin
      .from('conversations')
      .select('id, client_id, context')
      .eq('id', conversationId)
      .maybeSingle();
    if (!conv || conv.client_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), {
        status: 404,
        headers: JSON_HEADERS,
      });
    }
    conversationContext = Array.isArray(conv.context) ? conv.context : [];
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
  }

  await admin.from('conversation_messages').insert({
    conversation_id: conversationId,
    role: 'user',
    content: userMessage,
  });

  const { data: history } = await admin
    .from('conversation_messages')
    .select('role,content')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(MAX_CONTEXT_MESSAGES);

  const messages = (history ?? [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

  // Owner gets a separate, unrestricted Quiet Assassin system prompt — no
  // client-coaching scope refusals (medical / legal / financial / off-topic).
  // The pkfit-system.md voice rules still apply: no emoji, no exclamation
  // points, mechanism-first.
  const system =
    loadPrompt('pkfit-system.md') +
    '\n\n' +
    loadPrompt(role === 'owner' ? 'owner-assistant.md' : 'client-assistant.md') +
    renderPinnedContext(conversationContext);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event, data) {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      }

      send('meta', { conversationId });

      let fullText = '';
      try {
        const anthropic = getAnthropic(apiKeyOverride);
        const anthStream = anthropic.messages.stream({
          model,
          max_tokens: 1024,
          system,
          messages,
        });

        for await (const evt of anthStream) {
          if (
            evt.type === 'content_block_delta' &&
            evt.delta?.type === 'text_delta' &&
            typeof evt.delta.text === 'string'
          ) {
            const delta = sanitizeVoice(evt.delta.text);
            if (delta) {
              fullText += delta;
              send('delta', { text: delta });
            }
          }
        }

        const clean = bannedTokensCleanup(fullText);
        await admin.from('conversation_messages').insert({
          conversation_id: conversationId,
          role: 'assistant',
          content: clean,
        });
        await admin
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', conversationId);

        send('done', {});
      } catch (e) {
        send('error', { message: e?.message ?? 'Stream failed' });
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
