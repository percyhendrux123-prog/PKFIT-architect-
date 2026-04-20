export function Input({ label, className = '', ...props }) {
  return (
    <label className="block">
      {label ? <span className="label mb-2 block">{label}</span> : null}
      <input
        className={`w-full border border-line bg-black/40 px-4 py-3 font-body text-ink placeholder:text-faint focus:border-gold ${className}`}
        {...props}
      />
    </label>
  );
}

export function Textarea({ label, className = '', rows = 4, ...props }) {
  return (
    <label className="block">
      {label ? <span className="label mb-2 block">{label}</span> : null}
      <textarea
        rows={rows}
        className={`w-full resize-y border border-line bg-black/40 px-4 py-3 font-body text-ink placeholder:text-faint focus:border-gold ${className}`}
        {...props}
      />
    </label>
  );
}

export function Select({ label, className = '', children, ...props }) {
  return (
    <label className="block">
      {label ? <span className="label mb-2 block">{label}</span> : null}
      <select
        className={`w-full border border-line bg-black/40 px-4 py-3 font-body text-ink focus:border-gold ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}
