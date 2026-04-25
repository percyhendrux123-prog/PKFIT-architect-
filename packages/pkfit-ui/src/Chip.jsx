import React from 'react';

/**
 * Chip — single quick-reply button with the ATLAS pill treatment.
 *
 * Props:
 *   label       Required. Visible text.
 *   ghost       If true, applies the muted "ghost" variant (used for skip-style options).
 *   disabled    Disable interaction (caller typically toggles after a pick).
 *   onClick     Click handler.
 */
export function Chip({ label, ghost = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      className={`pk-chip ${ghost ? 'pk-chip--ghost' : ''}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

/**
 * Chips — convenience wrapper that lays out multiple Chip children with the
 * ATLAS gap. Mirrors the `chipsEl(options, onPick)` builder in the HTML.
 *
 * Props:
 *   options     Array of { label, value? } passed to onPick when chosen.
 *   ghostLast   If true, the last chip renders as ghost.
 *   disabled    Disable the entire row.
 *   onPick      Called with the chosen option.
 *   children    Alternative to options — render Chip elements yourself.
 */
export function Chips({ options, ghostLast = false, disabled = false, onPick, children }) {
  if (children) {
    return <div className="pk-chips">{children}</div>;
  }
  return (
    <div className="pk-chips">
      {(options ?? []).map((opt, idx) => (
        <Chip
          key={opt.value ?? opt.label ?? idx}
          label={opt.label}
          ghost={ghostLast && idx === options.length - 1}
          disabled={disabled}
          onClick={() => onPick && onPick(opt)}
        />
      ))}
    </div>
  );
}
