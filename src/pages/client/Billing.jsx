import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';
import { billing } from '../../lib/claudeClient';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card, CardHeader } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Empty';

const PLANS = [
  {
    tier: 'performance',
    label: 'Performance Standard',
    monthly: 250,
    headline: 'Diagnose. Program. Lock.',
    features: [
      'Programmed lifting split',
      'Macro floor + meal scaffolding',
      'Weekly written check-in',
      'Inbox response within 48 hours',
    ],
  },
  {
    tier: 'identity',
    label: 'Identity Architecture',
    monthly: 350,
    headline: 'Performance plus the loop work.',
    features: [
      'Everything in Performance',
      'Habit stack design + tracking',
      'Identity mapping session',
      'Inbox response within 24 hours',
    ],
  },
  {
    tier: 'full',
    label: 'Full Integration',
    monthly: 450,
    headline: 'Training, nutrition, habits, all locked.',
    features: [
      'Everything in Identity',
      'Loop reviews twice per week',
      'Nutrition adjustments on demand',
      'Direct DM thread with the coach',
    ],
  },
  {
    tier: 'premium',
    label: 'Premium',
    monthly: 750,
    headline: 'Direct access. Faster cycle.',
    features: [
      'Everything in Full Integration',
      'Same-day inbox response',
      'Quarterly in-depth review',
      'Priority on protocol updates',
    ],
  },
];

function annualEffective(monthly) {
  return Math.round(monthly * 12 * 0.83);
}

function annualSavings(monthly) {
  return Math.round(monthly * 12 * 0.17);
}

export default function Billing() {
  const { user, profile } = useAuth();
  const [interval, setInterval] = useState('monthly');
  const [payment, setPayment] = useState(null);
  const [loadingPayment, setLoadingPayment] = useState(true);
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !user) return undefined;
    let cancelled = false;
    setLoadingPayment(true);
    supabase
      .from('payments')
      .select('*')
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (cancelled) return;
        setPayment(data?.[0] ?? null);
        setLoadingPayment(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const currentTier = profile?.plan && profile.plan !== 'trial' ? profile.plan : null;
  const isActive = payment?.status === 'active';

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
    setErr(null);
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
        <p className="mt-3 max-w-reading text-sm text-mute">
          Pick the tier that matches the work you want done. Switch up or down inside the Stripe portal anytime.
        </p>
      </header>

      {loadingPayment ? (
        <div className="border border-line bg-black/20 p-5"><Spinner /></div>
      ) : payment ? (
        <Card>
          <CardHeader
            label="Active"
            title={PLANS.find((p) => p.tier === payment.plan)?.label ?? payment.plan ?? 'Subscription'}
            meta={
              payment.current_period_end
                ? `${payment.cancel_at_period_end ? 'Ends' : 'Renews'} ${new Date(payment.current_period_end).toLocaleDateString()}`
                : null
            }
          />
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={isActive ? 'green' : 'red'}>{payment.status}</Badge>
            {payment.amount ? <span className="text-sm text-mute">${payment.amount}{payment.interval === 'year' ? '/yr' : '/mo'}</span> : null}
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
        <div role="tablist" aria-label="Billing interval" className="inline-flex border border-line">
          {['monthly', 'annual'].map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={interval === v}
              onClick={() => setInterval(v)}
              className={`px-4 py-2 text-xs uppercase tracking-widest2 transition-colors focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold ${
                interval === v ? 'bg-gold text-bg' : 'text-mute hover:text-ink'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-faint">
          {interval === 'annual'
            ? 'Annual billing saves 17% — paid up front.'
            : 'Switch to annual to save 17%.'}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const annual = annualEffective(p.monthly);
          const price = interval === 'annual' ? annual : p.monthly;
          const suffix = interval === 'annual' ? '/yr' : '/mo';
          const savings = annualSavings(p.monthly);
          const isCurrent = currentTier === p.tier && isActive;
          return (
            <article
              key={p.tier}
              className={`flex flex-col border bg-black/30 p-5 transition-colors ${
                isCurrent ? 'border-gold' : 'border-line'
              }`}
            >
              <div className="flex items-baseline justify-between">
                <div className="label">{p.label}</div>
                {isCurrent ? <Badge tone="gold">Current</Badge> : null}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <div className="font-display text-5xl tracking-wider2 text-gold">${price}</div>
                <div className="text-base text-mute">{suffix}</div>
              </div>
              {interval === 'annual' ? (
                <div className="mt-1 text-xs uppercase tracking-widest2 text-success">
                  Save ${savings}/yr
                </div>
              ) : (
                <div className="mt-1 text-xs uppercase tracking-widest2 text-faint">
                  ${annual}/yr on annual
                </div>
              )}
              <p className="mt-4 text-sm text-ink">{p.headline}</p>
              <ul className="mt-4 flex-1 space-y-2 text-sm text-mute">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check size={14} className="mt-1 flex-none text-gold" aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <Button
                  className="mt-5"
                  variant="ghost"
                  onClick={openPortal}
                  disabled={busy === 'portal'}
                >
                  {busy === 'portal' ? 'Opening portal' : 'Manage'}
                </Button>
              ) : (
                <Button
                  className="mt-5"
                  onClick={() => checkout(p.tier)}
                  disabled={busy === p.tier}
                >
                  {busy === p.tier ? 'Redirecting' : isActive ? 'Switch to this tier' : 'Select'}
                </Button>
              )}
            </article>
          );
        })}
      </section>

      {err ? (
        <div role="alert" className="border border-signal/40 bg-black/40 p-3 text-xs uppercase tracking-widest2 text-signal">
          {err}
        </div>
      ) : null}
    </div>
  );
}
