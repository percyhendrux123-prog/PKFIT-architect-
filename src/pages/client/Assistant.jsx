import { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, Trash2, Mic, Square, Check, X, Pin, ChevronDown, Zap, Paperclip } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { streamAssistant, streamAgentAssistant, gemini, uploadArchitectImage } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';
import { ContextPinMenu } from '../../components/ContextPinMenu';

const MAX_IMAGE_LONG_EDGE = 2048;
const IMAGE_QUALITY = 0.85;

// Client-side resize: long edge clamped to 2048px, re-encode as JPEG q85.
// Returns a File so the FormData append carries the original name.
async function resizeImageFile(file) {
  if (!file?.type?.startsWith('image/')) throw new Error('Not an image');
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
  const img = await new Promise((resolve, reject) => {
    const i = new Image();
    i.onerror = () => reject(new Error('Image decode failed'));
    i.onload = () => resolve(i);
    i.src = dataUrl;
  });
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longEdge > MAX_IMAGE_LONG_EDGE ? MAX_IMAGE_LONG_EDGE / longEdge : 1;
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas encode failed'))), 'image/jpeg', IMAGE_QUALITY);
  });
  const baseName = (file.name || 'upload').replace(/\.[^.]+$/, '');
  return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
}

const TEXTAREA_MAX_HEIGHT = 240;

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

// Parse an [ACTION:action_type|key=val|key=val] tag out of an assistant
// message. Returns null if no tag present. Used to detect when Claude is
// proposing a mutating action and render the confirm/cancel UI.
const ACTION_TAG_RE = /\[ACTION:([a-z_]+)\|([^\]]+)\]/i;
function parseAction(content) {
  if (!content) return null;
  const match = content.match(ACTION_TAG_RE);
  if (!match) return null;
  const [tag, actionType, paramsBlob] = match;
  const params = {};
  for (const pair of paramsBlob.split('|')) {
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    params[pair.slice(0, eq).trim()] = pair.slice(eq + 1).trim();
  }
  return { actionType, params, tag };
}

// Human-readable summaries of each action for the confirm card.
const ACTION_LABELS = {
  swap_exercise: (p) =>
    `Swap "${p.original_exercise_name || p.original || '?'}" for "${
      p.substitute_exercise_name || p.substitute || '?'
    }" in your current workout`,
  log_meal: (p) =>
    `Log ${p.meal_type || 'meal'}${p.items ? ` — ${String(p.items).slice(0, 80)}` : ''}`,
  log_check_in: (p) =>
    `Log a check-in for ${p.date || 'today'}${p.weight ? ` (weight ${p.weight})` : ''}`,
  message_coach: (p) =>
    `Send a message to Percy${p.urgency && p.urgency !== 'LOW' ? ` (urgency: ${p.urgency})` : ''}`,
  flag_for_review: (p) =>
    `Flag this for Percy's next review${p.note ? `: ${String(p.note).slice(0, 80)}` : ''}`,
};

// Inline player for tool_result.audio_url (voice_tts). Renders native HTML5
// audio controls — no extra wrapper styling so it inherits the assistant
// bubble's existing container. Attempts autoplay when `autoplay` is true and
// silently swallows the rejection in browsers that block it (Safari, mobile).
function AudioPlayer({ src, voice, durationSeconds, autoplay }) {
  const audioRef = useRef(null);
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !autoplay) return;
    const p = el.play();
    if (p && typeof p.then === 'function') p.catch(() => {});
  }, [src, autoplay]);

  const captionParts = [];
  if (voice) captionParts.push(voice.charAt(0).toUpperCase() + voice.slice(1));
  if (typeof durationSeconds === 'number') captionParts.push(`${durationSeconds.toFixed(1)}s`);

  return (
    <div className="mt-3">
      <audio ref={audioRef} controls preload="auto" src={src} className="w-full" />
      {captionParts.length > 0 ? (
        <div className="label mt-1 text-faint">{captionParts.join(' · ')}</div>
      ) : null}
    </div>
  );
}

async function executeAction({ conversationId, action, params }) {
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) throw new Error('Not authenticated');
  const res = await fetch('/.netlify/functions/client-assistant-action', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ conversation_id: conversationId, action, params }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || data?.error || `Action failed (${res.status})`);
  return data;
}

