import { Link } from 'react-router-dom';

const TABS = [
  {
    key: 'home',
    label: 'HOME',
    to: '/dashboard',
    svg: (
      <svg viewBox="0 0 24 24"><path d="M3 12L12 3l9 9" /><path d="M5 10v10h14V10" /></svg>
    ),
  },
  {
    key: 'training',
    label: 'TRAINING',
    to: '/calendar',
    svg: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    key: 'nutrition',
    label: 'NUTRITION',
    to: '/meals',
    svg: (
      <svg viewBox="0 0 24 24"><path d="M12 2a4 4 0 0 1 4 4c0 2-1 4-1 6s1 3 1 5a4 4 0 0 1-8 0c0-2 1-3 1-5s-1-4-1-6a4 4 0 0 1 4-4z" /></svg>
    ),
  },
  {
    key: 'messages',
    label: 'MESSAGES',
    to: '/inbox',
    svg: (
      <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
    ),
  },
  {
    key: 'profile',
    label: 'PROFILE',
    to: '/profile',
    svg: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
    ),
  },
];

const COACH_TABS = [
  {
    key: 'roster',
    label: 'ROSTER',
    to: '/coach/clients',
    svg: (
      <svg viewBox="0 0 24 24"><circle cx="9" cy="7" r="4" /><path d="M17 11l2 2 4-4" /><path d="M3 21v-1a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v1" /></svg>
    ),
  },
  {
    key: 'programs',
    label: 'PROGRAMS',
    to: '/coach/programs',
    svg: (
      <svg viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    key: 'checkins',
    label: 'CHECK-INS',
    to: '/coach',
    svg: <svg viewBox="0 0 24 24"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>,
  },
  {
    key: 'inbox',
    label: 'INBOX',
    to: '/coach/inbox',
    svg: (
      <svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
    ),
  },
  {
    key: 'me',
    label: 'ME',
    to: '/profile',
    svg: (
      <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" /></svg>
    ),
  },
];

export default function BottomNav({ active, variant = 'client' }) {
  const tabs = variant === 'coach' ? COACH_TABS : TABS;
  return (
    <nav className="op-bottom-nav" aria-label="Primary">
      {tabs.map((tab) => {
        const cls = `op-nav-item${tab.key === active ? ' op-active' : ''}`;
        return (
          <Link key={tab.key} to={tab.to} className={cls} aria-current={tab.key === active ? 'page' : undefined}>
            {tab.svg}
            <span className="op-nav-label">{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
