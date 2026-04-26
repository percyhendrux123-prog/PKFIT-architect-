import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Download } from 'lucide-react';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Avatar } from '../../components/ui/Avatar';
import { Empty, Spinner } from '../../components/ui/Empty';
import { deriveLoopStage, loopStageMeta } from '../../lib/loop';
import { downloadCSV } from '../../lib/csv';

function relativeDays(iso) {
  if (!iso) return null;
  const d = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (d === 0) return 'today';
  if (d === 1) return '1d';
  if (d < 7) return `${d}d`;
  if (d < 30) return `${Math.floor(d / 7)}w`;
  return `${Math.floor(d / 30)}mo`;
}

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [lastActive, setLastActive] = useState({});
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      const clientRows = rows ?? [];
      setClients(clientRows);
      setLoading(false);
      if (!clientRows.length) return;
      const ids = clientRows.map((c) => c.id);

      const [checkIns, sessions, threads] = await Promise.all([
        supabase.from('check_ins').select('client_id,created_at').in('client_id', ids),
        supabase.from('workout_sessions').select('client_id,performed_at').in('client_id', ids),
        supabase.from('dm_threads').select('client_id,last_activity_at').in('client_id', ids),
      ]);
      if (cancelled) return;

      const map = {};
      function touch(id, iso) {
        if (!iso) return;
        if (!map[id] || new Date(iso) > new Date(map[id])) map[id] = iso;
      }
      for (const r of checkIns.data ?? []) touch(r.client_id, r.created_at);
      for (const r of sessions.data ?? []) touch(r.client_id, r.performed_at);
      for (const r of threads.data ?? []) touch(r.client_id, r.last_activity_at);
      setLastActive(map);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    return clients.filter((c) => {
      const matchesQ = q
        ? `${c.name ?? ''} ${c.email ?? ''}`.toLowerCase().includes(q.toLowerCase())
        : true;
      const matchesPlan = plan === 'all' ? true : (c.plan ?? 'trial') === plan;
      return matchesQ && matchesPlan;
    });
  }, [clients, q, plan]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Clients</div>
          <h1 className="font-display text-4xl tracking-wider2">Roster</h1>
        </div>
        <Button
          variant="ghost"
          onClick={() =>
            downloadCSV(
              `pkfit-clients-${new Date().toISOString().slice(0, 10)}.csv`,
              filtered,
              [
                { key: 'name', label: 'Name' },
                { key: 'email', label: 'Email' },
                { key: 'plan', label: 'Plan' },
                { key: 'start_date', label: 'Start date' },
                {
                  label: 'Loop stage',
                  get: (c) => loopStageMeta(deriveLoopStage(c)).label,
                },
                {
                  label: 'Last active',
                  get: (c) => lastActive[c.id] ?? '',
                },
                { key: 'created_at', label: 'Joined' },
              ],
            )
          }
          disabled={filtered.length === 0}
        >
          <Download size={14} /> Export CSV
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_180px]">
        <Input label="Search" placeholder="Name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select label="Plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option value="all">All</option>
          <option value="trial">Trial</option>
          <option value="performance">Performance</option>
          <option value="identity">Identity</option>
          <option value="full">Full</option>
          <option value="premium">Premium</option>
        </Select>
      </div>

      {loading ? (
        <div className="border border-line bg-black/20 p-6"><Spinner /></div>
      ) : clients.length === 0 ? (
        <Empty title="No clients yet" body="When clients sign up, they show up here." />
      ) : filtered.length === 0 ? (
        <Empty title="No matches" body="Adjust the search or plan filter." />
      ) : (
      <div className="overflow-x-auto border border-line">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-widest2 text-faint">
            <tr>
              <th scope="col" className="px-4 py-3">Name</th>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Plan</th>
              <th scope="col" className="px-4 py-3">Loop</th>
              <th scope="col" className="px-4 py-3">Last active</th>
              <th scope="col" className="px-4 py-3">Joined</th>
              <th scope="col" className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filtered.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={c.name ?? c.email ?? '—'} path={c.avatar_path} size={32} />
                    <span className="font-display tracking-wider2">{c.name ?? '—'}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-mute">{c.email ?? '—'}</td>
                <td className="px-4 py-3"><Badge tone="gold">{c.plan ?? 'trial'}</Badge></td>
                <td className="px-4 py-3 text-mute">{loopStageMeta(deriveLoopStage(c)).label}</td>
                <td className="px-4 py-3 text-faint">
                  {(() => {
                    const rel = relativeDays(lastActive[c.id]);
                    if (!rel) return '—';
                    const daysAgo = Math.floor((Date.now() - new Date(lastActive[c.id]).getTime()) / 86400000);
                    return (
                      <span className={daysAgo >= 7 ? 'text-signal' : 'text-faint'}>{rel}</span>
                    );
                  })()}
                </td>
                <td className="px-4 py-3 text-faint">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/coach/clients/${c.id}`} className="text-xs uppercase tracking-widest2 text-gold">Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
}
