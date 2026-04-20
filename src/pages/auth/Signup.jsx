import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export default function Signup() {
  const { signUp, isSupabaseConfigured } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [sent, setSent] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await signUp(email, password, { name });
      setSent(true);
      setTimeout(() => navigate('/onboarding', { replace: true }), 1200);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <Link to="/" className="label mb-6">← Back</Link>
      <h1 className="font-display text-4xl tracking-wider2 text-gold">Create account</h1>
      <p className="mt-2 text-sm text-mute">Enter the system. No noise, no hype.</p>

      {sent ? (
        <div className="mt-8 border border-line bg-black/40 p-5">
          <div className="label mb-2">Check your email</div>
          <p className="text-sm text-mute">Confirmation sent. Redirecting to onboarding.</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <Input label="Name" autoComplete="name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Password" type="password" minLength={8} autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          {err ? <div className="text-xs uppercase tracking-widest2 text-red-300">{err}</div> : null}
          {!isSupabaseConfigured ? (
            <div className="border border-line p-3 text-xs text-faint">Supabase environment not set. Signup is inactive.</div>
          ) : null}
          <Button type="submit" disabled={busy || !isSupabaseConfigured} className="w-full">
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
