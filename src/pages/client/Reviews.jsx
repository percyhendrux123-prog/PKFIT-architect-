import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { claude } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';
import { Empty } from '../../components/ui/Empty';
import { Badge } from '../../components/ui/Badge';
import { formatWeightDelta } from '../../lib/units';

function thisWeekStart() {
  const d = new Date();
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}

export default function Reviews() {
  const { user, profile } = useAuth();
  const units = profile?.units ?? 'imperial';
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const week = thisWeekStart();

  async function load() {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('client_id', user.id)
      .order('week_starting', { ascending: false })
      .limit(20);
    setRows(data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [user?.id]);

  const current = rows.find((r) => r.week_starting === week);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      await claude.weeklyReview({});
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Weekly Review</div>
          <h1 className="font-display text-4xl tracking-wider2">The Loop</h1>
          <p className="mt-2 max-w-reading text-sm text-mute">
            Every Monday. Diagnose the week. Install the adjustment. Close the loop.
          </p>
        </div>
        <Button onClick={generate} disabled={busy}>
          {busy ? 'Generating' : current ? 'Regenerate this week' : 'Generate this week'}
        </Button>
      </header>

      {err ? <div role="alert" className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}

      {loading ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-32 animate-pulse border border-line bg-black/40" />
          <div className="h-32 animate-pulse border border-line bg-black/40" />
        </div>
      ) : rows.length === 0 ? (
        <Empty
          title="No review installed"
          body="Log a check-in, then generate the week. The loop closes here."
          action={
            <Button onClick={generate} disabled={busy}>
              {busy ? 'Generating' : 'Generate this week'}
            </Button>
          }
        />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id}>
              <Link to={`/reviews/${r.id}`} className="block border border-line bg-black/30 p-5 hover:border-gold">
                <div className="flex items-center justify-between">
                  <div className="label">Week of {r.week_starting}</div>
                  <div className="flex flex-wrap gap-2">
                    {r.coach_comment ? <Badge tone="gold">Coach note</Badge> : null}
                    {(() => {
                      const total = (r.adjustments ?? []).length;
                      if (total === 0) return null;
                      const done = Object.values(r.adjustments_state ?? {}).filter(Boolean).length;
                      return (
                        <Badge tone={done === total ? 'green' : 'mute'}>
                          {done}/{total} installed
                        </Badge>
                      );
                    })()}
                    {r.metrics?.adherence_pct != null ? (
                      <Badge tone={r.metrics.adherence_pct >= 80 ? 'green' : 'mute'}>
                        {r.metrics.adherence_pct}% adherence
                      </Badge>
                    ) : null}
                    {r.metrics?.weight_delta_kg != null ? (
                      <Badge tone="mute">{formatWeightDelta(r.metrics.weight_delta_kg, units)}</Badge>
                    ) : null}
                  </div>
                </div>
                <p className="mt-3 text-sm text-ink/90">{r.summary}</p>
                {r.constraints?.length ? (
                  <div className="mt-3 text-xs uppercase tracking-widest2 text-faint">
                    Constraint: <span className="text-gold">{r.constraints[0]}</span>
                  </div>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
