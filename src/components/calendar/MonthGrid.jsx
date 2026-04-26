import { addDays, isSameDay, isSameMonth, monthGrid, ymd } from '../../lib/dateUtils';
import { EventChip } from './EventChip';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TODAY = new Date();

export function MonthGrid({ cursor, eventsByDay, onSelectDay, onDropOnDay }) {
  const cells = monthGrid(cursor);

  function allowDrop(e) {
    if (e.dataTransfer.types.includes('application/x-pkfit-event')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(e, day) {
    const raw = e.dataTransfer.getData('application/x-pkfit-event');
    if (!raw) return;
    e.preventDefault();
    try {
      onDropOnDay?.(JSON.parse(raw), day);
    } catch {
      /* swallow malformed payloads */
    }
  }

  return (
    <div className="grid grid-cols-7 gap-px bg-line text-ink">
      {WEEKDAY_LABELS.map((d) => (
        <div
          key={d}
          className="bg-bg py-2 text-center text-[0.6rem] uppercase tracking-widest2 text-faint"
        >
          {d}
        </div>
      ))}
      {cells.map((day) => {
        const inMonth = isSameMonth(day, cursor);
        const isToday = isSameDay(day, TODAY);
        const events = eventsByDay[ymd(day)] ?? [];
        const visible = events.slice(0, 3);
        const overflow = events.length - visible.length;
        return (
          <button
            key={day.toISOString()}
            type="button"
            onClick={() => onSelectDay?.(day)}
            onDragOver={allowDrop}
            onDrop={(e) => handleDrop(e, day)}
            className={`flex min-h-[88px] flex-col gap-1 bg-bg p-1.5 text-left transition-colors hover:bg-black/40 ${
              inMonth ? '' : 'text-faint opacity-50'
            } ${isToday ? 'ring-1 ring-inset ring-gold' : ''}`}
            aria-label={`${day.toDateString()} (${events.length} events)`}
          >
            <span className="self-start text-[0.7rem] tabular-nums">
              {day.getDate()}
            </span>
            <div className="flex flex-col gap-0.5">
              {visible.map((ev, i) => (
                <EventChip key={`${ev.type}-${ev.id}-${i}`} event={ev} compact draggable={ev.draggable} />
              ))}
              {overflow > 0 ? (
                <span className="text-[0.55rem] uppercase tracking-widest2 text-faint">
                  +{overflow} more
                </span>
              ) : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}
