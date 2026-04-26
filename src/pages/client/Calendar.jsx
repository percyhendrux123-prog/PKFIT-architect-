import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import {
  addDays,
  endOfMonth,
  formatRange,
  startOfMonth,
  startOfWeek,
  ymd,
} from '../../lib/dateUtils';
import { MonthGrid } from '../../components/calendar/MonthGrid';
import { WeekStrip } from '../../components/calendar/WeekStrip';
import { DayAgenda } from '../../components/calendar/DayAgenda';

const VIEWS = ['month', 'week', 'day'];

function viewWindow(view, cursor) {
  if (view === 'month') {
    // Pad to the surrounding 6-week grid so leading/trailing cells are
    // populated when the user pages backward or forward.
    const first = startOfMonth(cursor);
    const last = endOfMonth(cursor);
    return [addDays(startOfWeek(first), -7), addDays(last, 14)];
  }
  if (view === 'week') {
    const start = startOfWeek(cursor);
    return [start, addDays(start, 7)];
  }
  return [cursor, addDays(cursor, 1)];
}

function navStep(view, cursor, direction) {
  if (view === 'month') return new Date(cursor.getFullYear(), cursor.getMonth() + direction, 1);
  if (view === 'week') return addDays(cursor, 7 * direction);
  return addDays(cursor, direction);
}

