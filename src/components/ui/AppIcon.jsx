import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

// iOS-style app icon: squircle (rounded-2xl approximation), gold border on
// focus, springy press animation, optional notification badge.
//
// Props:
//   to       — react-router path (renders as <Link>)
//   label    — caption rendered below the squircle
//   icon     — lucide-react icon component (rendered at size 28)
//   badge    — number; rendered top-right in gold pill if > 0
//   tone     — 'default' (gold-on-black) | 'inverse' (black-on-gold for dock)

export function AppIcon({ to, label, icon: Icon, badge = 0, tone = 'default' }) {
  const inner =
    tone === 'inverse'
      ? 'bg-gold text-bg'
      : 'bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] text-gold';

  return (
    <motion.div
      whileTap={{ scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 500, damping: 25 }}
      className="flex flex-col items-center"
    >
      <Link
        to={to}
        aria-label={label}
        className="group relative block focus-visible:outline-none"
      >
        <div
          className={`relative h-16 w-16 rounded-[22%] ${inner} shadow-[0_8px_24px_rgba(0,0,0,0.45)] ring-1 ring-line transition-shadow duration-200 group-focus-visible:ring-2 group-focus-visible:ring-gold sm:h-[72px] sm:w-[72px]`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            <Icon size={30} strokeWidth={1.6} />
          </div>
          {badge > 0 ? (
            <span
              aria-label={`${badge} unread`}
              className="absolute -right-1 -top-1 inline-flex min-w-[20px] items-center justify-center rounded-full bg-signal px-1.5 py-0.5 text-[0.6rem] font-semibold text-ink"
            >
              {badge > 99 ? '99+' : badge}
            </span>
          ) : null}
        </div>
      </Link>
      <span className="mt-2 max-w-[80px] truncate text-center text-[0.7rem] uppercase tracking-widest2 text-mute">
        {label}
      </span>
    </motion.div>
  );
}
