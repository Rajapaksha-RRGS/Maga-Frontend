import { 
  X, 
  Building2, 
  RotateCw, 
  Sun, 
  Moon, 
  LogOut, 
  HardHat, 
  ShieldCheck
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { MASTER_SITES, type SiteProject } from '../services/supervisorStorageService';

interface SupervisorDrawerProps {
  open: boolean;
  onClose: () => void;
  currentSite: SiteProject;
  onSelectSite: (site: SiteProject) => void;
  pendingSyncCount: number;
  onSync: () => Promise<void>;
  isSyncing: boolean;
}

export function SupervisorDrawer({
  open,
  onClose,
  currentSite,
  onSelectSite,
  pendingSyncCount,
  onSync,
  isSyncing,
}: SupervisorDrawerProps) {
  const { theme, setTheme } = useTheme();
  const { user, logout } = useAuth();

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-xs w-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col z-50 animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white flex items-center justify-center">
              <HardHat size={18} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Supervisor Menu
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Mäga Field Operations v2.4
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* User Profile Card */}
          <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold flex items-center justify-center text-base border border-blue-200 dark:border-blue-700 flex-shrink-0">
              {user?.fullName?.charAt(0) || 'S'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {user?.fullName || 'Field Supervisor'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                EPF No: SUP-8829 · {user?.username || 'supervisor'}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  <ShieldCheck size={11} /> Authorized Gang Lead
                </span>
              </div>
            </div>
          </div>

          {/* Current Project / Site Switcher
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              Assigned Project Site
            </label>
            <div className="space-y-1.5">
              {MASTER_SITES.map((site) => {
                const isSelected = site.id === currentSite.id;
                return (
                  <button
                    key={site.id}
                    type="button"
                    onClick={() => {
                      onSelectSite(site);
                    }}
                    className={[
                      'w-full text-left p-2.5 rounded-lg border text-xs transition-all flex items-start gap-2.5',
                      isSelected
                        ? 'border-blue-600 dark:border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 shadow-xs'
                        : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                    ].join(' ')}
                  >
                    <Building2 size={16} className={isSelected ? 'text-blue-600 dark:text-blue-400 mt-0.5' : 'text-slate-400 mt-0.5'} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{site.name}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">{site.code} · {site.location}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div> */}

          {/* Offline Sync & Storage Tools */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              Offline Cache & Sync Engine
            </label>
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-400">Pending Local Drafts:</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {pendingSyncCount} {pendingSyncCount === 1 ? 'item' : 'items'}
                </span>
              </div>
              <button
                type="button"
                onClick={onSync}
                disabled={isSyncing}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs transition-colors disabled:opacity-50"
              >
                <RotateCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>{isSyncing ? 'Synchronizing with ERP…' : 'Sync All Pending Records'}</span>
              </button>
            </div>
          </div>

          {/* Theme Selector */}
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block mb-2">
              Interface Theme
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={[
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all',
                  theme === 'light'
                    ? 'border-blue-600 bg-blue-50 text-blue-700 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                ].join(' ')}
              >
                <Sun size={15} className={theme === 'light' ? 'text-amber-500' : 'text-slate-400'} />
                <span>Light</span>
              </button>
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={[
                  'flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all',
                  theme === 'dark'
                    ? 'border-blue-500 bg-blue-900/40 text-blue-300 font-semibold'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                ].join(' ')}
              >
                <Moon size={15} className={theme === 'dark' ? 'text-blue-400' : 'text-slate-400'} />
                <span>Dark</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer with Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
          <button
            type="button"
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 font-medium text-xs transition-colors"
          >
            <LogOut size={16} />
            <span>Sign out of Supervisor App</span>
          </button>
        </div>
      </div>
    </div>
  );
}
