import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/Empty';

export function ProtectedRoute({ children, role }) {
  const { user, profile, loading, isSupabaseConfigured } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) {
    return (
      <div className="mx-auto max-w-reading p-10 text-mute">
        <div className="label mb-2">Offline</div>
        <h1 className="font-display text-3xl tracking-wider2 text-ink">Supabase not configured</h1>
        <p className="mt-3 text-sm">
          Set <code className="text-gold">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-gold">VITE_SUPABASE_ANON_KEY</code> in your Netlify environment to enable auth.
        </p>
      </div>
    );
  }

  if (loading) return <div className="p-10"><Spinner /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  if (role && profile && profile.role !== role) {
    return <Navigate to={profile.role === 'coach' ? '/coach' : '/dashboard'} replace />;
  }

  return children;
}
