export function Button({ as: Tag = 'button', variant = 'primary', className = '', children, ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 px-5 py-3 font-display tracking-wider2 text-sm uppercase transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-gold text-bg hover:bg-[#d8b658] pkfit-sheen',
    ghost: 'border border-line text-ink hover:border-gold',
    danger: 'border border-signal/40 text-signal hover:border-signal/80',
    bare: 'text-ink hover:text-gold',
  };
  return (
    <Tag className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </Tag>
  );
}
