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

import { API_URL, apiFetch, getCurrentTenantId } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';
function buildParams(f: ReportFilters): string {
  const p = new URLSearchParams();
  const currentTenant = getCurrentTenantId();
  if (currentTenant) p.set('tenantId', currentTenant);
  if (f.dateFrom) p.set('dateFrom', f.dateFrom);
  if (f.dateTo) p.set('dateTo', f.dateTo);
  if (f.employeeQuery) p.set('employeeQuery', f.employeeQuery);
  if (f.businessPartner) p.set('businessPartner', f.businessPartner);
  if (f.activityCode) p.set('activityCode', f.activityCode);
  if (f.workerType) p.set('workerType', f.workerType);
  return p.toString();
}
let _fOpts: {businessPartners: string[]; activityCodes: {code: string; description: string}[]} | null = null;
async function loadFOpts() {
  if (_fOpts) return _fOpts;
  try { const r = await apiFetch(API_URL + '/reports/filter-options'); if (r.ok) { _fOpts = await r.json(); return _fOpts; } } catch (_) {}
  return null;
}

export type ReportType = 
  | 'summary' 
  | 'day-ot-summary' 
  | 'bp-bill' 
  | 'erp-upload' 
  | 'running-chart' 
  | 'time-card' 
  | 'equipment-running-chart' 
  | 'equipment-summary' 
  | 'equipment-erp-upload';

export type ReportCategory = 'labor' | 'operator' | 'equipment';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  employeeQuery?: string;
  businessPartner?: string;
  activityCode?: string;
  month?: string;
  workerType?: 'all' | 'labor' | 'operator';
  equipmentQuery?: string;
  condition?: string;
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
  tradeGroup?: string;
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
  const tId = getCurrentTenantId() || 'default';
  const cacheKey = `reports:${tId}:summary:${JSON.stringify(filters)}`;
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
  const tId = getCurrentTenantId() || 'default';
  const cacheKey = `reports:${tId}:day-ot:${JSON.stringify(filters)}`;
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
  const tId = getCurrentTenantId() || 'default';
  const cacheKey = `reports:${tId}:bp-bill:${JSON.stringify(filters)}`;
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
  const tId = getCurrentTenantId() || 'default';
  const cacheKey = `reports:${tId}:erp-upload:${JSON.stringify(filters)}`;
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
  const tId = getCurrentTenantId() || 'default';
  const cacheKey = `reports:${tId}:running-chart:${JSON.stringify(filters)}`;
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

// ── 5.1 GET Time Card Report (Maga Official Format) ─────────────────────────

export interface TimeCardDayItem {
  day: number;
  date: string;
  key: string; // '\' | 'X' | '*' | '@' | ''
  inTime: string;
  outTime: string;
  daysWorked: number | null;
  otHours: number | null;
  advance: number | null;
  equipmentCode?: string | null;
  isOffMonth: boolean;
}

export interface TimeCardTotals {
  totalDays: number;
  totalOtHours: number;
  basicPay: number;
  otPay: number;
  allowances: number;
  otherEarnings: number;
  grossPay: number;
  deductions: {
    advances: number;
    epf: number;
    loans: number;
    messAdvances: number;
    advancesOtherSite: number;
    festivalAdvances: number;
    others: number;
    total: number;
  };
  netPay: number;
}

export interface TimeCardItem {
  employeeId: string;
  employeeCode: string;
  callingName: string;
  fullName: string;
  trade: string;
  nicNo: string;
  epfNo: string;
  dailyRate: number;
  hourlyOtRate: number;
  isOperator: boolean;
  businessPartner: string;
  siteName: string;
  companyName: string;
  month: string;
  days: TimeCardDayItem[];
  totals: TimeCardTotals;
}

export interface TimeCardResponse {
  month: string;
  monthLabel: string;
  totalCards: number;
  cards: TimeCardItem[];
}

export async function getTimeCardReport(filters: ReportFilters): Promise<TimeCardResponse> {
  const tId = getCurrentTenantId() || 'default';
  const p = new URLSearchParams();
  if (tId) p.set('tenantId', tId);
  if (filters.month) p.set('month', filters.month);
  else if (filters.dateFrom) p.set('month', filters.dateFrom.slice(0, 7));
  if (filters.employeeQuery) p.set('employeeId', filters.employeeQuery);
  if (filters.workerType) p.set('workerType', filters.workerType);
  if (filters.businessPartner) p.set('businessPartnerId', filters.businessPartner);

  try {
    const r = await apiFetch(API_URL + '/reports/time-card?' + p.toString());
    if (r.ok) {
      const data = await r.json();
      if (data?.cards) return data as TimeCardResponse;
    }
  } catch (e) {
    console.warn('Failed to fetch time card report:', e);
  }
  return {
    month: filters.month || new Date().toISOString().slice(0, 7),
    monthLabel: 'Current Month',
    totalCards: 0,
    cards: [],
  };
}

