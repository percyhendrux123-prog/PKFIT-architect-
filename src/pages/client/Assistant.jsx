import { useEffect, useRef, useState, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { claude } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';

export default function Assistant() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);

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
      return;
    }
    const { data } = await supabase
      .from('conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(
      (data ?? [])
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({ role: m.role, content: m.content })),
    );
  }, []);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  useEffect(() => { loadMessages(currentId); }, [currentId, loadMessages]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setInput('');
    setBusy(true);
    setErr(null);
    try {
      const { conversationId: newId, reply } = await claude.assistant({
        conversationId: currentId,
        message: text,
      });
      if (!currentId) setCurrentId(newId);
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
      await loadConversations();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function startNew() {
    setCurrentId(null);
    setMessages([]);
    setErr(null);
  }

  async function removeConversation(id) {
    if (!window.confirm('Delete this conversation. The exchange will be removed.')) return;
    await supabase.from('conversations').delete().eq('id', id);
    if (currentId === id) startNew();
    await loadConversations();
  }

  return (
    <div className="grid min-h-[calc(100vh-160px)] grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
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
            <li className="p-4 text-xs text-faint">No history yet.</li>
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
                  className="px-3 text-faint opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-300"
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
        <header className="mb-4">
          <div className="label mb-2">Assistant</div>
          <h1 className="font-display text-4xl tracking-wider2">The Architect</h1>
          <p className="mt-1 max-w-reading text-sm text-mute">
            Mechanism over motivation. No hype. Ask the question you would ask the coach.
          </p>
        </header>

        <div className="flex-1 overflow-y-auto border border-line bg-black/20 p-4">
          {messages.length === 0 ? (
            <div className="text-sm text-faint">
              Start with a single, specific question. Example: why did my bench stall at 85 kg for three weeks.
            </div>
          ) : (
            <ul className="space-y-4">
              {messages.map((m, i) => (
                <li key={i} className={m.role === 'user' ? 'text-right' : ''}>
                  <div
                    className={`inline-block max-w-[80%] border p-3 text-sm ${
                      m.role === 'user' ? 'border-gold text-ink' : 'border-line bg-black/30 text-ink/90'
                    }`}
                  >
                    <div className="label mb-1">{m.role === 'user' ? 'You' : 'Architect'}</div>
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div ref={endRef} />
        </div>

        {err ? <div className="mt-2 text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}

        <form onSubmit={send} className="mt-4 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a specific question"
            className="flex-1 border border-line bg-black/40 px-4 py-3 font-body text-ink placeholder:text-faint focus:border-gold"
          />
          <Button type="submit" disabled={busy || !input.trim()}>{busy ? 'Thinking' : 'Send'}</Button>
        </form>
      </section>
    </div>
  );
}
