import React from 'react';

/**
 * StreakCard — large serif number + "Week N, unbroken" label, optional cue.
 * Mirrors `streakCard(streakN, cueText)` in pkfit-checkin.
 *
 * Props:
 *   streak    Required. Week number — rendered as the large serif numeral.
 *   label     Optional eyebrow. Defaults to `Week {streak}, unbroken`.
 *   cue       Optional italic line under the rule.
 */
export function StreakCard({ streak, label, cue }) {
  const labelText = label ?? `Week ${streak}, unbroken`;
  return (
    <div className="pk-streak-card">
      <div>
        <div className="pk-streak-num">{streak}</div>
      </div>
      <div className="pk-streak-body">
        <div className="pk-streak-label">{labelText}</div>
        {cue && <div className="pk-streak-cue">{cue}</div>}
      </div>
    </div>
  );
}
