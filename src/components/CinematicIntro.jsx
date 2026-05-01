import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Cinematic intro shown on first visit to Landing (or when manually replayed).
//
// Behavior:
//   - Renders the FallbackReveal typography animation directly. Trailer assets
//     have not been generated yet, so we don't render a <video> that fails.
//   - Skippable (button). Auto-dismisses after the fallback animation completes.
//   - Sets `localStorage.pkfit_intro_seen = "1"` so subsequent visits skip.

const SEEN_KEY = 'pkfit_intro_seen';

// polish 2026-05-01: removed <video> branch (no /trailer/* assets exist) — render fallback directly
export function CinematicIntro({ onDone, force = false }) {
  const [visible, setVisible] = useState(() => {
    if (force) return true;
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SEEN_KEY) !== '1';
  });

  useEffect(() => {
    if (!visible) return undefined;
    // polish 2026-05-01: timer matches FallbackReveal animation duration (~4s)
    const t = setTimeout(() => dismiss(), 4200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function dismiss() {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(SEEN_KEY, '1');
    }
    setVisible(false);
    onDone?.();
  }

  if (!visible) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="cinematic"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-bg"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.6 }}
        role="dialog"
        aria-label="PKFIT intro"
      >
        <FallbackReveal />

        <button
          type="button"
          onClick={dismiss}
          className="absolute bottom-8 right-8 border border-line/40 bg-black/40 px-4 py-2 text-[0.7rem] uppercase tracking-widest2 text-mute backdrop-blur transition-colors hover:border-gold hover:text-gold"
        >
          Skip
        </button>
      </motion.div>
    </AnimatePresence>
  );
}

function FallbackReveal() {
  return (
    <div className="pointer-events-none flex flex-col items-center">
      <motion.div
        className="font-display text-[clamp(4rem,14vw,11rem)] leading-none tracking-wider2 text-gold"
        initial={{ opacity: 0, letterSpacing: '0.4em' }}
        animate={{ opacity: 1, letterSpacing: '0.08em' }}
        transition={{ duration: 1.6, ease: [0.2, 0.6, 0.2, 1] }}
      >
        PKFIT
      </motion.div>
      <motion.div
        className="mt-3 h-px w-32 bg-gold"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: [0, 1, 1, 0] }}
        transition={{ duration: 4, ease: 'easeInOut', times: [0, 0.4, 0.7, 1] }}
      />
      <motion.div
        className="mt-4 text-[0.7rem] uppercase tracking-widest2 text-mute"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 1, 0] }}
        transition={{ duration: 4, delay: 1.2, times: [0, 0.3, 0.7, 1] }}
      >
        Powered by /operate/axiom
      </motion.div>
    </div>
  );
}
