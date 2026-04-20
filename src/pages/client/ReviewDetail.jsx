import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export default function ReviewDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState({});

  useEffect(() => {
    if (!isSupabaseConfigured || !user || !id) {
      setLoading(false);
      return;
    }
    supabase
      .from('reviews')
      .select('*')
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => {
        setReview(data ?? null);
        setState(data?.adjustments_state && typeof data.adjustments_state === 'object' ? data.adjustments_state : {});
        setLoading(false);
      });
  }, [id, user?.id]);

  async function toggleAdjustment(index) {
    const next = { ...state, [index]: !state[index] };
    setState(next);
    await supabase.from('reviews').update({ adjustments_state: next }).eq('id', id);
  }

  const doneCount = useMemo(() => Object.values(state).filter(Boolean).length, [state]);

  if (loading) return <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>;
  if (!review) return <div className="text-sm text-mute">Review not found.</div>;

  const {
    summary,
    constraints = [],
    adjustments = [],
    metrics = {},
    week_starting,
    coach_comment,
    coach_commented_at,
  } = review;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label mb-2">Review</div>
          <h1 className="font-display text-4xl tracking-wider2">Week of {week_starting}</h1>
        </div>
        <Link to="/reviews" className="text-xs uppercase tracking-widest2 text-gold">← All reviews</Link>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader label="Adherence" title={metrics.adherence_pct != null ? `${metrics.adherence_pct}%` : '—'} />
        </Card>
        <Card>
          <CardHeader
            label="Weight Δ"
            title={metrics.weight_delta_kg != null ? `${metrics.weight_delta_kg > 0 ? '+' : ''}${metrics.weight_delta_kg} kg` : '—'}
          />
        </Card>
        <Card>
          <CardHeader label="Sessions" title={String(metrics.sessions_completed ?? '—')} />
        </Card>
      </section>

      <section className="border border-line bg-black/30 p-5">
        <div className="label mb-2">Diagnosis</div>
        <p className="max-w-reading whitespace-pre-wrap text-ink/90">{summary}</p>
      </section>

      {coach_comment ? (
        <section className="border border-gold bg-black/40 p-5">
          <div className="label mb-2">Note from the coach</div>
          <p className="max-w-reading whitespace-pre-wrap text-ink">{coach_comment}</p>
          {coach_commented_at ? (
            <div className="mt-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
              {new Date(coach_commented_at).toLocaleString()}
            </div>
          ) : null}
        </section>
      ) : null}

      {constraints.length > 0 ? (
        <section>
          <div className="label mb-2">Constraints</div>
          <ul className="space-y-2">
            {constraints.map((c, i) => (
              <li key={i} className="flex items-start gap-3 border border-line bg-black/20 p-3">
                <Badge tone="gold">0{i + 1}</Badge>
                <span className="text-sm">{c}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {adjustments.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <div className="label">Next week</div>
            <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
              {doneCount}/{adjustments.length} installed
            </div>
          </div>
          <ul className="space-y-2">
            {adjustments.map((a, i) => {
              const done = Boolean(state[i]);
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => toggleAdjustment(i)}
                    aria-pressed={done}
                    className={`flex w-full items-start gap-3 border p-3 text-left ${
                      done ? 'border-gold bg-black/40' : 'border-line bg-black/20'
                    }`}
                  >
                    <span
                      className={`mt-0.5 inline-block h-4 w-4 shrink-0 border ${
                        done ? 'border-gold bg-gold' : 'border-line'
                      }`}
                    />
                    <span
                      className={`font-display tracking-wider2 ${
                        done ? 'text-faint line-through' : 'text-ink'
                      }`}
                    >
                      {a}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
