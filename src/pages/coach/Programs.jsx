import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Badge } from '../../components/ui/Badge';

export default function Programs() {
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const { data: programs } = await supabase
        .from('programs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      const ids = [...new Set((programs ?? []).map((p) => p.client_id))];
      const { data: profiles } = ids.length
        ? await supabase.from('profiles').select('id,name,email').in('id', ids)
        : { data: [] };
      const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setRows((programs ?? []).map((p) => ({ ...p, client: byId[p.client_id] })));
    })();
  }, []);

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Programs</div>
        <h1 className="font-display text-4xl tracking-wider2">Assigned</h1>
      </header>

      <div className="overflow-x-auto border border-line">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-xs uppercase tracking-widest2 text-faint">
            <tr>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Week</th>
              <th className="px-4 py-3">Exercises</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <Link to={`/coach/clients/${p.client_id}`} className="font-display tracking-wider2 text-ink hover:text-gold">
                    {p.client?.name ?? p.client?.email ?? '—'}
                  </Link>
                </td>
                <td className="px-4 py-3 text-mute">{p.week_number}</td>
                <td className="px-4 py-3 text-mute">{Array.isArray(p.exercises) ? p.exercises.length : 0}</td>
                <td className="px-4 py-3"><Badge tone={p.status === 'active' ? 'green' : 'mute'}>{p.status}</Badge></td>
                <td className="px-4 py-3 text-faint">{new Date(p.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
