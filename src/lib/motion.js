// PKFIT polish-elevation motion utilities.
// CSS-first by design — keeps bundle weight near zero. Framer Motion is
// already a dep (used elsewhere in HomeScreen tile launcher) so we don't add
// another runtime here.
//
// Canon: edge-and-contrast, accent gold #C9A84C, NO backdrop-filter / no
// glassmorphism (that lives in ATLAS, the Performance app).

const GOLD = '#C9A84C';

/**
 * Stagger reveal helper. Returns a style object with `animationDelay` for
 * a `.pkfit-reveal` element so callers can chain `streak first, then weight,
 * then lifts` without writing inline keyframes per node.
 *
 * @param {number} index zero-based stagger position
 * @param {number} step  ms between each reveal (default 110)
 * @param {number} base  ms baseline delay (default 60)
 */
export function revealDelay(index = 0, step = 110, base = 60) {
  return {
    animationDelay: `${base + Math.max(0, index) * step}ms`,
  };
}

/**
 * Cursor-aware glow handler — for components that don't want to wrap with
 * <CursorAwareCard/>. Pass to onMouseMove on any element styled with
 * `.pkfit-cursor-card`. Reads getBoundingClientRect() and writes
 * --cursor-x / --cursor-y CSS vars in pixels.
 */
export function trackCursor(event) {
  const el = event.currentTarget;
  if (!el) return;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--cursor-x', `${event.clientX - rect.left}px`);
  el.style.setProperty('--cursor-y', `${event.clientY - rect.top}px`);
}

/** Resets the cursor vars to centre when the pointer leaves the element. */
export function resetCursor(event) {
  const el = event.currentTarget;
  if (!el) return;
  el.style.setProperty('--cursor-x', '50%');
  el.style.setProperty('--cursor-y', '50%');
}

/**
 * Tiny imperative trigger for the streak-counter pulse.
 * Adds the `.pkfit-streak-pulse--fire` class for 420ms then removes it,
 * resetting the animation so it can fire again on the next log.
 */
export function firePulse(node) {
  if (!node) return;
  node.classList.remove('pkfit-streak-pulse--fire');
  // Force reflow so re-adding the class restarts the animation.
  // eslint-disable-next-line no-unused-expressions
  node.offsetWidth;
  node.classList.add('pkfit-streak-pulse--fire');
  setTimeout(() => node.classList.remove('pkfit-streak-pulse--fire'), 420);
}

export const PKFIT_GOLD = GOLD;
