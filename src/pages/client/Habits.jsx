import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { habitTemplates } from '../../lib/habitTemplates';
import { HabitHeatmap } from '../../components/HabitHeatmap';

const today = () => new Date().toISOString().slice(0, 10);

export default function Habits() {
  const { user } = useAuth();
  const [row, setRow] = useState(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    supabase
      .from('habits')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setRow(data?.[0] ?? null));
  }, [user?.id]);

  const list = row?.habit_list ?? [];
  const history = row?.check_history ?? {};
  const todayMap = history[today()] ?? {};

  async function save(nextList, nextHistory) {
    const payload = {
      client_id: user.id,
      habit_list: nextList ?? list,
      check_history: nextHistory ?? history,
    };
    setBusy(true);
    if (row) {
      const { data, error } = await supabase
        .from('habits')
        .update(payload)
        .eq('id', row.id)
        .select()
        .maybeSingle();
      if (!error) setRow(data);
    } else {
      const { data, error } = await supabase
        .from('habits')
        .insert(payload)
        .select()
        .maybeSingle();
      if (!error) setRow(data);
    }
    setBusy(false);
  }

  function addHabit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    const next = [...list, { id: crypto.randomUUID(), name: draft.trim() }];
    setDraft('');
    save(next);
  }

  function installStack(stack) {
    const existing = new Set(list.map((h) => h.name.toLowerCase()));
    const additions = stack.habits
      .filter((name) => !existing.has(name.toLowerCase()))
      .map((name) => ({ id: crypto.randomUUID(), name }));
    if (additions.length === 0) return;
    save([...list, ...additions]);
  }

  function toggle(habitId) {
    const nextDay = { ...todayMap, [habitId]: !todayMap[habitId] };
    const nextHistory = { ...history, [today()]: nextDay };
    save(undefined, nextHistory);
  }

  function removeHabit(habitId) {
    const next = list.filter((h) => h.id !== habitId);
    save(next);
  }

  const streak = useMemo(() => {
    if (!list.length) return 0;
    const dates = Object.keys(history).sort().reverse();
    let count = 0;
    for (const d of dates) {
      const allDone = list.every((h) => history[d]?.[h.id]);
      if (allDone) count += 1;
      else break;
    }
    return count;
  }, [list, history]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label mb-2">Habits</div>
          <h1 className="font-display text-4xl tracking-wider2">Daily levers</h1>
        </div>
        <div className="text-right">
          <div className="label">Streak</div>
          <div className="font-display text-5xl tracking-wider2 text-gold">{streak}</div>
        </div>
      </header>

      <form onSubmit={addHabit} className="flex gap-3">
        <Input label="Add a habit" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="10 000 steps" />
        <div className="self-end">
          <Button type="submit" disabled={busy || !draft.trim()}>Add</Button>
        </div>
      </form>

      {list.length === 0 ? (
        <div className="space-y-4">
          <div className="border border-line bg-black/20 p-6 text-sm text-mute">
            No habits yet. Keep it to three. Fewer levers, more output. Install a starter stack, or add your own above.
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {habitTemplates.map((t) => (
              <article key={t.id} className="flex flex-col border border-line bg-black/30 p-4">
                <div className="label">Stack</div>
                <h3 className="mt-1 font-display text-2xl tracking-wider2 text-gold">{t.title}</h3>
                <p className="mt-2 flex-1 text-sm text-mute">{t.summary}</p>
                <ul className="mt-3 space-y-1 text-xs text-faint">
                  {t.habits.map((h) => <li key={h}>— {h}</li>)}
                </ul>
                <Button className="mt-4" onClick={() => installStack(t)} disabled={busy}>
                  Install stack
                </Button>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <ul className="divide-y divide-line border border-line">
            {list.map((h) => {
              const done = Boolean(todayMap[h.id]);
              return (
                <li key={h.id} className="flex items-center justify-between p-4">
                  <button
                    onClick={() => toggle(h.id)}
                    className="flex flex-1 items-center gap-3 text-left"
                    aria-pressed={done}
                  >
                    <span className={`inline-block h-4 w-4 border ${done ? 'bg-gold border-gold' : 'border-line'}`} />
                    <span className={`font-display tracking-wider2 ${done ? 'text-gold' : 'text-ink'}`}>
                      {h.name}
                    </span>
                  </button>
                  <button
                    onClick={() => removeHabit(h.id)}
                    className="text-xs uppercase tracking-widest2 text-faint hover:text-red-300"
                  >
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>

          <HabitHeatmap list={list} history={history} />
        </div>
      )}
    </div>
  );
}
