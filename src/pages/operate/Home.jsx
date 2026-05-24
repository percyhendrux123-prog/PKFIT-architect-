import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
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

function ymd(d) {
  return d.toISOString().slice(0, 10);
}

// Builds the last 7 day strip ending today (oldest left → today right).
function buildWeekStrip(sessionsByDay) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const out = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = ymd(d);
    const isToday = i === 0;
    const isPast = i > 0;
    const completed = sessionsByDay.has(key);
    let dotClass;
    if (completed) dotClass = 'op-dot-done';
    else if (isPast) dotClass = 'op-dot-miss';
    else dotClass = 'op-dot-pend';
    out.push({
      l: letters[d.getDay()],
      n: d.getDate(),
      d: dotClass,
      today: isToday,
    });
  }
  return out;
}

function relativeTime(iso) {
  if (!iso) return '';
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return `${Math.floor(d / 7)}w ago`;
}

function macroTotalsFromMeals(meals) {
  const totals = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const m of meals) {
    if (!m.eaten) continue;
    const macros = m.macros ?? {};
    totals.kcal += Number(macros.kcal ?? 0);
    totals.p += Number(macros.p ?? 0);
    totals.c += Number(macros.c ?? 0);
    totals.f += Number(macros.f ?? 0);
  }
  return totals;
}

