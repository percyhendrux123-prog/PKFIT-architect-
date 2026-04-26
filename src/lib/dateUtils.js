// Calendar date math. Local time throughout — the user's wall clock is what
// matters for what "Tuesday" means, not UTC.

export function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function startOfWeek(date, weekStartsOn = 0) {
  const d = startOfDay(date);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  return addDays(d, -diff);
}

export function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

// Six-week grid (42 cells) covering the month containing `date`. Apple's
// month view always shows trailing/leading days from adjacent months so the
// grid is rectangular and dates never reflow when the user pages.
export function monthGrid(date, weekStartsOn = 0) {
  const first = startOfMonth(date);
  const gridStart = startOfWeek(first, weekStartsOn);
  return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
}

export function weekDates(date, weekStartsOn = 0) {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function isSameDay(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isSameMonth(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function formatRange(view, cursor) {
  if (view === 'month') {
    return cursor.toLocaleString(undefined, { month: 'long', year: 'numeric' });
  }
  if (view === 'week') {
    const start = startOfWeek(cursor);
    const end = addDays(start, 6);
    const sameMonth = start.getMonth() === end.getMonth();
    const startStr = start.toLocaleString(undefined, sameMonth ? { month: 'long', day: 'numeric' } : { month: 'short', day: 'numeric' });
    const endStr = end.toLocaleString(undefined, sameMonth ? { day: 'numeric', year: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
    return `${startStr} – ${endStr}`;
  }
  return cursor.toLocaleString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}