// ── 6. Excel Export Service ──────────────────────────────────────────────────

import type { Tenant } from '../../auth/services/authService';
import {
  exportSummaryToExcel,
  exportDayOtSummaryToExcel,
  exportBpBillToExcel,
  exportErpUploadToExcel,
  exportRunningChartToExcel,
  exportEquipmentErpToExcel,
  exportEquipmentSummaryToExcel,
  exportTimeCardToExcel,
} from './excelExport';

export { exportTimeCardToExcel };

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
  } else if (type === 'equipment-erp-upload') {
    const data = await getEquipmentErpUploadReport(filters);
    await exportEquipmentErpToExcel(data);
  } else if (type === 'equipment-summary') {
    const data = await getEquipmentSummaryReport(filters, { preparedBy });
    await exportEquipmentSummaryToExcel(data, tenant, preparedBy, filters);
  } else if (type === 'time-card') {
    const data = await getTimeCardReport(filters);
    await exportTimeCardToExcel(data, tenant, preparedBy);
  }
}

export interface ReportsHubStats {
  labor: {
    totalWorkers: number;
    monthlyHours: number;
    subcontractorsCount: number;
    reportsCount: number;
  };
  operator: {
    totalOperators: number;
    monthlyHours: number;
    reportsCount: number;
  };
  equipment: {
    totalEquipment: number;
    monthlyAssignments: number;
    reportsCount: number;
  };
}

export async function getReportsHubStats(): Promise<ReportsHubStats> {
  try {
    const currentTenant = getCurrentTenantId();
    const query = currentTenant ? `?tenantId=${currentTenant}` : '';
    const r = await apiFetch(`${API_URL}/reports/hub-stats${query}`);
    if (r.ok) {
      return await r.json();
    }
  } catch (err) {
    console.warn('Failed to fetch hub stats, using fallbacks:', err);
  }
  return {
    labor: { totalWorkers: 120, monthlyHours: 2450, subcontractorsCount: 8, reportsCount: 5 },
    operator: { totalOperators: 24, monthlyHours: 680, reportsCount: 4 },
    equipment: { totalEquipment: 45, monthlyAssignments: 180, reportsCount: 3 },
  };
}

export interface EquipmentRunningChartItem {
  id: string;
  date: string;
  equipmentId: string;
  equipmentCode: string;
  equipmentName: string;
  vehicleNo: string;
  magaNo: string;
  condition: string;
  primaryUnit: string;
  supervisorName: string;
  initialMeter: number;
  finalMeter: number;
  netRunningHours: number;
  workingHours: number;
  idleHours: number;
  breakdownHours: number;
  fuelLiters: number;
  remarks: string;
  status: string;
}

export interface EquipmentRunningChartResponse {
  items: EquipmentRunningChartItem[];
  totals: {
    totalRecords: number;
    totalNetHours: number;
    totalWorkingHours: number;
    totalIdleHours: number;
    totalFuelLiters: number;
  };
}

export async function getEquipmentRunningChartReport(
  filters: ReportFilters
): Promise<EquipmentRunningChartResponse> {
  const p = new URLSearchParams();
  const currentTenant = getCurrentTenantId();
  if (currentTenant) p.set('tenantId', currentTenant);
  if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) p.set('dateTo', filters.dateTo);
  if (filters.equipmentQuery) p.set('equipmentQuery', filters.equipmentQuery);
  if (filters.condition) p.set('condition', filters.condition);

  try {
    const r = await apiFetch(`${API_URL}/reports/equipment-running-chart?${p.toString()}`);
    if (r.ok) {
      return await r.json();
    }
  } catch (err) {
    console.warn('Failed to fetch equipment running chart, falling back:', err);
  }

  return {
    items: [],
    totals: {
      totalRecords: 0,
      totalNetHours: 0,
      totalWorkingHours: 0,
      totalIdleHours: 0,
      totalFuelLiters: 0,
    },
  };
}

