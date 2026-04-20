import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Splash() {
  const { loading, user, profile } = useAuth();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 900);
    return () => clearTimeout(t);
  }, []);

  if (ready && !loading) {
    if (!user) return <Navigate to="/" replace />;
    return <Navigate to={profile?.role === 'coach' ? '/coach' : '/dashboard'} replace />;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg">
      <div className="text-center" style={{ opacity: ready ? 1 : 0.4, transition: 'opacity 300ms linear' }}>
        <div className="font-display text-6xl tracking-widest2 text-gold">PKFIT</div>
        <div className="mt-3 label">Loading the Protocol</div>
      </div>
    </div>
  );
}
