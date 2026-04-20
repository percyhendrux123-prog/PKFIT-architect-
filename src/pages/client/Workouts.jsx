import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Youtube } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Empty } from '../../components/ui/Empty';

function parseYouTubeId(input = '') {
  if (!input) return null;
  const m = input.match(/(?:youtu\.be\/|v=|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? (input.length === 11 ? input : null);
}

function ExerciseRow({ ex }) {
  const [open, setOpen] = useState(false);
  const videoId = parseYouTubeId(ex.youtube);
  const note = ex.cues || ex.notes;

  return (
    <li className="border-b border-line last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm hover:bg-black/30"
        aria-expanded={open}
      >
        <span className="font-display tracking-wider2">{ex.name ?? ex.title ?? '—'}</span>
        <span className="flex items-center gap-3 text-xs text-faint">
          {videoId ? <Youtube size={14} className="text-gold" aria-label="Has demo video" /> : null}
          {ex.sets ? `${ex.sets}×${ex.reps ?? '—'}` : ''}
          {ex.load ? ` @ ${ex.load}` : ''}
        </span>
      </button>
      {open ? (
        <div className="space-y-3 px-4 pb-4">
          {note ? (
            <div className="border-l-2 border-gold pl-3 text-sm text-mute">{note}</div>
          ) : null}
          {videoId ? (
            <div className="aspect-video max-w-xl border border-line">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={`${ex.name} demo`}
                className="h-full w-full"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
          ) : null}
          {!note && !videoId ? (
            <div className="text-xs text-faint">No notes or demo for this exercise.</div>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

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
          {programs.map((p) => {
            const exercises = Array.isArray(p.exercises) ? p.exercises : [];
            return (
              <article key={p.id} className="border border-line bg-black/30">
                <header className="flex items-center justify-between border-b border-line p-4">
                  <div>
                    <div className="label">Week {p.week_number}</div>
                    <h3 className="mt-1 font-display text-2xl tracking-wider2">
                      {p.schedule?.title ?? 'Program'}
                    </h3>
                  </div>
                  <Badge tone={p.status === 'active' ? 'green' : 'mute'}>{p.status}</Badge>
                </header>
                {exercises.length === 0 ? (
                  <div className="p-4 text-xs text-faint">No exercises on this program.</div>
                ) : (
                  <ul>
                    {exercises.map((e, i) => (
                      <ExerciseRow key={i} ex={e} />
                    ))}
                  </ul>
                )}
                <footer className="border-t border-line p-3 text-xs text-faint">
                  Created {new Date(p.created_at).toLocaleDateString()}
                </footer>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
