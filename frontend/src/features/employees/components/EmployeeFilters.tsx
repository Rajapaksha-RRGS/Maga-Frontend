/**
 * EmployeeFilters.tsx — Filter dropdowns for business partner and trade group.
 */

interface EmployeeFiltersProps {
  businessPartners: string[];
  tradeGroups: string[];
  businessPartnerFilter: string;
  tradeGroupFilter: string;
  onBusinessPartnerChange: (v: string) => void;
  onTradeGroupChange: (v: string) => void;
}

const SELECT_CLASS =
  'px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors';

export default function EmployeeFilters({
  businessPartners,
  tradeGroups,
  businessPartnerFilter,
  tradeGroupFilter,
  onBusinessPartnerChange,
  onTradeGroupChange,
}: EmployeeFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
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
    </div>
  );
}
