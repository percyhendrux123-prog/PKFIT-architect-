// AssistantFab — floating action button + slide-in chat drawer that lives
// on every client route. Tier-gated visibility: tier2 (Full Integration)
// and tier3 (Premium) clients see it. Trial / tier1 / owner don't.
//
// The drawer chat is a lighter modular version of Assistant.jsx — single
// input, streamed response, action confirmation. Each FAB-opened
// conversation is a new conversation row, separately listed on the
// dedicated /assistant page so the client can scroll back later.
//
// For full conversation history + voice input + multi-conversation
// sidebar, the drawer has a "Open in full view →" link to /assistant.

import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MessageCircle, X, Check, Send, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { streamAssistant } from '../lib/claudeClient';
import { Button } from './ui/Button';

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

const ACTION_LABELS = {
  swap_exercise: (p) =>
    `Swap "${p.original_exercise_name || p.original || '?'}" → "${
      p.substitute_exercise_name || p.substitute || '?'
    }"`,
  log_meal: (p) =>
    `Log ${p.meal_type || 'meal'}${p.items ? ` — ${String(p.items).slice(0, 60)}` : ''}`,
  log_check_in: (p) =>
    `Log check-in for ${p.date || 'today'}${p.weight ? ` (${p.weight} weight)` : ''}`,
  message_coach: (p) =>
    `Send to Percy${p.urgency && p.urgency !== 'LOW' ? ` (${p.urgency})` : ''}`,
  flag_for_review: () => `Flag for Percy's review`,
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

// Tier check. Returns true if the FAB should be visible to this client.
// Owner is excluded — owner uses the full assistant page if they want it,
// and the FAB clutters the layout when wearing the coach hat.
function shouldShowFab({ role, profile }) {
  if (role !== 'client') return false;
  const plan = profile?.plan ?? null;
  // Premium tiers (tier2 + tier3 + legacy "full" + "premium" mapping)
  return ['full', 'premium', 'tier2', 'tier3'].includes(plan);
}

// Routes where the FAB should never show (auth flows, legal pages, etc.)
const HIDDEN_PATH_PREFIXES = [
  '/login',
  '/signup',
  '/onboarding',
  '/migrate',
  '/legal',
  '/splash',
  '/owner',
  '/coach',
];

export function AssistantFab() {
  const { role, profile } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [resolvedActions, setResolvedActions] = useState({});
  const [actionBusy, setActionBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);

  // Auto-scroll within the drawer as new content arrives.
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Reset state when the drawer is closed so reopening starts fresh.
  function close() {
    setOpen(false);
  }

  function startNewConversation() {
    setMessages([]);
    setInput('');
    setConversationId(null);
    setResolvedActions({});
    setErr(null);
  }

  async function send(e) {
    e?.preventDefault?.();
    const text = input.trim();
    if (!text || busy) return;
    setMessages((m) => [...m, { role: 'user', content: text }, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    setErr(null);
    let resolvedId = conversationId;
    try {
      await streamAssistant({
        conversationId,
        message: text,
        onEvent: ({ event, data }) => {
          if (event === 'meta' && data?.conversationId) {
            resolvedId = data.conversationId;
            if (!conversationId) setConversationId(data.conversationId);
          } else if (event === 'delta' && typeof data?.text === 'string') {
            setMessages((m) => {
              const next = [...m];
              const last = next[next.length - 1];
              if (last?.role === 'assistant' && !last._system) {
                next[next.length - 1] = { ...last, content: last.content + data.text };
              }
              return next;
            });
          } else if (event === 'error') {
            setErr(data?.message ?? 'Stream failed');
          }
        },
      });
    } catch (e) {
      setErr(e.message);
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

  async function confirmAction(messageIndex, action) {
    if (!conversationId || actionBusy) return;
    setActionBusy(true);
    setErr(null);
    try {
      const result = await executeAction({
        conversationId,
        action: action.actionType,
        params: action.params,
      });
      const summary = result?.summary || 'Action completed.';
      setResolvedActions((r) => ({ ...r, [messageIndex]: 'confirmed' }));
      setMessages((m) => [...m, { role: 'assistant', content: `✓ ${summary}`, _system: true }]);
      streamAssistant({
        conversationId,
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

  // Visibility checks.
  if (!shouldShowFab({ role, profile })) return null;
  if (HIDDEN_PATH_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) return null;

  return (
    <>
      {/* Floating button — bottom-right. */}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open assistant"
          className="fixed bottom-20 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-gold bg-black text-gold shadow-lg shadow-black/40 hover:bg-gold hover:text-black md:bottom-6 md:right-6"
        >
          <MessageCircle size={22} />
        </button>
      ) : null}

      {/* Slide-in drawer. */}
      {open ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
            aria-hidden="true"
          />
          <aside className="relative flex h-full w-full max-w-md flex-col border-l border-line bg-black text-ink md:max-w-md">
            <header className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <div className="label">Assistant</div>
                <div className="font-display text-lg tracking-wider2">Ask</div>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  to="/assistant"
                  onClick={close}
                  className="flex items-center gap-1 text-[0.65rem] uppercase tracking-widest2 text-mute hover:text-gold"
                  aria-label="Open full assistant view"
                >
                  Full view <ExternalLink size={12} />
                </Link>
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="text-[0.65rem] uppercase tracking-widest2 text-mute hover:text-gold"
                  disabled={busy || actionBusy}
                  aria-label="Start a new conversation"
                >
                  New
                </button>
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close assistant"
                  className="text-mute hover:text-ink"
                >
                  <X size={20} />
                </button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {messages.length === 0 ? (
                <div className="text-sm text-faint">
                  Ask anything about your program, your day, or a swap you need to make.
                </div>
              ) : (
                <ul className="space-y-3">
                  {messages.map((m, i) => {
                    const action = m.role === 'assistant' && !m._system ? parseAction(m.content) : null;
                    const isLast = i === messages.length - 1 && m.role === 'assistant' && !m._system;
                    const showActionUI = action && isLast && !resolvedActions[i];
                    const visibleContent = action
                      ? m.content.replace(ACTION_TAG_RE, '').trim()
                      : m.content;
                    return (
                      <li key={i} className={m.role === 'user' ? 'text-right' : ''}>
                        <div
                          className={`inline-block max-w-[90%] border p-2 text-sm ${
                            m.role === 'user'
                              ? 'border-gold text-ink'
                              : m._system
                              ? 'border-faint bg-black/10 text-faint italic'
                              : 'border-line bg-black/40 text-ink/90'
                          }`}
                        >
                          <div className="whitespace-pre-wrap text-sm">{visibleContent}</div>
                          {showActionUI ? (
                            <div className="mt-2 border-t border-line pt-2">
                              <div className="text-[0.6rem] uppercase tracking-widest2 text-faint mb-1">
                                Action proposed
                              </div>
                              <div className="text-xs text-ink mb-2">
                                {ACTION_LABELS[action.actionType]
                                  ? ACTION_LABELS[action.actionType](action.params)
                                  : `Confirm: ${action.actionType}`}
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => confirmAction(i, action)}
                                  disabled={actionBusy}
                                  className="flex items-center gap-1 border border-gold bg-gold/20 px-2 py-1 text-[0.65rem] uppercase tracking-widest2 text-gold hover:bg-gold/30 disabled:opacity-50"
                                >
                                  <Check size={10} /> {actionBusy ? 'Working' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => cancelAction(i)}
                                  disabled={actionBusy}
                                  className="flex items-center gap-1 border border-line bg-black/40 px-2 py-1 text-[0.65rem] uppercase tracking-widest2 text-mute hover:text-ink disabled:opacity-50"
                                >
                                  <X size={10} /> Cancel
                                </button>
                              </div>
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

            {err ? <div className="px-4 pb-2 text-[0.65rem] uppercase tracking-widest2 text-signal">{err}</div> : null}

            <form onSubmit={send} className="border-t border-line p-3 flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type a question"
                disabled={busy || actionBusy}
                className="flex-1 border border-line bg-black/40 px-3 py-2 text-sm font-body text-ink placeholder:text-faint focus:border-gold disabled:opacity-60"
                autoFocus
              />
              <Button type="submit" disabled={busy || !input.trim() || actionBusy}>
                {busy ? '...' : <Send size={14} />}
              </Button>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
