import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { Card, CardHeader } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { downloadCSV } from '../../lib/csv';

export default function Revenue() {
  const [data, setData] = useState({ active: [], canceled: [], all: [], total: 0, mrr: 0 });

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    (async () => {
      const { data: all } = await supabase.from('payments').select('*').order('created_at', { ascending: false });
      const active = (all ?? []).filter((p) => p.status === 'active');
      const canceled = (all ?? []).filter((p) => p.status === 'canceled');
      const mrr = active.reduce((acc, p) => acc + Number(p.amount ?? 0), 0);
      setData({ active, canceled, all: all ?? [], total: (all ?? []).length, mrr });
    })();
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
          <Download size={14} /> Export CSV
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
        <ul className="divide-y divide-line border border-line">
          {data.active.map((p) => (
            <li key={p.id} className="grid grid-cols-1 gap-2 p-3 md:grid-cols-[1fr_120px_120px_160px]">
              <span className="text-mute">{p.client_id.slice(0, 8)}…</span>
              <span className="font-display tracking-wider2">{p.plan ?? '—'}</span>
              <span className="text-mute">${p.amount ?? '—'}</span>
              <Badge tone="green">{p.status}</Badge>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
