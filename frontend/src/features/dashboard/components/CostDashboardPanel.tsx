/**
 * CostDashboardPanel.tsx — Full Cost BI Dashboard with charts, KPIs, and analytics.
 *
 * Premium glass-morphism design with:
 *   - Animated KPI stat cards with trend indicators
 *   - Stacked area chart for daily cost trends
 *   - Donut chart for resource cost mix
 *   - Horizontal bar charts for activity cost & trade group analysis
 *   - Business partner spend leaderboard
 *   - Equipment efficiency table with utilization bars
 */
import { useState, useMemo } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import {
  TrendingUp, TrendingDown, Minus,
  DollarSign, Users, Truck, Clock, Fuel, AlertTriangle,
  ArrowUpRight, ArrowDownRight,
  Calendar, Filter, RotateCw, ChevronDown,
  Layers, Wrench, Briefcase,
} from 'lucide-react';
import type {
  CostDashboardData,
  CostDashboardKpis,
  DailyTrendItem,
  ResourceMixItem,
  ActivityCostItem,
  TradeGroupCostItem,
  BusinessPartnerSpendItem,
  EquipmentEfficiencyItem,
} from '../services/costDashboardService';

/* ── Formatting Helpers ───────────────────────────────────────────────────── */

function fmtCurrency(val: number, currency = 'LKR'): string {
  if (val >= 1_000_000) return `${currency} ${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${currency} ${(val / 1_000).toFixed(1)}K`;
  return `${currency} ${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtCompact(val: number): string {
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(2)}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)}K`;
  return val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function fmtHours(val: number): string {
  return val.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

function fmtPct(val: number | null): string {
  if (val === null) return '—';
  return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
}

/* ── Colour Palettes ──────────────────────────────────────────────────────── */

const AREA_COLORS = {
  regularCost: '#10b981',
  otCost: '#f59e0b',
  equipmentCost: '#6366f1',
};

const PIE_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#6366f1'];

const ACTIVITY_COLORS = {
  laborCost: '#3b82f6',
  equipmentCost: '#6366f1',
};

/* ── KPI Card ─────────────────────────────────────────────────────────────── */

interface KpiCardProps {
  label: string;
  value: string;
  subLabel?: string;
  subValue?: string;
  changePct: number | null;
  icon: React.ReactNode;
  gradient: string;
  borderAccent: string;
}

function KpiCard({ label, value, subLabel, subValue, changePct, icon, gradient, borderAccent }: KpiCardProps) {
  const isUp = changePct !== null && changePct > 0;
  const isDown = changePct !== null && changePct < 0;

  return (
    <div className={`relative overflow-hidden bg-white rounded-2xl border ${borderAccent} shadow-sm hover:shadow-md transition-all duration-300 group`}>
      {/* Top gradient accent line */}
      <div className={`absolute top-0 inset-x-0 h-1 ${gradient}`} />
      <div className="p-5 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${gradient} bg-opacity-10`}
            style={{ background: `linear-gradient(135deg, ${gradient.includes('emerald') ? '#d1fae5' : gradient.includes('blue') ? '#dbeafe' : gradient.includes('indigo') ? '#e0e7ff' : '#fef3c7'} 0%, ${gradient.includes('emerald') ? '#a7f3d0' : gradient.includes('blue') ? '#bfdbfe' : gradient.includes('indigo') ? '#c7d2fe' : '#fde68a'} 100%)`}}
          >
            {icon}
          </div>
          {changePct !== null && (
            <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isUp ? 'bg-rose-50 text-rose-700 border-rose-200' :
              isDown ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              'bg-slate-50 text-slate-500 border-slate-200'
            }`}>
              {isUp ? <ArrowUpRight size={10} /> : isDown ? <ArrowDownRight size={10} /> : <Minus size={10} />}
              {fmtPct(changePct)}
            </div>
          )}
        </div>
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums leading-none tracking-tight">{value}</p>
          {subLabel && (
            <p className="text-[11px] text-slate-400 mt-1.5">
              {subLabel}: <span className="font-semibold text-slate-600">{subValue}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Chart Card Wrapper ───────────────────────────────────────────────────── */

function ChartCard({
  title,
  subtitle,
  icon,
  children,
  className = '',
  noPad = false,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPad?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col overflow-hidden transition-shadow hover:shadow-md ${className}`}>
      <div className="px-5 pt-5 pb-3 flex items-center gap-2 flex-shrink-0">
        {icon && (
          <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-sm font-bold text-slate-800 leading-tight">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className={noPad ? 'flex-1 min-h-0' : 'px-5 pb-5 flex-1 min-h-0'}>
        {children}
      </div>
    </div>
  );
}

/* ── Custom Tooltip for Area Chart ────────────────────────────────────────── */

function TrendTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl border border-slate-200 shadow-lg px-4 py-3 text-xs">
      <p className="font-bold text-slate-700 mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full" style={{ background: p.fill || p.stroke }} />
            <span className="text-slate-500">
              {p.dataKey === 'regularCost' ? 'Regular' : p.dataKey === 'otCost' ? 'OT' : 'Equipment'}
            </span>
          </div>
          <span className="font-semibold text-slate-800 tabular-nums">{fmtCompact(p.value)}</span>
        </div>
      ))}
      <div className="border-t border-slate-100 mt-1.5 pt-1.5 flex justify-between font-bold text-slate-900">
        <span>Total</span>
        <span className="tabular-nums">{fmtCompact(payload.reduce((s: number, p: any) => s + (p.value || 0), 0))}</span>
      </div>
    </div>
  );
}

