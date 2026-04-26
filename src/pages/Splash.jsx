import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Splash() {
  const { loading, user, profile } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div role="status" aria-live="polite" className="text-center">
          <div className="font-display text-6xl tracking-widest2 text-gold">PKFIT</div>
          <div className="mt-3 label">Loading the Protocol</div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/" replace />;
  return <Navigate to={profile?.role === 'coach' ? '/coach' : '/home'} replace />;
}
