import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { useRealtime } from '../hooks/useRealtime';
import { Button } from './ui/Button';

async function ensureThread(clientId) {
  const { data: existing } = await supabase
    .from('dm_threads')
    .select('*')
    .eq('client_id', clientId)
    .maybeSingle();
  if (existing) return existing;
  const { data: created, error } = await supabase
    .from('dm_threads')
    .insert({ client_id: clientId })
    .select()
    .maybeSingle();
  if (error) throw error;
  return created;
}

export function DMThread({ clientId, viewer, role }) {
  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !clientId) return;
    let cancelled = false;
    ensureThread(clientId)
      .then((t) => {
        if (!cancelled) setThread(t);
      })
      .catch((e) => {
        if (!cancelled) setErr(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  const load = useCallback(async () => {
    if (!thread) return;
    const { data } = await supabase
      .from('dm_messages')
      .select('*')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true });
    setMessages(data ?? []);

    // Mark as read for this viewer.
    const unreadField = role === 'coach' ? 'read_by_coach' : 'read_by_client';
    const unreadIds = (data ?? [])
      .filter((m) => m.author_id !== viewer?.id && !m[unreadField])
      .map((m) => m.id);
    if (unreadIds.length > 0) {
      await supabase
        .from('dm_messages')
        .update({ [unreadField]: true })
        .in('id', unreadIds);
    }
  }, [thread?.id, viewer?.id, role]);

  useEffect(() => { load(); }, [load]);

  const filter = thread ? `thread_id=eq.${thread.id}` : undefined;
  useRealtime('dm_messages', load, filter);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !thread) return;
    setBusy(true);
    setErr(null);
    try {
      await supabase.from('dm_messages').insert({
        thread_id: thread.id,
        author_id: viewer.id,
        content: text,
        read_by_client: role !== 'coach',
        read_by_coach: role === 'coach',
      });
      await supabase
        .from('dm_threads')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', thread.id);
      setDraft('');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  const grouped = useMemo(() => {
    const out = [];
    for (const m of messages) {
      const key = new Date(m.created_at).toDateString();
      let bucket = out[out.length - 1];
      if (!bucket || bucket.key !== key) {
        bucket = { key, items: [] };
        out.push(bucket);
      }
      bucket.items.push(m);
    }
    return out;
  }, [messages]);

  return (
    <div className="flex h-full min-h-[50vh] flex-col border border-line bg-black/20">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="text-sm text-faint">
            No messages yet. Keep it tight. One idea. No filler.
          </div>
        ) : (
          grouped.map((g) => (
            <div key={g.key} className="mb-4">
              <div className="label mb-2 text-center">{g.key}</div>
              <ul className="space-y-2">
                {g.items.map((m) => {
                  const mine = m.author_id === viewer?.id;
                  return (
                    <li key={m.id} className={mine ? 'text-right' : ''}>
                      <div
                        className={`inline-block max-w-[80%] border px-3 py-2 text-sm ${
                          mine ? 'border-gold text-ink' : 'border-line bg-black/30 text-ink/90'
                        }`}
                      >
                        <div className="label mb-0.5">
                          {mine ? 'You' : m.author_id ? (role === 'coach' ? 'Client' : 'Coach') : ''}
                          <span className="ml-2 text-[0.55rem] text-faint">
                            {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>

      {err ? <div className="border-t border-line px-4 py-2 text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}

      <form onSubmit={send} className="flex gap-2 border-t border-line p-3">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message"
          className="flex-1 border border-line bg-black/40 px-4 py-3 font-body text-ink placeholder:text-faint focus:border-gold"
        />
        <Button type="submit" disabled={busy || !draft.trim()}>{busy ? 'Sending' : 'Send'}</Button>
      </form>
    </div>
  );
}
