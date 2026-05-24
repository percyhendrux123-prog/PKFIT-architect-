import { useAuth } from '../../context/AuthContext';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import { HamburgerSvg, BellSvg, PlaySvg } from '../../components/operate/svg';

function firstName(profile) {
  const name = (profile?.name || profile?.email || 'Friend').trim();
  return name.split(/[\s.@]+/)[0] || 'Friend';
}

function todayLabel() {
  const d = new Date();
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[d.getDay()];
}

function timeOfDayGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

export default function OperateHome() {
  const { profile } = useAuth();
  const name = firstName(profile);

  return (
    <PhoneShell screen="Home">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" aria-label="Menu"><HamburgerSvg /></button>
          <div className="op-brand">PKFIT</div>
          <button type="button" className="op-icon-btn" aria-label="Notifications"><BellSvg /></button>
        </div>

        <div className="op-greeting-label">{todayLabel()} · WEEK 3 OF 12</div>
        <div className="op-greeting-name">{timeOfDayGreeting()}, {name}</div>

        <div className="op-section-label"><span>TODAY&apos;S SESSION</span><a>SKIP</a></div>
        <div className="op-session-card">
          <div className="op-session-head">
            <div>
              <div className="op-session-title">PUSH · CHEST + SHOULDERS</div>
              <div className="op-session-sub">6 exercises · 45 min est.</div>
            </div>
            <div className="op-session-tag">DAY 18</div>
          </div>
          <div className="op-ex-list">
            <div className="op-ex-row"><span className="op-ex-name">Incline DB Press</span><span className="op-ex-sets">4 × 8–10</span></div>
            <div className="op-ex-row"><span className="op-ex-name">Cable Fly</span><span className="op-ex-sets">3 × 12</span></div>
            <div className="op-ex-row"><span className="op-ex-name">Seated DB Shoulder</span><span className="op-ex-sets">4 × 10</span></div>
            <div className="op-ex-row"><span className="op-ex-name" style={{ color: '#888' }}>+ 3 more</span><span className="op-ex-sets" style={{ color: '#555' }}>VIEW ALL</span></div>
          </div>
          <button type="button" className="op-start-btn">
            <PlaySvg />
            START SESSION
          </button>
        </div>

        <div className="op-section-label"><span>THIS WEEK</span></div>
        <div className="op-week-strip">
          {[
            { l: 'M', n: 18, d: 'op-dot-done' },
            { l: 'T', n: 19, d: 'op-dot-done' },
            { l: 'W', n: 20, d: 'op-dot-miss' },
            { l: 'T', n: 21, d: 'op-dot-done' },
            { l: 'F', n: 22, d: 'op-dot-done' },
            { l: 'S', n: 23, d: 'op-dot-pend', today: true },
            { l: 'S', n: 24, d: 'op-dot-pend' },
          ].map((c, i) => (
            <div key={i} className={`op-day-cell${c.today ? ' op-today' : ''}`}>
              <span className="op-day-letter">{c.l}</span>
              <span className="op-day-num">{c.n}</span>
              <span className={`op-day-dot ${c.d}`} />
            </div>
          ))}
        </div>

        <div className="op-duo-row">
          <div className="op-panel">
            <div className="op-panel-label"><span>MACROS TODAY</span><span className="op-delta">560 LEFT</span></div>
            <div className="op-macro-rings">
              <svg className="op-ring-svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#2a2a2a" strokeWidth="5" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="#C9A84C" strokeWidth="5" strokeDasharray="276" strokeDashoffset="110" strokeLinecap="round" />
                <circle cx="50" cy="50" r="36" fill="none" stroke="#2a2a2a" strokeWidth="5" />
                <circle cx="50" cy="50" r="36" fill="none" stroke="#7a8fb5" strokeWidth="5" strokeDasharray="226" strokeDashoffset="120" strokeLinecap="round" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#2a2a2a" strokeWidth="5" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#a37b5e" strokeWidth="5" strokeDasharray="176" strokeDashoffset="90" strokeLinecap="round" />
              </svg>
              <div className="op-ring-center">
                <div className="op-num">1840</div>
                <div className="op-lbl">/ 2400 KCAL</div>
              </div>
            </div>
            <div className="op-macro-key">
              <span><span className="op-key-dot" style={{ background: '#C9A84C' }} />P 145</span>
              <span><span className="op-key-dot" style={{ background: '#7a8fb5' }} />C 160</span>
              <span><span className="op-key-dot" style={{ background: '#a37b5e' }} />F 62</span>
            </div>
          </div>
          <div className="op-panel op-water-panel">
            <div className="op-panel-label"><span>WATER</span></div>
            <div className="op-water-num">
              <span className="op-gold">62</span>
              <span style={{ fontSize: 14, color: '#888', letterSpacing: '1px' }}> OZ</span>
            </div>
            <div className="op-water-target">/ 128 OZ GOAL</div>
            <div className="op-water-cups">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={`op-cup${i < 4 ? ' op-filled' : ''}`} />
              ))}
            </div>
            <button type="button" className="op-water-add">+ 16 OZ</button>
          </div>
        </div>

        <div className="op-section-label"><span>FROM COACH</span></div>
        <div className="op-coach-tile">
          <div className="op-coach-avatar">PK</div>
          <div className="op-coach-body">
            <div className="op-coach-head"><span className="op-coach-name">Percy</span><span className="op-coach-time">2h ago</span></div>
            <div className="op-coach-msg">Solid Friday session. Bump incline press to 65s next week. Check-in photos due Sunday.</div>
          </div>
          <div className="op-unread-dot" />
        </div>
      </div>

      <MicFab context="home" />
      <BottomNav active="home" />
    </PhoneShell>
  );
}
