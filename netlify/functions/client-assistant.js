import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAdminClient } from './_shared/supabase-admin.js';
import { getAnthropic, loadPrompt, MODEL, bannedTokensCleanup } from './_shared/anthropic.js';

const MAX_CONTEXT_MESSAGES = 24;

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    const { user } = await requireUser(event);
    const body = JSON.parse(event.body || '{}');
    const userMessage = typeof body.message === 'string' ? body.message.trim() : '';
    if (!userMessage) return jsonResponse(400, { error: 'message required' });

    const admin = getAdminClient();

    // Resolve or create the conversation.
    let conversationId = body.conversationId ?? null;
    if (conversationId) {
      const { data: conv } = await admin
        .from('conversations')
        .select('id, client_id')
        .eq('id', conversationId)
        .maybeSingle();
      if (!conv || conv.client_id !== user.id) {
        return jsonResponse(404, { error: 'Conversation not found' });
      }
    } else {
      const title = userMessage.slice(0, 60);
      const { data: created, error: createErr } = await admin
        .from('conversations')
        .insert({ client_id: user.id, title })
        .select()
        .maybeSingle();
      if (createErr) return jsonResponse(500, { error: createErr.message });
      conversationId = created.id;
    }

    // Persist the user turn.
    await admin.from('conversation_messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: userMessage,
    });

    // Pull recent history (assistant + user) for model context.
    const { data: history } = await admin
      .from('conversation_messages')
      .select('role,content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(MAX_CONTEXT_MESSAGES);

    const messages = (history ?? [])
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

    const system = loadPrompt('pkfit-system.md') + '\n\n' + loadPrompt('client-assistant.md');

    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages,
    });

    const text = resp.content?.[0]?.text ?? '';
    const reply = bannedTokensCleanup(text);

    await admin.from('conversation_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: reply,
    });
    await admin
      .from('conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return jsonResponse(200, { conversationId, reply });
  } catch (e) {
    return errorResponse(e);
  }
};
