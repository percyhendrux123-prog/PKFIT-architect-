import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Download, Sparkles } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { claude } from '../../lib/claudeClient';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { downloadCSV } from '../../lib/csv';
import { deriveLoopStage, loopStageMeta } from '../../lib/loop';

function daysAgoIso(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function computeAdherence(habitRow, days = 7) {
  const list = habitRow?.habit_list ?? [];
  const history = habitRow?.check_history ?? {};
  if (list.length === 0) return null;
  let hits = 0;
  let slots = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const day = history[key] ?? {};
    for (const h of list) {
      slots += 1;
      if (day[h.id]) hits += 1;
    }
  }
  return slots ? Math.round((hits / slots) * 100) : 0;
}

export default function CoachDashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    mrr: 0,
    recent: [],
    flagged: [],
    weekCheckIns: 0,
    weekPrograms: 0,
  });
  const [triageBusy, setTriageBusy] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const cutoff = daysAgoIso(7);

      const [
        { count: clients },
        { data: active },
        { data: recent },
        { count: weekCheckIns },
        { count: weekPrograms },
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'client'),
        supabase.from('payments').select('amount,status').eq('status', 'active'),
        supabase.from('check_ins').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('check_ins').select('*', { count: 'exact', head: true }).gte('created_at', cutoff),
        supabase.from('programs').select('*', { count: 'exact', head: true }).gte('created_at', cutoff),
      ]);

      const mrr = (active ?? []).reduce((acc, p) => acc + Number(p.amount ?? 0), 0);

      const { data: staleClients } = await supabase
        .from('profiles')
        .select('id,name,email')
        .eq('role', 'client');
      const { data: recentIds } = await supabase
        .from('check_ins')
        .select('client_id')
        .gte('created_at', cutoff);
      const seen = new Set((recentIds ?? []).map((r) => r.client_id));
      const flagged = (staleClients ?? []).filter((c) => !seen.has(c.id)).slice(0, 8);

      setStats({
        clients: clients ?? 0,
        mrr,
        recent: recent ?? [],
        flagged,
        weekCheckIns: weekCheckIns ?? 0,
        weekPrograms: weekPrograms ?? 0,
      });
    })();
  }, []);

  async function bulkReview() {
    const ok = window.confirm(
      'Generate a weekly review for every active client. This fires one Anthropic call per client — rate-limited, slow, not free. Continue?',
    );
    if (!ok) return;
    setBulkBusy(true);
    setBulkMsg(null);
    try {
      const { data: clients } = await supabase
        .from('profiles')
        .select('id')
        .eq('role', 'client');
      const ids = (clients ?? []).map((c) => c.id);
      let ok = 0;
      let failed = 0;
      // Run sequentially to stay comfortable inside the generator's hourly
      // rate limit and keep the progress message meaningful.
      for (const id of ids) {
        try {
          await claude.weeklyReview({ clientId: id });
          ok += 1;
        } catch {
          failed += 1;
        }
        setBulkMsg(`Generating ${ok + failed} / ${ids.length}`);
      }
      setBulkMsg(`Done. ${ok} generated, ${failed} failed.`);
    } finally {
      setBulkBusy(false);
    }
  }

  async function exportTriage() {
    setTriageBusy(true);
    try {
      const cutoff = daysAgoIso(7);
      const { data: clients } = await supabase
        .from('profiles')
        .select('id,name,email,plan,start_date,loop_stage')
        .eq('role', 'client');

      if (!clients?.length) {
        setTriageBusy(false);
        return;
      }
      const ids = clients.map((c) => c.id);

      const [
        { data: checkIns },
        { data: sessions },
        { data: habits },
        { data: reviews },
      ] = await Promise.all([
        supabase.from('check_ins').select('client_id,weight,body_fat,date,created_at').in('client_id', ids).gte('created_at', cutoff),
        supabase.from('workout_sessions').select('client_id,performed_at').in('client_id', ids).gte('performed_at', cutoff),
        supabase.from('habits').select('client_id,habit_list,check_history').in('client_id', ids),
        supabase.from('reviews').select('client_id,summary,week_starting,metrics').in('client_id', ids).order('week_starting', { ascending: false }),
      ]);

      const habitsById = {};
      for (const h of habits ?? []) habitsById[h.client_id] = h;
      const sessionsCount = {};
      for (const s of sessions ?? []) sessionsCount[s.client_id] = (sessionsCount[s.client_id] ?? 0) + 1;
      const checkInsByClient = {};
      for (const ci of checkIns ?? []) {
        (checkInsByClient[ci.client_id] ??= []).push(ci);
      }
      const latestReview = {};
      for (const r of reviews ?? []) {
        if (!latestReview[r.client_id]) latestReview[r.client_id] = r;
      }

      const rows = clients.map((c) => {
        const cis = (checkInsByClient[c.id] ?? []).slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        const weightDelta =
          cis.length >= 2 && cis[0].weight != null && cis[cis.length - 1].weight != null
            ? Math.round((cis[cis.length - 1].weight - cis[0].weight) * 10) / 10
            : null;
        const adherence = computeAdherence(habitsById[c.id], 7);
        const review = latestReview[c.id];
        return {
          name: c.name ?? '',
          email: c.email ?? '',
          plan: c.plan ?? 'trial',
          loop: loopStageMeta(deriveLoopStage(c)).label,
          check_ins_7d: (checkInsByClient[c.id] ?? []).length,
          latest_weight: cis[cis.length - 1]?.weight ?? '',
          weight_delta_7d: weightDelta ?? '',
          sessions_7d: sessionsCount[c.id] ?? 0,
          habit_adherence_7d_pct: adherence ?? '',
          last_review_week: review?.week_starting ?? '',
          last_review_summary: review?.summary ? review.summary.slice(0, 200) : '',
        };
      });

      downloadCSV(`pkfit-triage-${new Date().toISOString().slice(0, 10)}.csv`, rows, [
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
        { key: 'plan', label: 'Plan' },
        { key: 'loop', label: 'Loop stage' },
        { key: 'check_ins_7d', label: 'Check-ins 7d' },
        { key: 'latest_weight', label: 'Latest weight' },
        { key: 'weight_delta_7d', label: 'Weight Δ 7d' },
        { key: 'sessions_7d', label: 'Sessions 7d' },
        { key: 'habit_adherence_7d_pct', label: 'Habits % 7d' },
        { key: 'last_review_week', label: 'Last review week' },
        { key: 'last_review_summary', label: 'Last review summary' },
      ]);
    } finally {
      setTriageBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Coach</div>
          <h1 className="font-display text-4xl tracking-wider2">Overview</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={exportTriage} disabled={triageBusy}>
            <Download size={14} /> {triageBusy ? 'Compiling' : 'Monday triage CSV'}
          </Button>
          <Button onClick={bulkReview} disabled={bulkBusy}>
            <Sparkles size={14} /> {bulkBusy ? bulkMsg ?? 'Generating' : 'Generate reviews (all clients)'}
          </Button>
        </div>
      </header>
      {bulkMsg && !bulkBusy ? (
        <div className="text-xs uppercase tracking-widest2 text-gold">{bulkMsg}</div>
      ) : null}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader label="Clients" title={String(stats.clients)} />
          <Link to="/coach/clients" className="text-xs uppercase tracking-widest2 text-gold">Open roster →</Link>
        </Card>
        <Card>
          <CardHeader label="MRR (active)" title={`$${stats.mrr}`} />
          <Link to="/coach/revenue" className="text-xs uppercase tracking-widest2 text-gold">Revenue →</Link>
        </Card>
        <Card>
          <CardHeader label="Flagged" title={String(stats.flagged.length)} meta="No check-in 7d+" />
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader label="This week" title={`${stats.weekCheckIns} check-ins`} meta="Last 7 days" />
        </Card>
        <Card>
          <CardHeader label="This week" title={`${stats.weekPrograms} programs`} meta="Created in last 7 days" />
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader label="Recent check-ins" title="Last 10" />
          {stats.recent.length === 0 ? (
            <div className="text-sm text-mute">None yet.</div>
          ) : (
            <ul className="divide-y divide-line">
              {stats.recent.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <span>{c.client_id.slice(0, 8)}…</span>
                  <span className="text-faint">{c.weight ?? '—'} kg</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader label="Flagged" title="Needs attention" />
          {stats.flagged.length === 0 ? (
            <div className="text-sm text-mute">No stale clients.</div>
          ) : (
            <ul className="divide-y divide-line">
              {stats.flagged.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                  <Link to={`/coach/clients/${c.id}`} className="text-ink hover:text-gold">{c.name ?? c.email}</Link>
                  <span className="label">silent 7d+</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </section>
    </div>
  );
}
