import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Empty } from '../../components/ui/Empty';

function totals(items) {
  const planned = { kcal: 0, p: 0, c: 0, f: 0 };
  const eaten = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const m of items) {
    const macros = m.macros ?? {};
    for (const k of Object.keys(planned)) {
      const v = Number(macros[k] ?? 0);
      if (!Number.isNaN(v)) {
        planned[k] += v;
        if (m.eaten) eaten[k] += v;
      }
    }
  }
  return { planned, eaten };
}

function MacroBar({ label, planned, eaten, floor }) {
  const pct = planned > 0 ? Math.min(100, Math.round((eaten / planned) * 100)) : 0;
  const plannedBelowFloor = floor != null && planned > 0 && planned < floor;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[0.6rem] uppercase tracking-widest2 text-faint">
        <span>{label}</span>
        <span>
          <span className="text-ink">{eaten}</span> / {planned}
          {floor != null ? <span className="text-faint"> · floor {floor}</span> : null}
        </span>
      </div>
      <div className="mt-1 h-1 w-full bg-line">
        <div className="h-1 bg-gold" style={{ width: `${pct}%` }} />
      </div>
      {plannedBelowFloor ? (
        <div className="mt-1 text-[0.55rem] uppercase tracking-widest2 text-red-300">
          Below floor
        </div>
      ) : null}
    </div>
  );
}

export default function Meals() {
  const { user, profile } = useAuth();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);

  const floor = useMemo(
    () => ({
      kcal: profile?.target_kcal ?? null,
      p: profile?.target_protein_g ?? null,
      c: profile?.target_carbs_g ?? null,
      f: profile?.target_fat_g ?? null,
    }),
    [profile],
  );

  const load = useCallback(async () => {
    if (!isSupabaseConfigured || !user) {
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('meals')
      .select('*')
      .eq('client_id', user.id)
      .order('date', { ascending: false });
    setMeals(data ?? []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);

  async function toggleEaten(meal) {
    const next = !meal.eaten;
    setMeals((list) => list.map((m) => (m.id === meal.id ? { ...m, eaten: next } : m)));
    await supabase
      .from('meals')
      .update({ eaten: next, eaten_at: next ? new Date().toISOString() : null })
      .eq('id', meal.id);
  }

  const grouped = meals.reduce((acc, m) => {
    const key = m.date ?? m.day ?? '—';
    acc[key] = acc[key] ?? [];
    acc[key].push(m);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Nutrition</div>
          <h1 className="font-display text-4xl tracking-wider2">Meal plan</h1>
        </div>
        <Button as={Link} to="/meals/generator">AI Meal plan</Button>
      </header>

      {loading ? (
        <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>
      ) : meals.length === 0 ? (
        <Empty
          title="No plan installed"
          body="Generate a seven-day scaffold. Macro floor, meal templates, grocery surface."
          action={<Button as={Link} to="/meals/generator">Generate the plan</Button>}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, items]) => {
            const done = items.filter((m) => m.eaten).length;
            const { planned, eaten } = totals(items);
            const anyMacros = planned.kcal > 0 || planned.p > 0;
            return (
              <section key={day}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="label">{day}</div>
                  <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                    {done}/{items.length} eaten
                  </div>
                </div>
                {anyMacros ? (
                  <div className="mb-3 grid grid-cols-2 gap-3 border border-line bg-black/30 p-3 md:grid-cols-4">
                    <MacroBar label="Kcal" planned={planned.kcal} eaten={eaten.kcal} floor={floor.kcal} />
                    <MacroBar label="Protein" planned={planned.p} eaten={eaten.p} floor={floor.p} />
                    <MacroBar label="Carbs" planned={planned.c} eaten={eaten.c} floor={floor.c} />
                    <MacroBar label="Fat" planned={planned.f} eaten={eaten.f} floor={floor.f} />
                  </div>
                ) : null}
                <ul className="divide-y divide-line border border-line">
                  {items.map((m) => (
                    <li
                      key={m.id}
                      className="grid grid-cols-1 gap-2 p-4 md:grid-cols-[32px_140px_1fr_140px] md:items-center"
                    >
                      <button
                        type="button"
                        onClick={() => toggleEaten(m)}
                        aria-pressed={Boolean(m.eaten)}
                        aria-label={m.eaten ? 'Mark as not eaten' : 'Mark as eaten'}
                        className={`h-6 w-6 border ${m.eaten ? 'bg-gold border-gold' : 'border-line'}`}
                      />
                      <div className="font-display tracking-wider2 text-gold">{m.meal_type ?? 'Meal'}</div>
                      <div className="text-sm">
                        {(m.items ?? []).map((it, i) => (
                          <div key={i} className={m.eaten ? 'text-faint line-through' : 'text-mute'}>
                            {typeof it === 'string' ? it : `${it.qty ?? ''} ${it.name ?? ''}`.trim()}
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-faint">
                        {m.macros?.kcal ? `${m.macros.kcal} kcal` : ''}{' '}
                        {m.macros?.p ? ` · P ${m.macros.p}` : ''}
                        {m.macros?.c ? ` · C ${m.macros.c}` : ''}
                        {m.macros?.f ? ` · F ${m.macros.f}` : ''}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
