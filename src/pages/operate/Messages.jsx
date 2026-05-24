import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import { ChevronLeftSvg, PhoneSvg, PlusSvg, CameraSvg, MicSvg, PlaySvg } from '../../components/operate/svg';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const WAVE_BARS_1 = [6, 14, 18, 10, 22, 16, 8, 20, 12, 14, 18, 6, 16, 10];
const WAVE_BARS_2 = [10, 6, 14, 20, 12, 18, 8, 16, 22, 10, 14, 6];
const LIVE_WAVE = [4, 10, 14, 8, 16, 12, 6, 14, 10, 16, 8, 12, 6, 14];

export default function OperateMessages() {
  const nav = useNavigate();
  const [draft, setDraft] = useState('');
  const { listening, transcript, toggle } = useVoiceCapture({
    onFinal: (text) => setDraft((d) => (d ? `${d} ${text}` : text)),
  });

  return (
    <PhoneShell screen="Messages">
      <div className="op-chat-header">
        <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
          <ChevronLeftSvg />
        </button>
        <div className="op-chat-coach-info">
          <div className="op-coach-avatar">PK</div>
          <div className="op-coach-text">
            <span className="op-coach-name-h">PERCY · COACH</span>
            <span className="op-coach-status">ACTIVE NOW</span>
          </div>
        </div>
        <button type="button" className="op-icon-btn" aria-label="Call"><PhoneSvg /></button>
      </div>

      <div className="op-thread">
        <div className="op-day-divider">YESTERDAY</div>
        <div className="op-msg op-coach">
          Check-in pics today. Front, side, back — same time, same light.
          <div className="op-msg-time">8:14 AM</div>
        </div>
        <div className="op-msg op-me">
          On it. Will send after training.
          <div className="op-msg-time">8:22 AM</div>
        </div>
        <div className="op-voice-msg op-coach">
          <button type="button" className="op-play-btn" aria-label="Play voice message"><PlaySvg /></button>
          <div className="op-wave">
            {WAVE_BARS_1.map((h, i) => <span key={i} style={{ height: h }} />)}
          </div>
          <div className="op-voice-dur">0:24</div>
        </div>

        <div className="op-day-divider">TODAY · MAY 23</div>
        <div className="op-img-msg">
          <div className="op-photo"><CameraSvg /></div>
          <div className="op-img-cap">Front check-in · week 3</div>
        </div>
        <div className="op-msg op-me">
          Three angles attached. Weight 192.4 this morning.
          <div className="op-msg-time">9:08 AM</div>
        </div>
        <div className="op-voice-msg op-me">
          <button type="button" className="op-play-btn" aria-label="Play voice message"><PlaySvg /></button>
          <div className="op-wave">
            {WAVE_BARS_2.map((h, i) => <span key={i} style={{ height: h }} />)}
          </div>
          <div className="op-voice-dur">0:18</div>
        </div>
        <div className="op-msg op-coach">
          Shoulders are catching up. Hold protein at 200 through Sunday. Increase incline press top set to 65s next Push day.
          <div className="op-msg-time">9:14 AM</div>
        </div>
      </div>

      <div className="op-composer">
        {listening ? (
          <div className="op-listening-pill">
            <span className="op-listening-dot" />
            <span className="op-listening-text">LISTENING…</span>
            <div className="op-live-wave">
              {LIVE_WAVE.map((_, i) => (
                <span key={i} style={{ animationDelay: `${(i * 70) % 700}ms` }} />
              ))}
            </div>
          </div>
        ) : null}
        <div className="op-composer-row">
          <button type="button" className="op-cmp-btn" aria-label="Add attachment"><PlusSvg /></button>
          <input
            className="op-cmp-input"
            placeholder={listening ? (transcript || 'Speak…') : 'Hold press, easier to talk…'}
            value={listening ? transcript : draft}
            onChange={(e) => setDraft(e.target.value)}
            readOnly={listening}
          />
          <button type="button" className="op-cmp-btn" aria-label="Send photo"><CameraSvg /></button>
          <button
            type="button"
            className={`op-cmp-btn op-mic-cmp${listening ? ' op-listening' : ''}`}
            aria-pressed={listening}
            aria-label={listening ? 'Stop dictation' : 'Start dictation'}
            onClick={toggle}
          >
            <MicSvg />
          </button>
        </div>
      </div>

      <BottomNav active="messages" />
    </PhoneShell>
  );
}
