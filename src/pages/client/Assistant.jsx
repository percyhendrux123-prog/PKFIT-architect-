import { useState, useRef, useEffect } from 'react';
import { claude } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    setErr(null);
    try {
      const res = await claude.assistant({ messages: next });
      const reply = res?.reply ?? res?.message ?? '';
      setMessages((m) => [...m, { role: 'assistant', content: reply }]);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-160px)] flex-col">
      <header className="mb-4">
        <div className="label mb-2">Assistant</div>
        <h1 className="font-display text-4xl tracking-wider2">The Architect</h1>
        <p className="mt-1 max-w-reading text-sm text-mute">
          Mechanism over motivation. No hype. Ask the question you would ask the coach.
        </p>
      </header>

      <div className="flex-1 overflow-y-auto border border-line bg-black/20 p-4">
        {messages.length === 0 ? (
          <div className="text-sm text-faint">Start with a single, specific question. Example: why did my bench stall at 85 kg for three weeks.</div>
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
    </div>
  );
}
