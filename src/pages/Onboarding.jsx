import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';

const steps = ['Identity', 'Baseline', 'Goal', 'Commit'];

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    name: '',
    age: '',
    sex: 'male',
    height_cm: '',
    weight_kg: '',
    goal: 'recomp',
    training_days: '4',
    sleep_avg: '7',
    constraint: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function finish() {
    if (!user) {
      navigate('/signup');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: form.name,
          start_date: new Date().toISOString().slice(0, 10),
          loop_stage: 'diagnosis',
          plan: 'trial',
        })
        .eq('id', user.id);
      if (error) throw error;
      navigate('/dashboard', { replace: true });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl px-5 py-16">
      <div className="label mb-3">Onboarding · Step {step + 1} of {steps.length}</div>
      <h1 className="font-display text-4xl tracking-wider2 text-gold">{steps[step]}</h1>

      <div className="mt-10 space-y-4">
        {step === 0 && (
          <>
            <Input label="Name" value={form.name} onChange={set('name')} />
            <Input label="Age" type="number" value={form.age} onChange={set('age')} />
            <Select label="Sex" value={form.sex} onChange={set('sex')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </>
        )}
        {step === 1 && (
          <>
            <Input label="Height (cm)" type="number" value={form.height_cm} onChange={set('height_cm')} />
            <Input label="Weight (kg)" type="number" value={form.weight_kg} onChange={set('weight_kg')} />
            <Input label="Average sleep (hours)" type="number" value={form.sleep_avg} onChange={set('sleep_avg')} />
          </>
        )}
        {step === 2 && (
          <>
            <Select label="Primary goal" value={form.goal} onChange={set('goal')}>
              <option value="recomp">Body recomposition</option>
              <option value="lean">Lean out</option>
              <option value="build">Build muscle</option>
              <option value="maintain">Maintain</option>
            </Select>
            <Select label="Training days per week" value={form.training_days} onChange={set('training_days')}>
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </Select>
          </>
        )}
        {step === 3 && (
          <>
            <Input label="The one constraint in your way" value={form.constraint} onChange={set('constraint')} />
            <div className="border border-line p-4 text-sm text-mute">
              You are entering a thirty-day protocol. Daily reps. Weekly review. No drift.
            </div>
            {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}
          </>
        )}
      </div>

      <div className="mt-8 flex justify-between">
        <Button variant="ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        {step < steps.length - 1 ? (
          <Button onClick={() => setStep(step + 1)}>Next</Button>
        ) : (
          <Button disabled={busy} onClick={finish}>{busy ? 'Saving' : 'Enter'}</Button>
        )}
      </div>
    </div>
  );
}
