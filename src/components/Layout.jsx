import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Dumbbell,
  UtensilsCrossed,
  Target,
  CalendarDays,
  MessageSquare,
  Sparkles,
  Users,
  CreditCard,
  UserCircle2,
  LogOut,
  BarChart3,
  Megaphone,
  ClipboardList,
  ClipboardCheck,
  Inbox,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUnreadDMs } from '../hooks/useUnreadDMs';
import { useUnreadCommunity } from '../hooks/useUnreadCommunity';
import { Avatar } from './ui/Avatar';

const clientPrimary = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/meals', label: 'Meals', icon: UtensilsCrossed },
  { to: '/assistant', label: 'Assistant', icon: Sparkles },
];

const clientSecondary = [
  { to: '/habits', label: 'Habits', icon: Target },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/reviews', label: 'Reviews', icon: ClipboardCheck },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/community', label: 'Community', icon: MessageSquare },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
];

const coachPrimary = [
  { to: '/coach', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/coach/inbox', label: 'Inbox', icon: Inbox },
  { to: '/coach/clients', label: 'Clients', icon: Users },
  { to: '/coach/programs', label: 'Programs', icon: ClipboardList },
];

const coachSecondary = [
  { to: '/coach/revenue', label: 'Revenue', icon: BarChart3 },
  { to: '/coach/announcements', label: 'Announce', icon: Megaphone },
];

export function Layout() {
  const { user, role, profile, signOut } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const unreadDMs = useUnreadDMs({ userId: user?.id, role });
  const unreadCommunity = useUnreadCommunity({
    userId: user?.id,
    lastSeenAt: profile?.community_last_seen_at,
  });

  const primary = role === 'coach' ? coachPrimary : clientPrimary;
  const secondary = role === 'coach' ? coachSecondary : clientSecondary;
  const sidebar = [...primary, ...secondary];
  const inboxPath = role === 'coach' ? '/coach/inbox' : '/inbox';

  // Map route → unread count so the sidebar renders badges generically.
  const badges = {
    [inboxPath]: unreadDMs,
    '/community': role === 'coach' ? 0 : unreadCommunity,
  };

  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  async function handleSignOut() {
    await signOut();
    nav('/', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <NavLink
            to={role === 'coach' ? '/coach' : '/dashboard'}
            className="font-display text-2xl tracking-wider2 text-gold"
          >
            PKFIT
          </NavLink>
          <div className="flex items-center gap-3">
            <Avatar name={profile?.name ?? profile?.email ?? 'Me'} path={profile?.avatar_path} size={28} />
            <span className="hidden text-xs uppercase tracking-widest2 text-faint sm:inline">
              {profile?.name ?? profile?.email ?? 'Member'}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-mute hover:text-gold"
              aria-label="Sign out"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-0 md:grid-cols-[220px_1fr]">
        <nav className="hidden border-r border-line py-6 md:block" aria-label="Primary">
          <ul className="flex flex-col">
            {sidebar.map((item) => {
              const badgeCount = badges[item.to] ?? 0;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-5 py-3 text-sm uppercase tracking-wider2 transition-colors ${
                        isActive
                          ? 'border-l-2 border-gold text-gold'
                          : 'border-l-2 border-transparent text-mute hover:text-ink'
                      }`
                    }
                  >
                    <item.icon size={16} />
                    <span className="flex-1">{item.label}</span>
                    {badgeCount > 0 ? (
                      <span
                        className="rounded-none bg-gold px-1.5 py-0.5 text-[0.55rem] text-bg"
                        aria-label={`${badgeCount} unread`}
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    ) : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <main id="main" tabIndex={-1} className="min-h-[70vh] px-5 py-8 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav: 4 primary + "More" sheet */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg md:hidden"
        aria-label="Mobile primary"
      >
        <ul className="flex">
          {primary.map((item) => {
            const showDot = (badges[item.to] ?? 0) > 0;
            return (
              <li key={item.to} className="relative flex-1">
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex flex-col items-center gap-1 px-2 py-3 text-[0.6rem] uppercase tracking-widest2 ${
                      isActive ? 'text-gold' : 'text-faint'
                    }`
                  }
                >
                  <item.icon size={18} />
                  {item.label}
                </NavLink>
                {showDot ? (
                  <span
                    className="absolute right-3 top-2 h-2 w-2 rounded-full bg-gold"
                    aria-label="Unread"
                  />
                ) : null}
              </li>
            );
          })}
          <li className="relative flex-1">
            <button
              onClick={() => setMoreOpen(true)}
              className="flex w-full flex-col items-center gap-1 px-2 py-3 text-[0.6rem] uppercase tracking-widest2 text-faint"
              aria-label="Open more menu"
            >
              <Menu size={18} />
              More
            </button>
            {secondary.some((item) => (badges[item.to] ?? 0) > 0) ? (
              <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-gold" aria-hidden />
            ) : null}
          </li>
        </ul>
      </nav>

      {moreOpen ? (
        <div
          className="fixed inset-0 z-30 flex flex-col justify-end bg-black/70 md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="More navigation"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="rounded-t-none border-t border-line bg-bg p-5 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="label">More</div>
              <button onClick={() => setMoreOpen(false)} aria-label="Close more menu" className="text-mute">
                <X size={18} />
              </button>
            </div>
            <ul className="grid grid-cols-3 gap-3">
              {secondary.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `flex flex-col items-center gap-2 border p-4 text-[0.7rem] uppercase tracking-widest2 ${
                        isActive ? 'border-gold text-gold' : 'border-line text-mute'
                      }`
                    }
                  >
                    <item.icon size={22} />
                    {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
