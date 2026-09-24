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
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import magaLogo from '../assets/maga-logo-47321F1221-seeklogo.com.png';
import AdminHeader from './AdminHeader';
import {
  LayoutDashboard,
  Users,
  Wrench,
  Tag,
  UserCog,
  CalendarDays,
  ClipboardList,
  CheckCircle2,
  BarChart3,
  Building2,
  Layers,
  X,
  ChevronDown,
  HardHat,
  Cog,
  Truck,
} from 'lucide-react';

// ── Nav item definition ────────────────────────────────────────────────────────

interface NavChild {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface NavItem {
  label: string;
  to?: string;
  icon: React.ReactNode;
  children?: NavChild[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',         to: '/admin',                   icon: <LayoutDashboard size={18} /> },
  { label: 'Projects & Admins', to: '/admin/tenants',           icon: <Layers size={18} /> },
  { label: 'Employees',         to: '/admin/employees',         icon: <Users size={18} /> },
  { label: 'Business partners', to: '/admin/business-partners', icon: <Building2 size={18} /> },
  { label: 'Equipment',         to: '/admin/equipment',         icon: <Wrench size={18} /> },
  { label: 'Activity codes',    to: '/admin/activity-codes',    icon: <Tag size={18} /> },
  { label: 'Supervisors',       to: '/admin/supervisors',       icon: <UserCog size={18} /> },
  { label: 'Calendar',          to: '/admin/calendar',          icon: <CalendarDays size={18} /> },
  {
    label: 'Assign',
    icon: <ClipboardList size={18} />,
    children: [
      { label: 'Labour assign',    to: '/admin/assignments/labour',    icon: <HardHat size={16} /> },
      { label: 'Operator assign',   to: '/admin/assignments/operator',  icon: <Cog size={16} /> },
      { label: 'Equipment assign',  to: '/admin/assignments/equipment', icon: <Truck size={16} /> },
    ],
  },
  { label: 'Approvals',         to: '/admin/approvals',         icon: <CheckCircle2 size={18} /> },
  { label: 'Reports',           to: '/admin/reports',           icon: <BarChart3 size={18} /> },
];

// ── Sidebar content ────────────────────────────────────────────────────────────

interface SidebarProps {
  tenantName: string | null;
  onNavClick?: () => void;
}

function SidebarContent({ tenantName, onNavClick }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(() => {
    // Auto-expand parent if we're on a child route
    const expanded = new Set<string>();
    NAV_ITEMS.forEach((item) => {
      if (item.children) {
        const isChildActive = item.children.some((c) => location.pathname.startsWith(c.to));
        if (isChildActive) expanded.add(item.label);
      }
    });
    return expanded;
  });

  const toggleMenu = (label: string) => {
    setExpandedMenus((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  };

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    if (item.to === '/admin/tenants') {
      return user?.role === 'super_admin';
    }
    return true;
  });

  // Shared class builder for nav links
  const navLinkClass = (isActive: boolean) =>
    [
      'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all min-h-[38px]',
      'focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none',
      isActive
        ? 'bg-gradient-to-r from-emerald-500/20 via-blue-500/15 to-transparent text-emerald-300 font-semibold border-l-2 border-emerald-400 shadow-sm shadow-emerald-950/20'
        : 'text-slate-300 hover:text-white hover:bg-blue-500/15 font-normal hover:border-l-2 hover:border-blue-400/40',
    ].join(' ');

  const iconClass = (isActive: boolean) =>
    ['flex-shrink-0 transition-colors', isActive ? 'text-emerald-400' : 'text-blue-300/70 group-hover:text-blue-200'].join(' ');

  return (
    <div className="flex flex-col h-full">
      {/* Product / tenant name header */}
      <div className="flex items-center gap-3 px-3.5 py-3 border-b border-blue-500/15 bg-[#0D2444]/60">
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
            {user?.role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </span>
        </div>
      </div>

      {/* Nav items */}
      <nav
        className="flex-1 px-2.5 py-2 flex flex-col gap-0.5 overflow-y-auto scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Admin navigation"
      >
        {visibleNavItems.map((item) => {
          // ── Item with children (dropdown) ──
          if (item.children) {
            const isExpanded = expandedMenus.has(item.label);
            const isAnyChildActive = item.children.some((c) => location.pathname.startsWith(c.to));

            return (
              <div key={item.label}>
                {/* Parent toggle button */}
                <button
                  type="button"
                  onClick={() => toggleMenu(item.label)}
                  className={[
                    'group flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all min-h-[38px] w-full',
                    'focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:outline-none',
                    isAnyChildActive
                      ? 'text-emerald-300 font-semibold'
                      : 'text-slate-300 hover:text-white hover:bg-blue-500/15 font-normal',
                  ].join(' ')}
                  aria-expanded={isExpanded}
                >
                  <span className={iconClass(isAnyChildActive)}>{item.icon}</span>
                  <span className="truncate flex-1 text-left">{item.label}</span>
                  <ChevronDown
                    size={14}
                    className={[
                      'flex-shrink-0 transition-transform duration-200',
                      isExpanded ? 'rotate-180' : '',
                      isAnyChildActive ? 'text-emerald-400' : 'text-slate-500',
                    ].join(' ')}
                  />
                </button>

                {/* Children */}
                <div
                  className={[
                    'overflow-hidden transition-all duration-200',
                    isExpanded ? 'max-h-40 opacity-100 mt-0.5' : 'max-h-0 opacity-0',
                  ].join(' ')}
                >
                  <div className="ml-3 pl-3 border-l border-blue-500/15 flex flex-col gap-0.5">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={onNavClick}
                        className={({ isActive }) => navLinkClass(isActive)}
                      >
                        {({ isActive }) => (
                          <>
                            <span className={iconClass(isActive)}>{child.icon}</span>
                            <span className="truncate">{child.label}</span>
                          </>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          // ── Regular nav link ──
          return (
            <NavLink
              key={item.to}
              to={item.to!}
              end={item.to === '/admin'}
              onClick={onNavClick}
              className={({ isActive }) => navLinkClass(isActive)}
            >
              {({ isActive }) => (
                <>
                  <span className={iconClass(isActive)}>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

// ── AdminLayout ────────────────────────────────────────────────────────────────

export default function AdminLayout() {
  const { tenantName } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-slate-50">

      {/* ── Desktop sidebar (fixed full screen height on md+) ────────────────── */}
      <aside
        className="hidden md:flex md:flex-col md:w-[200px] h-full bg-gradient-to-b from-[#091D36] via-[#07172B] to-[#051120] border-r border-blue-500/20 shadow-xl flex-shrink-0 text-slate-100 z-20 select-none"
        aria-label="Admin sidebar"
      >
        <SidebarContent
          tenantName={tenantName}
        />
      </aside>

      {/* ── Mobile overlay drawer ───────────────────────────────────────────── */}
      {/* Backdrop */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-[#030914]/80 backdrop-blur-sm z-30 md:hidden transition-opacity duration-200"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      {/* Drawer panel */}
      <aside
        className={[
          'fixed inset-y-0 left-0 h-full w-[240px] max-w-[85vw] bg-gradient-to-b from-[#091D36] via-[#07172B] to-[#051120] border-r border-blue-500/20 shadow-2xl z-40 flex flex-col text-slate-100',
          'transform transition-transform duration-200 ease-in-out md:hidden',
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
        <div className="flex-1 overflow-y-auto scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <SidebarContent
            tenantName={tenantName}
            onNavClick={() => setDrawerOpen(false)}
          />
        </div>
      </aside>

      {/* ── Main area (Only this area scrolls) ──────────────────────────────── */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">

        {/* Standard top header bar (Context, Notifications, User profile) */}
        <AdminHeader onOpenMobileNav={() => setDrawerOpen(true)} />

        {/* Page content from nested routes */}
        <main
          className="flex-1 h-full overflow-y-auto scrollbar-none focus:outline-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
