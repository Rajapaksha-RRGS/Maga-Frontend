/**
 * AdminHeader.tsx
 *
 * Slim, standard enterprise top header bar for the admin portal.
 * Houses:
 *   - Workspace & active page breadcrumbs
 *   - Live operational status indicator
 *   - Centralized Notification & Warning Bell with interactive panel
 *   - Authenticated User profile badge with role & session controls
 */
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Menu,
  AlertTriangle,
  Info,
  CheckCircle2,
  Calendar,
  ChevronDown,
  LogOut,
  ExternalLink,
  Trash2,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications, type NotificationItem } from '../context/NotificationContext';

interface Props {
  onOpenMobileNav: () => void;
}

export default function AdminHeader({ onOpenMobileNav }: Props) {
  const { user, logout, tenantName } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } =
    useNotifications();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setNotifOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Determine current active section title from route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path.includes('/admin/assignments/labour')) return 'Labour Assign';
    if (path.includes('/admin/assignments/operator')) return 'Operator Assign';
    if (path.includes('/admin/assignments/equipment')) return 'Equipment Assign';
    if (path.includes('/admin/equipment')) return 'Equipment Master';
    if (path.includes('/admin/business-partners')) return 'Business Partners';
    if (path.includes('/admin/employees')) return 'Employee Master';
    if (path.includes('/admin/activity-codes')) return 'Activity Codes';
    if (path.includes('/admin/approvals')) return 'Daily Approvals';
    if (path.includes('/admin/reports')) return 'Reports & Analytics';
    if (path.includes('/admin/supervisors')) return 'Supervisors';
    if (path.includes('/admin/calendar')) return 'Working Calendar';
    if (path.includes('/admin/tenants')) return 'Project Tenants';
    return 'Admin Portal';
  };

  const todayFormatted = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date());

  const handleNotificationClick = (item: NotificationItem) => {
    markAsRead(item.id);
    if (item.link) {
      navigate(item.link);
      setNotifOpen(false);
    }
  };

  const getNotifIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />;
      case 'error':
        return <AlertTriangle size={15} className="text-red-600 flex-shrink-0" />;
      case 'success':
        return <CheckCircle2 size={15} className="text-emerald-600 flex-shrink-0" />;
      default:
        return <Info size={15} className="text-blue-600 flex-shrink-0" />;
    }
  };

  const userDisplayName = user?.fullName || user?.username || 'Admin User';
  const userInitials = userDisplayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const userRoleDisplay =
    user?.role === 'super_admin'
      ? 'Super Admin'
      : user?.role === 'supervisor'
      ? 'Supervisor'
      : 'Project Admin';

  return (
    <header className="h-[52px] bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between z-20 flex-shrink-0 select-none">

      {/* ── Left: Mobile Toggle & Page Context ──────────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-semibold text-slate-800 tracking-tight whitespace-nowrap">
            {getPageTitle()}
          </span>

          <span className="hidden sm:inline-block text-slate-300">•</span>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-500 bg-slate-50 border border-slate-200/80 px-2 py-0.5 rounded-full truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 animate-pulse" />
            <span className="truncate">{tenantName || 'Mäga Engineering'}</span>
          </div>
        </div>
      </div>

      {/* ── Right: Date, Notifications & User Profile ───────────────────── */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* Current Date Badge (Desktop only) */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
          <Calendar size={13} className="text-slate-400" />
          <span>{todayFormatted}</span>
        </div>

        {/* ── Notification Bell Center ─────────────────────────────────── */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setNotifOpen(!notifOpen);
              setUserMenuOpen(false);
            }}
            className={[
              'w-8 h-8 rounded-lg flex items-center justify-center transition-colors relative cursor-pointer',
              notifOpen
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100',
            ].join(' ')}
            aria-label="Notifications"
            title="System Notifications & Warnings"
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-white animate-pulse" />
            )}
          </button>

          {/* Notifications Dropdown Panel */}
          {notifOpen && (
            <div className="fixed sm:absolute top-14 sm:top-full left-3 right-3 sm:left-auto sm:right-0 sm:mt-2 max-w-md sm:max-w-none mx-auto sm:mx-0 sm:w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-800">Notifications & Alerts</span>
                  {unreadCount > 0 && (
                    <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllAsRead}
                    className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification List */}
              <div
                className="max-h-[calc(100vh-140px)] sm:max-h-80 overflow-y-auto divide-y divide-slate-100 scrollbar-none"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <CheckCircle2 size={24} className="mx-auto text-emerald-400 mb-1.5" />
                    <p className="font-medium text-slate-600">No active alerts</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">Everything is operating smoothly</p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => handleNotificationClick(item)}
                      className={[
                        'p-3 transition-colors flex items-start gap-2.5 cursor-pointer',
                        item.read ? 'bg-white hover:bg-slate-50' : 'bg-blue-50/30 hover:bg-blue-50/60',
                      ].join(' ')}
                    >
                      <div className="mt-0.5">{getNotifIcon(item.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <p
                            className={[
                              'text-xs truncate',
                              item.read ? 'font-medium text-slate-700' : 'font-semibold text-slate-900',
                            ].join(' ')}
                          >
                            {item.title}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap">
                            {item.timestamp}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                          {item.message}
                        </p>
                        {item.actionText && (
                          <div className="mt-1 flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800">
                            <span>{item.actionText}</span>
                            <ExternalLink size={10} />
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeNotification(item.id);
                        }}
                        className="text-slate-300 hover:text-slate-500 p-0.5 rounded cursor-pointer"
                        title="Dismiss"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Panel Footer */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck size={12} className="text-emerald-500" />
                  Mäga ERP System Health: Normal
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* ── User Profile Menu ────────────────────────────────────────── */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 p-1 pl-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="User profile menu"
          >
            <div className="w-7 h-7 rounded-full bg-blue-700 text-white font-semibold text-[11px] flex items-center justify-center flex-shrink-0 shadow-2xs">
              {userInitials}
            </div>

            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
                {userDisplayName}
              </span>
              <span className="text-[10px] text-slate-400 leading-tight">
                {userRoleDisplay}
              </span>
            </div>

            <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
          </button>

          {/* User Menu Dropdown */}
          {userMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-24px)] bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1.5 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-4 py-2.5 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-800 truncate">{userDisplayName}</p>
                <p className="text-[11px] text-slate-400 font-mono truncate">{user?.username || 'admin'}</p>
                <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-200">
                  {userRoleDisplay}
                </div>
              </div>

              <div className="py-1">
                <button
                  type="button"
                  onClick={() => {
                    navigate('/admin');
                    setUserMenuOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Dashboard
                </button>
                {user?.role === 'super_admin' && (
                  <button
                    type="button"
                    onClick={() => {
                      navigate('/admin/tenants');
                      setUserMenuOpen(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    Tenant & Admin Management
                  </button>
                )}
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setUserMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                >
                  <LogOut size={14} />
                  <span>Log out</span>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
