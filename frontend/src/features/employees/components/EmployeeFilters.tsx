/**
 * EmployeeFilters.tsx — Filter dropdowns for business partner, trade group, and status.
 */
import { X } from 'lucide-react';

interface EmployeeFiltersProps {
  businessPartners: string[];
  tradeGroups: string[];
  businessPartnerFilter: string;
  tradeGroupFilter: string;
  statusFilter?: string;
  onBusinessPartnerChange: (v: string) => void;
  onTradeGroupChange: (v: string) => void;
  onStatusChange?: (v: string) => void;
  onClearFilters?: () => void;
}

const SELECT_CLASS =
  'px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors';

export default function EmployeeFilters({
  businessPartners,
  tradeGroups,
  businessPartnerFilter,
  tradeGroupFilter,
  statusFilter = '',
  onBusinessPartnerChange,
  onTradeGroupChange,
  onStatusChange,
  onClearFilters,
}: EmployeeFiltersProps) {
  const hasActiveFilters = Boolean(
    businessPartnerFilter || tradeGroupFilter || statusFilter
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        id="filter-bp"
        value={businessPartnerFilter}
        onChange={(e) => onBusinessPartnerChange(e.target.value)}
        className={SELECT_CLASS}
        aria-label="Filter by business partner"
      >
        <option value="">All business partners</option>
        {businessPartners.map((bp) => (
          <option key={bp} value={bp}>{bp}</option>
        ))}
      </select>

      <select
        id="filter-tg"
        value={tradeGroupFilter}
        onChange={(e) => onTradeGroupChange(e.target.value)}
        className={SELECT_CLASS}
        aria-label="Filter by trade group"
      >
        <option value="">All trade groups</option>
        {tradeGroups.map((tg) => (
          <option key={tg} value={tg}>{tg}</option>
        ))}
      </select>

      {onStatusChange && (
        <select
          id="filter-status"
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className={SELECT_CLASS}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      )}

      {hasActiveFilters && onClearFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg min-h-[44px] transition-colors"
          title="Reset filters"
        >
          <X size={14} />
          <span>Reset</span>
        </button>
      )}
    </div>
  );
}

