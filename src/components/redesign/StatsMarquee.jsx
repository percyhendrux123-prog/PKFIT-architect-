// StatsMarquee — orange marquee + 4-tile stats grid (PKFIT redesign).
import { CountUp, FadeUp, Marquee } from './Effects';

export default function StatsMarquee() {
  const items = [
    'TRAIN HONEST',
    '★',
    'BUILT FOR 50',
    '★',
    'NO BOTS — REAL COACH',
    '★',
    'JOINT-SMART PROGRAMMING',
    '★',
    'RESULTS, NOT REELS',
    '★',
    'PERCY KEITH',
    '★',
  ];

  const tiles = [
    { to: 50, label: 'ROSTER CAP', suffix: '' },
    { to: 12, label: 'YEARS COACHING', suffix: '' },
    { to: 94, label: 'CLIENT RETENTION', suffix: '%' },
    { to: 24, label: 'AI COACH ON CALL', suffix: '/7' },
  ];

  return (
    <section
      style={{
        background: '#FF5B1F',
        color: '#0A0A0B',
        padding: 0,
        borderTop: '1px solid #1C1C20',
        borderBottom: '1px solid #1C1C20',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '28px 0' }}>
        <Marquee speed={40}>
          {items.map((t, i) => (
            <span
              key={i}
              className="display"
              style={{
                fontSize: 'clamp(40px, 6vw, 96px)',
                lineHeight: 1,
                padding: '0 32px',
                display: 'inline-block',
              }}
            >
              {t}
            </span>
          ))}
        </Marquee>
      </div>

      <div
        style={{
          borderTop: '1px solid rgba(10,10,11,.2)',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          textAlign: 'left',
        }}
      >
        {tiles.map((t, i) => (
          <FadeUp key={i} delay={i * 80}>
            <div
              style={{
                padding: '32px 28px',
                borderRight: i < 3 ? '1px solid rgba(10,10,11,.2)' : 0,
              }}
            >
              <div className="display" style={{ fontSize: 'clamp(48px, 5vw, 84px)', lineHeight: 1 }}>
                <CountUp to={t.to} suffix={t.suffix} />
              </div>
              <div className="mono" style={{ fontSize: 11, marginTop: 8, opacity: 0.7 }}>
                {t.label}
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </section>
  );
}
