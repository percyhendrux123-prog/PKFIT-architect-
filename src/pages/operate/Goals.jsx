import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import { ChevronLeftSvg, TrendingSvg, CalendarSvg, ClockSvg, PlusSvg, MicSvg, CheckSvg } from '../../components/operate/svg';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const GOALS = [
  {
    priority: true, pct: 55, dashoffset: 124, tag: 'PRIMARY · BODY COMP', tagGold: true,
    title: 'CUT TO 8% BODY FAT', now: '11.2%', target: '8.0%', due: 'BY AUG 15',
    checkin: 'NEXT CHECK-IN · TOMORROW', checkinIcon: 'cal', streak: '21 DAY STREAK',
  },
  {
    pct: 68, dashoffset: 88, tag: 'STRENGTH · UPPER',
    title: 'INCLINE PRESS 225 × 5', now: '205 × 5', target: '225 × 5', due: 'BY JUN 30',
    checkin: 'RETEST IN 11 DAYS', checkinIcon: 'cal', streak: 'ON PACE',
  },
  {
    pct: 25, dashoffset: 207, tag: 'HABIT · SLEEP',
    title: '7+ HOURS · 6X / WEEK', now: '3 / 6', target: '6 / 6', due: 'THIS WEEK',
    checkin: 'WEEKLY CHECK SUNDAY', checkinIcon: 'clock', streak: 'FALLING BEHIND', streakRed: true,
  },
  {
    pct: 10, dashoffset: 248, tag: 'CONDITIONING',
    title: '5K UNDER 22 MIN', now: '26:14', target: '21:59', due: 'BY SEP 1',
    checkin: 'RETEST MAY 31', checkinIcon: 'cal', streak: 'JUST STARTED',
  },
];

export default function OperateGoals() {
  const nav = useNavigate();
  const [draftStandard, setDraftStandard] = useState('');
  const { listening, transcript, toggle } = useVoiceCapture({
    onFinal: (t) => setDraftStandard(t),
  });

  return (
    <PhoneShell screen="Standards">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
            <ChevronLeftSvg />
          </button>
          <div className="op-title">STANDARDS</div>
          <button type="button" className="op-icon-btn" aria-label="Trends"><TrendingSvg /></button>
        </div>

        <div className="op-standard-line">
          A man becomes what he <span className="op-gold">repeatedly moves toward.</span>
        </div>

        <div className="op-filter-row">
          <button type="button" className="op-chip op-active">ACTIVE · 4</button>
          <button type="button" className="op-chip">COMPLETED · 7</button>
          <button type="button" className="op-chip">PAUSED</button>
        </div>

        {GOALS.map((g, i) => (
          <div key={i} className={`op-goal-card${g.priority ? ' op-priority' : ''}`}>
            <div className="op-gc-row">
              <div className="op-gc-ring">
                <svg viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#2a2a2a" strokeWidth="8" />
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#C9A84C" strokeWidth="8" strokeDasharray="276" strokeDashoffset={g.dashoffset} strokeLinecap="round" />
                </svg>
                <div className="op-gc-pct">{g.pct}%</div>
              </div>
              <div className="op-gc-body">
                <div className={`op-gc-tag${g.tagGold ? ' op-gold' : ''}`}>{g.tag}</div>
                <div className="op-gc-title">{g.title}</div>
                <div className="op-gc-metric">
                  <span className="op-now">{g.now}</span>
                  <span className="op-arrow">→</span>
                  <span className="op-target">{g.target}</span>
                  <span className="op-due">{g.due}</span>
                </div>
              </div>
            </div>
            <div className="op-gc-foot">
              <div className="op-gc-checkin">
                {g.checkinIcon === 'clock' ? <ClockSvg /> : <CalendarSvg />}
                {g.checkin}
              </div>
              <div className={`op-gc-streak${g.streakRed ? ' op-red' : ''}`}>{g.streak}</div>
            </div>
          </div>
        ))}

        <div className="op-add-goal-row">
          <button type="button" className="op-add-goal">
            <PlusSvg />
            {draftStandard ? draftStandard.toUpperCase() : 'ADD A STANDARD'}
          </button>
          <button
            type="button"
            className="op-add-goal-mic"
            aria-label={listening ? 'Stop voice-create' : 'Voice-create standard'}
            aria-pressed={listening}
            onClick={toggle}
          >
            <MicSvg />
          </button>
        </div>
        {listening ? (
          <div className="op-voice-overlay" style={{ position: 'static', marginTop: 10 }}>
            <div className="op-voice-overlay-head">
              <span className="op-voice-overlay-label">LISTENING…</span>
              <button type="button" className="op-voice-overlay-stop" onClick={toggle}>TAP TO STOP</button>
            </div>
            <div className="op-voice-overlay-quote">{transcript || 'Say a new standard out loud — "Bench 315 by end of summer."'}</div>
          </div>
        ) : null}

        <div className="op-section-label-tight">RECENTLY COMPLETED</div>
        <div className="op-done-card">
          <div className="op-dc-head">
            <div className="op-dc-title">SQUAT 315 × 3</div>
            <div className="op-dc-check"><CheckSvg /></div>
          </div>
          <div className="op-dc-meta">Hit May 18 · 6 days ahead of target</div>
        </div>
        <div className="op-done-card">
          <div className="op-dc-head">
            <div className="op-dc-title">30 DAYS NO ALCOHOL</div>
            <div className="op-dc-check"><CheckSvg /></div>
          </div>
          <div className="op-dc-meta">Hit May 10 · streak still active (37 days)</div>
        </div>
      </div>

      <MicFab context="goals" />
      <BottomNav active="profile" />
    </PhoneShell>
  );
}
