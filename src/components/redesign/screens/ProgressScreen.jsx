// ProgressScreen — sparkline + body-photos + PR list in PKFIT redesign visual language.
import { photos } from '../../../lib/assets';

export default function ProgressScreen({
  weight = 181.0,
  weightUnit = 'LBS',
  weightDeltaPct = '↓ 0%',
  series = [],
  prs = [],
  progressPhotos = [photos.mirror, photos.front, photos.flex],
  rangeLabel = 'PROGRESS · 12 WEEKS',
  headline = 'PROGRESS',
}) {
  const data = series.length > 0 ? series : [weight, weight, weight];
  const max = Math.max(...data, 0.0001);
  const min = Math.min(...data, max - 0.0001);
  const span = Math.max(0.0001, max - min);
  const norm = (v) => 1 - (v - min) / span;

  return (
    <div
      style={{
        background: '#0A0A0B',
        color: '#F4F1EA',
        borderRadius: 18,
        padding: '20px 22px',
        border: '1px solid #1C1C20',
      }}
    >
      <div className="mono" style={{ color: '#8E8E96' }}>{rangeLabel}</div>
      <div className="display" style={{ fontSize: 36, marginTop: 6 }}>{headline}</div>

      <div className="card" style={{ background: '#131316', padding: 18, marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="mono" style={{ color: '#8E8E96', fontSize: 9 }}>BODY WEIGHT</div>
            <div className="display tnum" style={{ fontSize: 38, marginTop: 4 }}>
              {weight}
              <span style={{ fontSize: 14, color: '#8E8E96' }}> {weightUnit}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="mono" style={{ color: '#4ADE80', fontSize: 10 }}>{weightDeltaPct}</div>
            <div className="mono" style={{ color: '#8E8E96', fontSize: 9, marginTop: 4 }}>
              VS START
            </div>
          </div>
        </div>
        {data.length > 1 ? (
          <svg
            viewBox="0 0 300 100"
            style={{ width: '100%', marginTop: 18, height: 100 }}
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="grad-progress" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5B1F" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#FF5B1F" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d={`M 0 ${norm(data[0]) * 90 + 5} ${data
                .map((v, i) => `L ${(i / (data.length - 1)) * 300} ${norm(v) * 90 + 5}`)
                .join(' ')} L 300 100 L 0 100 Z`}
              fill="url(#grad-progress)"
            />
            <path
              d={`M 0 ${norm(data[0]) * 90 + 5} ${data
                .map((v, i) => `L ${(i / (data.length - 1)) * 300} ${norm(v) * 90 + 5}`)
                .join(' ')}`}
              stroke="#FF5B1F"
              strokeWidth="2"
              fill="none"
            />
            {data.map((v, i) => (
              <circle
                key={i}
                cx={(i / (data.length - 1)) * 300}
                cy={norm(v) * 90 + 5}
                r="2.5"
                fill="#FF5B1F"
              />
            ))}
          </svg>
        ) : null}
      </div>

      {progressPhotos?.length ? (
        <>
          <div className="mono" style={{ color: '#8E8E96', marginTop: 22, marginBottom: 10 }}>
            PROGRESS PHOTOS
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {progressPhotos.slice(0, 3).map((src, i) => (
              <div
                key={i}
                style={{
                  position: 'relative',
                  aspectRatio: '3/4',
                  background: `url(${src}) center/cover`,
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    bottom: 6,
                    left: 6,
                    fontFamily: 'var(--mono)',
                    fontSize: 8,
                    color: '#F4F1EA',
                    letterSpacing: '.1em',
                  }}
                >
                  WK {i * 4 + 1}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {prs.length > 0 ? (
        <>
          <div className="mono" style={{ color: '#8E8E96', marginTop: 22, marginBottom: 10 }}>
            STRENGTH PRS
          </div>
          {prs.map((s, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '14px 0',
                borderBottom: '1px solid #1C1C20',
              }}
            >
              <span style={{ fontFamily: 'var(--display)', fontSize: 18 }}>
                {String(s.lift).toUpperCase()}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span className="tnum" style={{ fontSize: 22, fontWeight: 600 }}>
                  {s.value}
                  <span style={{ fontSize: 11, color: '#8E8E96' }}> {s.unit || ''}</span>
                </span>
                {s.delta ? (
                  <span className="mono" style={{ color: '#4ADE80', fontSize: 10 }}>
                    {s.delta}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
