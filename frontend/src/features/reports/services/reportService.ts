/**
 * reportService.ts — Service layer for the multi-tab Reports module.
 *
 * Backend endpoints:
 *   GET /api/reports/filter-options  → business partners + activity codes
 *   GET /api/reports/summary         → getSummaryReport()
 *   GET /api/reports/day-ot-summary  → getDayOtSummaryReport()
 *   GET /api/reports/bp-bill         → getBpBillReport()
 *   GET /api/reports/erp-upload      → getErpUploadReport()
 *
 * All functions fall back to mock data when backend is unavailable.
 */

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';
function buildParams(f: ReportFilters): string {
  const p = new URLSearchParams();
  if (f.dateFrom) p.set('dateFrom', f.dateFrom);
  if (f.dateTo) p.set('dateTo', f.dateTo);
  if (f.employeeQuery) p.set('employeeQuery', f.employeeQuery);
  if (f.businessPartner) p.set('businessPartner', f.businessPartner);
  if (f.activityCode) p.set('activityCode', f.activityCode);
  return p.toString();
}
let _fOpts: {businessPartners: string[]; activityCodes: {code: string; description: string}[]} | null = null;
async function loadFOpts() {
  if (_fOpts) return _fOpts;
  try { const r = await apiFetch(API_URL + '/reports/filter-options'); if (r.ok) { _fOpts = await r.json(); return _fOpts; } } catch (_) {}
  return null;
}

export type ReportType = 'summary' | 'day-ot-summary' | 'bp-bill' | 'erp-upload' | 'running-chart';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  employeeQuery?: string;
  businessPartner?: string;
  activityCode?: string;
}

// ── 1. Summary Report Types ──────────────────────────────────────────────────

export interface SummaryReportItem {
  id: string;
  employeeId: string;
  employeeCode?: string;
  callingName?: string;
  employeeIdentifier?: string;
  employeeName: string;
  tradeGroup: string;
  businessPartner: string;
  totalDays: number;
  totalNormalHours: number;
  totalOtHours: number;
  totalEffectiveHours?: number;
  totalHours: number;
}

export interface SummaryReportResponse {
  items: SummaryReportItem[];
  totals: {
    employeeCount: number;
    totalDays: number;
    totalNormalHours: number;
    totalOtHours: number;
    totalHours: number;
  };
}

// ── 2. Day & OT Summary Report Types ─────────────────────────────────────────

export interface DayOtDailyEntry {
  days: number;
  otHours: number;
  workHours: number; // actual effective hours worked that day
}

export interface DayOtSummaryItem {
  id: string;
  employeeId: string;
  employeeName: string;
  tradeGroup: string;
  businessPartner: string;
  dailyEntries: Record<string, DayOtDailyEntry>; // keyed by date 'YYYY-MM-DD'
  totalDays: number;
  totalOtHours: number;
  totalWorkHours: number; // total effective hours worked across all days
}

export interface DayOtSummaryResponse {
  dates: string[]; // List of all dates in the range
  items: DayOtSummaryItem[];
  totals: {
    totalDays: number;
    totalOtHours: number;
    totalWorkHours: number;
    dateTotals: Record<string, { days: number; otHours: number; workHours: number }>;
  };
}

// ── 3. BP Bill Report Types ──────────────────────────────────────────────────

export interface BpBillEmployeeItem {
  id: string;
  employeeId: string;
  employeeName: string;
  tradeGroup: string;
  dailyHours: Record<string, number>; // keyed by date 'YYYY-MM-DD'
  totalHours: number;
  hourlyRate: number; // LKR
  totalHourlyPayment: number; // totalHours * hourlyRate
  overhead: number; // 10% of totalHourlyPayment
  totalCost: number; // totalHourlyPayment + overhead
}

export interface BpBillGroup {
  businessPartner: string;
  items: BpBillEmployeeItem[];
  subtotalHours: number;
  subtotalPayment: number;
  subtotalOverhead: number;
  subtotalCost: number;
}

export interface BpBillResponse {
  dates: string[];
  groups: BpBillGroup[];
  grandTotalHours: number;
  grandTotalPayment: number;
  grandTotalOverhead: number;
  grandTotalCost: number;
}

// ── 4. ERP Upload Export Types ───────────────────────────────────────────────

