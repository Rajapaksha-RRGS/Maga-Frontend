/**
 * ReportsPage.tsx — Operations & Payroll Reports Studio.
 *
 * Provides:
 *   1. 3D Stacked Cards Overview Hub (matching user visual reference)
 *      - Card 1: Labor & Workforce Reports (Emerald/Teal 3D stacked deck)
 *      - Card 2: Operator & Machinery Drivers (Deep Purple/Indigo 3D stacked deck)
 *      - Card 3: Equipment & Plant Fleet (Sunset Orange/Amber 3D stacked deck)
 *   2. Inside Category Workspace:
 *      - Clean, modern, unified layout (neutral palette, crisp tables, no color clutter)
 *      - Back to Hub button + Category quick-switcher
 *      - Dedicated sub-reports per category (Time Cards, Running Charts, Attendance Matrices, ERP exports)
 */
import { useState, useCallback } from 'react';
import { 
  Download, 
  Users, 
  HardHat, 
  Truck
} from 'lucide-react';
import { useReports } from '../features/reports/hooks/useReports';
import type { ReportCategory } from '../features/reports/services/reportService';
import ReportTypeSelector from '../features/reports/components/ReportTypeSelector';
import ReportFiltersBar from '../features/reports/components/ReportFilters';
import SummaryTable from '../features/reports/components/SummaryTable';
import DayOtSummaryTable from '../features/reports/components/DayOtSummaryTable';
import BpBillTable from '../features/reports/components/BpBillTable';
import ErpUploadTable from '../features/reports/components/ErpUploadTable';
import RunningChartTable from '../features/reports/components/RunningChartTable';
import { EquipmentRunningChartTable } from '../features/reports/components/EquipmentRunningChartTable';
import { EquipmentEntrySheetView } from '../features/reports/components/EquipmentEntrySheetView';
import { EquipmentErpUploadTable } from '../features/reports/components/EquipmentErpUploadTable';
import { TimeCardReportView } from '../features/reports/components/TimeCardReportView';
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
    runningChartData,
    equipmentRunningChartData,
    equipmentSummaryData,
    equipmentErpData,
  } = useReports();

  // Active Category State: 'labor' | 'operator' | 'equipment'
  const [selectedCategory, setSelectedCategory] = useState<ReportCategory>('labor');

  // Handle category selection
  const handleSelectCategory = useCallback((category: ReportCategory) => {
    setSelectedCategory(category);
    const workerType = category === 'operator' ? 'operator' : category === 'labor' ? 'labor' : '';
    updateFilter('workerType', workerType);
    if (category === 'labor') {
      setActiveTab('time-card');
    } else if (category === 'operator') {
      setActiveTab('summary');
    } else if (category === 'equipment') {
      setActiveTab('equipment-summary');
    }
  }, [setActiveTab, updateFilter]);

  return (
    <div className="px-4 md:px-6 py-5 max-w-7xl mx-auto flex flex-col gap-5">
      {/* ── Top Bar: Title, Category Switcher & Export ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-300 shadow-2xs">
        <div className="flex flex-col gap-1">
          {/* Category Heading & Badge */}
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-base font-bold text-slate-900 flex items-center gap-2">
              {selectedCategory === 'labor' && (
                <>
                  <Users size={18} className="text-slate-700" />
                  <span>Labor & Workforce Reports</span>
                </>
              )}
              {selectedCategory === 'operator' && (
                <>
                  <HardHat size={18} className="text-slate-700" />
                  <span>Operator & Machinery Reports</span>
                </>
              )}
              {selectedCategory === 'equipment' && (
                <>
                  <Truck size={18} className="text-slate-700" />
                  <span>Equipment & Fleet Reports</span>
                </>
              )}
            </h1>

          </div>
        </div>

        {/* Right Action: Category Quick-Switcher & Export Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Category Quick Switcher */}
          <div className="flex items-center p-1 bg-slate-50 rounded-xl border border-slate-300 text-xs">
            <button
              onClick={() => handleSelectCategory('labor')}
              className={[
                'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5',
                selectedCategory === 'labor'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-400'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-300',
              ].join(' ')}
            >
              <Users size={13} className={selectedCategory === 'labor' ? 'text-slate-900' : 'text-slate-400'} />
              <span>Labor</span>
            </button>

            <button
              onClick={() => handleSelectCategory('operator')}
              className={[
                'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5',
                selectedCategory === 'operator'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-400'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-300',
              ].join(' ')}
            >
              <HardHat size={13} className={selectedCategory === 'operator' ? 'text-slate-900' : 'text-slate-400'} />
              <span>Operator</span>
            </button>

            <button
              onClick={() => handleSelectCategory('equipment')}
              className={[
                'px-3 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5',
                selectedCategory === 'equipment'
                  ? 'bg-white text-slate-900 shadow-2xs border border-slate-400'
                  : 'text-slate-600 hover:text-slate-900 border border-transparent hover:border-slate-300',
              ].join(' ')}
            >
              <Truck size={13} className={selectedCategory === 'equipment' ? 'text-slate-900' : 'text-slate-400'} />
              <span>Equipment</span>
            </button>
          </div>

          {/* Export to Excel */}
          <button
            onClick={exportExcel}
            disabled={isExporting}
            className="flex items-center gap-2 border border-slate-300 text-slate-800 font-semibold text-xs rounded-xl px-3.5 min-h-[38px] transition-colors bg-white hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed shadow-2xs"
          >
            {isExporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-transparent rounded-full animate-spin" />
                <span>Exporting…</span>
              </>
            ) : (
              <>
                <Download size={14} className="text-emerald-700" />
                <span>Export Excel</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── Category Sub-Reports Tabs ── */}
      <ReportTypeSelector
        activeTab={activeTab}
        onTabChange={setActiveTab}
        category={selectedCategory}
      />

      {/* ── Report Views ── */}
      {activeTab === 'time-card' ? (
        <TimeCardReportView 
          businessPartners={businessPartners} 
          defaultWorkerType={selectedCategory === 'operator' ? 'operator' : 'labor'} 
        />
      ) : (
        <>
          {/* Dynamic Filter Bar */}
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

          {/* Results State Area */}
          {!hasQueried && !isLoading && (
            <EmptyState message="Set your filters and click 'Run report' to generate verified records." />
          )}

          {isLoading && (
            <div className="py-16 text-center bg-white rounded-xl border border-slate-200 shadow-2xs">
              <div className="inline-block w-7 h-7 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mb-3" />
              <p className="text-sm font-medium text-slate-700">Compiling report data…</p>
              <p className="text-xs text-slate-400 mt-1">Aggregating records and telemetry calculations</p>
            </div>
          )}

          {hasQueried && !isLoading && !hasResults && (
            <EmptyState message="No records found matching your specified filter criteria." />
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

              {activeTab === 'running-chart' && runningChartData && (
                <RunningChartTable data={runningChartData} />
              )}

              {activeTab === 'equipment-running-chart' && equipmentRunningChartData && (
                <EquipmentRunningChartTable data={equipmentRunningChartData} />
              )}

              {activeTab === 'equipment-summary' && equipmentSummaryData && (
                <EquipmentEntrySheetView 
                  data={equipmentSummaryData} 
                  onExportExcel={exportExcel} 
                  isExporting={isExporting} 
                />
              )}

              {activeTab === 'equipment-erp-upload' && equipmentErpData && (
                <EquipmentErpUploadTable data={equipmentErpData} />
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
