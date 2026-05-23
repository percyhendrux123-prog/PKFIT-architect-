import { supabase } from './supabaseClient';

async function authHeader() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function getAuthHeaders() {
  return authHeader();
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

// Strip the data: URL prefix Gemini doesn't want when sending inline data.
function stripDataUrl(maybeDataUrl) {
  if (typeof maybeDataUrl !== 'string') return maybeDataUrl;
  const m = maybeDataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) return maybeDataUrl;
  return m[2];
}

export const gemini = {
  // image: base64 (with or without data: prefix); mimeType: image/jpeg etc.
  mealPhoto: ({ image, mimeType }) =>
    callFunction('gemini-meal-photo', { image: stripDataUrl(image), mimeType }),
  // audio: base64; mimeType: audio/webm etc.
  voiceTurn: ({ audio, mimeType }) =>
    callFunction('gemini-voice-turn', { audio: stripDataUrl(audio), mimeType }),
  // video: base64; mimeType: video/mp4 etc.; exercise: optional string label.
  formCheck: ({ video, mimeType, exercise }) =>
    callFunction('gemini-form-check', { video: stripDataUrl(video), mimeType, exercise }),
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

async function streamFromEndpoint(endpoint, { conversationId, message, onEvent, signal }) {
  const headers = {
    'Content-Type': 'application/json',
    Accept: 'text/event-stream',
    ...(await authHeader()),
  };
  const res = await fetch(`/.netlify/functions/${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ conversationId, message }),
    signal,
  });

  if (!res.ok || !res.body) {
    const text = await res.text().catch(() => '');
    let payload;
    try { payload = JSON.parse(text); } catch { payload = { error: text || `HTTP ${res.status}` }; }
    throw new Error(payload?.message || payload?.error || `Stream failed (${res.status})`);
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

// Stream the assistant reply token by token. `onEvent` is called with
// { event: 'meta'|'delta'|'done'|'error', data: ... } as frames arrive.
export async function streamAssistant(args) {
  return streamFromEndpoint('client-assistant', args);
}

// Owner-agentic stream. Emits the same base events plus tool_call, tool_result,
// approval_request, soft_prompt, usage. Owner-only on the server (OWNER_EMAILS).
export async function streamAgentAssistant(args) {
  return streamFromEndpoint('agent-assistant', args);
}

export const billing = {
  createCheckout: (input) => callFunction('create-checkout-session', input),
  createPortal: (input) => callFunction('create-portal-session', input),
};

export const account = {
  exportData: () => callFunction('export-my-data', {}),
  deleteAccount: () => callFunction('delete-my-account', { confirm: 'DELETE' }),
};

export const coach = {
  exportClient: (clientId) => callFunction('coach-export-client', { clientId }),
};

export const profileApi = {
  // Update intake / medical / consent / name. Medical is encrypted at rest.
  update: (input) => callFunction('update-profile', input),
  getMedical: () => callFunction('get-my-medical', {}),
};

export const apify = {
  importTrainerize: (sourceUrl) => callFunction('apify-import', { sourceUrl }),
};

export const images = {
  generate: ({ prompt, model, aspect_ratio, num_images, style_prompt }) =>
    callFunction('generate-image', { prompt, model, aspect_ratio, num_images, style_prompt }),
};

// Operator → Architect upload. POST multipart to /architect-upload.
// Returns { upload_id, signed_url, expires_at, mime, bytes, kind, ... }.
// Frontend prefixes the next user message with [image attached: …] or
// [file attached: …] so the agent's tool-use loop knows which analyzer to
// call (analyze_image / analyze_document).
export async function uploadArchitectFile({ file, contextTag } = {}) {
  if (!file) throw new Error('file required');
  const form = new FormData();
  form.append('file', file, file.name || 'upload.jpg');
  if (contextTag) form.append('context_tag', contextTag);
  const headers = await authHeader();
  const res = await fetch('/.netlify/functions/architect-upload', {
    method: 'POST',
    headers,
    body: form,
  });
  const text = await res.text();
  let payload;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  if (!res.ok) {
    throw new Error(payload?.message || payload?.error || `Upload failed (${res.status})`);
  }
  return payload;
}

export const uploadArchitectImage = uploadArchitectFile;
