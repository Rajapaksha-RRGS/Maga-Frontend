/**
 * AdminLayout.tsx
 *
 * Desktop-first layout shell for the admin role.
 *
 * Structure:
 *   - Permanent left sidebar (~180px) on md+ screens, with product name
 *     header and icon nav items. Active route is highlighted.
 *   - Main content area renders nested routes via <Outlet />.
 *   - On mobile: sidebar collapses; a hamburger button in a top bar
 *     toggles it open as an overlay drawer.
 *
 * Styled per design-system.json:
 *   - bg-white sidebar, border-r border-slate-200, no shadows
 *   - Active nav: bg-blue-50 text-blue-700 font-medium
 *   - Inactive nav: text-slate-600 hover:bg-slate-50
 *   - Sentence case nav labels
 */
import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import magaLogo from '../assets/maga-logo-47321F1221-seeklogo.com.png';
import {
  LayoutDashboard,
  Users,
  Wrench,
  Tag,
  UserCog,
  CalendarDays,
  ClipboardList,
  BarChart3,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

// ── Nav item definition ────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',      to: '/admin',              icon: <LayoutDashboard size={18} /> },
  { label: 'Employees',      to: '/admin/employees',    icon: <Users size={18} /> },
  { label: 'Equipment',      to: '/admin/equipment',    icon: <Wrench size={18} /> },
  { label: 'Activity codes', to: '/admin/activity-codes', icon: <Tag size={18} /> },
  { label: 'Supervisors',    to: '/admin/supervisors',  icon: <UserCog size={18} /> },
  { label: 'Calendar',       to: '/admin/calendar',     icon: <CalendarDays size={18} /> },
  { label: 'Assignment',     to: '/admin/assignments',  icon: <ClipboardList size={18} /> },
  { label: 'Reports',        to: '/admin/reports',      icon: <BarChart3 size={18} /> },
];

// ── Sidebar content ────────────────────────────────────────────────────────────

interface SidebarProps {
  tenantName: string | null;
  onNavClick?: () => void;
  onLogout: () => void;
}

function SidebarContent({ tenantName, onNavClick, onLogout }: SidebarProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Product / tenant name header */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-slate-200">
        <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 bg-slate-50 border border-slate-200/60 p-0.5">
          <img
            src={magaLogo}
            alt="MäGA Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800 truncate">
            {tenantName ?? 'Labour Entry System'}
          </p>
          <p className="text-xs text-slate-400">Admin</p>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'} // only exact-match highlight for dashboard
            onClick={onNavClick}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors min-h-[44px]',
                'focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1',
                isActive
                  ? 'bg-blue-50 text-blue-700 font-medium'
                  : 'text-slate-600 hover:bg-slate-50 font-normal',
              ].join(' ')
            }
          >
            <span className="flex-shrink-0">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout button at bottom of sidebar */}
      <div className="px-2 py-3 border-t border-slate-200">
        <button
          id="admin-sidebar-logout"
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors min-h-[44px] w-full focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <LogOut size={18} className="flex-shrink-0" />
          <span>Sign out</span>
        </button>
      </div>
    </div>
  );
}

// ── AdminLayout ────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const { tenantName, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLogout = () => {
    logout();
    // Navigation to /login is handled by ProtectedRoute reacting to user becoming null
  };

  return (
    <div className="flex min-h-screen bg-slate-50">

      {/* ── Desktop sidebar (hidden on mobile) ─────────────────────────────── */}
      <aside
        className="hidden md:flex md:flex-col md:w-[180px] bg-white border-r border-slate-200 flex-shrink-0"
        aria-label="Admin sidebar"
      >
        <SidebarContent
          tenantName={tenantName}
          onLogout={handleLogout}
        />
      </aside>

      {/* ── Mobile overlay drawer ───────────────────────────────────────────── */}
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-20 md:hidden"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside
        className={[
          'fixed top-0 left-0 h-full w-[220px] bg-white border-r border-slate-200 z-30 flex flex-col',
          'transform transition-transform duration-200 md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Admin navigation drawer"
        aria-hidden={!drawerOpen}
      >
        {/* Drawer close button */}
        <div className="flex justify-end px-3 pt-3">
          <button
            id="admin-drawer-close"
            onClick={() => setDrawerOpen(false)}
            className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <SidebarContent
            tenantName={tenantName}
            onNavClick={() => setDrawerOpen(false)}
            onLogout={handleLogout}
          />
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Mobile top bar (hamburger + product name) — hidden on md+ */}
        <header className="md:hidden flex items-center gap-3 bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-10">
          <button
            id="admin-hamburger"
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-medium text-slate-800">
            {tenantName ?? 'Labour Entry System'}
          </span>
        </header>

        {/* Page content from nested routes */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
