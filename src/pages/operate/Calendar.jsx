import { useNavigate } from 'react-router-dom';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import { ChevronLeftSvg, ChevronRightSvg, SearchSvg } from '../../components/operate/svg';

const MONTH_CELLS = [
  // Trailing days of prior month (muted)
  { n: 26, muted: true }, { n: 27, muted: true }, { n: 28, muted: true }, { n: 29, muted: true }, { n: 30, muted: true },
  { n: 1, dot: 'done' }, { n: 2, rest: true },
  { n: 3, rest: true }, { n: 4, dot: 'done' }, { n: 5, dot: 'done' }, { n: 6, dot: 'miss' }, { n: 7, dot: 'done' }, { n: 8, dot: 'done' }, { n: 9, rest: true },
  { n: 10, rest: true }, { n: 11, dot: 'done' }, { n: 12, dot: 'done' }, { n: 13, dot: 'done' }, { n: 14, dot: 'done' }, { n: 15, dot: 'done' }, { n: 16, rest: true },
  { n: 17, rest: true }, { n: 18, dot: 'done' }, { n: 19, dot: 'done' }, { n: 20, dot: 'miss' }, { n: 21, dot: 'done' }, { n: 22, dot: 'done' }, { n: 23, today: true, selected: true, dot: 'pend' },
  { n: 24, rest: true }, { n: 25, dot: 'pend' }, { n: 26, dot: 'pend' }, { n: 27, dot: 'pend' }, { n: 28, dot: 'pend' }, { n: 29, dot: 'pend' }, { n: 30, rest: true },
  { n: 31, rest: true }, { n: 1, muted: true }, { n: 2, muted: true }, { n: 3, muted: true }, { n: 4, muted: true }, { n: 5, muted: true }, { n: 6, muted: true },
];

const UPCOMING = [
  { dow: 'SAT', n: 23, title: 'Push · Chest + Shoulders', meta: '6 exercises · ~45 min', tag: 'PUSH', tagClass: 'op-tag-push', today: true },
  { dow: 'SUN', n: 24, title: 'Rest Day · Mobility', meta: 'Check-in photos due', tag: 'REST', tagClass: 'op-tag-rest' },
  { dow: 'MON', n: 25, title: 'Pull · Back + Biceps', meta: '7 exercises · ~50 min', tag: 'PULL', tagClass: 'op-tag-pull' },
  { dow: 'TUE', n: 26, title: 'Legs · Quad Focus', meta: '5 exercises · ~55 min', tag: 'LEGS', tagClass: 'op-tag-legs' },
  { dow: 'WED', n: 27, title: 'Push · Shoulder Focus', meta: '6 exercises · ~45 min', tag: 'PUSH', tagClass: 'op-tag-push' },
  { dow: 'THU', n: 28, title: 'Pull · Back Width', meta: '7 exercises · ~50 min', tag: 'PULL', tagClass: 'op-tag-pull' },
];

export default function OperateCalendar() {
  const nav = useNavigate();
  return (
    <PhoneShell screen="Calendar">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
            <ChevronLeftSvg />
          </button>
          <div className="op-title">CALENDAR</div>
          <button type="button" className="op-icon-btn" aria-label="Search"><SearchSvg /></button>
        </div>

        <div className="op-month-bar">
          <div>
            <span className="op-month-name">MAY</span>
            <span className="op-month-year">2026</span>
          </div>
          <div className="op-month-nav">
            <button type="button" className="op-icon-btn op-icon-btn--mute" aria-label="Previous month"><ChevronLeftSvg /></button>
            <button type="button" className="op-icon-btn op-icon-btn--mute" aria-label="Next month"><ChevronRightSvg /></button>
          </div>
        </div>

        <div className="op-dow">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="op-month-grid">
          {MONTH_CELLS.map((c, i) => {
            const classes = ['op-mc'];
            if (c.muted) classes.push('op-muted');
            if (c.rest) classes.push('op-rest');
            if (c.today) classes.push('op-today');
            if (c.selected) classes.push('op-selected');
            return (
              <div key={i} className={classes.join(' ')}>
                <span className="op-mc-num">{c.n}</span>
                {c.dot ? <span className={`op-mc-dot op-dot-${c.dot}`} /> : null}
              </div>
            );
          })}
        </div>

        <div className="op-legend">
          <span><span className="op-mc-dot op-dot-done" />COMPLETED</span>
          <span><span className="op-mc-dot op-dot-pend" />SCHEDULED</span>
          <span><span className="op-mc-dot op-dot-miss" />MISSED</span>
        </div>

        <div className="op-section-label">
          <span>UPCOMING · NEXT 7 DAYS</span>
          <span className="op-right">22 / 28 ON PACE</span>
        </div>
        <div className="op-upcoming-list">
          {UPCOMING.map((u, i) => (
            <div key={i} className={`op-up-row${u.today ? ' op-today' : ''}`}>
              <div className="op-up-date">
                <span className="op-up-dow">{u.dow}</span>
                <span className="op-up-num">{u.n}</span>
              </div>
              <div className="op-up-body">
                <div className="op-up-title">{u.title}</div>
                <div className="op-up-meta">{u.meta}</div>
              </div>
              <div className={`op-up-tag ${u.tagClass}`}>{u.tag}</div>
            </div>
          ))}
        </div>
      </div>

      <MicFab context="calendar" />
      <BottomNav active="training" />
    </PhoneShell>
  );
}