/* ── Donut Center Label ───────────────────────────────────────────────────── */

function DonutCenterLabel({ viewBox, total, currency }: any) {
  if (!viewBox) return null;
  const { cx, cy } = viewBox;
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" className="fill-slate-400 text-[10px] font-medium">Total</text>
      <text x={cx} y={cy + 12} textAnchor="middle" className="fill-slate-900 text-sm font-bold">{fmtCurrency(total, currency)}</text>
    </g>
  );
}

/* ── Equipment Utilization Bar ────────────────────────────────────────────── */

function UtilBar({ working, idle, breakdown }: { working: number; idle: number; breakdown: number }) {
  const total = working + idle + breakdown;
  if (total <= 0) return <div className="h-2 rounded-full bg-slate-100" />;
  const wPct = (working / total) * 100;
  const iPct = (idle / total) * 100;
  const bPct = (breakdown / total) * 100;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100 w-full">
      {wPct > 0 && <div className="bg-emerald-400 transition-all" style={{ width: `${wPct}%` }} />}
      {iPct > 0 && <div className="bg-amber-400 transition-all" style={{ width: `${iPct}%` }} />}
      {bPct > 0 && <div className="bg-rose-400 transition-all" style={{ width: `${bPct}%` }} />}
    </div>
  );
}

/* ── Period Filter Bar ────────────────────────────────────────────────────── */

const MONTHS = [
  { v: '01', l: 'Jan' }, { v: '02', l: 'Feb' }, { v: '03', l: 'Mar' },
  { v: '04', l: 'Apr' }, { v: '05', l: 'May' }, { v: '06', l: 'Jun' },
  { v: '07', l: 'Jul' }, { v: '08', l: 'Aug' }, { v: '09', l: 'Sep' },
  { v: '10', l: 'Oct' }, { v: '11', l: 'Nov' }, { v: '12', l: 'Dec' },
];

interface FilterBarProps {
  month: string;         // YYYY-MM
  includeDrafts: boolean;
  onMonthChange: (m: string) => void;
  onIncludeDraftsChange: (v: boolean) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  currency: string;
  projectName: string;
}

