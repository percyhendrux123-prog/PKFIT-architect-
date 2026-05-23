import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wrap a route element that should never render its child for an owner.
// Owner accidentally hitting a client-only page (e.g., /profile, /settings)
// gets bounced to the owner panel instead of seeing the client UI.
export function OwnerRedirect({ to = '/owner', children }) {
  const { isOwner } = useAuth();
  if (isOwner) return <Navigate to={to} replace />;
  return children;
}
