import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, Youtube } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ExercisePicker } from '../../components/ExercisePicker';

function parseYouTubeId(input = '') {
  const m = input.match(/(?:youtu\.be\/|v=|\/embed\/)([A-Za-z0-9_-]{11})/);
  return m?.[1] ?? (input.length === 11 ? input : null);
}

export default function WorkoutBuilder() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [week, setWeek] = useState(1);
  const [exercises, setExercises] = useState([{ name: '', sets: 3, reps: 8, load: 'RPE 8', youtube: '', cues: '' }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  function update(i, key, value) {
    setExercises((list) => list.map((e, idx) => (idx === i ? { ...e, [key]: value } : e)));
  }
  function add() {
    setExercises((list) => [...list, { name: '', sets: 3, reps: 8, load: '', youtube: '', cues: '' }]);
  }

  function pickExercise(i, picked) {
    setExercises((list) =>
      list.map((e, idx) =>
        idx === i
          ? {
              ...e,
              name: picked.name,
              youtube: e.youtube || picked.youtube_id || '',
              cues: e.cues || picked.cues || '',
            }
          : e,
      ),
    );
  }
  function remove(i) {
    setExercises((list) => list.filter((_, idx) => idx !== i));
  }

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      // Archive prior active programs so one program is active at a time.
      await supabase
        .from('programs')
        .update({ status: 'archived' })
        .eq('client_id', user.id)
        .eq('status', 'active');

      const { error } = await supabase.from('programs').insert({
        client_id: user.id,
        week_number: Number(week) || 1,
        schedule: { title },
        exercises,
        status: 'active',
      });
      if (error) throw error;
      navigate('/workouts');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Builder</div>
        <h1 className="font-display text-4xl tracking-wider2">Build a program</h1>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[2fr_1fr]">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Upper/Lower — Week 1" />
        <Input label="Week number" type="number" value={week} onChange={(e) => setWeek(e.target.value)} />
      </div>

      <div className="space-y-4">
        {exercises.map((ex, i) => {
          const id = parseYouTubeId(ex.youtube);
          return (
            <div key={i} className="border border-line bg-black/30 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[2fr_repeat(3,1fr)_auto]">
                <div>
                  <div className="label mb-2">Exercise</div>
                  <ExercisePicker
                    value={ex.name}
                    onPick={(p) => pickExercise(i, p)}
                    placeholder="Start typing — back squat, deadlift..."
                  />
                </div>
                <Input label="Sets" type="number" value={ex.sets} onChange={(e) => update(i, 'sets', e.target.value)} />
                <Input label="Reps" value={ex.reps} onChange={(e) => update(i, 'reps', e.target.value)} />
                <Input label="Load" value={ex.load} onChange={(e) => update(i, 'load', e.target.value)} placeholder="RPE 8 / 70%" />
                <button className="self-end p-3 text-mute hover:text-red-300" onClick={() => remove(i)} aria-label="Remove">
                  <Trash2 size={16} />
                </button>
              </div>
              {ex.cues ? (
                <div className="mt-3 border-l-2 border-gold pl-3 text-xs text-mute">{ex.cues}</div>
              ) : null}
              <div className="mt-3">
                <Input
                  label="YouTube demo (URL or ID)"
                  value={ex.youtube}
                  onChange={(e) => update(i, 'youtube', e.target.value)}
                  placeholder="https://youtu.be/..."
                />
              </div>
              {id ? (
                <div className="mt-3 aspect-video max-w-xl border border-line">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${id}`}
                    title={`${ex.name || 'Exercise'} demo`}
                    className="h-full w-full"
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              ) : ex.youtube ? (
                <div className="mt-2 flex items-center gap-2 text-xs text-faint">
                  <Youtube size={14} /> Paste a full YouTube URL or an 11-character video ID.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <Button onClick={add} variant="ghost"><Plus size={14} /> Add exercise</Button>

      {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}

      <div className="flex gap-3">
        <Button onClick={save} disabled={busy || !title}>{busy ? 'Saving' : 'Save program'}</Button>
        <Button variant="ghost" onClick={() => navigate('/workouts')}>Cancel</Button>
      </div>
    </div>
  );
}
