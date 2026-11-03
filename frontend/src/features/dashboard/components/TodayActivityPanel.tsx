/**
 * TodayActivityPanel.tsx
 *
 * Pastel Theme Analytics Panel: "Hours by Activity Code"
 * Harmonized with the dashboard's light pastel aesthetic.
 * Strictly scoped to the current tenant/project's actual activity codes and logged time entries.
 *
 * Features:
 * - Period filtering: Today (Live), Current Month (MTD), Current Year (YTD)
 * - Fixed height card with internal sleek vertical scrolling for activity codes
 * - Dual visual modes: Horizontal Bar Chart & Proportional Treemap
 * - KPI summary for Total Hours, OT Hours, and Workers
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  BarChart3, 
  LayoutGrid, 
  Clock, 
  Zap, 
  Users, 
  Activity,
  ArrowUpRight,
  Plus,
  Loader2
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BackendTimeEntry, ActivityCode } from '../../time-entries/services/timeEntryService';
import * as timeEntrySvc from '../../time-entries/services/timeEntryService';

export type ActivityTimePeriod = 'today' | 'month' | 'year';

interface SupervisorStatus {
  id: string;
  name: string;
  status: 'submitted' | 'in-progress' | 'not-started';
}

interface Props {
  totalSupervisors?: number;
  submittedCount?: number;
  inProgressCount?: number;
  supervisorStatuses?: SupervisorStatus[];
  todayEntries?: BackendTimeEntry[];
  activityCodes?: ActivityCode[];
}

// ── Harmonious Soft Pastel Palettes for Construction Activities ──
const COLOR_PALETTES = [
  {
    gradient: 'from-emerald-400 to-teal-400',
    bgLight: 'bg-emerald-50/70',
    border: 'border-emerald-200/80',
    textColor: 'text-emerald-800',
    badgeBg: 'bg-emerald-100/80 text-emerald-800',
    otBadge: 'bg-emerald-100/60 text-emerald-800',
  },
  {
    gradient: 'from-sky-400 to-blue-400',
    bgLight: 'bg-blue-50/70',
    border: 'border-blue-200/80',
    textColor: 'text-blue-800',
    badgeBg: 'bg-blue-100/80 text-blue-800',
    otBadge: 'bg-blue-100/60 text-blue-800',
  },
  {
    gradient: 'from-purple-400 to-indigo-300',
    bgLight: 'bg-purple-50/70',
    border: 'border-purple-200/80',
    textColor: 'text-purple-800',
    badgeBg: 'bg-purple-100/80 text-purple-800',
    otBadge: 'bg-purple-100/60 text-purple-800',
  },
  {
    gradient: 'from-amber-400 to-orange-300',
    bgLight: 'bg-amber-50/70',
    border: 'border-amber-200/80',
    textColor: 'text-amber-800',
    badgeBg: 'bg-amber-100/80 text-amber-800',
    otBadge: 'bg-amber-100/60 text-amber-800',
  },
  {
    gradient: 'from-rose-400 to-pink-300',
    bgLight: 'bg-rose-50/70',
    border: 'border-rose-200/80',
    textColor: 'text-rose-800',
    badgeBg: 'bg-rose-100/80 text-rose-800',
    otBadge: 'bg-rose-100/60 text-rose-800',
  },
  {
    gradient: 'from-cyan-400 to-teal-300',
    bgLight: 'bg-cyan-50/70',
    border: 'border-cyan-200/80',
    textColor: 'text-cyan-800',
    badgeBg: 'bg-cyan-100/80 text-cyan-800',
    otBadge: 'bg-cyan-100/60 text-cyan-800',
  },
];

function getPeriodRange(period: ActivityTimePeriod): { startDate: string; endDate: string; label: string } {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;

  if (period === 'today') {
    return { startDate: todayStr, endDate: todayStr, label: 'Today' };
  }
  if (period === 'month') {
    const monthStart = `${yyyy}-${mm}-01`;
    const monthName = now.toLocaleString('en-US', { month: 'short' });
    return { startDate: monthStart, endDate: todayStr, label: `${monthName} ${yyyy}` };
  }
  return { startDate: `${yyyy}-01-01`, endDate: todayStr, label: `Year ${yyyy}` };
}

function formatHours(val: number): string {
  if (val >= 1000) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return val.toFixed(1);
}

export default function TodayActivityPanel({
  todayEntries = [],
  activityCodes = [],
}: Props) {
  const [viewMode, setViewMode] = useState<'bar' | 'treemap'>('bar');
  const [period, setPeriod] = useState<ActivityTimePeriod>('today');
  const [periodEntries, setPeriodEntries] = useState<BackendTimeEntry[]>([]);
  const [isLoadingPeriod, setIsLoadingPeriod] = useState<boolean>(false);
  const cacheRef = useRef<Record<string, BackendTimeEntry[]>>({});

  const periodRange = useMemo(() => getPeriodRange(period), [period]);

  // Fetch entries for Month or Year if not in cache
  useEffect(() => {
    if (period === 'today') {
      return;
    }

    if (cacheRef.current[period]) {
      setPeriodEntries(cacheRef.current[period]);
      return;
    }

    let isMounted = true;
    setIsLoadingPeriod(true);

    const range = getPeriodRange(period);
    timeEntrySvc.getTimeEntries(undefined, undefined, range.startDate, range.endDate)
      .then((data) => {
        if (!isMounted) return;
        const entries = Array.isArray(data) ? data : [];
        cacheRef.current[period] = entries;
        setPeriodEntries(entries);
      })
      .catch((err) => {
        console.error(`Failed to fetch ${period} activity entries:`, err);
        if (isMounted) setPeriodEntries([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingPeriod(false);
      });

    return () => {
      isMounted = false;
    };
  }, [period]);

  // Determine active entries to aggregate
  const currentEntries = period === 'today' ? todayEntries : periodEntries;

  // Map project activity codes for easy title/description lookup
  const activityCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    (activityCodes || []).forEach((ac) => {
      if (ac.code) {
        map.set(ac.code.toLowerCase(), ac.description || ac.code);
      }
      if (ac.id) {
        map.set(ac.id, ac.description || ac.code);
      }
    });
    return map;
  }, [activityCodes]);

  // Aggregate currentEntries by Activity Code strictly for the project/tenant
  const { isLive, items, totalHours, totalOtHours, totalWorkers } = useMemo(() => {
    const map = new Map<string, {
      code: string;
      name: string;
      trade: string;
      category: string;
      regularHours: number;
      otHours: number;
      hours: number;
      workerIds: Set<string>;
    }>();

    (currentEntries || []).forEach((entry) => {
      const rawCode = entry.activity?.code || (entry.activityId ? `ACT-${entry.activityId.slice(0, 4)}` : '');
      const code = rawCode || 'GENERAL';
      const name =
        entry.activity?.description ||
        activityCodeMap.get(code.toLowerCase()) ||
        activityCodeMap.get(entry.activityId) ||
        entry.activity?.code ||
        'General Construction Activity';

      const reg = Number(entry.hours) || 0;
      const ot = Number(entry.overtimeHours) || 0;
      const total = reg + ot;

      if (!map.has(code)) {
        map.set(code, {
          code,
          name,
          trade: 'Site Works',
          category: 'Civil',
          regularHours: 0,
          otHours: 0,
          hours: 0,
          workerIds: new Set<string>(),
        });
      }

      const item = map.get(code)!;
      item.regularHours += reg;
      item.otHours += ot;
      item.hours += total;
      if (entry.employeeId) {
        item.workerIds.add(entry.employeeId);
      }
    });

    const activeList = Array.from(map.values())
      .filter((item) => item.hours > 0)
      .map((item, idx) => {
        const theme = COLOR_PALETTES[idx % COLOR_PALETTES.length];
        return {
          ...item,
          workers: item.workerIds.size || 1,
          ...theme,
        };
      })
      .sort((a, b) => b.hours - a.hours);

    if (activeList.length > 0) {
      const totH = activeList.reduce((sum, i) => sum + i.hours, 0);
      const totOt = activeList.reduce((sum, i) => sum + i.otHours, 0);
      const totW = activeList.reduce((sum, i) => sum + i.workers, 0);

      return {
        isLive: true,
        items: activeList,
        totalHours: totH,
        totalOtHours: totOt,
        totalWorkers: totW,
      };
    }

    // If no live logged hours, show the project's configured activity codes with 0h
    const projectCodesList = (activityCodes || []).slice(0, 8).map((ac, idx) => {
      const theme = COLOR_PALETTES[idx % COLOR_PALETTES.length];
      return {
        code: ac.code,
        name: ac.description || ac.code,
        trade: 'Site Task',
        category: 'Project Code',
        regularHours: 0,
        otHours: 0,
        hours: 0,
        workers: 0,
        ...theme,
      };
    });

    return {
      isLive: false,
      items: projectCodesList,
      totalHours: 0,
      totalOtHours: 0,
      totalWorkers: 0,
    };
  }, [currentEntries, activityCodes, activityCodeMap]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col h-[480px] transition-colors">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0 mb-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Activity size={16} className="text-emerald-600" />
              Hours by Activity Code
            </h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isLive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                : 'bg-slate-100 text-slate-600 border border-slate-200/80'
            }`}>
              {isLive ? `● ${periodRange.label}` : `${periodRange.label} (0h)`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Man-hours distribution across site construction tasks
          </p>
        </div>

        {/* Action Controls: Period Selector + View Switcher */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          {/* Period Tabs: Today / Month / Year */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 text-[11px] font-semibold">
            <button
              type="button"
              onClick={() => setPeriod('today')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                period === 'today'
                  ? 'bg-white text-slate-800 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Today's live hours"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setPeriod('month')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                period === 'month'
                  ? 'bg-white text-slate-800 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Current month hours"
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setPeriod('year')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                period === 'year'
                  ? 'bg-white text-slate-800 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Current year hours"
            >
              Year
            </button>
          </div>

          {/* View Switcher (Bar Chart vs Treemap) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setViewMode('bar')}
              className={[
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all',
                viewMode === 'bar'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              ].join(' ')}
              title="Horizontal Bar Chart View"
            >
              <BarChart3 size={13} />
              <span className="hidden md:inline">Bars</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('treemap')}
              className={[
                'flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all',
                viewMode === 'treemap'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              ].join(' ')}
              title="Proportional Treemap View"
            >
              <LayoutGrid size={13} />
              <span className="hidden md:inline">Treemap</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Summary Bar in Soft Pastel Tones ────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs flex-shrink-0 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <Clock size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block leading-tight font-medium">Total Hours</span>
            <span className="font-bold text-slate-800 font-mono text-sm leading-tight truncate block">
              {formatHours(totalHours)}h
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center flex-shrink-0">
            <Zap size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block leading-tight font-medium">Total OT</span>
            <span className="font-bold text-amber-700 font-mono text-sm leading-tight truncate block">
              +{formatHours(totalOtHours)}h
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <Users size={14} />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block leading-tight font-medium">
              {period === 'today' ? 'Deployed' : 'Active'}
            </span>
            <span className="font-bold text-slate-800 font-mono text-sm leading-tight truncate block">
              {totalWorkers} workers
            </span>
          </div>
        </div>
      </div>

      {/* ── Middle Scrollable Visualization Area (Fixed Height with Internal Scroll) ── */}
      {isLoadingPeriod ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-10 gap-2">
          <Loader2 size={24} className="text-emerald-500 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading {periodRange.label} data...</p>
        </div>
      ) : items.length === 0 ? (
        /* Empty State if no project activity codes configured & no entries */
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-2.5 shadow-2xs">
            <Activity size={18} className="text-slate-400" />
          </div>
          <p className="text-xs font-bold text-slate-700">No Activity Hours Recorded</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
            No logged hours found for {periodRange.label}.
          </p>
          <Link
            to="/admin/activity-codes"
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors shadow-2xs"
          >
            <Plus size={13} />
            <span>Manage Activity Codes</span>
          </Link>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto pr-1.5 custom-scrollbar">
          {/* ── Visualization: Bar Chart View (Soft Pastel) ─────────────────── */}
          {viewMode === 'bar' && (
            <div className="space-y-3 pt-0.5 pb-2">
              {items.map((act, index) => {
                const pct = totalHours > 0 ? Math.round((act.hours / totalHours) * 100) : 0;
                return (
                  <div key={act.code} className="space-y-1.5 group">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0 pr-2">
                        <span className="w-4 text-[10px] font-bold text-slate-400">#{index + 1}</span>
                        <span className="font-mono font-bold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                          {act.code}
                        </span>
                        <span className="font-semibold text-slate-700 truncate text-[11px]" title={act.name}>
                          {act.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 font-mono text-right">
                        <span className="font-bold text-slate-800 text-xs">
                          {formatHours(act.hours)}h
                        </span>
                        {act.otHours > 0 && (
                          <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded-full font-semibold hidden sm:inline">
                            +{formatHours(act.otHours)}h OT
                          </span>
                        )}
                        <span className="text-[10px] text-slate-400 w-8 text-right font-semibold">
                          {pct}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar with soft pastel gradient */}
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                      <div
                        className={`h-full bg-gradient-to-r ${act.gradient} rounded-full transition-all duration-500`}
                        style={{ width: `${totalHours > 0 ? Math.max(3, pct) : 0}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Visualization: Treemap View (Soft Pastel Cards) ─────────────── */}
          {viewMode === 'treemap' && (
            <div className="flex flex-wrap gap-2.5 pt-0.5 pb-2 content-start">
              {items.map((act) => {
                const pct = totalHours > 0 ? Math.round((act.hours / totalHours) * 100) : 0;
                const flexBasis = totalHours > 0 ? Math.max(120, Math.min(240, pct * 4)) : 140;

                return (
                  <div
                    key={act.code}
                    style={{ flex: totalHours > 0 ? `${pct} 1 ${flexBasis}px` : '1 1 140px' }}
                    className={`p-3 rounded-xl border ${act.border} ${act.bgLight} flex flex-col justify-between transition-all duration-200 hover:scale-[1.01] hover:shadow-xs relative overflow-hidden group min-h-[96px]`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/90 text-slate-700 shadow-2xs border border-slate-200/50">
                        {act.code}
                      </span>
                      <span className={`text-[11px] font-extrabold ${act.textColor} font-mono`}>
                        {totalHours > 0 ? `${pct}%` : '0%'}
                      </span>
                    </div>

                    <div className="my-1.5">
                      <p className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:line-clamp-none transition-all">
                        {act.name}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {act.trade} {act.workers > 0 ? `· ${act.workers} workers` : ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                      <span className="font-extrabold text-slate-800 font-mono">
                        {formatHours(act.hours)} hrs
                      </span>
                      {act.otHours > 0 && (
                        <span className="text-[9px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200/60 px-1.5 py-0.2 rounded-md">
                          +{formatHours(act.otHours)}h OT
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Footer Link (Pinned at Bottom) ─────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs flex-shrink-0 mt-auto">
        <span className="text-[11px] text-slate-400">
          {isLive
            ? `Showing ${items.length} active tasks (${periodRange.label})`
            : `${items.length} project codes configured`}
        </span>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/activity-codes"
            className="text-xs font-semibold text-slate-600 hover:text-slate-800 hover:underline flex items-center gap-1 transition-colors"
          >
            <span>Activity Codes</span>
          </Link>
          <span className="text-slate-200">•</span>
          <Link
            to="/admin/reports"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 hover:underline flex items-center gap-1 transition-colors"
          >
            <span>Full Labor Report</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}
