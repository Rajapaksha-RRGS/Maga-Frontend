/**
 * ProtectedRoute.tsx
 *
 * Route guard component. Wraps any route that requires authentication and/or
 * a specific role.
 *
 * Behaviour:
 *   1. While auth is being rehydrated from localStorage → render nothing
 *      (avoids a flash-redirect on page refresh).
 *   2. No authenticated user → redirect to /login.
 *   3. User's role doesn't match requiredRole → redirect to their correct home.
 *   4. All checks pass → render children via <Outlet />.
 */
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth, type Role } from '../../../context/AuthContext';

interface ProtectedRouteProps {
  /** The role this route requires. If omitted, any authenticated user passes. */
  requiredRole?: Role;
}

/** Map a role to its home path */
function homeForRole(role: Role): string {
  return role === 'admin' ? '/admin' : '/supervisor';
}

export default function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();

  // Still rehydrating from storage — don't redirect yet
  if (isLoading) {
    return null;
  }

  // Not logged in at all → go to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but wrong role → redirect to their actual home
  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to={homeForRole(user.role)} replace />;
  }

  return <Outlet />;
}
