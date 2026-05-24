import { useState } from 'react';
import GlassCard from './GlassCard.jsx';
import {
  AGENT_THEME,
  CARD_FRAMING_STYLE,
  CARD_HEADING_STYLE,
  FIELD_STYLE,
  PRIMARY_BUTTON_STYLE,
} from './_theme.js';

const { BG, BORDER, GOLD, MUTE } = AGENT_THEME;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Renders the offer_consultation tool call. Inline form that POSTs to the
// shared consultation-request Netlify function. The `result` envelope must
// carry `sessionId` and `surface` so the row lands tagged correctly across
// any surface that consumes this card.
export default function ConsultationRequestForm({ result }) {
  const sessionId = result?.sessionId;
  const surface = result?.surface || 'standard';
  const framing =
    result?.input?.framing || "Drop your email and a few times that work. Percy reaches out direct.";

  const [email, setEmail] = useState('');
  const [times, setTimes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [error, setError] = useState(null);

  const validEmail = EMAIL_RE.test(email.trim());
  const canSubmit = Boolean(sessionId && validEmail && times.trim() && !submitting && !submittedAt);

  async function onSubmit(e) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/.netlify/functions/consultation-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          lead_email: email.trim(),
          preferred_times: times.trim(),
          surface,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `request failed (${res.status})`);
      }
      setSubmittedAt(new Date().toISOString());
    } catch (e2) {
      setError(e2?.message || 'Submission failed. Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  }

  if (submittedAt) {
    return (
      <GlassCard accent>
        <div style={CARD_HEADING_STYLE}>REQUEST RECEIVED</div>
        <div style={CARD_FRAMING_STYLE}>Got it. Percy will reach out within 24 hours.</div>
      </GlassCard>
    );
  }

  return (
    <GlassCard accent>
      <div style={CARD_HEADING_STYLE}>REQUEST CONSULTATION</div>
      <div style={CARD_FRAMING_STYLE}>{framing}</div>
      <form
        onSubmit={onSubmit}
        style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}
      >
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          aria-label="Email"
          style={FIELD_STYLE}
        />
        <textarea
          required
          value={times}
          onChange={(e) => setTimes(e.target.value)}
          placeholder="e.g. Tuesday after 5pm, Wednesday mornings, weekend"
          rows={3}
          aria-label="Preferred times"
          style={{ ...FIELD_STYLE, resize: 'vertical' }}
        />
        {error ? (
          <div style={{ color: GOLD, fontSize: 12, letterSpacing: '0.04em' }}>{error}</div>
        ) : null}
        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            ...PRIMARY_BUTTON_STYLE,
            background: canSubmit ? GOLD : '#3a3a3a',
            color: canSubmit ? BG : MUTE,
            border: `0.5px solid ${canSubmit ? GOLD : BORDER}`,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            opacity: submitting ? 0.7 : 1,
            alignSelf: 'flex-start',
          }}
        >
          {submitting ? 'SENDING…' : 'REQUEST CONSULTATION'}
        </button>
      </form>
    </GlassCard>
  );
}
