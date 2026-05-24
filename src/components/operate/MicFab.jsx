import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const MicSvg = () => (
  <svg viewBox="0 0 24 24">
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="8" y1="22" x2="16" y2="22" />
  </svg>
);

const WaveBars = ({ count = 20 }) => (
  <div className="op-voice-overlay-wave" aria-hidden>
    {Array.from({ length: count }).map((_, i) => (
      <span key={i} style={{ animationDelay: `${(i * 60) % 800}ms` }} />
    ))}
  </div>
);

export default function MicFab({ context = 'this screen' }) {
  const { supported, listening, transcript, toggle, stop } = useVoiceCapture();

  return (
    <>
      <button
        type="button"
        className={`op-mic-fab${listening ? ' op-listening' : ''}`}
        aria-label={listening ? 'Stop listening' : 'Start voice command'}
        aria-pressed={listening}
        onClick={toggle}
        title={supported ? 'Tap to talk' : 'Voice not supported in this browser'}
      >
        <MicSvg />
      </button>

      {listening ? (
        <div className="op-voice-overlay" role="status" aria-live="polite">
          <div className="op-voice-overlay-head">
            <span className="op-voice-overlay-label">LISTENING…</span>
            <button type="button" className="op-voice-overlay-stop" onClick={stop}>
              TAP MIC TO STOP
            </button>
          </div>
          <WaveBars />
          <div className="op-voice-overlay-quote">
            {transcript || `Ask coach, log a set, log a meal — anything on ${context}.`}
          </div>
          <div className="op-voice-overlay-hint">RELEASES ON SILENCE · TRANSCRIPT SAVED LOCALLY</div>
        </div>
      ) : null}
    </>
  );
}
