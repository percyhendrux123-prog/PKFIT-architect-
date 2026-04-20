import { useMemo } from 'react';

// Last `days` worth of dots, oldest on the left, grouped into 7-row weeks
// reading top-to-bottom, columns left-to-right. Each cell = one day.
// Intensity = completion rate (0..1) that day.

function toKey(d) {
  return d.toISOString().slice(0, 10);
}

function buildCells(days, list, history) {
  const cells = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const totalHabits = list.length || 0;
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toKey(d);
    const day = history[key] ?? {};
    let done = 0;
    if (totalHabits > 0) {
      done = list.reduce((acc, h) => acc + (day[h.id] ? 1 : 0), 0);
    }
    const rate = totalHabits > 0 ? done / totalHabits : 0;
    cells.push({ date: d, key, rate, done, total: totalHabits });
  }
  return cells;
}

function intensityClass(rate) {
  if (rate <= 0) return 'bg-black/30';
  if (rate < 0.34) return 'bg-gold/25';
  if (rate < 0.67) return 'bg-gold/50';
  if (rate < 1) return 'bg-gold/75';
  return 'bg-gold';
}

export function HabitHeatmap({ list, history, days = 56 }) {
  const cells = useMemo(() => buildCells(days, list, history), [days, list, history]);
  const columns = Math.ceil(cells.length / 7);
  const firstCell = cells[0]?.date;
  const lastCell = cells[cells.length - 1]?.date;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="label">Adherence · last {days} days</div>
        <div className="flex items-center gap-1 text-[0.55rem] uppercase tracking-widest2 text-faint">
          Less
          <span className="mx-1 inline-block h-3 w-3 bg-black/30" />
          <span className="mx-0.5 inline-block h-3 w-3 bg-gold/25" />
          <span className="mx-0.5 inline-block h-3 w-3 bg-gold/50" />
          <span className="mx-0.5 inline-block h-3 w-3 bg-gold/75" />
          <span className="ml-1 inline-block h-3 w-3 bg-gold" />
          More
        </div>
      </div>
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gridAutoFlow: 'column', gridTemplateRows: 'repeat(7, minmax(0, 1fr))' }}
        role="img"
        aria-label={`Habit adherence for the last ${days} days`}
      >
        {cells.map((c) => (
          <div
            key={c.key}
            title={`${c.key} — ${c.done}/${c.total || 0}`}
            className={`aspect-square border border-line ${intensityClass(c.rate)}`}
          />
        ))}
      </div>
      {firstCell && lastCell ? (
        <div className="flex justify-between text-[0.55rem] uppercase tracking-widest2 text-faint">
          <span>{firstCell.toLocaleDateString()}</span>
          <span>{lastCell.toLocaleDateString()}</span>
        </div>
      ) : null}
    </div>
  );
}
