// HomeScreen — Dashboard hero in PKFIT redesign visual language.
// Receives real bound data via props (streak, weight, today's session, coach note, profile).
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { photos } from '../../../lib/assets';

export default function HomeScreen({
  greeting = 'Welcome back',
  weekLabel = '',
  initials = 'PK',
  streakDays = 0,
  weekChecks = [false, false, false, false, false, false, false],
  todaySession,
  quickStats = [],
  coachNote,
  coachAvatar,
}) {
  return (
    <div className="redesign-screen" style={{ padding: '20px 22px 100px' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 20,
        }}
      >
        <div>
          <div className="mono" style={{ color: '#8E8E96', fontSize: 10 }}>
            {weekLabel || 'PKFIT.APP'}
          </div>
          <div className="display" style={{ fontSize: 28, marginTop: 4 }}>
            {greeting}
          </div>
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            background: 'linear-gradient(135deg,#FF5B1F,#C7421A)',
            display: 'grid',
            placeItems: 'center',
            fontFamily: 'var(--display)',
            fontSize: 14,
            color: '#0A0A0B',
          }}
        >
          {initials}
        </div>
      </div>

      {/* Streak */}
      <div className="card" style={{ background: '#131316', padding: 18, marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="mono" style={{ color: '#8E8E96' }}>CURRENT STREAK</div>
            <div className="display" style={{ fontSize: 56, lineHeight: 1, marginTop: 8 }}>
              {streakDays}
              <span style={{ color: '#FF5B1F' }}>·</span>
              <span style={{ fontSize: 22, color: '#8E8E96' }}>DAYS</span>
            </div>
          </div>
          <Icon name="flame" size={28} color="#FF5B1F" />
        </div>
        <div style={{ display: 'flex', gap: 4, marginTop: 16 }}>
          {weekChecks.slice(0, 7).map((on, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 3,
                background: on ? '#FF5B1F' : '#2A2A30',
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 8,
            fontFamily: 'var(--mono)',
            fontSize: 9,
            color: '#8E8E96',
            letterSpacing: '.15em',
          }}
        >
          <span>M</span>
          <span>T</span>
          <span>W</span>
          <span>T</span>
          <span>F</span>
          <span>S</span>
          <span>S</span>
        </div>
      </div>

      {/* Today's session */}
      {todaySession ? (
        <>
          <div className="mono" style={{ color: '#8E8E96', marginTop: 22, marginBottom: 10 }}>
            TODAY'S SESSION
          </div>
          <Link
            to={todaySession.to || '/workouts'}
            className="card"
            style={{
              position: 'relative',
              padding: 0,
              marginBottom: 14,
              cursor: 'pointer',
              background: `url(${todaySession.image || photos.bicep}) center/cover`,
              minHeight: 220,
              display: 'block',
              textDecoration: 'none',
              color: 'inherit',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,.1), rgba(0,0,0,.85))',
              }}
            />
            <div
              style={{
                position: 'relative',
                padding: 18,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                color: '#F4F1EA',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="pill pill-accent">{todaySession.tag || 'TODAY'}</span>
                {todaySession.duration ? (
                  <span className="pill">
                    <Icon name="timer" size={11} /> {todaySession.duration}
                  </span>
                ) : null}
              </div>
              <div style={{ marginTop: 80 }}>
                <div className="display" style={{ fontSize: 38, lineHeight: 0.92 }}>
                  {todaySession.title}
                </div>
                {todaySession.subtitle ? (
                  <div
                    style={{
                      display: 'flex',
                      gap: 14,
                      marginTop: 12,
                      fontSize: 12,
                      color: 'rgba(244,241,234,.75)',
                    }}
                  >
                    <span>{todaySession.subtitle}</span>
                  </div>
                ) : null}
              </div>
            </div>
          </Link>
        </>
      ) : null}

      {/* Quick stats */}
      {quickStats.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {quickStats.map((s, i) => (
            <div key={i} className="card" style={{ background: '#131316', padding: 14 }}>
              <div className="mono" style={{ color: '#8E8E96', fontSize: 9 }}>
                {String(s.label).toUpperCase()}
              </div>
              <div className="display" style={{ fontSize: 26, marginTop: 6 }}>
                {s.value}
                {s.unit ? (
                  <span style={{ fontSize: 12, color: '#8E8E96', marginLeft: 4 }}>{s.unit}</span>
                ) : null}
              </div>
              {s.delta ? (
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    color: String(s.delta).startsWith('-') ? '#4ADE80' : '#FF5B1F',
                    marginTop: 4,
                  }}
                >
                  {s.delta}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Coach card */}
      {coachNote ? (
        <>
          <div className="mono" style={{ color: '#8E8E96', marginTop: 22, marginBottom: 10 }}>
            FROM PERCY
          </div>
          <div
            className="card"
            style={{ background: '#131316', padding: 16, display: 'flex', gap: 12 }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 999,
                background: `url(${coachAvatar || photos.front}) center/cover`,
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>{coachNote}</div>
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <Link to="/inbox" className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 11 }}>
                  Reply
                </Link>
                <Link to="/inbox" className="btn btn-ghost" style={{ padding: '8px 14px', fontSize: 11 }}>
                  Voice note
                </Link>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
