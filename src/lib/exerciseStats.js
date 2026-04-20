// PR / exercise history computations from a list of workout_sessions rows.
// Each session.exercises is an array shaped like:
//   [{ name, prescribed, sets: [{ weight, reps, rpe, done }] }]
// We flatten every `done` set into an entry, then derive per-exercise stats.

export function estimatedOneRm(weight, reps) {
  // Epley formula; widely used, reasonable up to ~10 reps.
  if (!Number.isFinite(weight) || !Number.isFinite(reps) || weight <= 0 || reps <= 0) return null;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

function canonicalName(name = '') {
  return name.trim().toLowerCase();
}

// Produces:
//   {
//     <canonical name>: {
//       name: "Back Squat",
//       entries: [{ date, weight, reps, rpe, e1rm }],
//       totalSets: number,
//       totalSessions: number,
//       bestWeight: { weight, reps, date } | null,
//       bestE1Rm: { e1rm, weight, reps, date } | null,
//     }
//   }
export function aggregateExerciseHistory(sessions = []) {
  const acc = {};
  for (const session of sessions) {
    const performedAt = session.performed_at ?? session.created_at;
    const seenThisSession = new Set();
    for (const ex of session.exercises ?? []) {
      const key = canonicalName(ex.name);
      if (!key) continue;
      const bucket = (acc[key] ??= {
        name: ex.name,
        entries: [],
        totalSets: 0,
        totalSessions: 0,
        bestWeight: null,
        bestE1Rm: null,
      });
      if (!seenThisSession.has(key)) {
        bucket.totalSessions += 1;
        seenThisSession.add(key);
      }
      for (const set of ex.sets ?? []) {
        if (!set?.done) continue;
        const weight = Number(set.weight);
        const reps = Number(set.reps);
        if (!Number.isFinite(weight) || !Number.isFinite(reps)) continue;
        const e1rm = estimatedOneRm(weight, reps);
        const entry = {
          date: performedAt,
          weight,
          reps,
          rpe: set.rpe != null && set.rpe !== '' ? Number(set.rpe) : null,
          e1rm,
        };
        bucket.entries.push(entry);
        bucket.totalSets += 1;
        if (!bucket.bestWeight || weight > bucket.bestWeight.weight) {
          bucket.bestWeight = { weight, reps, date: performedAt };
        }
        if (e1rm != null && (!bucket.bestE1Rm || e1rm > bucket.bestE1Rm.e1rm)) {
          bucket.bestE1Rm = { e1rm, weight, reps, date: performedAt };
        }
      }
    }
  }
  for (const key of Object.keys(acc)) {
    acc[key].entries.sort((a, b) => new Date(a.date) - new Date(b.date));
  }
  return acc;
}
