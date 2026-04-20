export function Badge({ children, tone = 'gold' }) {
  const tones = {
    gold: 'border-gold text-gold',
    mute: 'border-line text-mute',
    green: 'border-emerald-500/40 text-emerald-300',
    red: 'border-red-500/40 text-red-300',
  };
  return (
    <span className={`inline-block border px-2 py-0.5 text-[0.65rem] uppercase tracking-widest2 ${tones[tone]}`}>
      {children}
    </span>
  );
}
