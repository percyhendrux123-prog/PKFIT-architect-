// HomeScreen — Dashboard hero in PKFIT redesign visual language.
// Receives real bound data via props (streak, weight, today's session, coach note, profile).
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../Icon';
import { photos } from '../../../lib/assets';
import CursorAwareCard from '../../CursorAwareCard';
import { revealDelay, firePulse } from '../../../lib/motion';

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
  // Streak-counter pulse on log: when streakDays increments (i.e. a session
  // was just marked complete), fire a 420ms gold pulse on the number.
  const streakRef = useRef(null);
  const prevStreak = useRef(streakDays);
  useEffect(() => {
    if (streakDays > prevStreak.current) firePulse(streakRef.current);
    prevStreak.current = streakDays;
  }, [streakDays]);

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
      <CursorAwareCard
        className="card pkfit-reveal"
        style={{ background: '#131316', padding: 18, marginBottom: 14, ...revealDelay(0) }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="mono" style={{ color: '#8E8E96' }}>CURRENT STREAK</div>
            {/* polish 2026-05-01: flex+baseline alignment so DAYS sits cleanly against the 64px digit */}
            <div
              ref={streakRef}
              className="display pkfit-streak-pulse pkfit-num-dominant"
              style={{ fontSize: 64, lineHeight: 1, marginTop: 8, fontWeight: 600, display: 'flex', alignItems: 'baseline', gap: 8 }}
            >
              <span>{streakDays}</span>
              <span style={{ color: '#FF5B1F' }}>·</span>
              <span style={{ fontSize: 22, color: '#8E8E96', fontWeight: 400 }}>DAYS</span>
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
      </CursorAwareCard>

      {/* Today's session */}
      {todaySession ? (
        <>
          <div className="mono" style={{ color: '#8E8E96', marginTop: 22, marginBottom: 10 }}>
            TODAY'S SESSION
          </div>
          <Link
            to={todaySession.to || '/workouts'}
            className="card pkfit-rim pkfit-reveal"
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
              ...revealDelay(2),
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
            <CursorAwareCard
              key={i}
              className="card pkfit-reveal"
              style={{ background: '#131316', padding: 14, ...revealDelay(3 + i) }}
            >
              <div className="mono" style={{ color: '#8E8E96', fontSize: 9 }}>
                {String(s.label).toUpperCase()}
              </div>
              <div
                className="display pkfit-num-dominant"
                style={{ fontSize: 32, marginTop: 6, fontWeight: 600 }}
              >
                {s.value}
                {s.unit ? (
                  <span style={{ fontSize: 12, color: '#8E8E96', marginLeft: 4, fontWeight: 400 }}>{s.unit}</span>
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
            </CursorAwareCard>
          ))}
        </div>
      ) : null}

      {/* Coach card */}
      {coachNote ? (
        <>
          <div className="mono" style={{ color: '#8E8E96', marginTop: 22, marginBottom: 10 }}>
            FROM PERCY
          </div>
          <CursorAwareCard
            className="card"
            style={{ background: '#131316', padding: 16, display: 'flex', gap: 12 }}
          >
            <div
              className="pkfit-rim"
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
              {/* polish 2026-05-01: removed Voice note CTA (no capture flow wired; it routed to /inbox same as Reply) */}
              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <Link to="/inbox" className="btn btn-primary pkfit-sheen" style={{ padding: '8px 14px', fontSize: 11 }}>
                  Reply
                </Link>
              </div>
            </div>
          </CursorAwareCard>
        </>
      ) : null}
    </div>
  );
}
