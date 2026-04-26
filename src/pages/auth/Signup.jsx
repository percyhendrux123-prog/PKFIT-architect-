import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CURRENT } from '../../lib/legalVersions';

export default function Signup() {
  const { signUp, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tos, setTos] = useState(false);
  const [coaching, setCoaching] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sent, setSent] = useState(false);

  const consentReady = tos && coaching && privacy;

  async function onSubmit(e) {
    e.preventDefault();
    if (!consentReady) {
      setErr('Read and accept all three agreements to continue.');
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      // Pass consent versions through user metadata. Onboarding (or
      // /update-profile after first login) writes the row to profiles.consent
      // with timestamp + UA — auth signup itself can't write to other tables.
      await signUp(email, password, { name, consent: CURRENT });
      setSent(true);
    } catch (e) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('already in use')) {
        setErr('This email already has an account. Sign in instead.');
      } else if (msg.includes('weak') || msg.includes('short')) {
        setErr('Password is too weak. Use at least eight characters.');
      } else if (msg.includes('rate')) {
        setErr('Too many attempts. Wait a minute, then try again.');
      } else {
        setErr(e?.message ?? 'Could not create the account.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="label mb-6 inline-block py-1">← Back</Link>
      <h1 className="font-display text-4xl tracking-wider2 text-gold">Create account</h1>
      <p className="mt-2 text-sm text-mute">Enter the system. No noise, no hype.</p>

      {sent ? (
        <div className="mt-8 space-y-4 border border-line bg-black/40 p-5">
          <div className="label">Check your email</div>
          <p className="text-sm text-mute">
            Confirmation sent to <span className="text-gold">{email}</span>. Click the link, then return here to finish onboarding.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={() => navigate('/onboarding', { replace: true })}>
              Continue to onboarding
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/login')}>
              Sign in
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Input label="Name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            label="Password"
            type="password"
            minLength={8}
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-[0.65rem] uppercase tracking-widest2 text-faint">Eight characters minimum.</p>

          <fieldset className="space-y-2 border border-line bg-black/30 p-3 text-xs text-mute">
            <legend className="px-1 label">Agreements</legend>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={tos}
                onChange={(e) => setTos(e.target.checked)}
                className="mt-0.5 accent-gold"
                required
              />
              <span>
                I have read and accept the{' '}
                <Link to="/legal/terms" target="_blank" className="text-gold underline">
                  Terms of Service
                </Link>
                .
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={coaching}
                onChange={(e) => setCoaching(e.target.checked)}
                className="mt-0.5 accent-gold"
                required
              />
              <span>
                I have read and accept the{' '}
                <Link to="/legal/coaching" target="_blank" className="text-gold underline">
                  Coaching Agreement
                </Link>
                , including the assumption of risk.
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={privacy}
                onChange={(e) => setPrivacy(e.target.checked)}
                className="mt-0.5 accent-gold"
                required
              />
              <span>
                I have read the{' '}
                <Link to="/legal/privacy" target="_blank" className="text-gold underline">
                  Privacy Policy
                </Link>{' '}
                and consent to the processing described.
              </span>
            </label>
          </fieldset>

          {err ? <div role="alert" className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}
          {!isSupabaseConfigured ? (
            <div className="border border-line p-3 text-xs text-faint">Supabase environment not set. Signup is inactive.</div>
          ) : null}
          <Button type="submit" disabled={busy || !isSupabaseConfigured || !consentReady} className="w-full">
            {busy ? 'Creating' : 'Create account'}
          </Button>
        </form>
      )}

      <div className="mt-6 text-xs uppercase tracking-widest2 text-faint">
        Have an account? <Link to="/login" className="text-gold">Sign in</Link>
      </div>
    </div>
  );
}
