import { useEffect, useRef, useState } from 'react';
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
  Settings as SettingsIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useUnreadDMs } from '../hooks/useUnreadDMs';
import { useUnreadCommunity } from '../hooks/useUnreadCommunity';
import { Avatar } from './ui/Avatar';
import { NotificationBell } from './NotificationBell';

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
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
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
  const mainRef = useRef(null);
  const moreCloseRef = useRef(null);
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
    // Move keyboard focus to main on route change so SR users get an anchor.
    if (mainRef.current) {
      mainRef.current.focus({ preventScroll: false });
    }
  }, [location.pathname]);

  // Mobile More sheet: focus trap + Escape to close.
  useEffect(() => {
    if (!moreOpen) return undefined;
    const previouslyFocused = document.activeElement;
    moreCloseRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setMoreOpen(false);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    };
  }, [moreOpen]);

  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        // Cmd/Ctrl+K opens the Assistant. Don't hijack inputs where users are typing.
        const tag = document.activeElement?.tagName;
        const isEditing =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          document.activeElement?.isContentEditable;
        if (isEditing) return;
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

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <NavLink
            to={role === 'coach' ? '/coach' : '/home'}
            className="font-display text-2xl tracking-wider2 text-gold"
          >
            PKFIT
          </NavLink>
          <div className="flex items-center gap-3">
            <NotificationBell user={user} role={role} profile={profile} />
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
                        className="min-w-[20px] bg-gold px-1.5 py-0.5 text-center text-[0.55rem] text-bg"
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

        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="min-h-[70vh] px-5 py-8 pb-24 outline-none md:pb-8"
        >
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav — PKFIT redesign visual language. 5 primary tabs + More-sheet button. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 md:hidden"
        aria-label="Mobile primary"
        style={{ background: 'linear-gradient(180deg, transparent, #080808 30%)' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            padding: '10px 8px max(20px, env(safe-area-inset-bottom)) 8px',
            background: 'linear-gradient(180deg, transparent, #080808 30%)',
            borderTop: '1px solid #1C1C20',
          }}
        >
          {primary.slice(0, 4).map((item) => {
            const showDot = (badges[item.to] ?? 0) > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-2 py-2 ${isActive ? 'text-ink' : 'text-faint'}`
                }
                style={{
                  fontFamily: 'var(--mono, monospace)',
                  fontSize: 9,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textDecoration: 'none',
                  position: 'relative',
                }}
              >
                <item.icon size={20} />
                <span>{item.label}</span>
                <span
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 999,
                    background: '#FF5B1F',
                    marginTop: 2,
                  }}
                />
                {showDot ? (
                  <span
                    className="absolute right-3 top-1 h-2 w-2 rounded-full"
                    style={{ background: '#FF5B1F' }}
                    aria-label="Unread"
                  />
                ) : null}
              </NavLink>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center gap-1 px-2 py-2 text-faint"
            aria-label="Open more menu"
            style={{
              background: 'transparent',
              border: 0,
              fontFamily: 'var(--mono, monospace)',
              fontSize: 9,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            <Menu size={20} />
            <span>More</span>
            <span style={{ width: 4, height: 4, borderRadius: 999, background: 'transparent', marginTop: 2 }} />
            {secondary.some((item) => (badges[item.to] ?? 0) > 0) ? (
              <span
                className="absolute right-3 top-1 h-2 w-2 rounded-full"
                style={{ background: '#FF5B1F' }}
                aria-hidden
              />
            ) : null}
          </button>
        </div>
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
              <button
                ref={moreCloseRef}
                onClick={() => setMoreOpen(false)}
                aria-label="Close more menu"
                className="p-2 text-mute hover:text-gold focus-visible:outline focus-visible:outline-1 focus-visible:outline-gold"
              >
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
