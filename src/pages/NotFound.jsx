import { Link, useLocation } from 'react-router-dom';

export default function NotFound() {
  const location = useLocation();
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
          to="/"
          className="border border-gold bg-gold px-5 py-3 font-display tracking-wider2 text-bg"
        >
          Landing
        </Link>
        <Link
          to="/dashboard"
          className="border border-line px-5 py-3 font-display tracking-wider2 text-ink hover:border-gold"
        >
          Dashboard
        </Link>
      </div>
    </div>
  );
}
