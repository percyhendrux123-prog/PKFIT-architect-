import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Spinner } from '../../components/ui/Empty';
import { habitStreak, sessionStreak } from '../../lib/streaks';
import HomeScreen from '../../components/redesign/screens/HomeScreen';
import { photos } from '../../lib/assets';

function initialsFor(profile) {
  const name = (profile?.name || profile?.email || 'PK').trim();
  const parts = name.split(/[\s.@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || 'PK';
}

function weekChecksFromSessions(sessions) {
  // Returns Mon..Sun [bool] for the current week.
  const today = new Date();
  const day = today.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - diff);
  monday.setUTCHours(0, 0, 0, 0);

  const checks = [false, false, false, false, false, false, false];
  sessions.forEach((s) => {
    const d = new Date(s.performed_at);
    const offset = Math.floor((d - monday) / 86400000);
    if (offset >= 0 && offset < 7) checks[offset] = true;
  });
  return checks;
}

function weekLabel() {
  const now = new Date();
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const day = days[now.getUTCDay()];
  // ISO week number, rough but fine for UI label.
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((now - start) / 86400000 + start.getUTCDay() + 1) / 7);
  return `${day} · WK ${String(week).padStart(2, '0')}`;
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
  const [latestDM, setLatestDM] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return undefined;
    let cancelled = false;
    const today = new Date().toISOString().slice(0, 10);
    const sinceIso = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const weekStart = (() => {
      const d = new Date();
      const day = d.getUTCDay();
      const diff = (day + 6) % 7;
      d.setUTCDate(d.getUTCDate() - diff);
      return d.toISOString().slice(0, 10);
    })();

    setLoading(true);
    setLoadError(null);

    Promise.all([
      supabase.from('check_ins').select('*').eq('client_id', user.id).order('date', { ascending: false }).limit(1),
      supabase.from('programs').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('programs').select('*').eq('client_id', user.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('meals').select('*').eq('client_id', user.id).eq('date', today).order('meal_type'),
      supabase.from('habits').select('*').eq('client_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('workout_sessions').select('performed_at').eq('client_id', user.id).gte('performed_at', sinceIso).order('performed_at', { ascending: false }),
      supabase.from('reviews').select('id,week_starting').eq('client_id', user.id).eq('week_starting', weekStart).maybeSingle(),
    ])
      .then(([ci, recents, active, todayM, habit, sess, review]) => {
        if (cancelled) return;
        const firstError = [ci, recents, active, todayM, habit, sess, review].find((r) => r?.error);
        if (firstError?.error) {
          setLoadError(firstError.error.message ?? 'Could not load dashboard.');
          setLoading(false);
          return;
        }
        setCheckIn(ci.data?.[0] ?? null);
        setRecent(recents.data ?? []);
        setActiveProgram(active.data ?? null);
        setTodayMeals(todayM.data ?? []);
        setHabitRow(habit.data ?? null);
        setSessions(sess.data ?? []);
        setReviewThisWeek(review.data ?? null);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setLoadError(e?.message ?? 'Could not load dashboard.');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Latest DM from coach for the FROM PERCY card. Fire-and-forget; absence is fine.
  useEffect(() => {
    if (!isSupabaseConfigured || !user) return undefined;
    let cancelled = false;
    supabase
      .from('messages')
      .select('id,body,sender_role,created_at')
      .eq('client_id', user.id)
      .eq('sender_role', 'coach')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setLatestDM(data ?? null);
      })
      .catch(() => {
        // Silent fail — table may be named differently in some envs; the FROM PERCY card just hides.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const hStreak = habitStreak(habitRow);
  const sStreak = sessionStreak(sessions);
  const streak = Math.max(hStreak ?? 0, sStreak ?? 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="label">Today</div>
        <Spinner />
      </div>
    );
  }

  // Build today's session card from active program.
  const exerciseList = Array.isArray(activeProgram?.exercises) ? activeProgram.exercises : [];
  const todaySession = activeProgram
    ? {
        to: '/workouts',
        image: photos.bicep,
        tag: `WK ${activeProgram.week_number ?? 1} · ${activeProgram.schedule?.day_label ?? 'TODAY'}`,
        duration: exerciseList.length ? `${Math.max(30, exerciseList.length * 8)} min` : null,
        title: activeProgram.schedule?.title?.toUpperCase() || 'TRAINING\nSESSION',
        subtitle: exerciseList.length ? `${exerciseList.length} exercises · Strength block` : null,
      }
    : null;

  // Quick stats — pull whatever's available, gracefully fall back.
  const quickStats = [];
  if (checkIn?.weight) {
    quickStats.push({ label: 'Weight', value: checkIn.weight, unit: profile?.units === 'metric' ? 'kg' : 'lbs', delta: '' });
  }
  if (sessions.length) {
    quickStats.push({ label: 'Streak', value: streak, unit: 'd', delta: '' });
  }
  const todayMealsEaten = todayMeals.filter((m) => m.eaten);
  const proteinSum = todayMealsEaten.reduce((a, m) => a + Number(m.macros?.p ?? 0), 0);
  if (proteinSum > 0 || profile?.target_protein_g) {
    quickStats.push({
      label: 'Protein',
      value: Math.round(proteinSum),
      unit: 'g',
      delta: profile?.target_protein_g ? `${Math.round((proteinSum / profile.target_protein_g) * 100)}%` : '',
    });
  }
  if (sessions.length) {
    const last30 = sessions.filter((s) => (Date.now() - new Date(s.performed_at).getTime()) / 86400000 <= 30).length;
    quickStats.push({ label: 'Sessions · 30d', value: last30, unit: '', delta: '' });
  }

  const greeting = (() => {
    const h = new Date().getHours();
    const slot = h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening';
    const name = profile?.name?.split(' ')?.[0] ?? '';
    return name ? `${slot}, ${name}` : `${slot}`;
  })();

  return (
    <div>
      {loadError ? (
        <section
          role="alert"
          className="border border-signal/40 bg-black/40 p-4"
          style={{ marginBottom: 16 }}
        >
          <div className="label text-signal">Load issue</div>
          <p className="mt-1 text-sm text-mute">
            Some surfaces could not be reached. {loadError}
          </p>
        </section>
      ) : null}

      <HomeScreen
        greeting={greeting}
        weekLabel={weekLabel()}
        initials={initialsFor(profile)}
        streakDays={streak}
        weekChecks={weekChecksFromSessions(sessions)}
        todaySession={todaySession}
        quickStats={quickStats}
        coachNote={latestDM?.body}
      />

      {/* Pre-existing supplemental sections — kept as a deeper drawer below the new hero so we don't lose
          weekly-review / archived-program / meals UX while the redesign lands. */}
      {!reviewThisWeek ? (
        <section
          className="border border-gold bg-black/30 p-5"
          style={{ marginTop: 24 }}
        >
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

      {recent.length > 0 && !activeProgram ? (
        <section style={{ marginTop: 24 }}>
          <div className="label mb-3">Archived programs</div>
          <ul className="divide-y divide-line border border-line">
            {recent.map((r) => (
              <li key={r.id} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-display tracking-wider2">Week {r.week_number}</div>
                  <div className="text-xs text-faint">{new Date(r.created_at).toLocaleDateString()}</div>
                </div>
                <span className="text-xs text-mute uppercase">{r.status}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
