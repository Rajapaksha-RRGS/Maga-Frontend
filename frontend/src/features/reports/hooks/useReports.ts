/**
 * useReports.ts — State management hook for multi-tab reports.
 *
 * Handles:
 *   - Active tab selection (Summary, Day & OT Summary, BP Bill, ERP Upload)
 *   - Dynamic filter inputs
 *   - Async report generation per tab
 *   - Excel export file download trigger
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import type {
  ReportType,
  ReportFilters,
  SummaryReportResponse,
  DayOtSummaryResponse,
  BpBillResponse,
  ErpUploadResponse,
  RunningChartResponse,
} from '../services/reportService';
import * as svc from '../services/reportService';
import { cacheManager } from '../../../utils/cacheManager';

import { useAuth } from '../../../context/AuthContext';
import { getTenantById } from '../../auth/services/authService';

const INITIAL_FILTERS: ReportFilters = {
  dateFrom: '2026-08-01',
  dateTo: '2026-08-15',
  employeeQuery: '',
  businessPartner: '',
  activityCode: '',
};

export function useReports() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ReportType>(
    () => cacheManager.get<ReportType>('reports:active-tab') || 'summary'
  );
  const [filters, setFilters] = useState<ReportFilters>(
    () => cacheManager.get<ReportFilters>('reports:active-filters') || INITIAL_FILTERS
  );

  // Result states — always start empty on page mount (force fresh fetch on every visit)
  const [summaryData, setSummaryData] = useState<SummaryReportResponse | null>(null);
  const [dayOtData, setDayOtData] = useState<DayOtSummaryResponse | null>(null);
  const [bpBillData, setBpBillData] = useState<BpBillResponse | null>(null);
  const [erpData, setErpData] = useState<ErpUploadResponse | null>(null);
  const [runningChartData, setRunningChartData] = useState<RunningChartResponse | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  // Always false on mount — user must click "Run Report" each time they visit the page
  const [hasQueried, setHasQueried] = useState<boolean>(false);

  // Options for dropdown filters
  const [businessPartners, setBusinessPartners] = useState<string[]>(
    () => cacheManager.get<string[]>('reports:filter-opts:bp') || []
  );
  const [activityCodes, setActivityCodes] = useState<{ code: string; description: string }[]>(
    () => cacheManager.get<{ code: string; description: string }[]>('reports:filter-opts:act') || []
  );

  useEffect(() => {
    // Clear stale result caches on every page mount — ensures fresh data on next query
    cacheManager.invalidate('reports:last-summary');
    cacheManager.invalidate('reports:last-day-ot');
    cacheManager.invalidate('reports:last-bp-bill');
    cacheManager.invalidate('reports:last-erp');
    cacheManager.invalidate('reports:last-running-chart');
    // Load filter dropdown options (these are stable reference data — OK to cache)
    svc.getBusinessPartnerOptions().then(setBusinessPartners);
    svc.getActivityCodeOptions().then(setActivityCodes);
  }, []);

  // Update a single filter field
  const updateFilter = useCallback((key: keyof ReportFilters, value: string) => {
    setFilters((prev) => {
      const updated = {
        ...prev,
        [key]: value || undefined,
      };
      cacheManager.set('reports:active-filters', updated);
      return updated;
    });
  }, []);

  // Reset all filters to default
  const resetFilters = useCallback(() => {
    setFilters(INITIAL_FILTERS);
    cacheManager.set('reports:active-filters', INITIAL_FILTERS);
    setHasQueried(false);
  }, []);

  // Switch tab — keep hasQueried based on whether current tab has data in state
  const handleTabChange = useCallback((tab: ReportType) => {
    setActiveTab(tab);
    cacheManager.set('reports:active-tab', tab);
    // hasQueried reflects whether the newly selected tab has results in current session
    const hasResult = (
      (tab === 'summary' && !!summaryData && summaryData.items.length > 0) ||
      (tab === 'day-ot-summary' && !!dayOtData && dayOtData.items.length > 0) ||
      (tab === 'bp-bill' && !!bpBillData && bpBillData.groups.length > 0) ||
      (tab === 'erp-upload' && !!erpData && erpData.rows.length > 0) ||
      (tab === 'running-chart' && !!runningChartData && runningChartData.items.length > 0)
    );
    setHasQueried(hasResult);
  }, [summaryData, dayOtData, bpBillData, erpData, runningChartData]);

  // Execute report query for the active tab
  const runQuery = useCallback(async () => {
    setIsLoading(true);
    setHasQueried(true);
    // Invalidate report query caches to ensure fresh data from backend
    cacheManager.invalidate('reports');

    try {
      if (activeTab === 'summary') {
        const res = await svc.getSummaryReport(filters);
        setSummaryData(res);
        cacheManager.set('reports:last-summary', res);
      } else if (activeTab === 'day-ot-summary') {
        const res = await svc.getDayOtSummaryReport(filters);
        setDayOtData(res);
        cacheManager.set('reports:last-day-ot', res);
      } else if (activeTab === 'bp-bill') {
        const res = await svc.getBpBillReport(filters);
        setBpBillData(res);
        cacheManager.set('reports:last-bp-bill', res);
      } else if (activeTab === 'erp-upload') {
        const res = await svc.getErpUploadReport(filters);
        setErpData(res);
        cacheManager.set('reports:last-erp', res);
      } else if (activeTab === 'running-chart') {
        const res = await svc.getRunningChartReport(filters);
        setRunningChartData(res);
        cacheManager.set('reports:last-running-chart', res);
      }
    } catch (err) {
      console.error('Failed to run report query:', err);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, filters]);

  // Export current report as Excel (.xlsx) file download with tenant letterhead
  const exportExcel = useCallback(async () => {
    setIsExporting(true);
    try {
      const tenantId = user?.tenantId || 'tenant-001';
      const tenant = (await getTenantById(tenantId)) || {
        id: 'tenant-001',
        company_name: 'Mäga Engineering (Pvt) Ltd',
        subdomain: 'maga',
        address_line1: '200, Nawala Road,',
        address_line2: 'Narahenpita, Colombo 05, Sri Lanka',
        phone: '+94 11 2808835',
        fax: '+94 11 2808840',
        email: 'info@maga.lk',
      };
      const preparedBy = user?.fullName || 'Admin';

      await svc.exportReport(activeTab, filters, tenant, preparedBy);
    } catch (err) {
      console.error('Failed to export report:', err);
    } finally {
      setIsExporting(false);
    }
  }, [activeTab, filters, user]);

  // Check if current active tab has data
  const hasResults = useMemo(() => {
    if (activeTab === 'summary') return !!summaryData && summaryData.items.length > 0;
    if (activeTab === 'day-ot-summary') return !!dayOtData && dayOtData.items.length > 0;
    if (activeTab === 'bp-bill') return !!bpBillData && bpBillData.groups.length > 0;
    if (activeTab === 'erp-upload') return !!erpData && erpData.rows.length > 0;
    if (activeTab === 'running-chart') return !!runningChartData && runningChartData.items.length > 0;
    return false;
  }, [activeTab, summaryData, dayOtData, bpBillData, erpData, runningChartData]);

  return {
    activeTab,
    setActiveTab: handleTabChange,
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

    // Report data objects
    summaryData,
    dayOtData,
    bpBillData,
    erpData,
    runningChartData,
  };
}
