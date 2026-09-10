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
import magaLogo from '../assets/maga-logo-47321F1221-seeklogo.com.png';

export default function SupervisorLayout() {
  const { tenantName, logout } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* Top bar */}
      <header className="bg-white border-b border-slate-200 px-4 py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-white p-0.5 flex items-center justify-center flex-shrink-0 shadow-xs border border-slate-200">
            <img
              src={magaLogo}
              alt="MäGA Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900 truncate">
                {tenantName ?? 'MäGA Engineering'}
              </span>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded-full">
                Supervisor
              </span>
            </div>
          </div>
        </div>

        <button
          id="supervisor-logout"
          onClick={logout}
          aria-label="Sign out"
          title="Sign out"
          className="w-9 h-9 rounded-md flex items-center justify-center text-slate-500 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
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
