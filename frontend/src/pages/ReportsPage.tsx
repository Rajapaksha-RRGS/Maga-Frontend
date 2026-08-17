/**
 * ReportsPage.tsx — Admin reports page.
 * Filter bar → results table/cards → export stub.
 */
import { FileSpreadsheet } from 'lucide-react';
import { useReports } from '../features/reports/hooks/useReports';
import ReportFiltersBar from '../features/reports/components/ReportFilters';
import ReportTable from '../features/reports/components/ReportTable';
import ReportCardList from '../features/reports/components/ReportCardList';
import EmptyState from '../components/EmptyState';

export default function ReportsPage() {
  const {
    filters, updateFilter,
    results, isLoading, hasQueried,
    totalHours, totalOT,
    runQuery, exportExcel,
  } = useReports();

  return (
    <div className="px-4 md:px-6 py-5">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-base font-medium text-slate-800">Reports</h1>
        <button
          onClick={exportExcel}
          className="flex items-center gap-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <FileSpreadsheet size={16} />
          <span>Export to Excel</span>
        </button>
      </div>

      {/* Filter bar */}
      <div className="mb-5">
        <ReportFiltersBar
          filters={filters}
          onFilterChange={updateFilter}
          onQuery={runQuery}
          isLoading={isLoading}
        />
      </div>

      {/* Results */}
      {!hasQueried && !isLoading && (
        <EmptyState message="Set your filters and click 'Run report' to see results." />
      )}

      {isLoading && (
        <p className="text-sm text-slate-400 py-8 text-center">Running report…</p>
      )}

      {hasQueried && !isLoading && results.length === 0 && (
        <EmptyState message="No results match your filters." />
      )}

      {hasQueried && !isLoading && results.length > 0 && (
        <>
          {/* Summary */}
          <div className="flex flex-wrap gap-4 mb-4">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">{results.length}</span> entries
            </div>
            <div className="text-sm text-slate-600">
              Total hours: <span className="font-medium text-slate-800 tabular-nums">{totalHours.toFixed(1)}</span>
            </div>
            <div className="text-sm text-slate-600">
              Overtime: <span className="font-medium text-amber-700 tabular-nums">{totalOT.toFixed(1)}</span>
            </div>
          </div>

          <ReportTable data={results} />
          <ReportCardList data={results} />
        </>
      )}
    </div>
  );
}