function CostFilterBar({
  month, includeDrafts, onMonthChange, onIncludeDraftsChange,
  onRefresh, isRefreshing, currency, projectName,
}: FilterBarProps) {
  const [y, m] = month.split('-');
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + 1 - i);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Calendar size={14} className="text-slate-400" />
          <select
            value={m}
            onChange={(e) => onMonthChange(`${y}-${e.target.value}`)}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors appearance-none cursor-pointer pr-6"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.4rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.1em 1.1em' }}
          >
            {MONTHS.map((mo) => <option key={mo.v} value={mo.v}>{mo.l}</option>)}
          </select>
          <select
            value={y}
            onChange={(e) => onMonthChange(`${e.target.value}-${m}`)}
            className="text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors appearance-none cursor-pointer pr-6"
            style={{ backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.4rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.1em 1.1em' }}
          >
            {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
          </select>
        </div>

        <label className="flex items-center gap-1.5 cursor-pointer select-none">
          <div className="relative">
            <input
              type="checkbox"
              checked={includeDrafts}
              onChange={(e) => onIncludeDraftsChange(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4.5 bg-slate-200 rounded-full peer-checked:bg-blue-500 transition-colors" />
            <div className="absolute left-0.5 top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow-sm peer-checked:translate-x-3.5 transition-transform" />
          </div>
          <span className="text-[11px] font-medium text-slate-500">Include Drafts</span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        {projectName && (
          <span className="text-[11px] font-medium text-slate-400 hidden lg:inline">
            {projectName} · {currency}
          </span>
        )}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
        >
          <RotateCw size={13} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
          <span>{isRefreshing ? 'Loading…' : 'Refresh'}</span>
        </button>
      </div>
    </div>
  );
}

/* ── Main Component ───────────────────────────────────────────────────────── */

interface Props {
  data: CostDashboardData;
  isRefreshing: boolean;
  onRefresh: () => void;
  filters: { month?: string; includeDrafts?: boolean };
  onFiltersChange: (f: { month?: string; includeDrafts?: boolean }) => void;
}

export default function CostDashboardPanel({ data, isRefreshing, onRefresh, filters, onFiltersChange }: Props) {
  const { period, kpis, dailyTrend, resourceMix, activityCosts, tradeGroupCosts, businessPartnerSpend, equipmentEfficiency } = data;
  const currency = period.currency || 'LKR';

  const trendData = useMemo(() => {
    return dailyTrend.map((d) => ({
      ...d,
      dateLabel: d.date.substring(5), // MM-DD
    }));
  }, [dailyTrend]);

  // Filter out zero-cost resource mix entries for cleaner donut
  const donutData = useMemo(() => resourceMix.filter((r) => r.cost > 0), [resourceMix]);
  const totalMixCost = useMemo(() => donutData.reduce((s, r) => s + r.cost, 0), [donutData]);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Filter Bar ──────────────────────────────────────────────────── */}
      <CostFilterBar
        month={filters.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`}
        includeDrafts={filters.includeDrafts || false}
        onMonthChange={(m) => onFiltersChange({ ...filters, month: m })}
        onIncludeDraftsChange={(v) => onFiltersChange({ ...filters, includeDrafts: v })}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
        currency={currency}
        projectName={period.projectName}
      />

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Total Site Cost"
          value={fmtCurrency(kpis.totalCost, currency)}
          changePct={kpis.totalCostChangePct}
          subLabel="vs Previous"
          subValue={fmtCurrency(kpis.previousTotalCost, currency)}
          icon={<DollarSign size={18} className="text-emerald-600" />}
          gradient="bg-gradient-to-r from-emerald-400 to-teal-400"
          borderAccent="border-emerald-200/60"
        />
        <KpiCard
          label="Labor Cost"
          value={fmtCurrency(kpis.laborCost, currency)}
          changePct={kpis.laborCostChangePct}
          subLabel="OT Cost"
          subValue={fmtCurrency(kpis.otLaborCost, currency)}
          icon={<Users size={18} className="text-blue-600" />}
          gradient="bg-gradient-to-r from-blue-400 to-sky-400"
          borderAccent="border-blue-200/60"
        />
        <KpiCard
          label="Equipment Cost"
          value={fmtCurrency(kpis.equipmentCost, currency)}
          changePct={kpis.equipmentCostChangePct}
          subLabel="Fuel"
          subValue={`${fmtHours(kpis.totalEquipmentFuelLiters)} L`}
          icon={<Truck size={18} className="text-indigo-600" />}
          gradient="bg-gradient-to-r from-indigo-400 to-purple-400"
          borderAccent="border-indigo-200/60"
        />
        <KpiCard
          label="OT & Idle Wastage"
          value={fmtCurrency(kpis.otLaborCost + kpis.estimatedIdleCost, currency)}
          changePct={null}
          subLabel="Idle + Breakdown"
          subValue={`${fmtHours(kpis.totalIdleHours + kpis.totalBreakdownHours)} hrs`}
          icon={<AlertTriangle size={18} className="text-amber-600" />}
          gradient="bg-gradient-to-r from-amber-400 to-orange-400"
          borderAccent="border-amber-200/60"
        />
      </div>

      {/* ── Row 2: Daily Trend + Resource Mix ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily Cost Trend (2/3 width) */}
        <ChartCard
          title="Daily Cost Trend"
          subtitle={`${period.from} → ${period.to}`}
          icon={<TrendingUp size={14} className="text-emerald-500" />}
          className="lg:col-span-2 h-[380px]"
          noPad
        >
          <div className="px-3 pb-3 h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gReg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={AREA_COLORS.regularCost} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={AREA_COLORS.regularCost} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gOt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={AREA_COLORS.otCost} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={AREA_COLORS.otCost} stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="gEq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={AREA_COLORS.equipmentCost} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={AREA_COLORS.equipmentCost} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="dateLabel" tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v: number) => fmtCompact(v)} />
                <RechartsTooltip content={<TrendTooltip />} />
                <Area type="monotone" dataKey="regularCost" stackId="1" stroke={AREA_COLORS.regularCost} fill="url(#gReg)" strokeWidth={2} />
                <Area type="monotone" dataKey="otCost" stackId="1" stroke={AREA_COLORS.otCost} fill="url(#gOt)" strokeWidth={2} />
                <Area type="monotone" dataKey="equipmentCost" stackId="1" stroke={AREA_COLORS.equipmentCost} fill="url(#gEq)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        {/* Resource Cost Mix Donut (1/3 width) */}
        <ChartCard
          title="Cost Breakdown"
          subtitle="By workforce & resource type"
          icon={<Layers size={14} className="text-blue-500" />}
          className="h-[380px]"
        >
          <div className="flex flex-col h-full">
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    dataKey="cost"
                    nameKey="label"
                    cx="50%"
                    cy="50%"
                    innerRadius="55%"
                    outerRadius="78%"
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                    <DonutCenterLabel total={totalMixCost} currency={currency} />
                  </Pie>
                  <RechartsTooltip
                    formatter={(value: number) => fmtCurrency(value, currency)}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100">
              {donutData.map((r, i) => (
                <div key={r.key} className="flex items-center gap-1.5 text-[11px]">
                  <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-slate-500">{r.label}</span>
                  <span className="font-semibold text-slate-700 tabular-nums">
                    {totalMixCost > 0 ? `${((r.cost / totalMixCost) * 100).toFixed(0)}%` : '0%'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>
      </div>

      {/* ── Row 3: Activity Costs + Trade Group Costs ───────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Top Activity Codes by Cost */}
        <ChartCard
          title="Top Cost-Driving Activities"
          subtitle="Labor + Equipment cost by activity code"
          icon={<Briefcase size={14} className="text-indigo-500" />}
          className="h-[400px]"
          noPad
        >
          <div className="px-3 pb-3 h-full overflow-y-auto custom-scrollbar">
            {activityCosts.length > 0 ? (
              <div style={{ height: Math.max(320, activityCosts.length * 34), width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activityCosts}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => fmtCompact(v)} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="code"
                      interval={0}
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [fmtCurrency(value, currency), name === 'laborCost' ? 'Labor' : 'Equipment']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    />
                    <Bar dataKey="laborCost" stackId="a" fill={ACTIVITY_COLORS.laborCost} radius={[0, 0, 0, 0]} name="Labor" barSize={18} />
                    <Bar dataKey="equipmentCost" stackId="a" fill={ACTIVITY_COLORS.equipmentCost} radius={[0, 4, 4, 0]} name="Equipment" barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No activity cost data for this period</div>
            )}
          </div>
        </ChartCard>

        {/* Trade Group Cost Analysis */}
        <ChartCard
          title="Cost by Trade Group"
          subtitle="Skilled vs Unskilled breakdown"
          icon={<Wrench size={14} className="text-purple-500" />}
          className="h-[400px]"
          noPad
        >
          <div className="px-3 pb-3 h-full overflow-y-auto custom-scrollbar">
            {tradeGroupCosts.length > 0 ? (
              <div style={{ height: Math.max(320, tradeGroupCosts.length * 34), width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={tradeGroupCosts}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v: number) => fmtCompact(v)} tickLine={false} axisLine={false} />
                    <YAxis
                      type="category"
                      dataKey="tradeGroup"
                      interval={0}
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <RechartsTooltip
                      formatter={(value: number, name: string) => [fmtCurrency(value, currency), name === 'skilledCost' ? 'Skilled' : 'Unskilled']}
                      contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11px', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                    />
                    <Bar dataKey="skilledCost" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} name="Skilled" barSize={18} />
                    <Bar dataKey="unskilledCost" stackId="a" fill="#93c5fd" radius={[0, 4, 4, 0]} name="Unskilled" barSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">No trade group data for this period</div>
            )}
          </div>
        </ChartCard>
      </div>

      {/* ── Row 4: Business Partner Spend + Equipment Efficiency ─────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Business Partner Leaderboard */}
        <ChartCard
          title="Business Partner Spend"
          subtitle="Subcontractor & supplier payable costs"
          icon={<Briefcase size={14} className="text-emerald-500" />}
          className="h-[420px]"
        >
          {businessPartnerSpend.length > 0 ? (
            <div className="overflow-y-auto max-h-[320px] pr-1 custom-scrollbar">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-white z-10">
                  <tr className="text-[10px] text-slate-400 uppercase tracking-wider">
                    <th className="text-left pb-2 font-semibold">Partner</th>
                    <th className="text-right pb-2 font-semibold">Labor</th>
                    <th className="text-right pb-2 font-semibold">Equip.</th>
                    <th className="text-right pb-2 font-semibold">Total</th>
                    <th className="text-right pb-2 font-semibold">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {businessPartnerSpend.map((bp, i) => {
                    const totalAll = businessPartnerSpend.reduce((s, b) => s + b.totalCost, 0);
                    const pct = totalAll > 0 ? (bp.totalCost / totalAll) * 100 : 0;
                    return (
                      <tr key={bp.partnerId} className="border-t border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-slate-100 to-slate-50 flex items-center justify-center text-[10px] font-bold text-slate-500 flex-shrink-0">
                              {i + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-700 truncate max-w-[140px]">{bp.partnerName}</p>
                              <p className="text-[10px] text-slate-400">{bp.workerCount}W · {bp.equipmentCount}E</p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right font-medium text-slate-600 tabular-nums">{fmtCompact(bp.laborCost)}</td>
                        <td className="text-right font-medium text-slate-600 tabular-nums">{fmtCompact(bp.equipmentCost)}</td>
                        <td className="text-right font-bold text-slate-800 tabular-nums">{fmtCompact(bp.totalCost)}</td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <div className="w-12 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                              <div className="h-full bg-emerald-400 rounded-full transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 tabular-nums w-8 text-right">{pct.toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">No business partner data for this period</div>
          )}
        </ChartCard>

        {/* Equipment Efficiency */}
        <ChartCard
          title="Equipment Utilization & Cost"
          subtitle="Working vs idle vs breakdown hours"
          icon={<Truck size={14} className="text-indigo-500" />}
          className="h-[420px]"
        >
          {equipmentEfficiency.length > 0 ? (
            <div className="overflow-y-auto max-h-[320px] pr-1 custom-scrollbar">
              <div className="flex flex-col gap-3">
                {equipmentEfficiency.map((eq) => {
                  const totalHrs = eq.workingHours + eq.idleHours + eq.breakdownHours;
                  const utilPct = totalHrs > 0 ? (eq.workingHours / totalHrs) * 100 : 0;
                  return (
                    <div key={eq.id} className="rounded-xl border border-slate-100 p-3 hover:bg-slate-50/50 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-xs font-bold text-slate-700">{eq.code}</p>
                          <p className="text-[10px] text-slate-400 truncate max-w-[180px]">{eq.name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-800 tabular-nums">{fmtCurrency(eq.cost, currency)}</p>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            eq.condition === 'WET' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                          }`}>{eq.condition}</span>
                        </div>
                      </div>
                      <UtilBar working={eq.workingHours} idle={eq.idleHours} breakdown={eq.breakdownHours} />
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          Work {fmtHours(eq.workingHours)}h
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          Idle {fmtHours(eq.idleHours)}h
                        </span>
                        <span className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                          Down {fmtHours(eq.breakdownHours)}h
                        </span>
                        {eq.fuelLiters > 0 && (
                          <span className="flex items-center gap-1">
                            <Fuel size={9} />
                            {fmtHours(eq.fuelLiters)}L
                          </span>
                        )}
                        <span className="ml-auto font-semibold text-slate-600">{utilPct.toFixed(0)}% util</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-slate-400">No equipment data for this period</div>
          )}
        </ChartCard>
      </div>

      {/* ── Summary Footer ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Clock size={13} className="text-slate-400" />
          <span>Labor: <strong className="text-slate-700">{fmtHours(kpis.totalLaborHours)}h</strong> total · <strong className="text-amber-600">{fmtHours(kpis.totalOtHours)}h</strong> OT</span>
        </div>
        <div className="w-px h-4 bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Fuel size={13} className="text-slate-400" />
          <span>Fuel: <strong className="text-slate-700">{fmtHours(kpis.totalEquipmentFuelLiters)} L</strong></span>
        </div>
        <div className="w-px h-4 bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <AlertTriangle size={13} className="text-amber-400" />
          <span>Idle: <strong className="text-amber-600">{fmtHours(kpis.totalIdleHours)}h</strong> · Breakdown: <strong className="text-rose-600">{fmtHours(kpis.totalBreakdownHours)}h</strong></span>
        </div>
        <div className="w-px h-4 bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Period: <strong className="text-slate-700">{period.from} → {period.to}</strong></span>
          {period.includeDrafts && <span className="text-[10px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">+Drafts</span>}
        </div>
      </div>
    </div>
  );
}
