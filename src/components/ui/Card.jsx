export function Card({ className = '', children, ...props }) {
  return (
    <div className={`border border-line bg-black/30 p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ label, title, meta }) {
  return (
    <header className="mb-4 flex items-end justify-between gap-4">
      <div>
        {label ? <div className="label">{label}</div> : null}
        {title ? <h2 className="mt-1 font-display text-3xl tracking-wider2">{title}</h2> : null}
      </div>
      {meta ? <div className="text-xs text-faint">{meta}</div> : null}
    </header>
  );
}
