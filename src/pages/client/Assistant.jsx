import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Plus, Trash2, Mic, Square, Check, X, Pin, ChevronDown, Zap, Paperclip,
  Radio, MicOff, Copy, RotateCcw, FileText, Brain,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  streamAssistant, streamAgentAssistant, gemini, uploadArchitectFile, getAuthHeaders,
} from '../../lib/claudeClient';
import { VoiceMode, VOICE_STATES } from '../../lib/voiceMode';
import { Button } from '../../components/ui/Button';
import { ContextPinMenu } from '../../components/ContextPinMenu';
import MarkdownContent from '../../components/MarkdownContent';

const MAX_IMAGE_LONG_EDGE = 2048;
const IMAGE_QUALITY = 0.85;
const MAX_DOC_BYTES = 32 * 1024 * 1024;
const ATTACH_ACCEPT =
  'image/*,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/markdown,text/plain,text/csv,.md,.txt,.csv,.docx,.xlsx,.pdf';

const TOOL_LABEL_IN_PROGRESS = {
  web_search: 'Searching web',
  web_fetch: 'Fetching page',
  read_file: 'Reading file',
  write_file: 'Writing file',
  analyze_image: 'Reading image',
  analyze_document: 'Reading document',
  read_operator_upload: 'Inspecting upload',
  read_client_data: 'Reading your data',
  run_generator: 'Running generator',
  compare_periods: 'Comparing periods',
  aggregate_clients: 'Aggregating clients',
  supabase_query_read: 'Querying database',
  supabase_query_write: 'Writing to database',
  mcp_call: 'Calling integration',
  generate_image: 'Generating image',
  voice_tts: 'Synthesizing voice',
  spawn_code_task: 'Spawning task',
  send_message_to_task: 'Messaging task',
  read_task_transcript: 'Reading task output',
  set_env_var: 'Setting env var',
  client_memory_read: 'Recalling from history',
  client_memory_write: 'Saving to memory',
};

function toolLabel(name) {
  return TOOL_LABEL_IN_PROGRESS[name] || name.replace(/_/g, ' ');
}

