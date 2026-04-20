import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { useRealtime } from '../../hooks/useRealtime';
import { Badge } from '../../components/ui/Badge';

export default function CoachInbox() {
  const { user, role } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data: threads } = await supabase
      .from('dm_threads')
      .select('*')
      .order('last_activity_at', { ascending: false })
      .limit(200);

    const clientIds = [...new Set((threads ?? []).map((t) => t.client_id))];
    const { data: profiles } = clientIds.length
      ? await supabase.from('profiles').select('id,name,email').in('id', clientIds)
      : { data: [] };
    const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

    const enriched = await Promise.all(
      (threads ?? []).map(async (t) => {
        const [{ count: unread }, { data: lastArr }] = await Promise.all([
          supabase
            .from('dm_messages')
            .select('*', { count: 'exact', head: true })
            .eq('thread_id', t.id)
            .eq('read_by_coach', false)
            .neq('author_id', user?.id ?? '00000000-0000-0000-0000-000000000000'),
          supabase
            .from('dm_messages')
            .select('content,created_at,author_id')
            .eq('thread_id', t.id)
            .order('created_at', { ascending: false })
            .limit(1),
        ]);
        return { ...t, client: byId[t.client_id], unread: unread ?? 0, last: lastArr?.[0] ?? null };
      }),
    );
    setRows(enriched);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { load(); }, [load]);
  useRealtime('dm_messages', load);

  if (role !== 'coach') return null;

  return (
    <div className="space-y-6">
      <header>
        <div className="label mb-2">Inbox</div>
        <h1 className="font-display text-4xl tracking-wider2">Client messages</h1>
      </header>

      {loading ? (
        <div className="text-xs uppercase tracking-widest2 text-faint">Loading</div>
      ) : rows.length === 0 ? (
        <div className="border border-line bg-black/20 p-6 text-sm text-mute">No open threads yet.</div>
      ) : (
        <ul className="divide-y divide-line border border-line">
          {rows.map((t) => (
            <li key={t.id}>
              <Link
                to={`/coach/clients/${t.client_id}?tab=messages`}
                className="flex items-center gap-4 px-4 py-3 hover:bg-black/30"
              >
                <div className="flex-1">
                  <div className="font-display tracking-wider2">{t.client?.name ?? t.client?.email ?? 'Unknown'}</div>
                  <div className="truncate text-xs text-faint">{t.last?.content ?? '—'}</div>
                </div>
                <div className="text-xs text-faint">
                  {t.last ? new Date(t.last.created_at).toLocaleString() : ''}
                </div>
                {t.unread > 0 ? <Badge tone="gold">{t.unread} unread</Badge> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
