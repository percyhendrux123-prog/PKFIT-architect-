// CursorAwareCard — generic wrapper that gives a card a soft gold radial
// glow tracking the cursor's position within it on hover. Reads
// pointer-clientX / clientY, writes --cursor-x / --cursor-y CSS vars on
// the wrapping element. The actual visual is driven by the
// `.pkfit-cursor-card` class in src/index.css (a ::before with a radial
// gradient). No backdrop-filter — PKFIT canon, not ATLAS.
//
// Usage:
//   <CursorAwareCard className="border border-line bg-black/30 p-5">
//     ...card body...
//   </CursorAwareCard>
//
// Ref-forwarding so callers (e.g. firePulse on a streak) can still
// imperatively trigger animations on the wrapped node.

import { forwardRef, useRef } from 'react';
import { trackCursor, resetCursor } from '../lib/motion';

export const CursorAwareCard = forwardRef(function CursorAwareCard(
  { as: Tag = 'div', className = '', children, onMouseMove, onMouseLeave, ...rest },
  forwardedRef,
) {
  const innerRef = useRef(null);
  const setRef = (node) => {
    innerRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  };

  function handleMove(event) {
    trackCursor(event);
    if (typeof onMouseMove === 'function') onMouseMove(event);
  }
  function handleLeave(event) {
    resetCursor(event);
    if (typeof onMouseLeave === 'function') onMouseLeave(event);
  }

  return (
    <Tag
      ref={setRef}
      className={`pkfit-cursor-card ${className}`}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      {...rest}
    >
      {children}
    </Tag>
  );
});

export default CursorAwareCard;
