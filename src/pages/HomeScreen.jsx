import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dumbbell,
  UtensilsCrossed,
  Target,
  CalendarDays,
  Sparkles,
  Users,
  CreditCard,
  UserCircle2,
  ClipboardCheck,
  Inbox,
  LayoutDashboard,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useUnreadDMs } from '../hooks/useUnreadDMs';
import { useUnreadCommunity } from '../hooks/useUnreadCommunity';
import { AppIcon } from '../components/ui/AppIcon';
import { Avatar } from '../components/ui/Avatar';

// iPhone-style home screen. Replaces the previous post-login dashboard as the
// default landing surface. The dashboard remains accessible as the "Today"
// tile so the existing widget content (loop stage, macro floors) is one tap
// away. Bottom dock holds the four highest-frequency actions.

const APPS = [
  { to: '/dashboard', label: 'Today', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/meals', label: 'Meals', icon: UtensilsCrossed },
  { to: '/habits', label: 'Habits', icon: Target },
  { to: '/reviews', label: 'Reviews', icon: ClipboardCheck },
  { to: '/community', label: 'Community', icon: Users, badgeKey: 'community' },
  { to: '/inbox', label: 'Inbox', icon: Inbox, badgeKey: 'dms' },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

const DOCK = [
  { to: '/assistant', label: 'Coach', icon: Sparkles, tone: 'inverse' },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays, tone: 'inverse' },
  { to: '/profile', label: 'Profile', icon: UserCircle2, tone: 'inverse' },
];

function formatGreeting(date = new Date()) {
  const h = date.getHours();
  if (h < 5) return 'Late';
  if (h < 12) return 'Morning';
  if (h < 18) return 'Afternoon';
  return 'Evening';
}

export default function HomeScreen() {
  const { user, profile, role, signOut } = useAuth();
  const nav = useNavigate();
  const unreadDMs = useUnreadDMs({ userId: user?.id, role });
  const unreadCommunity = useUnreadCommunity({
    userId: user?.id,
    lastSeenAt: profile?.community_last_seen_at,
  });

  const badges = { dms: unreadDMs, community: role === 'coach' ? 0 : unreadCommunity };

  // Cmd/Ctrl+K shortcut to Assistant — same shortcut Layout.jsx wires.
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        const tag = document.activeElement?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;
        e.preventDefault();
        nav('/assistant');
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [nav]);

  async function handleSignOut() {
    await signOut();
    nav('/', { replace: true });
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const greeting = formatGreeting();
  const displayName = profile?.name?.split(' ')?.[0] ?? profile?.email?.split('@')?.[0] ?? 'Member';

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-bg text-ink"
      style={{
        backgroundImage:
          'radial-gradient(1100px 700px at 75% -10%, rgba(201,168,76,0.12), transparent 60%), radial-gradient(900px 600px at 10% 110%, rgba(201,168,76,0.08), transparent 55%)',
      }}
    >
      <header className="relative z-10 mx-auto flex max-w-3xl items-center justify-between px-6 pt-10 pb-4">
        <div>
          <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">{today}</div>
          <div className="mt-1 font-display text-3xl tracking-wider2 text-gold">
            {greeting}, {displayName}.
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Avatar name={profile?.name ?? 'Me'} path={profile?.avatar_path} size={32} />
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="text-mute transition-colors hover:text-gold focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold"
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <motion.main
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.2, 0.6, 0.2, 1] }}
        className="relative z-10 mx-auto max-w-3xl px-6 pb-44 pt-4"
      >
        <div
          className="grid gap-y-7 gap-x-4"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(76px, 1fr))' }}
        >
          {APPS.map((app) => (
            <AppIcon
              key={app.to}
              to={app.to}
              label={app.label}
              icon={app.icon}
              badge={app.badgeKey ? badges[app.badgeKey] ?? 0 : 0}
            />
          ))}
        </div>
      </motion.main>

      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-4 z-20 mx-auto flex max-w-md items-center justify-around rounded-[28px] border border-line bg-black/60 px-5 py-3 backdrop-blur-md"
        style={{ width: 'calc(100% - 32px)' }}
      >
        {DOCK.map((item) => (
          <AppIcon
            key={item.to}
            to={item.to}
            label={item.label}
            icon={item.icon}
            tone={item.tone}
          />
        ))}
      </nav>
    </div>
  );
}
