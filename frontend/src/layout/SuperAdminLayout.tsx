/**
 * SuperAdminLayout.tsx
 *
 * Desktop-first layout shell for the Super Admin (Head Office) portal.
 *
 * Visual Identity: Deep Purple-Black sidebar + Imperial Gold (#C9A84C) accents
 * This visually distinguishes the global HQ tier from the site-level Admin
 * portal (Dark Navy + Emerald), following enterprise UX best practices.
 *
 * Structure:
 *   - Permanent left sidebar (~210px) on md+ screens, with Crown branding,
 *     section headers (MASTER DATA / OPERATIONS), and gold-accented active states.
 *   - Main content area renders nested routes via <Outlet />.
 *   - On mobile: sidebar collapses into overlay drawer (hamburger toggle).
 *   - Collapse/expand with Ctrl+B shortcut (stored in localStorage).
 *   - "← Back to Site Admin" quick-switch at sidebar bottom.
 */
import { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import magaLogo from '../assets/maga-logo-47321F1221-seeklogo.com.png';
import SuperAdminHeader from './SuperAdminHeader';
import {
  LayoutDashboard,
  Users,
  Wrench,
  Tag,
  Building2,
  Layers,
  X,
  Crown,
  ChevronLeft,
  GitMerge,
  Settings2,
  HardHat,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

// ── Nav type definitions ──────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
}

interface NavSection {
  sectionLabel?: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: '/super-admin', icon: <LayoutDashboard size={17} /> },
      { label: 'Projects & Admins', to: '/super-admin/projects', icon: <Layers size={17} /> },
    ],
  },
  {
    sectionLabel: 'MASTER DATA',
    items: [
      { label: 'Employees', to: '/super-admin/employees', icon: <Users size={17} /> },
      { label: 'Business partners', to: '/super-admin/business-partners', icon: <Building2 size={17} /> },
      { label: 'Equipment', to: '/super-admin/equipment', icon: <Wrench size={17} /> },
      { label: 'Trade groups', to: '/super-admin/trade-groups', icon: <HardHat size={17} /> },
      { label: 'Activity codes', to: '/super-admin/activity-codes', icon: <Tag size={17} /> },
    ],
  },
  {
    sectionLabel: 'OPERATIONS',
    items: [
      { label: 'Transfers', to: '/super-admin/transfers', icon: <GitMerge size={17} /> },
      { label: 'Settings', to: '/super-admin/settings', icon: <Settings2 size={17} /> },
    ],
  },
];

// ── Sidebar Content Component ─────────────────────────────────────────────────

interface SidebarProps {
  onNavClick?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

function SidebarContent({ onNavClick, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { user } = useAuth();
  const location = useLocation();

  // Active state helper — exact match for dashboard, prefix for others
  const isActive = (to: string) => {
    if (to === '/super-admin') {
      return location.pathname === '/super-admin' || location.pathname === '/super-admin/dashboard';
    }
    return location.pathname.startsWith(to);
  };

  const navLinkClass = (active: boolean) =>
    [
      'group flex items-center rounded-lg text-sm transition-all min-h-[38px]',
      isCollapsed ? 'justify-center px-0 py-2 w-10 mx-auto' : 'gap-3 px-3 py-2 w-full',
      'focus-visible:ring-2 focus-visible:ring-[#C9A84C]/60 focus-visible:outline-none',
      active
        ? 'bg-gradient-to-r from-[#C9A84C]/25 via-amber-500/10 to-transparent text-[#C9A84C] font-semibold border-l-2 border-[#C9A84C] shadow-sm shadow-amber-950/10'
        : 'text-slate-300 hover:text-white hover:bg-violet-500/15 font-normal hover:border-l-2 hover:border-violet-400/30',
    ].join(' ');

  const iconClass = (active: boolean) =>
    ['flex-shrink-0 transition-colors', active ? 'text-[#C9A84C]' : 'text-violet-300/70 group-hover:text-violet-200'].join(' ');

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* ── Brand Header ─────────────────────────────────────────── */}
      <div
        className={[
          'flex items-center border-b border-violet-500/15 bg-[#1A0A2E]/60 transition-all',
          isCollapsed ? 'justify-center py-3 px-2' : 'gap-3 px-3.5 py-3',
        ].join(' ')}
      >
        <div
          className="w-9 h-9 rounded-xl bg-white p-1 flex items-center justify-center flex-shrink-0 shadow-md shadow-amber-950/30 border border-[#C9A84C]/30 cursor-pointer"
          onClick={isCollapsed ? onToggleCollapse : undefined}
          title={isCollapsed ? 'Expand sidebar' : undefined}
        >
          <img src={magaLogo} alt="MäGA Logo" className="w-full h-full object-contain" />
        </div>

        {!isCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate tracking-tight">
              Mäga ERP Head Office
            </p>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#C9A84C] bg-amber-950/80 border border-[#C9A84C]/30 px-1.5 py-0.5 rounded-full mt-0.5">
              <Crown size={9} className="text-[#C9A84C]" />
              {user?.fullName?.split(' ')[0] || 'Super Admin'}
            </span>
          </div>
        )}