export default function Assistant() {
  const { user, isOwner } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pins, setPins] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  // Tracks which assistant-message-index has had its proposed action either
  // confirmed or cancelled — so we don't show the confirm UI again after the
  // client has already responded to it.
  const [resolvedActions, setResolvedActions] = useState({});
  const [actionBusy, setActionBusy] = useState(false);
  const [pinsOpen, setPinsOpen] = useState(false);
  // Owner-agentic mode (Phase 1). When the signed-in user is an owner, the
  // Assistant routes to /agent-assistant instead of /client-assistant. The
  // owner can toggle this off if they want the simpler chat-only experience.
  const [agenticMode, setAgenticMode] = useState(isOwner);
  const [agentEvents, setAgentEvents] = useState([]);  // tool calls + approvals
  // Inline audio attachments produced by voice_tts during a turn. Keyed by
  // the assistant message index they should render under. Persists across
  // turns within the same conversation view; cleared when switching threads.
  const [messageAudios, setMessageAudios] = useState({});
  const turnAssistantIdxRef = useRef(null);
  const [convUsd, setConvUsd] = useState(0);
  // Pending image attachment for the next outgoing message. Cleared after send.
  const [pendingUpload, setPendingUpload] = useState(null); // { upload_id, mime, bytes, filename, preview_url }
  const [uploading, setUploading] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Auto-resize the textarea on every input change. Reset to `auto` so the
  // browser recalculates `scrollHeight` from the actual content rather than
  // the previous (possibly larger) height, then clamp to a sensible max so
  // the textarea scrolls internally instead of pushing the form off-screen.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, TEXTAREA_MAX_HEIGHT)}px`;
  }, [input]);

  const loadConversations = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('client_id', user.id)
      .order('updated_at', { ascending: false })
      .limit(50);
    setConversations(data ?? []);
  }, [user?.id]);

  const loadMessages = useCallback(async (conversationId) => {
    if (!isSupabaseConfigured || !conversationId) {
      setMessages([]);
      setPins([]);
      return;
    }
    const [{ data: msgs }, { data: conv }] = await Promise.all([
      supabase
        .from('conversation_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true }),
      supabase
        .from('conversations')
        .select('context')
        .eq('id', conversationId)
        .maybeSingle(),
    ]);
    setMessages(
      (msgs ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    );
    // Audio attachments are ephemeral per turn (not persisted); clear when
    // switching into a historical thread.
    setMessageAudios({});
    setPins(Array.isArray(conv?.context) ? conv.context : []);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadMessages(currentId); }, [currentId, loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  function handleInputKeyDown(e) {
    // Standard chat pattern: Enter submits, Shift+Enter inserts a newline.
    // Cmd/Ctrl+Enter also submits as an explicit alternative for users used
    // to that pattern (Linear, GitHub PRs, etc).
    if (e.key !== 'Enter') return;
    if (e.shiftKey) return;
    if (transcribing) return;
    e.preventDefault();
    if (input.trim() && !busy && !recording) send(e);
  }

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text && !pendingUpload) return;
    // Prefix the outgoing message with an [image attached: …] marker so the
    // Architect's tool-use loop knows to call analyze_image(upload_id, …).
    // The marker is intentionally machine-readable; the user sees it in the
    // transcript as a small annotation above their typed text.
    const attachmentMarker = pendingUpload
      ? `[image attached: upload_id=${pendingUpload.upload_id}, mime=${pendingUpload.mime}, bytes=${pendingUpload.bytes}]`
      : '';
    const outgoing = attachmentMarker
      ? (text ? `${attachmentMarker}\n${text}` : attachmentMarker)
      : text;
    // The assistant placeholder we're about to append lands at the new length-1.
    // `messages.length` is the pre-push length; user goes there, assistant at +1.
    turnAssistantIdxRef.current = messages.length + 1;
    setMessages((m) => [...m, { role: 'user', content: outgoing }, { role: 'assistant', content: '' }]);
    setInput('');
    setPendingUpload(null);
    setBusy(true);
    setErr(null);
    setAgentEvents([]);
    let resolvedConversationId = currentId;
    const streamer = agenticMode ? streamAgentAssistant : streamAssistant;
    try {
      await streamer({
        conversationId: currentId,
        message: outgoing,
        onEvent: ({ event, data }) => {
          if (event === 'meta' && data?.conversationId) {
            resolvedConversationId = data.conversationId;
            if (!currentId) setCurrentId(data.conversationId);
            if (typeof data.conv_usd === 'number') setConvUsd(data.conv_usd);
          } else if (event === 'delta' && typeof data?.text === 'string') {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + data.text };
              }
              return next;
            });
          } else if (event === 'tool_call') {
            setAgentEvents((evts) => [...evts, { kind: 'tool_call', ...data }]);
          } else if (event === 'tool_result') {
            setAgentEvents((evts) => [...evts, { kind: 'tool_result', ...data }]);
            if (typeof data?.audio_url === 'string' && data.audio_url.startsWith('data:audio/')) {
              const idx = turnAssistantIdxRef.current;
              if (typeof idx === 'number') {
                setMessageAudios((prev) => {
                  const list = prev[idx] ?? [];
                  return {
                    ...prev,
                    [idx]: [
                      ...list,
                      {
                        id: data.tool_call_id ?? `${idx}-${list.length}`,
                        audio_url: data.audio_url,
                        voice: data.voice ?? null,
                        duration_seconds:
                          typeof data.duration_seconds === 'number' ? data.duration_seconds : null,
                      },
                    ],
                  };
                });
              }
            }
          } else if (event === 'approval_request') {
            setAgentEvents((evts) => [...evts, { kind: 'approval_request', ...data }]);
          } else if (event === 'soft_prompt') {
            setAgentEvents((evts) => [...evts, { kind: 'soft_prompt', ...data }]);
          } else if (event === 'usage') {
            // Live usage updates — quiet; conv_usd is updated by done.
          } else if (event === 'done') {
            if (typeof data?.conv_usd === 'number') setConvUsd(data.conv_usd);
          } else if (event === 'error') {
            setErr(data?.message ?? 'Stream failed');
          }
        },
      });
      await loadConversations();
      if (resolvedConversationId && resolvedConversationId === currentId) {
        // nothing to reload — messages already appended client-side
      }
    } catch (e) {
      setErr(e.message);
      // Strip the empty assistant placeholder if the stream failed outright.
      setMessages((m) => {
        const next = [...m];
        const last = next[next.length - 1];
        if (last?.role === 'assistant' && last.content === '') next.pop();
        return next;
      });
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setErr(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setErr('Microphone is not available in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size === 0) return;
        setTranscribing(true);
        try {
          const dataUrl = await blobToBase64(blob);
          const { transcript } = await gemini.voiceTurn({ audio: dataUrl, mimeType });
          if (transcript) setInput((cur) => (cur ? `${cur} ${transcript}` : transcript));
        } catch (ex) {
          setErr(ex.message);
        } finally {
          setTranscribing(false);
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch (ex) {
      setErr(ex?.message ?? 'Microphone access denied');
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state === 'recording') recorder.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  // Architect image upload (paperclip). Resize client-side, POST to the
  // upload endpoint, stash the upload_id so the next send prefixes the
  // [image attached: …] marker.
  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setErr('Only images are supported.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setErr('Image is larger than 20MB.');
      return;
    }
    setErr(null);
    setUploading(true);
    try {
      const resized = await resizeImageFile(file);
      const result = await uploadArchitectImage({ file: resized });
      setPendingUpload({
        upload_id: result.upload_id,
        mime: result.mime,
        bytes: result.bytes,
        filename: file.name,
        preview_url: result.signed_url,
      });
    } catch (ex) {
      setErr(ex?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  function clearPendingUpload() {
    setPendingUpload(null);
  }

  function startNew() {
    setCurrentId(null);
    setMessages([]);
    setMessageAudios({});
    setPins([]);
    setErr(null);
  }

  async function removeConversation(id) {
    if (!window.confirm('Delete this conversation. The exchange will be removed.')) return;
    await supabase.from('conversations').delete().eq('id', id);
    if (currentId === id) startNew();
    await loadConversations();
  }

  // Handle client confirming Claude's proposed action. Calls the server-side
  // action handler, then appends a system-style note to the conversation so
  // the client (and Claude on next turn) can see what happened.
  async function confirmAction(messageIndex, action) {
    if (!currentId || actionBusy) return;
    setActionBusy(true);
    setErr(null);
    try {
      const result = await executeAction({
        conversationId: currentId,
        action: action.actionType,
        params: action.params,
      });
      const summary = result?.summary || 'Action completed.';
      setResolvedActions((r) => ({ ...r, [messageIndex]: 'confirmed' }));
      setMessages((m) => [...m, { role: 'assistant', content: `✓ ${summary}`, _system: true }]);
      // Send confirmation echo to Claude so it can acknowledge in next turn.
      // Fire-and-forget; user can ignore the streamed "got it" if they want.
      streamAssistant({
        conversationId: currentId,
        message: `[ACTION_CONFIRMED:${action.actionType}] ${summary}`,
        onEvent: ({ event, data }) => {
          if (event === 'delta' && typeof data?.text === 'string') {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last?.role === 'assistant' && !last._system) {
                next[next.length - 1] = { ...last, content: last.content + data.text };
              } else {
                next.push({ role: 'assistant', content: data.text });
              }
              return next;
            });
          }
        },
      }).catch(() => {});
    } catch (e) {
      setErr(e.message);
      setResolvedActions((r) => ({ ...r, [messageIndex]: 'error' }));
    } finally {
      setActionBusy(false);
    }
  }

  function cancelAction(messageIndex) {
    setResolvedActions((r) => ({ ...r, [messageIndex]: 'cancelled' }));
    setMessages((m) => [
      ...m,
      { role: 'assistant', content: '✗ Action cancelled.', _system: true },
    ]);
  }

  return (
    <div className="grid min-h-[calc(100vh-160px)] grid-cols-1 gap-6 md:grid-cols-[240px_1fr] md:gap-8">
      <aside className="border border-line bg-black/20">
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <div className="label">Conversations</div>
          <button
            onClick={startNew}
            aria-label="Start a new conversation"
            className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-gold"
          >
            <Plus size={14} /> New
          </button>
        </div>
        <ul className="max-h-[60vh] overflow-y-auto md:max-h-none">
          {conversations.length === 0 ? (
            <li className="p-4 text-xs text-faint">No threads. Start one below.</li>
          ) : (
            conversations.map((c) => (
              <li key={c.id} className="group flex items-center">
                <button
                  onClick={() => setCurrentId(c.id)}
                  className={`flex-1 truncate px-4 py-3 text-left text-sm ${
                    currentId === c.id ? 'bg-black/40 text-gold' : 'text-mute hover:text-ink'
                  }`}
                >
                  <div className="truncate font-display tracking-wider2">{c.title || 'Untitled'}</div>
                  <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                    {new Date(c.updated_at).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => removeConversation(c.id)}
                  className="px-3 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-signal"
                  aria-label="Delete conversation"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))
          )}
        </ul>
      </aside>

      <section className="flex flex-col">
        <header className="mb-8">
          <div className="label mb-3">Assistant</div>
          <h1 className="font-display text-4xl tracking-wider2">The Architect</h1>
          <p className="mt-3 max-w-reading text-sm leading-relaxed text-mute">
            Mechanism over motivation. No hype. Ask the question you would ask the coach.
          </p>
          {isOwner ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 border border-line bg-black/20 px-3 py-2 text-[0.65rem] uppercase tracking-widest2 text-mute">
              <Zap size={12} className={agenticMode ? 'text-gold' : 'text-faint'} />
              <button
                type="button"
                onClick={() => setAgenticMode((v) => !v)}
                className={`underline-offset-4 hover:underline ${agenticMode ? 'text-gold' : 'text-faint'}`}
              >
                Agentic mode: {agenticMode ? 'on' : 'off'}
              </button>
              <span className="text-faint">·</span>
              <span>Conv cost: ${convUsd.toFixed(4)}</span>
              {agenticMode ? (
                <>
                  <span className="text-faint">·</span>
                  <a href="/owner/agent-log" className="hover:text-gold">Audit log →</a>
                </>
              ) : null}
            </div>
          ) : null}
        </header>

        {agentEvents.length > 0 ? (
          <div className="mb-3 max-h-44 overflow-y-auto border border-line bg-black/30 p-3 text-[0.7rem]">
            <div className="label mb-2">Agent activity</div>
            <ul className="space-y-1 text-mute">
              {agentEvents.slice(-12).map((e, idx) => {
                if (e.kind === 'tool_call') {
                  return (
                    <li key={idx} className="text-faint">
                      → <span className="text-ink">{e.name}</span>
                    </li>
                  );
                }
                if (e.kind === 'tool_result') {
                  return (
                    <li key={idx} className={e.error ? 'text-signal' : 'text-mute'}>
                      ← <span className="text-gold">{e.name}</span> {e.error ? `error: ${e.error}` : (e.summary ?? 'ok')}
                      {e.risk_level ? <span className="ml-2 text-faint">[{e.risk_level}/{e.approval_status}]</span> : null}
                    </li>
                  );
                }
                if (e.kind === 'approval_request') {
                  return (
                    <li key={idx} className="text-signal">
                      ⚠ approval required for <span className="text-gold">{e.name}</span> ({e.risk}) — reply &quot;yes&quot; to proceed
                      {e.required_token ? <span> · type <code>{e.required_token}</code></span> : null}
                    </li>
                  );
                }
                if (e.kind === 'soft_prompt') {
                  return <li key={idx} className="text-gold">${e.message ?? ''}</li>;
                }
                return null;
              })}
            </ul>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto border border-line bg-black/20 p-6">
          {messages.length === 0 ? (
            <div className="text-sm leading-relaxed text-faint">
              Start with a single, specific question. Example: why did my bench stall at 85 kg for three weeks.
            </div>
          ) : (
            <ul className="space-y-6">
              {messages.map((m, i) => {
                const action = m.role === 'assistant' && !m._system ? parseAction(m.content) : null;
                const isLastAssistant =
                  i === messages.length - 1 && m.role === 'assistant' && !m._system;
                const showActionUI = action && isLastAssistant && !resolvedActions[i];
                const visibleContent = action
                  ? m.content.replace(ACTION_TAG_RE, '').trim()
                  : m.content;
                return (
                  <li key={i} className={m.role === 'user' ? 'text-right' : ''}>
                    <div
                      className={`inline-block max-w-[80%] border p-4 text-sm ${
                        m.role === 'user'
                          ? 'border-gold text-ink'
                          : m._system
                          ? 'border-faint bg-black/10 text-faint italic'
                          : 'border-line bg-black/30 text-ink/90'
                      }`}
                    >
                      <div className="label mb-2">
                        {m.role === 'user' ? 'You' : m._system ? 'System' : 'Architect'}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{visibleContent}</div>
                      {m.role === 'assistant' && !m._system && messageAudios[i]?.length > 0
                        ? messageAudios[i].map((a, aIdx) => (
                            <AudioPlayer
                              key={a.id}
                              src={a.audio_url}
                              voice={a.voice}
                              durationSeconds={a.duration_seconds}
                              autoplay={
                                i === messages.length - 1 && aIdx === messageAudios[i].length - 1
                              }
                            />
                          ))
                        : null}
                      {showActionUI ? (
                        <div className="mt-3 border-t border-line pt-3">
                          <div className="text-[0.65rem] uppercase tracking-widest2 text-faint mb-2">
                            Action proposed
                          </div>
                          <div className="text-sm text-ink mb-3">
                            {ACTION_LABELS[action.actionType]
                              ? ACTION_LABELS[action.actionType](action.params)
                              : `Confirm action: ${action.actionType}`}
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => confirmAction(i, action)}
                              disabled={actionBusy}
                              className="flex items-center gap-1 border border-gold bg-gold/20 px-3 py-1 text-xs uppercase tracking-widest2 text-gold hover:bg-gold/30 disabled:opacity-50"
                            >
                              <Check size={12} /> {actionBusy ? 'Working' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelAction(i)}
                              disabled={actionBusy}
                              className="flex items-center gap-1 border border-line bg-black/40 px-3 py-1 text-xs uppercase tracking-widest2 text-mute hover:text-ink disabled:opacity-50"
                            >
                              <X size={12} /> Cancel
                            </button>
                          </div>
                        </div>
                      ) : null}
                      {action && resolvedActions[i] === 'confirmed' ? (
                        <div className="mt-2 text-[0.65rem] uppercase tracking-widest2 text-gold">
                          ✓ Confirmed
                        </div>
                      ) : action && resolvedActions[i] === 'cancelled' ? (
                        <div className="mt-2 text-[0.65rem] uppercase tracking-widest2 text-faint">
                          ✗ Cancelled
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <div ref={endRef} />
        </div>

        {err ? <div className="mt-3 text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}

        <div className="mt-6 border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setPinsOpen((o) => !o)}
            disabled={!currentId}
            aria-expanded={pinsOpen}
            className="flex items-center gap-2 text-[0.6rem] uppercase tracking-widest2 text-faint hover:text-mute disabled:opacity-40"
          >
            <Pin size={11} />
            <span>Context{pins.length > 0 ? ` · ${pins.length} pinned` : ''}</span>
            <ChevronDown
              size={12}
              className={`transition-transform duration-150 ${pinsOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {pinsOpen ? (
            <div className="mt-3">
              <ContextPinMenu
                userId={user?.id}
                conversationId={currentId}
                pins={pins}
                onChange={setPins}
              />
            </div>
          ) : null}
        </div>

        {pendingUpload ? (
          <div className="mt-4 flex items-center gap-3 border border-gold/40 bg-gold/5 px-3 py-2 text-xs text-mute">
            {pendingUpload.preview_url ? (
              <img
                src={pendingUpload.preview_url}
                alt="attachment preview"
                className="h-10 w-10 object-cover border border-line"
              />
            ) : null}
            <div className="flex-1 truncate">
              <div className="text-ink">{pendingUpload.filename}</div>
              <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                {pendingUpload.mime} · {Math.round(pendingUpload.bytes / 1024)} KB · attached
              </div>
            </div>
            <button
              type="button"
              onClick={clearPendingUpload}
              className="text-faint hover:text-signal"
              aria-label="Remove attachment"
            >
              <X size={14} />
            </button>
          </div>
        ) : null}

        {recording || transcribing ? (
          <div
            className="mt-4 inline-flex items-center gap-2 border border-gold/40 bg-gold/10 px-3 py-1 text-[0.65rem] uppercase tracking-widest2 text-gold"
            role="status"
            aria-live="polite"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full bg-gold ${transcribing ? 'animate-pulse' : ''}`}
              aria-hidden
            />
            {recording ? 'Listening' : 'Transcribing'}
          </div>
        ) : null}

        <form onSubmit={send} className="mt-4 flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Ask a specific question"
            disabled={transcribing}
            rows={1}
            className="flex-1 resize-none overflow-y-auto border border-line bg-black/40 px-4 py-3 font-body leading-relaxed text-ink placeholder:text-faint transition-[height] duration-150 focus:border-gold disabled:opacity-60"
            style={{ maxHeight: `${TEXTAREA_MAX_HEIGHT}px` }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChosen}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || busy || transcribing}
            aria-label="Attach image"
            className={`flex h-12 w-12 shrink-0 items-center justify-center border ${
              pendingUpload
                ? 'border-gold bg-gold/20 text-gold'
                : 'border-line bg-black/40 text-mute hover:border-gold hover:text-gold'
            } disabled:opacity-60`}
          >
            <Paperclip size={16} className={uploading ? 'animate-pulse' : ''} />
          </button>
          <button
            type="button"
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing || busy}
            aria-label={recording ? 'Stop recording' : 'Record voice'}
            aria-pressed={recording}
            className={`flex h-12 w-12 shrink-0 items-center justify-center border ${
              recording
                ? 'border-signal bg-signal/20 text-signal'
                : 'border-line bg-black/40 text-mute hover:border-gold hover:text-gold'
            } disabled:opacity-60`}
          >
            {recording ? <Square size={16} /> : <Mic size={16} />}
          </button>
          <Button type="submit" disabled={busy || (!input.trim() && !pendingUpload) || recording || transcribing}>
            {busy ? 'Thinking' : 'Send'}
          </Button>
        </form>
        <p className="mt-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
          Enter to send · Shift+Enter for newline · Cmd/Ctrl+K jumps here
        </p>
      </section>
    </div>
  );
}