export default function Calendar() {
  const { user } = useAuth();
  const [view, setView] = useState('month');
  const [cursor, setCursor] = useState(new Date());
  const [sessions, setSessions] = useState([]);
  const [meals, setMeals] = useState([]);
  const [habits, setHabits] = useState(null);
  const [checkIns, setCheckIns] = useState([]);
  const [programs, setPrograms] = useState([]);

  const [from, to] = viewWindow(view, cursor);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const fromYmd = ymd(from);
  const toYmd = ymd(to);

  const reload = useCallback(async () => {
    if (!isSupabaseConfigured || !user) return;
    const [sess, mealRows, habitRow, ci, progs] = await Promise.all([
      supabase
        .from('workout_sessions')
        .select('*')
        .eq('client_id', user.id)
        .or(
          `and(performed_at.gte.${fromIso},performed_at.lt.${toIso}),and(scheduled_for.gte.${fromIso},scheduled_for.lt.${toIso})`,
        ),
      supabase
        .from('meals')
        .select('*')
        .eq('client_id', user.id)
        .gte('date', fromYmd)
        .lt('date', toYmd),
      supabase
        .from('habits')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('check_ins')
        .select('*')
        .eq('client_id', user.id)
        .gte('date', fromYmd)
        .lt('date', toYmd),
      supabase
        .from('programs')
        .select('*')
        .eq('client_id', user.id)
        .eq('status', 'active'),
    ]);
    setSessions(sess.data ?? []);
    setMeals(mealRows.data ?? []);
    setHabits(habitRow.data ?? null);
    setCheckIns(ci.data ?? []);
    setPrograms(progs.data ?? []);
  }, [user?.id, fromIso, toIso, fromYmd, toYmd]);

  useEffect(() => { reload(); }, [reload]);

  const eventsByDay = useMemo(() => {
    const map = {};
    function push(key, ev) {
      (map[key] ??= []).push(ev);
    }
    for (const s of sessions) {
      const when = s.scheduled_for ?? s.performed_at;
      if (!when) continue;
      const date = new Date(when);
      const status = s.performed_at ? 'logged' : 'planned';
      push(ymd(date), {
        id: s.id,
        type: 'workout',
        label: status === 'logged' ? 'Trained' : 'Lift',
        time: date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        title: s.notes ?? '',
        draggable: status === 'planned',
        sourceDate: ymd(date),
      });
    }
    for (const m of meals) {
      if (!m.date) continue;
      push(m.date, {
        id: m.id,
        type: 'meal',
        label: m.meal_type ?? 'Meal',
        title: (m.items ?? []).map((i) => (typeof i === 'string' ? i : i.name)).join(', '),
        detail: m.macros?.kcal ? `${m.macros.kcal} kcal` : null,
      });
    }
    for (const c of checkIns) {
      if (!c.date) continue;
      push(c.date, {
        id: c.id,
        type: 'check_in',
        label: 'Check-in',
        title: c.notes ?? '',
        detail: c.weight ? `${c.weight} lb` : null,
      });
    }
    if (habits?.check_history && typeof habits.check_history === 'object') {
      for (const [date, checks] of Object.entries(habits.check_history)) {
        if (date < fromYmd || date >= toYmd) continue;
        const count = Array.isArray(checks)
          ? checks.length
          : Object.values(checks).filter(Boolean).length;
        if (count > 0) {
          push(date, {
            id: `habit-${date}`,
            type: 'habit',
            label: `${count} habit${count === 1 ? '' : 's'}`,
            detail: null,
          });
        }
      }
    }
    for (const p of programs) {
      const created = new Date(p.created_at);
      push(ymd(created), {
        id: p.id,
        type: 'program',
        label: p.schedule?.title ?? `Program W${p.week_number ?? 1}`,
      });
    }
    return map;
  }, [sessions, meals, checkIns, habits, programs, fromYmd, toYmd]);

  async function handleDrop(event, day) {
    if (event.type !== 'workout' || !event.draggable) return;
    const target = new Date(day.getFullYear(), day.getMonth(), day.getDate(), 9, 0, 0);
    // Optimistic update — patch local state, then write through.
    setSessions((rows) =>
      rows.map((r) => (r.id === event.id ? { ...r, scheduled_for: target.toISOString() } : r)),
    );
    const { error } = await supabase
      .from('workout_sessions')
      .update({ scheduled_for: target.toISOString() })
      .eq('id', event.id);
    if (error) reload();
  }

  function nudge(direction) {
    setCursor(navStep(view, cursor, direction));
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="label mb-2">Calendar</div>
          <h1 className="font-display text-4xl tracking-wider2 text-gold">
            {formatRange(view, cursor)}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="View" className="inline-flex border border-line">
            {VIEWS.map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setView(v)}
                className={`px-3 py-2 text-[0.65rem] uppercase tracking-widest2 transition-colors ${
                  view === v ? 'bg-gold text-bg' : 'text-mute hover:text-ink'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => nudge(-1)}
              aria-label={`Previous ${view}`}
              className="border border-line px-3 py-2 text-[0.65rem] uppercase tracking-widest2 text-mute hover:border-gold focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold"
            >
              Prev
            </button>
            <button
              type="button"
              onClick={() => setCursor(new Date())}
              className="border border-line px-3 py-2 text-[0.65rem] uppercase tracking-widest2 text-mute hover:border-gold focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => nudge(1)}
              aria-label={`Next ${view}`}
              className="border border-line px-3 py-2 text-[0.65rem] uppercase tracking-widest2 text-mute hover:border-gold focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold"
            >
              Next
            </button>
          </div>
        </div>
      </header>

      {view === 'month' ? (
        <MonthGrid
          cursor={cursor}
          eventsByDay={eventsByDay}
          onSelectDay={(d) => { setCursor(d); setView('day'); }}
          onDropOnDay={handleDrop}
        />
      ) : view === 'week' ? (
        <WeekStrip
          cursor={cursor}
          eventsByDay={eventsByDay}
          onSelectDay={(d) => { setCursor(d); setView('day'); }}
          onDropOnDay={handleDrop}
        />
      ) : (
        <DayAgenda cursor={cursor} eventsByDay={eventsByDay} onDropOnDay={handleDrop} />
      )}

      <div className="flex flex-wrap gap-4 text-[0.6rem] uppercase tracking-widest2 text-faint">
        <span className="flex items-center gap-2"><span className="inline-block h-2 w-3 border border-gold/60 bg-gold/15" /> Lift</span>
        <span className="flex items-center gap-2"><span className="inline-block h-2 w-3 border border-line bg-black/40" /> Meal</span>
        <span className="flex items-center gap-2"><span className="inline-block h-2 w-3 border border-success/60 bg-success/15" /> Habit</span>
        <span className="flex items-center gap-2"><span className="inline-block h-2 w-3 border border-signal/60 bg-signal/15" /> Check-in</span>
        <span className="flex items-center gap-2"><span className="inline-block h-2 w-3 border border-line text-faint" /> Program</span>
      </div>
    </div>
  );
}