export interface ErpUploadRow {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  activityCode: string;
  activityDescription: string;
  hours: number;
  overtimeHours: number;
  remarks: string;
}

export interface ErpUploadResponse {
  rows: ErpUploadRow[];
  totalHours: number;
  totalOtHours: number;
  rowCount: number;
}

/** Backward compatibility alias for legacy imports */
export type ReportRow = ErpUploadRow;

// ── 5. Running Chart Report Types ───────────────────────────────────────────

export interface RunningChartActivity {
  code: string;
  description?: string;
  hours: number;
}

export interface RunningChartItem {
  id: string;
  date: string;
  supervisorName: string;
  employeeCode: string;
  callingName: string;
  businessPartner: string;
  inTime: string;
  outTime: string;
  breakHours?: number;
  workHours: number;
  otHours: number;
  totalHours: number;
  activities: RunningChartActivity[];
  activitiesDisplay: string;
}

export interface RunningChartResponse {
  items: RunningChartItem[];
  totals: {
    totalRecords: number;
    totalWorkHours: number;
    totalOtHours: number;
    totalHours: number;
  };
}

export async function getBusinessPartnerOptions(): Promise<string[]> {
  return cacheManager.fetchWithCache('reports:filter-opts:bp', async () => {
    const o = await loadFOpts();
    if (o?.businessPartners?.length) return o.businessPartners;
    return [];
  });
}

export async function getActivityCodeOptions(): Promise<{ code: string; description: string }[]> {
  return cacheManager.fetchWithCache('reports:filter-opts:act', async () => {
    const o = await loadFOpts();
    if (o?.activityCodes?.length) return o.activityCodes;
    return [];
  });
}

// ── 1. GET Summary Report ────────────────────────────────────────────────────

/**
 * Fetch employee summary totals.
 * TODO: Replace with real API call:
 *   const { data } = await axios.get<SummaryReportResponse>('/api/reports/summary', { params: filters });
 *   return data;
 */
export async function getSummaryReport(filters: ReportFilters): Promise<SummaryReportResponse> {
  const cacheKey = `reports:summary:${JSON.stringify(filters)}`;
  return cacheManager.fetchWithCache(cacheKey, async () => {
    try {
      const _r = await apiFetch(API_URL + '/reports/summary?' + buildParams(filters));
      if (_r.ok) {
        const _d = await _r.json();
        if (_d?.items) {
          const sanitizedItems: SummaryReportItem[] = _d.items.map((item: any) => {
            let effective = item.totalEffectiveHours ?? item.totalHours;
            let normal = item.totalNormalHours;
            const ot = Number(item.totalOtHours) || 0;
            // Guard against legacy backend where normalHours was shift total and ot was added on top
            if (item.totalHours === normal + ot && normal > 0 && ot > 0 && !item.totalEffectiveHours) {
              effective = normal;
              normal = Math.max(0, effective - ot);
            }
            return {
              ...item,
              totalNormalHours: normal,
              totalOtHours: ot,
              totalEffectiveHours: effective,
              totalHours: effective,
            };
          });
          const totals = {
            ..._d.totals,
            totalHours: sanitizedItems.reduce((s, i) => s + i.totalHours, 0),
            totalNormalHours: sanitizedItems.reduce((s, i) => s + i.totalNormalHours, 0),
            totalOtHours: sanitizedItems.reduce((s, i) => s + i.totalOtHours, 0),
          };
          return { items: sanitizedItems, totals };
        }
      }
    } catch (_e) {
      console.warn('Backend unavailable or failed:', _e);
    }
    return {
      items: [],
      totals: {
        employeeCount: 0,
        totalDays: 0,
        totalNormalHours: 0,
        totalOtHours: 0,
        totalHours: 0,
      },
    };
  });
}

// ── 2. GET Day & OT Summary Report ───────────────────────────────────────────

export async function getDayOtSummaryReport(filters: ReportFilters): Promise<DayOtSummaryResponse> {
  const cacheKey = `reports:day-ot:${JSON.stringify(filters)}`;
  return cacheManager.fetchWithCache(cacheKey, async () => {
    try {
      const _r = await apiFetch(API_URL + '/reports/day-ot-summary?' + buildParams(filters));
      if (_r.ok) {
        const _d = await _r.json();
        if (_d?.items) return _d as DayOtSummaryResponse;
      }
    } catch (_e) {
      console.warn('Backend unavailable or failed:', _e);
    }
    return {
      dates: [],
      items: [],
      totals: {
        totalDays: 0,
        totalOtHours: 0,
        totalWorkHours: 0,
        dateTotals: {},
      },
    };
  });
}