export interface EquipmentSummaryRow {
  id: string;
  vehicleOrMagaNo: string;
  equipmentName: string;
  businessPartner: string;
  condition: string;
  unit: string;
  minUtilization: string;
  totalUtilization: string;
  totalMileage: string;
}

export interface EquipmentSummaryResponse {
  sheetTitle: string;
  companyName: string;
  address: string;
  phone: string;
  fax: string;
  email: string;
  date: string;
  dateFrom?: string;
  dateTo?: string;
  periodText?: string;
  sheetNo?: string;
  preparedBy?: string;
  projectCentre: string;
  totalRecords: number;
  rows: EquipmentSummaryRow[];
  totals?: {
    totalUtilization: number;
    totalMileage: number;
  };
}

export async function getEquipmentSummaryReport(
  filters: ReportFilters,
  extra?: { preparedBy?: string; projectCentre?: string }
): Promise<EquipmentSummaryResponse> {
  const p = new URLSearchParams();
  const currentTenant = getCurrentTenantId();
  if (currentTenant) p.set('tenantId', currentTenant);
  if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) p.set('dateTo', filters.dateTo);
  if (filters.month) p.set('month', filters.month);
  if (filters.equipmentQuery) p.set('equipmentQuery', filters.equipmentQuery);
  if (filters.condition) p.set('condition', filters.condition);
  if (extra?.preparedBy) p.set('preparedBy', extra.preparedBy);
  if (extra?.projectCentre) p.set('projectCentre', extra.projectCentre);

  try {
    const r = await apiFetch(`${API_URL}/reports/equipment-summary?${p.toString()}`);
    if (r.ok) {
      return await r.json();
    }
  } catch (err) {
    console.warn('Failed to fetch equipment summary, falling back:', err);
  }

  const periodText = filters.dateFrom && filters.dateTo && filters.dateFrom !== filters.dateTo
    ? `${filters.dateFrom} to ${filters.dateTo}`
    : (filters.dateTo || filters.dateFrom || new Date().toISOString().split('T')[0]);

  return {
    sheetTitle: 'EQUIPMENT ENTRY SHEET',
    companyName: 'Mäga Engineering (Pvt) Ltd',
    address: '200, Nawala Road, Narahenpita, Colombo 05, Sri Lanka',
    phone: '2808835-44',
    fax: '2808846-48',
    email: 'maga@maga.lk',
    date: filters.dateTo || filters.dateFrom || new Date().toISOString().split('T')[0],
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    periodText,
    sheetNo: `EES-${(filters.dateFrom || filters.dateTo || new Date().toISOString()).slice(0, 7).replace('-', '')}`,
    preparedBy: extra?.preparedBy || 'Site Supervisor / Plant Eng.',
    projectCentre: extra?.projectCentre || 'Maga Central Project Operations',
    totalRecords: 0,
    rows: [],
    totals: {
      totalUtilization: 0,
      totalMileage: 0,
    },
  };
}

export interface EquipmentErpUploadRow {
  equipment: string;
  condition: string;
  unit: string;
  date: string;
  activity: string;
  utilization: string;
}

export interface EquipmentErpUploadResponse {
  date: string;
  activityCode: string;
  totalRows: number;
  rows: EquipmentErpUploadRow[];
}

export async function getEquipmentErpUploadReport(
  filters: ReportFilters
): Promise<EquipmentErpUploadResponse> {
  const p = new URLSearchParams();
  const currentTenant = getCurrentTenantId();
  if (currentTenant) p.set('tenantId', currentTenant);
  if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) p.set('dateTo', filters.dateTo);
  if (filters.month) p.set('month', filters.month);
  if (filters.condition) p.set('condition', filters.condition);
  if (filters.activityCode) p.set('activityCode', filters.activityCode);

  try {
    const r = await apiFetch(`${API_URL}/reports/equipment-erp-upload?${p.toString()}`);
    if (r.ok) {
      return await r.json();
    }
  } catch (err) {
    console.warn('Failed to fetch equipment ERP upload, falling back:', err);
  }

  return {
    date: '31-10-2026',
    activityCode: filters.activityCode || '00-00-10-00',
    totalRows: 0,
    rows: [],
  };
}

export {
  exportSummaryToExcel,
  exportDayOtSummaryToExcel,
  exportBpBillToExcel,
  exportErpUploadToExcel,
  exportRunningChartToExcel,
};

