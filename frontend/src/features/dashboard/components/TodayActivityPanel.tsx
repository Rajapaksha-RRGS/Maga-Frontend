/**
 * TodayActivityPanel.tsx
 *
 * Pastel Theme Analytics Panel: "Hours by Activity Code"
 * Harmonized with the dashboard's light pastel aesthetic.
 * Provides dual visualization modes (Treemap / Bar Chart) to analyze
 * labor man-hours and overtime distribution across site construction tasks.
 */
import { useState, useMemo } from 'react';
import { 
  BarChart3, 
  LayoutGrid, 
  Clock, 
  Zap, 
  Users, 
  Activity,
  ArrowUpRight
} from 'lucide-react';
import { Link } from 'react-router-dom';
import type { BackendTimeEntry } from '../../time-entries/services/timeEntryService';

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

const BENCHMARK_ACTIVITIES = [
  {
    code: 'ACT-101',
    name: 'Concrete Pouring (Slab & Columns)',
    trade: 'Masonry',
    category: 'Civil',
    hours: 56.0,
    regularHours: 48.0,
    otHours: 8.0,
    workers: 7,
    ...COLOR_PALETTES[0],
  },
  {
    code: 'ACT-102',
    name: 'Reinforcement & Bar-bending',
    trade: 'Steel Fixer',
    category: 'Structural',
    hours: 42.5,
    regularHours: 36.0,
    otHours: 6.5,
    workers: 5,
    ...COLOR_PALETTES[1],
  },
  {
    code: 'ACT-104',
    name: 'Formwork & Shuttering Assembly',
    trade: 'Carpenter',
    category: 'Civil',
    hours: 32.0,
    regularHours: 28.0,
    otHours: 4.0,
    workers: 4,
    ...COLOR_PALETTES[2],
  },
  {
    code: 'ACT-103',
    name: 'Bricklaying & Masonry Finishing',
    trade: 'Mason',
    category: 'Civil',
    hours: 24.0,
    regularHours: 24.0,
    otHours: 0.0,
    workers: 3,
    ...COLOR_PALETTES[3],
  },
  {
    code: 'ACT-108',
    name: 'Excavation & Earthmoving Works',
    trade: 'Plant Operator',
    category: 'Plant',
    hours: 18.0,
    regularHours: 16.0,
    otHours: 2.0,
    workers: 2,
    ...COLOR_PALETTES[4],
  },
];

