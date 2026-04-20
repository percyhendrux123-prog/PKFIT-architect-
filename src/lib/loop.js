// PKFIT Diagnostic-Program-Lock loop. Four phases. Derived from start_date.
// An explicit `profile.loop_stage` on the row overrides the derived value.

export const LOOP_STAGES = [
  {
    key: 'diagnosis',
    label: 'Diagnosis',
    days: [0, 6],
    body: 'Baseline everything. Find the constraint.',
  },
  {
    key: 'correction',
    label: 'Correction',
    days: [7, 13],
    body: 'Remove the drag. Install the stack.',
  },
  {
    key: 'identity',
    label: 'Identity Shift',
    days: [14, 20],
    body: 'The pattern becomes a preference.',
  },
  {
    key: 'lock',
    label: 'The Lock',
    days: [21, Infinity],
    body: 'The stack becomes the default. The loop runs without you.',
  },
];

function daysSince(iso) {
  if (!iso) return null;
  const start = new Date(iso);
  if (Number.isNaN(start.getTime())) return null;
  const now = new Date();
  const ms = now.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

// Returns one of 'diagnosis' | 'correction' | 'identity' | 'lock'.
// If the profile has an explicit override, use it. Otherwise compute from
// `start_date`. Defaults to 'diagnosis' if no start date is set.
export function deriveLoopStage(profile) {
  const override = profile?.loop_stage;
  if (override && LOOP_STAGES.some((s) => s.key === override)) return override;

  const d = daysSince(profile?.start_date);
  if (d == null) return 'diagnosis';

  for (const stage of LOOP_STAGES) {
    if (d >= stage.days[0] && d <= stage.days[1]) return stage.key;
  }
  return 'lock';
}

export function loopStageMeta(key) {
  return LOOP_STAGES.find((s) => s.key === key) ?? LOOP_STAGES[0];
}

// Returns 0..1 showing position within the 30-day arc (Lock flattens at 1).
export function loopProgress(profile) {
  const d = daysSince(profile?.start_date);
  if (d == null || d < 0) return 0;
  return Math.min(1, d / 28);
}