export default function OperateHome() {
  const { user, profile } = useAuth();
  const name = firstName(profile);
  const [activeProgram, setActiveProgram] = useState(null);
  const [todaySession, setTodaySession] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [todayMeals, setTodayMeals] = useState([]);
  const [coachMsg, setCoachMsg] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return undefined;
    let cancelled = false;
    const today = ymd(new Date());
    const sinceIso = new Date(Date.now() - 8 * 86400000).toISOString();
    const todayStartIso = new Date(`${today}T00:00:00`).toISOString();
    const todayEndIso = new Date(`${today}T23:59:59`).toISOString();

    Promise.all([
      supabase
        .from('programs')
        .select('*')
        .eq('client_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('workout_sessions')
        .select('id,performed_at,scheduled_for,notes,exercises,duration_min,program_id')
        .eq('client_id', user.id)
        .gte('performed_at', sinceIso)
        .order('performed_at', { ascending: false }),
      supabase
        .from('workout_sessions')
        .select('id,scheduled_for,notes,exercises,program_id')
        .eq('client_id', user.id)
        .is('performed_at', null)
        .gte('scheduled_for', todayStartIso)
        .lte('scheduled_for', todayEndIso)
        .order('scheduled_for', { ascending: true })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('meals')
        .select('id,meal_type,items,macros,eaten')
        .eq('client_id', user.id)
        .eq('date', today)
        .order('meal_type'),
    ])
      .then(([prog, sess, planned, meals]) => {
        if (cancelled) return;
        setActiveProgram(prog.data ?? null);
        setSessions(sess.data ?? []);
        setTodaySession(planned.data ?? null);
        setTodayMeals(meals.data ?? []);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [user?.id]);

  // Latest coach message (best-effort across legacy `messages` table and the
  // dm_messages thread system; whichever has data shows).
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return undefined;
    let cancelled = false;

    (async () => {
      // Prefer dm_messages (current system).
      const { data: thread } = await supabase
        .from('dm_threads')
        .select('id')
        .eq('client_id', user.id)
        .maybeSingle();
      if (thread?.id) {
        const { data: msgs } = await supabase
          .from('dm_messages')
          .select('id,content,author_id,created_at')
          .eq('thread_id', thread.id)
          .neq('author_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        if (!cancelled && msgs?.[0]) {
          setCoachMsg({ body: msgs[0].content, created_at: msgs[0].created_at });
          return;
        }
      }
      // Fallback to legacy `messages` table if present.
      const { data: legacy } = await supabase
        .from('messages')
        .select('id,body,created_at')
        .eq('client_id', user.id)
        .eq('sender_role', 'coach')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled && legacy) {
        setCoachMsg({ body: legacy.body, created_at: legacy.created_at });
      }
    })().catch(() => {});

    return () => { cancelled = true; };
  }, [user?.id]);

  const sessionsByDay = useMemo(() => {
    const set = new Set();
    for (const s of sessions) {
      if (s.performed_at) set.add(ymd(new Date(s.performed_at)));
    }
    return set;
  }, [sessions]);

  const weekStrip = useMemo(() => buildWeekStrip(sessionsByDay), [sessionsByDay]);

  // Today's session: prefer a scheduled-for-today row, fall back to active
  // program's first exercises (so a fresh user with a generated program but
  // no individual sessions still has something to start).
  const sessionExercises = useMemo(() => {
    if (todaySession?.exercises?.length) return todaySession.exercises;
    if (activeProgram?.exercises?.length) return activeProgram.exercises;
    return [];
  }, [todaySession, activeProgram]);

  const sessionTitle = (todaySession?.notes
    || activeProgram?.schedule?.title
    || activeProgram?.name
    || '').trim();
  const sessionTag = activeProgram
    ? `WK ${activeProgram.week_number ?? 1}`
    : null;
  const sessionRoute = todaySession?.id
    ? `/workouts/sessions/${todaySession.id}`
    : '/workouts';

  // Macros — sum eaten meals; targets from profile, fallback to a sane block.
  const macros = useMemo(() => macroTotalsFromMeals(todayMeals), [todayMeals]);
  const targetKcal = profile?.target_kcal ?? 2400;
  const targetP = profile?.target_protein_g ?? 200;
  const targetC = profile?.target_carbs_g ?? 240;
  const targetF = profile?.target_fat_g ?? 80;
  const remaining = Math.max(0, targetKcal - Math.round(macros.kcal));

  // Ring math — 2*pi*r. r=44 → ~276; r=36 → ~226; r=28 → ~176.
  const ringOffset = (consumed, target, circ) => {
    const pct = target > 0 ? Math.min(1, consumed / target) : 0;
    return Math.round(circ * (1 - pct));
  };

  const sessionCount = sessionExercises.length;

  return (
    <PhoneShell screen="Home">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" aria-label="Menu"><HamburgerSvg /></button>
          <div className="op-brand">PKFIT</div>
          <button type="button" className="op-icon-btn" aria-label="Notifications"><BellSvg /></button>
        </div>

        <div className="op-greeting-label">
          {todayLabel()}{activeProgram?.week_number ? ` · WEEK ${activeProgram.week_number}` : ''}
        </div>
        <div className="op-greeting-name">{timeOfDayGreeting()}, {name}</div>

        <div className="op-section-label"><span>TODAY&apos;S SESSION</span><a>SKIP</a></div>
        {sessionCount > 0 ? (
          <div className="op-session-card">
            <div className="op-session-head">
              <div>
                <div className="op-session-title">{(sessionTitle || 'TRAINING SESSION').toUpperCase()}</div>
                <div className="op-session-sub">
                  {sessionCount} exercise{sessionCount === 1 ? '' : 's'}
                  {sessionCount ? ` · ${Math.max(30, sessionCount * 8)} min est.` : ''}
                </div>
              </div>
              {sessionTag ? <div className="op-session-tag">{sessionTag}</div> : null}
            </div>
            <div className="op-ex-list">
              {sessionExercises.slice(0, 3).map((ex, i) => (
                <div key={i} className="op-ex-row">
                  <span className="op-ex-name">{ex.name ?? ex.title ?? `Exercise ${i + 1}`}</span>
                  <span className="op-ex-sets">
                    {ex.sets ? `${ex.sets} × ${ex.reps ?? '—'}` : ''}
                  </span>
                </div>
              ))}
              {sessionCount > 3 ? (
                <div className="op-ex-row">
                  <span className="op-ex-name" style={{ color: '#888' }}>+ {sessionCount - 3} more</span>
                  <span className="op-ex-sets" style={{ color: '#555' }}>VIEW ALL</span>
                </div>
              ) : null}
            </div>
            <Link to={sessionRoute} className="op-start-btn" style={{ textDecoration: 'none' }}>
              <PlaySvg />
              START SESSION
            </Link>
          </div>
        ) : (
          <div className="op-session-card">
            <div className="op-session-head">
              <div>
                <div className="op-session-title">NO SESSION SCHEDULED</div>
                <div className="op-session-sub">Generate a program or browse your library.</div>
              </div>
            </div>
            <Link to="/workouts/generator" className="op-start-btn" style={{ textDecoration: 'none' }}>
              <PlaySvg />
              BUILD A PROGRAM
            </Link>
          </div>
        )}

        <div className="op-section-label"><span>THIS WEEK</span></div>
        <div className="op-week-strip">
          {weekStrip.map((c, i) => (
            <div key={i} className={`op-day-cell${c.today ? ' op-today' : ''}`}>
              <span className="op-day-letter">{c.l}</span>
              <span className="op-day-num">{c.n}</span>
              <span className={`op-day-dot ${c.d}`} />
            </div>
          ))}
        </div>

        <div className="op-duo-row">
          <div className="op-panel">
            <div className="op-panel-label">
              <span>MACROS TODAY</span>
              <span className="op-delta">{remaining} LEFT</span>
            </div>
            <div className="op-macro-rings">
              <svg className="op-ring-svg" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="44" fill="none" stroke="#2a2a2a" strokeWidth="5" />
                <circle cx="50" cy="50" r="44" fill="none" stroke="#C9A84C" strokeWidth="5"
                  strokeDasharray="276" strokeDashoffset={ringOffset(macros.p, targetP, 276)} strokeLinecap="round" />
                <circle cx="50" cy="50" r="36" fill="none" stroke="#2a2a2a" strokeWidth="5" />
                <circle cx="50" cy="50" r="36" fill="none" stroke="#7a8fb5" strokeWidth="5"
                  strokeDasharray="226" strokeDashoffset={ringOffset(macros.c, targetC, 226)} strokeLinecap="round" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#2a2a2a" strokeWidth="5" />
                <circle cx="50" cy="50" r="28" fill="none" stroke="#a37b5e" strokeWidth="5"
                  strokeDasharray="176" strokeDashoffset={ringOffset(macros.f, targetF, 176)} strokeLinecap="round" />
              </svg>
              <div className="op-ring-center">
                <div className="op-num">{Math.round(macros.kcal)}</div>
                <div className="op-lbl">/ {targetKcal} KCAL</div>
              </div>
            </div>
            <div className="op-macro-key">
              <span><span className="op-key-dot" style={{ background: '#C9A84C' }} />P {Math.round(macros.p)}</span>
              <span><span className="op-key-dot" style={{ background: '#7a8fb5' }} />C {Math.round(macros.c)}</span>
              <span><span className="op-key-dot" style={{ background: '#a37b5e' }} />F {Math.round(macros.f)}</span>
            </div>
          </div>
          <div className="op-panel op-water-panel">
            {/* TODO: needs a `water_log` table or `meals.macros.water` field. Static placeholder. */}
            <div className="op-panel-label"><span>WATER</span></div>
            <div className="op-water-num">
              <span className="op-gold">—</span>
              <span style={{ fontSize: 14, color: '#888', letterSpacing: '1px' }}> OZ</span>
            </div>
            <div className="op-water-target">/ 128 OZ GOAL</div>
            <div className="op-water-cups">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="op-cup" />
              ))}
            </div>
            <button type="button" className="op-water-add">+ 16 OZ</button>
          </div>
        </div>

        {coachMsg ? (
          <>
            <div className="op-section-label"><span>FROM COACH</span></div>
            <Link to="/inbox" className="op-coach-tile" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="op-coach-avatar">PK</div>
              <div className="op-coach-body">
                <div className="op-coach-head">
                  <span className="op-coach-name">Percy</span>
                  <span className="op-coach-time">{relativeTime(coachMsg.created_at)}</span>
                </div>
                <div className="op-coach-msg">{coachMsg.body}</div>
              </div>
              <div className="op-unread-dot" />
            </Link>
          </>
        ) : null}
      </div>

      <MicFab context="home" />
      <BottomNav active="home" />
    </PhoneShell>
  );
}
