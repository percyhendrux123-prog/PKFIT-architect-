// OnboardScreen — single-step goal-picker shell in PKFIT redesign style.
// Designed to drop in as the visual layer for any onboarding step.
import { Icon } from '../Icon';

export default function OnboardScreen({
  step = 0,
  total = 5,
  stepLabel,
  question = 'WHAT\'S YOUR\nMAIN GOAL?',
  options = [],
  selectedId,
  onSelect,
  onContinue,
  continueLabel = 'Continue',
  busy = false,
}) {
  const lbl = stepLabel || `STEP ${String(step + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0A0B',
        color: '#F4F1EA',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 24px 28px',
        maxWidth: 520,
        margin: '0 auto',
      }}
    >
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              background: i <= step ? '#FF5B1F' : '#1C1C20',
            }}
          />
        ))}
      </div>
      <div className="mono" style={{ color: '#8E8E96', marginTop: 18 }}>{lbl}</div>
      <div
        className="display"
        style={{
          fontSize: 'clamp(28px, 7vw, 40px)',
          marginTop: 10,
          lineHeight: 0.95,
          whiteSpace: 'pre-line',
        }}
      >
        {question}
      </div>

      <div style={{ flex: 1, marginTop: 22, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {options.map((g) => {
          const sel = g.id === selectedId;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onSelect?.(g.id)}
              style={{
                textAlign: 'left',
                padding: 16,
                borderRadius: 14,
                background: sel ? '#1C1C20' : 'transparent',
                border: '1px solid ' + (sel ? '#FF5B1F' : '#1C1C20'),
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                color: '#F4F1EA',
                cursor: 'pointer',
              }}
            >
              <div>
                <div style={{ fontFamily: 'var(--display)', fontSize: 18 }}>
                  {String(g.title).toUpperCase()}
                </div>
                {g.subtitle ? (
                  <div className="mono" style={{ color: '#8E8E96', fontSize: 9, marginTop: 4 }}>
                    {String(g.subtitle).toUpperCase()}
                  </div>
                ) : null}
              </div>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  border: '1px solid ' + (sel ? '#FF5B1F' : '#2A2A30'),
                  background: sel ? '#FF5B1F' : 'transparent',
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                {sel ? <Icon name="check" size={12} stroke={3} color="#0A0A0B" /> : null}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onContinue}
        disabled={busy}
        className="btn btn-primary"
        style={{ width: '100%', justifyContent: 'center', padding: '16px', marginTop: 20 }}
      >
        {busy ? 'Saving…' : continueLabel} <Icon name="arrow" size={14} />
      </button>
    </div>
  );
}
