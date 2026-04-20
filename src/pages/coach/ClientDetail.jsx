import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { claude } from '../../lib/claudeClient';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Card, CardHeader } from '../../components/ui/Card';
import { DMThread } from '../../components/DMThread';
import { deriveLoopStage, loopStageMeta } from '../../lib/loop';

export default function ClientDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'overview';
  const { user, role } = useAuth();
  const [client, setClient] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [checkIns, setCheckIns] = useState([]);
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !id) return;
    (async () => {
      const [{ data: p }, { data: pr }, { data: ci }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        supabase.from('programs').select('*').eq('client_id', id).order('created_at', { ascending: false }).limit(10),
        supabase.from('check_ins').select('*').eq('client_id', id).order('date', { ascending: false }).limit(12),
      ]);
      setClient(p);
      setPrograms(pr ?? []);
      setCheckIns(ci ?? []);
    })();
  }, [id]);

  async function runWorkout() {
    setBusy('workout');
    setMsg(null);
    try {
      await claude.generateWorkout({ clientId: id, profile: client, goal: 'recomp', training_days: '4', experience: 'intermediate', equipment: 'full_gym' });
      setMsg('Program generated.');
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  async function runMeals() {
    setBusy('meals');
    setMsg(null);
    try {
      await claude.generateMealPlan({ clientId: id, profile: client, goal: 'recomp', kcal_target: '2400', protein_g: '180', style: 'flexible' });
      setMsg('Meal plan generated.');
    } catch (e) { setMsg(e.message); }
    setBusy(null);
  }

  if (!client) return <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <div className="label mb-2">Client</div>
          <h1 className="font-display text-4xl tracking-wider2">{client.name ?? client.email}</h1>
          <p className="mt-1 text-sm text-mute">{client.plan ?? 'trial'} · loop: {loopStageMeta(deriveLoopStage(client)).label}</p>
        </div>
        <Link to="/coach/clients" className="text-xs uppercase tracking-widest2 text-gold">← Roster</Link>
      </header>

      <nav className="flex gap-2 border-b border-line">
        {[
          { key: 'overview', label: 'Overview' },
          { key: 'messages', label: 'Messages' },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setParams({ tab: t.key })}
            className={`px-4 py-2 text-xs uppercase tracking-widest2 ${
              tab === t.key ? 'border-b-2 border-gold text-gold' : 'text-mute hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'overview' ? (
        <>
          <section className="flex flex-wrap gap-3">
            <Button onClick={runWorkout} disabled={busy === 'workout'}>
              {busy === 'workout' ? 'Generating' : 'Generate program'}
            </Button>
            <Button onClick={runMeals} variant="ghost" disabled={busy === 'meals'}>
              {busy === 'meals' ? 'Generating' : 'Generate meal plan'}
            </Button>
          </section>
          {msg ? <div className="text-xs uppercase tracking-widest2 text-gold">{msg}</div> : null}

          <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Card>
              <CardHeader label="Programs" title={`Recent (${programs.length})`} />
              <ul className="divide-y divide-line">
                {programs.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span>Week {p.week_number} · {p.status}</span>
                    <span className="text-faint">{new Date(p.created_at).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader label="Check-ins" title={`Recent (${checkIns.length})`} />
              <ul className="divide-y divide-line">
                {checkIns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{c.date?.slice(0, 10)}</span>
                    <span className="text-faint">{c.weight ?? '—'} kg · {c.body_fat ?? '—'}%</span>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        </>
      ) : (
        <DMThread clientId={id} viewer={{ id: user?.id }} role={role} />
      )}
    </div>
  );
}
