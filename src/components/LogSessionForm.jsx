import { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';

// Build an initial draft from the program prescription. One row per prescribed
// set, weight blank, reps prefilled from prescription, rpe blank.
function draftFromProgram(program) {
  const exercises = Array.isArray(program.exercises) ? program.exercises : [];
  return exercises.map((ex) => {
    const prescribedSets = Math.max(1, Number(ex.sets) || 1);
    const repsGuess = typeof ex.reps === 'string' ? ex.reps : String(ex.reps ?? '');
    return {
      name: ex.name ?? '—',
      prescribed: { sets: ex.sets, reps: ex.reps, load: ex.load, cues: ex.cues ?? ex.notes ?? '' },
      sets: Array.from({ length: prescribedSets }).map(() => ({
        weight: '',
        reps: repsGuess,
        rpe: '',
        done: false,
      })),
    };
  });
}

function averageRpe(exercises) {
  const values = [];
  for (const ex of exercises) {
    for (const s of ex.sets) {
      if (s.done && s.rpe !== '' && !Number.isNaN(Number(s.rpe))) values.push(Number(s.rpe));
    }
  }
  if (!values.length) return null;
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function LogSessionForm({ program, onSubmit, onCancel }) {
  const [exercises, setExercises] = useState(() => draftFromProgram(program));
  const [duration, setDuration] = useState('');
  const [rpe, setRpe] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  function updateSet(exIdx, setIdx, patch) {
    setExercises((list) =>
      list.map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: ex.sets.map((s, j) => (j === setIdx ? { ...s, ...patch } : s)) }
          : ex,
      ),
    );
  }

  function addSet(exIdx) {
    setExercises((list) =>
      list.map((ex, i) =>
        i === exIdx
          ? { ...ex, sets: [...ex.sets, { weight: '', reps: ex.prescribed?.reps ?? '', rpe: '', done: false }] }
          : ex,
      ),
    );
  }

  function removeSet(exIdx, setIdx) {
    setExercises((list) =>
      list.map((ex, i) =>
        i === exIdx ? { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) } : ex,
      ),
    );
  }

  function markAll(exIdx, done) {
    setExercises((list) =>
      list.map((ex, i) =>
        i === exIdx ? { ...ex, sets: ex.sets.map((s) => ({ ...s, done })) } : ex,
      ),
    );
  }

  const inferredRpe = useMemo(() => averageRpe(exercises), [exercises]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const payload = {
      program,
      duration_min: duration ? Number(duration) : null,
      rpe_avg: rpe !== '' ? Number(rpe) : inferredRpe,
      notes: notes.trim() || null,
      exercises: exercises.map((ex) => ({
        name: ex.name,
        prescribed: ex.prescribed,
        sets: ex.sets.map((s) => ({
          weight: s.weight !== '' ? Number(s.weight) : null,
          reps: s.reps !== '' ? Number(s.reps) : null,
          rpe: s.rpe !== '' ? Number(s.rpe) : null,
          done: Boolean(s.done),
        })),
      })),
    };
    await onSubmit(payload);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <Input label="Duration (min)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <Input
          label={`Avg RPE${inferredRpe != null ? ` (auto ${inferredRpe})` : ''}`}
          type="number"
          step="0.5"
          min="0"
          max="10"
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          placeholder={inferredRpe != null ? String(inferredRpe) : ''}
        />
      </div>

      <div className="space-y-4">
        {exercises.map((ex, exIdx) => (
          <section key={exIdx} className="border border-line bg-black/40 p-3">
            <header className="mb-2 flex items-center justify-between gap-3">
              <div>
                <div className="font-display tracking-wider2">{ex.name}</div>
                <div className="text-[0.65rem] uppercase tracking-widest2 text-faint">
                  prescribed · {ex.prescribed?.sets ?? '—'}×{ex.prescribed?.reps ?? '—'}
                  {ex.prescribed?.load ? ` @ ${ex.prescribed.load}` : ''}
                </div>
              </div>
              <div className="flex gap-2 text-[0.65rem] uppercase tracking-widest2">
                <button type="button" onClick={() => markAll(exIdx, true)} className="text-gold">All done</button>
                <button type="button" onClick={() => markAll(exIdx, false)} className="text-mute">Clear</button>
              </div>
            </header>

            <div className="grid grid-cols-[32px_1fr_1fr_1fr_32px] gap-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
              <div></div>
              <div>Weight</div>
              <div>Reps</div>
              <div>RPE</div>
              <div></div>
            </div>
            <ul className="space-y-2">
              {ex.sets.map((s, setIdx) => (
                <li key={setIdx} className="grid grid-cols-[32px_1fr_1fr_1fr_32px] items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateSet(exIdx, setIdx, { done: !s.done })}
                    aria-pressed={s.done}
                    aria-label={`Mark set ${setIdx + 1} ${s.done ? 'not done' : 'done'}`}
                    className={`h-6 w-6 border ${s.done ? 'bg-gold border-gold' : 'border-line'}`}
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    value={s.weight}
                    onChange={(e) => updateSet(exIdx, setIdx, { weight: e.target.value })}
                    placeholder="kg"
                    className="border border-line bg-black/40 px-2 py-2 text-sm text-ink placeholder:text-faint"
                  />
                  <input
                    type="text"
                    value={s.reps}
                    onChange={(e) => updateSet(exIdx, setIdx, { reps: e.target.value })}
                    placeholder="reps"
                    className="border border-line bg-black/40 px-2 py-2 text-sm text-ink placeholder:text-faint"
                  />
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    max="10"
                    value={s.rpe}
                    onChange={(e) => updateSet(exIdx, setIdx, { rpe: e.target.value })}
                    placeholder="0-10"
                    className="border border-line bg-black/40 px-2 py-2 text-sm text-ink placeholder:text-faint"
                  />
                  <button
                    type="button"
                    onClick={() => removeSet(exIdx, setIdx)}
                    aria-label={`Remove set ${setIdx + 1}`}
                    className="text-mute hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addSet(exIdx)}
              className="mt-2 flex items-center gap-1 text-xs uppercase tracking-widest2 text-gold"
            >
              <Plus size={12} /> Add set
            </button>
          </section>
        ))}
      </div>

      <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What moved, what did not" />

      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Logging' : 'Save session'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
