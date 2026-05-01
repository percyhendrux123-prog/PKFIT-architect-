import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

// Self-serve client migration landing page. Single-route experience that
// progresses through three internal phases:
//
//   1. hero      — "Welcome back, [first name]" + AI coach pitch
//   2. confirm   — side-by-side comparison + consent checkbox + CTA
//   3. welcome   — "AI coach unlocked" success screen
//
// Public route (no auth wrapper). The token in the URL IS the auth — the
// validate function rejects unknown / expired tokens. Mobile-first; the
// hero stack is single-column up through the confirm stage.

const FN_BASE = '/.netlify/functions';

async function postJson(path, payload) {
  const res = await fetch(`${FN_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  let body;
  try { body = await res.json(); } catch { body = {}; }
  return { ok: res.ok, status: res.status, body };
}

function CenterShell({ children }) {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <div className="mx-auto max-w-xl px-5 py-10 md:py-16">{children}</div>
    </div>
  );
}

function Header() {
  return (
    <div className="mb-10 flex items-center justify-between">
      <div className="font-display text-2xl tracking-wider2 text-gold">PKFIT</div>
      <div className="label">Migration · Wave 1</div>
    </div>
  );
}

function ErrorState({ status, body }) {
  let title = 'This link does not resolve.';
  let detail = 'Reply to your email from Percy and he will send a fresh one.';
  if (status === 410 || body?.expired) {
    title = 'This link has expired.';
    detail = 'These early-access links live 14 days. Reply to your email and Percy will issue a new one.';
  } else if (status === 409 && body?.already_complete) {
    title = 'You are already on PKFIT.';
    detail = 'Your migration completed. Sign in to keep going.';
  } else if (status === 409) {
    title = 'This migration needs a hand.';
    detail = 'Percy was alerted and will reach out. Nothing on your side is broken.';
  }
  return (
    <CenterShell>
      <Header />
      <h1 className="font-display text-4xl leading-tight tracking-wider2 text-gold">{title}</h1>
      <p className="mt-4 text-mute">{detail}</p>
      <Link to="/login" className="mt-8 inline-block border border-line px-5 py-3 font-display tracking-wider2 text-ink hover:border-gold">
        Sign in
      </Link>
    </CenterShell>
  );
}

function Loading() {
  return (
    <CenterShell>
      <Header />
      <p className="label">Resolving your link…</p>
    </CenterShell>
  );
}

function HeroPanel({ data, onContinue }) {
  return (
    <CenterShell>
      <Header />
      <div className="label mb-3">Welcome back</div>
      <h1 className="font-display text-[clamp(2.5rem,8vw,4.5rem)] leading-[0.95] tracking-wider2 text-gold">
        {data.client.first_name}, your<br />AI coach is ready.
      </h1>
      <p className="mt-6 max-w-reading text-[clamp(1rem,2vw,1.15rem)] leading-relaxed text-ink/90">
        Form check on demand. Instant programming adjustments. A canvas of your progress. Early access — this month, moved clients only.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-px border border-line bg-line">
        <div className="bg-bg p-5">
          <div className="font-display text-3xl tracking-wider2 text-gold">01</div>
          <p className="mt-2 text-sm text-mute">Form check, 24/7. Film a set, get notes back in seconds — between when you train and when you would next hear from me.</p>
        </div>
        <div className="bg-bg p-5">
          <div className="font-display text-3xl tracking-wider2 text-gold">02</div>
          <p className="mt-2 text-sm text-mute">Instant adjustments. Logged a session that crushed you, or one where the weights flew. It tunes next session before you ask.</p>
        </div>
        <div className="bg-bg p-5">
          <div className="font-display text-3xl tracking-wider2 text-gold">03</div>
          <p className="mt-2 text-sm text-mute">Your own progress canvas. Every metric in one view. Not a dashboard — a picture you can see.</p>
        </div>
      </div>

      <div className="mt-8 border border-line bg-bg p-5">
        <div className="label mb-1">Trust signal</div>
        <p className="text-sm text-ink/90">
          Your rate stays exactly where it is. Same plan. Same me. Plus the AI coach.
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="mt-10 inline-flex w-full items-center justify-center border border-gold bg-gold px-6 py-4 font-display tracking-wider2 text-bg transition-colors hover:bg-[#E5DDC9]"
      >
        Get early access →
      </button>

      <details className="mt-10 border-t border-line pt-6">
        <summary className="cursor-pointer font-display tracking-wider2 text-ink">What moves with you</summary>
        <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-sm">
          <dt className="text-faint">Plan</dt><dd className="text-ink">Same as today</dd>
          <dt className="text-faint">Coach</dt><dd className="text-ink">Percy Stewart</dd>
          <dt className="text-faint">Rate</dt><dd className="text-ink">${data.plan.rate_usd ?? '—'}/{data.plan.interval ?? 'mo'}</dd>
          <dt className="text-faint">Next bill</dt><dd className="text-ink">{data.plan.anchor_date ?? '—'}</dd>
          <dt className="text-faint">History</dt><dd className="text-ink">All workouts, check-ins, photos, DMs — moved.</dd>
        </dl>
      </details>

      <details className="mt-6 border-t border-line pt-6">
        <summary className="cursor-pointer font-display tracking-wider2 text-ink">FAQ</summary>
        <div className="mt-4 space-y-4 text-sm text-mute">
          <p><span className="text-ink">What is the AI coach, exactly?</span> A tool inside PKFIT that gives you instant feedback between our touchpoints. Film a set, get form notes. Log a session, get adjustments. Ask &ldquo;show me my last 4 weeks&rdquo; and you get a clean visual.</p>
          <p><span className="text-ink">What happens to my Trainerize data?</span> Already moved. Workouts, check-ins, photos, our DM history.</p>
          <p><span className="text-ink">When does my old subscription end?</span> {data.plan.next_renewal_date ?? '—'}. That is also the day your first PKFIT charge fires. No double charge.</p>
          <p><span className="text-ink">Can I cancel?</span> Yes, anytime, same terms as before. Manage it under Account → Billing.</p>
          <p><span className="text-ink">Will I be double-charged?</span> No. The transfer is timed so PKFIT picks up exactly where Trainerize leaves off.</p>
        </div>
      </details>

      <p className="mt-12 text-center text-xs uppercase tracking-widest2 text-faint">
        Built and signed by Percy Stewart · coach@pkfit.app
      </p>
    </CenterShell>
  );
}

function ConfirmPanel({ data, onConfirm, busy, error }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <CenterShell>
      <Header />
      <div className="label mb-3">One last step</div>
      <h1 className="font-display text-[clamp(2rem,6vw,3.5rem)] leading-[0.95] tracking-wider2 text-gold">
        Confirm and your AI coach unlocks the moment your billing transfers.
      </h1>

      <div className="mt-8 grid grid-cols-1 gap-px border border-line bg-line md:grid-cols-2">
        <div className="bg-bg p-5">
          <div className="label">Trainerize</div>
          <p className="mt-1 text-xs text-faint">ends {data.plan.next_renewal_date ?? '—'}</p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-faint">Rate</dt><dd>${data.plan.rate_usd ?? '—'}/{data.plan.interval ?? 'mo'}</dd></div>
            <div className="flex justify-between"><dt className="text-faint">Plan</dt><dd>Same</dd></div>
            <div className="flex justify-between"><dt className="text-faint">Coach</dt><dd>Percy</dd></div>
            <div className="flex justify-between"><dt className="text-faint">AI coach</dt><dd>—</dd></div>
          </dl>
        </div>
        <div className="bg-bg p-5">
          <div className="label text-gold">PKFIT</div>
          <p className="mt-1 text-xs text-faint">starts {data.plan.anchor_date ?? '—'}</p>
          <dl className="mt-4 space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-faint">Rate</dt><dd>${data.plan.rate_usd ?? '—'}/{data.plan.interval ?? 'mo'}</dd></div>
            <div className="flex justify-between"><dt className="text-faint">Plan</dt><dd>Same</dd></div>
            <div className="flex justify-between"><dt className="text-faint">Coach</dt><dd>Percy</dd></div>
            <div className="flex justify-between"><dt className="text-faint">AI coach</dt><dd className="text-gold">+ early access</dd></div>
          </dl>
        </div>
      </div>

      <label className="mt-8 flex cursor-pointer items-start gap-3 border border-line p-4 text-sm text-ink/90">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 h-4 w-4 accent-gold"
          aria-label="Authorize migration"
        />
        <span>{data.consent_text}</span>
      </label>

      {error ? (
        <div role="alert" className="mt-4 border border-signal/50 bg-bg p-3 text-sm text-signal">
          {error}
        </div>
      ) : null}

      <button
        type="button"
        disabled={!agreed || busy}
        onClick={() => onConfirm(data.consent_text)}
        className="mt-6 inline-flex w-full items-center justify-center border border-gold bg-gold px-6 py-4 font-display tracking-wider2 text-bg transition-colors hover:bg-[#E5DDC9] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? 'Unlocking your AI coach…' : 'Unlock my AI coach →'}
      </button>

      <p className="mt-6 text-center text-xs text-faint">
        No double charge. Your card stays on file. The transfer fires the moment you click.
      </p>
    </CenterShell>
  );
}

function WelcomePanel({ data }) {
  return (
    <CenterShell>
      <Header />
      <div className="label mb-3 text-success">Done</div>
      <h1 className="font-display text-[clamp(2.25rem,7vw,4rem)] leading-[0.95] tracking-wider2 text-gold">
        You are in.<br />AI coach unlocked.
      </h1>
      <p className="mt-6 max-w-reading text-mute">
        Your billing transfers automatically on {data.plan.next_renewal_date ?? 'the scheduled date'}. No double charge, no card update, no gap. Your data is already inside.
      </p>

      <div className="mt-8 space-y-3">
        <Link
          to="/assistant"
          className="block w-full border border-gold bg-gold px-6 py-4 text-center font-display tracking-wider2 text-bg transition-colors hover:bg-[#E5DDC9]"
        >
          Try your AI coach now
        </Link>
        <Link
          to="/dashboard"
          className="block w-full border border-line px-6 py-4 text-center font-display tracking-wider2 text-ink transition-colors hover:border-gold"
        >
          Install on your phone
        </Link>
        <Link
          to="/dashboard"
          className="block w-full border border-line px-6 py-4 text-center font-display tracking-wider2 text-ink transition-colors hover:border-gold"
        >
          60-second tour
        </Link>
      </div>

      <p className="mt-12 text-center text-xs uppercase tracking-widest2 text-faint">
        Confirmation email is on its way to {data.client.email}
      </p>
    </CenterShell>
  );
}

function FailedPanel({ reason }) {
  return (
    <CenterShell>
      <Header />
      <div className="label mb-3 text-signal">We hit a snag</div>
      <h1 className="font-display text-[clamp(2rem,6vw,3rem)] leading-tight tracking-wider2 text-gold">
        Percy is handling this manually.
      </h1>
      <p className="mt-6 max-w-reading text-mute">
        Your account is set up but we could not finalize the billing transfer. Percy was notified and will sort it within 24 hours. Your Trainerize subscription is unchanged in the meantime — no action needed from you.
      </p>
      {reason ? (
        <p className="mt-4 text-xs text-faint">Reference: {reason}</p>
      ) : null}
    </CenterShell>
  );
}

export default function Migrate() {
  const { token } = useParams();
  const [phase, setPhase] = useState('loading'); // loading | hero | confirm | welcome | failed | error
  const [data, setData] = useState(null);
  const [errBody, setErrBody] = useState(null);
  const [errStatus, setErrStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirmErr, setConfirmErr] = useState(null);
  const [failureReason, setFailureReason] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const res = await postJson('/migration-token-validate', { token });
      if (cancelled) return;
      if (!res.ok) {
        setErrStatus(res.status);
        setErrBody(res.body);
        if (res.status === 409 && res.body?.already_complete) {
          setPhase('error');
        } else {
          setPhase('error');
        }
        return;
      }
      setData(res.body);
      setPhase('hero');
    }
    run();
    return () => { cancelled = true; };
  }, [token]);

  const onConfirm = async (consentText) => {
    setBusy(true);
    setConfirmErr(null);
    const res = await postJson('/migration-confirm', {
      token,
      consent_checkbox_text: consentText,
    });
    setBusy(false);
    if (res.ok && res.body?.ok) {
      setPhase('welcome');
      return;
    }
    if (res.body?.already_complete) {
      setPhase('welcome');
      return;
    }
    if (res.status === 502 && res.body?.reason) {
      setFailureReason(res.body.reason);
      setPhase('failed');
      return;
    }
    setConfirmErr(res.body?.error || res.body?.reason || 'Could not finalize. Try again.');
  };

  const view = useMemo(() => {
    if (phase === 'loading') return <Loading />;
    if (phase === 'error') return <ErrorState status={errStatus} body={errBody} />;
    if (phase === 'failed') return <FailedPanel reason={failureReason} />;
    if (phase === 'welcome') return <WelcomePanel data={data} />;
    if (phase === 'confirm') return <ConfirmPanel data={data} onConfirm={onConfirm} busy={busy} error={confirmErr} />;
    return <HeroPanel data={data} onContinue={() => setPhase('confirm')} />;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, data, errBody, errStatus, busy, confirmErr, failureReason]);

  return view;
}
