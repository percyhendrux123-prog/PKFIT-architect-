export function Empty({ title, body, action, eyebrow }) {
  return (
    <div className="border border-line bg-black/20 p-8 text-center">
      {eyebrow ? <div className="label mb-2">{eyebrow}</div> : null}
      <h3 className="font-display text-2xl tracking-wider2">{title}</h3>
      {body ? <p className="mx-auto mt-3 max-w-reading text-sm text-mute">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function Spinner({ label = 'Loading' }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 text-xs uppercase tracking-widest2 text-faint">
      <span className="inline-block h-2 w-2 animate-pulse bg-gold" />
      {label}
    </div>
  );
}

export function Skeleton({ className = '', count = 1 }) {
  if (count <= 1) {
    return <div aria-hidden="true" className={`animate-pulse border border-line bg-black/40 ${className}`} />;
  }
  return (
    <div aria-hidden="true" className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`animate-pulse border border-line bg-black/40 ${className}`} />
      ))}
    </div>
  );
}
