import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// PK•FIT front page. Single capital P on #080808.
// Tap, click, Enter, or Space → role-resolved entry:
//   no session  → /login
//   coach       → /coach
//   client      → /dashboard
// No subtitle. No CTA. No marketing copy. No nav. No footer.
// Per Block 0 of pkfit-app v1 engineering scope.

export default function EnterIntro() {
  const nav = useNavigate();
  const { user, role } = useAuth();

  function destination() {
    if (!user) return '/login';
    if (role === 'coach') return '/coach';
    return '/dashboard';
  }

  function enter() {
    nav(destination(), { replace: true });
  }

  function onKey(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      enter();
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Enter PK•FIT"
      onClick={enter}
      onKeyDown={onKey}
      className="flex min-h-screen w-full cursor-pointer select-none items-center justify-center outline-none focus-visible:ring-1 focus-visible:ring-[#F5F1E8]"
      style={{ backgroundColor: '#080808' }}
    >
      <span
        aria-hidden="true"
        className="transition-opacity duration-100 ease-out hover:opacity-85"
        style={{
          fontFamily: "'DRUK Wide', 'Druk Wide', 'Bowlby One', sans-serif",
          fontWeight: 900,
          fontSize: 'clamp(12rem, 40vw, 32rem)',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          color: '#F5F5F5',
        }}
      >
        P
      </span>
    </div>
  );
}
