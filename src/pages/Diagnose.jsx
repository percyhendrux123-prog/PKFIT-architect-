import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';

// Public-facing intake. Routes /standard, /structure, /system, /protocol,
// and /align all render this component. The page hosts a Claude-driven
// conversation in PKFIT voice, persisting the transcript through the
// /.netlify/functions/diagnose endpoint.
//
// Brand kit (per Percy's spec — intentionally inlined rather than pulled
// from the tailwind theme, which has been redefined away from gold):
//   bg     #080808
//   card   #161616
//   border #2a2a2a (0.5px)
//   ink    #F5F5F5
//   mute   #888
//   gold   #C9A84C (used only for active state, send button, key numbers,
//                   and the hot-intent qualifier surface)

const BG = '#080808';
const CARD = '#161616';
const BORDER = '#2a2a2a';
const INK = '#F5F5F5';
const MUTE = '#888';
const GOLD = '#C9A84C';
const RADIUS = 14;

const KEYS = ['standard', 'structure', 'system', 'protocol', 'align'];
const PATH_TO_KEY = Object.fromEntries(KEYS.map((k) => [`/${k}`, k]));

const KEY_COPY = {
  standard:  { subhead: 'The standard removes negotiation.' },
  structure: { subhead: 'Discipline didn’t fail. Structure did.' },
  system:    { subhead: 'A system you can keep is stronger than a plan you can’t.' },
  protocol:  { subhead: 'Behavior becomes identity.' },
  align:     { subhead: 'Move when the standard moves.' },
};

const QUALIFIER_URL = 'https://pkfitelite.co.site';

function resolveKey(location) {
  const params = new URLSearchParams(location.search);
  const fromQuery = (params.get('key') || '').toLowerCase();
  if (KEYS.includes(fromQuery)) return fromQuery;
  const fromPath = PATH_TO_KEY[location.pathname];
  if (fromPath) return fromPath;
  return 'standard';
}

function genSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function Diagnose() {
  const location = useLocation();
  const keyword = useMemo(() => resolveKey(location), [location]);
  const subhead = KEY_COPY[keyword]?.subhead || KEY_COPY.standard.subhead;

  const [sessionId] = useState(genSessionId);
  const [referrer] = useState(() => (typeof document !== 'undefined' ? document.referrer : ''));
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState(null);
  const [intentLevel, setIntentLevel] = useState(null);
  const scrollerRef = useRef(null);
  const textareaRef = useRef(null);

  const hot = (intentLevel ?? 0) >= 4;

  useEffect(() => {
    document.title = `PKFIT × ${keyword.toUpperCase()}`;
  }, [keyword]);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, sending]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setErr(null);
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setMessages((m) => [...m, { role: 'user', content: text }]);
    setSending(true);
    try {
      const res = await fetch('/.netlify/functions/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          key: keyword,
          message: text,
          referrer: referrer || null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `request failed (${res.status})`);
      }
      setMessages((m) => [...m, { role: 'assistant', content: payload.reply }]);
      if (payload.intent_level) setIntentLevel(payload.intent_level);
    } catch (e) {
      setErr(e?.message || 'Network error');
      setMessages((m) => [
        ...m,
        { role: 'assistant', content: 'Connection dropped. Try that again.', _system: true },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, sending, sessionId, keyword, referrer]);

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function onTextareaInput(e) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: BG,
        color: INK,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"DM Mono", ui-monospace, monospace',
      }}
    >
      <Header keyword={keyword} subhead={subhead} />

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: 720,
          width: '100%',
          margin: '0 auto',
          padding: '12px 16px 0',
          minHeight: 0,
        }}
      >
        <div
          ref={scrollerRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: '8px 0 96px',
            minHeight: 0,
          }}
        >
          {messages.length === 0 ? (
            <Opener keyword={keyword} />
          ) : (
            messages.map((m, i) => <Bubble key={i} role={m.role} text={m.content} system={m._system} />)
          )}
          {sending ? <Typing /> : null}
          {hot ? <QualifierCard /> : null}
        </div>

        {err ? (
          <div
            role="alert"
            style={{
              color: GOLD,
              fontSize: 12,
              letterSpacing: '0.06em',
              padding: '6px 0',
              textTransform: 'uppercase',
            }}
          >
            {err}
          </div>
        ) : null}
      </main>

      <Composer
        input={input}
        onInput={onTextareaInput}
        onKeyDown={onKeyDown}
        onSend={sendMessage}
        sending={sending}
        textareaRef={textareaRef}
      />
    </div>
  );
}

