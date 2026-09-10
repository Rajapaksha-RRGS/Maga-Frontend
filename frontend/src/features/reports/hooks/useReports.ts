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

  // Separate result states per tab (persisted in cacheManager)
  const [summaryData, setSummaryData] = useState<SummaryReportResponse | null>(
    () => cacheManager.get<SummaryReportResponse>('reports:last-summary') || null
  );
  const [dayOtData, setDayOtData] = useState<DayOtSummaryResponse | null>(
    () => cacheManager.get<DayOtSummaryResponse>('reports:last-day-ot') || null
  );
  const [bpBillData, setBpBillData] = useState<BpBillResponse | null>(
    () => cacheManager.get<BpBillResponse>('reports:last-bp-bill') || null
  );
  const [erpData, setErpData] = useState<ErpUploadResponse | null>(
    () => cacheManager.get<ErpUploadResponse>('reports:last-erp') || null
  );
  const [runningChartData, setRunningChartData] = useState<RunningChartResponse | null>(
    () => cacheManager.get<RunningChartResponse>('reports:last-running-chart') || null
  );

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [hasQueried, setHasQueried] = useState<boolean>(() => {
    const tab = cacheManager.get<ReportType>('reports:active-tab') || 'summary';
    if (tab === 'summary') return !!cacheManager.get('reports:last-summary');
    if (tab === 'day-ot-summary') return !!cacheManager.get('reports:last-day-ot');
    if (tab === 'bp-bill') return !!cacheManager.get('reports:last-bp-bill');
    if (tab === 'erp-upload') return !!cacheManager.get('reports:last-erp');
    if (tab === 'running-chart') return !!cacheManager.get('reports:last-running-chart');
    return false;
  });

  // Options for dropdown filters
  const [businessPartners, setBusinessPartners] = useState<string[]>(
    () => cacheManager.get<string[]>('reports:filter-opts:bp') || []
  );
  const [activityCodes, setActivityCodes] = useState<{ code: string; description: string }[]>(
    () => cacheManager.get<{ code: string; description: string }[]>('reports:filter-opts:act') || []
  );

  useEffect(() => {
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

  // Switch tab — keep hasQueried if target tab has data
  const handleTabChange = useCallback((tab: ReportType) => {
    setActiveTab(tab);
    cacheManager.set('reports:active-tab', tab);
    const hasCachedResult = (
      (tab === 'summary' && !!cacheManager.get('reports:last-summary')) ||
      (tab === 'day-ot-summary' && !!cacheManager.get('reports:last-day-ot')) ||
      (tab === 'bp-bill' && !!cacheManager.get('reports:last-bp-bill')) ||
      (tab === 'erp-upload' && !!cacheManager.get('reports:last-erp')) ||
      (tab === 'running-chart' && !!cacheManager.get('reports:last-running-chart'))
    );
    setHasQueried(hasCachedResult);
  }, []);

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
