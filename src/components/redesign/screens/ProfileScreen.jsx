// ProfileScreen — profile header + stat tiles + settings list (PKFIT redesign).
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';

const defaultLinks = [
  { i: 'bell', l: 'Notifications', to: '/settings' },
  { i: 'calendar', l: 'Schedule', to: '/calendar' },
  { i: 'ruler', l: 'Units & metrics', to: '/settings' },
  { i: 'moon', l: 'Appearance', to: '/settings' },
  { i: 'user', l: 'Account', to: '/settings' },
];

export default function ProfileScreen({
  initials = 'PK',
  name = 'PERCY',
  memberMeta = '',
  tiles = [],
  links = defaultLinks,
  signOutLabel = 'Sign out',
  onSignOut,
}) {
  return (
    <div
      style={{
        padding: '20px 22px 100px',
        background: '#0A0A0B',
        color: '#F4F1EA',
        borderRadius: 18,
        border: '1px solid #1C1C20',
      }}
    >
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 999,
            background: 'linear-gradient(135deg,#FF5B1F,#C7421A)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--display)',
            fontSize: 24,
            color: '#0A0A0B',
          }}
        >
          {initials}
        </div>
        <div>
          <div className="display" style={{ fontSize: 22 }}>{name}</div>
          {memberMeta ? (
            <div className="mono" style={{ color: '#8E8E96', fontSize: 10, marginTop: 4 }}>
              {memberMeta}
            </div>
          ) : null}
        </div>
      </div>

      {tiles.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${Math.min(tiles.length, 3)}, 1fr)`,
            gap: 8,
            marginTop: 22,
          }}
        >
          {tiles.map((t, i) => (
            <div
              key={i}
              className="card"
              style={{ background: '#131316', padding: 14, textAlign: 'center' }}
            >
              <div className="display" style={{ fontSize: 26 }}>{t.value}</div>
              <div className="mono" style={{ color: '#8E8E96', fontSize: 9, marginTop: 4 }}>
                {String(t.label).toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mono" style={{ color: '#8E8E96', marginTop: 24, marginBottom: 6 }}>
        SETTINGS
      </div>
      {links.map((r, i) => (
        <Link
          key={i}
          to={r.to || '/settings'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '16px 0',
            borderBottom: '1px solid #1C1C20',
            cursor: 'pointer',
            color: 'inherit',
            textDecoration: 'none',
          }}
        >
          <Icon name={r.i} size={18} color="#8E8E96" />
          <span style={{ flex: 1 }}>{r.l}</span>
          <Icon name="arrow" size={14} color="#8E8E96" />
        </Link>
      ))}

      {onSignOut ? (
        <button
          type="button"
          onClick={onSignOut}
          className="btn btn-ghost"
          style={{ marginTop: 22, width: '100%', justifyContent: 'center' }}
        >
          {signOutLabel}
        </button>
      ) : null}
    </div>
  );
}
