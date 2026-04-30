// AICoachScreen — chat shell in PKFIT redesign visual language.
// Wired to a parent-supplied send handler so the existing streaming/Claude pipeline can flow through.
import { useEffect, useRef } from 'react';
import { Icon } from '../Icon';

export default function AICoachScreen({
  messages = [],
  input = '',
  onChange,
  onSend,
  busy = false,
  suggestions = [],
  title = 'COACH AI',
  status = '● TRAINED ON PERCY\'S METHOD',
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  return (
    <div
      style={{
        minHeight: '70vh',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0A0A0B',
        color: '#F4F1EA',
        borderRadius: 18,
        overflow: 'hidden',
        border: '1px solid #1C1C20',
      }}
    >
      <div
        style={{
          padding: '14px 22px',
          borderBottom: '1px solid #1C1C20',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: '#080808',
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: 'linear-gradient(135deg,#FF5B1F,#C7421A)',
            display: 'grid',
            placeItems: 'center',
            color: '#0A0A0B',
          }}
        >
          <Icon name="sparkle" size={16} color="#0A0A0B" />
        </div>
        <div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 16 }}>{title}</div>
          <div className="mono" style={{ color: '#4ADE80', fontSize: 9 }}>{status}</div>
        </div>
      </div>

      <div
        ref={scrollRef}
        style={{ flex: 1, overflow: 'auto', padding: '18px 22px', minHeight: 320 }}
      >
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: m.from === 'user' ? 'flex-end' : 'flex-start',
              marginBottom: 12,
            }}
          >
            <div
              style={{
                maxWidth: '82%',
                padding: '12px 14px',
                borderRadius: 16,
                background: m.from === 'user' ? '#FF5B1F' : '#1C1C20',
                color: m.from === 'user' ? '#0A0A0B' : '#F4F1EA',
                fontSize: 14,
                lineHeight: 1.45,
                borderTopRightRadius: m.from === 'user' ? 4 : 16,
                borderTopLeftRadius: m.from === 'user' ? 16 : 4,
                whiteSpace: 'pre-wrap',
              }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {busy ? (
          <div style={{ display: 'flex', marginBottom: 12 }}>
            <div
              style={{
                padding: '12px 14px',
                borderRadius: 16,
                background: '#1C1C20',
                color: '#8E8E96',
              }}
            >
              <span className="dots" />
            </div>
          </div>
        ) : null}
      </div>

      {suggestions.length > 0 ? (
        <div style={{ padding: '10px 22px', display: 'flex', gap: 8, overflowX: 'auto' }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onChange?.(s)}
              style={{
                background: 'transparent',
                border: '1px solid #2A2A30',
                color: '#F4F1EA',
                padding: '8px 12px',
                borderRadius: 999,
                fontSize: 12,
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend?.();
        }}
        style={{
          padding: '12px 22px 18px',
          borderTop: '1px solid #1C1C20',
          display: 'flex',
          gap: 8,
        }}
      >
        <input
          value={input}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder="Ask anything…"
          className="input"
          style={{ flex: 1 }}
        />
        <button
          type="submit"
          disabled={busy}
          className="btn btn-primary"
          style={{ padding: '0 16px' }}
          aria-label="Send message"
        >
          <Icon name="send" size={16} />
        </button>
      </form>
    </div>
  );
}