function isMemoryTool(name) {
  return typeof name === 'string' && /memory/i.test(name);
}

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
  const [convUsd, setConvUsd] = useState(0);
  // Pending image attachment for the next outgoing message. Cleared after send.
  const [pendingUpload, setPendingUpload] = useState(null); // { upload_id, mime, bytes, filename, preview_url, kind }
  const [uploading, setUploading] = useState(false);
  // Voice-mode (continuous two-way) state. Separate from push-to-talk above.
  const [voiceModeOn, setVoiceModeOn] = useState(false);
  const [voiceState, setVoiceState] = useState(VOICE_STATES.IDLE);
  // Per-assistant-message tool events: messageTools[messageIndex] = [{name, status, summary, error, memory}]
  const [messageTools, setMessageTools] = useState({});
  const [copiedIndex, setCopiedIndex] = useState(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const endRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  // The index of the assistant message currently being streamed — so
  // tool_call / tool_result events from the agent loop attach to the
  // right message bubble for inline chip rendering.
  const currentAssistantIdxRef = useRef(null);
  const voiceRef = useRef(null);
  const abortRef = useRef(null);
  const lastSendRef = useRef(null); // { outgoing, pendingUpload } — for regenerate

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
  // Tear down voice mode on unmount or page navigation.
  useEffect(() => () => {
    if (voiceRef.current) {
      voiceRef.current.stop();
      voiceRef.current = null;
    }
  }, []);

  // Ref to the latest send so VoiceMode (created once) can call into the
  // current closure when a transcript arrives — without re-creating the
  // VoiceMode instance on every render.
  const dispatchSendRef = useRef(null);

  async function toggleVoiceMode() {
    if (voiceModeOn) {
      if (voiceRef.current) {
        voiceRef.current.stop();
        voiceRef.current = null;
      }
      setVoiceModeOn(false);
      setVoiceState(VOICE_STATES.IDLE);
      return;
    }
    const vm = new VoiceMode({
      getAuthHeaders,
      onTranscript: (transcript) => {
        const trimmed = transcript.trim();
        if (!trimmed) return;
        setInput('');
        // If a stream is already running, abort it — the user is interrupting.
        if (abortRef.current) {
          try { abortRef.current.abort(); } catch { /* ignore */ }
          abortRef.current = null;
        }
        const dispatcher = dispatchSendRef.current;
        if (dispatcher) dispatcher({ outgoing: trimmed, attachmentForMarker: null });
      },
      onError: (msg) => setErr(msg),
      onStateChange: (next) => setVoiceState(next),
    });
    voiceRef.current = vm;
    setVoiceModeOn(true);
    await vm.start();
  }

  function muteVoice() {
    voiceRef.current?.mute();
  }
  function unmuteVoice() {
    voiceRef.current?.unmute();
  }

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

  async function dispatchSend({ outgoing, attachmentForMarker, replaceLastAssistant = false }) {
    setBusy(true);
    setErr(null);
    setAgentEvents([]);
    lastSendRef.current = { outgoing, attachmentForMarker };

    let assistantIdx;
    setMessages((m) => {
      const next = [...m];
      if (replaceLastAssistant && next.length > 0 && next[next.length - 1]?.role === 'assistant') {
        next[next.length - 1] = { role: 'assistant', content: '' };
        assistantIdx = next.length - 1;
      } else {
        next.push({ role: 'user', content: outgoing });
        next.push({ role: 'assistant', content: '' });
        assistantIdx = next.length - 1;
      }
      return next;
    });
    // Schedule index capture after state apply.
    queueMicrotask(() => {
      currentAssistantIdxRef.current = assistantIdx;
    });
    setMessageTools((mt) => ({ ...mt, [assistantIdx]: [] }));

    const controller = new AbortController();
    abortRef.current = controller;

    const streamer = agenticMode ? streamAgentAssistant : streamAssistant;
    let resolvedConversationId = currentId;

    try {
      await streamer({
        conversationId: currentId,
        message: outgoing,
        signal: controller.signal,
        onEvent: ({ event, data }) => {
          if (event === 'meta' && data?.conversationId) {
            resolvedConversationId = data.conversationId;
            if (!currentId) setCurrentId(data.conversationId);
            if (typeof data.conv_usd === 'number') setConvUsd(data.conv_usd);
          } else if (event === 'delta' && typeof data?.text === 'string') {
            const chunk = data.text;
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last?.role === 'assistant') {
                next[next.length - 1] = { ...last, content: last.content + chunk };
              }
              return next;
            });
            if (voiceRef.current && voiceModeOn) voiceRef.current.pushTokens(chunk);
          } else if (event === 'tool_call') {
            setAgentEvents((evts) => [...evts, { kind: 'tool_call', ...data }]);
            const idx = currentAssistantIdxRef.current;
            if (idx != null) {
              setMessageTools((mt) => {
                const list = mt[idx] ? [...mt[idx]] : [];
                list.push({
                  id: data?.tool_use_id || `${data?.name}-${list.length}`,
                  name: data?.name,
                  status: 'in_progress',
                  memory: isMemoryTool(data?.name),
                });
                return { ...mt, [idx]: list };
              });
            }
          } else if (event === 'tool_result') {
            setAgentEvents((evts) => [...evts, { kind: 'tool_result', ...data }]);
            const idx = currentAssistantIdxRef.current;
            if (idx != null) {
              setMessageTools((mt) => {
                const list = mt[idx] ? [...mt[idx]] : [];
                // Match by tool_use_id when possible, else by latest in_progress with same name.
                let i = -1;
                if (data?.tool_use_id) i = list.findIndex((x) => x.id === data.tool_use_id);
                if (i < 0) {
                  for (let j = list.length - 1; j >= 0; j -= 1) {
                    if (list[j].name === data?.name && list[j].status === 'in_progress') { i = j; break; }
                  }
                }
                if (i >= 0) {
                  list[i] = {
                    ...list[i],
                    status: data?.error ? 'error' : 'done',
                    summary: data?.summary,
                    error: data?.error,
                  };
                } else {
                  list.push({
                    id: data?.tool_use_id || `${data?.name}-${list.length}`,
                    name: data?.name,
                    status: data?.error ? 'error' : 'done',
                    summary: data?.summary,
                    error: data?.error,
                    memory: isMemoryTool(data?.name),
                  });
                }
                return { ...mt, [idx]: list };
              });
            }
          } else if (event === 'approval_request') {
            setAgentEvents((evts) => [...evts, { kind: 'approval_request', ...data }]);
          } else if (event === 'soft_prompt') {
            setAgentEvents((evts) => [...evts, { kind: 'soft_prompt', ...data }]);
          } else if (event === 'usage') {
            // Live usage updates — quiet; conv_usd is updated by done.
          } else if (event === 'done') {
            if (typeof data?.conv_usd === 'number') setConvUsd(data.conv_usd);
            if (voiceRef.current && voiceModeOn) voiceRef.current.finalize();
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
      if (e?.name === 'AbortError' || /aborted/i.test(e?.message || '')) {
        // User pressed Stop — keep whatever streamed text we have.
      } else {
        setErr(e.message);
        setMessages((m) => {
          const next = [...m];
          const last = next[next.length - 1];
          if (last?.role === 'assistant' && last.content === '') next.pop();
          return next;
        });
      }
    } finally {
      setBusy(false);
      abortRef.current = null;
      currentAssistantIdxRef.current = null;
    }
  }

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text && !pendingUpload) return;
    // Prefix the outgoing message with a context marker so the Architect's
    // tool-use loop knows to call analyze_image / analyze_document.
    let attachmentMarker = '';
    if (pendingUpload) {
      const kind = pendingUpload.kind === 'document' ? 'file' : 'image';
      attachmentMarker = `[${kind} attached: upload_id=${pendingUpload.upload_id}, mime=${pendingUpload.mime}, bytes=${pendingUpload.bytes}, filename=${pendingUpload.filename || 'upload'}]`;
    }
    const outgoing = attachmentMarker
      ? (text ? `${attachmentMarker}\n${text}` : attachmentMarker)
      : text;
    setInput('');
    const stashUpload = pendingUpload;
    setPendingUpload(null);
    await dispatchSend({ outgoing, attachmentForMarker: stashUpload });
  }

  function stopStream() {
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch { /* ignore */ }
      abortRef.current = null;
    }
    if (voiceRef.current) voiceRef.current.cancelSpeech();
    setBusy(false);
  }

  async function regenerateLast() {
    if (busy) return;
    // Find the most recent user message and replay it.
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === 'user') { lastUserIdx = i; break; }
    }
    if (lastUserIdx < 0) return;
    const outgoing = messages[lastUserIdx].content;
    await dispatchSend({ outgoing, attachmentForMarker: null, replaceLastAssistant: true });
  }

  function copyMessage(idx, content) {
    const text = String(content || '').replace(ACTION_TAG_RE, '').trim();
    if (!text) return;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedIndex(idx);
        setTimeout(() => setCopiedIndex((cur) => (cur === idx ? null : cur)), 1200);
      }).catch(() => {});
    }
  }

  // Keep the ref pointing at the latest dispatchSend closure so VoiceMode's
  // onTranscript can use the freshest version of conv state.
  dispatchSendRef.current = dispatchSend;

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

  // Architect file upload (paperclip). Images are resized client-side; docs
  // are sent raw. Both POST to /architect-upload; the resulting upload_id is
  // attached to the next user message as a [image|file attached: …] marker.
  async function handleFileChosen(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isImage = file.type.startsWith('image/');
    const isDoc = (
      file.type === 'application/pdf' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.type === 'text/markdown' ||
      file.type === 'text/x-markdown' ||
      file.type === 'text/plain' ||
      file.type === 'text/csv' ||
      /\.(pdf|docx|xlsx|md|txt|csv)$/i.test(file.name || '')
    );
    if (!isImage && !isDoc) {
      setErr('Unsupported file type. Accepted: images, PDF, DOCX, XLSX, MD, TXT, CSV.');
      return;
    }
    const cap = isImage ? 20 * 1024 * 1024 : MAX_DOC_BYTES;
    if (file.size > cap) {
      setErr(`File is larger than ${Math.round(cap / (1024 * 1024))}MB.`);
      return;
    }
    setErr(null);
    setUploading(true);
    try {
      const upload = isImage ? await resizeImageFile(file) : file;
      const result = await uploadArchitectFile({ file: upload });
      setPendingUpload({
        upload_id: result.upload_id,
        mime: result.mime,
        bytes: result.bytes,
        kind: result.kind || (isImage ? 'image' : 'document'),
        filename: file.name,
        preview_url: isImage ? result.signed_url : null,
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
        <header className="mb-10">
          <div className="label mb-4">Assistant</div>
          <h1 className="font-display text-[2.5rem] leading-[1] tracking-wider2 md:text-5xl">The Architect</h1>
          <p className="mt-4 max-w-reading text-sm leading-7 text-mute">
            Mechanism over motivation. No hype. Ask the question you would ask the coach.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 border border-line bg-black/20 px-4 py-2.5 text-[0.65rem] uppercase tracking-widest2 text-mute">
            {isOwner ? (
              <>
                <Zap size={12} className={agenticMode ? 'text-gold' : 'text-faint'} />
                <button
                  type="button"
                  onClick={() => setAgenticMode((v) => !v)}
                  className={`underline-offset-4 hover:underline ${agenticMode ? 'text-gold' : 'text-faint'}`}
                >
                  Agentic mode: {agenticMode ? 'on' : 'off'}
                </button>
                <span className="text-faint">·</span>
              </>
            ) : null}
            <Radio size={12} className={voiceModeOn ? 'text-gold' : 'text-faint'} />
            <button
              type="button"
              onClick={toggleVoiceMode}
              className={`underline-offset-4 hover:underline ${voiceModeOn ? 'text-gold' : 'text-faint'}`}
              aria-pressed={voiceModeOn}
              aria-label="Toggle live voice mode"
            >
              Voice mode: {voiceModeOn ? voiceState : 'off'}
            </button>
            {voiceModeOn ? (
              <>
                <span className="text-faint">·</span>
                {voiceState === VOICE_STATES.MUTED ? (
                  <button
                    type="button"
                    onClick={unmuteVoice}
                    className="flex items-center gap-1 text-faint hover:text-gold"
                    aria-label="Unmute mic"
                  >
                    <MicOff size={12} /> unmute
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={muteVoice}
                    className="flex items-center gap-1 text-faint hover:text-gold"
                    aria-label="Mute mic"
                  >
                    <Mic size={12} /> mute
                  </button>
                )}
              </>
            ) : null}
            {isOwner ? (
              <>
                <span className="text-faint">·</span>
                <span>Conv cost: ${convUsd.toFixed(4)}</span>
                {agenticMode ? (
                  <>
                    <span className="text-faint">·</span>
                    <a href="/owner/agent-log" className="hover:text-gold">Audit log →</a>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
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

        <div className="flex-1 overflow-y-auto border border-line bg-black/20 p-6 md:p-8">
          {messages.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-start justify-end">
              <div className="label mb-4 text-faint">Open a thread</div>
              <p className="font-display text-2xl leading-tight tracking-wider2 text-ink md:text-3xl">
                One specific question.
              </p>
              <p className="mt-3 max-w-reading text-sm leading-7 text-mute">
                Why did my bench stall at 85 kg for three weeks. What is the right deload window after a competition prep. How do I read my last review.
              </p>
              <p className="mt-6 max-w-reading text-[0.7rem] uppercase tracking-widest2 text-faint">
                Attach a photo, PDF, or spreadsheet · Toggle voice mode for a hands-free conversation
              </p>
            </div>
          ) : (
            <ul className="space-y-7 md:space-y-8">
              {messages.map((m, i) => {
                const action = m.role === 'assistant' && !m._system ? parseAction(m.content) : null;
                const isLastAssistant =
                  i === messages.length - 1 && m.role === 'assistant' && !m._system;
                const showActionUI = action && isLastAssistant && !resolvedActions[i];
                const visibleContent = action
                  ? m.content.replace(ACTION_TAG_RE, '').trim()
                  : m.content;
                const tools = m.role === 'assistant' && !m._system ? messageTools[i] : null;
                const memoryEvents = tools ? tools.filter((t) => t.memory) : [];
                const otherEvents = tools ? tools.filter((t) => !t.memory) : [];
                const isEmptyAssistant = m.role === 'assistant' && !m._system && !visibleContent;
                return (
                  <li key={i} className={`pkfit-msg-in ${m.role === 'user' ? 'text-right' : ''}`}>
                    {memoryEvents.length > 0 ? (
                      <div className="mb-2 inline-flex max-w-[88%] flex-col gap-1 text-left">
                        {memoryEvents.map((t, ti) => (
                          <div
                            key={`mem-${i}-${ti}`}
                            className="inline-flex items-center gap-2 border border-gold/30 bg-gold/[0.06] px-2.5 py-1 text-[0.62rem] uppercase tracking-widest2 text-gold/80"
                          >
                            <Brain size={11} />
                            {/client_memory_write|memory_save|memory_write/i.test(t.name) ? (
                              <span>Wants to save{t.summary ? `: ${t.summary}` : ''} — approve in Coach panel</span>
                            ) : (
                              <span>Recalled from history{t.summary ? `: ${t.summary}` : ''}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {otherEvents.length > 0 ? (
                      <div className="mb-2 flex max-w-[88%] flex-wrap gap-1.5 text-left">
                        {otherEvents.map((t, ti) => (
                          <span
                            key={`chip-${i}-${ti}`}
                            className={`inline-flex items-center gap-1.5 border px-2.5 py-1 text-[0.6rem] uppercase tracking-widest2 transition-colors duration-200 ${
                              t.status === 'in_progress'
                                ? 'border-gold/40 bg-gold/[0.08] text-gold/90'
                                : t.status === 'error'
                                ? 'border-signal/60 bg-signal/[0.08] text-signal'
                                : 'border-line bg-black/40 text-mute'
                            }`}
                            title={t.summary || t.error || ''}
                          >
                            <span
                              className={`inline-block h-1.5 w-1.5 rounded-full ${
                                t.status === 'in_progress'
                                  ? 'bg-gold pkfit-typing-dot'
                                  : t.status === 'error'
                                  ? 'bg-signal'
                                  : 'bg-gold/60'
                              }`}
                            />
                            <span>{toolLabel(t.name)}</span>
                            {t.status === 'done' && t.summary ? (
                              <span className="ml-1 normal-case tracking-normal text-mute/70">
                                — {String(t.summary).slice(0, 48)}{String(t.summary).length > 48 ? '…' : ''}
                              </span>
                            ) : null}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div
                      className={`group relative inline-block max-w-[88%] border p-5 text-sm transition-colors duration-200 ${
                        m.role === 'user'
                          ? 'border-gold/80 text-ink'
                          : m._system
                          ? 'border-faint bg-black/10 text-faint italic'
                          : 'border-line bg-black/30 text-ink/90'
                      }`}
                    >
                      <div className="label mb-3">
                        {m.role === 'user' ? 'You' : m._system ? 'System' : 'Architect'}
                      </div>
                      {isEmptyAssistant && busy ? (
                        <div className="flex items-center gap-1.5 py-1" aria-label="Thinking">
                          <span className="pkfit-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-gold/80" style={{ animationDelay: '0ms' }} />
                          <span className="pkfit-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-gold/80" style={{ animationDelay: '180ms' }} />
                          <span className="pkfit-typing-dot inline-block h-1.5 w-1.5 rounded-full bg-gold/80" style={{ animationDelay: '360ms' }} />
                        </div>
                      ) : m.role === 'assistant' && !m._system ? (
                        <MarkdownContent text={visibleContent} />
                      ) : (
                        <div className="whitespace-pre-wrap font-body leading-7">{visibleContent}</div>
                      )}
                      {m.role === 'assistant' && !m._system && visibleContent ? (
                        <div className="absolute right-1 top-1 hidden gap-1 group-hover:flex group-focus-within:flex">
                          <button
                            type="button"
                            onClick={() => copyMessage(i, visibleContent)}
                            className="border border-line bg-black/60 p-1 text-faint hover:border-gold hover:text-gold"
                            aria-label="Copy message"
                          >
                            {copiedIndex === i ? <Check size={11} /> : <Copy size={11} />}
                          </button>
                          {isLastAssistant && !busy ? (
                            <button
                              type="button"
                              onClick={regenerateLast}
                              className="border border-line bg-black/60 p-1 text-faint hover:border-gold hover:text-gold"
                              aria-label="Regenerate response"
                            >
                              <RotateCcw size={11} />
                            </button>
                          ) : null}
                        </div>
                      ) : null}
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
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-line bg-black/40 text-gold">
                <FileText size={16} />
              </div>
            )}
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

        <form onSubmit={send} className="mt-4 flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder={transcribing ? 'Transcribing…' : 'Ask a specific question'}
            disabled={transcribing}
            rows={1}
            className="flex-1 resize-none overflow-y-auto border border-line bg-black/40 px-4 py-3 font-body leading-relaxed text-ink placeholder:text-faint transition-[height] duration-150 focus:border-gold disabled:opacity-60"
            style={{ maxHeight: `${TEXTAREA_MAX_HEIGHT}px` }}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={ATTACH_ACCEPT}
            onChange={handleFileChosen}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || busy || transcribing}
            aria-label="Attach image or document"
            className={`flex h-12 w-12 shrink-0 items-center justify-center border ${
              pendingUpload
                ? 'border-gold bg-gold/20 text-gold'
                : 'border-line bg-black/40 text-mute hover:border-gold hover:text-gold'
            } disabled:opacity-60`}
          >
            <Paperclip size={16} className={uploading ? 'animate-pulse' : ''} />
          </button>
          {voiceModeOn ? (
            <div
              role="status"
              aria-live="polite"
              aria-label={`Voice mode ${voiceState}`}
              className={`flex h-12 w-12 shrink-0 items-center justify-center border ${
                voiceState === VOICE_STATES.LISTENING
                  ? 'border-gold bg-gold/10 text-gold animate-pulse'
                  : voiceState === VOICE_STATES.SPEAKING
                  ? 'border-gold bg-gold/30 text-gold'
                  : voiceState === VOICE_STATES.PROCESSING
                  ? 'border-gold bg-gold/20 text-gold animate-pulse'
                  : voiceState === VOICE_STATES.MUTED
                  ? 'border-faint bg-black/40 text-faint'
                  : 'border-signal bg-signal/10 text-signal'
              }`}
            >
              {voiceState === VOICE_STATES.MUTED ? <MicOff size={16} /> : <Radio size={16} />}
            </div>
          ) : (
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
          )}
          {busy ? (
            <button
              type="button"
              onClick={stopStream}
              aria-label="Stop response"
              className="flex h-12 shrink-0 items-center gap-2 border border-signal bg-signal/20 px-4 text-xs uppercase tracking-widest2 text-signal hover:bg-signal/30"
            >
              <Square size={14} /> Stop
            </button>
          ) : (
            <Button type="submit" disabled={(!input.trim() && !pendingUpload) || recording || transcribing}>
              Send
            </Button>
          )}
        </form>
        <p className="mt-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
          {voiceModeOn
            ? `Voice mode active — ${voiceState}. Toggle off in the header.`
            : 'Enter to send · Shift+Enter for newline · Cmd/Ctrl+K jumps here'}
        </p>
      </section>
    </div>
  );
}
