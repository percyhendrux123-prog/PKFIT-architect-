import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { billing } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';

const PLANS = [
  { tier: 'performance', label: 'Performance Standard', monthly: 250, annual: 2500 },
  { tier: 'identity', label: 'Identity Architecture', monthly: 350, annual: 3500 },
  { tier: 'full', label: 'Full Integration', monthly: 450, annual: 4500 },
  { tier: 'premium', label: 'Premium', monthly: 750, annual: 7500 },
];

function annualEffective(monthly) {
  // 17% off annual effective monthly rate.
  return Math.round(monthly * 12 * 0.83);
}

export default function Billing() {
  const { user } = useAuth();
  const [interval, setInterval] = useState('monthly');
  const [payment, setPayment] = useState(null);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return;
    supabase
      .from('payments')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => setPayment(data?.[0] ?? null));
  }, [user?.id]);

  async function checkout(tier) {
    setBusy(tier);
    setErr(null);
    try {
      const { url } = await billing.createCheckout({ tier, interval });
      window.location.href = url;
    } catch (e) {
      setErr(e.message);
      setBusy(null);
    }
  }

  async function openPortal() {
    setBusy('portal');
    try {
      const { url } = await billing.createPortal({});
      window.location.href = url;
    } catch (e) {
      setErr(e.message);
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <div className="label mb-2">Billing</div>
        <h1 className="font-display text-4xl tracking-wider2">Plan</h1>
      </header>

      {payment ? (
        <Card>
          <CardHeader label="Active" title={payment.plan ?? 'Subscription'} meta={
            payment.current_period_end
              ? `Renews ${new Date(payment.current_period_end).toLocaleDateString()}`
              : null
          } />
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={payment.status === 'active' ? 'green' : 'mute'}>{payment.status}</Badge>
            <span className="text-sm text-mute">{payment.amount ? `$${payment.amount}` : null}</span>
          </div>
          <div className="mt-4">
            <Button onClick={openPortal} variant="ghost" disabled={busy === 'portal'}>
              {busy === 'portal' ? 'Opening portal' : 'Manage / cancel'}
            </Button>
          </div>
        </Card>
      ) : (
        <div className="border border-line bg-black/20 p-5 text-sm text-mute">
          No active subscription. Choose a tier below.
        </div>
      )}

      <section>
        <div className="label mb-3">Choose interval</div>
        <div className="inline-flex border border-line">
          {['monthly', 'annual'].map((v) => (
            <button
              key={v}
              onClick={() => setInterval(v)}
              className={`px-4 py-2 text-xs uppercase tracking-widest2 ${interval === v ? 'bg-gold text-bg' : 'text-mute'}`}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">Annual billing applies a 17% reduction to effective monthly rate.</p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const price = interval === 'annual' ? annualEffective(p.monthly) : p.monthly;
          const suffix = interval === 'annual' ? '/yr' : '/mo';
          return (
            <article key={p.tier} className="flex flex-col border border-line bg-black/30 p-5">
              <div className="label">{p.label}</div>
              <div className="mt-3 font-display text-5xl tracking-wider2 text-gold">${price}<span className="text-base text-mute">{suffix}</span></div>
              <p className="mt-3 flex-1 text-sm text-mute">
                {p.tier === 'performance' && 'Baseline coaching. Weekly check-in. Program architecture.'}
                {p.tier === 'identity' && 'Performance plus habit architecture and identity mapping.'}
                {p.tier === 'full' && 'Full integration: training, nutrition, habits, loop review.'}
                {p.tier === 'premium' && 'Direct access. Faster cycle. Deeper review.'}
              </p>
              <Button
                className="mt-4"
                onClick={() => checkout(p.tier)}
                disabled={busy === p.tier}
              >
                {busy === p.tier ? 'Redirecting' : 'Select'}
              </Button>
            </article>
          );
        })}
      </section>

      {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}
    </div>
  );
}
