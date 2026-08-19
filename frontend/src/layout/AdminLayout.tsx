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
      <div className="flex items-center gap-3 px-4 py-4 border-b border-blue-500/15 bg-[#0D2444]/60">
        <div className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center flex-shrink-0 shadow-md shadow-emerald-950/20 border border-emerald-400/30">
          <img
            src={magaLogo}
            alt="MäGA Logo"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate tracking-tight">
            {tenantName ?? 'Labour Entry System'}
          </p>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-1.5 py-0.5 rounded-full mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Admin
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-2.5 py-3.5 flex flex-col gap-1 overflow-y-auto" aria-label="Admin navigation">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/admin'} // only exact-match highlight for dashboard
            onClick={onNavClick}
            className={({ isActive }) =>
              [
                'group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all min-h-[44px]',
                'focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none',
                isActive
                  ? 'bg-gradient-to-r from-emerald-500/20 via-blue-500/15 to-transparent text-emerald-300 font-semibold border-l-2 border-emerald-400 shadow-sm shadow-emerald-950/20'
                  : 'text-slate-300 hover:text-white hover:bg-blue-500/15 font-normal hover:border-l-2 hover:border-blue-400/40',
              ].join(' ')
            }
          >
            {({ isActive }) => (
              <>
                <span className={['flex-shrink-0 transition-colors', isActive ? 'text-emerald-400' : 'text-blue-300/70 group-hover:text-blue-200'].join(' ')}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Logout button at bottom of sidebar */}
      <div className="px-2.5 py-3 border-t border-blue-500/15 bg-[#061221]/40">
        <button
          id="admin-sidebar-logout"
          onClick={onLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-300 hover:text-rose-300 hover:bg-rose-950/30 transition-colors min-h-[44px] w-full focus-visible:ring-2 focus-visible:ring-emerald-400"
        >
          <LogOut size={18} className="flex-shrink-0 text-slate-400" />
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
        className="hidden md:flex md:flex-col md:w-[200px] bg-gradient-to-b from-[#091D36] via-[#07172B] to-[#051120] border-r border-blue-500/20 shadow-xl flex-shrink-0 text-slate-100"
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
          className="fixed inset-0 bg-[#030914]/80 backdrop-blur-sm z-20 md:hidden transition-opacity"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside
        className={[
          'fixed top-0 left-0 h-full w-[230px] bg-gradient-to-b from-[#091D36] via-[#07172B] to-[#051120] border-r border-blue-500/20 shadow-2xl z-30 flex flex-col text-slate-100',
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
            className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-200/70 hover:text-white hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400"
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
        <header className="md:hidden flex items-center gap-3 bg-[#091D36] border-b border-blue-500/20 px-4 py-3 sticky top-0 z-10 shadow-sm text-white">
          <button
            id="admin-hamburger"
            onClick={() => setDrawerOpen(true)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-blue-200 hover:text-white hover:bg-blue-600/20 active:bg-blue-600/30 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-400"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded bg-white p-0.5 flex items-center justify-center flex-shrink-0">
              <img src={magaLogo} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <span className="text-sm font-semibold text-white truncate">
              {tenantName ?? 'Labour Entry System'}
            </span>
          </div>
        </header>

        {/* Page content from nested routes */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
