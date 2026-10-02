import { 
  Users, 
  HardHat, 
  Tractor, 
  Sparkles, 
  CheckCircle2, 
  RotateCw, 
  ChevronRight, 
  FileEdit,
  Bell
} from 'lucide-react';
import type { 
  LaborerEntry, 
  OperatorEntry, 
  EquipmentLogEntry, 
  SiteProject 
} from '../services/supervisorStorageService';
import type { CalendarEvent } from '../../calendar/services/calendarEventService';

interface SupervisorDashboardViewProps {
  supervisorName: string;
  currentSite: SiteProject;
  laborers: LaborerEntry[];
  operators: OperatorEntry[];
  equipment: EquipmentLogEntry[];
  pendingSyncCount: number;
  isDayLocked: boolean;
  reminders?: CalendarEvent[];
  onOpenNotifications?: () => void;
  onNavigateTab: (tab: 'labor' | 'operators' | 'equipment' | 'summary') => void;
  onQuickSync: () => void;
}

export function SupervisorDashboardView({
  supervisorName,
  currentSite,
  laborers,
  operators,
  equipment,
  pendingSyncCount,
  isDayLocked,
  reminders = [],
  onOpenNotifications,
  onNavigateTab,
  onQuickSync,
}: SupervisorDashboardViewProps) {
  // Metrics calculation
  const totalLaborers = laborers.length;
  const doneLaborers = laborers.filter((l) => l.status === 'done' || (l.inTime && l.outTime)).length;

  const totalOperators = operators.length;
  const mappedOperators = operators.filter((o) => o.assignedEquipmentId && o.inTime).length;

  const totalEquipment = equipment.length;
  const isEquipmentLogged = (e: EquipmentLogEntry): boolean => {
    if (e.status === 'done') return true;
    if ((Number(e.daysValue) || 0) > 0) return true;
    if ((Number(e.hoursValue) || 0) > 0) return true;
    if ((Number(e.extraHoursValue) || 0) > 0) return true;
    if ((Number(e.areaValue) || 0) > 0) return true;
    if ((Number(e.totalMileage) || 0) > 0) return true;
    if ((Number(e.netHours) || 0) > 0) return true;
    if ((Number(e.workingHours) || 0) > 0) return true;
    if (Number(e.endMeter) > 0 && Number(e.endMeter) > Number(e.startMeter)) return true;
    if (e.activitySplits && e.activitySplits.some((s) => Number(s.utilization) > 0)) return true;
    return false;
  };
  const runningEquipment = equipment.filter(isEquipmentLogged).length;

  // Total daily hours (safely cast to Number to prevent string concatenation and .toFixed crash)
  const totalLaborHours = (laborers || []).reduce((acc, l) => acc + (Number(l.shiftHours) || 0), 0);
  const totalOtHours = (laborers || []).reduce((acc, l) => acc + (Number(l.otHours) || 0), 0);
  const totalMachineHours = (equipment || []).reduce((acc, e) => {
    const hoursVal = Number(e.hoursValue) || 0;
    const netHrs = Number(e.netHours) || 0;
    const workHrs = Number(e.workingHours) || 0;
    const hrs = hoursVal > 0 ? hoursVal : (netHrs > 0 ? netHrs : workHrs);
    const exHrs = Number(e.extraHoursValue) || 0;
    return acc + hrs + exHrs;
  }, 0);

  // Completion Progress calculation
  const totalItems = totalLaborers + totalOperators + totalEquipment;
  const completedItems = doneLaborers + mappedOperators + runningEquipment;
  const completionPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  // Recent In-Progress / Unfinished Drafts for Quick Resumption
  const recentLaborDrafts = laborers.filter((l) => l.inTime && !l.outTime);
  const recentOperatorDrafts = operators.filter((o) => o.inTime && !o.assignedEquipmentId);
  const recentEquipmentDrafts = equipment.filter((e) => 
    (e.startMeter > 0 && e.endMeter === 0) || 
    (e.startMileage && e.startMileage > 0 && (!e.endMileage || e.endMileage === 0))
  );

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-200">
      {/* ── Lock / Submission Banner if submitted ───────────────────────────── */}
      {isDayLocked && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-3.5 flex items-start gap-3 shadow-xs">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 dark:text-emerald-300">
                Daily Work Roster Submitted & Locked
              </h4>
              <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold uppercase bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100">
                Verified
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5">
              Attendance and machine meter readings for this shift have been signed off and locked.
            </p>
          </div>
        </div>
      )}

      {/* ── Admin Reminders / Tasks Notification Banner ─────────────────────── */}
      {reminders && reminders.length > 0 && (
        <button
          type="button"
          onClick={onOpenNotifications}
          className="w-full text-left bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition-all active:scale-[0.99] cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Bell size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {reminders.length} Site {reminders.length === 1 ? 'Task / Reminder' : 'Tasks / Reminders'}
                </span>
                {reminders.some((r) => r.priority === 'urgent') && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-500 text-white shadow-2xs">
                    🔥 Urgent
                  </span>
                )}
                {reminders.some((r) => r.priority === 'important') && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500 text-white shadow-2xs">
                    ⚡ Important
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
                {reminders[0].title}
                {reminders[0].time ? ` (${reminders[0].time})` : ''}
              </p>
            </div>
          </div>
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-0.5 flex-shrink-0">
            View <ChevronRight size={14} />
          </span>
        </button>
      )}

      {/* ── Hero Welcome Card ─────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-900 rounded-2xl p-4 text-white shadow-md relative overflow-hidden">
        {/* Subtle decorative background circle */}
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-white/5 rounded-full blur-xl pointer-events-none" />

        <div className="relative z-10 flex items-start justify-between">
          <div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/15 text-blue-100 backdrop-blur-xs mb-1.5">
              <Sparkles size={11} className="text-amber-300" /> Live Field Operations
            </span>
            <h1 className="text-base font-bold tracking-tight text-white">
              Ayubowan, {supervisorName}
            </h1>
            <p className="text-xs text-blue-100/90 mt-0.5 max-w-[240px] truncate">
              {currentSite?.name || 'Mäga Site Operations'}
            </p>
          </div>

          {/* Progress Ring / Percentage */}
          <div className="flex flex-col items-center justify-center bg-white/10 rounded-xl p-2.5 backdrop-blur-xs border border-white/10 text-center min-w-[68px]">
            <span className="text-lg font-bold tabular-nums leading-none">
              {isDayLocked ? 100 : completionPct}%
            </span>
            <span className="text-[9px] text-blue-200 mt-0.5 uppercase tracking-wider font-medium">
              Completed
            </span>
          </div>
        </div>

        {/* Live Daily Totals Bar */}
        <div className="mt-3.5 pt-3 border-t border-white/15 grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-[10px] text-blue-200 font-medium">Labor Hours</p>
            <p className="font-bold text-sm text-white tabular-nums mt-0.5">{(Number(totalLaborHours) || 0).toFixed(1)}h</p>
          </div>
          <div className="border-x border-white/15">
            <p className="text-[10px] text-blue-200 font-medium">Total OT</p>
            <p className="font-bold text-sm text-amber-300 tabular-nums mt-0.5">+{(Number(totalOtHours) || 0).toFixed(1)}h</p>
          </div>
          <div>
            <p className="text-[10px] text-blue-200 font-medium">Machinery</p>
            <p className="font-bold text-sm text-emerald-300 tabular-nums mt-0.5">{(Number(totalMachineHours) || 0).toFixed(1)}h</p>
          </div>
        </div>
      </div>

      {/* ── 4 KPI Stats Grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card 1: Assigned Laborers */}
        <button
          type="button"
          onClick={() => onNavigateTab('labor')}
          className="text-left p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:border-blue-500 dark:hover:border-blue-500 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <Users size={16} />
            </div>
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Log <ChevronRight size={12} />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {doneLaborers}<span className="text-xs font-normal text-slate-400">/{totalLaborers}</span>
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Laborers Checked-In
          </p>
        </button>

        {/* Card 2: Operators on Duty */}
        <button
          type="button"
          onClick={() => onNavigateTab('operators')}
          className="text-left p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:border-amber-500 dark:hover:border-amber-500 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 flex items-center justify-center">
              <HardHat size={16} />
            </div>
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              View <ChevronRight size={12} />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {mappedOperators}<span className="text-xs font-normal text-slate-400">/{totalOperators}</span>
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Operators Mapped
          </p>
        </button>

        {/* Card 3: Active Equipment */}
        <button
          type="button"
          onClick={() => onNavigateTab('equipment')}
          className="text-left p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:border-emerald-500 dark:hover:border-emerald-500 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 flex items-center justify-center">
              <Tractor size={16} />
            </div>
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
              Meters <ChevronRight size={12} />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {runningEquipment}<span className="text-xs font-normal text-slate-400">/{totalEquipment}</span>
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            Equipment Running
          </p>
        </button>

        {/* Card 4: Draft & Sync Status */}
        <button
          type="button"
          onClick={onQuickSync}
          className="text-left p-3 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-2xs hover:border-indigo-500 dark:hover:border-indigo-500 transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center">
              <RotateCw size={16} className={pendingSyncCount > 0 ? 'text-amber-500' : ''} />
            </div>
            <span className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-0.5">
              Sync <ChevronRight size={12} />
            </span>
          </div>
          <p className="text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
            {pendingSyncCount}
          </p>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {pendingSyncCount > 0 ? 'Drafts Pending Sync' : 'All Data Synced'}
          </p>
        </button>
      </div>

      {/* ── Quick Action Shortcuts ───────────────────────────────────────────── */}
      <div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
          Supervisor Quick Actions
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onNavigateTab('labor')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-blue-900 dark:text-blue-200 font-semibold text-xs hover:bg-blue-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-blue-700 text-white flex items-center justify-center flex-shrink-0">
              <Users size={15} />
            </div>
            <div className="text-left min-w-0">
              <p className="truncate">Labor In / Out</p>
              <p className="text-[10px] font-normal text-blue-700 dark:text-blue-400">Record attendance</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('operators')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 font-semibold text-xs hover:bg-amber-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-amber-600 text-white flex items-center justify-center flex-shrink-0">
              <HardHat size={15} />
            </div>
            <div className="text-left min-w-0">
              <p className="truncate">Operator Entry</p>
              <p className="text-[10px] font-normal text-amber-700 dark:text-amber-400">Machine mapping</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('equipment')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-900 dark:text-emerald-200 font-semibold text-xs hover:bg-emerald-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
              <Tractor size={15} />
            </div>
            <div className="text-left min-w-0">
              <p className="truncate">Equipment Logs</p>
              <p className="text-[10px] font-normal text-emerald-700 dark:text-emerald-400">Meter readings</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('summary')}
            className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 font-semibold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-slate-700 dark:bg-slate-600 text-white flex items-center justify-center flex-shrink-0">
              <CheckCircle2 size={15} />
            </div>
            <div className="text-left min-w-0">
              <p className="truncate">Daily Summary</p>
              <p className="text-[10px] font-normal text-slate-500 dark:text-slate-400">Submit & lock day</p>
            </div>
          </button>
        </div>
      </div>


      {/* ── Saved Drafts Quick Resumption ────────────────────────────────────── */}
      {(recentLaborDrafts.length > 0 || recentOperatorDrafts.length > 0 || recentEquipmentDrafts.length > 0) && (
        <div className="bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
              <FileEdit size={15} />
              <h4 className="text-xs font-bold uppercase tracking-wider">
                Unfinished Draft Entries ({recentLaborDrafts.length + recentOperatorDrafts.length + recentEquipmentDrafts.length})
              </h4>
            </div>
            <span className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">
              Saved offline
            </span>
          </div>

          <div className="space-y-1.5">
            {recentLaborDrafts.slice(0, 2).map((l) => (
              <div 
                key={l.id}
                onClick={() => onNavigateTab('labor')}
                className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200/60 dark:border-slate-700 text-xs cursor-pointer hover:border-amber-400 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-semibold text-[10px] flex items-center justify-center">
                    {l.callingName.charAt(0)}
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{l.callingName}</p>
                    <p className="text-[10px] text-slate-400">In: {l.inTime || '—'} · Out: {l.outTime || 'Pending'}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                  Resume <ChevronRight size={12} />
                </span>
              </div>
            ))}
            {recentEquipmentDrafts.slice(0, 1).map((e) => (
              <div 
                key={e.id}
                onClick={() => onNavigateTab('equipment')}
                className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-amber-200/60 dark:border-slate-700 text-xs cursor-pointer hover:border-amber-400 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 font-semibold text-[10px] flex items-center justify-center">
                    EQ
                  </span>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">{e.name}</p>
                    <p className="text-[10px] text-slate-400">Start: {e.startMeter} · End: {e.endMeter || 'Pending'}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                  Resume <ChevronRight size={12} />
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
