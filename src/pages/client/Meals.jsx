import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Empty } from '../../components/ui/Empty';

export default function Meals() {
  const { user } = useAuth();
  const [meals, setMeals] = useState([]);
  const [loading, setLoading] = useState(true);

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
          title="No meals logged"
          body="Generate a plan to install the macro floor and meal scaffolding."
          action={<Button as={Link} to="/meals/generator">Generate</Button>}
        />
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([day, items]) => {
            const done = items.filter((m) => m.eaten).length;
            return (
              <section key={day}>
                <div className="mb-2 flex items-center justify-between">
                  <div className="label">{day}</div>
                  <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                    {done}/{items.length} eaten
                  </div>
                </div>
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
