import { useNavigate } from 'react-router-dom';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import { CloseSvg, PlaySvg, MicSvg, CheckSvg } from '../../components/operate/svg';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const WAVE_HEIGHTS = [6, 14, 22, 10, 18, 8, 24, 14, 6, 20, 12, 16, 8, 22, 10, 14, 6, 18, 12, 20];

export default function OperateTraining() {
  const nav = useNavigate();
  const { listening, transcript, toggle } = useVoiceCapture();

  return (
    <PhoneShell screen="Training">
      <div className="op-session-header">
        <div className="op-sh-top">
          <button type="button" className="op-icon-btn" onClick={() => nav('/calendar')} aria-label="Close session">
            <CloseSvg />
          </button>
          <div className="op-sh-title">PUSH · DAY 18</div>
          <div className="op-sh-timer">14:32</div>
        </div>
        <div className="op-progress-row">
          <div className="op-progress-track"><div className="op-progress-fill" style={{ width: '33%' }} /></div>
          <div className="op-progress-text">4 / 12 SETS</div>
        </div>
      </div>

      <div className="op-app op-app--training">
        <div className="op-ex-card op-done">
          <div className="op-ex-head">
            <div className="op-ex-thumb"><PlaySvg /></div>
            <div className="op-ex-meta">
              <div className="op-ex-num">01 / 06</div>
              <div className="op-ex-name-big">INCLINE DB PRESS</div>
              <div className="op-ex-target">4 × 8-10 · 2 min rest</div>
            </div>
            <div className="op-ex-status op-status-done">DONE</div>
          </div>
        </div>

        <div className="op-ex-card op-active">
          <div className="op-ex-head">
            <div className="op-ex-thumb"><PlaySvg /></div>
            <div className="op-ex-meta">
              <div className="op-ex-num">02 / 06 · ACTIVE</div>
              <div className="op-ex-name-big">CABLE FLY</div>
              <div className="op-ex-target">3 × 12 · 90s rest · target 50 lb</div>
            </div>
            <div className="op-ex-status op-status-active">SET 2 / 3</div>
          </div>

          <div className="op-voice-log">
            <div className="op-voice-log-head">
              <span className="op-voice-log-label">VOICE LOG · {listening ? 'LISTENING' : 'TAP MIC TO START'}</span>
              <button type="button" className="op-voice-log-stop" onClick={toggle}>
                {listening ? 'TAP TO STOP' : 'START'}
              </button>
            </div>
            <div className="op-voice-log-row">
              <button type="button" className="op-voice-btn" onClick={toggle} aria-label={listening ? 'Stop' : 'Start voice log'}>
                <MicSvg />
              </button>
              <div className="op-voice-wave">
                {WAVE_HEIGHTS.map((_, i) => (
                  <span key={i} style={{ animationDelay: `${(i * 60) % 800}ms` }} />
                ))}
              </div>
            </div>
            <div className="op-voice-transcript">
              <div className="op-quote">
                {transcript || '"Twelve reps at fifty pounds, felt easy."'}
              </div>
              <div className="op-parsed">→ 12 REPS · 50 LB · RPE 6</div>
            </div>
          </div>

          <div className="op-ex-sets-list">
            <div className="op-set-header">
              <span>SET</span><span>TARGET</span><span>WEIGHT</span><span>REPS</span><span>RPE</span><span />
            </div>
            <div className="op-set-row">
              <span className="op-set-num">1</span>
              <span className="op-set-target">12 × 50</span>
              <input className="op-set-input op-filled" defaultValue="50" readOnly />
              <input className="op-set-input op-filled" defaultValue="12" readOnly />
              <input className="op-set-input op-filled" defaultValue="6" readOnly />
              <button type="button" className="op-set-check op-done" aria-label="Set 1 complete"><CheckSvg /></button>
            </div>
            <div className="op-set-row op-active">
              <span className="op-set-num">2</span>
              <span className="op-set-target">12 × 50</span>
              <input className="op-set-input op-active" placeholder="LB" />
              <input className="op-set-input op-active" placeholder="REPS" />
              <input className="op-set-input op-active" placeholder="RPE" />
              <button type="button" className="op-set-check" aria-label="Mark set 2 complete"><CheckSvg /></button>
            </div>
            <div className="op-set-row">
              <span className="op-set-num">3</span>
              <span className="op-set-target">12 × 50</span>
              <input className="op-set-input" placeholder="LB" />
              <input className="op-set-input" placeholder="REPS" />
              <input className="op-set-input" placeholder="RPE" />
              <button type="button" className="op-set-check" aria-label="Mark set 3 complete"><CheckSvg /></button>
            </div>
          </div>

          <button type="button" className="op-log-btn">LOG SET 2</button>
        </div>

        <div className="op-rest-timer">
          <div className="op-rt-circle"><span className="op-rt-num">0:54</span></div>
          <div className="op-rt-body">
            <div className="op-rt-label">REST TIMER</div>
            <div className="op-rt-title">90s between sets</div>
          </div>
          <button type="button" className="op-rt-skip">SKIP</button>
        </div>

        <div className="op-ex-card">
          <div className="op-ex-head">
            <div className="op-ex-thumb"><PlaySvg /></div>
            <div className="op-ex-meta">
              <div className="op-ex-num">03 / 06</div>
              <div className="op-ex-name-big">SEATED DB SHOULDER</div>
              <div className="op-ex-target">4 × 10 · 2 min rest</div>
            </div>
            <div className="op-ex-status op-status-pending">UP NEXT</div>
          </div>
        </div>

        <div className="op-ex-card">
          <div className="op-ex-head">
            <div className="op-ex-thumb"><PlaySvg /></div>
            <div className="op-ex-meta">
              <div className="op-ex-num">04 / 06</div>
              <div className="op-ex-name-big">LATERAL RAISES</div>
              <div className="op-ex-target">3 × 15 · 60s rest</div>
            </div>
            <div className="op-ex-status op-status-pending">—</div>
          </div>
        </div>
      </div>

      <BottomNav active="training" />
    </PhoneShell>
  );
}
