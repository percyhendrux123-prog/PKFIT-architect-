import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Empty, Spinner } from '../../components/ui/Empty';
import { downloadCSV } from '../../lib/csv';

export default function Revenue() {
  const [data, setData] = useState({ active: [], canceled: [], all: [], total: 0, mrr: 0 });
  const [profileMap, setProfileMap] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      const { data: all } = await supabase
        .from('payments')
        .select('*')
        .order('created_at', { ascending: false });
      const rows = all ?? [];
      const active = rows.filter((p) => p.status === 'active');
      const canceled = rows.filter((p) => p.status === 'canceled');
      const mrr = active.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
      const ids = [...new Set(rows.map((p) => p.client_id).filter(Boolean))];
      const { data: profiles } = ids.length
        ? await supabase.from('profiles').select('id,name,email').in('id', ids)
        : { data: [] };
      if (cancelled) return;
      setProfileMap(Object.fromEntries((profiles ?? []).map((p) => [p.id, p])));
      setData({ active, canceled, all: rows, total: rows.length, mrr });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const churnRate = data.total ? Math.round((data.canceled.length / data.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <div className="label mb-2">Revenue</div>
          <h1 className="font-display text-4xl tracking-wider2">Financials</h1>
        </div>
        <Button
          variant="ghost"
          onClick={() =>
            downloadCSV(
              `pkfit-payments-${new Date().toISOString().slice(0, 10)}.csv`,
              data.all,
              [
                { key: 'created_at', label: 'Created' },
                { key: 'client_id', label: 'Client ID' },
                { label: 'Client name', get: (p) => profileMap[p.client_id]?.name ?? '' },
                { key: 'plan', label: 'Plan' },
                { key: 'amount', label: 'Amount' },
                { key: 'status', label: 'Status' },
                { key: 'current_period_end', label: 'Period end' },
                { key: 'stripe_subscription_id', label: 'Subscription' },
              ],
            )
          }
          disabled={data.all.length === 0}
        >
          <Download size={14} aria-hidden="true" /> Export CSV
        </Button>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader label="MRR (active)" title={`$${data.mrr}`} />
        </Card>
        <Card>
          <CardHeader label="Active subs" title={String(data.active.length)} />
        </Card>
        <Card>
          <CardHeader label="Churn" title={`${churnRate}%`} meta={`${data.canceled.length}/${data.total}`} />
        </Card>
      </section>

      <section>
        <div className="label mb-2">Active</div>
        {loading ? (
          <div className="border border-line bg-black/20 p-6"><Spinner /></div>
        ) : data.active.length === 0 ? (
          <Empty title="No active subscriptions yet" body="Active payments land here once Stripe webhooks confirm." />
        ) : (
          <ul className="divide-y divide-line border border-line">
            {data.active.map((p) => {
              const prof = profileMap[p.client_id];
              return (
                <li key={p.id} className="grid grid-cols-1 gap-2 p-3 md:grid-cols-[1fr_140px_120px_140px]">
                  <Link
                    to={`/coach/clients/${p.client_id}`}
                    className="font-display tracking-wider2 text-ink hover:text-gold"
                  >
                    {prof?.name ?? prof?.email ?? `${p.client_id.slice(0, 8)}…`}
                  </Link>
                  <span className="text-mute">{p.plan ?? '—'}</span>
                  <span className="text-mute">${p.amount ?? '—'}</span>
                  <Badge tone="green">{p.status}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
