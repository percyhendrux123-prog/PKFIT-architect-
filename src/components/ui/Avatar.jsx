export function Avatar({ name = '', size = 40 }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '—';
  return (
    <div
      className="flex items-center justify-center border border-line bg-black/50 font-display tracking-wider2 text-gold"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden
    >
      {initials}
    </div>
  );
}
