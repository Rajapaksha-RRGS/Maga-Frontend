/**
 * SupervisorLayout.tsx
 *
 * Mobile-first layout shell for the supervisor role.
 *
 * Intentionally minimal — it must not compete with the step-flow UI
 * (dashboard → check-in → activity → checkout) that Master Prompt 3
 * will build inside <Outlet />.
 *
 * Structure:
 *   - Simple top bar: tenant/product name (left), logout icon button (right)
 *   - No sidebar — supervisors are field-based, mobile-only primary use case
 *   - <Outlet /> fills the rest of the viewport
 *
 * Styled per design-system.json:
 *   - bg-white border-b border-slate-200 header
 *   - w-9 h-9 rounded-md icon button for logout
 *   - bg-slate-50 content area
 */
import { Outlet } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SupervisorLayout() {
  const { tenantName, logout } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <span className="text-sm font-medium text-slate-800">
          {tenantName ?? 'Labour Entry System'}
        </span>

        <button
          id="supervisor-logout"
          onClick={logout}
          aria-label="Sign out"
          className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <LogOut size={18} />
        </button>
      </header>

      {/* Step-flow pages render here */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}
