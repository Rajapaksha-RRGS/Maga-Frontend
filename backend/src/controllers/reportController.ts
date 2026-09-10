import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getDefaultTenantId } from './employeeController';

// ─── Helper: parse query param safely ─────────────────────────────────────────
const qStr = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

// ─── Helper: build date filter for Prisma ─────────────────────────────────────
function buildDateFilter(dateFrom?: string, dateTo?: string) {
  const filter: Record<string, Date> = {};
  if (dateFrom) filter.gte = new Date(dateFrom);
  if (dateTo) {
    const d = new Date(dateTo);
    d.setHours(23, 59, 59, 999);
    filter.lte = d;
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

// ─── Helper: get all unique dates in a range ─────────────────────────────────
function dateRange(from?: string, to?: string): string[] {
  const start = from ? new Date(from) : new Date();
  const end = to ? new Date(to) : new Date();
  if (!from && !to) {
    // Default: current month
    start.setDate(1);
  }
  const dates: string[] = [];
  const curr = new Date(start);
  while (curr <= end && dates.length < 31) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setDate(curr.getDate() + 1);
  }
  return dates.length > 0 ? dates : [new Date().toISOString().split('T')[0]];
}

// ─── Helper: Day type OT rules (mirrors frontend overtimeCalculator.ts) ────────
function getDayTypeRule(dateStr: string): { standardCap: number; isAllOvertime: boolean; label: string } {
  const d = new Date(dateStr);
  const dow = d.getDay(); // 0 = Sunday, 6 = Saturday
  if (dow === 0) return { standardCap: 0, isAllOvertime: true, label: 'Sunday' };
  if (dow === 6) return { standardCap: 6.0, isAllOvertime: false, label: 'Saturday' };
  return { standardCap: 8.0, isAllOvertime: false, label: 'Normal Day' };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUMMARY REPORT
// GET /api/reports/summary?dateFrom=&dateTo=&employeeQuery=&businessPartner=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getSummaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    // Fetch time entries with employee + business partner data
    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(businessPartner
          ? { employee: { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } }
          : {}),
        ...(employeeQuery
          ? {
              employee: {
                OR: [
                  { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                  { fullName: { contains: employeeQuery, mode: 'insensitive' } },
                  { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        employee: { include: { businessPartner: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Group by employee
    const empMap = new Map<string, {
      employeeId: string;
      employeeCode: string;
      callingName: string;
      employeeName: string;
      tradeGroup: string;
      businessPartner: string;
      dates: Set<string>;
      totalHours: number;
      otHours: number;
    }>();

    for (const entry of entries) {
      const empId = entry.employeeId;
      const existing = empMap.get(empId);
      const dateKey = entry.date.toISOString().split('T')[0];
      const entryHours = Number(entry.hours);
      const otH = Number(entry.overtimeHours);

      if (!existing) {
        empMap.set(empId, {
          employeeId: empId,
          employeeCode: entry.employee.employeeCode || '',
          callingName: entry.employee.callingName || '',
          employeeName: entry.employee.fullName || entry.employee.callingName,
          tradeGroup: entry.employee.tradeGroup || '',
          businessPartner: entry.employee.businessPartner?.name || '',
          dates: new Set([dateKey]),
          totalHours: entryHours,
          otHours: otH,
        });
      } else {
        existing.dates.add(dateKey);
        existing.totalHours += entryHours;
        existing.otHours += otH;
      }
    }

    const items = Array.from(empMap.values()).map((e, idx) => {
      const empIdentifier = e.employeeCode || e.callingName || e.employeeName || e.employeeId;
      const totalHours = Math.round(e.totalHours * 100) / 100;
      const totalOtHours = Math.round(e.otHours * 100) / 100;
      const totalNormalHours = Math.max(0, Math.round((totalHours - totalOtHours) * 100) / 100);

      return {
        id: `sum-${idx}`,
        employeeId: e.employeeId,
        employeeCode: e.employeeCode,
        callingName: e.callingName,
        employeeName: e.employeeName,
        employeeIdentifier: empIdentifier,
        tradeGroup: e.tradeGroup,
        businessPartner: e.businessPartner,
        totalDays: e.dates.size,
        totalNormalHours,
        totalOtHours,
        totalEffectiveHours: totalHours,
        totalHours,
      };
    });

    const totals = items.reduce(
      (acc, curr) => ({
        employeeCount: acc.employeeCount + 1,
        totalDays: acc.totalDays + curr.totalDays,
        totalNormalHours: Math.round((acc.totalNormalHours + curr.totalNormalHours) * 100) / 100,
        totalOtHours: Math.round((acc.totalOtHours + curr.totalOtHours) * 100) / 100,
        totalHours: Math.round((acc.totalHours + curr.totalHours) * 100) / 100,
      }),
      { employeeCount: 0, totalDays: 0, totalNormalHours: 0, totalOtHours: 0, totalHours: 0 }
    );

    res.json({ items, totals });
  } catch (error) {
    console.error('Error fetching summary report:', error);
    res.status(500).json({ error: 'Failed to generate summary report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. DAY & OT SUMMARY REPORT
// GET /api/reports/day-ot-summary?dateFrom=&dateTo=&employeeQuery=&businessPartner=
// ─────────────────────────────────────────────────────────────────────────────
export const getDayOtSummaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(businessPartner
          ? { employee: { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } }
          : {}),
        ...(employeeQuery
          ? {
              employee: {
                OR: [
                  { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                  { fullName: { contains: employeeQuery, mode: 'insensitive' } },
                  { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: { employee: { include: { businessPartner: true } } },
      orderBy: { date: 'asc' },
    });

    // Collect all unique dates in the range
    const allDatesSet = new Set<string>();
    entries.forEach((e) => allDatesSet.add(e.date.toISOString().split('T')[0]));
    const dates = dateRange(dateFrom, dateTo).filter((d) => allDatesSet.has(d) || allDatesSet.size === 0);
    // If no entries, fall back to full dateRange
    const finalDates = entries.length === 0 ? dateRange(dateFrom, dateTo) : Array.from(allDatesSet).sort();

    // Group by employee
    type EmpEntry = {
      employeeId: string;
      employeeName: string;
      tradeGroup: string;
      businessPartner: string;
      dailyEntries: Record<string, { days: number; otHours: number }>;
    };

    const empMap = new Map<string, EmpEntry>();
    const dateTotals: Record<string, { days: number; otHours: number }> = {};

    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      const otH = Number(entry.overtimeHours);
      const empId = entry.employeeId;

      if (!dateTotals[dateKey]) dateTotals[dateKey] = { days: 0, otHours: 0 };

      if (!empMap.has(empId)) {
        empMap.set(empId, {
          employeeId: empId,
          employeeName: entry.employee.fullName || entry.employee.callingName,
          tradeGroup: entry.employee.tradeGroup || '',
          businessPartner: entry.employee.businessPartner?.name || '',
          dailyEntries: {},
        });
      }

      const emp = empMap.get(empId)!;
      if (!emp.dailyEntries[dateKey]) {
        emp.dailyEntries[dateKey] = { days: 1, otHours: 0 };
        dateTotals[dateKey].days += 1;
      }
      emp.dailyEntries[dateKey].otHours += otH;
      dateTotals[dateKey].otHours += otH;
    }

    let grandTotalDays = 0;
    let grandTotalOt = 0;

    const items = Array.from(empMap.values()).map((e, idx) => {
      const totalDays = Object.values(e.dailyEntries).filter((de) => de.days > 0).length;
      const totalOt = Object.values(e.dailyEntries).reduce((s, de) => s + de.otHours, 0);
      grandTotalDays += totalDays;
      grandTotalOt += totalOt;
      return {
        id: `dayot-${idx}`,
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        tradeGroup: e.tradeGroup,
        businessPartner: e.businessPartner,
        dailyEntries: e.dailyEntries,
        totalDays,
        totalOtHours: Math.round(totalOt * 100) / 100,
      };
    });

    res.json({
      dates: finalDates,
      items,
      totals: {
        totalDays: grandTotalDays,
        totalOtHours: Math.round(grandTotalOt * 100) / 100,
        dateTotals,
      },
    });
  } catch (error) {
    console.error('Error fetching day-ot summary report:', error);
    res.status(500).json({ error: 'Failed to generate day & OT summary report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. BP BILL REPORT
// GET /api/reports/bp-bill?dateFrom=&dateTo=&employeeQuery=&businessPartner=
// ─────────────────────────────────────────────────────────────────────────────
export const getBpBillReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(businessPartner
          ? { employee: { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } }
          : {}),
        ...(employeeQuery
          ? {
              employee: {
                OR: [
                  { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                  { fullName: { contains: employeeQuery, mode: 'insensitive' } },
                  { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: { employee: { include: { businessPartner: true } } },
      orderBy: { date: 'asc' },
    });

    // Collect all dates
    const allDates = [...new Set(entries.map((e) => e.date.toISOString().split('T')[0]))].sort();

    // Group by businessPartner -> employee
    type EmpData = {
      employeeId: string;
      employeeName: string;
      tradeGroup: string;
      dailyHours: Record<string, number>;
      dailyRate: number;
    };
    const bpMap = new Map<string, Map<string, EmpData>>();

    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      const bpName = entry.employee.businessPartner?.name || 'Unknown';
      const empId = entry.employeeId;
      const hours = Number(entry.hours) + Number(entry.overtimeHours);

      if (!bpMap.has(bpName)) bpMap.set(bpName, new Map());
      const empMap = bpMap.get(bpName)!;

      if (!empMap.has(empId)) {
        empMap.set(empId, {
          employeeId: empId,
          employeeName: entry.employee.fullName || entry.employee.callingName,
          tradeGroup: entry.employee.tradeGroup || '',
          dailyHours: {},
          dailyRate: Number(entry.employee.dailyRate) || 1400,
        });
      }
      const empData = empMap.get(empId)!;
      empData.dailyHours[dateKey] = (empData.dailyHours[dateKey] || 0) + hours;
    }

    let grandTotalHours = 0;
    let grandTotalPayment = 0;
    let grandTotalOverhead = 0;
    let grandTotalCost = 0;

    const groups = Array.from(bpMap.entries()).map(([bpName, empMap]) => {
      let subtotalHours = 0;
      let subtotalPayment = 0;
      let subtotalOverhead = 0;
      let subtotalCost = 0;

      const items = Array.from(empMap.values()).map((emp, idx) => {
        const totalHours = Object.values(emp.dailyHours).reduce((s, h) => s + h, 0);
        // Use hourly rate derived from daily rate / 8 hrs
        const hourlyRate = Math.round((emp.dailyRate / 8) * 100) / 100;
        const totalHourlyPayment = Math.round(totalHours * hourlyRate * 100) / 100;
        const overhead = Math.round(totalHourlyPayment * 0.10 * 100) / 100;
        const totalCost = Math.round((totalHourlyPayment + overhead) * 100) / 100;

        subtotalHours += totalHours;
        subtotalPayment += totalHourlyPayment;
        subtotalOverhead += overhead;
        subtotalCost += totalCost;

        return {
          id: `bp-${idx}`,
          employeeId: emp.employeeId,
          employeeName: emp.employeeName,
          tradeGroup: emp.tradeGroup,
          dailyHours: emp.dailyHours,
          totalHours: Math.round(totalHours * 100) / 100,
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

      return {
        businessPartner: bpName,
        items,
        subtotalHours: Math.round(subtotalHours * 100) / 100,
        subtotalPayment: Math.round(subtotalPayment * 100) / 100,
        subtotalOverhead: Math.round(subtotalOverhead * 100) / 100,
        subtotalCost: Math.round(subtotalCost * 100) / 100,
      };
    });

    res.json({
      dates: allDates,
      groups,
      grandTotalHours: Math.round(grandTotalHours * 100) / 100,
      grandTotalPayment: Math.round(grandTotalPayment * 100) / 100,
      grandTotalOverhead: Math.round(grandTotalOverhead * 100) / 100,
      grandTotalCost: Math.round(grandTotalCost * 100) / 100,
    });
  } catch (error) {
    console.error('Error fetching BP bill report:', error);
    res.status(500).json({ error: 'Failed to generate BP bill report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. ERP UPLOAD EXPORT
// GET /api/reports/erp-upload?dateFrom=&dateTo=&employeeQuery=&activityCode=
// ─────────────────────────────────────────────────────────────────────────────
export const getErpUploadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const activityCode = qStr(req.query.activityCode);
    const businessPartner = qStr(req.query.businessPartner);

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(activityCode ? { activity: { code: activityCode } } : {}),
        ...(businessPartner
          ? { employee: { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } }
          : {}),
        ...(employeeQuery
          ? {
              employee: {
                OR: [
                  { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                  { fullName: { contains: employeeQuery, mode: 'insensitive' } },
                  { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
      },
      include: {
        employee: true,
        activity: true,
      },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    });

    // Group by employee + date to apply OT rules
    type GroupKey = string;
    const groups = new Map<GroupKey, typeof entries>();

    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      const key: GroupKey = `${entry.employeeId}___${dateKey}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }

    const finalRows: object[] = [];
    let totalHours = 0;
    let totalOtHours = 0;
    let rowIdx = 0;

    for (const [, groupEntries] of groups) {
      const first = groupEntries[0];
      const dateKey = first.date.toISOString().split('T')[0];
      const { standardCap, isAllOvertime, label } = getDayTypeRule(dateKey);

      let totalDayHours = 0;

      // Regular activity rows
      for (const entry of groupEntries) {
        const hours = Number(entry.hours);
        totalDayHours += hours;
        finalRows.push({
          id: `erp-${rowIdx++}`,
          employeeId: entry.employee.employeeCode || entry.employeeId,
          employeeName: entry.employee.fullName || entry.employee.callingName,
          date: dateKey,
          activityCode: entry.activity.code,
          activityDescription: entry.activity.description || entry.activity.code,
          hours,
          overtimeHours: 0,
          remarks: entry.remarks || '',
        });
        totalHours += hours;
      }

      // Calculate OT line based on day type calendar rules
      let otHours = 0;
      if (isAllOvertime) {
        otHours = totalDayHours; // Sunday/Holiday: 100% OT
      } else if (totalDayHours > standardCap) {
        otHours = parseFloat((totalDayHours - standardCap).toFixed(2));
      }

      // Also check explicit overtimeHours stored in entries
      const explicitOt = groupEntries.reduce((s, e) => s + Number(e.overtimeHours), 0);
      if (explicitOt > otHours) otHours = explicitOt;

      if (otHours > 0) {
        finalRows.push({
          id: `erp-ot-${first.employeeId}-${dateKey}`,
          employeeId: first.employee.employeeCode || first.employeeId,
          employeeName: first.employee.fullName || first.employee.callingName,
          date: dateKey,
          activityCode: 'OT',
          activityDescription: isAllOvertime
            ? `${label} Overtime`
            : `Overtime (> ${standardCap} Hours)`,
          hours: 0,
          overtimeHours: otHours,
          remarks: '',
        });
        totalOtHours += otHours;
      }
    }

    res.json({
      rows: finalRows,
      totalHours: Math.round(totalHours * 100) / 100,
      totalOtHours: Math.round(totalOtHours * 100) / 100,
      rowCount: finalRows.length,
    });
  } catch (error) {
    console.error('Error fetching ERP upload report:', error);
    res.status(500).json({ error: 'Failed to generate ERP upload report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. FILTER OPTIONS
// GET /api/reports/filter-options — returns available BPs and activity codes
// ─────────────────────────────────────────────────────────────────────────────
export const getReportFilterOptions = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = qStr(req.query.tenantId) || (await getDefaultTenantId());

    const [partners, activityCodes] = await Promise.all([
      prisma.businessPartner.findMany({
        where: { tenantId, status: 'active' },
        select: { id: true, name: true, code: true },
        orderBy: { name: 'asc' },
      }),
      prisma.activityCode.findMany({
        where: { tenantId },
        select: { id: true, code: true, description: true },
        orderBy: { code: 'asc' },
      }),
    ]);

    res.json({
      businessPartners: partners.map((p) => p.name),
      activityCodes: activityCodes.map((a) => ({ code: a.code, description: a.description || a.code })),
    });
  } catch (error) {
    console.error('Error fetching report filter options:', error);
    res.status(500).json({ error: 'Failed to fetch filter options' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. RUNNING CHART REPORT
// GET /api/reports/running-chart?dateFrom=&dateTo=&employeeQuery=&businessPartner=&activityCode=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getRunningChartReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const activityCode = qStr(req.query.activityCode);

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(businessPartner
          ? { employee: { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } }
          : {}),
        ...(employeeQuery
          ? {
              employee: {
                OR: [
                  { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                  { fullName: { contains: employeeQuery, mode: 'insensitive' } },
                  { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
        ...(activityCode
          ? { activity: { code: { contains: activityCode, mode: 'insensitive' } } }
          : {}),
      },
      include: {
        employee: { include: { businessPartner: true } },
        supervisor: { select: { id: true, fullName: true, username: true } },
        activity: { select: { id: true, code: true, description: true } },
      },
      orderBy: [{ date: 'desc' }, { employee: { employeeCode: 'asc' } }],
    });

    // Group by EmployeeId + Date
    const grouped = new Map<string, typeof entries>();
    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      const key = `${entry.employeeId}___${dateKey}`;
      const list = grouped.get(key) || [];
      list.push(entry);
      grouped.set(key, list);
    }

    const items = [];
    let grandWorkHours = 0;
    let grandOtHours = 0;
    let grandTotalHours = 0;

    for (const [key, groupEntries] of grouped.entries()) {
      const first = groupEntries[0];
      const dateKey = first.date.toISOString().split('T')[0];

      // Resolve In / Out time
      const inTime = groupEntries.find((e) => e.inTime)?.inTime || '—';
      const outTime = groupEntries.find((e) => e.outTime)?.outTime || '—';

      // Activities breakdown
      const activitiesMap = new Map<string, { code: string; description: string; hours: number }>();
      for (const e of groupEntries) {
        const code = e.activity?.code || '00-00-11-11-M';
        const desc = e.activity?.description || code;
        const h = Number(e.hours) || 0;
        if (h > 0) {
          const prev = activitiesMap.get(code) || { code, description: desc, hours: 0 };
          prev.hours += h;
          activitiesMap.set(code, prev);
        }
      }

      const activities = Array.from(activitiesMap.values()).map((a) => ({
        code: a.code,
        description: a.description,
        hours: Math.round(a.hours * 100) / 100,
      }));

      const activitiesDisplay = activities.length > 0
        ? activities.map((a) => `${a.code} (${a.hours.toFixed(1)}h)`).join(', ')
        : '—';

      let breakHours = Number(groupEntries.find((e) => e.breakHours !== null)?.breakHours) || 0;
      if (breakHours === 0 && inTime !== '—' && outTime !== '—') {
        const [inH, inM] = inTime.split(':').map(Number);
        const [outH, outM] = outTime.split(':').map(Number);
        const diffMins = (outH * 60 + outM) - (inH * 60 + inM);
        if (diffMins >= 300) {
          breakHours = 1.0;
        }
      }

      let totalDayHours = activities.reduce((sum, a) => sum + a.hours, 0) ||
        groupEntries.reduce((sum, e) => sum + (Number(e.hours) || 0), 0);

      if (totalDayHours === 0 && inTime !== '—' && outTime !== '—') {
        const [inH, inM] = inTime.split(':').map(Number);
        const [outH, outM] = outTime.split(':').map(Number);
        const diffMins = (outH * 60 + outM) - (inH * 60 + inM);
        if (diffMins > 0) {
          const grossHours = Math.round((diffMins / 60) * 100) / 100;
          totalDayHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);
        }
      }

      const { standardCap, isAllOvertime } = getDayTypeRule(dateKey);
      let workHours = 0;
      let otHours = 0;

      if (isAllOvertime) {
        workHours = 0;
        otHours = totalDayHours;
      } else {
        const explicitOt = groupEntries.reduce((s, e) => s + (Number(e.overtimeHours) || 0), 0);
        if (explicitOt > 0) {
          otHours = Math.min(totalDayHours, explicitOt);
          workHours = Math.max(0, totalDayHours - otHours);
        } else {
          workHours = Math.min(totalDayHours, standardCap);
          otHours = totalDayHours > standardCap ? totalDayHours - standardCap : 0;
        }
      }

      workHours = Math.round(workHours * 100) / 100;
      otHours = Math.round(otHours * 100) / 100;
      const totalHours = Math.round(totalDayHours * 100) / 100;

      grandWorkHours += workHours;
      grandOtHours += otHours;
      grandTotalHours += totalHours;

      const supervisorName = first.supervisor?.fullName ||
        (first.supervisor?.username ? `@${first.supervisor.username}` : 'Site Supervisor');

      items.push({
        id: `rc-${key}`,
        date: dateKey,
        supervisorName,
        employeeCode: first.employee.employeeCode || first.employeeId,
        callingName: first.employee.callingName || first.employee.fullName || '—',
        businessPartner: first.employee.businessPartner?.name || 'Direct',
        inTime,
        outTime,
        breakHours,
        workHours,
        otHours,
        totalHours,
        activities,
        activitiesDisplay,
      });
    }

    res.json({
      items,
      totals: {
        totalRecords: items.length,
        totalWorkHours: Math.round(grandWorkHours * 100) / 100,
        totalOtHours: Math.round(grandOtHours * 100) / 100,
        totalHours: Math.round(grandTotalHours * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error fetching running chart report:', error);
    res.status(500).json({ error: 'Failed to generate running chart report' });
  }
};
