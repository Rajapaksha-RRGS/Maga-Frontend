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

// ─── Helper: Compute shift work hours and OT with Database Fast-Path ─────────
function computeAttendanceHoursAndOt(
  inTime?: string | null,
  outTime?: string | null,
  fallbackHours = 0,
  standardCap = 8.0,
  isAllOvertime = false,
  precomputedShiftHours?: number | null,
  precomputedOtHours?: number | null
): { workHours: number; otHours: number } {
  // FAST-PATH: If already pre-computed & stored in database, use directly (0ms latency, bypasses string parsing)
  if (
    precomputedShiftHours !== null &&
    precomputedShiftHours !== undefined &&
    precomputedOtHours !== null &&
    precomputedOtHours !== undefined
  ) {
    return {
      workHours: Number(precomputedShiftHours),
      otHours: Number(precomputedOtHours),
    };
  }

  // FALLBACK: Parse in/out times only for legacy entries
  if (inTime && outTime) {
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    if (!isNaN(inH) && !isNaN(outH)) {
      let diffMins = (outH * 60 + outM) - (inH * 60 + inM);
      if (diffMins < 0) diffMins += 24 * 60; // Crosses midnight
      if (diffMins >= 300) diffMins -= 60; // 1-hour lunch break deduction
      const shiftHours = diffMins > 0 ? Math.round((diffMins / 60) * 10) / 10 : 0;
      if (shiftHours > 0) {
        let ot = 0;
        if (isAllOvertime) {
          ot = shiftHours;
        } else if (shiftHours > standardCap) {
          ot = Math.round((shiftHours - standardCap) * 10) / 10;
        }
        return { workHours: shiftHours, otHours: ot };
      }
    }
  }

  // Fallback if no in/out times were recorded
  let ot = 0;
  if (isAllOvertime) {
    ot = fallbackHours;
  } else if (fallbackHours > standardCap) {
    ot = Math.round((fallbackHours - standardCap) * 10) / 10;
  }
  return { workHours: fallbackHours, otHours: ot };
}

