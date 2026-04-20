import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, UtensilsCrossed, Target, CalendarDays, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { deriveLoopStage, LOOP_STAGES, loopProgress, loopStageMeta } from '../../lib/loop';
import { habitStreak, sessionStreak } from '../../lib/streaks';

const cards = [
  { to: '/workouts', label: 'Training', icon: Dumbbell, copy: "Today's program. Three lifts. No filler." },
  { to: '/meals', label: 'Nutrition', icon: UtensilsCrossed, copy: "Macro floor. Meal scaffolding." },
  { to: '/habits', label: 'Habits', icon: Target, copy: "The few daily levers." },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, copy: "Thirty-day arc." },
  { to: '/assistant', label: 'Assistant', icon: Sparkles, copy: "Ask the Architect." },
];

function FloorBar({ label, eaten, floor }) {
  const pct = floor > 0 ? Math.min(100, Math.round((eaten / floor) * 100)) : 0;
  const short = eaten < floor;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[0.6rem] uppercase tracking-widest2 text-faint">
        <span>{label}</span>
        <span>
          <span className={short ? 'text-red-300' : 'text-ink'}>{eaten}</span> / {floor}
        </span>
      </div>
      <div className="mt-1 h-1 w-full bg-line">
        <div className="h-1 bg-gold" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [recent, setRecent] = useState([]);
  const [checkIn, setCheckIn] = useState(null);
  const [todayMeals, setTodayMeals] = useState([]);
  const [habitRow, setHabitRow] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeProgram, setActiveProgram] = useState(null);

  const [reviewThisWeek, setReviewThisWeek] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    const today = new Date().toISOString().slice(0, 10);
    const sinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const weekStart = (() => {
      const d = new Date();
      const day = d.getUTCDay();
      const diff = (day + 6) % 7; // Monday start
      d.setUTCDate(d.getUTCDate() - diff);
      return d.toISOString().slice(0, 10);
    })();
    supabase
      .from('check_ins')
      .select('*')
      .eq('client_id', user.id)
      .order('date', { ascending: false })
      .limit(1)
      .then(({ data }) => setCheckIn(data?.[0] ?? null));
    supabase
      .from('programs')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => setRecent(data ?? []));
    supabase
      .from('programs')
      .select('*')
      .eq('client_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setActiveProgram(data ?? null));
    supabase
      .from('meals')
      .select('*')
      .eq('client_id', user.id)
      .eq('date', today)
      .order('meal_type')
      .then(({ data }) => setTodayMeals(data ?? []));
    supabase
      .from('habits')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setHabitRow(data ?? null));
    supabase
      .from('workout_sessions')
      .select('performed_at')
      .eq('client_id', user.id)
      .gte('performed_at', sinceIso)
      .order('performed_at', { ascending: false })
      .then(({ data }) => setSessions(data ?? []));
    supabase
      .from('reviews')
      .select('id,week_starting')
      .eq('client_id', user.id)
      .eq('week_starting', weekStart)
      .maybeSingle()
      .then(({ data }) => setReviewThisWeek(data ?? null));
  }, [user?.id]);

  const hStreak = habitStreak(habitRow);
  const sStreak = sessionStreak(sessions);

  async function toggleMealEaten(meal) {
    const next = !meal.eaten;
    setTodayMeals((list) =>
      list.map((m) => (m.id === meal.id ? { ...m, eaten: next } : m)),
    );
    await supabase
      .from('meals')
      .update({ eaten: next, eaten_at: next ? new Date().toISOString() : null })
      .eq('id', meal.id);
  }

  const loop = deriveLoopStage(profile);
  const loopMeta = loopStageMeta(loop);
  const progress = loopProgress(profile);

  return (
    <div className="space-y-8">
      <section>
        <div className="label mb-2">Today</div>
        <h1 className="font-display text-[clamp(2rem,5vw,3rem)] tracking-wider2 text-ink">
          {profile?.name ? `Hello, ${profile.name}.` : 'Welcome back.'}
        </h1>
        <p className="mt-2 max-w-reading text-sm text-mute">
          You are in the <span className="text-gold">{loop}</span> stage of the loop. One move at a time.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader label="Last check-in" title={checkIn?.date ?? '—'} />
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="label">Weight</div>
              <div className="mt-1 font-display text-2xl tracking-wider2">{checkIn?.weight ?? '—'}</div>
            </div>
            <div>
              <div className="label">Body fat</div>
              <div className="mt-1 font-display text-2xl tracking-wider2">{checkIn?.body_fat ?? '—'}</div>
            </div>
          </div>
        </Card>
        <Card>
          <CardHeader label="Plan" title={profile?.plan ?? 'Trial'} />
          <p className="text-sm text-mute">Billing and plan changes in the billing tab.</p>
          <Link to="/billing" className="mt-4 inline-block text-xs uppercase tracking-widest2 text-gold">Manage →</Link>
        </Card>
        <Card>
          <CardHeader label="Loop stage" title={loopMeta.label} meta={`${Math.round(progress * 100)}%`} />
          <p className="text-sm text-mute">{loopMeta.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {LOOP_STAGES.map((s) => (
              <Badge key={s.key} tone={loop === s.key ? 'gold' : 'mute'}>{s.label}</Badge>
            ))}
          </div>
          <div className="mt-3 h-1 w-full bg-line">
            <div className="h-1 bg-gold transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
        </Card>
      </section>

      <section className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader label="Habit streak" title={`${hStreak}d`} />
          <p className="text-xs text-faint">Consecutive days with the full stack checked.</p>
        </Card>
        <Card>
          <CardHeader label="Session streak" title={`${sStreak}d`} />
          <p className="text-xs text-faint">Consecutive days with at least one logged session.</p>
        </Card>
        <Card>
          <CardHeader label="Sessions · 30d" title={String(sessions.filter((s) => (Date.now() - new Date(s.performed_at).getTime()) / 86400000 <= 30).length)} />
          <p className="text-xs text-faint">Workouts logged in the last thirty days.</p>
        </Card>
        <Card>
          <CardHeader label="Habits" title={String(habitRow?.habit_list?.length ?? 0)} />
          <p className="text-xs text-faint">Active levers on your daily stack.</p>
        </Card>
      </section>

      <section>
        <div className="label mb-3">Open a surface</div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {cards.map((c) => (
            <Link
              key={c.to}
              to={c.to}
              className="group flex flex-col border border-line bg-black/30 p-4 hover:border-gold"
            >
              <c.icon size={18} className="text-gold" />
              <div className="mt-3 font-display tracking-wider2">{c.label}</div>
              <div className="mt-1 text-xs text-faint">{c.copy}</div>
            </Link>
          ))}
        </div>
      </section>

      {activeProgram ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="label">Active program</div>
            <Link to="/workouts" className="text-xs uppercase tracking-widest2 text-gold">Open →</Link>
          </div>
          <article className="border border-line bg-black/30 p-5">
            <header className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-2xl tracking-wider2">
                  {activeProgram.schedule?.title ?? `Week ${activeProgram.week_number}`}
                </h3>
                <p className="mt-1 text-xs text-faint">
                  {(Array.isArray(activeProgram.exercises) ? activeProgram.exercises : []).length}{' '}
                  exercises · Week {activeProgram.week_number}
                </p>
              </div>
              <Link
                to="/workouts"
                className="border border-gold bg-gold px-4 py-2 font-display text-xs tracking-wider2 text-bg hover:bg-[#d8b658]"
              >
                Log session
              </Link>
            </header>
            <ul className="mt-4 grid grid-cols-1 gap-1 text-sm md:grid-cols-2">
              {(Array.isArray(activeProgram.exercises) ? activeProgram.exercises : [])
                .slice(0, 6)
                .map((ex, i) => (
                  <li key={i} className="flex items-center justify-between border-b border-line/60 py-1">
                    <span>{ex.name ?? '—'}</span>
                    <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                      {ex.sets ? `${ex.sets}×${ex.reps ?? '—'}` : ''}
                      {ex.load ? ` @ ${ex.load}` : ''}
                    </span>
                  </li>
                ))}
            </ul>
          </article>
        </section>
      ) : null}

      {todayMeals.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="label">Today&apos;s meals</div>
            <Link to="/meals" className="text-xs uppercase tracking-widest2 text-gold">Full plan →</Link>
          </div>
          {(() => {
            const eaten = todayMeals.filter((m) => m.eaten);
            const eatenMacros = eaten.reduce(
              (a, m) => {
                const mac = m.macros ?? {};
                return {
                  kcal: a.kcal + Number(mac.kcal ?? 0),
                  p: a.p + Number(mac.p ?? 0),
                };
              },
              { kcal: 0, p: 0 },
            );
            const kcalTarget = profile?.target_kcal;
            const pTarget = profile?.target_protein_g;
            if (!kcalTarget && !pTarget) return null;
            return (
              <div className="mb-3 grid grid-cols-1 gap-3 border border-line bg-black/30 p-3 sm:grid-cols-2">
                {kcalTarget ? (
                  <FloorBar label="Kcal" eaten={Math.round(eatenMacros.kcal)} floor={kcalTarget} />
                ) : null}
                {pTarget ? (
                  <FloorBar label="Protein (g)" eaten={Math.round(eatenMacros.p)} floor={pTarget} />
                ) : null}
              </div>
            );
          })()}
          <ul className="divide-y divide-line border border-line">
            {todayMeals.map((m) => (
              <li
                key={m.id}
                className="grid grid-cols-[32px_120px_1fr_100px] items-center gap-3 p-3 text-sm"
              >
                <button
                  type="button"
                  onClick={() => toggleMealEaten(m)}
                  aria-pressed={Boolean(m.eaten)}
                  aria-label={m.eaten ? 'Mark as not eaten' : 'Mark as eaten'}
                  className={`h-6 w-6 border ${m.eaten ? 'bg-gold border-gold' : 'border-line'}`}
                />
                <div className="font-display tracking-wider2 text-gold">{m.meal_type ?? 'Meal'}</div>
                <div className={m.eaten ? 'truncate text-faint line-through' : 'truncate text-mute'}>
                  {(m.items ?? [])
                    .map((it) => (typeof it === 'string' ? it : `${it.qty ?? ''} ${it.name ?? ''}`.trim()))
                    .join(', ')}
                </div>
                <div className="text-xs text-faint">
                  {m.macros?.kcal ? `${m.macros.kcal} kcal` : ''}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!reviewThisWeek ? (
        <section className="border border-gold bg-black/30 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="label">Weekly review</div>
              <h3 className="mt-1 font-display text-2xl tracking-wider2">Close the loop for this week</h3>
              <p className="mt-1 max-w-reading text-sm text-mute">
                Diagnose the week. Install the next adjustment. Takes under a minute.
              </p>
            </div>
            <Link
              to="/reviews"
              className="border border-gold bg-gold px-4 py-2 font-display text-xs tracking-wider2 text-bg hover:bg-[#d8b658]"
            >
              Open reviews
            </Link>
          </div>
        </section>
      ) : null}

      {!activeProgram && recent.length > 0 ? (
        <section>
          <div className="label mb-3">Archived programs</div>
          <ul className="divide-y divide-line border border-line">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-display tracking-wider2">Week {r.week_number}</div>
                  <div className="text-xs text-faint">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <Badge tone={r.status === 'active' ? 'green' : 'mute'}>{r.status}</Badge>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!activeProgram && recent.length === 0 ? (
        <section>
          <div className="label mb-3">Programs</div>
          <div className="border border-line bg-black/20 p-6 text-sm text-mute">
            No program written. Generate one, or build one by hand. Structure first, intensity second.
          </div>
        </section>
      ) : null}
    </div>
  );
}
