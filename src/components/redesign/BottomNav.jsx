// BottomNav — mobile-first bottom tab bar from PKFIT redesign app-shell.
// Wired to react-router instead of internal state.
import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

const items = [
  { to: '/dashboard', icon: 'home', label: 'Today' },
  { to: '/workouts', icon: 'flame', label: 'Train' },
  { to: '/assistant', icon: 'sparkle', label: 'Coach' },
  { to: '/reviews', icon: 'chart', label: 'Progress' },
  { to: '/profile', icon: 'user', label: 'Profile' },
];

const coachItems = [
  { to: '/coach', icon: 'home', label: 'Today', end: true },
  { to: '/coach/inbox', icon: 'chat', label: 'Inbox' },
  { to: '/coach/clients', icon: 'user', label: 'Clients' },
  { to: '/coach/programs', icon: 'flame', label: 'Programs' },
  { to: '/coach/revenue', icon: 'chart', label: 'Revenue' },
];

export default function BottomNav({ role = 'client' }) {
  const navItems = role === 'coach' ? coachItems : items;
  return (
    <nav
      className="bottom-nav-redesign md:hidden"
      aria-label="Mobile primary"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 30,
        background: 'linear-gradient(180deg, transparent, #080808 30%)',
      }}
    >
      <div
        className="bottom-nav"
        style={{
          background: 'linear-gradient(180deg, transparent, #080808 30%)',
        }}
      >
        {navItems.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            <Icon name={it.icon} size={20} />
            {it.label}
            <span className="dot" />
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
