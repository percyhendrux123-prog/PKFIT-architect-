import React from 'react';

/**
 * NextStepCard — italic-serif cue card. Used at end of intake flow to point
 * the user at what's next without pressuring an action.
 *
 * Props:
 *   label    Optional eyebrow label. Defaults to 'Next step'.
 *   cue      Required body text — rendered in italic Fraunces.
 */
export function NextStepCard({ label = 'Next step', cue }) {
  return (
    <div className="pk-next-step-card">
      <div className="pk-ns-label">{label}</div>
      <div className="pk-ns-cue">{cue}</div>
    </div>
  );
}
