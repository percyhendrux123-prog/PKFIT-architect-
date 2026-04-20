// Streak utilities. A streak is the number of consecutive days (walking back
// from today) that satisfy a predicate. Today has a grace: if today has no
// data, the streak falls back to check yesterday so a user who hasn't logged
// yet still sees an unbroken count from yesterday.

function toKey(d) {
  return d.toISOString().slice(0, 10);
}

export function habitStreak(habitRow) {
  const list = habitRow?.habit_list ?? [];
  const history = habitRow?.check_history ?? {};
  if (list.length === 0) return 0;

  let count = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toKey(today);
  const startOffset = history[todayKey] ? 0 : 1;

  for (let i = startOffset; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = toKey(d);
    const day = history[key] ?? {};
    const allDone = list.every((h) => day[h.id]);
    if (allDone) count += 1;
    else break;
  }
  return count;
}

export function sessionStreak(sessions = []) {
  // Count distinct session days walking back from today. A day counts if at
  // least one session was performed that day. Today has the same grace.
  if (!sessions.length) return 0;
  const daysWithSession = new Set(
    sessions.map((s) => toKey(new Date(s.performed_at))),
  );
  let count = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = toKey(today);
  const startOffset = daysWithSession.has(todayKey) ? 0 : 1;
  for (let i = startOffset; i < 365; i += 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (daysWithSession.has(toKey(d))) count += 1;
    else break;
  }
  return count;
}
