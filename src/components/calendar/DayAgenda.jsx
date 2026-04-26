import { ymd } from '../../lib/dateUtils';
import { EventChip } from './EventChip';

const SECTION_ORDER = ['workout', 'meal', 'habit', 'check_in', 'program'];
const SECTION_LABEL = {
  workout: 'Training',
  meal: 'Nutrition',
  habit: 'Habits',
  check_in: 'Check-in',
  program: 'Program',
};

export function DayAgenda({ cursor, eventsByDay, onDropOnDay }) {
  const events = eventsByDay[ymd(cursor)] ?? [];
  const sections = {};
  for (const ev of events) (sections[ev.type] ??= []).push(ev);

  function allowDrop(e) {
    if (e.dataTransfer.types.includes('application/x-pkfit-event')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  }

  function handleDrop(e) {
    const raw = e.dataTransfer.getData('application/x-pkfit-event');
    if (!raw) return;
    e.preventDefault();
    try {
      onDropOnDay?.(JSON.parse(raw), cursor);
    } catch {
      /* ignore */
    }
  }

  return (
    <div onDragOver={allowDrop} onDrop={handleDrop} className="space-y-5 border border-line bg-black/20 p-5">
      {events.length === 0 ? (
        <div className="text-sm text-faint">Nothing logged for this day. Drag a session in to plan it.</div>
      ) : (
        SECTION_ORDER.filter((k) => sections[k]?.length).map((k) => (
          <section key={k}>
            <div className="label mb-2">{SECTION_LABEL[k]}</div>
            <ul className="flex flex-col gap-1">
              {sections[k].map((ev, i) => (
                <li key={`${ev.id}-${i}`} className="flex items-baseline gap-3">
                  <EventChip event={ev} draggable={ev.draggable} />
                  {ev.detail ? <span className="text-xs text-mute">{ev.detail}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
