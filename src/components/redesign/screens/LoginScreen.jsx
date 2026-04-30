// LoginScreen — controlled login surface in PKFIT redesign visual language.
// Existing auth handlers are passed in via props so Supabase signIn flow stays intact.
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';

export default function LoginScreen({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  busy = false,
  error = null,
  isSupabaseConfigured = true,
  signupHref = '/signup',
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0A0A0B',
        color: '#F4F1EA',
        display: 'flex',
        flexDirection: 'column',
        padding: '32px 24px 28px',
        maxWidth: 480,
        margin: '0 auto',
      }}
    >
      <div className="mono" style={{ color: '#FF5B1F' }}>● PKFIT.APP</div>
      <div className="display" style={{ fontSize: 36, marginTop: 28, lineHeight: 0.92 }}>
        WELCOME
        <br />
        BACK.
      </div>

      <form onSubmit={onSubmit} style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => onEmailChange?.(e.target.value)}
          placeholder="Email"
          className="input"
          aria-label="Email"
        />
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => onPasswordChange?.(e.target.value)}
          placeholder="Password"
          className="input"
          aria-label="Password"
        />

        {error ? (
          <div
            role="alert"
            style={{
              fontFamily: 'var(--mono)',
              fontSize: 11,
              color: '#EF4444',
              letterSpacing: '.1em',
              textTransform: 'uppercase',
              marginTop: 4,
            }}
          >
            {error}
          </div>
        ) : null}

        {!isSupabaseConfigured ? (
          <div
            style={{
              border: '1px solid #2A2A30',
              padding: 12,
              fontSize: 11,
              color: '#8E8E96',
              fontFamily: 'var(--mono)',
              letterSpacing: '.05em',
            }}
          >
            Supabase environment not set. Sign-in is inactive.
          </div>
        ) : null}

        <Link
          to="/signup"
          style={{
            color: '#FF5B1F',
            fontSize: 12,
            marginTop: 14,
            textDecoration: 'none',
            fontFamily: 'var(--mono)',
            letterSpacing: '.1em',
            textTransform: 'uppercase',
          }}
        >
          Forgot password?
        </Link>

        <div style={{ minHeight: 32 }} />

        <button
          type="submit"
          disabled={busy || !isSupabaseConfigured}
          className="btn btn-primary pkfit-sheen"
          style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
        >
          {busy ? 'Signing in…' : 'Sign in'} <Icon name="arrow" size={14} />
        </button>
      </form>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 18 }}>
        <div style={{ flex: 1, height: 1, background: '#1C1C20' }} />
        <span className="mono" style={{ color: '#8E8E96' }}>OR</span>
        <div style={{ flex: 1, height: 1, background: '#1C1C20' }} />
      </div>

      <Link
        to={signupHref}
        className="btn btn-ghost"
        style={{ width: '100%', justifyContent: 'center', padding: '14px', marginTop: 14 }}
      >
        Create an account <Icon name="arrow" size={14} />
      </Link>

      <div style={{ flex: 1 }} />

      <Link
        to="/"
        style={{
          marginTop: 24,
          color: '#8E8E96',
          fontFamily: 'var(--mono)',
          fontSize: 10,
          letterSpacing: '.15em',
          textTransform: 'uppercase',
          textDecoration: 'none',
        }}
      >
        ← Back
      </Link>
    </div>
  );
}
