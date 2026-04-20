import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Card, CardHeader } from '../../components/ui/Card';

export default function CoachDashboard() {
  const [stats, setStats] = useState({
    clients: 0,
    mrr: 0,
    recent: [],
    flagged: [],
    weekCheckIns: 0,
    weekPrograms: 0,
  });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Coach</div>
        <h1 className="font-display text-4xl tracking-wider2">Overview</h1>
      </header>

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
