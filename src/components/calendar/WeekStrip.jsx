import { isSameDay, weekDates, ymd } from '../../lib/dateUtils';
import { EventChip } from './EventChip';

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TODAY = new Date();

export function WeekStrip({ cursor, eventsByDay, onSelectDay, onDropOnDay }) {
  const days = weekDates(cursor);

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
      /* ignore */
    }
  }

  return (
    <div className="grid grid-cols-7 gap-px bg-line">
      {days.map((day, i) => {
        const events = eventsByDay[ymd(day)] ?? [];
        const isToday = isSameDay(day, TODAY);
        return (
          <div
            key={day.toISOString()}
            onDragOver={allowDrop}
            onDrop={(e) => handleDrop(e, day)}
            className={`flex min-h-[260px] flex-col gap-2 bg-bg p-2 ${
              isToday ? 'ring-1 ring-inset ring-gold' : ''
            }`}
          >
            <button
              type="button"
              onClick={() => onSelectDay?.(day)}
              className="text-left"
            >
              <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                {WEEKDAY_LABELS[i]}
              </div>
              <div className="mt-0.5 font-display text-2xl tracking-wider2 text-gold">
                {day.getDate()}
              </div>
            </button>
            <div className="flex flex-1 flex-col gap-1 overflow-hidden">
              {events.map((ev, idx) => (
                <EventChip key={`${ev.type}-${ev.id}-${idx}`} event={ev} draggable={ev.draggable} />
              ))}
              {events.length === 0 ? (
                <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">—</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
