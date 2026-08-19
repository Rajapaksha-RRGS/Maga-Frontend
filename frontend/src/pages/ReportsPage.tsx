/**
 * ReportsPage.tsx — Admin Reports Module.
 *
 * Page structure:
 *   1. Header with Page Title & "Export to Excel" action button
 *   2. Report Type Selector tabs (Summary, Day & OT Summary, BP Bill, ERP Upload Export)
 *   3. Dynamic Filter Bar (ReportFilters)
 *   4. Results Area (Empty state / Loading state / Table component per report type)
 *
 * All business logic lives in features/reports/ (hooks, services, components).
 */
import { FileSpreadsheet, Download } from 'lucide-react';
import { useReports } from '../features/reports/hooks/useReports';
import ReportTypeSelector from '../features/reports/components/ReportTypeSelector';
import ReportFiltersBar from '../features/reports/components/ReportFilters';
import SummaryTable from '../features/reports/components/SummaryTable';
import DayOtSummaryTable from '../features/reports/components/DayOtSummaryTable';
import BpBillTable from '../features/reports/components/BpBillTable';
import ErpUploadTable from '../features/reports/components/ErpUploadTable';
import EmptyState from '../components/EmptyState';

export default function ReportsPage() {
  const {
    activeTab,
    setActiveTab,
    filters,
    updateFilter,
    resetFilters,
    runQuery,
    exportExcel,
    isLoading,
    isExporting,
    hasQueried,
    hasResults,
    businessPartners,
    activityCodes,

    summaryData,
    dayOtData,
    bpBillData,
    erpData,
  } = useReports();

  return (
    <div className="px-4 md:px-6 py-5 max-w-7xl mx-auto flex flex-col gap-5">
      {/* ── 1. Page Header with Export Button ──────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-blue-700" />
            Reports & Payroll Export
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Generate consolidated attendance summaries, daily OT grids, business partner billing sheets, and ERP export files.
          </p>
        </div>

        {/* Top-Right "Export to Excel" Button */}
        <button
          onClick={exportExcel}
          disabled={isExporting}
          className="flex items-center gap-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors bg-white hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 self-start sm:self-auto disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-2xs"
        >
          {isExporting ? (
            <>
              <div className="w-4 h-4 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
              <span>Exporting…</span>
            </>
          ) : (
            <>
              <Download size={16} className="text-emerald-700" />
              <span>Export to Excel</span>
            </>
          )}
        </button>
      </div>

      {/* ── 2. Report Type Selector (4 Tabs) ────────────────────────────────── */}
      <ReportTypeSelector
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* ── 3. Dynamic Filter Bar ───────────────────────────────────────────── */}
      <ReportFiltersBar
        activeTab={activeTab}
        filters={filters}
        onFilterChange={updateFilter}
        onResetFilters={resetFilters}
        onQuery={runQuery}
        isLoading={isLoading}
        businessPartners={businessPartners}
        activityCodes={activityCodes}
      />

      {/* ── 4. Results Area ─────────────────────────────────────────────────── */}
      {/* Initial Empty State before Query */}
      {!hasQueried && !isLoading && (
        <EmptyState message="Set your filters and click 'Run report' to see results." />
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="py-16 text-center bg-white rounded-lg border border-slate-200">
          <div className="inline-block w-7 h-7 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Running report…</p>
          <p className="text-xs text-slate-400 mt-1">Aggregating attendance records and rate calculations</p>
        </div>
      )}

      {/* No Results Match State */}
      {hasQueried && !isLoading && !hasResults && (
        <EmptyState message="No results match your filters." />
      )}

      {/* Render Table Corresponding to Active Tab */}
      {hasQueried && !isLoading && hasResults && (
        <div className="transition-opacity duration-200">
          {activeTab === 'summary' && summaryData && (
            <SummaryTable data={summaryData} />
          )}

          {activeTab === 'day-ot-summary' && dayOtData && (
            <DayOtSummaryTable data={dayOtData} />
          )}

          {activeTab === 'bp-bill' && bpBillData && (
            <BpBillTable data={bpBillData} />
          )}

          {activeTab === 'erp-upload' && erpData && (
            <ErpUploadTable data={erpData} />
          )}
        </div>
      )}
    </div>
  );
}
