import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Avatar } from '../../components/ui/Avatar';
import { deriveLoopStage, loopStageMeta } from '../../lib/loop';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [q, setQ] = useState('');
  const [plan, setPlan] = useState('all');

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .then(({ data }) => setClients(data ?? []));
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
      <header>
        <div className="label mb-2">Clients</div>
        <h1 className="font-display text-4xl tracking-wider2">Roster</h1>
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

      <div className="overflow-x-auto border border-line">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-widest2 text-faint">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Plan</th>
              <th className="px-4 py-3">Loop</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3"></th>
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
                <td className="px-4 py-3 text-faint">{new Date(c.created_at).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link to={`/coach/clients/${c.id}`} className="text-xs uppercase tracking-widest2 text-gold">Open →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
