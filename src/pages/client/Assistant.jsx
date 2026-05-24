import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Plus,
  Trash2,
  Mic,
  Square,
  Check,
  X,
  Pin,
  ChevronDown,
  Zap,
  Paperclip,
  Volume2,
  Loader2,
  History,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  streamAssistant,
  streamAgentAssistant,
  gemini,
  uploadArchitectImage,
  architectTts,
} from '../../lib/claudeClient';
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

// Compact relative time for the drawer list. Matches the DM Mono / muted feel
// of the /standard page — no "ago" suffix, just the unit (1h, 3d, 2w).
function relativeTime(iso) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Math.max(0, Date.now() - then);
  const min = Math.round(diff / 60000);
  if (min < 1) return 'now';
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  if (d < 7) return `${d}d`;
  const w = Math.round(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.round(d / 30);
  return `${mo}mo`;
}

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
  // History drawer. Replaces the always-visible sidebar from the previous
  // layout. Open via the top-left History icon or a left-edge swipe; close
  // via outside-tap, swipe-left, or selecting a conversation.
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Owner-agentic mode (Phase 1). When the signed-in user is an owner, the
  // Assistant routes to /agent-assistant instead of /client-assistant. The
  // owner can toggle this off if they want the simpler chat-only experience.
  const [agenticMode, setAgenticMode] = useState(isOwner);
  const [agentEvents, setAgentEvents] = useState([]);  // tool calls + approvals
  const [convUsd, setConvUsd] = useState(0);
  // Pending image attachment for the next outgoing message. Cleared after send.
  const [pendingUpload, setPendingUpload] = useState(null); // { upload_id, mime, bytes, filename, preview_url }
  const [uploading, setUploading] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  // Per-message text-to-speech. `audioState` tracks which message is
  // currently loading/playing; `audioRef` is the single in-flight Audio
  // element (one playback at a time); `audioCacheRef` caches blob URLs for
  // long messages so a replay doesn't re-call the TTS API; `toolTtsAudio`
  // maps a message index to a voice_tts-generated data URL when the agent
  // itself emits speech as a tool result — letting us reuse that audio
  // instead of paying for a second synthesis.
  const [audioState, setAudioState] = useState({ index: null, status: 'idle' });
  const audioRef = useRef(null);
  const audioCacheRef = useRef(new Map());
  const [toolTtsAudio, setToolTtsAudio] = useState({});

  useEffect(() => {
    const cache = audioCacheRef.current;
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
      for (const url of cache.values()) URL.revokeObjectURL(url);
      cache.clear();
    };
  }, []);

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
    setPins(Array.isArray(conv?.context) ? conv.context : []);
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadMessages(currentId); }, [currentId, loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // Lock body scroll while the drawer is open so the iOS rubber-band doesn't
  // bleed through the overlay. Restore on unmount or when it closes.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

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
    // Capture the index the assistant placeholder will occupy so we can
    // tag any voice_tts audio_url that arrives mid-stream to this exact
    // message — even if the user later scrolls back and re-plays it.
    let assistantMsgIndex = -1;
    setMessages((m) => {
      assistantMsgIndex = m.length + 1;
      return [...m, { role: 'user', content: outgoing }, { role: 'assistant', content: '' }];
    });
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
            // Architect just emitted speech inline — tie the audio to this
            // message so the speaker button replays the same bytes instead
            // of paying for a second tts-1-hd synthesis.
            if (data?.audio_url && assistantMsgIndex >= 0) {
              setToolTtsAudio((cur) => ({ ...cur, [assistantMsgIndex]: data.audio_url }));
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
    setPins([]);
    setErr(null);
    setDrawerOpen(false);
    inputRef.current?.focus();
  }

  function selectConversation(id) {
    setCurrentId(id);
    setDrawerOpen(false);
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

  // Tap-to-play TTS for any architect message. iOS Safari requires the
  // Audio element be created and play() called inside the same user-gesture
  // tick, which is exactly what this onClick handler is. We keep a single
  // active Audio instance so a second tap on a different message stops the
  // previous one before starting the new one.
  async function toggleTts(messageIndex, text) {
    const trimmed = (text ?? '').trim();
    if (!trimmed) return;

    const isPlayingThis =
      audioState.index === messageIndex && audioState.status === 'playing';
    if (isPlayingThis) {
      audioRef.current?.pause();
      audioRef.current = null;
      setAudioState({ index: null, status: 'idle' });
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setErr(null);
    setAudioState({ index: messageIndex, status: 'loading' });

    try {
      let src = toolTtsAudio[messageIndex];
      if (!src) {
        let cached = audioCacheRef.current.get(messageIndex);
        if (!cached) {
          const blob = await architectTts({ text: trimmed, voice: 'onyx' });
          cached = URL.createObjectURL(blob);
          if (trimmed.length > 500) {
            audioCacheRef.current.set(messageIndex, cached);
          }
        }
        src = cached;
      }

      const audio = new Audio(src);
      audioRef.current = audio;
      audio.onended = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setAudioState((s) =>
          s.index === messageIndex ? { index: null, status: 'idle' } : s,
        );
      };
      audio.onerror = () => {
        if (audioRef.current === audio) audioRef.current = null;
        setAudioState({ index: messageIndex, status: 'error' });
      };
      await audio.play();
      setAudioState({ index: messageIndex, status: 'playing' });
    } catch (e) {
      if (audioRef.current) audioRef.current = null;
      setAudioState({ index: messageIndex, status: 'error' });
      setErr(`Audio failed: ${e.message}`);
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-160px)] flex-col">
      {/* Minimal top icon bar — replaces the old "Assistant / THE ARCHITECT"
          header. Two 16px gold glyphs only: thread history (left) opens the
          drawer; plus (right) starts a fresh conversation. No labels, no
          banner text — the chat surface gets the whole viewport. */}
      <div className="flex items-center justify-between border-b-[0.5px] border-[#2a2a2a] px-2 py-2.5">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open conversation history"
          aria-expanded={drawerOpen}
          className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#C9A84C] transition-colors hover:bg-[#161616] active:bg-[#1f1f1f]"
        >
          <History size={16} strokeWidth={1.75} />
        </button>
        {isOwner ? (
          <button
            type="button"
            onClick={() => setAgenticMode((v) => !v)}
            className={`flex items-center gap-1.5 rounded-full border-[0.5px] px-2.5 py-1 text-[0.6rem] uppercase tracking-widest2 transition-colors ${
              agenticMode
                ? 'border-[#C9A84C]/40 bg-[#C9A84C]/5 text-[#C9A84C]'
                : 'border-[#2a2a2a] text-[#888] hover:text-[#C9A84C]'
            }`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            <Zap size={11} />
            Agent {agenticMode ? 'on' : 'off'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={startNew}
          aria-label="Start a new conversation"
          className="group flex h-9 w-9 items-center justify-center rounded-[10px] text-[#C9A84C] transition-all hover:bg-[#161616] active:scale-95 active:bg-[#1f1f1f]"
        >
          <Plus size={16} strokeWidth={1.75} className="transition-transform group-active:scale-110" />
        </button>
      </div>

      {agentEvents.length > 0 ? (
        <div className="mx-2 mt-3 max-h-44 overflow-y-auto rounded-[14px] border-[0.5px] border-[#2a2a2a] bg-[#101010] p-3 text-[0.7rem]">
          <div
            className="mb-2 text-[10px] uppercase tracking-widest2 text-[#888]"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            Agent activity
          </div>
          <ul className="space-y-1 text-[#888]">
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
                    ← <span className="text-[#C9A84C]">{e.name}</span> {e.error ? `error: ${e.error}` : (e.summary ?? 'ok')}
                    {e.risk_level ? <span className="ml-2 text-faint">[{e.risk_level}/{e.approval_status}]</span> : null}
                  </li>
                );
              }
              if (e.kind === 'approval_request') {
                return (
                  <li key={idx} className="text-signal">
                    ⚠ approval required for <span className="text-[#C9A84C]">{e.name}</span> ({e.risk}) — reply &quot;yes&quot; to proceed
                    {e.required_token ? <span> · type <code>{e.required_token}</code></span> : null}
                  </li>
                );
              }
              if (e.kind === 'soft_prompt') {
                return <li key={idx} className="text-[#C9A84C]">${e.message ?? ''}</li>;
              }
              return null;
            })}
          </ul>
        </div>
      ) : null}

      <section className="flex flex-1 flex-col px-2 pt-3">
        <div className="flex-1 overflow-y-auto rounded-[14px] border-[0.5px] border-[#2a2a2a] bg-[#0E0E0E] p-4 sm:p-5">
          {messages.length === 0 ? (
            <div className="text-sm leading-relaxed text-[#888]">
              Start with a single, specific question. Example: why did my bench stall at 85 kg for three weeks.
            </div>
          ) : (
            <ul className="space-y-4">
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
                      className={`inline-block max-w-[88%] rounded-[14px] border-[0.5px] p-4 text-sm sm:max-w-[80%] ${
                        m.role === 'user'
                          ? 'border-[#C9A84C]/40 bg-[#161616] text-ink'
                          : m._system
                          ? 'border-[#2a2a2a] bg-[#101010] text-faint italic'
                          : 'border-[#2a2a2a] bg-[#161616] text-ink/90'
                      }`}
                    >
                      <div
                        className="mb-2 text-[11px] uppercase tracking-wider text-[#C9A84C]"
                        style={{ fontFamily: "'Bebas Neue', sans-serif" }}
                      >
                        {m.role === 'user' ? 'You' : m._system ? 'System' : 'Architect'}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">{visibleContent}</div>
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
                      {m.role === 'assistant' && !m._system && visibleContent.trim() ? (
                        <div className="mt-3 flex items-center justify-start">
                          <button
                            type="button"
                            onClick={() => toggleTts(i, visibleContent)}
                            disabled={audioState.index === i && audioState.status === 'loading'}
                            aria-label={
                              audioState.index === i && audioState.status === 'playing'
                                ? 'Stop audio'
                                : 'Play audio'
                            }
                            aria-pressed={audioState.index === i && audioState.status === 'playing'}
                            className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors disabled:cursor-wait ${
                              audioState.index === i && audioState.status === 'playing'
                                ? 'bg-[#C9A84C]/15 text-[#C9A84C] animate-pulse'
                                : audioState.index === i && audioState.status === 'loading'
                                ? 'text-[#C9A84C] animate-pulse'
                                : audioState.index === i && audioState.status === 'error'
                                ? 'text-signal'
                                : 'text-[#888] hover:text-[#C9A84C]'
                            }`}
                          >
                            {audioState.index === i && audioState.status === 'loading' ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <Volume2 size={14} />
                            )}
                          </button>
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

        <div className="mt-4 border-t border-line pt-3">
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

        <form onSubmit={send} className="mt-4 flex items-end gap-2 pb-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChosen}
            className="hidden"
          />
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Ask a specific question"
              disabled={transcribing}
              rows={1}
              className="w-full resize-none overflow-y-auto rounded-[14px] border-[0.5px] border-[#2a2a2a] bg-[#161616] py-3 pl-16 pr-4 font-body leading-relaxed text-ink placeholder:text-faint transition-[height,border-color] duration-150 focus:border-[#C9A84C] focus:outline-none disabled:opacity-60"
              style={{ maxHeight: `${TEXTAREA_MAX_HEIGHT}px` }}
            />
            <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || busy || transcribing}
                aria-label="Attach image"
                className={`pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                  pendingUpload ? 'text-[#C9A84C]' : 'text-[#888] hover:text-[#C9A84C]'
                }`}
              >
                <Paperclip size={16} className={uploading ? 'animate-pulse' : ''} />
              </button>
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing || busy}
                aria-label={recording ? 'Stop recording' : 'Record voice'}
                aria-pressed={recording}
                className={`pointer-events-auto flex h-6 w-6 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                  recording ? 'text-signal animate-pulse' : 'text-[#888] hover:text-[#C9A84C]'
                }`}
              >
                {recording ? <Square size={16} /> : <Mic size={16} />}
              </button>
            </div>
          </div>
          <button
            type="submit"
            disabled={busy || (!input.trim() && !pendingUpload) || recording || transcribing}
            className={`h-12 shrink-0 rounded-[14px] px-5 text-xs uppercase tracking-[0.2em] transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              busy
                ? 'border-[0.5px] border-[#C9A84C]/40 bg-[#C9A84C]/10 text-[#C9A84C] animate-pulse'
                : 'bg-[#C9A84C] text-[#080808] hover:bg-[#D4B560]'
            }`}
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            {busy ? 'Thinking' : 'Ask'}
          </button>
        </form>
        {isOwner && agenticMode ? (
          <p className="-mt-2 mb-2 text-[0.55rem] uppercase tracking-widest2 text-faint">
            Conv cost: ${convUsd.toFixed(4)} · <a href="/owner/agent-log" className="hover:text-[#C9A84C]">audit log →</a>
          </p>
        ) : null}
      </section>

      <HistoryDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        conversations={conversations}
        currentId={currentId}
        onSelect={selectConversation}
        onDelete={removeConversation}
        onNew={startNew}
      />
    </div>
  );
}

// Slide-in left drawer with glassmorphism, matching the /standard aesthetic.
// Overlay covers the full viewport (fixed inset-0) so it sits above the
// Layout chrome. Backdrop fades; panel translates 100% → 0 over 250ms.
function HistoryDrawer({ open, onClose, conversations, currentId, onSelect, onDelete, onNew }) {
  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Track touch deltas on the panel to support swipe-left-to-dismiss.
  const startRef = useRef(null);
  function onTouchStart(e) {
    const t = e.touches?.[0];
    if (!t) return;
    startRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  }
  function onTouchEnd(e) {
    if (!startRef.current) return;
    const t = e.changedTouches?.[0];
    if (!t) return;
    const dx = t.clientX - startRef.current.x;
    const dy = Math.abs(t.clientY - startRef.current.y);
    const dt = Date.now() - startRef.current.t;
    startRef.current = null;
    if (dx < -60 && dy < 50 && dt < 600) onClose();
  }

  return (
    <>
      {/* Backdrop. Tap-to-dismiss; only mounts while open so it doesn't
          intercept anything once dismissed. The opacity transition gives the
          200ms fade-out the spec asked for. */}
      <div
        aria-hidden
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ease-in ${
          open ? 'pointer-events-auto opacity-100 duration-[250ms]' : 'pointer-events-none opacity-0 duration-[200ms]'
        }`}
      />
      {/* Panel. Always mounted so the open/close transform animates; the
          panel itself is the keyboard-trap and gesture surface. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Conversation history"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        className={`fixed inset-y-0 left-0 z-50 flex w-[80%] max-w-sm flex-col border-r-[0.5px] border-[#2a2a2a] bg-[#161616]/85 backdrop-blur-xl transition-transform sm:w-[360px] ${
          open ? 'translate-x-0 duration-[250ms] ease-out' : '-translate-x-full duration-[200ms] ease-in'
        }`}
        style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-between px-4 py-3">
          <span
            className="text-[11px] uppercase tracking-[0.16em] text-[#888]"
            style={{ fontFamily: "'Bebas Neue', sans-serif" }}
          >
            History
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close history"
            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#888] transition-colors hover:bg-[#1f1f1f] hover:text-[#C9A84C]"
          >
            <X size={14} strokeWidth={1.75} />
          </button>
        </div>

        <button
          type="button"
          onClick={onNew}
          className="mx-3 flex items-center justify-center gap-2 rounded-[14px] border-[0.5px] border-[#C9A84C]/40 bg-[#C9A84C]/10 px-4 py-3 text-[14px] uppercase tracking-[0.18em] text-[#C9A84C] transition-all duration-150 hover:bg-[#C9A84C]/20 active:scale-[0.98]"
          style={{ fontFamily: "'Bebas Neue', sans-serif" }}
        >
          <Plus size={14} strokeWidth={2} />
          New
        </button>

        <ul className="mt-3 flex-1 overflow-y-auto px-1 pb-4">
          {conversations.length === 0 ? (
            <li
              className="px-4 py-6 text-center text-[12px] text-[#888]"
              style={{ fontFamily: '"DM Mono", ui-monospace, monospace' }}
            >
              No conversations yet
            </li>
          ) : (
            conversations.map((c) => {
              const active = c.id === currentId;
              const preview = (c.title && c.title.trim())
                ? c.title.length > 60 ? `${c.title.slice(0, 60)}…` : c.title
                : 'Untitled';
              return (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    className={`flex w-full items-start gap-2 rounded-[10px] px-3 py-3 text-left transition-colors ${
                      active
                        ? 'border-l-2 border-[#C9A84C] bg-[#C9A84C]/[0.04]'
                        : 'border-l-2 border-transparent hover:bg-[#1f1f1f]/60'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`truncate text-[13px] leading-snug ${active ? 'text-[#F5F5F5]' : 'text-[#F5F5F5]/85'}`}
                        style={{ fontFamily: '"DM Mono", ui-monospace, monospace' }}
                      >
                        {preview}
                      </div>
                      <div
                        className="mt-1 text-[11px] text-[#888]"
                        style={{ fontFamily: '"DM Mono", ui-monospace, monospace' }}
                      >
                        {relativeTime(c.updated_at)}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onDelete(c.id); }}
                    aria-label="Delete conversation"
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#888]/0 transition-all hover:bg-[#1f1f1f] hover:text-[#ef5350] group-hover:text-[#888]"
                  >
                    <Trash2 size={12} />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>
    </>
  );
}
