import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { claude } from '../../lib/claudeClient';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';

export default function MealGenerator() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    goal: 'recomp',
    kcal_target: '2400',
    protein_g: '180',
    style: 'flexible',
    allergies: '',
    dislikes: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [plan, setPlan] = useState(null);

  useEffect(() => {
    if (!profile) return;
    setForm((f) => ({
      ...f,
      kcal_target: profile.target_kcal != null ? String(profile.target_kcal) : f.kcal_target,
      protein_g: profile.target_protein_g != null ? String(profile.target_protein_g) : f.protein_g,
    }));
  }, [profile?.target_kcal, profile?.target_protein_g]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await claude.generateMealPlan({ clientId: user.id, profile, ...form });
      setPlan(res?.plan ?? res);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">AI Meal Plan</div>
        <h1 className="font-display text-4xl tracking-wider2">Meal plan generator</h1>
        <p className="mt-2 max-w-reading text-sm text-mute">A seven-day macro scaffold. You eat inside it.</p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
        <div>
          <Input label="Kcal target" type="number" value={form.kcal_target} onChange={set('kcal_target')} />
          {profile?.target_kcal != null ? (
            <div className="mt-1 text-[0.6rem] uppercase tracking-widest2 text-faint">
              Default from your macro floor. Change in Settings.
            </div>
          ) : null}
        </div>
        <div>
          <Input label="Protein floor (g)" type="number" value={form.protein_g} onChange={set('protein_g')} />
          {profile?.target_protein_g != null ? (
            <div className="mt-1 text-[0.6rem] uppercase tracking-widest2 text-faint">
              Default from your macro floor.
            </div>
          ) : null}
        </div>
        <Textarea label="Allergies" rows={2} value={form.allergies} onChange={set('allergies')} />
        <Textarea label="Dislikes" rows={2} value={form.dislikes} onChange={set('dislikes')} />
      </section>

      <div className="flex gap-3">
        <Button onClick={run} disabled={busy}>{busy ? 'Generating' : 'Generate plan'}</Button>
        <Button variant="ghost" onClick={() => navigate('/meals')}>Back</Button>
      </div>

      {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}

      {plan ? (
        <section className="border border-line bg-black/30 p-5">
          <div className="label mb-2">Generated plan</div>
          <h2 className="font-display text-2xl tracking-wider2">{plan.title ?? '7-day plan'}</h2>
          {(plan.days ?? []).map((d, i) => (
            <div key={i} className="mt-4">
              <div className="label">{d.day ?? `Day ${i + 1}`}</div>
              <ul className="mt-1 divide-y divide-line border border-line">
                {(d.meals ?? []).map((m, j) => (
                  <li key={j} className="flex items-center justify-between p-3 text-sm">
                    <span>{m.meal_type}: {m.items?.map((x) => x.name ?? x).join(', ')}</span>
                    <span className="text-faint">{m.macros?.kcal} kcal</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="mt-4">
            <Button onClick={() => navigate('/meals')}>Open meals</Button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
