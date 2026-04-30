// SplashScreen — full-bleed entry surface in PKFIT redesign style.
// Used by the public Splash route as a brand intro.
import { Link } from 'react-router-dom';
import { photos } from '../../../lib/assets';

export default function SplashScreen({
  primary = { to: '/signup', label: 'Get started' },
  secondary = { to: '/login', label: 'I have an account' },
}) {
  return (
    <div
      style={{
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        background: '#0A0A0B',
        color: '#F4F1EA',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `url(${photos.profile}) center/cover`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(10,10,11,.3) 0%, rgba(10,10,11,.95) 80%)',
        }}
      />
      <div
        style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '30px 24px 40px',
          maxWidth: 520,
          margin: '0 auto',
        }}
      >
        <div>
          <div className="mono" style={{ color: '#FF5B1F' }}>● PKFIT.APP</div>
        </div>
        <div>
          <div className="mono" style={{ color: 'rgba(244,241,234,.6)' }}>
            COACHED BY PERCY KEITH
          </div>
          <div
            className="display"
            style={{ fontSize: 'clamp(48px, 12vw, 72px)', lineHeight: 0.88, marginTop: 12 }}
          >
            DO THE
            <br />
            HARD
            <br />
            <span style={{ color: '#FF5B1F' }}>THING.</span>
          </div>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link
              to={primary.to}
              className="btn btn-primary pkfit-sheen"
              style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
            >
              {primary.label}
            </Link>
            <Link
              to={secondary.to}
              className="btn btn-ghost"
              style={{ width: '100%', justifyContent: 'center', padding: '16px' }}
            >
              {secondary.label}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
