import { useMemo, useState } from 'react';
import { MessageSquare, Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/Button';
import { Input, Textarea } from './ui/Input';

// Brief gold pulse on an input when its value lands on an integer.
// Used by the RPE inputs to give haptic-like feedback on integer snap.
function tickRpeFeedback(el) {
  if (!el) return;
  el.classList.remove('pkfit-rpe-tick');
  // Force reflow so re-adding restarts the animation.
  // eslint-disable-next-line no-unused-expressions
  el.offsetWidth;
  el.classList.add('pkfit-rpe-tick');
  setTimeout(() => el.classList.remove('pkfit-rpe-tick'), 230);
}
function maybeTickIfInteger(el, raw) {
  if (raw === '' || raw == null) return;
  const n = Number(raw);
  if (!Number.isFinite(n)) return;
  if (Math.abs(n - Math.round(n)) < 1e-9) tickRpeFeedback(el);
}

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
        note: '',
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

function todayLocalIso() {
  const now = new Date();
  const tz = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - tz).toISOString().slice(0, 16);
}

export function LogSessionForm({ program, onSubmit, onCancel }) {
  const [exercises, setExercises] = useState(() => draftFromProgram(program));
  const [performedAt, setPerformedAt] = useState(todayLocalIso());
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
          ? { ...ex, sets: [...ex.sets, { weight: '', reps: ex.prescribed?.reps ?? '', rpe: '', note: '', done: false }] }
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
      performed_at: performedAt ? new Date(performedAt).toISOString() : new Date().toISOString(),
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
          note: typeof s.note === 'string' && s.note.trim() ? s.note.trim() : null,
          done: Boolean(s.done),
        })),
      })),
    };
    await onSubmit(payload);
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Input
          label="Performed at"
          type="datetime-local"
          value={performedAt}
          onChange={(e) => setPerformedAt(e.target.value)}
        />
        <Input label="Duration (min)" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        <Input
          label={`Avg RPE${inferredRpe != null ? ` (auto ${inferredRpe})` : ''}`}
          type="number"
          step="0.5"
          min="0"
          max="10"
          value={rpe}
          onChange={(e) => {
            setRpe(e.target.value);
            maybeTickIfInteger(e.target, e.target.value);
          }}
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

            <div className="grid grid-cols-[32px_1fr_1fr_1fr_32px_32px] gap-2 text-[0.6rem] uppercase tracking-widest2 text-faint">
              <div></div>
              <div>Weight</div>
              <div>Reps</div>
              <div>RPE</div>
              <div></div>
              <div></div>
            </div>
            <ul className="space-y-2">
              {ex.sets.map((s, setIdx) => {
                const noteOpen = Boolean(s.note);
                return (
                  <li key={setIdx} className="space-y-1">
                    <div className="grid grid-cols-[32px_1fr_1fr_1fr_32px_32px] items-center gap-2">
                      <button
                        key={s.done ? `${exIdx}-${setIdx}-done` : `${exIdx}-${setIdx}-undone`}
                        type="button"
                        onClick={() => updateSet(exIdx, setIdx, { done: !s.done })}
                        aria-pressed={s.done}
                        aria-label={`Mark set ${setIdx + 1} ${s.done ? 'not done' : 'done'}`}
                        className={`h-6 w-6 border ${s.done ? 'bg-gold border-gold pkfit-check-pop' : 'border-line'}`}
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
                        onChange={(e) => {
                          updateSet(exIdx, setIdx, { rpe: e.target.value });
                          maybeTickIfInteger(e.target, e.target.value);
                        }}
                        placeholder="0-10"
                        className="border border-line bg-black/40 px-2 py-2 text-sm text-ink placeholder:text-faint"
                      />
                      <button
                        type="button"
                        onClick={() => updateSet(exIdx, setIdx, { note: noteOpen ? '' : ' ' })}
                        aria-label={noteOpen ? `Close note for set ${setIdx + 1}` : `Add note for set ${setIdx + 1}`}
                        className={noteOpen ? 'text-gold' : 'text-mute hover:text-gold'}
                      >
                        <MessageSquare size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeSet(exIdx, setIdx)}
                        aria-label={`Remove set ${setIdx + 1}`}
                        className="text-mute hover:text-signal"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    {noteOpen ? (
                      <input
                        type="text"
                        value={s.note}
                        onChange={(e) => updateSet(exIdx, setIdx, { note: e.target.value })}
                        placeholder="Note (form cue, wrist twinge, pace)"
                        className="ml-10 w-[calc(100%-2.5rem)] border border-line bg-black/40 px-2 py-1 text-xs text-ink placeholder:text-faint"
                        autoFocus
                      />
                    ) : null}
                  </li>
                );
              })}
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