// ── 3. GET BP Bill Report ────────────────────────────────────────────────────

export async function getBpBillReport(filters: ReportFilters): Promise<BpBillResponse> {
  const cacheKey = `reports:bp-bill:${JSON.stringify(filters)}`;
  return cacheManager.fetchWithCache(cacheKey, async () => {
    try {
      const _r = await apiFetch(API_URL + '/reports/bp-bill?' + buildParams(filters));
      if (_r.ok) {
        const _d = await _r.json();
        if (_d?.groups) return _d as BpBillResponse;
      }
    } catch (_e) {
      console.warn('Backend unavailable or failed:', _e);
    }
    return {
      dates: [],
      groups: [],
      grandTotalHours: 0,
      grandTotalPayment: 0,
      grandTotalOverhead: 0,
      grandTotalCost: 0,
    };
  });
}

// ── 4. GET ERP Upload Export Preview ─────────────────────────────────────────

export async function getErpUploadReport(filters: ReportFilters): Promise<ErpUploadResponse> {
  const cacheKey = `reports:erp-upload:${JSON.stringify(filters)}`;
  return cacheManager.fetchWithCache(cacheKey, async () => {
    try {
      const _r = await apiFetch(API_URL + '/reports/erp-upload?' + buildParams(filters));
      if (_r.ok) {
        const _d = await _r.json();
        if (_d?.rows) return _d as ErpUploadResponse;
      }
    } catch (_e) {
      console.warn('Backend unavailable or failed:', _e);
    }
    return {
      rows: [],
      totalHours: 0,
      totalOtHours: 0,
      rowCount: 0,
    };
  });
}

// ── 5. GET Running Chart Report ──────────────────────────────────────────────

export async function getRunningChartReport(filters: ReportFilters): Promise<RunningChartResponse> {
  const cacheKey = `reports:running-chart:${JSON.stringify(filters)}`;
  return cacheManager.fetchWithCache(cacheKey, async () => {
    try {
      const _r = await apiFetch(API_URL + '/reports/running-chart?' + buildParams(filters));
      if (_r.ok) {
        const _d = await _r.json();
        if (_d?.items) return _d as RunningChartResponse;
      }
    } catch (_e) {
      console.warn('Backend unavailable or failed:', _e);
    }
    return {
      items: [],
      totals: {
        totalRecords: 0,
        totalWorkHours: 0,
        totalOtHours: 0,
        totalHours: 0,
      },
    };
  });
}

// ── 6. Excel Export Service ──────────────────────────────────────────────────

import type { Tenant } from '../../auth/services/authService';
import {
  exportSummaryToExcel,
  exportDayOtSummaryToExcel,
  exportBpBillToExcel,
  exportErpUploadToExcel,
  exportRunningChartToExcel,
} from './excelExport';

/**
 * Trigger Excel file download.
 */
export async function exportReport(
  type: ReportType,
  filters: ReportFilters,
  tenant: Tenant,
  preparedBy: string
): Promise<void> {
  if (type === 'summary') {
    const data = await getSummaryReport(filters);
    await exportSummaryToExcel(data, tenant, preparedBy, filters);
  } else if (type === 'day-ot-summary') {
    const data = await getDayOtSummaryReport(filters);
    await exportDayOtSummaryToExcel(data, tenant, preparedBy, filters);
  } else if (type === 'bp-bill') {
    const data = await getBpBillReport(filters);
    await exportBpBillToExcel(data, tenant, preparedBy, filters);
  } else if (type === 'erp-upload') {
    const data = await getErpUploadReport(filters);
    await exportErpUploadToExcel(data, tenant, preparedBy, filters);
  } else if (type === 'running-chart') {
    const data = await getRunningChartReport(filters);
    await exportRunningChartToExcel(data, tenant, preparedBy, filters);
  }
}

export {
  exportSummaryToExcel,
  exportDayOtSummaryToExcel,
  exportBpBillToExcel,
  exportErpUploadToExcel,
  exportRunningChartToExcel,
};
