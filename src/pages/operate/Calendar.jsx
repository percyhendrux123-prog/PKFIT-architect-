import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import { ChevronLeftSvg, ChevronRightSvg, SearchSvg } from '../../components/operate/svg';

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DOW_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DOW_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function ymd(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Build the calendar grid for a given month cursor — always 6 weeks (42 cells)
// so the layout doesn't reflow between months.
function buildMonthCells(cursor, today, eventsByDay) {
  const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = firstOfMonth.getDay(); // 0=Sun
  const gridStart = new Date(firstOfMonth);
  gridStart.setDate(gridStart.getDate() - startOffset);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const key = ymd(d);
    const ev = eventsByDay.get(key);
    const muted = d.getMonth() !== cursor.getMonth();
    const isToday = isSameDay(d, today);
    const isPast = d < today && !isToday;

    let dot = null;
    if (ev?.logged) dot = 'done';
    else if (ev?.planned) dot = isPast ? 'miss' : 'pend';

    cells.push({
      n: d.getDate(),
      muted,
      today: isToday,
      rest: !dot && !muted,
      dot,
      date: d,
    });
  }
  return cells;
}

function tagFor(title) {
  if (!title) return { label: 'TRAIN', cls: 'op-tag-push' };
  const t = title.toLowerCase();
  if (t.includes('push')) return { label: 'PUSH', cls: 'op-tag-push' };
  if (t.includes('pull')) return { label: 'PULL', cls: 'op-tag-pull' };
  if (t.includes('leg')) return { label: 'LEGS', cls: 'op-tag-legs' };
  if (t.includes('rest') || t.includes('mobility') || t.includes('off')) return { label: 'REST', cls: 'op-tag-rest' };
  return { label: 'TRAIN', cls: 'op-tag-push' };
}

export default function OperateCalendar() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return undefined;
    let cancelled = false;
    const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
    const padStart = new Date(monthStart);
    padStart.setDate(padStart.getDate() - 7);
    const padEnd = new Date(monthEnd);
    padEnd.setDate(padEnd.getDate() + 7);
    const fromIso = padStart.toISOString();
    const toIso = padEnd.toISOString();

    supabase
      .from('workout_sessions')
      .select('id,performed_at,scheduled_for,notes,exercises')
      .eq('client_id', user.id)
      .or(
        `and(performed_at.gte.${fromIso},performed_at.lte.${toIso}),and(scheduled_for.gte.${fromIso},scheduled_for.lte.${toIso})`,
      )
      .then(({ data }) => {
        if (!cancelled) setSessions(data ?? []);
      });
    return () => { cancelled = true; };
  }, [user?.id, cursor]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const eventsByDay = useMemo(() => {
    const map = new Map();
    for (const s of sessions) {
      const when = s.performed_at ?? s.scheduled_for;
      if (!when) continue;
      const key = ymd(new Date(when));
      const prev = map.get(key) ?? { logged: false, planned: false, sessions: [] };
      prev.sessions.push(s);
      if (s.performed_at) prev.logged = true;
      else prev.planned = true;
      map.set(key, prev);
    }
    return map;
  }, [sessions]);

  const cells = useMemo(
    () => buildMonthCells(cursor, today, eventsByDay),
    [cursor, today, eventsByDay],
  );

  // Upcoming list: next 7 days starting today, with the session title/exercises.
  const upcoming = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i += 1) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const key = ymd(d);
      const ev = eventsByDay.get(key);
      const session = ev?.sessions?.[0];
      const exCount = Array.isArray(session?.exercises) ? session.exercises.length : 0;
      const title = session?.notes ?? '';
      const tag = session ? tagFor(title) : { label: 'REST', cls: 'op-tag-rest' };
      out.push({
        key,
        dow: DOW_SHORT[d.getDay()],
        n: d.getDate(),
        title: session ? (title || 'Training session') : 'Rest day',
        meta: session
          ? (exCount ? `${exCount} exercises${session.performed_at ? ' · logged' : ''}` : (session.performed_at ? 'Logged' : 'Scheduled'))
          : 'No session scheduled',
        tag: tag.label,
        tagClass: tag.cls,
        today: i === 0,
        id: session?.id,
      });
    }
    return out;
  }, [eventsByDay, today]);

  const completedThisMonth = useMemo(() => {
    return cells.filter((c) => !c.muted && c.dot === 'done').length;
  }, [cells]);
  const scheduledThisMonth = useMemo(() => {
    return cells.filter((c) => !c.muted && (c.dot === 'done' || c.dot === 'pend' || c.dot === 'miss')).length;
  }, [cells]);

  function shiftMonth(delta) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  function openSession(id) {
    if (id) nav(`/workouts/sessions/${id}`);
  }

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
            <span className="op-month-name">{MONTH_NAMES[cursor.getMonth()]}</span>
            <span className="op-month-year">{cursor.getFullYear()}</span>
          </div>
          <div className="op-month-nav">
            <button type="button" className="op-icon-btn op-icon-btn--mute" onClick={() => shiftMonth(-1)} aria-label="Previous month"><ChevronLeftSvg /></button>
            <button type="button" className="op-icon-btn op-icon-btn--mute" onClick={() => shiftMonth(1)} aria-label="Next month"><ChevronRightSvg /></button>
          </div>
        </div>

        <div className="op-dow">
          {DOW_LETTERS.map((l, i) => <span key={i}>{l}</span>)}
        </div>
        <div className="op-month-grid">
          {cells.map((c, i) => {
            const classes = ['op-mc'];
            if (c.muted) classes.push('op-muted');
            if (c.rest) classes.push('op-rest');
            if (c.today) classes.push('op-today op-selected');
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
          <span className="op-right">
            {completedThisMonth} / {scheduledThisMonth || '—'} {scheduledThisMonth ? 'ON PACE' : ''}
          </span>
        </div>
        <div className="op-upcoming-list">
          {upcoming.map((u) => (
            <div
              key={u.key}
              className={`op-up-row${u.today ? ' op-today' : ''}`}
              role={u.id ? 'button' : undefined}
              tabIndex={u.id ? 0 : undefined}
              onClick={() => openSession(u.id)}
              onKeyDown={(e) => { if (e.key === 'Enter') openSession(u.id); }}
              style={u.id ? { cursor: 'pointer' } : undefined}
            >
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
