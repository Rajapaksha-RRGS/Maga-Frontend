/**
 * SuperAdminHeader.tsx
 *
 * Top bar for the Super Admin (Head Office) portal.
 * Themed in Imperial Gold + Deep Purple to visually distinguish
 * the global HQ privilege tier from the site-level Admin portal.
 *
 * Features:
 *  - Mobile hamburger toggle
 *  - Current page title (derived from route)
 *  - "HEAD OFFICE" live status badge
 *  - Date display
 *  - Notifications bell (reuses NotificationContext)
 *  - User profile dropdown with logout
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
  Trash2,
  Crown,
  Globe,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications, type NotificationItem } from '../context/NotificationContext';

interface Props {
  onOpenMobileNav: () => void;
}

export default function SuperAdminHeader({ onOpenMobileNav }: Props) {
  const { user, logout } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead, removeNotification } =
    useNotifications();

  const [notifOpen, setNotifOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();

  // Close dropdowns on outside click
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

  function getGreeting(): { text: string; Icon: typeof Sun } {
    const h = new Date().getHours();
    if (h < 12) return { text: 'Good morning', Icon: Sun };
    if (h < 17) return { text: 'Good afternoon', Icon: Sun };
    if (h < 20) return { text: 'Good evening', Icon: Sunset };
    return { text: 'Good night', Icon: Moon };
  }

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/super-admin' || path === '/super-admin/dashboard') return null;
    if (path.includes('/super-admin/projects')) return 'Projects & Admins';
    if (path.includes('/super-admin/employees')) return 'Global Employee Master';
    if (path.includes('/super-admin/business-partners')) return 'Business Partners';
    if (path.includes('/super-admin/equipment')) return 'Global Equipment Master';
    if (path.includes('/super-admin/trade-groups')) return 'Trade Groups';
    if (path.includes('/super-admin/activity-codes')) return 'Activity Codes';
    if (path.includes('/super-admin/transfers')) return 'Inter-Project Transfers';
    if (path.includes('/super-admin/settings')) return 'System Settings';
    return null;
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
        return <AlertTriangle size={15} className="text-amber-500 flex-shrink-0" />;
      case 'error':
        return <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />;
      case 'success':
        return <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />;
      default:
        return <Info size={15} className="text-violet-400 flex-shrink-0" />;
    }
  };

  const userDisplayName = user?.fullName || user?.username || 'Super Admin';
  const userInitials = userDisplayName
    .split(' ')
    .map((w) => w[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  const pageTitle = getPageTitle();
  const displayName = user?.fullName?.split(' ')[0] ?? user?.username ?? 'Admin';
  const { text: greetingText, Icon: GreetingIcon } = getGreeting();

  return (
    <header className="h-[52px] bg-white border-b border-violet-100 px-4 md:px-6 flex items-center justify-between z-20 flex-shrink-0 select-none shadow-sm shadow-violet-900/5">

      {/* ── Left: Mobile Toggle & Page Context ─────────────────────── */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileNav}
          className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-violet-600 hover:text-violet-900 hover:bg-violet-50 transition-colors"
          aria-label="Open sidebar"
        >
          <Menu size={18} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          {pageTitle ? (
            <span className="text-xs font-semibold text-slate-800 tracking-tight whitespace-nowrap">
              {pageTitle}
            </span>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 tracking-tight whitespace-nowrap">
              <GreetingIcon size={15} className="text-[#C9A84C] flex-shrink-0" />
              <span>{greetingText}, {displayName}!</span>
            </div>
          )}

          <span className="hidden sm:inline-block text-slate-300">•</span>

          {/* HEAD OFFICE Badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-[#C9A84C] bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-full">
            <Crown size={10} className="text-[#C9A84C]" />
            <span>HEAD OFFICE</span>
          </div>
        </div>
      </div>

      {/* ── Right: Date, Notifications & User Profile ─────────────── */}
      <div className="flex items-center gap-2 md:gap-3">

        {/* Date Badge */}
        <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 font-medium bg-violet-50/50 border border-violet-100 px-2.5 py-1 rounded-lg">
          <Calendar size={13} className="text-violet-400" />
          <span>{todayFormatted}</span>
        </div>

        {/* Notification Bell */}
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
                ? 'bg-violet-100 text-violet-700'
                : 'text-slate-500 hover:text-violet-700 hover:bg-violet-50',
            ].join(' ')}
            aria-label="Notifications"
            aria-expanded={notifOpen}
          >
            <Bell size={17} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#C9A84C] border border-white" />
            )}
          </button>

          {notifOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-80 bg-white rounded-xl border border-violet-100 shadow-xl shadow-violet-900/10 z-50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-violet-50 bg-violet-50/50">
                <span className="text-sm font-semibold text-slate-800">Notifications</span>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-violet-600 hover:text-violet-800 font-medium transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* List */}
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center">
                    <Globe size={28} className="text-violet-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400">No notifications</p>
                  </div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={[
                        'flex items-start gap-3 px-4 py-3 hover:bg-violet-50/40 transition-colors cursor-pointer border-b border-slate-50 last:border-0',
                        !n.read ? 'bg-violet-50/30' : '',
                      ].join(' ')}
                      onClick={() => handleNotificationClick(n)}
                    >
                      {getNotifIcon(n.type)}
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-snug ${!n.read ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                          {n.message}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{n.timestamp}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                        className="text-slate-300 hover:text-slate-500 transition-colors flex-shrink-0 mt-0.5"
                        aria-label="Dismiss"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotifOpen(false);
            }}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-violet-50 transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:outline-none"
            aria-expanded={userMenuOpen}
            aria-haspopup="true"
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#C9A84C] to-[#a07830] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 shadow-sm">
              {userInitials}
            </div>
            <div className="hidden sm:block text-left min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate max-w-[100px] leading-tight">
                {userDisplayName.split(' ')[0]}
              </p>
              <p className="text-[10px] text-[#C9A84C] font-medium leading-tight">Super Admin</p>
            </div>
            <ChevronDown
              size={13}
              className={`text-slate-400 transition-transform duration-200 flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] w-56 bg-white rounded-xl border border-violet-100 shadow-xl shadow-violet-900/10 z-50 overflow-hidden">
              {/* User info */}
              <div className="px-4 py-3 bg-gradient-to-br from-[#1A0A2E] to-[#0D0720] border-b border-violet-500/20">
                <p className="text-xs font-semibold text-white">{userDisplayName}</p>
                <p className="text-[10px] text-[#C9A84C] mt-0.5">👑 Global Super Admin</p>
              </div>

              {/* Actions */}
              <div className="py-1">
                <button
                  type="button"
                  onClick={() => { setUserMenuOpen(false); logout(); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
