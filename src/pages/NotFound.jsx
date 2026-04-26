import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const location = useLocation();
  const { user, role } = useAuth();
  const homePath = !user ? '/' : role === 'coach' ? '/coach' : '/home';
  const homeLabel = !user ? 'Landing' : role === 'coach' ? 'Coach overview' : 'Home';
  return (
    <div className="mx-auto flex min-h-screen max-w-reading flex-col justify-center px-5 py-16">
      <div className="label mb-2">404</div>
      <h1 className="font-display text-[clamp(3rem,7vw,5rem)] leading-none tracking-wider2 text-gold">
        No surface here
      </h1>
      <p className="mt-4 text-sm text-mute">
        The route <code className="text-gold">{location.pathname}</code> doesn&apos;t exist. Either it was moved or the link is old.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to={homePath}
          className="border border-gold bg-gold px-5 py-3 font-display tracking-wider2 text-bg transition-colors hover:bg-[#d8b658]"
        >
          {homeLabel}
        </Link>
        {!user ? (
          <Link
            to="/login"
            className="border border-line px-5 py-3 font-display tracking-wider2 text-ink transition-colors hover:border-gold"
          >
            Sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
