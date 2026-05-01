// Bare-bones sparkline. No library, just SVG. Accepts an array of numbers.

export function Sparkline({ values, width = 160, height = 40, className = '' }) {
  const clean = (values ?? []).filter((v) => Number.isFinite(v));
  if (clean.length < 2) {
    return (
      <div
        className={`border border-line bg-black/30 text-[0.55rem] uppercase tracking-widest2 text-faint ${className}`}
        style={{ width, height }}
      >
        <div className="flex h-full items-center justify-center">not enough data</div>
      </div>
    );
  }
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const step = width / (clean.length - 1);
  const points = clean
    .map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / range) * height).toFixed(1)}`)
    .join(' ');
  const last = clean[clean.length - 1];
  const lastX = (clean.length - 1) * step;
  const lastY = height - ((last - min) / range) * height;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label="Trend"
      className={className}
    >
      <polyline points={points} fill="none" stroke="#F5F1E8" strokeWidth="1.5" />
      <circle cx={lastX} cy={lastY} r="2.5" fill="#F5F1E8" />
    </svg>
  );
}
