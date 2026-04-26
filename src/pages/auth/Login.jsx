import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function Login() {
  const { signIn, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signIn(email, password);
      const dest = location.state?.from || '/dashboard';
      navigate(dest, { replace: true });
    } catch (e) {
      const msg = (e?.message ?? '').toLowerCase();
      if (msg.includes('invalid login') || msg.includes('credentials')) {
        setErr('Email or password is wrong.');
      } else if (msg.includes('email not confirmed')) {
        setErr('Confirm your email first. Check your inbox.');
      } else if (msg.includes('rate')) {
        setErr('Too many attempts. Wait a minute, then try again.');
      } else {
        setErr(e?.message ?? 'Could not sign in. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="label mb-6 inline-block py-1">← Back</Link>
      <h1 className="font-display text-4xl tracking-wider2 text-gold">Sign in</h1>
      <p className="mt-2 text-sm text-mute">Return to the system.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        {err ? <div role="alert" className="text-xs uppercase tracking-widest2 text-signal">{err}</div> : null}
        {!isSupabaseConfigured ? (
          <div className="border border-line p-3 text-xs text-faint">Supabase environment not set. Sign-in is inactive.</div>
        ) : null}
        <Button type="submit" disabled={busy || !isSupabaseConfigured} className="w-full">
          {busy ? 'Signing in' : 'Sign in'}
        </Button>
      </form>

      <div className="mt-6 text-xs uppercase tracking-widest2 text-faint">
        No account? <Link to="/signup" className="text-gold">Create one</Link>
      </div>
    </div>
  );
}
