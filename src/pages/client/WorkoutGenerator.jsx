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

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await claude.generateWorkout({ clientId: user.id, profile, ...form });
      setResult(res?.program ?? res);
    } catch (e) {
      setErr(e.message);
    } finally {
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

      <div className="flex items-center gap-3">
        <Button onClick={run} disabled={busy}>{busy ? 'Generating' : 'Generate'}</Button>
        <Button variant="ghost" onClick={() => navigate('/workouts')}>Back to workouts</Button>
      </div>

      {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}

      {result ? (
        <section className="border border-line bg-black/30 p-5">
          <div className="label mb-2">Generated program</div>
          <h2 className="font-display text-2xl tracking-wider2">{result.title ?? `Week ${result.week_number ?? 1}`}</h2>
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
