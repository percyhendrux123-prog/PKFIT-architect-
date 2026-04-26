export function Badge({ children, tone = 'gold' }) {
  const tones = {
    gold: 'border-gold text-gold',
    mute: 'border-line text-mute',
    green: 'border-success/40 text-success',
    red: 'border-signal/40 text-signal',
  };
  return (
    <span className={`inline-block border px-2 py-0.5 text-[0.65rem] uppercase tracking-widest2 ${tones[tone]}`}>
      {children}
    </span>
  );
}
