import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { estimatedOneRm } from '../../lib/exerciseStats';
import { Card, CardHeader } from '../../components/ui/Card';

export default function SessionDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !user || !id) {
      setLoading(false);
      return;
    }
    supabase
      .from('workout_sessions')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setSession(data ?? null);
        setLoading(false);
      });
  }, [id, user?.id]);

  if (loading) return <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>;
  if (!session) return <div className="text-sm text-mute">Session not found.</div>;

  const exercises = Array.isArray(session.exercises) ? session.exercises : [];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Session</div>
          <h1 className="font-display text-4xl tracking-wider2">
            {new Date(session.performed_at).toLocaleString()}
          </h1>
          {session.notes ? (
            <p className="mt-2 max-w-reading text-sm text-mute">{session.notes}</p>
          ) : null}
        </div>
        <Link to="/workouts" className="text-xs uppercase tracking-widest2 text-gold">← Workouts</Link>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader label="Duration" title={session.duration_min != null ? `${session.duration_min}m` : '—'} />
        </Card>
        <Card>
          <CardHeader label="Avg RPE" title={session.rpe_avg != null ? String(session.rpe_avg) : '—'} />
        </Card>
        <Card>
          <CardHeader label="Exercises" title={String(exercises.length)} />
        </Card>
      </section>

      {exercises.length === 0 ? (
        <div className="border border-line bg-black/20 p-6 text-sm text-mute">
          No exercises attached to this session.
        </div>
      ) : (
        <ul className="space-y-4">
          {exercises.map((ex, i) => {
            const sets = Array.isArray(ex.sets) ? ex.sets : [];
            const doneSets = sets.filter((s) => s?.done);
            const bestSet = doneSets.reduce(
              (best, s) => {
                const w = Number(s.weight);
                if (!Number.isFinite(w)) return best;
                return !best || w > best.weight ? { weight: w, reps: Number(s.reps) || 0, rpe: s.rpe } : best;
              },
              null,
            );
            const best1rm = bestSet ? estimatedOneRm(bestSet.weight, bestSet.reps) : null;
            return (
              <section key={i} className="border border-line bg-black/30">
                <header className="flex items-center justify-between border-b border-line p-3">
                  <div>
                    <div className="font-display tracking-wider2">{ex.name}</div>
                    {ex.prescribed ? (
                      <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                        prescribed · {ex.prescribed.sets ?? '—'}×{ex.prescribed.reps ?? '—'}
                        {ex.prescribed.load ? ` @ ${ex.prescribed.load}` : ''}
                      </div>
                    ) : null}
                  </div>
                  {bestSet ? (
                    <div className="text-right text-[0.6rem] uppercase tracking-widest2 text-faint">
                      best · {bestSet.weight}×{bestSet.reps}
                      {best1rm ? ` · est. ${best1rm}` : ''}
                    </div>
                  ) : null}
                </header>
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-line text-[0.6rem] uppercase tracking-widest2 text-faint">
                    <tr>
                      <th className="px-3 py-2">Set</th>
                      <th className="px-3 py-2">Done</th>
                      <th className="px-3 py-2">Weight</th>
                      <th className="px-3 py-2">Reps</th>
                      <th className="px-3 py-2">RPE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {sets.map((s, j) => (
                      <tr key={j}>
                        <td className="px-3 py-2 text-mute">{j + 1}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-block h-3 w-3 border ${s?.done ? 'bg-gold border-gold' : 'border-line'}`} />
                        </td>
                        <td className="px-3 py-2">{s?.weight ?? '—'}</td>
                        <td className="px-3 py-2">{s?.reps ?? '—'}</td>
                        <td className="px-3 py-2 text-faint">{s?.rpe ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            );
          })}
        </ul>
      )}
    </div>
  );
}