        {/* Collapse toggle — only shown when not collapsed and on desktop */}
        {!isCollapsed && onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            className="hidden md:flex w-7 h-7 rounded-lg items-center justify-center text-violet-400/50 hover:text-violet-200 hover:bg-violet-500/20 transition-colors flex-shrink-0"
            title="Collapse sidebar (Ctrl+B)"
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {/* ── Nav Sections ─────────────────────────────────────────── */}
      <nav
        className="flex-1 px-2 py-2.5 flex flex-col gap-0.5 overflow-y-auto scrollbar-none overscroll-contain"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        aria-label="Super Admin navigation"
      >
        {NAV_SECTIONS.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-2' : ''}>
            {/* Section label */}
            {!isCollapsed && section.sectionLabel && (
              <p className="text-[9px] font-bold text-violet-500/60 uppercase tracking-widest px-3 py-1.5 mb-0.5">
                {section.sectionLabel}
              </p>
            )}
            {isCollapsed && section.sectionLabel && (
              <div className="border-t border-violet-500/15 my-2 mx-1" />
            )}

            {section.items.map((item) => {
              const active = isActive(item.to);
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/super-admin'}
                  onClick={onNavClick}
                  title={isCollapsed ? item.label : undefined}
                  className={navLinkClass(active)}
                >
                  <span className={iconClass(active)}>{item.icon}</span>
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </NavLink>
              );
            })}
          </div>
        ))}

      </nav>

      {/* ── Footer toggle button (Desktop only) ── */}
      {onToggleCollapse && (
        <div className="p-2 border-t border-violet-500/15 bg-[#070312]/70">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[
              'w-full flex items-center rounded-lg text-xs text-violet-400/70 hover:text-white hover:bg-violet-500/20 active:bg-violet-500/30 transition-all py-2',
              isCollapsed ? 'justify-center px-0' : 'justify-between px-3',
            ].join(' ')}
          >
            {!isCollapsed && (
              <span className="font-medium text-violet-300/80 flex items-center gap-2">
                <PanelLeftClose size={15} className="text-violet-400/70" />
                <span>Collapse sidebar</span>
              </span>
            )}
            {isCollapsed ? (
              <PanelLeftOpen size={18} className="text-[#C9A84C] hover:scale-110 transition-transform" />
            ) : (
              <ChevronLeft size={15} className="text-violet-400/70" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ── SuperAdminLayout ──────────────────────────────────────────────────────────

export default function SuperAdminLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('sa_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sa_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  // Ctrl+B keyboard shortcut to toggle collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen h-[100dvh] overflow-hidden bg-[#F5F3FF] sa-portal text-slate-800" style={{ colorScheme: 'light' }}>

      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside
        className={[
          'hidden md:flex md:flex-col h-full bg-gradient-to-b from-[#1A0A2E] via-[#130820] to-[#0D0720] border-r border-violet-500/20 shadow-xl flex-shrink-0 text-slate-100 z-20 select-none transition-all duration-300 ease-in-out overscroll-contain',
          isCollapsed ? 'md:w-[68px]' : 'md:w-[210px]',
        ].join(' ')}
        aria-label="Super Admin sidebar"
      >
        <SidebarContent
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {/* ── Mobile overlay drawer ────────────────────────────────────────── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 bg-[#0D0720]/85 backdrop-blur-sm z-30 md:hidden transition-opacity duration-200"
          aria-hidden="true"
          onClick={() => setDrawerOpen(false)}
        />
      )}

      <aside
        className={[
          'fixed inset-y-0 left-0 h-full w-[240px] max-w-[85vw] bg-gradient-to-b from-[#1A0A2E] via-[#130820] to-[#0D0720] border-r border-violet-500/20 shadow-2xl z-40 flex flex-col text-slate-100',
          'transform transition-transform duration-200 ease-in-out md:hidden',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
        aria-label="Super Admin navigation drawer"
        aria-hidden={!drawerOpen}
      >
        {/* Close button */}
        <div className="flex justify-end px-3 pt-3">
          <button
            id="sa-drawer-close"
            onClick={() => setDrawerOpen(false)}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-violet-200/70 hover:text-white hover:bg-violet-500/20 active:bg-violet-500/30 transition-colors"
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <SidebarContent onNavClick={() => setDrawerOpen(false)} />
        </div>
      </aside>

      {/* ── Main content area ────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 h-full min-w-0 overflow-hidden">
        <SuperAdminHeader onOpenMobileNav={() => setDrawerOpen(true)} />

        <main className="flex-1 h-full min-h-0 overflow-y-auto focus:outline-none flex flex-col overscroll-contain">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