export default function TodayActivityPanel({
  todayEntries = [],
}: Props) {
  const [viewMode, setViewMode] = useState<'bar' | 'treemap'>('bar');

  // Aggregate live todayEntries by Activity Code
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

    (todayEntries || []).forEach((entry) => {
      const code = entry.activity?.code || (entry.activityId ? `ACT-${entry.activityId.slice(0, 4)}` : 'GEN-01');
      const name = entry.activity?.description || entry.activity?.code || 'General Site Work';
      const reg = Number(entry.hours) || 0;
      const ot = Number(entry.overtimeHours) || 0;
      const total = reg + ot;

      if (!map.has(code)) {
        map.set(code, {
          code,
          name,
          trade: 'General Civil',
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

    const dataset = activeList.length > 0 ? activeList : BENCHMARK_ACTIVITIES;
    const isRealLive = activeList.length > 0;

    const totH = dataset.reduce((sum, i) => sum + i.hours, 0);
    const totOt = dataset.reduce((sum, i) => sum + i.otHours, 0);
    const totW = dataset.reduce((sum, i) => sum + i.workers, 0);

    return {
      isLive: isRealLive,
      items: dataset,
      totalHours: totH,
      totalOtHours: totOt,
      totalWorkers: totW,
    };
  }, [todayEntries]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 flex flex-col gap-4 transition-colors">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Activity size={16} className="text-emerald-600" />
              Hours by Activity Code
            </h2>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              isLive
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                : 'bg-blue-50 text-blue-700 border border-blue-200/80'
            }`}>
              {isLive ? '● Live Entries' : 'Sample Benchmark'}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Man-hours distribution across site construction tasks
          </p>
        </div>

        {/* View Switcher (Bar Chart vs Treemap) */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80">
          <button
            type="button"
            onClick={() => setViewMode('bar')}
            className={[
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
              viewMode === 'bar'
                ? 'bg-white text-slate-800 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            ].join(' ')}
            title="Horizontal Bar Chart View"
          >
            <BarChart3 size={13} />
            <span className="hidden sm:inline">Bars</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('treemap')}
            className={[
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all',
              viewMode === 'treemap'
                ? 'bg-white text-slate-800 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800'
            ].join(' ')}
            title="Proportional Treemap View"
          >
            <LayoutGrid size={13} />
            <span className="hidden sm:inline">Treemap</span>
          </button>
        </div>
      </div>

      {/* ── KPI Summary Bar in Soft Pastel Tones ────────────────────────── */}
      <div className="grid grid-cols-3 gap-2.5 p-2.5 rounded-xl bg-slate-50/70 border border-slate-100 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center flex-shrink-0">
            <Clock size={14} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block leading-tight font-medium">Total Hours</span>
            <span className="font-bold text-slate-800 font-mono text-sm leading-tight">
              {totalHours.toFixed(1)}h
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 border border-amber-100 flex items-center justify-center flex-shrink-0">
            <Zap size={14} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block leading-tight font-medium">Total OT</span>
            <span className="font-bold text-amber-700 font-mono text-sm leading-tight">
              +{totalOtHours.toFixed(1)}h
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center flex-shrink-0">
            <Users size={14} />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block leading-tight font-medium">Deployed</span>
            <span className="font-bold text-slate-800 font-mono text-sm leading-tight">
              {totalWorkers} workers
            </span>
          </div>
        </div>
      </div>

      {/* ── Visualization: Bar Chart View (Soft Pastel) ─────────────────── */}
      {viewMode === 'bar' && (
        <div className="space-y-3 pt-1">
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
                      {act.hours.toFixed(1)}h
                    </span>
                    {act.otHours > 0 && (
                      <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200/60 px-1.5 py-0.2 rounded-full font-semibold hidden sm:inline">
                        +{act.otHours.toFixed(1)}h OT
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
                    style={{ width: `${Math.max(3, pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Visualization: Treemap View (Soft Pastel Cards) ─────────────── */}
      {viewMode === 'treemap' && (
        <div className="flex flex-wrap gap-2.5 pt-1 min-h-[220px]">
          {items.map((act) => {
            const pct = totalHours > 0 ? Math.round((act.hours / totalHours) * 100) : 0;
            const flexBasis = Math.max(120, Math.min(260, pct * 4));

            return (
              <div
                key={act.code}
                style={{ flex: `${pct} 1 ${flexBasis}px` }}
                className={`p-3 rounded-xl border ${act.border} ${act.bgLight} flex flex-col justify-between transition-all duration-200 hover:scale-[1.01] hover:shadow-xs relative overflow-hidden group min-h-[96px]`}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white/90 text-slate-700 shadow-2xs border border-slate-200/50">
                    {act.code}
                  </span>
                  <span className={`text-[11px] font-extrabold ${act.textColor} font-mono`}>
                    {pct}%
                  </span>
                </div>

                <div className="my-1.5">
                  <p className="text-xs font-bold text-slate-800 line-clamp-1 group-hover:line-clamp-none transition-all">
                    {act.name}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {act.trade} · {act.workers} workers
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 text-xs">
                  <span className="font-extrabold text-slate-800 font-mono">
                    {act.hours.toFixed(1)} hrs
                  </span>
                  {act.otHours > 0 && (
                    <span className="text-[9px] font-bold text-amber-700 bg-amber-100/70 border border-amber-200/60 px-1.5 py-0.2 rounded-md">
                      +{act.otHours.toFixed(1)}h OT
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer Link ─────────────────────────────────────────────────── */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-[11px] text-slate-400">
          Showing {items.length} active construction trades
        </span>
        <Link
          to="/admin/reports"
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors"
        >
          <span>Full Labor Report</span>
          <ArrowUpRight size={13} />
        </Link>
      </div>
    </div>
  );
}
