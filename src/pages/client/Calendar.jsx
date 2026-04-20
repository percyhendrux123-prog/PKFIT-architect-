import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function daysInMonth(d) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

export default function Calendar() {
  const { user } = useAuth();
  const [cursor, setCursor] = useState(new Date());
  const [checkIns, setCheckIns] = useState([]);
  const [programs, setPrograms] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    const from = startOfMonth(cursor).toISOString();
    const to = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).toISOString();

    supabase
      .from('check_ins')
      .select('*')
      .eq('client_id', user.id)
      .gte('date', from)
      .lt('date', to)
      .then(({ data }) => setCheckIns(data ?? []));

    supabase
      .from('programs')
      .select('*')
      .eq('client_id', user.id)
      .gte('created_at', from)
      .lt('created_at', to)
      .then(({ data }) => setPrograms(data ?? []));
  }, [user?.id, cursor]);

  const cells = useMemo(() => {
    const first = startOfMonth(cursor);
    const pad = first.getDay();
    const total = daysInMonth(cursor);
    const cells = [];
    for (let i = 0; i < pad; i += 1) cells.push(null);
    for (let d = 1; d <= total; d += 1) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    return cells;
  }, [cursor]);

  const byDate = (date) => {
    const key = date.toISOString().slice(0, 10);
    const ci = checkIns.filter((c) => c.date?.startsWith(key));
    const pr = programs.filter((p) => p.created_at?.startsWith(key));
    return { ci, pr };
  };

  const monthLabel = cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label mb-2">Calendar</div>
          <h1 className="font-display text-4xl tracking-wider2">{monthLabel}</h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="border border-line px-3 py-2 text-xs uppercase tracking-widest2 text-mute hover:border-gold"
          >
            Prev
          </button>
          <button
            onClick={() => setCursor(new Date())}
            className="border border-line px-3 py-2 text-xs uppercase tracking-widest2 text-mute hover:border-gold"
          >
            Today
          </button>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="border border-line px-3 py-2 text-xs uppercase tracking-widest2 text-mute hover:border-gold"
          >
            Next
          </button>
        </div>
      </header>

      <div className="grid grid-cols-7 gap-px bg-line">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="bg-bg py-2 text-center text-[0.65rem] uppercase tracking-widest2 text-faint">
            {d}
          </div>
        ))}
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="aspect-square bg-bg/60" />;
          const { ci, pr } = byDate(date);
          const isToday = date.toDateString() === new Date().toDateString();
          return (
            <div key={date.toISOString()} className={`aspect-square bg-bg p-2 ${isToday ? 'ring-1 ring-gold' : ''}`}>
              <div className="text-xs text-faint">{date.getDate()}</div>
              {ci.length > 0 ? <div className="mt-1 h-1 w-6 bg-gold" title="Check-in" /> : null}
              {pr.length > 0 ? <div className="mt-1 h-1 w-6 bg-ink/60" title="Program" /> : null}
            </div>
          );
        })}
      </div>

      <div className="flex gap-6 text-xs uppercase tracking-widest2 text-faint">
        <span className="flex items-center gap-2"><span className="inline-block h-1 w-6 bg-gold" /> Check-in</span>
        <span className="flex items-center gap-2"><span className="inline-block h-1 w-6 bg-ink/60" /> Program</span>
      </div>
    </div>
  );
}
