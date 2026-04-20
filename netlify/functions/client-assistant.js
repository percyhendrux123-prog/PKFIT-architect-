import { requireUser, jsonResponse, errorResponse } from './_shared/auth.js';
import { getAnthropic, loadPrompt, MODEL, bannedTokensCleanup } from './_shared/anthropic.js';

export const handler = async (event) => {
  if (event.httpMethod !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });
  try {
    await requireUser(event);
    const body = JSON.parse(event.body || '{}');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.length === 0) return jsonResponse(400, { error: 'messages required' });

    const sanitized = messages
      .filter((m) => m && typeof m.content === 'string' && m.content.trim())
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content.slice(0, 8000),
      }));

    const system = loadPrompt('pkfit-system.md') + '\n\n' + loadPrompt('client-assistant.md');

    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system,
      messages: sanitized,
    });

    const text = resp.content?.[0]?.text ?? '';
    const reply = bannedTokensCleanup(text);
    return jsonResponse(200, { reply });
  } catch (e) {
    return errorResponse(e);
  }
};
