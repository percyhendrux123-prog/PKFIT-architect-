import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

// Cinematic intro shown on first visit to Landing (or when manually replayed).
//
// Behavior:
//   - If /trailer/pkfit-intro.mp4 is present, plays it muted/inline. Otherwise
//     falls back to a CSS/Framer typography reveal so the page never blocks
//     waiting for an asset that hasn't been generated yet.
//   - Skippable (button + tap-to-skip). Auto-dismisses on `ended` or after the
//     8s fallback completes.
//   - Sets `localStorage.pkfit_intro_seen = "1"` so subsequent visits skip.
//
// Generate the real video via `node scripts/generate-trailer.js` (one-shot,
// fal.ai veo). Output goes to public/trailer/pkfit-intro.mp4 + poster.jpg and
// is committed as a static asset — runtime never calls fal.ai.

const SEEN_KEY = 'pkfit_intro_seen';

export function CinematicIntro({ onDone, force = false }) {
  const [visible, setVisible] = useState(() => {
    if (force) return true;
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(SEEN_KEY) !== '1';
  });
  const [videoFailed, setVideoFailed] = useState(false);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!visible) return undefined;
    if (videoFailed) {
      const t = setTimeout(() => dismiss(), 6500);
      return () => clearTimeout(t);
    }
    const v = videoRef.current;
    if (!v) return undefined;
    const onErr = () => setVideoFailed(true);
    v.addEventListener('error', onErr);
    return () => v.removeEventListener('error', onErr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, videoFailed]);

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
        {!videoFailed ? (
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            autoPlay
            muted
            playsInline
            preload="auto"
            poster="/trailer/poster.jpg"
            onEnded={dismiss}
          >
            <source src="/trailer/pkfit-intro.mp4" type="video/mp4" />
          </video>
        ) : (
          <FallbackReveal />
        )}

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
