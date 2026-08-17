/**
 * ReportFilters.tsx — Filter bar for reports.
 */
import type { ReportFilters as Filters } from '../services/reportService';

interface Props {
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onQuery: () => void;
  isLoading: boolean;
}

const INPUT_CLASS =
  'px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400';

export default function ReportFilters({ filters, onFilterChange, onQuery, isLoading }: Props) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">From</label>
          <input type="date" value={filters.dateFrom ?? ''} onChange={(e) => onFilterChange('dateFrom', e.target.value)} className={`${INPUT_CLASS} font-mono`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">To</label>
          <input type="date" value={filters.dateTo ?? ''} onChange={(e) => onFilterChange('dateTo', e.target.value)} className={`${INPUT_CLASS} font-mono`} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Employee</label>
          <input type="text" placeholder="Name…" value={filters.employeeId ?? ''} onChange={(e) => onFilterChange('employeeId', e.target.value)} className={INPUT_CLASS} />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Activity code</label>
          <input type="text" placeholder="e.g. EW-01" value={filters.activityCode ?? ''} onChange={(e) => onFilterChange('activityCode', e.target.value)} className={`${INPUT_CLASS} font-mono`} />
        </div>
        <button
          onClick={onQuery}
          disabled={isLoading}
          className="bg-blue-700 text-white font-medium text-sm rounded-lg px-6 min-h-[44px] transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Loading…' : 'Run report'}
        </button>
      </div>
    </div>
  );
}
