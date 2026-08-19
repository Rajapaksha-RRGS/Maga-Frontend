/**
 * useReports.ts — State management hook for multi-tab reports.
 *
 * Handles:
 *   - Active tab selection (Summary, Day & OT Summary, BP Bill, ERP Upload)
 *   - Dynamic filter inputs
 *   - Async report generation per tab
 *   - Excel export file download trigger
 */
import { useState, useCallback, useMemo } from 'react';
import type {
  ReportType,
  ReportFilters,
  SummaryReportResponse,
  DayOtSummaryResponse,
  BpBillResponse,
  ErpUploadResponse,
} from '../services/reportService';
import * as svc from '../services/reportService';

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
  const [activeTab, setActiveTab] = useState<ReportType>('summary');
  const [filters, setFilters] = useState<ReportFilters>(INITIAL_FILTERS);

  // Separate result states per tab
  const [summaryData, setSummaryData] = useState<SummaryReportResponse | null>(null);
  const [dayOtData, setDayOtData] = useState<DayOtSummaryResponse | null>(null);
  const [bpBillData, setBpBillData] = useState<BpBillResponse | null>(null);
  const [erpData, setErpData] = useState<ErpUploadResponse | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [hasQueried, setHasQueried] = useState<boolean>(false);

  // Static options for dropdown filters
  const businessPartners = useMemo(() => svc.getBusinessPartnerOptions(), []);
  const activityCodes = useMemo(() => svc.getActivityCodeOptions(), []);

  // Update a single filter field
  const updateFilter = useCallback((key: keyof ReportFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
    }));
  }, []);

  // Reset all filters to default
  const resetFilters = useCallback(() => {
    setFilters({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-15',
      employeeQuery: '',
      businessPartner: '',
      activityCode: '',
    });
    setHasQueried(false);
  }, []);

  // Switch tab — reset hasQueried for new tab if not queried yet
  const handleTabChange = useCallback((tab: ReportType) => {
    setActiveTab(tab);
    setHasQueried(false);
  }, []);

  // Execute report query for the active tab
  const runQuery = useCallback(async () => {
    setIsLoading(true);
    setHasQueried(true);

    try {
      if (activeTab === 'summary') {
        const res = await svc.getSummaryReport(filters);
        setSummaryData(res);
      } else if (activeTab === 'day-ot-summary') {
        const res = await svc.getDayOtSummaryReport(filters);
        setDayOtData(res);
      } else if (activeTab === 'bp-bill') {
        const res = await svc.getBpBillReport(filters);
        setBpBillData(res);
      } else if (activeTab === 'erp-upload') {
        const res = await svc.getErpUploadReport(filters);
        setErpData(res);
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
    return false;
  }, [activeTab, summaryData, dayOtData, bpBillData, erpData]);

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
  };
}
