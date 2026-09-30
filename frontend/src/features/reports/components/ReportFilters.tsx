/**
 * ReportFilters.tsx — Dynamic filter bar for report generation.
 *
 * Filter rules per acceptance criteria:
 *   - Date range (From/To): Always shown.
 *   - Employee: Text search, always shown.
 *   - Business Partner: Dropdown, shown for 'summary', 'day-ot-summary', and 'bp-bill'; hidden for 'erp-upload'.
 *   - Activity Code: Dropdown/search, shown ONLY for 'erp-upload'; hidden for others.
 *   - Run report button.
 */
import type { ReportFilters as Filters, ReportType } from '../services/reportService';
import { Search, RotateCcw, Play } from 'lucide-react';

interface Props {
  activeTab: ReportType;
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onResetFilters: () => void;
  onQuery: () => void;
  isLoading: boolean;
  businessPartners: string[];
  activityCodes: { code: string; description: string }[];
}

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs text-slate-800 min-h-[40px] focus:ring-2 focus:ring-blue-600 focus:border-slate-400 outline-none transition-colors placeholder:text-slate-400';

const LABEL_CLASS =
  'text-[11px] font-semibold text-slate-600 uppercase tracking-wide';

export default function ReportFiltersBar({
  activeTab,
  filters,
  onFilterChange,
  onResetFilters,
  onQuery,
  isLoading,
  businessPartners,
  activityCodes,
}: Props) {
  const showBusinessPartner = activeTab !== 'erp-upload' && activeTab !== 'equipment-erp-upload';
  const showActivityCode = activeTab === 'erp-upload' || activeTab === 'equipment-erp-upload';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onQuery();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-slate-300 p-4 shadow-2xs"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-end">
        {/* Date From */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-date-from" className={LABEL_CLASS}>
            From date
          </label>
          <input
            id="filter-date-from"
            type="date"
            value={filters.dateFrom ?? ''}
            onChange={(e) => onFilterChange('dateFrom', e.target.value)}
            className={`${INPUT_CLASS} font-mono`}
          />
        </div>

        {/* Date To */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-date-to" className={LABEL_CLASS}>
            To date
          </label>
          <input
            id="filter-date-to"
            type="date"
            value={filters.dateTo ?? ''}
            onChange={(e) => onFilterChange('dateTo', e.target.value)}
            className={`${INPUT_CLASS} font-mono`}
          />
        </div>

        {/* Employee Search */}
        <div className="flex flex-col gap-1">
          <label htmlFor="filter-employee" className={LABEL_CLASS}>
            Employee
          </label>
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              id="filter-employee"
              type="text"
              placeholder="Search name…"
              value={filters.employeeQuery ?? ''}
              onChange={(e) => onFilterChange('employeeQuery', e.target.value)}
              className={`${INPUT_CLASS} pl-9`}
            />
          </div>
        </div>

        {/* Business Partner Filter — Shown for Summary, Day & OT Summary, BP Bill */}
        {showBusinessPartner && (
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-bp" className={LABEL_CLASS}>
              Business partner
            </label>
            <select
              id="filter-bp"
              value={filters.businessPartner ?? ''}
              onChange={(e) => onFilterChange('businessPartner', e.target.value)}
              className={INPUT_CLASS}
            >
              <option value="">All business partners</option>
              {businessPartners.map((bp) => (
                <option key={bp} value={bp}>
                  {bp}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Activity Code Filter — Shown ONLY for ERP Upload Export */}
        {showActivityCode && (
          <div className="flex flex-col gap-1">
            <label htmlFor="filter-activity" className={LABEL_CLASS}>
              Activity code
            </label>
            <select
              id="filter-activity"
              value={filters.activityCode ?? ''}
              onChange={(e) => onFilterChange('activityCode', e.target.value)}
              className={`${INPUT_CLASS} font-mono`}
            >
              <option value="">All activity codes</option>
              {activityCodes.map((act) => (
                <option key={act.code} value={act.code}>
                  {act.code} — {act.description}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 sm:col-span-2 md:col-span-3 lg:col-span-1">
          <button
            type="submit"
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 font-semibold text-xs rounded-lg px-4 min-h-[40px] transition-colors shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                <span>Loading…</span>
              </>
            ) : (
              <>
                <Play size={13} className="text-slate-700 fill-current" />
                <span>Run / Filter</span>
              </>
            )}
          </button>

          {(filters.employeeQuery || filters.businessPartner || filters.activityCode || filters.dateFrom || filters.dateTo) && (
            <button
              type="button"
              onClick={onResetFilters}
              title="Reset filters"
              aria-label="Reset filters"
              className="w-10 h-10 flex items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 active:bg-slate-100 transition-colors shadow-2xs"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>
    </form>
  );
}
