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

export default function SupervisorLayout() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors">
      <Outlet />
    </div>
  );
}
