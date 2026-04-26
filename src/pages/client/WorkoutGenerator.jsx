import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claude } from '../../lib/claudeClient';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Select, Textarea } from '../../components/ui/Input';

export default function WorkoutGenerator() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    goal: profile?.plan ? 'recomp' : 'recomp',
    training_days: '4',
    experience: 'intermediate',
    equipment: 'full_gym',
    constraint: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [result, setResult] = useState(null);
  const [elapsed, setElapsed] = useState(0);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    setElapsed(0);
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    try {
      const res = await claude.generateWorkout({ clientId: user.id, profile, ...form });
      const program = res?.program ?? res;
      if (!program?.exercises?.length) {
        setErr('The program came back empty. Adjust constraints and run again.');
        return;
      }
      setResult(program);
    } catch (e) {
      setErr(e.message);
    } finally {
      clearInterval(tick);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">AI Generator</div>
        <h1 className="font-display text-4xl tracking-wider2">Program generator</h1>
        <p className="mt-2 max-w-reading text-sm text-mute">
          The system writes the week. Mechanism over motivation. No filler.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select label="Goal" value={form.goal} onChange={set('goal')}>
          <option value="recomp">Recomposition</option>
          <option value="lean">Lean out</option>
          <option value="build">Build muscle</option>
          <option value="maintain">Maintain</option>
        </Select>
        <Select label="Training days" value={form.training_days} onChange={set('training_days')}>
          {[3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
        </Select>
        <Select label="Experience" value={form.experience} onChange={set('experience')}>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </Select>
        <Select label="Equipment" value={form.equipment} onChange={set('equipment')}>
          <option value="full_gym">Full gym</option>
          <option value="home_gym">Home gym</option>
          <option value="minimal">Minimal (bands, bodyweight)</option>
        </Select>
        <div className="md:col-span-2">
          <Textarea label="Constraint (injury, schedule, preference)" value={form.constraint} onChange={set('constraint')} rows={3} />
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={run} disabled={busy}>
          {busy ? `Generating… ${elapsed}s` : 'Generate'}
        </Button>
        <Button variant="ghost" onClick={() => navigate('/workouts')}>Back to workouts</Button>
        {busy ? (
          <span aria-live="polite" className="text-[0.65rem] uppercase tracking-widest2 text-faint">
            This usually takes 10–25 seconds.
          </span>
        ) : null}
      </div>

      {err ? <div role="alert" className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}

      {result ? (
        <section className="border border-line bg-black/30 p-5">
          <div className="flex items-center justify-between">
            <div className="label">Saved to your programs</div>
            <span className="text-[0.65rem] uppercase tracking-widest2 text-success">Active</span>
          </div>
          <h2 className="mt-1 font-display text-2xl tracking-wider2">{result.title ?? `Week ${result.week_number ?? 1}`}</h2>
          <ul className="mt-3 divide-y divide-line">
            {(result.exercises ?? []).map((e, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span>{e.name}</span>
                <span className="text-faint">{e.sets}×{e.reps} @ {e.load ?? 'RPE'}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => navigate('/workouts')}>View all</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
