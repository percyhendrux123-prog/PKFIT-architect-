import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Dumbbell, UtensilsCrossed, Target, CalendarDays, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { deriveLoopStage, LOOP_STAGES, loopProgress, loopStageMeta } from '../../lib/loop';

const cards = [
  { to: '/workouts', label: 'Training', icon: Dumbbell, copy: "Today's program. Three lifts. No filler." },
  { to: '/meals', label: 'Nutrition', icon: UtensilsCrossed, copy: "Macro floor. Meal scaffolding." },
  { to: '/habits', label: 'Habits', icon: Target, copy: "The few daily levers." },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, copy: "Thirty-day arc." },
  { to: '/assistant', label: 'Assistant', icon: Sparkles, copy: "Ask the Architect." },
];

export default function Dashboard() {
  const { user, profile } = useAuth();
  const [recent, setRecent] = useState([]);
  const [checkIn, setCheckIn] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
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
  }, [user?.id]);

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

      <section>
        <div className="label mb-3">Recent programs</div>
        {recent.length === 0 ? (
          <div className="border border-line bg-black/20 p-6 text-sm text-mute">
            No programs yet. Generate one from Workouts → Generator.
          </div>
        ) : (
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
        )}
      </section>
    </div>
  );
}
