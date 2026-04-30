import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import LoginScreen from '../../components/redesign/screens/LoginScreen';

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
      // Preserve d2ac6ce's iPhone-style /home post-login destination.
      const dest = location.state?.from || '/home';
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
    <LoginScreen
      email={email}
      password={password}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={onSubmit}
      busy={busy}
      error={err}
      isSupabaseConfigured={isSupabaseConfigured}
    />
  );
}
