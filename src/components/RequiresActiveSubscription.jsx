import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Spinner } from './ui/Empty';

const PAID_PLANS = new Set([
  'tier1', 'tier2', 'tier3',
  // Legacy plan names kept here so subscriptions that haven't yet renewed
  // still resolve as active. The webhook + migration roll new payments to
  // tier1/2/3, so this list will shrink to a single set over time.
  'performance', 'identity', 'full', 'premium',
]);

const ALLOW_WITHOUT_SUBSCRIPTION = new Set([
  '/billing',
  '/profile',
  '/settings',
  '/inbox',
]);

export function isActiveSubscriber(profile, role) {
  if (role === 'owner') return true;
  if (!profile) return false;
  if (profile.role === 'coach') return true;
  if (PAID_PLANS.has(profile.plan)) return true;
  if (profile.plan === 'trial') return true;
  return false;
}

export function RequiresActiveSubscription({ children }) {
  const { profile, role, loading } = useAuth();
  const location = useLocation();

  if (loading || !profile) {
    return (
      <div className="p-10">
        <Spinner />
      </div>
    );
  }

  // When used as a layout route (no explicit children), render the matched
  // child route via <Outlet />. When given children, render those — preserves
  // the existing call-site that wraps <Layout />.
  const content = children ?? <Outlet />;

  if (ALLOW_WITHOUT_SUBSCRIPTION.has(location.pathname)) return content;
  if (isActiveSubscriber(profile, role)) return content;

  return <Navigate to="/billing" replace state={{ from: location.pathname, reason: 'subscription' }} />;
}
