import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/Empty';

const PAID_PLANS = new Set(['performance', 'identity', 'full', 'premium']);

const ALLOW_WITHOUT_SUBSCRIPTION = new Set([
  '/billing',
  '/profile',
  '/settings',
  '/inbox',
]);

export function isActiveSubscriber(profile) {
  if (!profile) return false;
  if (profile.role === 'coach') return true;
  if (PAID_PLANS.has(profile.plan)) return true;
  if (profile.plan === 'trial') return true;
  return false;
}

export function RequiresActiveSubscription({ children }) {
  const { profile, loading } = useAuth();
  const location = useLocation();

  if (loading || !profile) {
    return (
      <div className="p-10">
        <Spinner />
      </div>
    );
  }

  if (ALLOW_WITHOUT_SUBSCRIPTION.has(location.pathname)) return children;
  if (isActiveSubscriber(profile)) return children;

  return <Navigate to="/billing" replace state={{ from: location.pathname, reason: 'subscription' }} />;
}