function Header({ keyword, subhead }) {
  return (
    <header
      style={{
        borderBottom: `0.5px solid ${BORDER}`,
        padding: '14px 16px 12px',
        background: BG,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 10,
            fontFamily: '"Bebas Neue", "DM Mono", system-ui, sans-serif',
            letterSpacing: '0.08em',
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          <span style={{ color: INK }}>PKFIT</span>
          <span style={{ color: BORDER }}>×</span>
          <span style={{ color: GOLD }}>{keyword.toUpperCase()}</span>
        </div>
        <p
          style={{
            margin: '8px 0 0',
            color: MUTE,
            fontSize: 12,
            letterSpacing: '0.04em',
          }}
        >
          {subhead}
        </p>
      </div>
    </header>
  );
}

function Opener({ keyword }) {
  return (
    <div
      style={{
        background: CARD,
        border: `0.5px solid ${BORDER}`,
        borderRadius: RADIUS,
        padding: '18px 16px',
        color: INK,
      }}
    >
      <div
        style={{
          fontFamily: '"Bebas Neue", system-ui, sans-serif',
          letterSpacing: '0.08em',
          fontSize: 18,
          color: GOLD,
          marginBottom: 8,
        }}
      >
        START HERE
      </div>
      <p style={{ margin: 0, lineHeight: 1.55, color: INK, fontSize: 14 }}>
        You typed <span style={{ color: GOLD }}>{keyword.toUpperCase()}</span>. Good.
      </p>
      <p style={{ margin: '10px 0 0', lineHeight: 1.55, color: MUTE, fontSize: 13 }}>
        Tell me what&apos;s actually going on. Wife, kids, work, mornings, the late-night fridge —
        whatever has been moving lately. No script. No form.
      </p>
    </div>
  );
}

function Bubble({ role, text, system }) {
  const isUser = role === 'user';
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
      }}
    >
      <div
        style={{
          maxWidth: '84%',
          background: isUser ? '#1c1c1c' : CARD,
          border: `0.5px solid ${BORDER}`,
          borderRadius: RADIUS,
          padding: '12px 14px',
          color: system ? MUTE : INK,
          fontSize: 14,
          lineHeight: 1.55,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {text}
      </div>
    </div>
  );
}

function Typing() {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
      <div
        style={{
          background: CARD,
          border: `0.5px solid ${BORDER}`,
          borderRadius: RADIUS,
          padding: '12px 14px',
          color: MUTE,
          fontSize: 14,
          display: 'flex',
          gap: 6,
          alignItems: 'center',
        }}
        aria-live="polite"
      >
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </div>
  );
}

function Dot({ delay }) {
  return (
    <span
      style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: MUTE,
        display: 'inline-block',
        animation: `pkfit-dot 1.2s ${delay}ms infinite ease-in-out`,
      }}
    />
  );
}

function QualifierCard() {
  return (
    <a
      href={QUALIFIER_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        background: '#0f0f0f',
        border: `0.5px solid ${GOLD}`,
        borderRadius: RADIUS,
        padding: '14px 16px',
        color: INK,
        textDecoration: 'none',
      }}
    >
      <div
        style={{
          fontFamily: '"Bebas Neue", system-ui, sans-serif',
          letterSpacing: '0.08em',
          fontSize: 16,
          color: GOLD,
        }}
      >
        OPEN QUALIFIER
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: MUTE, letterSpacing: '0.04em' }}>
        pkfitelite.co.site — Percy reviews every submission personally.
      </div>
    </a>
  );
}

function Composer({ input, onInput, onKeyDown, onSend, sending, textareaRef }) {
  const canSend = input.trim().length > 0 && !sending;
  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        background: 'rgba(8, 8, 8, 0.92)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: `0.5px solid ${BORDER}`,
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom))',
      }}
    >
      <div
        style={{
          maxWidth: 720,
          margin: '0 auto',
          display: 'flex',
          alignItems: 'flex-end',
          gap: 8,
          background: CARD,
          border: `0.5px solid ${BORDER}`,
          borderRadius: RADIUS,
          padding: '8px 8px 8px 12px',
        }}
      >
        <textarea
          ref={textareaRef}
          value={input}
          onChange={onInput}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Say it plain."
          aria-label="Your message"
          style={{
            flex: 1,
            resize: 'none',
            background: 'transparent',
            color: INK,
            border: 'none',
            outline: 'none',
            fontFamily: '"DM Mono", ui-monospace, monospace',
            fontSize: 14,
            lineHeight: 1.5,
            padding: '6px 4px',
            maxHeight: 200,
          }}
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          aria-label="Send"
          style={{
            background: canSend ? GOLD : 'transparent',
            color: canSend ? BG : MUTE,
            border: `0.5px solid ${canSend ? GOLD : BORDER}`,
            borderRadius: RADIUS - 4,
            padding: '8px 14px',
            fontFamily: '"Bebas Neue", system-ui, sans-serif',
            letterSpacing: '0.08em',
            fontSize: 14,
            cursor: canSend ? 'pointer' : 'not-allowed',
            transition: 'background 120ms ease, color 120ms ease',
          }}
        >
          SEND
        </button>
      </div>
      <DiagnoseKeyframes />
    </div>
  );
}

function DiagnoseKeyframes() {
  return (
    <style>{`
      @keyframes pkfit-dot {
        0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
        40% { opacity: 1; transform: translateY(-2px); }
      }
    `}</style>
  );
}
