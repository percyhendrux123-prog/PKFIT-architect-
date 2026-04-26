// Color-coded event chip used in all three calendar views.
// type → color (matches the Quiet Assassin palette)
//   workout    : gold  (planned or completed)
//   meal       : ink   (eaten or planned)
//   habit      : success (a habit checked off that day)
//   check_in   : signal (weekly check-in)
//   program    : faint  (running program rule, not a single event)

const TONE = {
  workout: 'border-gold/60 bg-gold/15 text-gold',
  meal: 'border-line bg-black/40 text-ink',
  habit: 'border-success/60 bg-success/15 text-success',
  check_in: 'border-signal/60 bg-signal/15 text-signal',
  program: 'border-line text-faint',
};

export function EventChip({
  event,
  compact = false,
  draggable = false,
  onDragStart,
  onDragEnd,
}) {
  const tone = TONE[event.type] ?? TONE.program;
  const baseLabel = event.label ?? event.type;
  const label = compact ? baseLabel.slice(0, 14) : baseLabel;
  return (
    <div
      role="listitem"
      draggable={draggable || undefined}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData('application/x-pkfit-event', JSON.stringify(event));
        e.dataTransfer.effectAllowed = 'move';
        onDragStart?.(event);
      }}
      onDragEnd={() => onDragEnd?.(event)}
      title={event.title ?? baseLabel}
      className={`flex items-center gap-1 truncate border ${tone} px-1.5 py-0.5 text-[0.6rem] uppercase tracking-widest2 ${
        draggable ? 'cursor-grab active:cursor-grabbing' : ''
      }`}
    >
      {event.time ? <span className="opacity-70">{event.time}</span> : null}
      <span className="truncate">{label}</span>
    </div>
  );
}
