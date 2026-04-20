import { NavLink, Outlet, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const clientNav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/workouts', label: 'Workouts', icon: Dumbbell },
  { to: '/meals', label: 'Meals', icon: UtensilsCrossed },
  { to: '/habits', label: 'Habits', icon: Target },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/reviews', label: 'Reviews', icon: ClipboardCheck },
  { to: '/inbox', label: 'Inbox', icon: Inbox },
  { to: '/community', label: 'Community', icon: MessageSquare },
  { to: '/assistant', label: 'Assistant', icon: Sparkles },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/profile', label: 'Profile', icon: UserCircle2 },
];

const coachNav = [
  { to: '/coach', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/coach/inbox', label: 'Inbox', icon: Inbox },
  { to: '/coach/clients', label: 'Clients', icon: Users },
  { to: '/coach/programs', label: 'Programs', icon: ClipboardList },
  { to: '/coach/revenue', label: 'Revenue', icon: BarChart3 },
  { to: '/coach/announcements', label: 'Announce', icon: Megaphone },
];

export function Layout() {
  const { role, profile, signOut } = useAuth();
  const nav = useNavigate();
  const items = role === 'coach' ? coachNav : clientNav;

  async function handleSignOut() {
    await signOut();
    nav('/', { replace: true });
  }

  return (
    <div className="min-h-screen">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <NavLink to={role === 'coach' ? '/coach' : '/dashboard'} className="font-display text-2xl tracking-wider2 text-gold">
            PKFIT
          </NavLink>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs uppercase tracking-widest2 text-faint sm:inline">
              {profile?.name ?? profile?.email ?? 'Member'}
            </span>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1 text-xs uppercase tracking-widest2 text-mute hover:text-gold"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-0 md:grid-cols-[220px_1fr]">
        <nav className="hidden border-r border-line py-6 md:block">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-5 py-3 text-sm uppercase tracking-wider2 transition-colors ${
                      isActive ? 'border-l-2 border-gold text-gold' : 'border-l-2 border-transparent text-mute hover:text-ink'
                    }`
                  }
                >
                  <item.icon size={16} />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <main id="main" tabIndex={-1} className="min-h-[70vh] px-5 py-8">
          <Outlet />
        </main>
      </div>

      <nav className="sticky bottom-0 border-t border-line bg-bg md:hidden">
        <ul className="flex overflow-x-auto">
          {items.map((item) => (
            <li key={item.to} className="flex-1">
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 px-3 py-3 text-[0.6rem] uppercase tracking-widest2 ${
                    isActive ? 'text-gold' : 'text-faint'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
