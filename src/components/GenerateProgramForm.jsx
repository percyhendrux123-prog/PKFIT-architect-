import { useState } from 'react';
import { claude } from '../lib/claudeClient';
import { Button } from './ui/Button';
import { Input, Select, Textarea } from './ui/Input';

const DEFAULTS = {
  goal: 'recomp',
  training_days: '4',
  experience: 'intermediate',
  equipment: 'full_gym',
  constraint: '',
};

export function GenerateProgramForm({ clientId, profile, onDone, onCancel }) {
  const [form, setForm] = useState(DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await claude.generateWorkout({ clientId, profile, ...form });
      onDone?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={run} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
          <option value="minimal">Minimal</option>
        </Select>
      </div>
      <Textarea label="Constraint" rows={2} value={form.constraint} onChange={set('constraint')} placeholder="Injury, schedule, preference" />
      {err ? <div className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Generating' : 'Generate program'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}

const MEAL_DEFAULTS = {
  goal: 'recomp',
  kcal_target: '2400',
  protein_g: '180',
  style: 'flexible',
  allergies: '',
  dislikes: '',
};

export function GenerateMealForm({ clientId, profile, onDone, onCancel }) {
  const [form, setForm] = useState(MEAL_DEFAULTS);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await claude.generateMealPlan({ clientId, profile, ...form });
      onDone?.();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={run} className="space-y-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select label="Goal" value={form.goal} onChange={set('goal')}>
          <option value="recomp">Recomposition</option>
          <option value="lean">Lean out</option>
          <option value="build">Build muscle</option>
          <option value="maintain">Maintain</option>
        </Select>
        <Select label="Style" value={form.style} onChange={set('style')}>
          <option value="flexible">Flexible</option>
          <option value="meat_heavy">Meat-forward</option>
          <option value="pescatarian">Pescatarian</option>
          <option value="vegetarian">Vegetarian</option>
        </Select>
        <Input label="Kcal target" type="number" value={form.kcal_target} onChange={set('kcal_target')} />
        <Input label="Protein floor (g)" type="number" value={form.protein_g} onChange={set('protein_g')} />
      </div>
      <Textarea label="Allergies" rows={2} value={form.allergies} onChange={set('allergies')} />
      <Textarea label="Dislikes" rows={2} value={form.dislikes} onChange={set('dislikes')} />
      {err ? <div className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={busy}>{busy ? 'Generating' : 'Generate meal plan'}</Button>
        <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  );
}
