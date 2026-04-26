import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Sparkles,
  Image as ImageIcon,
  Users,
  CalendarDays,
  Activity,
  Database,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Owner panel — only renders when role === 'owner'. Provides a dashboard of
// the surfaces Percy uses to dogfood + admin the system. Server-side
// OWNER_EMAILS is what actually gates writes; this page is just navigation
// and read-only summaries.

const TILES = [
  {
    label: 'Personal Assistant',
    desc: 'Unrestricted Quiet Assassin. Opus 4.7 default.',
    to: '/assistant',
    icon: Sparkles,
  },
  {
    label: 'Image Lab',
    desc: 'fal.ai generation. Drops to /home dock when ready.',
    to: '/owner/images',
    icon: ImageIcon,
    disabled: true,
  },
  {
    label: 'Clients',
    desc: 'Read-only client roster. Inspect any session, meal, habit.',
    to: '/coach/clients',
    icon: Users,
  },
  {
    label: 'Programs',
    desc: 'Master program catalog used by the generator.',
    to: '/coach/programs',
    icon: CalendarDays,
  },
  {
    label: 'Cost Log',
    desc: 'Anthropic + fal.ai usage. Per-tier, per-day rollup.',
    to: '/owner/costs',
    icon: Activity,
    disabled: true,
  },
  {
    label: 'Raw Data',
    desc: 'Read-only SQL views (profiles, payments, sessions).',
    to: '/owner/data',
    icon: Database,
    disabled: true,
  },
];

export default function Owner() {
  const { profile, role } = useAuth();
  const nav = useNavigate();
  const [filter, setFilter] = useState('all');

  if (role !== 'owner') {
    return (
      <div className="mx-auto max-w-reading p-10">
        <div className="label mb-2">Restricted</div>
        <h1 className="font-display text-3xl tracking-wider2 text-gold">Owner only</h1>
        <p className="mt-3 text-sm text-mute">
          Add your email to the <code className="text-gold">OWNER_EMAILS</code> server env var
          (and <code className="text-gold">VITE_OWNER_EMAILS</code> for UI visibility) to access
          this surface.
        </p>
      </div>
    );
  }

  const tiles = filter === 'available' ? TILES.filter((t) => !t.disabled) : TILES;

  return (
    <div className="min-h-screen bg-bg text-ink">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 pt-10 pb-6">
        <button
          type="button"
          onClick={() => nav('/home')}
          className="flex items-center gap-2 text-mute transition-colors hover:text-gold"
          aria-label="Back to home"
        >
          <ArrowLeft size={16} />
          <span className="text-xs uppercase tracking-widest2">Home</span>
        </button>
        <div className="text-right">
          <div className="text-[0.6rem] uppercase tracking-widest2 text-faint">Signed in</div>
          <div className="font-display text-lg tracking-wider2 text-gold">
            {profile?.name ?? profile?.email ?? 'Owner'}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24">
        <div className="mb-2 label">Owner Panel</div>
        <h1 className="font-display text-4xl tracking-wider2 text-gold sm:text-5xl">
          Operate /axiom
        </h1>
        <p className="mt-3 max-w-reading text-sm text-mute">
          Unrestricted surfaces. Top model by default. No tier gates, no rate limits, no
          coaching-scope refusals. Server enforces OWNER_EMAILS — the UI here only renders
          for you.
        </p>

        <div className="mt-8 inline-flex border border-line">
          {['all', 'available'].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setFilter(v)}
              className={`px-4 py-2 text-xs uppercase tracking-widest2 transition-colors ${
                filter === v ? 'bg-gold text-bg' : 'text-mute hover:text-ink'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <section className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {tiles.map((t) => {
            const Icon = t.icon;
            const className = `flex flex-col gap-2 border bg-black/30 p-5 text-left transition-colors ${
              t.disabled
                ? 'border-line/30 text-faint'
                : 'border-line hover:border-gold hover:text-gold'
            }`;
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <Icon size={18} />
                  {t.disabled ? (
                    <span className="text-[0.6rem] uppercase tracking-widest2 text-faint">
                      Soon
                    </span>
                  ) : null}
                </div>
                <div className="font-display text-xl tracking-wider2">{t.label}</div>
                <div className="text-sm text-mute">{t.desc}</div>
              </>
            );
            return t.disabled ? (
              <div key={t.label} className={className} aria-disabled>
                {inner}
              </div>
            ) : (
              <button
                key={t.label}
                type="button"
                onClick={() => nav(t.to)}
                className={className}
              >
                {inner}
              </button>
            );
          })}
        </section>
      </main>
    </div>
  );
}