function buildEmployeeFilter(workerType?: string, businessPartner?: string, employeeQuery?: string) {
  const filter: any = {};
  if (workerType === 'operator') {
    filter.isOperator = true;
  } else if (workerType === 'labor') {
    filter.isOperator = false;
  }
  if (businessPartner) {
    filter.businessPartner = { name: { contains: businessPartner, mode: 'insensitive' } };
  }
  if (employeeQuery) {
    filter.OR = [
      { callingName: { contains: employeeQuery, mode: 'insensitive' } },
      { fullName: { contains: employeeQuery, mode: 'insensitive' } },
      { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
    ];
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUMMARY REPORT
// GET /api/reports/summary?dateFrom=&dateTo=&employeeQuery=&businessPartner=&workerType=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getSummaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const workerType = qStr(req.query.workerType);

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery);

    // Fetch time entries with employee + business partner data
    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        status: 'approved',
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(empFilter ? { employee: empFilter } : {}),
      },
      include: {
        employee: { include: { businessPartner: true } },
      },
      orderBy: { date: 'asc' },
    });

    // Group entries by employee AND date to compute daily shift and OT from In/Out times
    const empDailyMap = new Map<string, Map<string, typeof entries>>();
    const empInfoMap = new Map<string, any>();

    for (const entry of entries) {
      const empId = entry.employeeId;
      const dateKey = entry.date.toISOString().split('T')[0];

      if (!empInfoMap.has(empId)) {
        empInfoMap.set(empId, {
          employeeId: empId,
          employeeCode: entry.employee.employeeCode || '',
          callingName: entry.employee.callingName || '',
          employeeName: entry.employee.fullName || entry.employee.callingName,
          tradeGroup: entry.employee.tradeGroup || '',
          businessPartner: entry.employee.businessPartner?.name || '',
        });
      }

      if (!empDailyMap.has(empId)) {
        empDailyMap.set(empId, new Map());
      }
      const dayMap = empDailyMap.get(empId)!;
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(entry);
    }

    if (workerType === 'operator' || !workerType) {
      const opEntries = await prisma.operatorTimeEntry.findMany({
        where: {
          tenantId,
          ...(dateFilter ? { assignment: { date: dateFilter } } : {}),
          ...(businessPartner ? { assignment: { operator: { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } } } : {}),
          ...(employeeQuery ? {
            assignment: {
              operator: {
                OR: [
                  { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                  { fullName: { contains: employeeQuery, mode: 'insensitive' } },
                  { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
                ],
              },
            },
          } : {}),
        },
        include: {
          assignment: {
            include: {
              operator: { include: { businessPartner: true } },
            },
          },
        },
      });

      for (const op of opEntries) {
        const emp = op.assignment.operator;
        const empId = emp.id;
        const dateKey = op.assignment.date.toISOString().split('T')[0];

        if (!empInfoMap.has(empId)) {
          empInfoMap.set(empId, {
            employeeId: empId,
            employeeCode: emp.employeeCode || '',
            callingName: emp.callingName || '',
            employeeName: emp.fullName || emp.callingName,
            tradeGroup: emp.tradeGroup || 'Operator',
            businessPartner: emp.businessPartner?.name || 'Direct / Maga',
          });
        }

        if (!empDailyMap.has(empId)) {
          empDailyMap.set(empId, new Map());
        }
        const dayMap = empDailyMap.get(empId)!;
        if (!dayMap.has(dateKey)) {
          dayMap.set(dateKey, [{
            inTime: op.inTime,
            outTime: op.outTime,
            shiftHours: op.shiftHours,
            otHours: op.otHours,
            hours: op.shiftHours,
          } as any]);
        }
      }
    }

    const items = Array.from(empDailyMap.entries()).map(([empId, dayMap], idx) => {
      const empInfo = empInfoMap.get(empId);
      let totalEffectiveHours = 0;
      let totalOtHours = 0;
      let totalDays = 0;

      for (const [dateKey, dayEntries] of dayMap.entries()) {
        totalDays += 1;
        const { standardCap, isAllOvertime } = getDayTypeRule(dateKey);

        const inTime = dayEntries.find((e) => e.inTime)?.inTime;
        const outTime = dayEntries.find((e) => e.outTime)?.outTime;
        const activitySum = dayEntries.reduce((s, e) => s + (Number(e.hours) || 0), 0);
        const precomputedShift = dayEntries.find((e) => e.shiftHours !== null)?.shiftHours;
        const precomputedOt = dayEntries.find((e) => e.otHours !== null)?.otHours;

        const { workHours, otHours } = computeAttendanceHoursAndOt(
          inTime,
          outTime,
          activitySum,
          standardCap,
          isAllOvertime,
          precomputedShift !== undefined && precomputedShift !== null ? Number(precomputedShift) : null,
          precomputedOt !== undefined && precomputedOt !== null ? Number(precomputedOt) : null
        );

        totalEffectiveHours += workHours;
        totalOtHours += otHours;
      }

      totalEffectiveHours = Math.round(totalEffectiveHours * 100) / 100;
      totalOtHours = Math.round(totalOtHours * 100) / 100;
      const totalNormalHours = Math.max(0, Math.round((totalEffectiveHours - totalOtHours) * 100) / 100);
      const empIdentifier = empInfo.employeeCode || empInfo.callingName || empInfo.employeeName || empId;

      return {
        id: `sum-${idx}`,
        employeeId: empId,
        employeeCode: empInfo.employeeCode,
        callingName: empInfo.callingName,
        employeeName: empInfo.employeeName,
        employeeIdentifier: empIdentifier,
        tradeGroup: empInfo.tradeGroup,
        businessPartner: empInfo.businessPartner,
        totalDays,
        totalNormalHours,
        totalOtHours,
        totalEffectiveHours,
        totalHours: totalEffectiveHours,
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
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const workerType = qStr(req.query.workerType);

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        status: 'approved',
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(empFilter ? { employee: empFilter } : {}),
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

    // Group by employee AND date to compute daily shift and OT from In/Out times
    const empDailyMap = new Map<string, Map<string, typeof entries>>();
    const empInfoMap = new Map<string, any>();

    for (const entry of entries) {
      const empId = entry.employeeId;
      const dateKey = entry.date.toISOString().split('T')[0];

      if (!empInfoMap.has(empId)) {
        empInfoMap.set(empId, {
          employeeId: empId,
          employeeName: entry.employee.fullName || entry.employee.callingName,
          tradeGroup: entry.employee.tradeGroup || '',
          businessPartner: entry.employee.businessPartner?.name || '',
        });
      }

      if (!empDailyMap.has(empId)) {
        empDailyMap.set(empId, new Map());
      }
      const dayMap = empDailyMap.get(empId)!;
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push(entry);
    }

    const dateTotals: Record<string, { days: number; otHours: number; workHours: number }> = {};
    for (const d of finalDates) {
      dateTotals[d] = { days: 0, otHours: 0, workHours: 0 };
    }

    let grandTotalDays = 0;
    let grandTotalOt = 0;
    let grandTotalWork = 0;

    const items = Array.from(empDailyMap.entries()).map(([empId, dayMap], idx) => {
      const empInfo = empInfoMap.get(empId);
      const dailyEntries: Record<string, { days: number; otHours: number; workHours: number }> = {};
      let totalEmpDays = 0;
      let totalEmpWork = 0;
      let totalEmpOt = 0;

      for (const [dateKey, dayEntries] of dayMap.entries()) {
        const { standardCap, isAllOvertime } = getDayTypeRule(dateKey);
        const inTime = dayEntries.find((e) => e.inTime)?.inTime;
        const outTime = dayEntries.find((e) => e.outTime)?.outTime;
        const activitySum = dayEntries.reduce((s, e) => s + (Number(e.hours) || 0), 0);
        const precomputedShift = dayEntries.find((e) => e.shiftHours !== null)?.shiftHours;
        const precomputedOt = dayEntries.find((e) => e.otHours !== null)?.otHours;

        const { workHours, otHours } = computeAttendanceHoursAndOt(
          inTime,
          outTime,
          activitySum,
          standardCap,
          isAllOvertime,
          precomputedShift !== undefined && precomputedShift !== null ? Number(precomputedShift) : null,
          precomputedOt !== undefined && precomputedOt !== null ? Number(precomputedOt) : null
        );

        dailyEntries[dateKey] = {
          days: 1,
          workHours,
          otHours,
        };

        totalEmpDays += 1;
        totalEmpWork += workHours;
        totalEmpOt += otHours;

        if (!dateTotals[dateKey]) {
          dateTotals[dateKey] = { days: 0, otHours: 0, workHours: 0 };
        }
        dateTotals[dateKey].days += 1;
        dateTotals[dateKey].workHours += workHours;
        dateTotals[dateKey].otHours += otHours;
      }

      grandTotalDays += totalEmpDays;
      grandTotalWork += totalEmpWork;
      grandTotalOt += totalEmpOt;

      return {
        id: `dayot-${idx}`,
        employeeId: empId,
        employeeName: empInfo.employeeName,
        tradeGroup: empInfo.tradeGroup,
        businessPartner: empInfo.businessPartner,
        dailyEntries,
        totalDays: totalEmpDays,
        totalWorkHours: Math.round(totalEmpWork * 100) / 100,
        totalOtHours: Math.round(totalEmpOt * 100) / 100,
      };
    });

    res.json({
      dates: finalDates,
      items,
      totals: {
        totalDays: grandTotalDays,
        totalOtHours: Math.round(grandTotalOt * 100) / 100,
        totalWorkHours: Math.round(grandTotalWork * 100) / 100,
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
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const workerType = qStr(req.query.workerType);

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        status: 'approved',
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(empFilter ? { employee: empFilter } : {}),
      },
      include: { employee: { include: { businessPartner: true } } },
      orderBy: { date: 'asc' },
    });

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

    // Also include operators if applicable
    if (workerType === 'operator' || !workerType) {
      const opEntries = await prisma.operatorTimeEntry.findMany({
        where: {
          tenantId,
          ...(dateFilter ? { assignment: { date: dateFilter } } : {}),
          ...(businessPartner ? { assignment: { operator: { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } } } : {}),
          ...(employeeQuery ? {
            assignment: {
              operator: {
                OR: [
                  { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                  { fullName: { contains: employeeQuery, mode: 'insensitive' } },
                  { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
                ],
              },
            },
          } : {}),
        },
        include: {
          assignment: {
            include: {
              operator: { include: { businessPartner: true } },
            },
          },
        },
      });

      for (const op of opEntries) {
        const dateKey = op.assignment.date.toISOString().split('T')[0];
        const bpName = op.assignment.operator.businessPartner?.name || 'Direct / Maga';
        const empId = op.assignment.operator.id;
        const hours = Number(op.shiftHours || 0) + Number(op.otHours || 0);

        if (!bpMap.has(bpName)) bpMap.set(bpName, new Map());
        const empMap = bpMap.get(bpName)!;

        if (!empMap.has(empId)) {
          empMap.set(empId, {
            employeeId: empId,
            employeeName: op.assignment.operator.fullName || op.assignment.operator.callingName,
            tradeGroup: op.assignment.operator.tradeGroup || 'Operator',
            dailyHours: {},
            dailyRate: Number(op.assignment.operator.dailyRate) || 1600,
          });
        }
        const empData = empMap.get(empId)!;
        if (!empData.dailyHours[dateKey]) {
          empData.dailyHours[dateKey] = hours;
        }
      }
    }

    // Collect all dates from all BPs and employees
    const allDatesSet = new Set<string>();
    entries.forEach((e) => allDatesSet.add(e.date.toISOString().split('T')[0]));
    for (const [, empMap] of bpMap) {
      for (const [, empData] of empMap) {
        Object.keys(empData.dailyHours).forEach((d) => allDatesSet.add(d));
      }
    }
    const allDates = Array.from(allDatesSet).sort();

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

// Helper: parse string times like "07:00", "19:30", or decimal "7.00", "19.50" into decimal hours
function parseTimeToHours(t: string | null | undefined): number | null {
  if (!t || typeof t !== 'string') return null;
  const trimmed = t.trim();
  if (!trimmed || trimmed === '—' || trimmed === '--:--') return null;

  if (trimmed.includes(':')) {
    const [h, m] = trimmed.split(':').map(Number);
    if (!isNaN(h) && !isNaN(m)) {
      return Math.round((h + m / 60) * 100) / 100;
    }
  }

  const num = parseFloat(trimmed);
  if (!isNaN(num)) {
    return Math.round(num * 100) / 100;
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ERP UPLOAD EXPORT
// GET /api/reports/erp-upload?dateFrom=&dateTo=&employeeQuery=&activityCode=
// ─────────────────────────────────────────────────────────────────────────────
export const getErpUploadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const activityCode = qStr(req.query.activityCode);
    const businessPartner = qStr(req.query.businessPartner);

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        status: 'approved',
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

      // Determine physical shift effective hours (Gross hours - Lunch break)
      const inTime = groupEntries.find((e) => e.inTime)?.inTime;
      const outTime = groupEntries.find((e) => e.outTime)?.outTime;
      let shiftEffectiveHours = 0;

      const inH = parseTimeToHours(inTime);
      const outH = parseTimeToHours(outTime);

      if (inH !== null && outH !== null && outH > inH) {
        const grossH = outH - inH;
        let breakH = Number(groupEntries.find((e) => e.breakHours !== null)?.breakHours) || 0;
        if (breakH === 0 && grossH >= 5.0) {
          breakH = 1.0;
        }
        shiftEffectiveHours = Math.max(0, Math.round((grossH - breakH) * 100) / 100);
      }

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

      // ── ZIDLE Balancing Row ────────────────────────────────────────────────
      // When sum of activity hours is LESS than actual physical effective shift hours,
      // the unallocated shortage is added as an idle time row (ZIDLE) to account for full shift attendance.
      if (shiftEffectiveHours > 0 && totalDayHours < shiftEffectiveHours) {
        const idleHours = Math.round((shiftEffectiveHours - totalDayHours) * 100) / 100;
        finalRows.push({
          id: `erp-zidle-${first.employeeId}-${dateKey}`,
          employeeId: first.employee.employeeCode || first.employeeId,
          employeeName: first.employee.fullName || first.employee.callingName,
          date: dateKey,
          activityCode: 'ZIDLE',
          activityDescription: 'Idle / Unallocated Hours',
          hours: idleHours,
          overtimeHours: 0,
          remarks: 'Unallocated idle shift hours',
        });
        totalHours += idleHours;
      }

      // Calculate OT line based on day type calendar rules on the effective hours
      const effectiveForOt = shiftEffectiveHours > 0 ? shiftEffectiveHours : totalDayHours;
      let otHours = 0;
      if (isAllOvertime) {
        otHours = effectiveForOt; // Sunday/Holiday: 100% OT
      } else if (effectiveForOt > standardCap) {
        otHours = parseFloat((effectiveForOt - standardCap).toFixed(2));
      }

      // If no shift bounds were recorded, fallback to explicit overtime stored in entries
      if (shiftEffectiveHours === 0) {
        const explicitOt = groupEntries.reduce((s, e) => s + Number(e.overtimeHours), 0);
        if (explicitOt > otHours) otHours = explicitOt;
      }

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
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());

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
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const activityCode = qStr(req.query.activityCode);
    const workerType = qStr(req.query.workerType);

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery);

    const entries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        status: 'approved',
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(empFilter ? { employee: empFilter } : {}),
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

    if (workerType === 'operator' || !workerType) {
      const opEntries = await prisma.operatorTimeEntry.findMany({
        where: {
          tenantId,
          ...(dateFilter ? { assignment: { date: dateFilter } } : {}),
          ...(businessPartner ? { assignment: { operator: { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } } } : {}),
          ...(employeeQuery ? {
            assignment: {
              operator: {
                OR: [
                  { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                  { fullName: { contains: employeeQuery, mode: 'insensitive' } },
                  { employeeCode: { contains: employeeQuery, mode: 'insensitive' } },
                ],
              },
            },
          } : {}),
        },
        include: {
          assignment: {
            include: {
              operator: { include: { businessPartner: true } },
              supervisor: { select: { id: true, fullName: true, username: true } },
            },
          },
          assignedEquipment: true,
        },
        orderBy: { assignment: { date: 'desc' } },
      });

      for (const op of opEntries) {
        const dateKey = op.assignment.date.toISOString().split('T')[0];
        const key = `${op.assignment.operatorId}___${dateKey}`;
        if (!grouped.has(key)) {
          const shiftH = Number(op.shiftHours) || 0;
          const otH = Number(op.otHours) || 0;
          const totalH = shiftH + otH;
          grandWorkHours += shiftH;
          grandOtHours += otH;
          grandTotalHours += totalH;

          items.push({
            id: `op-rc-${op.id}`,
            date: dateKey,
            supervisorName: op.assignment.supervisor?.fullName || (op.assignment.supervisor?.username ? `@${op.assignment.supervisor.username}` : 'Site Supervisor'),
            employeeCode: op.assignment.operator.employeeCode || op.assignment.operatorId,
            callingName: op.assignment.operator.callingName || op.assignment.operator.fullName || '—',
            businessPartner: op.assignment.operator.businessPartner?.name || 'Direct / Maga',
            inTime: op.inTime || '—',
            outTime: op.outTime || '—',
            breakHours: 0,
            workHours: shiftH,
            otHours: otH,
            totalHours: totalH,
            activities: [],
            activitiesDisplay: op.assignedEquipment 
              ? `Machine: ${op.assignedEquipment.code || op.assignedEquipment.name} (${op.assignedEquipment.vehicleNo || 'Active'})`
              : 'Plant Machinery Operation',
          });
        }
      }
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

// ─────────────────────────────────────────────────────────────────────────────
// 6. OFFICIAL LABOUR & OPERATOR TIME CARD (Maga Engineering Format)
// ─────────────────────────────────────────────────────────────────────────────
export const getTimeCardReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || req.body?.tenantId || (await getDefaultTenantId());
    const monthParam = qStr(req.query.month) || new Date().toISOString().slice(0, 7); // YYYY-MM
    const employeeId = qStr(req.query.employeeId);
    const workerType = qStr(req.query.workerType) || 'all'; // 'all' | 'labor' | 'operator'
    const bpId = qStr(req.query.businessPartnerId);

    const [yearStr, monthNumStr] = monthParam.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthNumStr, 10) - 1; // 0-based
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthIndex, daysInMonth, 23, 59, 59, 999));

    // 1. Fetch Tenant details
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { companyName: true, subdomain: true },
    });

    // 2. Fetch Calendar days for holiday / shutdown markings
    const calendarDays = await prisma.calendarDay.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
      },
      include: { dayType: true },
    });
    const holidayDateMap = new Map<string, string>();
    for (const cd of calendarDays) {
      const dStr = cd.date.toISOString().slice(0, 10);
      const dtName = cd.dayType?.name?.toLowerCase() || '';
      if (dtName.includes('holiday') || dtName.includes('poya')) holidayDateMap.set(dStr, '*');
      else if (dtName.includes('shut')) holidayDateMap.set(dStr, '@');
    }

    // 3. Fetch Employees
    const empWhere: any = {
      tenantId,
      status: 'active',
    };
    if (employeeId) {
      empWhere.id = employeeId;
    }
    if (bpId) {
      empWhere.businessPartnerId = bpId;
    }
    if (workerType === 'labor') {
      empWhere.isOperator = false;
    } else if (workerType === 'operator') {
      empWhere.isOperator = true;
    }

    const employees = await prisma.employee.findMany({
      where: empWhere,
      include: {
        businessPartner: true,
        tradeGroupRel: true,
      },
      orderBy: [
        { isOperator: 'asc' },
        { employeeCode: 'asc' },
      ],
    });

    // 4. Fetch TimeEntries in range
    const timeEntries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        date: { gte: startDate, lte: endDate },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        equipment: true,
      },
    });

    // Group TimeEntries by employeeId + date string (YYYY-MM-DD)
    const entryMap = new Map<string, Array<any>>();
    for (const te of timeEntries) {
      const dStr = te.date.toISOString().slice(0, 10);
      const key = `${te.employeeId}_${dStr}`;
      if (!entryMap.has(key)) {
        entryMap.set(key, []);
      }
      entryMap.get(key)!.push(te);
    }

    // 5. Month display label (e.g. "Jul-26")
    const monthDateObj = new Date(year, monthIndex, 1);
    const monthShort = monthDateObj.toLocaleString('en-US', { month: 'short' });
    const yearShort = String(year).slice(-2);
    const monthLabel = `${monthShort}-${yearShort}`;

    // 6. Build TimeCards
    const timeCards = [];

    for (const emp of employees) {
      const dailyRateVal = Number(emp.dailyRate || 1400);
      const hourlyOtRate = Math.round((dailyRateVal / 8 * 1.5) * 100) / 100;

      const days = [];
      let totalDays = 0;
      let totalOtHours = 0;

      for (let dayNum = 1; dayNum <= 31; dayNum++) {
        if (dayNum > daysInMonth) {
          days.push({
            day: dayNum,
            date: '',
            key: '',
            inTime: '-',
            outTime: '-',
            daysWorked: null,
            otHours: null,
            advance: null,
            equipmentCode: null,
            isOffMonth: true,
          });
          continue;
        }

        const dateObj = new Date(Date.UTC(year, monthIndex, dayNum));
        const dateStr = dateObj.toISOString().slice(0, 10);
        const dow = dateObj.getUTCDay(); // 0 = Sun, 6 = Sat

        // Determine Key marker:
        let keyMarker = '';
        if (dow === 0) keyMarker = 'X';
        else if (dow === 6) keyMarker = '\\';
        else if (holidayDateMap.has(dateStr)) keyMarker = holidayDateMap.get(dateStr)!;

        // Find entries
        const dayEntries = entryMap.get(`${emp.id}_${dateStr}`) || [];
        let inTimeStr = '-';
        let outTimeStr = '-';
        let dayWorked = 0;
        let dayOt = 0;
        let eqCode: string | null = null;

        if (dayEntries.length > 0) {
          const first = dayEntries[0];
          inTimeStr = first.inTime || '-';
          outTimeStr = first.outTime || '-';
          eqCode = first.equipment?.vehicleNo || first.equipment?.code || null;

          // Sum hours across activities
          let sumShiftHours = 0;
          let sumOtHours = 0;
          for (const e of dayEntries) {
            sumShiftHours += Number(e.hours || 0);
            sumOtHours += Number(e.overtimeHours || 0);
          }

          // Compute Days worked: 8h = 1.0 day, 4h = 0.5 day
          if (sumShiftHours >= 7.5) {
            dayWorked = 1.0;
          } else if (sumShiftHours >= 3.5) {
            dayWorked = 0.5;
          } else if (sumShiftHours > 0) {
            dayWorked = Math.round((sumShiftHours / 8) * 100) / 100;
          }

          dayOt = Math.round(sumOtHours * 100) / 100;
          totalDays += dayWorked;
          totalOtHours += dayOt;
        }

        days.push({
          day: dayNum,
          date: dateStr,
          key: keyMarker,
          inTime: inTimeStr,
          outTime: outTimeStr,
          daysWorked: dayWorked > 0 ? dayWorked : null,
          otHours: dayOt > 0 ? dayOt : null,
          advance: null,
          equipmentCode: eqCode,
          isOffMonth: false,
        });
      }

      const basicPay = Math.round(totalDays * dailyRateVal * 100) / 100;
      const otPay = Math.round(totalOtHours * hourlyOtRate * 100) / 100;
      const allowances = 0;
      const otherEarnings = 0;
      const grossPay = Math.round((basicPay + otPay + allowances + otherEarnings) * 100) / 100;
      
      const messAdvances = 0;
      const totalDeductions = messAdvances;
      const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

      timeCards.push({
        employeeId: emp.id,
        employeeCode: emp.employeeCode || emp.id.slice(0, 6),
        callingName: emp.callingName || '—',
        fullName: emp.fullName || emp.callingName,
        trade: emp.tradeGroup || (emp.isOperator ? 'Operator' : 'General'),
        nicNo: emp.nicNo || '—',
        epfNo: emp.epfNo || '0',
        dailyRate: dailyRateVal,
        hourlyOtRate,
        isOperator: emp.isOperator,
        businessPartner: emp.businessPartner?.name || 'Direct',
        siteName: tenant?.companyName ? `${tenant.companyName}` : 'Main Project Site',
        companyName: 'Maga Engineering (Pvt) Ltd.',
        month: monthLabel,
        days,
        totals: {
          totalDays: Math.round(totalDays * 100) / 100,
          totalOtHours: Math.round(totalOtHours * 100) / 100,
          basicPay,
          otPay,
          allowances,
          otherEarnings,
          grossPay,
          deductions: {
            advances: 0,
            epf: 0,
            loans: 0,
            messAdvances,
            advancesOtherSite: 0,
            festivalAdvances: 0,
            others: 0,
            total: totalDeductions,
          },
          netPay,
        },
      });
    }

    res.json({
      month: monthParam,
      monthLabel,
      totalCards: timeCards.length,
      cards: timeCards,
    });
  } catch (error) {
    console.error('Error generating time card report:', error);
    res.status(500).json({ error: 'Failed to generate time card report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 8. REPORTS HUB STATS
// GET /api/reports/hub-stats?tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getReportsHubStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const [
      laborCount,
      operatorCount,
      equipmentCount,
      laborHoursAgg,
      operatorHoursAgg,
      equipmentAssignmentsCount,
      laborBpsCount,
    ] = await Promise.all([
      prisma.employee.count({
        where: { tenantId, isOperator: false, status: 'active' },
      }),
      prisma.employee.count({
        where: { tenantId, isOperator: true, status: 'active' },
      }),
      prisma.equipment.count({
        where: { tenantId, status: 'active' },
      }),
      prisma.timeEntry.aggregate({
        where: {
          tenantId,
          status: 'approved',
          date: { gte: startOfMonth, lte: endOfMonth },
          employee: { isOperator: false },
        },
        _sum: { hours: true, otHours: true },
      }),
      prisma.timeEntry.aggregate({
        where: {
          tenantId,
          status: 'approved',
          date: { gte: startOfMonth, lte: endOfMonth },
          employee: { isOperator: true },
        },
        _sum: { hours: true, otHours: true },
      }),
      prisma.dailyEquipmentAssignment.count({
        where: {
          tenantId,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
      }),
      prisma.businessPartner.count({
        where: { tenantId, status: 'active' },
      }),
    ]);

    const laborTotalHours = (Number(laborHoursAgg._sum.hours) || 0) + (Number(laborHoursAgg._sum.otHours) || 0);
    const operatorTotalHours = (Number(operatorHoursAgg._sum.hours) || 0) + (Number(operatorHoursAgg._sum.otHours) || 0);

    res.json({
      labor: {
        totalWorkers: laborCount,
        monthlyHours: Math.round(laborTotalHours),
        subcontractorsCount: laborBpsCount,
        reportsCount: 5,
      },
      operator: {
        totalOperators: operatorCount,
        monthlyHours: Math.round(operatorTotalHours),
        reportsCount: 4,
      },
      equipment: {
        totalEquipment: equipmentCount,
        monthlyAssignments: equipmentAssignmentsCount,
        reportsCount: 3,
      },
    });
  } catch (error) {
    console.error('Error fetching hub stats:', error);
    res.status(500).json({ error: 'Failed to fetch hub stats' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 9. EQUIPMENT RUNNING CHART REPORT
// GET /api/reports/equipment-running-chart?dateFrom=&dateTo=&equipmentQuery=&condition=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getEquipmentRunningChartReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const equipmentQuery = qStr(req.query.equipmentQuery);
    const condition = qStr(req.query.condition);

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const assignments = await prisma.dailyEquipmentAssignment.findMany({
      where: {
        tenantId,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(equipmentQuery
          ? {
              equipment: {
                OR: [
                  { name: { contains: equipmentQuery, mode: 'insensitive' } },
                  { code: { contains: equipmentQuery, mode: 'insensitive' } },
                  { vehicleNo: { contains: equipmentQuery, mode: 'insensitive' } },
                  { magaNo: { contains: equipmentQuery, mode: 'insensitive' } },
                ],
              },
            }
          : {}),
        ...(condition
          ? { equipment: { condition: { equals: condition, mode: 'insensitive' } } }
          : {}),
      },
      include: {
        equipment: {
          include: {
            ownerPartner: true,
            unitRates: true,
          },
        },
        supervisor: { select: { id: true, fullName: true, username: true } },
        dailyLog: true,
      },
      orderBy: [{ date: 'desc' }, { equipment: { code: 'asc' } }],
    });

    let totalWorkingHours = 0;
    let totalIdleHours = 0;
    let totalFuelLiters = 0;
    let totalNetHours = 0;

    const items = assignments.map((a) => {
      const log = a.dailyLog;
      const workingH = Number(log?.workingHours) || 0;
      const idleH = Number(log?.idleHours) || 0;
      const breakdownH = Number(log?.breakdownHours) || 0;
      const netH = Number(log?.netRunningHours) || (workingH + idleH);
      const fuel = Number(log?.fuelLiters) || 0;

      totalWorkingHours += workingH;
      totalIdleHours += idleH;
      totalFuelLiters += fuel;
      totalNetHours += netH;

      return {
        id: a.id,
        date: a.date.toISOString().split('T')[0],
        equipmentId: a.equipmentId,
        equipmentCode: a.equipment.code || a.equipment.vehicleNo || '—',
        equipmentName: a.equipment.name,
        vehicleNo: a.equipment.vehicleNo || '—',
        magaNo: a.equipment.magaNo || '—',
        condition: a.equipment.condition || 'DRY',
        primaryUnit: a.equipment.primaryUnit || 'Hrs',
        supervisorName: a.supervisor.fullName || a.supervisor.username,
        initialMeter: Number(log?.initialMeter) || 0,
        finalMeter: Number(log?.finalMeter) || 0,
        netRunningHours: netH,
        workingHours: workingH,
        idleHours: idleH,
        breakdownHours: breakdownH,
        fuelLiters: fuel,
        remarks: log?.remarks || '—',
        status: log?.status || 'pending',
      };
    });

    res.json({
      items,
      totals: {
        totalRecords: items.length,
        totalNetHours: Math.round(totalNetHours * 100) / 100,
        totalWorkingHours: Math.round(totalWorkingHours * 100) / 100,
        totalIdleHours: Math.round(totalIdleHours * 100) / 100,
        totalFuelLiters: Math.round(totalFuelLiters * 100) / 100,
      },
    });
  } catch (error) {
    console.error('Error generating equipment running chart:', error);
    res.status(500).json({ error: 'Failed to generate equipment running chart' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 10. EQUIPMENT SUMMARY REPORT (EQUIPMENT ENTRY SHEET - Maga Format)
// GET /api/reports/equipment-summary?month=&dateFrom=&dateTo=&condition=&equipmentQuery=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getEquipmentSummaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const month = qStr(req.query.month);
    const equipmentQuery = qStr(req.query.equipmentQuery);
    const condition = qStr(req.query.condition);

    let from = dateFrom;
    let to = dateTo;
    if (month && (!from || !to)) {
      const [y, m] = month.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      from = `${month}-01`;
      to = `${month}-${String(lastDay).padStart(2, '0')}`;
    }

    const dateFilter = buildDateFilter(from, to);

    // 1. Fetch all active equipment
    const equipmentList = await prisma.equipment.findMany({
      where: {
        tenantId,
        status: 'active',
        ...(equipmentQuery
          ? {
              OR: [
                { name: { contains: equipmentQuery, mode: 'insensitive' } },
                { code: { contains: equipmentQuery, mode: 'insensitive' } },
                { vehicleNo: { contains: equipmentQuery, mode: 'insensitive' } },
                { magaNo: { contains: equipmentQuery, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(condition
          ? { condition: { equals: condition, mode: 'insensitive' } }
          : {}),
      },
      include: {
        ownerPartner: true,
        unitRates: true,
        dailyAssignments: {
          where: dateFilter ? { date: dateFilter } : undefined,
          include: { dailyLog: true },
        },
      },
      orderBy: [{ magaNo: 'asc' }, { code: 'asc' }],
    });

    const rows = equipmentList.map((eq) => {
      const logs = eq.dailyAssignments.map((a) => a.dailyLog).filter(Boolean);
      const primaryUnit = (eq.primaryUnit || 'hrs').toLowerCase();
      
      let totalUtilization = 0;
      let totalMileage = 0;

      if (primaryUnit === 'mth') {
        totalUtilization = 1.00; // standard 1 month line
      } else if (primaryUnit === 'day' || primaryUnit === 'days') {
        totalUtilization = logs.length > 0 ? logs.length : 27.00;
      } else if (primaryUnit === 'km') {
        totalMileage = logs.reduce((sum, l) => sum + (Number(l?.totalMileage) || 0), 0);
        totalUtilization = totalMileage;
      } else {
        // hrs / running hours
        totalUtilization = logs.reduce((sum, l) => {
          const net = Number(l?.netRunningHours) || (Number(l?.workingHours) || 0) + (Number(l?.idleHours) || 0);
          return sum + net;
        }, 0);
      }

      // Find unit rate for minimum utilization
      const matchingRate = eq.unitRates.find((r) => r.unit.toLowerCase() === primaryUnit);
      const minUtil = matchingRate?.minUtilization ? Number(matchingRate.minUtilization) : null;

      const vehicleOrMaga = eq.magaNo || eq.vehicleNo || eq.code || '—';

      return {
        id: eq.id,
        vehicleOrMagaNo: vehicleOrMaga,
        equipmentName: eq.name || '',
        businessPartner: eq.ownerPartner?.name || '—',
        condition: eq.condition || 'DRY',
        unit: primaryUnit,
        minUtilization: minUtil !== null ? minUtil.toFixed(2) : '—',
        totalUtilization: totalUtilization > 0 ? totalUtilization.toFixed(2) : (primaryUnit === 'mth' ? '1.00' : '—'),
        totalMileage: totalMileage > 0 ? totalMileage.toFixed(2) : '—',
      };
    });

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { companyName: true, subdomain: true },
    });

    res.json({
      sheetTitle: 'EQUIPMENT ENTRY SHEET',
      companyName: tenant?.companyName || 'Mäga Engineering (Pvt) Ltd',
      address: '200, Nawala Road, Narahenpita, Colombo 05, Sri Lanka',
      phone: '2808835-44',
      fax: '2808846-48',
      email: 'maga@maga.lk',
      date: to || from || new Date().toISOString().split('T')[0],
      projectCentre: 'Project / Activity Centre',
      totalRecords: rows.length,
      rows,
    });
  } catch (error) {
    console.error('Error fetching equipment summary report:', error);
    res.status(500).json({ error: 'Failed to generate equipment summary report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 11. EQUIPMENT ERP UPLOAD EXPORT (Matches Maga SAP/ERP Excel template)
// GET /api/reports/equipment-erp-upload?month=&dateFrom=&dateTo=&condition=&activityCode=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getEquipmentErpUploadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || qStr(req.query.tenantId) || (await getDefaultTenantId());
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const month = qStr(req.query.month);
    const condition = qStr(req.query.condition);
    const activityCode = qStr(req.query.activityCode) || '00-00-10-00';

    let from = dateFrom;
    let to = dateTo;
    let uploadDateFormatted = '31-10-2026';

    if (month) {
      const [y, m] = month.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      from = `${month}-01`;
      to = `${month}-${String(lastDay).padStart(2, '0')}`;
      uploadDateFormatted = `${String(lastDay).padStart(2, '0')}-${String(m).padStart(2, '0')}-${y}`;
    } else if (to) {
      const [y, m, d] = to.split('-');
      uploadDateFormatted = `${d}-${m}-${y}`;
    } else {
      const now = new Date();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      uploadDateFormatted = `${String(lastDay).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;
    }

    const dateFilter = buildDateFilter(from, to);

    const equipmentList = await prisma.equipment.findMany({
      where: {
        tenantId,
        status: 'active',
        ...(condition
          ? { condition: { equals: condition, mode: 'insensitive' } }
          : {}),
      },
      include: {
        unitRates: true,
        dailyAssignments: {
          where: dateFilter ? { date: dateFilter } : undefined,
          include: { dailyLog: true },
        },
      },
      orderBy: [{ magaNo: 'asc' }, { code: 'asc' }],
    });

    const rows = equipmentList.map((eq) => {
      const logs = eq.dailyAssignments.map((a) => a.dailyLog).filter(Boolean);
      const primaryUnit = (eq.primaryUnit || 'hrs').toLowerCase();

      // Find rate / ERP code override (e.g. MGEN0140A for mth)
      const matchingRate = eq.unitRates.find((r) => r.unit.toLowerCase() === primaryUnit);
      const erpCode = matchingRate?.erpBillingCode || eq.magaNo || eq.code || eq.vehicleNo || 'EQUIP';

      let totalUtilization = 0;
      if (primaryUnit === 'mth') {
        totalUtilization = 1.00;
      } else if (primaryUnit === 'day' || primaryUnit === 'days') {
        totalUtilization = logs.length > 0 ? logs.length : 27.00;
      } else if (primaryUnit === 'km') {
        totalUtilization = logs.reduce((sum, l) => sum + (Number(l?.totalMileage) || 0), 0);
      } else {
        totalUtilization = logs.reduce((sum, l) => {
          const net = Number(l?.netRunningHours) || (Number(l?.workingHours) || 0) + (Number(l?.idleHours) || 0);
          return sum + net;
        }, 0);
        if (totalUtilization === 0) totalUtilization = 108.00;
      }

      return {
        equipment: erpCode,
        condition: (eq.condition || 'DRY').toUpperCase(),
        unit: primaryUnit,
        date: uploadDateFormatted,
        activity: activityCode,
        utilization: totalUtilization.toFixed(2),
      };
    });

    res.json({
      date: uploadDateFormatted,
      activityCode,
      totalRows: rows.length,
      rows,
    });
  } catch (error) {
    console.error('Error generating equipment ERP upload report:', error);
    res.status(500).json({ error: 'Failed to generate equipment ERP upload report' });
  }
};


