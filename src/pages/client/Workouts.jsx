import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Empty } from '../../components/ui/Empty';

export default function Workouts() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }
    supabase
      .from('programs')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPrograms(data ?? []);
        setLoading(false);
      });
  }, [user?.id]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Training</div>
          <h1 className="font-display text-4xl tracking-wider2">Workouts</h1>
        </div>
        <div className="flex gap-2">
          <Button as={Link} to="/workouts/generator" variant="ghost">AI Generator</Button>
          <Button as={Link} to="/workouts/builder">Builder</Button>
        </div>
      </header>

      {loading ? (
        <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>
      ) : programs.length === 0 ? (
        <Empty
          title="No programs"
          body="Use the generator to produce a week, or the builder to craft one by hand."
          action={<Button as={Link} to="/workouts/generator">Open generator</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {programs.map((p) => (
            <article key={p.id} className="border border-line bg-black/30 p-5">
              <div className="flex items-center justify-between">
                <div className="label">Week {p.week_number}</div>
                <Badge tone={p.status === 'active' ? 'green' : 'mute'}>{p.status}</Badge>
              </div>
              <h3 className="mt-2 font-display text-2xl tracking-wider2">
                {p.schedule?.title ?? 'Program'}
              </h3>
              <ul className="mt-3 space-y-1 text-sm text-mute">
                {(p.exercises ?? []).slice(0, 6).map((e, i) => (
                  <li key={i} className="flex items-center justify-between">
                    <span>{e.name ?? e.title ?? '—'}</span>
                    <span className="text-faint">{e.sets ? `${e.sets}×${e.reps ?? '—'}` : ''}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 text-xs text-faint">
                Created {new Date(p.created_at).toLocaleDateString()}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
