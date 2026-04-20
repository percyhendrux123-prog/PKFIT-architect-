import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, Youtube } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Empty } from '../../components/ui/Empty';
import { LogSessionForm } from '../../components/LogSessionForm';

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

function ProgramCard({ program, sessionCount, onLog }) {
  const [open, setOpen] = useState(false);

  const exercises = Array.isArray(program.exercises) ? program.exercises : [];

  async function submit(payload) {
    await onLog(payload);
    setOpen(false);
  }

  return (
    <article className="border border-line bg-black/30">
      <header className="flex items-center justify-between gap-3 border-b border-line p-4">
        <div>
          <div className="label">Week {program.week_number}</div>
          <h3 className="mt-1 font-display text-2xl tracking-wider2">
            {program.schedule?.title ?? 'Program'}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {sessionCount > 0 ? (
            <span className="flex items-center gap-1 text-[0.65rem] uppercase tracking-widest2 text-gold">
              <CheckCircle2 size={12} /> {sessionCount} logged
            </span>
          ) : null}
          <Badge tone={program.status === 'active' ? 'green' : 'mute'}>{program.status}</Badge>
        </div>
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

      <footer className="flex flex-col gap-3 border-t border-line p-4">
        {open ? (
          <LogSessionForm program={program} onSubmit={submit} onCancel={() => setOpen(false)} />
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs text-faint">Created {new Date(program.created_at).toLocaleDateString()}</span>
            <Button onClick={() => setOpen(true)}>Log session</Button>
          </div>
        )}
      </footer>
    </article>
  );
}

export default function Workouts() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }
    const [{ data: prog }, { data: sess }] = await Promise.all([
      supabase
        .from('programs')
        .select('*')
        .eq('client_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('workout_sessions')
        .select('*')
        .eq('client_id', user.id)
        .order('performed_at', { ascending: false })
        .limit(30),
    ]);
    setPrograms(prog ?? []);
    setSessions(sess ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  async function logSession({ program, performed_at, duration_min, rpe_avg, notes, exercises }) {
    const row = {
      client_id: user.id,
      program_id: program.id,
      exercises: exercises ?? program.exercises ?? [],
      duration_min,
      rpe_avg,
      notes,
    };
    if (performed_at) row.performed_at = performed_at;
    await supabase.from('workout_sessions').insert(row);
    await load();
  }

  const sessionsByProgram = sessions.reduce((acc, s) => {
    if (!s.program_id) return acc;
    acc[s.program_id] = (acc[s.program_id] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Training</div>
          <h1 className="font-display text-4xl tracking-wider2">Workouts</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button as={Link} to="/workouts/history" variant="ghost">History</Button>
          <Button as={Link} to="/workouts/generator" variant="ghost">AI Generator</Button>
          <Button as={Link} to="/workouts/builder">Builder</Button>
        </div>
      </header>

      {loading ? (
        <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>
      ) : programs.length === 0 ? (
        <Empty
          title="No program written"
          body="The generator writes a clean week in one call. The builder is for when you want to tune by hand."
          action={<Button as={Link} to="/workouts/generator">Open the generator</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {programs.map((p) => (
            <ProgramCard
              key={p.id}
              program={p}
              sessionCount={sessionsByProgram[p.id] ?? 0}
              onLog={logSession}
            />
          ))}
        </div>
      )}

      {sessions.length > 0 ? (
        <section>
          <div className="label mb-2">Recent sessions</div>
          <ul className="divide-y divide-line border border-line">
            {sessions.slice(0, 10).map((s) => (
              <li key={s.id} className="grid grid-cols-1 gap-2 p-3 md:grid-cols-[160px_1fr_120px_120px]">
                <div className="label">{new Date(s.performed_at).toLocaleString()}</div>
                <div className="truncate text-sm text-mute">{s.notes || '—'}</div>
                <div className="text-xs text-faint">{s.duration_min ? `${s.duration_min} min` : ''}</div>
                <div className="text-xs text-faint">{s.rpe_avg != null ? `RPE ${s.rpe_avg}` : ''}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
