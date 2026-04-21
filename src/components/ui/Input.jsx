import { useId } from 'react';

export function Input({ label, className = '', ...props }) {
  const id = useId();
  return (
    <div className="block">
      {label ? (
        <label htmlFor={id} className="label mb-2 block">{label}</label>
      ) : null}
      <input
        id={id}
        className={`w-full border border-line bg-black/40 px-4 py-3 font-body text-ink placeholder:text-faint focus:border-gold ${className}`}
        {...props}
      />
    </div>
  );
}

export function Textarea({ label, className = '', rows = 4, ...props }) {
  const id = useId();
  return (
    <div className="block">
      {label ? (
        <label htmlFor={id} className="label mb-2 block">{label}</label>
      ) : null}
      <textarea
        id={id}
        rows={rows}
        className={`w-full resize-y border border-line bg-black/40 px-4 py-3 font-body text-ink placeholder:text-faint focus:border-gold ${className}`}
        {...props}
      />
    </div>
  );
}

export function Select({ label, className = '', children, ...props }) {
  const id = useId();
  return (
    <div className="block">
      {label ? (
        <label htmlFor={id} className="label mb-2 block">{label}</label>
      ) : null}
      <select
        id={id}
        className={`w-full border border-line bg-black/40 px-4 py-3 font-body text-ink focus:border-gold ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
