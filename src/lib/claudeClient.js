import { supabase } from './supabaseClient';

async function authHeader() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function callFunction(name, body) {
  const headers = {
    'Content-Type': 'application/json',
    ...(await authHeader()),
  };
  const res = await fetch(`/.netlify/functions/${name}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {}),
  });
  const text = await res.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { raw: text };
  }
  if (!res.ok) {
    const message = payload?.error || `Function ${name} failed (${res.status})`;
    throw new Error(message);
  }
  return payload;
}

export const claude = {
  generateWorkout: (input) => callFunction('generate-workout', input),
  generateMealPlan: (input) => callFunction('generate-meal-plan', input),
  assistant: (input) => callFunction('client-assistant', input),
  weeklyReview: (input) => callFunction('generate-weekly-review', input),
};

// Parse a text/event-stream body into { event, data } frames.
function parseSseFrame(raw) {
  const lines = raw.split(/\r?\n/);
  let event = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
  }
  if (dataLines.length === 0) return null;
  let payload = null;
  try {
    payload = JSON.parse(dataLines.join('\n'));
  } catch {
    payload = { raw: dataLines.join('\n') };
  }
  return { event, data: payload };
}

// Stream the assistant reply token by token. `onEvent` is called with
// { event: 'meta'|'delta'|'done'|'error', data: ... } as frames arrive.
export async function streamAssistant({ conversationId, message, onEvent, signal }) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(await authHeader()),
  };
  const res = await fetch('/.netlify/functions/client-assistant', {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, message }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { error: text || `HTTP ${res.status}` }; }
    throw new Error(payload?.error || `Stream failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const frame = parseSseFrame(raw);
      if (frame) onEvent(frame);
    }
  }
}

export const billing = {
  createCheckout: (input) => callFunction('create-checkout-session', input),
  createPortal: (input) => callFunction('create-portal-session', input),
};

export const account = {
  exportData: () => callFunction('export-my-data', {}),
  deleteAccount: () => callFunction('delete-my-account', { confirm: 'DELETE' }),
};
