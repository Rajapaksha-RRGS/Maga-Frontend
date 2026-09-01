/**
 * reportService.ts — Service layer for the multi-tab Reports module.
 *
 * Supported report types:
 *   1. Summary            → GET /api/reports/summary
 *   2. Day & OT Summary   → GET /api/reports/day-ot-summary
 *   3. BP Bill            → GET /api/reports/bp-bill
 *   4. ERP Upload Export  → GET /api/reports/erp-upload
 *   5. Export to Excel    → GET /api/reports/:type/export
 *
 * All mock functions simulate realistic network latency and data filtering.
 * TODO: Replace mock implementations with actual Axios calls to backend endpoints.
 */

export type ReportType = 'summary' | 'day-ot-summary' | 'bp-bill' | 'erp-upload';

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
  employeeName: string;
  tradeGroup: string;
  businessPartner: string;
  totalDays: number;
  totalNormalHours: number;
  totalOtHours: number;
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
}

export interface DayOtSummaryResponse {
  dates: string[]; // List of all dates in the range
  items: DayOtSummaryItem[];
  totals: {
    totalDays: number;
    totalOtHours: number;
    dateTotals: Record<string, { days: number; otHours: number }>;
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

// ── Helper & Seed Mock Data ──────────────────────────────────────────────────

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SEED_EMPLOYEES = [
  { id: 'emp-001', name: 'Kamal Perera',          partner: 'Mäga Engineering',    trade: 'Mason',          rate: 650 },
  { id: 'emp-002', name: 'Nimal Silva',           partner: 'Mäga Engineering',    trade: 'Carpenter',      rate: 620 },
  { id: 'emp-003', name: 'Sunil Fernando',        partner: 'Alpha Constructions', trade: 'Electrician',    rate: 700 },
  { id: 'emp-004', name: 'Chaminda Rajapakse',   partner: 'Alpha Constructions', trade: 'General labour', rate: 500 },
  { id: 'emp-005', name: 'Ruwan Jayawardena',    partner: 'Beta Projects',       trade: 'Plumber',        rate: 680 },
  { id: 'emp-006', name: 'Pradeep Bandara',       partner: 'Mäga Engineering',    trade: 'Welder',         rate: 750 },
  { id: 'emp-007', name: 'Lakmal Dissanayake',    partner: 'Beta Projects',       trade: 'Mason',          rate: 650 },
  { id: 'emp-008', name: 'Asanka Kumara',         partner: 'Mäga Engineering',    trade: 'Carpenter',      rate: 620 },
  { id: 'emp-009', name: 'Dinesh Wickramasinghe', partner: 'Alpha Constructions', trade: 'Electrician',    rate: 700 },
  { id: 'emp-010', name: 'Roshan Gunawardena',    partner: 'Beta Projects',       trade: 'General labour', rate: 500 },
  { id: 'emp-011', name: 'Tharanga Abeysekara',  partner: 'Mäga Engineering',    trade: 'Plumber',        rate: 680 },
  { id: 'emp-013', name: 'Sampath Ranasinghe',    partner: 'Beta Projects',       trade: 'Mason',          rate: 650 },
  { id: 'emp-014', name: 'Udara Liyanage',        partner: 'Mäga Engineering',    trade: 'General labour', rate: 500 },
  { id: 'emp-015', name: 'Ajith Mendis',          partner: 'Alpha Constructions', trade: 'Carpenter',      rate: 620 },
];

const SEED_ACTIVITIES = [
  { code: '00-00-20-10', description: 'Dayworks - Labour' },
  { code: '01-10-10-00', description: 'Excavation & Earthwork' },
  { code: '01-20-10-00', description: 'Concrete Work - Substructure' },
  { code: '02-10-10-00', description: 'Formwork - Superstructure' },
  { code: '02-20-10-00', description: 'Rebar & Steel Reinforcement' },
  { code: '03-10-10-00', description: 'Masonry Block & Brick Laying' },
  { code: '03-20-10-00', description: 'Plastering Work' },
  { code: '04-10-10-00', description: 'Plumbing & Drainage Work' },
  { code: '04-20-10-00', description: 'Electrical Conduit & Cabling' },
  { code: '05-10-10-00', description: 'Tile Laying & Finishes' },
  { code: '05-20-10-00', description: 'Painting & Surface Coating' },
  { code: '06-10-10-00', description: 'Welding & Structural Steel' },
];

/**
 * Generate date sequence between from and to (defaults to 1st to 15th of current month).
 */
function getDateRange(from?: string, to?: string): string[] {
  const dates: string[] = [];
  const start = from ? new Date(from) : new Date('2026-08-01');
  const end = to ? new Date(to) : new Date('2026-08-15');

  const curr = new Date(start);
  while (curr <= end && dates.length < 31) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  if (dates.length === 0) {
    dates.push('2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05');
  }
  return dates;
}

// ── Filter Options ───────────────────────────────────────────────────────────

export function getBusinessPartnerOptions(): string[] {
  return ['Mäga Engineering', 'Alpha Constructions', 'Beta Projects'];
}

export function getActivityCodeOptions(): { code: string; description: string }[] {
  return [...SEED_ACTIVITIES];
}

// ── 1. GET Summary Report ────────────────────────────────────────────────────

/**
 * Fetch employee summary totals.
 * TODO: Replace with real API call:
 *   const { data } = await axios.get<SummaryReportResponse>('/api/reports/summary', { params: filters });
 *   return data;
 */
export async function getSummaryReport(filters: ReportFilters): Promise<SummaryReportResponse> {
  await delay(350);

  const filteredEmps = SEED_EMPLOYEES.filter((emp) => {
    if (filters.employeeQuery && !emp.name.toLowerCase().includes(filters.employeeQuery.toLowerCase())) {
      return false;
    }
    if (filters.businessPartner && emp.partner !== filters.businessPartner) {
      return false;
    }
    return true;
  });

  const dates = getDateRange(filters.dateFrom, filters.dateTo);
  const daysCount = dates.length;

  const items: SummaryReportItem[] = filteredEmps.map((emp, idx) => {
    // Generate deterministic values based on employee index and date count
    const workedDays = Math.max(1, Math.min(daysCount, Math.round(daysCount * (0.8 + (idx % 3) * 0.08))));
    const normalHours = workedDays * 8;
    const otHours = idx % 2 === 0 ? Math.round(workedDays * 1.5 * 10) / 10 : 0;
    const totalHours = normalHours + otHours;

    return {
      id: `sum-${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      tradeGroup: emp.trade,
      businessPartner: emp.partner,
      totalDays: workedDays,
      totalNormalHours: normalHours,
      totalOtHours: otHours,
      totalHours,
    };
  });

  const totals = items.reduce(
    (acc, curr) => ({
      employeeCount: acc.employeeCount + 1,
      totalDays: acc.totalDays + curr.totalDays,
      totalNormalHours: acc.totalNormalHours + curr.totalNormalHours,
      totalOtHours: acc.totalOtHours + curr.totalOtHours,
      totalHours: acc.totalHours + curr.totalHours,
    }),
    { employeeCount: 0, totalDays: 0, totalNormalHours: 0, totalOtHours: 0, totalHours: 0 }
  );

  return { items, totals };
}

// ── 2. GET Day & OT Summary Report ───────────────────────────────────────────

/**
 * Fetch pivoted Day & OT matrix per employee.
 * TODO: Replace with real API call:
 *   const { data } = await axios.get<DayOtSummaryResponse>('/api/reports/day-ot-summary', { params: filters });
 *   return data;
 */
export async function getDayOtSummaryReport(filters: ReportFilters): Promise<DayOtSummaryResponse> {
  await delay(400);

  const filteredEmps = SEED_EMPLOYEES.filter((emp) => {
    if (filters.employeeQuery && !emp.name.toLowerCase().includes(filters.employeeQuery.toLowerCase())) {
      return false;
    }
    if (filters.businessPartner && emp.partner !== filters.businessPartner) {
      return false;
    }
    return true;
  });

  const dates = getDateRange(filters.dateFrom, filters.dateTo);

  const dateTotals: Record<string, { days: number; otHours: number }> = {};
  dates.forEach((d) => {
    dateTotals[d] = { days: 0, otHours: 0 };
  });

  let grandTotalDays = 0;
  let grandTotalOt = 0;

  const items: DayOtSummaryItem[] = filteredEmps.map((emp, empIdx) => {
    const dailyEntries: Record<string, DayOtDailyEntry> = {};
    let empDays = 0;
    let empOt = 0;

    dates.forEach((date, dateIdx) => {
      // Deterministic work pattern
      const dayNum = parseInt(date.slice(-2), 10) || dateIdx + 1;
      const isAbsent = (empIdx + dayNum) % 7 === 0; // occasional rest day
      const hasOt = (empIdx + dayNum) % 3 === 0 && !isAbsent;

      const days = isAbsent ? 0 : 1;
      const otHours = hasOt ? ((empIdx % 2 === 0 ? 2 : 1.5)) : 0;

      dailyEntries[date] = { days, otHours };

      empDays += days;
      empOt += otHours;

      dateTotals[date].days += days;
      dateTotals[date].otHours += otHours;
    });

    grandTotalDays += empDays;
    grandTotalOt += empOt;

    return {
      id: `dayot-${emp.id}`,
      employeeId: emp.id,
      employeeName: emp.name,
      tradeGroup: emp.trade,
      businessPartner: emp.partner,
      dailyEntries,
      totalDays: empDays,
      totalOtHours: empOt,
    };
  });

  return {
    dates,
    items,
    totals: {
      totalDays: grandTotalDays,
      totalOtHours: grandTotalOt,
      dateTotals,
    },
  };
}

// ── 3. GET BP Bill Report ────────────────────────────────────────────────────

/**
 * Fetch business partner bill report grouped by partner.
 * TODO: Replace with real API call:
 *   const { data } = await axios.get<BpBillResponse>('/api/reports/bp-bill', { params: filters });
 *   return data;
 */
export async function getBpBillReport(filters: ReportFilters): Promise<BpBillResponse> {
  await delay(400);

  const filteredEmps = SEED_EMPLOYEES.filter((emp) => {
    if (filters.employeeQuery && !emp.name.toLowerCase().includes(filters.employeeQuery.toLowerCase())) {
      return false;
    }
    if (filters.businessPartner && emp.partner !== filters.businessPartner) {
      return false;
    }
    return true;
  });

  const dates = getDateRange(filters.dateFrom, filters.dateTo);

  // Group by partner
  const partnerMap = new Map<string, typeof SEED_EMPLOYEES>();
  filteredEmps.forEach((emp) => {
    const list = partnerMap.get(emp.partner) || [];
    list.push(emp);
    partnerMap.set(emp.partner, list);
  });

  let grandTotalHours = 0;
  let grandTotalPayment = 0;
  let grandTotalOverhead = 0;
  let grandTotalCost = 0;

  const groups: BpBillGroup[] = [];

  partnerMap.forEach((emps, partner) => {
    let subtotalHours = 0;
    let subtotalPayment = 0;
    let subtotalOverhead = 0;
    let subtotalCost = 0;

    const items: BpBillEmployeeItem[] = emps.map((emp, empIdx) => {
      const dailyHours: Record<string, number> = {};
      let totalEmpHours = 0;

      dates.forEach((date, dateIdx) => {
        const dayNum = parseInt(date.slice(-2), 10) || dateIdx + 1;
        const isAbsent = (empIdx + dayNum) % 7 === 0;
        const ot = (empIdx + dayNum) % 3 === 0 ? 2 : 0;
        const hrs = isAbsent ? 0 : 8 + ot;

        dailyHours[date] = hrs;
        totalEmpHours += hrs;
      });

      const hourlyRate = emp.rate;
      const totalHourlyPayment = totalEmpHours * hourlyRate;
      const overhead = totalHourlyPayment * 0.10; // 10% Overhead
      const totalCost = totalHourlyPayment + overhead;

      subtotalHours += totalEmpHours;
      subtotalPayment += totalHourlyPayment;
      subtotalOverhead += overhead;
      subtotalCost += totalCost;

      return {
        id: `bp-${emp.id}`,
        employeeId: emp.id,
        employeeName: emp.name,
        tradeGroup: emp.trade,
        dailyHours,
        totalHours: totalEmpHours,
        hourlyRate,
        totalHourlyPayment,
        overhead,
        totalCost,
      };
    });

    grandTotalHours += subtotalHours;
    grandTotalPayment += subtotalPayment;
    grandTotalOverhead += subtotalOverhead;
    grandTotalCost += subtotalCost;

    groups.push({
      businessPartner: partner,
      items,
      subtotalHours,
      subtotalPayment,
      subtotalOverhead,
      subtotalCost,
    });
  });

  return {
    dates,
    groups,
    grandTotalHours,
    grandTotalPayment,
    grandTotalOverhead,
    grandTotalCost,
  };
}

// ── 4. GET ERP Upload Export Preview ─────────────────────────────────────────

const MOCK_ERP_ROWS: ErpUploadRow[] = [
  { id: 'erp-001', employeeId: 'HI101', employeeName: 'Kamal Perera',          date: '2026-08-01', activityCode: '01-10-10-00', activityDescription: 'Excavation & Earthwork',       hours: 8, overtimeHours: 0,   remarks: 'Main foundation trench' },
  { id: 'erp-002', employeeId: 'HI101', employeeName: 'Kamal Perera',          date: '2026-08-02', activityCode: '01-20-10-00', activityDescription: 'Concrete Work - Substructure', hours: 8, overtimeHours: 2,   remarks: 'Overtime approved for pour' },
  { id: 'erp-003', employeeId: 'HI201', employeeName: 'Nimal Silva',           date: '2026-08-01', activityCode: '02-10-10-00', activityDescription: 'Formwork - Superstructure',    hours: 8, overtimeHours: 0,   remarks: 'Column formwork assembly' },
  { id: 'erp-004', employeeId: 'HI201', employeeName: 'Nimal Silva',           date: '2026-08-02', activityCode: '02-10-10-00', activityDescription: 'Formwork - Superstructure',    hours: 8, overtimeHours: 1.5, remarks: 'Completed beam brackets' },
  { id: 'erp-005', employeeId: 'HI301', employeeName: 'Sunil Fernando',        date: '2026-08-01', activityCode: '04-20-10-00', activityDescription: 'Electrical Conduit & Cabling', hours: 8, overtimeHours: 0,   remarks: 'Conduit laying Level 2' },
  { id: 'erp-006', employeeId: 'HI301', employeeName: 'Sunil Fernando',        date: '2026-08-02', activityCode: '04-20-10-00', activityDescription: 'Electrical Conduit & Cabling', hours: 6, overtimeHours: 0,   remarks: 'Left early for site medical check' },
  { id: 'erp-007', employeeId: 'HI601', employeeName: 'Chaminda Rajapakse',    date: '2026-08-01', activityCode: '00-00-20-10', activityDescription: 'Dayworks - Labour',           hours: 8, overtimeHours: 0,   remarks: 'Site clearing' },
  { id: 'erp-008', employeeId: 'HI601', employeeName: 'Chaminda Rajapakse',    date: '2026-08-02', activityCode: '00-00-20-10', activityDescription: 'Dayworks - Labour',           hours: 8, overtimeHours: 0,   remarks: 'Material transfer' },
  { id: 'erp-009', employeeId: 'HI501', employeeName: 'Ruwan Jayawardena',     date: '2026-08-01', activityCode: '04-10-10-00', activityDescription: 'Plumbing & Drainage Work',    hours: 8, overtimeHours: 1,   remarks: 'Pressure testing pipe grid' },
  { id: 'erp-010', employeeId: 'HI401', employeeName: 'Pradeep Bandara',       date: '2026-08-01', activityCode: '06-10-10-00', activityDescription: 'Welding & Structural Steel',   hours: 8, overtimeHours: 0,   remarks: 'Steel truss joints' },
  { id: 'erp-011', employeeId: 'HI401', employeeName: 'Pradeep Bandara',       date: '2026-08-02', activityCode: '06-10-10-00', activityDescription: 'Welding & Structural Steel',   hours: 8, overtimeHours: 2,   remarks: 'Night shift structural reinforcement' },
  { id: 'erp-012', employeeId: 'HI102', employeeName: 'Lakmal Dissanayake',    date: '2026-08-01', activityCode: '03-10-10-00', activityDescription: 'Masonry Block & Brick Laying', hours: 8, overtimeHours: 0,   remarks: 'Partition walling Block B' },
  { id: 'erp-013', employeeId: 'HI202', employeeName: 'Asanka Kumara',         date: '2026-08-01', activityCode: '02-20-10-00', activityDescription: 'Rebar & Steel Reinforcement',  hours: 7, overtimeHours: 0,   remarks: 'Cut and bend station' },
  { id: 'erp-014', employeeId: 'HI202', employeeName: 'Asanka Kumara',         date: '2026-08-02', activityCode: '02-20-10-00', activityDescription: 'Rebar & Steel Reinforcement',  hours: 8, overtimeHours: 0,   remarks: 'Beam cage fabrication' },
  { id: 'erp-015', employeeId: 'HI302', employeeName: 'Dinesh Wickramasinghe',  date: '2026-08-01', activityCode: '04-20-10-00', activityDescription: 'Electrical Conduit & Cabling', hours: 8, overtimeHours: 0,   remarks: 'Main DB panel cable routing' },
  { id: 'erp-016', employeeId: 'HI602', employeeName: 'Roshan Gunawardena',     date: '2026-08-02', activityCode: '00-00-20-10', activityDescription: 'Dayworks - Labour',           hours: 8, overtimeHours: 0,   remarks: 'Scaffolding assistance' },
  { id: 'erp-017', employeeId: 'HI502', employeeName: 'Tharanga Abeysekara',   date: '2026-08-01', activityCode: '04-10-10-00', activityDescription: 'Plumbing & Drainage Work',    hours: 8, overtimeHours: 0,   remarks: 'Riser duct vertical stack' },
  { id: 'erp-018', employeeId: 'HI103', employeeName: 'Sampath Ranasinghe',    date: '2026-08-02', activityCode: '03-20-10-00', activityDescription: 'Plastering Work',             hours: 8, overtimeHours: 1,   remarks: 'Plastering external facade' },
  { id: 'erp-019', employeeId: 'HI603', employeeName: 'Udara Liyanage',        date: '2026-08-01', activityCode: '00-00-20-10', activityDescription: 'Dayworks - Labour',           hours: 8, overtimeHours: 0,   remarks: 'Safety railing installation support' },
  { id: 'erp-020', employeeId: 'HI203', employeeName: 'Ajith Mendis',          date: '2026-08-02', activityCode: '02-10-10-00', activityDescription: 'Formwork - Superstructure',    hours: 8, overtimeHours: 0,   remarks: 'Slab soffit shuttering' },
];

/**
 * Fetch flat ERP upload preview rows.
 * TODO: Replace with real API call:
 *   const { data } = await axios.get<ErpUploadResponse>('/api/reports/erp-upload', { params: filters });
 *   return data;
 */
export async function getErpUploadReport(filters: ReportFilters): Promise<ErpUploadResponse> {
  await delay(350);

  const rows = MOCK_ERP_ROWS.filter((r) => {
    if (filters.dateFrom && r.date < filters.dateFrom) return false;
    if (filters.dateTo && r.date > filters.dateTo) return false;
    if (filters.employeeQuery && !r.employeeName.toLowerCase().includes(filters.employeeQuery.toLowerCase())) {
      return false;
    }
    if (filters.activityCode && r.activityCode !== filters.activityCode) {
      return false;
    }
    return true;
  });

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const totalOtHours = rows.reduce((s, r) => s + r.overtimeHours, 0);

  return {
    rows,
    totalHours,
    totalOtHours,
    rowCount: rows.length,
  };
}

// ── 5. Excel Export Service ──────────────────────────────────────────────────

import type { Tenant } from '../../auth/services/authService';
import {
  exportSummaryToExcel,
  exportDayOtSummaryToExcel,
  exportBpBillToExcel,
  exportErpUploadToExcel,
} from './excelExport';

/**
 * Trigger Excel file download.
 * Calls backend GET /api/reports/:type/export with active filters and streams file.
 *
 * TODO: Replace with real API call:
 *   const response = await axios.get(`/api/reports/${type}/export`, {
 *     params: filters,
 *     responseType: 'blob',
 *   });
 *   const blob = new Blob([response.data], {
 *     type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 *   });
 *   const url = window.URL.createObjectURL(blob);
 *   const a = document.createElement('a');
 *   a.href = url;
 *   a.download = `${tenant.subdomain}-${type}-report-${Date.now()}.xlsx`;
 *   document.body.appendChild(a);
 *   a.click();
 *   window.URL.revokeObjectURL(url);
 *   document.body.removeChild(a);
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
  }
}

export {
  exportSummaryToExcel,
  exportDayOtSummaryToExcel,
  exportBpBillToExcel,
  exportErpUploadToExcel,
};
