import React, { useState } from 'react';

/**
 * CtaCard — soft cross-sell card with two pill buttons (yes / no).
 * After either is clicked the card fades and disables itself, matching
 * the HTML behavior (card.style.opacity='0.55'; buttons disabled).
 *
 * Props:
 *   text       Required. Body copy.
 *   yesLabel   Label for the primary action.
 *   noLabel    Label for the ghost/dismiss action.
 *   onYes      Called when the primary is clicked.
 *   onNo       Called when the ghost is clicked.
 */
export function CtaCard({ text, yesLabel, noLabel, onYes, onNo }) {
  const [picked, setPicked] = useState(false);
  const pick = (cb) => () => {
    setPicked(true);
    cb && cb();
  };
  return (
    <div className="pk-cta-card" style={picked ? { opacity: 0.55 } : undefined}>
      <div className="pk-cta-text">{text}</div>
      <div className="pk-cta-actions">
        <button
          type="button"
          className="pk-cta-btn"
          disabled={picked}
          onClick={pick(onYes)}
        >
          {yesLabel}
        </button>
        <button
          type="button"
          className="pk-cta-btn pk-cta-btn--ghost"
          disabled={picked}
          onClick={pick(onNo)}
        >
          {noLabel}
        </button>
      </div>
    </div>
  );
}
