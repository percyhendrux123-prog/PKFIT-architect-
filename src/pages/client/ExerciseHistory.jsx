import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { aggregateExerciseHistory, estimatedOneRm } from '../../lib/exerciseStats';
import { Sparkline } from '../../components/Sparkline';
import { Input } from '../../components/ui/Input';

export default function ExerciseHistory() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }
    supabase
      .from('workout_sessions')
      .select('performed_at,exercises')
      .eq('client_id', user.id)
      .order('performed_at', { ascending: true })
      .then(({ data }) => {
        setSessions(data ?? []);
        setLoading(false);
      });
  }, [user?.id]);

  const stats = useMemo(() => aggregateExerciseHistory(sessions), [sessions]);
  const rows = useMemo(() => {
    const items = Object.entries(stats).map(([key, data]) => ({ key, ...data }));
    items.sort((a, b) => b.totalSets - a.totalSets);
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((i) => i.name.toLowerCase().includes(needle));
  }, [stats, q]);

  const selected = selectedKey ? stats[selectedKey] : null;
  const series = selected ? selected.entries.map((e) => e.e1rm ?? e.weight) : [];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">History</div>
          <h1 className="font-display text-4xl tracking-wider2">Exercise record</h1>
          <p className="mt-2 max-w-reading text-sm text-mute">
            Every logged set across every session. PRs by max weight and max estimated 1RM (Epley).
          </p>
        </div>
        <Link to="/workouts" className="text-xs uppercase tracking-widest2 text-gold">
          ← Workouts
        </Link>
      </header>

      {loading ? (
        <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>
      ) : rows.length === 0 ? (
        <div className="border border-line bg-black/20 p-6 text-sm text-mute">
          Nothing recorded. Log a session with checked sets on Workouts. The data turns into the record here.
        </div>
      ) : (
        <>
          <Input
            label="Search"
            placeholder="Exercise name or muscle"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="overflow-x-auto border border-line">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line text-xs uppercase tracking-widest2 text-faint">
                <tr>
                  <th className="px-4 py-3">Exercise</th>
                  <th className="px-4 py-3">Sessions</th>
                  <th className="px-4 py-3">Sets</th>
                  <th className="px-4 py-3">Max weight</th>
                  <th className="px-4 py-3">Est. 1RM</th>
                  <th className="px-4 py-3">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr
                    key={r.key}
                    onClick={() => setSelectedKey(r.key === selectedKey ? null : r.key)}
                    className={`cursor-pointer ${r.key === selectedKey ? 'bg-black/60' : 'hover:bg-black/30'}`}
                  >
                    <td className="px-4 py-3 font-display tracking-wider2">{r.name}</td>
                    <td className="px-4 py-3 text-mute">{r.totalSessions}</td>
                    <td className="px-4 py-3 text-mute">{r.totalSets}</td>
                    <td className="px-4 py-3 text-ink">
                      {r.bestWeight ? `${r.bestWeight.weight}×${r.bestWeight.reps}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gold">
                      {r.bestE1Rm ? `${r.bestE1Rm.e1rm}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Sparkline values={r.entries.map((e) => e.e1rm ?? e.weight)} width={120} height={28} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selected ? (
        <section className="border border-line bg-black/30 p-5">
          <header className="mb-3 flex items-end justify-between">
            <div>
              <div className="label">{selected.name}</div>
              <h2 className="mt-1 font-display text-2xl tracking-wider2">
                {selected.bestE1Rm ? `PR ${selected.bestE1Rm.e1rm} est. 1RM` : 'No PR yet'}
              </h2>
            </div>
            {selected.bestWeight ? (
              <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                Best lift · {selected.bestWeight.weight}×{selected.bestWeight.reps} on{' '}
                {new Date(selected.bestWeight.date).toLocaleDateString()}
              </div>
            ) : null}
          </header>
          <Sparkline values={series} width={640} height={80} />
          <ul className="mt-5 divide-y divide-line">
            {selected.entries
              .slice()
              .reverse()
              .slice(0, 20)
              .map((e, i) => (
                <li
                  key={i}
                  className="grid grid-cols-[120px_1fr_1fr_1fr] gap-3 py-2 text-sm"
                >
                  <span className="label">
                    {new Date(e.date).toLocaleDateString()}
                  </span>
                  <span className="text-ink">{e.weight} × {e.reps}</span>
                  <span className="text-faint">{e.rpe != null ? `RPE ${e.rpe}` : ''}</span>
                  <span className="text-gold">
                    {e.e1rm != null ? `${e.e1rm} est.` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {/* Tiny inline sanity check — shown only in dev, hidden in prod builds. */}
      {import.meta.env.DEV ? (
        <div className="border border-dashed border-line p-3 text-[0.6rem] uppercase tracking-widest2 text-faint">
          Epley sanity · 100kg × 5 = {estimatedOneRm(100, 5)} (expect 116.7)
        </div>
      ) : null}
    </div>
  );
}
