import { useState } from 'react';
import { 
  Wifi, 
  WifiOff, 
  RotateCw, 
  Sun, 
  Moon, 
  Menu, 
  CheckCircle2
} from 'lucide-react';
import { useTheme } from '../../../context/ThemeContext';
import { type SiteProject } from '../services/supervisorStorageService';
import magaLogo from '../../../assets/maga-logo-47321F1221-seeklogo.com.png';

interface SupervisorTopBarProps {
  currentSite: SiteProject;
  onSelectSite?: (site: SiteProject) => void;
  pendingSyncCount: number;
  onSync: () => Promise<void>;
  isSyncing: boolean;
  onOpenDrawer: () => void;
}

export function SupervisorTopBar({
  currentSite,
  pendingSyncCount,
  onSync,
  isSyncing,
  onOpenDrawer,
}: SupervisorTopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const [syncSuccessToast, setSyncSuccessToast] = useState(false);

  const handleSyncClick = async () => {
    if (isSyncing) return;
    await onSync();
    setSyncSuccessToast(true);
    setTimeout(() => setSyncSuccessToast(false), 2500);
  };

  return (
    <header className="sticky top-0 z-40 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors shadow-xs">
      <div className="  px-3.5 py-2.5 flex items-center justify-between gap-2">
        {/* Left: Mäga Brand Logo & Assigned Site */}
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-white dark:bg-slate-800 p-0.5 flex items-center justify-center flex-shrink-0 shadow-xs border border-slate-200 dark:border-slate-700">
            <img
              src={magaLogo}
              alt="Mäga Logo"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase tracking-wider block leading-tight">
              MÄGA FIELD
            </span>
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate leading-tight">
              {currentSite.name}
            </p>
          </div>
        </div>

        {/* Right Actions: Sync Status, Theme Toggle, Drawer */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Offline Sync Status & Trigger */}
          <button
            type="button"
            onClick={handleSyncClick}
            disabled={isSyncing}
            title={pendingSyncCount > 0 ? `${pendingSyncCount} drafts waiting to sync` : 'All drafts synced'}
            className={[
              'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border transition-all',
              pendingSyncCount > 0
                ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 active:scale-95'
                : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100'
            ].join(' ')}
          >
            {isSyncing ? (
              <RotateCw size={14} className="animate-spin text-blue-600 dark:text-blue-400" />
            ) : pendingSyncCount > 0 ? (
              <WifiOff size={14} className="text-amber-600 dark:text-amber-400" />
            ) : (
              <Wifi size={14} className="text-emerald-600 dark:text-emerald-400" />
            )}
            <span className="tabular-nums">
              {isSyncing ? 'Syncing…' : pendingSyncCount > 0 ? `${pendingSyncCount}` : 'Synced'}
            </span>
          </button>

          {/* Theme Toggle Button (Light/Dark) */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95 border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
          >
            {theme === 'dark' ? (
              <Sun size={17} className="text-amber-400" />
            ) : (
              <Moon size={17} className="text-slate-600" />
            )}
          </button>

          {/* Side Drawer Toggle Button */}
          <button
            type="button"
            onClick={onOpenDrawer}
            aria-label="Open navigation menu"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Sync Success Floating Notification */}
      {syncSuccessToast && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-[-42px] z-50 bg-emerald-700 text-white text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1">
          <CheckCircle2 size={14} />
          <span>All offline drafts synced to server successfully!</span>
        </div>
      )}
    </header>
  );
}
