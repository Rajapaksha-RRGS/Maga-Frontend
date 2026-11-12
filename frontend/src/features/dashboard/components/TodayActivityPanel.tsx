/**
 * TodayActivityPanel.tsx
 *
 * Analytics Panel: "Hours by Activity Code"
 * Harmonized with the dashboard's light pastel aesthetic.
 * Strictly scoped to the current tenant/project's actual activity codes and logged time entries.
 *
 * Unified Single Container Filter:
 * - [ Day ▾ ] [ Month ▾ ] [ Year ▾ ]
 * - Specific Day selected -> Filters for that specific day
 * - Day left as "Day" + Month & Year selected -> Filters for that entire month
 * - Month left as "Month" + Year selected -> Filters for that entire year
 * - One-click "Today" shortcut button
 * - Horizontal Bar Chart view with internal vertical scrolling and fixed panel height (h-[480px])
 * - Instant in-memory caching for snappy navigation
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Clock, 
  Zap, 
  Users, 
  Activity,
  ArrowUpRight,
  Plus,
  Loader2,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BackendTimeEntry, ActivityCode } from '../../time-entries/services/timeEntryService';
import * as timeEntrySvc from '../../time-entries/services/timeEntryService';

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

const MONTHS = [
  { value: '01', label: 'Jan' },
  { value: '02', label: 'Feb' },
  { value: '03', label: 'Mar' },
  { value: '04', label: 'Apr' },
  { value: '05', label: 'May' },
  { value: '06', label: 'Jun' },
  { value: '07', label: 'Jul' },
  { value: '08', label: 'Aug' },
  { value: '09', label: 'Sep' },
  { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Dec' },
];

function getDaysInMonth(year: number, monthStr: string): number {
  if (!monthStr) return 31;
  const m = Number(monthStr);
  return new Date(year, m, 0).getDate();
}

function formatHours(val: number): string {
  if (val >= 1000) {
    return val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return val.toFixed(1);
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

export default function TodayActivityPanel({
  todayEntries = [],
  activityCodes = [],
}: Props) {
  // Current calendar snapshot
  const now = useMemo(() => new Date(), []);
  const currentY = useMemo(() => now.getFullYear(), [now]);
  const currentM = useMemo(() => String(now.getMonth() + 1).padStart(2, '0'), [now]);
  const currentD = useMemo(() => String(now.getDate()).padStart(2, '0'), [now]);
  const todayStr = useMemo(() => `${currentY}-${currentM}-${currentD}`, [currentY, currentM, currentD]);

  // Unified Filter States (defaults to Today)
  const [selectedYear, setSelectedYear] = useState<number>(currentY);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentM);
  const [selectedDay, setSelectedDay] = useState<string>(currentD);

  // Data & Loading States
  const [entries, setEntries] = useState<BackendTimeEntry[]>(todayEntries || []);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const cacheRef = useRef<Record<string, BackendTimeEntry[]>>({});

  // Dynamic Year Options (Current year + 1 down to -4 years)
  const yearOptions = useMemo(() => {
    const list: number[] = [];
    for (let y = currentY + 1; y >= currentY - 4; y--) {
      list.push(y);
    }
    return list;
  }, [currentY]);

  // Available days in selected month (1..28/29/30/31)
  const daysInSelectedMonth = useMemo(() => {
    const max = getDaysInMonth(selectedYear, selectedMonth);
    const arr: string[] = [];
    for (let i = 1; i <= max; i++) {
      arr.push(String(i).padStart(2, '0'));
    }
    return arr;
  }, [selectedYear, selectedMonth]);

  // Clamp day if month change causes day to exceed max days
  useEffect(() => {
    if (selectedDay && selectedMonth) {
      const max = getDaysInMonth(selectedYear, selectedMonth);
      if (Number(selectedDay) > max) {
        setSelectedDay(String(max).padStart(2, '0'));
      }
    }
  }, [selectedYear, selectedMonth, selectedDay]);

  // Compute Active Query Range & Display Labels
  const { startDate, endDate, queryMode, displayLabel, badgeLabel, isToday } = useMemo(() => {
    // 1. Year Mode: Month is not selected ("Month")
    if (!selectedMonth) {
      return {
        startDate: `${selectedYear}-01-01`,
        endDate: `${selectedYear}-12-31`,
        queryMode: 'year' as const,
        displayLabel: `Year ${selectedYear}`,
        badgeLabel: `● Year ${selectedYear} (Full Year)`,
        isToday: false,
      };
    }

    const monthObj = MONTHS.find((m) => m.value === selectedMonth);
    const monthName = monthObj ? monthObj.label : selectedMonth;

    // 2. Month Mode: Day is not selected ("Day"), but Month is selected
    if (!selectedDay) {
      const maxDays = getDaysInMonth(selectedYear, selectedMonth);
      return {
        startDate: `${selectedYear}-${selectedMonth}-01`,
        endDate: `${selectedYear}-${selectedMonth}-${String(maxDays).padStart(2, '0')}`,
        queryMode: 'month' as const,
        displayLabel: `${monthName} ${selectedYear}`,
        badgeLabel: `● ${monthName} ${selectedYear} (Full Month)`,
        isToday: false,
      };
    }

    // 3. Day Mode: Specific Day, Month, and Year are all selected
    const dateStr = `${selectedYear}-${selectedMonth}-${selectedDay}`;
    const isMatchToday = dateStr === todayStr;

    return {
      startDate: dateStr,
      endDate: dateStr,
      queryMode: 'day' as const,
      displayLabel: isMatchToday ? 'Today' : `${selectedDay} ${monthName} ${selectedYear}`,
      badgeLabel: isMatchToday ? '● Live Today' : `● ${selectedDay} ${monthName} ${selectedYear}`,
      isToday: isMatchToday,
    };
  }, [selectedYear, selectedMonth, selectedDay, todayStr]);

  // Fetch entries when active query range changes
  useEffect(() => {
    // If Day mode viewing Today and we already have todayEntries from props
    if (queryMode === 'day' && isToday && todayEntries && todayEntries.length > 0) {
      setEntries(todayEntries);
      setIsLoading(false);
      return;
    }

    const cacheKey = `${queryMode}_${startDate}_${endDate}`;
    if (cacheRef.current[cacheKey]) {
      setEntries(cacheRef.current[cacheKey]);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const fetchPromise = queryMode === 'day'
      ? timeEntrySvc.getTimeEntries(undefined, startDate)
      : timeEntrySvc.getTimeEntries(undefined, undefined, startDate, endDate);

    fetchPromise
      .then((data) => {
        if (!isMounted) return;
        const list = Array.isArray(data) ? data : [];
        cacheRef.current[cacheKey] = list;
        setEntries(list);
      })
      .catch((err) => {
        console.error('Failed to fetch activity code entries:', err);
        if (isMounted) setEntries([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [queryMode, startDate, endDate, isToday, todayEntries]);

  // Sync todayEntries when props update while on today
  useEffect(() => {
    if (queryMode === 'day' && isToday && todayEntries && todayEntries.length > 0) {
      setEntries(todayEntries);
    }
  }, [todayEntries, queryMode, isToday]);

  // Map project activity codes for title/description lookup
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

  // Aggregate entries by Activity Code
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

    (entries || []).forEach((entry) => {
      (entry.activitySplits || []).forEach((split) => {
        const rawCode = split.activityCode?.code || (split.activityCodeId ? `ACT-${split.activityCodeId.slice(0, 4)}` : '');
        const code = rawCode || 'GENERAL';
        const name =
          split.activityCode?.description ||
          activityCodeMap.get(code.toLowerCase()) ||
          activityCodeMap.get(split.activityCodeId) ||
          split.activityCode?.code ||
          'General Construction Activity';

        const splitHours = Number(split.hours) || 0;
        if (splitHours <= 0) return;

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
        item.regularHours += splitHours;
        item.hours += splitHours;
        if (entry.employeeId) {
          item.workerIds.add(entry.employeeId);
        }
      });
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

    // If no live logged hours, show project's configured activity codes with 0h
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
  }, [entries, activityCodes, activityCodeMap]);

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
              {isLive ? badgeLabel : `${displayLabel} (0h)`}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Man-hours distribution across site construction tasks
          </p>
        </div>

        {/* ── Unified Single Container Filter: [ Day ▾ ] [ Month ▾ ] [ Year ▾ ] ── */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          <div className="inline-flex items-center bg-slate-50 border border-slate-200/90 rounded-xl p-1 shadow-2xs divide-x divide-slate-200/80">
            {/* Day Dropdown */}
            <div className="relative px-1">
              <select
                value={selectedDay}
                disabled={!selectedMonth}
                onChange={(e) => setSelectedDay(e.target.value)}
                className={`text-xs bg-transparent border-none focus:outline-none cursor-pointer py-1 pr-3 pl-1 transition-colors ${
                  !selectedMonth
                    ? 'text-slate-300 cursor-not-allowed font-medium'
                    : selectedDay
                    ? 'text-slate-800 font-bold'
                    : 'text-slate-400 font-medium'
                }`}
                title={
                  !selectedMonth
                    ? 'Select a Month first to pick a Day'
                    : 'Pick a Day, or select "Day" to view the full month'
                }
              >
                <option value="">Day</option>
                {daysInSelectedMonth.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Month Dropdown */}
            <div className="relative px-1">
              <select
                value={selectedMonth}
                onChange={(e) => {
                  const newMonth = e.target.value;
                  setSelectedMonth(newMonth);
                  if (!newMonth) {
                    setSelectedDay('');
                  }
                }}
                className={`text-xs bg-transparent border-none focus:outline-none cursor-pointer py-1 pr-3 pl-1 transition-colors ${
                  selectedMonth ? 'text-slate-800 font-bold' : 'text-slate-400 font-medium'
                }`}
                title='Pick a Month, or select "Month" to view the full year'
              >
                <option value="">Month</option>
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Dropdown */}
            <div className="relative px-1">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="text-xs font-bold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer py-1 pr-3 pl-1"
                title="Select Year"
              >
                {yearOptions.map((yr) => (
                  <option key={yr} value={yr}>
                    {yr}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick "Today" Button if filter is not currently on Today */}
          {(!isToday || !selectedDay || !selectedMonth || selectedYear !== currentY) && (
            <button
              type="button"
              onClick={() => {
                setSelectedYear(currentY);
                setSelectedMonth(currentM);
                setSelectedDay(currentD);
              }}
              className="text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 px-2 py-1.5 rounded-xl transition-all shadow-2xs flex items-center gap-1"
              title="Reset to Today"
            >
              <Calendar size={12} className="text-emerald-600" />
              
            </button>
          )}
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
              {isToday ? 'Deployed' : 'Active'}
            </span>
            <span className="font-bold text-slate-800 font-mono text-sm leading-tight truncate block">
              {totalWorkers} workers
            </span>
          </div>
        </div>
      </div>

      {/* ── Middle Scrollable Visualization Area (Fixed Height with Internal Scroll) ── */}
      {isLoading ? (
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-10 gap-2">
          <Loader2 size={24} className="text-emerald-500 animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Loading {displayLabel} data...</p>
        </div>
      ) : items.length === 0 ? (
        /* Empty State */
        <div className="flex-1 min-h-0 flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center mb-2.5 shadow-2xs">
            <Activity size={18} className="text-slate-400" />
          </div>
          <p className="text-xs font-bold text-slate-700">No Activity Hours Recorded</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xs">
            No logged hours found for {displayLabel}.
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
          {/* ── Visualization: Horizontal Bar Chart View ── */}
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
        </div>
      )}

      {/* ── Footer Link (Pinned at Bottom) ─────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs flex-shrink-0 mt-auto">
        <span className="text-[11px] text-slate-400">
          {isLive
            ? `Showing ${items.length} active tasks (${displayLabel})`
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
