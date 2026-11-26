import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getDefaultProjectId, getDefaultTenantId } from '../utils/tenantHelper';
import { isExternalEmployeeType, pickRateFromTradeRateRow } from '../utils/tradeRateHelper';

function buildEmployeeTypeWhere(employeeType?: string) {
  if (!employeeType) return undefined;
  const val = employeeType.trim().toUpperCase();
  if (val === 'INTERNAL') return { employeeType: 'INTERNAL' as const };
  if (val === 'FOREIGN') return { employeeType: 'FOREIGN' as const };
  if (val === 'EXTERNAL_SUPPLY' || val === 'SUPPLY') return { employeeType: 'EXTERNAL_SUPPLY' as const };
  if (val === 'EXTERNAL_SUBCONTRACTOR' || val === 'SUBCONTRACTOR') {
    return { employeeType: 'EXTERNAL_SUBCONTRACTOR' as const };
  }
  if (val === 'EXTERNAL') {
    return { employeeType: { in: ['EXTERNAL_SUPPLY' as const, 'EXTERNAL_SUBCONTRACTOR' as const] } };
  }
  return undefined;
}

// ─── Helper: parse query param safely ─────────────────────────────────────────
const qStr = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

// ─── Helper: resolve project ID from query / tenantId fallback ────────────────
async function resolveProjectId(req: Request): Promise<string> {
  const candidate =
    req.resolvedProjectId ||
    req.resolvedTenantId ||
    qStr(req.query.projectId) ||
    qStr(req.query.tenantId);

  if (candidate) {
    const proj = await prisma.mF_P_Project.findFirst({
      where: {
        OR: [
          { id: candidate },
          { subdomain: { equals: candidate, mode: "insensitive" } },
          { projectCode: { equals: candidate, mode: "insensitive" } },
          { projectCode: { equals: `PRJ${candidate}`, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (proj) return proj.id;
  }

  const activeWithEntries = await prisma.mF_P_Project.findFirst({
    where: {
      status: "active",
      timeEntries: { some: {} },
    },
    select: { id: true },
  });
  if (activeWithEntries) return activeWithEntries.id;

  return await getDefaultProjectId();
}

// ─── Helper: resolve status filter (defaults to approved only) ─────────────────
function resolveStatusFilter(statusParam?: string) {
  if (!statusParam || statusParam === 'all') {
    return 'approved';
  }
  return statusParam;
}

// ─── Helper: build date filter for Prisma ─────────────────────────────────────
function buildDateFilter(dateFrom?: string, dateTo?: string) {
  const filter: Record<string, Date> = {};
  if (dateFrom) {
    const [y, m, d] = dateFrom.split('-').map(Number);
    filter.gte = (!isNaN(y) && !isNaN(m) && !isNaN(d))
      ? new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0))
      : new Date(dateFrom);
  }
  if (dateTo) {
    const [y, m, d] = dateTo.split('-').map(Number);
    filter.lte = (!isNaN(y) && !isNaN(m) && !isNaN(d))
      ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
      : new Date(dateTo);
  }
  return Object.keys(filter).length > 0 ? filter : undefined;
}

// ─── Helper: get all unique dates in a range ─────────────────────────────────
function dateRange(from?: string, to?: string): string[] {
  let start: Date;
  let end: Date;
  if (from) {
    const [y, m, d] = from.split('-').map(Number);
    start = (!isNaN(y) && !isNaN(m) && !isNaN(d))
      ? new Date(Date.UTC(y, m - 1, d))
      : new Date(from);
  } else {
    const now = new Date();
    start = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  }
  if (to) {
    const [y, m, d] = to.split('-').map(Number);
    end = (!isNaN(y) && !isNaN(m) && !isNaN(d))
      ? new Date(Date.UTC(y, m - 1, d))
      : new Date(to);
  } else {
    end = new Date();
  }

  const dates: string[] = [];
  const curr = new Date(start);
  while (curr <= end && dates.length < 90) {
    dates.push(curr.toISOString().split('T')[0]);
    curr.setUTCDate(curr.getUTCDate() + 1);
  }
  return dates.length > 0 ? dates : [new Date().toISOString().split('T')[0]];
}

// ─── Day Type Interface ────────────────────────────────────────────────────────
interface DayTypeRuleInfo {
  code: string;
  name: string;
  rateMultiplier: number;
  isAllOvertime: boolean;
  isSaturday: boolean;
  isSunday: boolean;
  standardCap: number;
  label: string;
}

// ─── Helper: Build Map from Calendar Days in batch ───────────────────────────
function buildCalendarMapFromDays(
  calendarDays: Array<{ date: Date; dayType?: { code?: string; name?: string; rateMultiplier?: any } | null }>
): Map<string, DayTypeRuleInfo> {
  const map = new Map<string, DayTypeRuleInfo>();
  for (const cd of calendarDays) {
    const dateKey = cd.date.toISOString().split('T')[0];
    const code = (cd.dayType?.code || 'NORMAL').toUpperCase();
    const name = cd.dayType?.name || 'Special Day';
    const isSaturday = code === 'SATURDAY';
    const isSunday = code === 'SUNDAY';
    const isAllOvertime = isSunday || code === 'POYA' || code === 'PUBLIC_HOLIDAY' || code === 'HOLIDAY';
    map.set(dateKey, {
      code,
      name,
      rateMultiplier: Number(cd.dayType?.rateMultiplier ?? 1.0),
      isAllOvertime,
      isSaturday,
      isSunday,
      standardCap: isAllOvertime ? 0.0 : isSaturday ? 5.5 : 8.0,
      label: name,
    });
  }
  return map;
}

// ─── Helper: Fetch project calendar days for date range in one query ─────────
async function getProjectCalendarDayMap(
  projectId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<Map<string, DayTypeRuleInfo>> {
  try {
    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const calendarDays = await prisma.mF_P_CalendarDay.findMany({
      where: {
        projectId,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: { dayType: true },
    });
    return buildCalendarMapFromDays(calendarDays);
  } catch (err) {
    console.error('Failed to load project calendar days:', err);
    return new Map();
  }
}

// ─── Helper: Day type OT rules (Time Entry effectiveDayType is final, then Calendar, then Day-of-Week) ─
function resolveDayTypeRule(
  dateStr: string,
  calendarMap?: Map<string, DayTypeRuleInfo>,
  entryDayType?: { code?: string | null; name?: string | null; rateMultiplier?: any } | null
): DayTypeRuleInfo {
  // 1. Time Entry's own saved effectiveDayType is the final source of truth
  if (entryDayType?.code) {
    const code = entryDayType.code.toUpperCase();
    const name = entryDayType.name || code;
    const isSaturday = code === 'SATURDAY';
    const isSunday = code === 'SUNDAY';
    const isAllOvertime = isSunday || code === 'POYA' || code === 'PUBLIC_HOLIDAY' || code === 'HOLIDAY';
    return {
      code,
      name,
      rateMultiplier: Number(entryDayType.rateMultiplier ?? 1.5),
      isAllOvertime,
      isSaturday,
      isSunday,
      standardCap: isAllOvertime ? 0.0 : isSaturday ? 5.5 : 8.0,
      label: name,
    };
  }

  // 2. Fallback: Project Calendar overrides
  if (calendarMap?.has(dateStr)) {
    return calendarMap.get(dateStr)!;
  }

  // 3. Fallback: Parse date safely (UTC) to avoid timezone shifts
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = (!isNaN(y) && !isNaN(m) && !isNaN(d)) ? new Date(Date.UTC(y, m - 1, d)) : new Date(dateStr);
  const dow = dt.getUTCDay(); // 0 = Sunday, 6 = Saturday

  if (dow === 0) {
    return {
      code: 'SUNDAY',
      name: 'Sunday',
      rateMultiplier: 1.5,
      isAllOvertime: true,
      isSaturday: false,
      isSunday: true,
      standardCap: 0.0,
      label: 'Sunday',
    };
  }
  if (dow === 6) {
    return {
      code: 'SATURDAY',
      name: 'Saturday',
      rateMultiplier: 1.5,
      isAllOvertime: false,
      isSaturday: true,
      isSunday: false,
      standardCap: 5.5,
      label: 'Saturday',
    };
  }
  return {
    code: 'NORMAL',
    name: 'Normal Day',
    rateMultiplier: 1.5,
    isAllOvertime: false,
    isSaturday: false,
    isSunday: false,
    standardCap: 8.0,
    label: 'Normal Day',
  };
}

// Backwards compatibility helper
function getDayTypeRule(dateStr: string, calendarMap?: Map<string, DayTypeRuleInfo>): DayTypeRuleInfo {
  return resolveDayTypeRule(dateStr, calendarMap);
}

// ─── Helper: Compute shift work hours and OT with Database Fast-Path ─────────
function computeAttendanceHoursAndOt(
  inTime?: string | null,
  outTime?: string | null,
  fallbackHours = 0,
  standardCap = 8.0,
  isAllOvertime = false,
  precomputedShiftHours?: number | null,
  precomputedOtHours?: number | null,
  isExternal = false
): { workHours: number; otHours: number } {
  const hasPrecomputedShift = precomputedShiftHours !== null && precomputedShiftHours !== undefined;
  const hasPrecomputedOt = precomputedOtHours !== null && precomputedOtHours !== undefined;

  // FAST-PATH: If already pre-computed & stored in database (and not an overridden All-Overtime day)
  if (hasPrecomputedShift && hasPrecomputedOt && !isAllOvertime) {
    return {
      workHours: Number(precomputedShiftHours),
      otHours: Number(precomputedOtHours),
    };
  }

  // Parse shift hours if not precomputed
  let shiftHours = hasPrecomputedShift ? Number(precomputedShiftHours) : 0;
  if (!hasPrecomputedShift) {
    if (inTime && outTime) {
      const [inH, inM] = inTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      const inMins = inH * 60 + (inM || 0);
      const outMins = outH * 60 + (outM || 0);
      let diffMins = outMins - inMins;
      if (diffMins <= 0) diffMins += 24 * 60; // Crosses midnight or full 24h

      let breakMins = 0;
      if (diffMins >= 300) breakMins += 60; // 1-hour lunch break deduction
      const isPast11PM = diffMins >= 720 || (
        (outMins >= inMins)
          ? (outMins >= 23 * 60)
          : (inMins <= 23 * 60 || outMins >= 23 * 60)
      );
      if (isPast11PM) breakMins += 60; // 1-hour late night break deduction

      diffMins = Math.max(0, diffMins - breakMins);
      shiftHours = diffMins > 0 ? Math.round((diffMins / 60) * 100) / 100 : 0;
    } else {
      shiftHours = fallbackHours;
    }
  }

  // If this is an All-Overtime day (Poya, Sunday, Public Holiday), 100% of shift is OT
  if (isAllOvertime) {
    return {
      workHours: shiftHours,
      otHours: shiftHours,
    };
  }

  // If approved OT is already in the database, use it directly (Single Source of Truth)
  if (hasPrecomputedOt) {
    return {
      workHours: shiftHours,
      otHours: Number(precomputedOtHours),
    };
  }

  // Fallback calculation per business logic document
  let ot = 0;
  if (shiftHours <= 0) {
    ot = 0;
  } else if (isExternal) {
    const cap = standardCap === 5.5 ? 5.5 : 8.0;
    ot = shiftHours > cap ? Math.round((shiftHours - cap) * 100) / 100 : 0;
  } else if (standardCap === 5.5) {
    ot = Math.round((shiftHours - 5.5) * 100) / 100;
  } else if (shiftHours > 6.0) {
    ot = Math.round((shiftHours - 8.0) * 100) / 100;
  } else {
    ot = Math.round((shiftHours - 4.0) * 100) / 100;
  }
  return { workHours: shiftHours, otHours: ot };
}

function buildEmployeeFilter(
  workerType?: string,
  businessPartner?: string,
  employeeQuery?: string,
  employeeType?: string
) {
  const conditions: any[] = [];

  if (workerType === 'operator') {
    conditions.push({ isOperator: true });
  } else if (workerType === 'labor') {
    conditions.push({ isOperator: false });
  }

  const empTypeCond = buildEmployeeTypeWhere(employeeType);
  if (empTypeCond) {
    conditions.push({
      corporateEmployee: empTypeCond,
    });
  }

  if (businessPartner) {
    conditions.push({
      OR: [
        { businessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } },
        { corporateEmployee: { corporateBusinessPartner: { name: { contains: businessPartner, mode: 'insensitive' } } } },
      ],
    });
  }

  if (employeeQuery) {
    conditions.push({
      OR: [
        { callingName: { contains: employeeQuery, mode: 'insensitive' } },
        { corporateEmployee: { fullName: { contains: employeeQuery, mode: 'insensitive' } } },
        { corporateEmployee: { employeeCode: { contains: employeeQuery, mode: 'insensitive' } } },
      ],
    });
  }

  if (conditions.length === 0) return undefined;
  if (conditions.length === 1) return conditions[0];
  return { AND: conditions };
}

// ─── Helper: build activity code filter matching child labor splits ────────────
function buildActivityCodeFilter(activityCode?: string, matchMode: 'equals' | 'contains' = 'equals') {
  if (!activityCode) return undefined;
  const codeCondition = { [matchMode]: activityCode, mode: 'insensitive' as const };
  return {
    activitySplits: { some: { activityCode: { code: codeCondition } } },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SUMMARY REPORT
// GET /api/reports/summary?dateFrom=&dateTo=&employeeQuery=&businessPartner=&workerType=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getSummaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const workerType = qStr(req.query.workerType) || 'labor';
    const employeeType = qStr(req.query.employeeType);
    const statusFilter = resolveStatusFilter(qStr(req.query.status));

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery, employeeType);

    // Fetch time entries with employee + corporateEmployee + business partner data
    const entries = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        status: statusFilter,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(empFilter ? { employee: empFilter } : {}),
      },
      include: {
        employee: {
          include: {
            corporateEmployee: {
              include: {
                tradeGroup: true,
                corporateBusinessPartner: true,
              },
            },
            businessPartner: true,
            tradeGroup: true,
          },
        },
        appliedBusinessPartner: true,
        effectiveDayType: true,
      },
      orderBy: { date: 'asc' },
    });

    const calendarMap = await getProjectCalendarDayMap(projectId, dateFrom, dateTo);

    // Group entries by employee AND date to compute daily shift and OT from In/Out times
    const empDailyMap = new Map<string, Map<string, Array<{
      inTime?: string | null;
      outTime?: string | null;
      shiftHours?: any;
      overtimeHours?: any;
      hours?: any;
      effectiveDayType?: any;
    }>>>();
    const empInfoMap = new Map<string, any>();

    for (const entry of entries) {
      const empId = entry.employeeId;
      const dateKey = entry.date.toISOString().split('T')[0];
      const emp = entry.employee;
      const corp = emp.corporateEmployee;
      const effectiveBp = entry.appliedBusinessPartner || emp.businessPartner || corp.corporateBusinessPartner;

      const isEmployeeActive = emp.status === 'active' && corp.status === 'active';
      const isPartnerActive = !effectiveBp || effectiveBp.status === 'active';
      const isPayable = isEmployeeActive && isPartnerActive;
      const payrollStatus = isPayable ? 'PAYABLE' : 'HOLD_PENDING_HO_APPROVAL';
      const lockReason = !isPayable
        ? (!isEmployeeActive && !isPartnerActive
            ? 'Both Employee and Business Partner pending Super Admin approval'
            : !isEmployeeActive
            ? 'Employee dossier pending Super Admin approval'
            : 'Business Partner pending Super Admin approval')
        : null;

      if (!empInfoMap.has(empId)) {
        empInfoMap.set(empId, {
          employeeId: empId,
          employeeCode: corp.employeeCode || '',
          callingName: emp.callingName || corp.fullName || '',
          employeeName: corp.fullName || emp.callingName || '',
          tradeGroup: emp.tradeGroup?.name || corp.tradeGroup?.name || (emp.isOperator ? 'Operator' : 'Labor'),
          businessPartner: effectiveBp?.name || corp.corporateBusinessPartner?.name || 'Direct / Maga',
          employeeType: corp.employeeType || '',
          isEmployeeApproved: isEmployeeActive,
          isPartnerApproved: isPartnerActive,
          isPayable,
          payrollStatus,
          lockReason,
        });
      }

      if (!empDailyMap.has(empId)) {
        empDailyMap.set(empId, new Map());
      }
      const dayMap = empDailyMap.get(empId)!;
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, []);
      }
      dayMap.get(dateKey)!.push({
        inTime: entry.inTime,
        outTime: entry.outTime,
        shiftHours: entry.shiftHours,
        overtimeHours: entry.overtimeHours,
        hours: entry.hours,
        effectiveDayType: entry.effectiveDayType,
      });
    }

    // Also include operators assigned to equipment
    if (workerType === 'operator') {
      const opEmployeeFilter = buildEmployeeFilter('operator', businessPartner, employeeQuery, employeeType);
      const opAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
        where: {
          dailySheet: {
            projectId,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
          ...(opEmployeeFilter ? { operator: opEmployeeFilter } : {}),
        },
        include: {
          dailySheet: { select: { date: true } },
          operator: {
            include: {
              corporateEmployee: true,
              businessPartner: true,
              tradeGroup: true,
            },
          },
          dailyLog: true,
        },
      });

      for (const op of opAssignments) {
        const emp = op.operator;
        if (!emp) continue;
        const corp = emp.corporateEmployee;
        const empId = emp.id;
        const dateKey = op.dailySheet.date.toISOString().split('T')[0];

        const isEmployeeActive = emp.status === 'active' && corp.status === 'active';
        const isPartnerActive = !emp.businessPartner || emp.businessPartner.status === 'active';
        const isPayable = isEmployeeActive && isPartnerActive;
        const payrollStatus = isPayable ? 'PAYABLE' : 'HOLD_PENDING_HO_APPROVAL';
        const lockReason = !isPayable
          ? (!isEmployeeActive && !isPartnerActive
              ? 'Both Operator and Business Partner pending Super Admin approval'
              : !isEmployeeActive
              ? 'Operator dossier pending Super Admin approval'
              : 'Business Partner pending Super Admin approval')
          : null;

        if (!empInfoMap.has(empId)) {
          empInfoMap.set(empId, {
            employeeId: empId,
            employeeCode: corp.employeeCode || '',
            callingName: emp.callingName || corp.fullName || '',
            employeeName: corp.fullName || emp.callingName || '',
            tradeGroup: emp.tradeGroup?.name || 'Operator',
            businessPartner: emp.businessPartner?.name || 'Direct / Maga',
            isEmployeeApproved: isEmployeeActive,
            isPartnerApproved: isPartnerActive,
            isPayable,
            payrollStatus,
            lockReason,
          });
        }

        if (!empDailyMap.has(empId)) {
          empDailyMap.set(empId, new Map());
        }
        const dayMap = empDailyMap.get(empId)!;
        if (!dayMap.has(dateKey)) {
          const logWorkHours = Number(op.dailyLog?.workingHours || op.dailyLog?.netRunningHours || 8);
          dayMap.set(dateKey, [
            {
              inTime: null,
              outTime: null,
              shiftHours: logWorkHours,
              overtimeHours: 0,
              hours: logWorkHours,
            },
          ]);
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
        const firstEntry = dayEntries[0];
        const dayRule = resolveDayTypeRule(dateKey, calendarMap, firstEntry?.effectiveDayType);
        const { standardCap, isAllOvertime } = dayRule;

        const inTime = dayEntries.find((e) => e.inTime)?.inTime;
        const outTime = dayEntries.find((e) => e.outTime)?.outTime;
        const activitySum = dayEntries.reduce((s, e) => s + (Number(e.shiftHours ?? e.hours) || 0), 0);
        const precomputedShift = dayEntries.find((e) => e.shiftHours !== null && e.shiftHours !== undefined)?.shiftHours;
        const precomputedOt = dayEntries.find((e) => e.overtimeHours !== null && e.overtimeHours !== undefined)?.overtimeHours;

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
      const empIdentifier = empInfo?.employeeCode || empInfo?.callingName || empInfo?.employeeName || empId;

      return {
        id: `sum-${idx}`,
        employeeId: empId,
        employeeCode: empInfo?.employeeCode || '',
        callingName: empInfo?.callingName || '',
        employeeName: empInfo?.employeeName || '',
        employeeIdentifier: empIdentifier,
        tradeGroup: empInfo?.tradeGroup || '',
        businessPartner: empInfo?.businessPartner || '',
        isEmployeeApproved: empInfo?.isEmployeeApproved ?? true,
        isPartnerApproved: empInfo?.isPartnerApproved ?? true,
        isPayable: empInfo?.isPayable ?? true,
        payrollStatus: empInfo?.payrollStatus || 'PAYABLE',
        lockReason: empInfo?.lockReason || null,
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
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const workerType = qStr(req.query.workerType) || 'labor';
    const employeeType = qStr(req.query.employeeType);
    const statusFilter = resolveStatusFilter(qStr(req.query.status));

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery, employeeType);

    const entries = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        status: statusFilter,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(empFilter ? { employee: empFilter } : {}),
      },
      include: {
        employee: {
          include: {
            corporateEmployee: {
              include: {
                tradeGroup: true,
                corporateBusinessPartner: true,
              },
            },
            businessPartner: true,
            tradeGroup: true,
          },
        },
        appliedBusinessPartner: true,
        effectiveDayType: true,
      },
      orderBy: { date: 'asc' },
    });

    const calendarMap = await getProjectCalendarDayMap(projectId, dateFrom, dateTo);

    // Collect all unique dates in the range, unioned with the requested date range
    const rangeDates = dateFrom && dateTo ? dateRange(dateFrom, dateTo) : [];
    const allDatesSet = new Set<string>(rangeDates);
    entries.forEach((e) => allDatesSet.add(e.date.toISOString().split('T')[0]));
    const finalDates = allDatesSet.size > 0 ? Array.from(allDatesSet).sort() : dateRange(dateFrom, dateTo);

    // Group by employee AND date to compute daily shift and OT from In/Out times
    const empDailyMap = new Map<string, Map<string, typeof entries>>();
    const empInfoMap = new Map<string, any>();

    for (const entry of entries) {
      const empId = entry.employeeId;
      const dateKey = entry.date.toISOString().split('T')[0];
      const emp = entry.employee;
      const corp = emp.corporateEmployee;
      const effectiveBp = entry.appliedBusinessPartner || emp.businessPartner || corp?.corporateBusinessPartner;

      if (!empInfoMap.has(empId)) {
        empInfoMap.set(empId, {
          employeeId: empId,
          employeeCode: corp?.employeeCode || '',
          callingName: emp.callingName || corp?.fullName || '',
          employeeName: corp?.fullName || emp.callingName || '',
          tradeGroup: emp.tradeGroup?.name || corp?.tradeGroup?.name || '',
          businessPartner: effectiveBp?.name || corp?.corporateBusinessPartner?.name || '',
          employeeType: corp?.employeeType || '',
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
      const isExternal = isExternalEmployeeType(empInfo?.employeeType) || Boolean(empInfo?.businessPartner);
      const dailyEntries: Record<string, { days: number; otHours: number; workHours: number }> = {};
      let totalEmpDays = 0;
      let totalEmpWork = 0;
      let totalEmpOt = 0;

      for (const [dateKey, dayEntries] of dayMap.entries()) {
        const firstEntry = dayEntries[0];
        const dayRule = resolveDayTypeRule(dateKey, calendarMap, firstEntry?.effectiveDayType);
        const { standardCap, isAllOvertime } = dayRule;
        const inTime = dayEntries.find((e) => e.inTime)?.inTime;
        const outTime = dayEntries.find((e) => e.outTime)?.outTime;
        const activitySum = dayEntries.reduce((s, e) => s + (Number(e.shiftHours ?? e.hours) || 0), 0);
        const precomputedShift = dayEntries.find((e) => e.shiftHours !== null)?.shiftHours;
        const precomputedOt = dayEntries.find((e) => e.overtimeHours !== null)?.overtimeHours;

        const { workHours, otHours } = computeAttendanceHoursAndOt(
          inTime,
          outTime,
          activitySum,
          standardCap,
          isAllOvertime,
          precomputedShift !== undefined && precomputedShift !== null ? Number(precomputedShift) : null,
          precomputedOt !== undefined && precomputedOt !== null ? Number(precomputedOt) : null,
          isExternal
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
        dateTotals[dateKey].workHours = Math.round((dateTotals[dateKey].workHours + workHours) * 100) / 100;
        dateTotals[dateKey].otHours = Math.round((dateTotals[dateKey].otHours + otHours) * 100) / 100;
      }

      grandTotalDays += totalEmpDays;
      grandTotalWork += totalEmpWork;
      grandTotalOt += totalEmpOt;

      return {
        id: `dayot-${idx}`,
        employeeId: empId,
        employeeCode: empInfo?.employeeCode || '',
        callingName: empInfo?.callingName || '',
        employeeName: empInfo?.employeeName || '',
        tradeGroup: empInfo?.tradeGroup || '',
        businessPartner: empInfo?.businessPartner || '',
        employeeType: empInfo?.employeeType || '',
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
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const workerType = qStr(req.query.workerType) || 'labor';
    const employeeType = qStr(req.query.employeeType);
    const statusFilter = resolveStatusFilter(qStr(req.query.status));

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery, employeeType);

    const entries = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        status: statusFilter, 
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(empFilter ? { employee: empFilter } : {}),
      },
      include: {   
        employee: {
          include: {
            corporateEmployee: {
              include: {
                tradeGroup: true,
                corporateBusinessPartner: true,
              },
            },
            businessPartner: true,
            tradeGroup: true,
          },
        },
        appliedBusinessPartner: true,
        effectiveDayType: true,
      },
      orderBy: { date: 'asc' },
    });

    const calendarMap = await getProjectCalendarDayMap(projectId, dateFrom, dateTo);

    // Group by businessPartner -> employee
    type EmpData = {
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      tradeGroup: string;
      dailyHours: Record<string, number>;
      dailyRate: number;
      isEmployeeApproved: boolean;
      isPartnerApproved: boolean;
      isPayable: boolean;
      payrollStatus: string;
      lockReason: string | null;
    };
    const bpMap = new Map<string, Map<string, EmpData>>();

    for (const entry of entries) {
      const dateKey = entry.date.toISOString().split('T')[0];
      const effectiveBp = entry.appliedBusinessPartner || entry.employee.businessPartner;
      const bpName = effectiveBp?.name || 'Direct / Maga';
      const empId = entry.employeeId;
      // entry.shiftHours represents the actual effective worked hours (Gross - breaks + additional).
      const hours = Number(entry.shiftHours ?? entry.hours ?? 0);

      const isEmployeeActive = entry.employee.status === 'active' && entry.employee.corporateEmployee.status === 'active';
      const isPartnerActive = !effectiveBp || effectiveBp.status === 'active';
      const isPayable = isEmployeeActive && isPartnerActive;
      const payrollStatus = isPayable ? 'PAYABLE' : 'HOLD_PENDING_HO_APPROVAL';
      const lockReason = !isPayable
        ? (!isEmployeeActive && !isPartnerActive
            ? 'Both Employee and Business Partner pending Super Admin approval'
            : !isEmployeeActive
            ? 'Employee dossier pending Super Admin approval'
            : 'Business Partner pending Super Admin approval')
        : null;

      if (!bpMap.has(bpName)) bpMap.set(bpName, new Map());
      const empMap = bpMap.get(bpName)!;
 
      const effectiveDailyRate = (entry.appliedDailyRate !== null && Number(entry.appliedDailyRate) > 0)
        ? Number(entry.appliedDailyRate)
        : Number(entry.employee.dailyRate || 0);

      if (!empMap.has(empId)) {
        empMap.set(empId, {
          employeeId: empId,
          employeeCode: entry.employee.corporateEmployee.employeeCode || '',
          employeeName: entry.employee.corporateEmployee.fullName || entry.employee.callingName || '',
          tradeGroup: entry.employee.tradeGroup?.name || '',
          dailyHours: {},
          dailyRate: effectiveDailyRate,
          isEmployeeApproved: isEmployeeActive,
          isPartnerApproved: isPartnerActive,
          isPayable,
          payrollStatus,
          lockReason,
        });
      }
      const empData = empMap.get(empId)!;
      empData.dailyHours[dateKey] = (empData.dailyHours[dateKey] || 0) + hours;
    }

    // Also include operators if applicable
    if (workerType === 'operator') {
      const opEmployeeFilter = buildEmployeeFilter('operator', businessPartner, employeeQuery, employeeType);
      const opAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
        where: {
          dailySheet: {
            projectId,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
          ...(opEmployeeFilter ? { operator: opEmployeeFilter } : {}),
        },
        include: {
          dailySheet: { select: { date: true } },
          operator: {
            include: {
              corporateEmployee: true,
              businessPartner: true,
              tradeGroup: true,
            },
          },
          dailyLog: true,
        },
      });

      for (const op of opAssignments) {
        if (!op.operator) continue;
        const dateKey = op.dailySheet.date.toISOString().split('T')[0];
        const bpName = op.operator.businessPartner?.name || 'Direct / Maga';
        const empId = op.operator.id;
        const hours = Number(op.dailyLog?.workingHours || op.dailyLog?.netRunningHours || 8);

        const isEmployeeActive = op.operator.status === 'active' && op.operator.corporateEmployee.status === 'active';
        const isPartnerActive = !op.operator.businessPartner || op.operator.businessPartner.status === 'active';
        const isPayable = isEmployeeActive && isPartnerActive;
        const payrollStatus = isPayable ? 'PAYABLE' : 'HOLD_PENDING_HO_APPROVAL';
        const lockReason = !isPayable
          ? (!isEmployeeActive && !isPartnerActive
              ? 'Both Operator and Business Partner pending Super Admin approval'
              : !isEmployeeActive
              ? 'Operator dossier pending Super Admin approval'
              : 'Business Partner pending Super Admin approval')
          : null;

        if (!bpMap.has(bpName)) bpMap.set(bpName, new Map());
        const empMap = bpMap.get(bpName)!;

        if (!empMap.has(empId)) {
          empMap.set(empId, {
            employeeId: empId,
            employeeCode: op.operator.corporateEmployee.employeeCode || '',
            employeeName: op.operator.corporateEmployee.fullName || op.operator.callingName || '',
            tradeGroup: op.operator.tradeGroup?.name || 'Operator',
            dailyHours: {},
            dailyRate: Number(op.operator.dailyRate) > 0 ? Number(op.operator.dailyRate) : 1600,
            isEmployeeApproved: isEmployeeActive,
            isPartnerApproved: isPartnerActive,
            isPayable,
            payrollStatus,
            lockReason,
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
    let grandTotalPayablePayment = 0;
    let grandTotalLockedPayment = 0;
    let grandTotalLockedCount = 0;

    const groups = Array.from(bpMap.entries()).map(([bpName, empMap]) => {
      let subtotalHours = 0;
      let subtotalPayment = 0;
      let subtotalOverhead = 0;
      let subtotalCost = 0;
      let subtotalPayablePayment = 0;
      let subtotalLockedPayment = 0;
      let lockedCount = 0;

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

        if (emp.isPayable) {
          subtotalPayablePayment += totalCost;
        } else {
          subtotalLockedPayment += totalCost;
          lockedCount++;
        }

        return {
          id: `bp-${idx}`,
          employeeId: emp.employeeId,
          employeeCode: emp.employeeCode,
          employeeName: emp.employeeName,
          tradeGroup: emp.tradeGroup,
          dailyHours: emp.dailyHours,
          totalHours: Math.round(totalHours * 100) / 100,
          hourlyRate,
          totalHourlyPayment,
          overhead,
          totalCost,
          isPayable: emp.isPayable,
          payrollStatus: emp.payrollStatus,
          lockReason: emp.lockReason,
          isEmployeeApproved: emp.isEmployeeApproved,
          isPartnerApproved: emp.isPartnerApproved,
        };
      });

      grandTotalHours += subtotalHours;
      grandTotalPayment += subtotalPayment;
      grandTotalOverhead += subtotalOverhead;
      grandTotalCost += subtotalCost;
      grandTotalPayablePayment += subtotalPayablePayment;
      grandTotalLockedPayment += subtotalLockedPayment;
      grandTotalLockedCount += lockedCount;

      return {
        businessPartner: bpName,
        items,
        subtotalHours: Math.round(subtotalHours * 100) / 100,
        subtotalPayment: Math.round(subtotalPayment * 100) / 100,
        subtotalOverhead: Math.round(subtotalOverhead * 100) / 100,
        subtotalCost: Math.round(subtotalCost * 100) / 100,
        subtotalPayablePayment: Math.round(subtotalPayablePayment * 100) / 100,
        subtotalLockedPayment: Math.round(subtotalLockedPayment * 100) / 100,
        lockedCount,
      };
    });

    res.json({
      dates: allDates,
      groups,
      grandTotalHours: Math.round(grandTotalHours * 100) / 100,
      grandTotalPayment: Math.round(grandTotalPayment * 100) / 100,
      grandTotalOverhead: Math.round(grandTotalOverhead * 100) / 100,
      grandTotalCost: Math.round(grandTotalCost * 100) / 100,
      grandTotalPayablePayment: Math.round(grandTotalPayablePayment * 100) / 100,
      grandTotalLockedPayment: Math.round(grandTotalLockedPayment * 100) / 100,
      grandTotalLockedCount,
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

// ─── Helper: compute shift effective hours, activity sum, ZIDLE & OT for a day group ─
function computeErpDayMetrics(groupEntries: any[], calendarMap?: Map<string, DayTypeRuleInfo>) {
  const first = groupEntries[0];
  const dateKey = first.date.toISOString().split('T')[0];
  const dayRule = resolveDayTypeRule(dateKey, calendarMap, first?.effectiveDayType);

  const inTime = groupEntries.find((e) => e.inTime)?.inTime;
  const outTime = groupEntries.find((e) => e.outTime)?.outTime;
  let shiftEffectiveHours =
    Number(groupEntries.find((e) => e.shiftHours !== null && Number(e.shiftHours) > 0)?.shiftHours) || 0;

  const inH = parseTimeToHours(inTime);
  const outH = parseTimeToHours(outTime);

  if (shiftEffectiveHours === 0 && inH !== null && outH !== null) {
    let grossH = outH - inH;
    if (grossH < 0) grossH += 24;
    let breakH = Number(groupEntries.find((e) => e.breakHours !== null)?.breakHours) || 0;
    if (breakH === 0) {
      if (grossH >= 5.0) breakH += 1.0;
      const isPast11PM = outH >= inH ? outH >= 23.0 : inH <= 23.0 || outH >= 23.0;
      if (isPast11PM) breakH += 1.0;
    }
    shiftEffectiveHours = Math.max(0, Math.round((grossH - breakH) * 100) / 100);
  }

  let totalDayHours = 0;
  for (const entry of groupEntries) {
    if (entry.activitySplits && entry.activitySplits.length > 0) {
      for (const split of entry.activitySplits) {
        totalDayHours += Number(split.hours) || 0;
      }
    } else {
      totalDayHours += Number(entry.shiftHours ?? entry.hours) || 0;
    }
  }

  const idleHours =
    shiftEffectiveHours > 0 && totalDayHours < shiftEffectiveHours
      ? Math.round((shiftEffectiveHours - totalDayHours) * 100) / 100
      : 0;

  const effectiveForOt = shiftEffectiveHours > 0 ? shiftEffectiveHours : totalDayHours;
  const isExternal = Boolean(
    first.employee?.businessPartnerId ||
    isExternalEmployeeType(first.employee?.corporateEmployee?.employeeType)
  );

  let otHours = 0;

  // 1. ALL OVERTIME DAYS (Poya, Sunday, Public Holiday):
  // 100% of hours worked are Overtime without any baseline deduction!
  if (dayRule.isAllOvertime) {
    otHours = effectiveForOt;
  } else {
    // 2. NORMAL DAY OR SATURDAY:
    const storedOt = groupEntries.find(
      (e) => e.overtimeHours !== null && e.overtimeHours !== undefined
    )?.overtimeHours;

    // Use stored approved OT if valid for standard day, otherwise fallback to calculation
    if (storedOt !== null && storedOt !== undefined && !dayRule.isSaturday && !isExternal) {
      otHours = Number(storedOt);
    } else {
      if (effectiveForOt <= 0) {
        otHours = 0;
      } else if (isExternal) {
        const cap = dayRule.isSaturday ? 5.5 : 8.0;
        otHours = effectiveForOt > cap ? Math.round((effectiveForOt - cap) * 100) / 100 : 0;
      } else if (dayRule.isSaturday) {
        otHours = Math.round((effectiveForOt - 5.5) * 100) / 100;
      } else if (effectiveForOt > 6.0) {
        otHours = Math.round((effectiveForOt - 8.0) * 100) / 100;
      } else {
        otHours = Math.round((effectiveForOt - 4.0) * 100) / 100;
      }
    }
  }

  return { dateKey, dayRule, shiftEffectiveHours, totalDayHours, idleHours, otHours };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ERP UPLOAD EXPORT
// GET /api/reports/erp-upload?dateFrom=&dateTo=&employeeQuery=&activityCode=&employeeType=
// ─────────────────────────────────────────────────────────────────────────────
export const getErpUploadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const activityCode = qStr(req.query.activityCode);
    const businessPartner = qStr(req.query.businessPartner);
    const workerType = qStr(req.query.workerType) || 'labor';
    const employeeType = qStr(req.query.employeeType);

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery, employeeType);
    const normalizedActivityFilter = activityCode?.trim().toUpperCase();
    const isDynamicErpCode = normalizedActivityFilter === 'ZIDLE' || normalizedActivityFilter === 'OT';
    const activityFilter = isDynamicErpCode ? undefined : buildActivityCodeFilter(activityCode, 'equals');
    const matchesActivityFilter = (code: string): boolean =>
      !normalizedActivityFilter || code.trim().toUpperCase() === normalizedActivityFilter;

    const entries = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        status: 'approved',
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(activityFilter ?? {}),
        ...(empFilter ? { employee: empFilter } : {}),
      },
      include: {
        employee: {
          include: {
            corporateEmployee: true,
          },
        },
        effectiveDayType: true,
        activitySplits: {
          include: {
            activityCode: true,
          },
        },
      },
      orderBy: [{ date: 'asc' }, { employeeId: 'asc' }],
    });

    const calendarMap = await getProjectCalendarDayMap(projectId, dateFrom, dateTo);

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
      const empType = first.employee.corporateEmployee.employeeType || 'undefine';
      const { dateKey, dayRule, idleHours, otHours } = computeErpDayMetrics(groupEntries, calendarMap);
      const { standardCap, isAllOvertime, label } = dayRule;

      // Regular activity rows
      for (const entry of groupEntries) {
        if (entry.activitySplits && entry.activitySplits.length > 0) {
          for (const split of entry.activitySplits) {
            const splitHours = Number(split.hours) || 0;
            if (matchesActivityFilter(split.activityCode.code)) {
              finalRows.push({
                id: `erp-${rowIdx++}`,
                employeeId: entry.employee.corporateEmployee.employeeCode || entry.employeeId,
                employeeName: entry.employee.corporateEmployee.fullName || entry.employee.callingName || '',
                employeeType: empType,
                date: dateKey,
                activityCode: split.activityCode.code,
                activityDescription: split.activityCode.description || split.activityCode.code,
                hours: splitHours,
                overtimeHours: 0,
                remarks: entry.remarks || '',
              });
              totalHours += splitHours;
            }
          }
        }
      }

      // ── ZIDLE Balancing Row ────────────────────────────────────────────────
      if (idleHours > 0 && matchesActivityFilter('ZIDLE')) {
        finalRows.push({
          id: `erp-zidle-${first.employeeId}-${dateKey}`,
          employeeId: first.employee.corporateEmployee.employeeCode || first.employeeId,
          employeeName: first.employee.corporateEmployee.fullName || first.employee.callingName || '',
          employeeType: empType,
          date: dateKey,
          activityCode: 'ZIDLE',
          activityDescription: 'Idle / Unallocated Hours',
          hours: idleHours,
          overtimeHours: 0,
          remarks: 'Unallocated idle shift hours',
        });
        totalHours += idleHours;
      }

      if (otHours > 0 && matchesActivityFilter('OT')) {
        finalRows.push({
          id: `erp-ot-${first.employeeId}-${dateKey}`,
          employeeId: first.employee.corporateEmployee.employeeCode || first.employeeId,
          employeeName: first.employee.corporateEmployee.fullName || first.employee.callingName || '',
          employeeType: empType,
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
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const reportType = qStr(req.query.reportType);
    const workerType = qStr(req.query.workerType) || 'labor';
    const employeeType = qStr(req.query.employeeType);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);

    const partners = await prisma.mF_G_BusinessPartner.findMany({
      where: { status: 'active' },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });

    let formattedActivityCodes: Array<{ code: string; description: string }> = [];

    if (reportType === 'erp-upload' || (reportType !== 'equipment-erp-upload' && (dateFrom || dateTo))) {
      const dateFilter = buildDateFilter(dateFrom, dateTo);
      const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery, employeeType);

      const entries = await prisma.mF_OP_TimeEntry.findMany({
        where: {
          projectId,
          status: { in: ['submitted', 'approved'] },
          ...(dateFilter ? { date: dateFilter } : {}),
          ...(empFilter ? { employee: empFilter } : {}),
        },
        include: {
          activitySplits: {
            include: {
              activityCode: {
                select: { code: true, description: true },
              },
            },
          },
        },
      });

      const codeMap = new Map<string, { code: string; description: string }>();
      const groups = new Map<string, typeof entries>();

      for (const entry of entries) {
        const dateKey = entry.date.toISOString().split('T')[0];
        const key = `${entry.employeeId}___${dateKey}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(entry);

        if (entry.activitySplits && entry.activitySplits.length > 0) {
          for (const split of entry.activitySplits) {
            const rawCode = split.activityCode?.code;
            if (!rawCode) continue;
            const norm = rawCode.trim().toUpperCase();
            if (!codeMap.has(norm)) {
              codeMap.set(norm, {
                code: rawCode,
                description: split.activityCode.description || rawCode,
              });
            }
          }
        }
      }

      let hasZidle = false;
      let hasOt = false;
      for (const [, groupEntries] of groups) {
        const { idleHours, otHours } = computeErpDayMetrics(groupEntries);
        if (idleHours > 0) hasZidle = true;
        if (otHours > 0) hasOt = true;
        if (hasZidle && hasOt) break;
      }

      formattedActivityCodes = Array.from(codeMap.values()).sort((a, b) => a.code.localeCompare(b.code));
      if (hasZidle && !codeMap.has('ZIDLE')) {
        formattedActivityCodes.push({ code: 'ZIDLE', description: 'Idle / Unallocated Hours' });
      }
      if (hasOt && !codeMap.has('OT')) {
        formattedActivityCodes.push({ code: 'OT', description: 'Overtime Hours' });
      }
    } else {
      const activityCodes = await prisma.mF_P_ActivityCode.findMany({
        where: { projectId },
        select: { id: true, code: true, description: true },
        orderBy: { code: 'asc' },
      });
      formattedActivityCodes = activityCodes.map((a) => ({
        code: a.code,
        description: a.description || a.code,
      }));
    }

    res.json({
      businessPartners: partners.map((p) => p.name),
      businessPartnerDetails: partners.map((p) => ({ code: p.code, name: p.name })),
      activityCodes: formattedActivityCodes,
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
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const employeeQuery = qStr(req.query.employeeQuery);
    const businessPartner = qStr(req.query.businessPartner);
    const activityCode = qStr(req.query.activityCode);
    const workerType = qStr(req.query.workerType) || 'operator';
    const employeeType = qStr(req.query.employeeType);
    const statusFilter = resolveStatusFilter(qStr(req.query.status));

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empFilter = buildEmployeeFilter(workerType, businessPartner, employeeQuery, employeeType);
    const activityFilter = buildActivityCodeFilter(activityCode, 'contains');

    const entries = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        status: statusFilter,
        ...(dateFilter ? { date: dateFilter } : {}),
        ...(empFilter ? { employee: empFilter } : {}),
        ...(activityFilter ?? {}),
      },
      include: {
        employee: {
          include: {
            corporateEmployee: true,
            businessPartner: true,
          },
        },
        appliedBusinessPartner: true,
        effectiveDayType: true,
        recordedBy: { select: { id: true, fullName: true, username: true } },
        dailySheet: {
          include: {
            supervisor: { select: { id: true, fullName: true, username: true } },
          },
        },
        activitySplits: {
          include: {
            activityCode: { select: { id: true, code: true, description: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { employee: { callingName: 'asc' } }],
    });

    const calendarMap = await getProjectCalendarDayMap(projectId, dateFrom, dateTo);

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

      // Activities breakdown (support multi-activity splits)
      const activitiesMap = new Map<string, { code: string; description: string; hours: number }>();
      for (const e of groupEntries) {
        if (e.activitySplits && e.activitySplits.length > 0) {
          for (const s of e.activitySplits) {
            const code = s.activityCode?.code || '00-00-11-11-M';
            const desc = s.activityCode?.description || code;
            const h = Number(s.hours) || 0;
            if (h > 0) {
              const prev = activitiesMap.get(code) || { code, description: desc, hours: 0 };
              prev.hours += h;
              activitiesMap.set(code, prev);
            }
          }
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
        const inMins = inH * 60 + (inM || 0);
        const outMins = outH * 60 + (outM || 0);
        let diffMins = outMins - inMins;
        if (diffMins <= 0) diffMins += 24 * 60;
        if (diffMins >= 300) breakHours += 1.0;
        const isPast11PM = diffMins >= 720 || (
          (outMins >= inMins)
            ? (outMins >= 23 * 60)
            : (inMins <= 23 * 60 || outMins >= 23 * 60)
        );
        if (isPast11PM) breakHours += 1.0;
      }

      let totalDayHours = activities.reduce((sum, a) => sum + a.hours, 0) ||
        groupEntries.reduce((sum, e) => sum + (Number(e.shiftHours ?? e.hours) || 0), 0);

      if (totalDayHours === 0 && inTime !== '—' && outTime !== '—') {
        const [inH, inM] = inTime.split(':').map(Number);
        const [outH, outM] = outTime.split(':').map(Number);
        let diffMins = (outH * 60 + outM) - (inH * 60 + inM);
        if (diffMins <= 0) diffMins += 24 * 60;
        if (diffMins > 0) {
          const grossHours = Math.round((diffMins / 60) * 100) / 100;
          totalDayHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);
        }
      }

      const dayRule = resolveDayTypeRule(dateKey, calendarMap, first.effectiveDayType);
      const { standardCap, isAllOvertime } = dayRule;
      let workHours = 0;
      let otHours = 0;

      if (isAllOvertime) {
        workHours = 0;
        otHours = totalDayHours;
      } else {
        const explicitOt = groupEntries.reduce((s, e) => s + (Number(e.overtimeHours) || 0), 0);
        if (first.overtimeHours !== null && first.overtimeHours !== undefined) {
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

      const supervisorObj = first.dailySheet?.supervisor || first.recordedBy;
      const supervisorName = supervisorObj?.fullName ||
        (supervisorObj?.username ? `@${supervisorObj.username}` : 'Site Supervisor');

      let totalGrossHours = 0;
      if (inTime !== '—' && outTime !== '—') {
        const [inH, inM] = inTime.split(':').map(Number);
        const [outH, outM] = outTime.split(':').map(Number);
        let diffMins = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
        if (diffMins <= 0) diffMins += 24 * 60;
        totalGrossHours = Math.round((diffMins / 60) * 100) / 100;
      }

      items.push({
        id: `rc-${key}`,
        date: dateKey,
        supervisorName,
        employeeCode: first.employee.corporateEmployee.employeeCode || first.employeeId,
        callingName: first.employee.callingName || first.employee.corporateEmployee.fullName || '—',
        businessPartner: first.appliedBusinessPartner?.name || first.employee.businessPartner?.name || 'Direct',
        inTime,
        outTime,
        breakHours,
        totalGrossHours: totalGrossHours || undefined,
        workHours,
        otHours,
        totalHours,
        activities,
        activitiesDisplay,
      });
    }

    if (workerType === 'operator') {
      const opEmpFilter = buildEmployeeFilter('operator', businessPartner, employeeQuery, employeeType);
      const opAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
        where: {
          dailySheet: {
            projectId,
            ...(dateFilter ? { date: dateFilter } : {}),
          },
          ...(opEmpFilter ? { operator: opEmpFilter } : {}),
        },
        include: {
          dailySheet: {
            include: {
              supervisor: { select: { id: true, fullName: true, username: true } },
            },
          },
          operator: {
            include: {
              corporateEmployee: true,
              businessPartner: true,
            },
          },
          equipment: {
            include: {
              corporateEquipment: true,
            },
          },
          dailyLog: true,
        },
        orderBy: { dailySheet: { date: 'desc' } },
      });

      for (const op of opAssignments) {
        if (!op.operator) continue;
        const dateKey = op.dailySheet.date.toISOString().split('T')[0];
        const key = `${op.operatorId}___${dateKey}`;
        if (!grouped.has(key)) {
          const shiftH = Number(op.dailyLog?.workingHours || op.dailyLog?.netRunningHours || 8);
          const otH = 0;
          const totalH = shiftH + otH;
          grandWorkHours += shiftH;
          grandOtHours += otH;
          grandTotalHours += totalH;

          const eqCorp = op.equipment.corporateEquipment;

          items.push({
            id: `op-rc-${op.id}`,
            date: dateKey,
            supervisorName: op.dailySheet.supervisor?.fullName || (op.dailySheet.supervisor?.username ? `@${op.dailySheet.supervisor.username}` : 'Site Supervisor'),
            employeeCode: op.operator.corporateEmployee.employeeCode || op.operatorId || '—',
            callingName: op.operator.callingName || op.operator.corporateEmployee.fullName || '—',
            businessPartner: op.operator.businessPartner?.name || 'Direct / Maga',
            inTime: '—',
            outTime: '—',
            breakHours: 0,
            workHours: shiftH,
            otHours: otH,
            totalHours: totalH,
            activities: [],
            activitiesDisplay: eqCorp
              ? `Machine: ${eqCorp.standardEquipmentNumber || eqCorp.equipmentName} (${eqCorp.vehicleNo || 'Active'})`
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
// 7. OFFICIAL LABOUR & OPERATOR TIME CARD (Maga Engineering Format)
// ─────────────────────────────────────────────────────────────────────────────
export const getTimeCardReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const monthParam = qStr(req.query.month) || new Date().toISOString().slice(0, 7); // YYYY-MM
    const employeeId = qStr(req.query.employeeId);
    const workerType = qStr(req.query.workerType) || 'all'; // 'all' | 'labor' | 'operator'
    const employeeType = qStr(req.query.employeeType);
    const bpId = qStr(req.query.businessPartnerId);

    const [yearStr, monthNumStr] = monthParam.split('-');
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthNumStr, 10) - 1; // 0-based
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

    const startDate = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, monthIndex, daysInMonth, 23, 59, 59, 999));

    // 1. Fetch Project / Tenant details
    const project = await prisma.mF_P_Project.findUnique({
      where: { id: projectId },
      select: { projectName: true, subdomain: true, projectCode: true },
    });

    // 2. Fetch Calendar days for holiday / shutdown markings
    const calendarDays = await prisma.mF_P_CalendarDay.findMany({
      where: {
        projectId,
        date: { gte: startDate, lte: endDate },
      },
      include: { dayType: true },
    });
    const calendarMap = buildCalendarMapFromDays(calendarDays);
    const holidayDateMap = new Map<string, string>();
    for (const cd of calendarDays) {
      const dStr = cd.date.toISOString().slice(0, 10);
      const dtName = cd.dayType?.name?.toLowerCase() || '';
      if (dtName.includes('holiday') || dtName.includes('poya')) holidayDateMap.set(dStr, '*');
      else if (dtName.includes('shut')) holidayDateMap.set(dStr, '@');
    }

    // 3. Fetch Employees
    const empWhere: any = {
      projectId,
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
    const empTypeCond = buildEmployeeTypeWhere(employeeType);
    if (empTypeCond) {
      empWhere.corporateEmployee = empTypeCond;
    }

    const employees = await prisma.mF_P_Employee.findMany({
      where: empWhere,
      include: {
        corporateEmployee: true,
        businessPartner: true,
        tradeGroup: true,
      },
      orderBy: [
        { isOperator: 'asc' },
        { callingName: 'asc' },
      ],
    });

    // 4. Fetch Labor TimeEntries in range
    const timeEntries = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        status: {in: ['approved','submitted']},
        date: { gte: startDate, lte: endDate },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        equipment: {
          include: {
            corporateEquipment: true,
          },
        },
        appliedBusinessPartner: true,
        effectiveDayType: true,
      },
    });

    // 4.1 Fetch Operator Assignments in range
    const opAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          date: { gte: startDate, lte: endDate },
        },
        ...(employeeId ? { operatorId: employeeId } : {}),
      },
      include: {
        dailySheet: { select: { date: true } },
        equipment: {
          include: {
            corporateEquipment: true,
          },
        },
        dailyLog: true,
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

    for (const oa of opAssignments) {
      const dStr = oa.dailySheet.date.toISOString().slice(0, 10);
      const key = `${oa.operatorId}_${dStr}`;
      if (!entryMap.has(key)) {
        entryMap.set(key, []);
      }
      const hours = Number(oa.dailyLog?.workingHours || oa.dailyLog?.netRunningHours || 8);
      entryMap.get(key)!.push({
        inTime: null,
        outTime: null,
        hours,
        overtimeHours: 0,
        equipment: oa.equipment,
      });
    }

    // 5. Month display label (e.g. "Jul-26")
    const monthDateObj = new Date(year, monthIndex, 1);
    const monthShort = monthDateObj.toLocaleString('en-US', { month: 'short' });
    const yearShort = String(year).slice(-2);
    const monthLabel = `${monthShort}-${yearShort}`;

    // 6. Build TimeCards
    const timeCards = [];

    for (const emp of employees) {
      // Point-in-time rate and subcontractor snapshot lookup from month's time entries
      const snapEntry = timeEntries.find(
        (te) => te.employeeId === emp.id && te.appliedDailyRate !== null && Number(te.appliedDailyRate) > 0
      );
      const dailyRateVal = snapEntry
        ? Number(snapEntry.appliedDailyRate)
        : Number(emp.dailyRate || 0);
      const hourlyOtRate = Math.round((dailyRateVal / 8 * 1.5) * 100) / 100;

      const snapBpEntry = timeEntries.find(
        (te) => te.employeeId === emp.id && (te.appliedBusinessPartner || te.appliedBusinessPartnerId)
      );
      const effectiveBpName = snapBpEntry?.appliedBusinessPartner?.name || emp.businessPartner?.name || 'Direct';

      const days = [];
      let totalDays = 0;
      let totalOtHours = 0;
      let totalOtPay = 0;

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
          const eqCorp = first.equipment?.corporateEquipment;
          eqCode = eqCorp?.standardEquipmentNumber || eqCorp?.vehicleNo || null;

          // For multi-activity split rows (e.g. 6h Act A + 7h Act B = 13h):
          // Activity hours should be summed, but shiftHours and overtimeHours are daily attributes
          // and must NOT be multiplied/summed across splits, otherwise OT gets duplicated!
          const sumActivityHours = dayEntries.reduce((s, e) => s + (Number(e.shiftHours ?? e.hours) || 0), 0);
          const sumShiftHours = Number(first.shiftHours) > 0 ? Number(first.shiftHours) : sumActivityHours;
          const sumOtHours = Math.max(...dayEntries.map((e) => Number(e.overtimeHours) || 0));

          // Compute Days worked per logic document:
          // External workers: 0 Days (subcontractor labor is billed by hours, not payroll days).
          // Internal Saturday: Any attendance = 1.0 Day; Weekday > 6h = 1.0 Day; Weekday <= 6h = 0.5 Day; Sunday/Holiday = 0.0 Days
          const isExternalWorker = Boolean(emp.businessPartnerId || emp.corporateEmployee?.corporateBusinessPartnerId);
          const dayRule = resolveDayTypeRule(dateStr, calendarMap, first?.effectiveDayType);
          if (isExternalWorker) {
            dayWorked = 0;
          } else if (sumShiftHours <= 0 && sumOtHours === 0) {
            dayWorked = 0;
          } else if (dayRule.isAllOvertime) {
            dayWorked = 0;
          } else if (dayRule.isSaturday) {
            dayWorked = 1.0;
          } else if (sumShiftHours > 6.0) {
            dayWorked = 1.0;
          } else if (sumShiftHours > 0) {
            dayWorked = 0.5;
          }

          dayOt = Math.round(sumOtHours * 100) / 100;
          const dayOtRate = Math.round((dailyRateVal / 8 * dayRule.rateMultiplier) * 100) / 100;
          totalDays += dayWorked;
          totalOtHours += dayOt;
          totalOtPay += Math.round(dayOt * dayOtRate * 100) / 100;
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

      // If employee did not work any days in the month (totalDays <= 0), do NOT generate a Time Card!
      if (totalDays <= 0) {
        continue;
      }

      const basicPay = Math.round(totalDays * dailyRateVal * 100) / 100;
      const otPay = Math.round(totalOtPay * 100) / 100;
      const allowances = 0;
      const otherEarnings = 0;
      const grossPay = Math.round((basicPay + otPay + allowances + otherEarnings) * 100) / 100;
      
      const messAdvances = 0;
      const totalDeductions = messAdvances;
      const netPay = Math.round((grossPay - totalDeductions) * 100) / 100;

      const corp = emp.corporateEmployee;

      timeCards.push({
        employeeId: emp.id,
        employeeCode: corp.employeeCode || emp.id.slice(0, 6),
        callingName: emp.callingName || corp.fullName || '—',
        fullName: corp.fullName || emp.callingName,
        trade: emp.tradeGroup?.name || (emp.isOperator ? 'Operator' : 'General'),
        nicNo: corp.nicNo || '—',
        epfNo: corp.epfNo || '0',
        dailyRate: dailyRateVal,
        hourlyOtRate,
        isOperator: emp.isOperator,
        businessPartner: effectiveBpName,
        siteName: project?.projectName ? `${project.projectName}` : 'Main Project Site',
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
    const projectId = await resolveProjectId(req);

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
      prisma.mF_P_Employee.count({
        where: { projectId, isOperator: false, status: 'active' },
      }),
      prisma.mF_P_Employee.count({
        where: { projectId, isOperator: true, status: 'active' },
      }),
      prisma.mF_P_Equipment.count({
        where: { projectId, status: 'active' },
      }),
      prisma.mF_OP_TimeEntry.aggregate({
        where: {
          projectId,
          status: { in: ['submitted', 'approved'] },
          date: { gte: startOfMonth, lte: endOfMonth },
          employee: { isOperator: false },
        },
        _sum: { hours: true, shiftHours: true, overtimeHours: true },
      }),
      prisma.mF_OP_TimeEntry.aggregate({
        where: {
          projectId,
          status: { in: ['submitted', 'approved'] },
          date: { gte: startOfMonth, lte: endOfMonth },
          employee: { isOperator: true },
        },
        _sum: { hours: true, shiftHours: true, overtimeHours: true },
      }),
      prisma.mF_OP_DailyEquipmentAssignment.count({
        where: {
          dailySheet: {
            projectId,
            date: { gte: startOfMonth, lte: endOfMonth },
          },
        },
      }),
      prisma.mF_G_BusinessPartner.count({
        where: { status: 'active' },
      }),
    ]);

    const laborTotalHours = Number(laborHoursAgg._sum.shiftHours) || (Number(laborHoursAgg._sum.hours) || 0);
    const operatorTotalHours = Number(operatorHoursAgg._sum.shiftHours) || (Number(operatorHoursAgg._sum.hours) || 0);

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
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const equipmentQuery = qStr(req.query.equipmentQuery);
    const condition = qStr(req.query.condition);

    const dateFilter = buildDateFilter(dateFrom, dateTo);

    const assignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        ...(equipmentQuery
          ? {
              equipment: {
                OR: [
                  { corporateEquipment: { equipmentName: { contains: equipmentQuery, mode: 'insensitive' } } },
                  { corporateEquipment: { standardEquipmentNumber: { contains: equipmentQuery, mode: 'insensitive' } } },
                  { corporateEquipment: { vehicleNo: { contains: equipmentQuery, mode: 'insensitive' } } },
                ],
              },
            }
          : {}),
        ...(condition
          ? { equipment: { condition: { equals: condition, mode: 'insensitive' } } }
          : {}),
      },
      include: {
        dailySheet: {
          include: {
            supervisor: { select: { id: true, fullName: true, username: true } },
          },
        },
        equipment: {
          include: {
            corporateEquipment: true,
            ownerPartner: true,
            meterUnit: true,
          },
        },
        dailyLog: {
          include: {
            activities: true,
          },
        },
      },
      orderBy: [{ dailySheet: { date: 'desc' } }],
    });

    let totalWorkingHours = 0;
    let totalIdleHours = 0;
    let totalFuelLiters = 0;
    let totalNetHours = 0;

    const items = assignments.map((a) => {
      const log = a.dailyLog;
      let actSum = 0;
      if (Array.isArray(log?.activities) && log.activities.length > 0) {
        actSum = log.activities.reduce((s: number, act: any) => s + (Number(act.utilization) || 0), 0);
      }
      const workingH = Number(log?.workingHours) || actSum || Number(log?.totalUtilization) || 0;
      const idleH = Number(log?.idleHours) || 0;
      const breakdownH = Number(log?.breakdownHours) || 0;
      const netH = Number(log?.netRunningHours) || (workingH + idleH) || actSum || Number(log?.totalUtilization) || 0;
      const fuel = Number(log?.fuelLiters) || 0;

      totalWorkingHours += workingH;
      totalIdleHours += idleH;
      totalFuelLiters += fuel;
      totalNetHours += netH;

      const eqCorp = a.equipment.corporateEquipment;

      return {
        id: a.id,
        date: a.dailySheet.date.toISOString().split('T')[0],
        equipmentId: a.equipmentId,
        equipmentCode: eqCorp.standardEquipmentNumber || eqCorp.vehicleNo || '—',
        equipmentName: eqCorp.equipmentName,
        vehicleNo: eqCorp.vehicleNo || '—',
        magaNo: eqCorp.standardEquipmentNumber || '—',
        condition: a.equipment.condition || 'DRY',
        primaryUnit: a.equipment.meterUnitCode || eqCorp.unit || 'Hrs',
        supervisorName: a.dailySheet.supervisor?.fullName || a.dailySheet.supervisor?.username || 'Site Supervisor',
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
// 10. EQUIPMENT SUMMARY REPORT (EQUIPMENT ENTRY SHEET )
// GET /api/reports/equipment-summary?month=&dateFrom=&dateTo=&condition=&equipmentQuery=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getEquipmentSummaryReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const month = qStr(req.query.month);
    const equipmentQuery = qStr(req.query.equipmentQuery);
    const condition = qStr(req.query.condition);
    const projectNameParam = qStr(req.query.projectName) || qStr(req.query.projectCentre) || qStr(req.query.siteCode);
    const preparedByParam = qStr(req.query.preparedBy) || (req as any).user?.fullName;

    let from = dateFrom;
    let to = dateTo;
    if (month && (!from || !to)) {
      const [y, m] = month.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      from = `${month}-01`;
      to = `${month}-${String(lastDay).padStart(2, '0')}`;
    }

    const dateFilter = buildDateFilter(from, to);

    // Dynamic resolution of Project / Activity Centre and Prepared By
    let dynamicProjectCentre = projectNameParam;
    let dynamicPreparedBy = preparedByParam;

    if (!dynamicProjectCentre || !dynamicPreparedBy) {
      const sampleSheet = await prisma.mF_OP_DailySheet.findFirst({
        where: {
          projectId,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        include: { supervisor: { select: { fullName: true } } },
        orderBy: { date: 'desc' },
      });

      if (!dynamicProjectCentre && sampleSheet?.siteCode) {
        dynamicProjectCentre = `${sampleSheet.siteCode} - Project Operations`;
      }
      if (!dynamicPreparedBy && sampleSheet?.supervisor?.fullName) {
        dynamicPreparedBy = sampleSheet.supervisor.fullName;
      }
    }

    // 1. Fetch all active equipment
    const equipmentList = await prisma.mF_P_Equipment.findMany({
      where: {
        projectId,
        status: 'active',
        ...(equipmentQuery
          ? {
              OR: [
                { corporateEquipment: { equipmentName: { contains: equipmentQuery, mode: 'insensitive' } } },
                { corporateEquipment: { standardEquipmentNumber: { contains: equipmentQuery, mode: 'insensitive' } } },
                { corporateEquipment: { vehicleNo: { contains: equipmentQuery, mode: 'insensitive' } } },
              ],
            }
          : {}),
        ...(condition
          ? { condition: { equals: condition, mode: 'insensitive' } }
          : {}),
      },
      include: {
        corporateEquipment: true,
        ownerPartner: true,
        meterUnit: true,
        dailyAssignments: {
          where: dateFilter ? { dailySheet: { date: dateFilter } } : undefined,
          include: {
            dailyLog: {
              include: { activities: true },
            },
          },
        },
      },
      orderBy: [{ corporateEquipment: { standardEquipmentNumber: 'asc' } }],
    });

    // Smart formatter: preserves up to 5 decimals when fractional precision > 2 decimals (e.g. 0.03333),
    // while keeping standard 2-decimal formatting (e.g. 1.00, 0.04) for cleaner sheets
    const formatEquipmentUtil = (val: number): string => {
      const rounded = Math.round(val * 100000) / 100000;
      const twoDec = Math.round(rounded * 100) / 100;
      if (Math.abs(rounded - twoDec) > 0.000001) {
        return Number(rounded.toFixed(5)).toString();
      }
      return rounded.toFixed(2);
    };

    const allRows = equipmentList.map((eq) => {
      const logs = eq.dailyAssignments.map((a) => a.dailyLog).filter(Boolean);
      const primaryUnit = (eq.meterUnitCode || eq.corporateEquipment.unit || 'hrs').toLowerCase();
      
      let totalUtilization = 0;
      let totalMileage = 0;

      // Direct utilization sum from activity splits (Source of Truth), fallback to log totalUtilization (never fake 1)
      const sumDirectLogUtil = (l: any): number => {
        if (Array.isArray(l?.activities) && l.activities.length > 0) {
          return l.activities.reduce((s: number, a: any) => s + (Number(a.utilization) || 0), 0);
        }
        return Number(l?.totalUtilization) || 0;
      };

      if (primaryUnit === 'mth' || primaryUnit === 'day' || primaryUnit === 'days') {
        totalUtilization = logs.reduce((sum: number, l: any) => sum + sumDirectLogUtil(l), 0);
      } else if (primaryUnit === 'km') {
        totalMileage = logs.reduce((sum: number, l: any) => {
          const direct = sumDirectLogUtil(l);
          return sum + (direct > 0 ? direct : (Number(l?.totalMileage) || 0));
        }, 0);
        totalUtilization = totalMileage;
      } else {
        totalUtilization = logs.reduce((sum: number, l: any) => {
          const direct = sumDirectLogUtil(l);
          if (direct > 0) return sum + direct;
          const net = Number(l?.netRunningHours) ||
                      (Number(l?.workingHours) || 0) + (Number(l?.idleHours) || 0) ||
                      0;
          return sum + net;
        }, 0);
      }

      totalUtilization = Math.round(totalUtilization * 100000) / 100000;
      totalMileage = Math.round(totalMileage * 100000) / 100000;

      const minUtil = eq.corporateEquipment.dailyRate ? Number(eq.corporateEquipment.dailyRate) : null;
      const vehicleOrMaga = eq.corporateEquipment.standardEquipmentNumber || eq.corporateEquipment.vehicleNo || '—';

      return {
        id: eq.id,
        vehicleOrMagaNo: vehicleOrMaga,
        equipmentName: eq.corporateEquipment.equipmentName || '',
        businessPartner: eq.ownerPartner?.name || '—',
        condition: eq.condition || 'DRY',
        unit: primaryUnit,
        minUtilization: minUtil !== null ? minUtil.toFixed(2) : '—',
        totalUtilization: totalUtilization > 0 ? formatEquipmentUtil(totalUtilization) : '—',
        totalMileage: totalMileage > 0 ? formatEquipmentUtil(totalMileage) : '—',
        numericUtilization: totalUtilization,
        numericMileage: totalMileage,
      };
    });

    // 1. FILTER: Exclude equipment with zero utilization (only active deployed equipment)
    const activeRows = allRows.filter((r) => r.numericUtilization > 0 || r.numericMileage > 0);

    let grandTotalUtilization = 0;
    let grandTotalMileage = 0;

    const rows = activeRows.map(({ numericUtilization, numericMileage, ...rest }) => {
      grandTotalUtilization += numericUtilization;
      grandTotalMileage += numericMileage;
      return rest;
    });

    const project = await prisma.mF_P_Project.findUnique({
      where: { id: projectId },
      select: { 
        projectName: true, 
        subdomain: true,
        addressLine1: true,
        addressLine2: true,
        phone: true,
        fax: true,
        email: true,
      },
    });

    const dynamicAddress = [project?.addressLine1, project?.addressLine2].filter(Boolean).join(', ')
      || '200, Nawala Road, Narahenpita, Colombo 05, Sri Lanka';
    const dynamicPhone = project?.phone || '2808835-44';
    const dynamicFax = project?.fax || '2808846-48';
    const dynamicEmail = project?.email || 'maga@maga.lk';

    // Format period text
    let periodText = '';
    if (from && to) {
      periodText = from === to ? from : `${from} to ${to}`;
    } else if (to || from) {
      periodText = to || from || '';
    } else {
      periodText = new Date().toISOString().split('T')[0];
    }

    const monthPart = (from || to || new Date().toISOString().split('T')[0]).slice(0, 7).replace('-', '');
    const sheetNo = `EES-${monthPart}`;

    res.json({
      sheetTitle: 'EQUIPMENT ENTRY SHEET',
      companyName: project?.projectName || 'Mäga Engineering (Pvt) Ltd',
      address: dynamicAddress,
      phone: dynamicPhone,
      fax: dynamicFax,
      email: dynamicEmail,
      date: to || from || new Date().toISOString().split('T')[0],
      dateFrom: from,
      dateTo: to,
      periodText,
      sheetNo,
      preparedBy: dynamicPreparedBy || 'Site Supervisor / Plant Eng.',
      projectCentre: dynamicProjectCentre || (project?.projectName ? `${project.projectName} Central Project Operations` : 'Maga Central Project Operations'),
      totalRecords: rows.length,
      rows,
      totals: {
        totalUtilization: Number(grandTotalUtilization.toFixed(2)),
        totalMileage: Number(grandTotalMileage.toFixed(2)),
      },
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
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const month = qStr(req.query.month);
    const condition = qStr(req.query.condition);
    const activityCodeParam = qStr(req.query.activityCode);
    const defaultActivityCode = activityCodeParam || 'ZOTHE';

    let from = dateFrom;
    let to = dateTo;
    let uploadDateFormatted = '31-10-2026';

    if (month && (!from || !to)) {
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

    // Fetch daily equipment assignments in the specified date range
    const assignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        equipment: {
          projectId,
          status: 'active',
          ...(condition
            ? { condition: { equals: condition, mode: 'insensitive' } }
            : {}),
        },
      },
      include: {
        dailySheet: {
          select: { date: true, status: true },
        },
        equipment: {
          include: {
            corporateEquipment: true,
            meterUnit: true,
          },
        },
        dailyLog: {
          include: {
            activities: {
              include: {
                activityCode: true,
              },
            },
          },
        },
      },
      orderBy: [
        { dailySheet: { date: 'asc' } },
      ],
    });

    let rows: Array<{
      equipment: string;
      condition: string;
      unit: string;
      date: string;
      activity: string;
      utilization: string;
    }> = [];

    assignments.forEach((assignment) => {
      const l = assignment.dailyLog;
      if (!l) return;

      const eq = assignment.equipment;
      const primaryUnit = (l.unitCode || eq.meterUnitCode || eq.corporateEquipment?.unit || 'hrs').toLowerCase();
      const erpCode = eq.corporateEquipment?.standardEquipmentNumber || eq.corporateEquipment?.vehicleNo || 'EQUIP';
      const eqCondition = (eq.condition || 'DRY').toUpperCase();

      // Format date to DD-MM-YYYY (matching exact transaction day)
      const dObj = assignment.dailySheet.date;
      const dStr = dObj instanceof Date ? dObj.toISOString().slice(0, 10) : String(dObj).slice(0, 10);
      const [yyyy, mm, dd] = dStr.split('-');
      const formattedDate = `${dd}-${mm}-${yyyy}`;

      // Exact 1-to-1 output of saved activity splits (all units: hrs, day, mth, km — up to 5 decimals)
      const formatErpUtil = (val: number): string => {
        const rounded = Math.round(val * 100000) / 100000;
        const twoDec = Math.round(rounded * 100) / 100;
        if (Math.abs(rounded - twoDec) > 0.000001) {
          return Number(rounded.toFixed(5)).toString();
        }
        return rounded.toFixed(2);
      };

      let addedAnyActivity = false;

      if (l.activities && l.activities.length > 0) {
        l.activities.forEach((act) => {
          const code = act.activityCode?.code || defaultActivityCode;
          const q = Number(act.utilization) || Number(act.hours) || 0;
          if (q > 0) {
            addedAnyActivity = true;
            rows.push({
              equipment: erpCode,
              condition: eqCondition,
              unit: primaryUnit,
              date: formattedDate,
              activity: code,
              utilization: formatErpUtil(q),
            });
          }
        });
      }

      if (!addedAnyActivity) {
        let q = 0;
        if (primaryUnit === 'km') {
          q = Number(l.totalMileage) || 0;
        } else if (primaryUnit === 'mth' || primaryUnit === 'day' || primaryUnit === 'days') {
          q = Number(l.totalUtilization) || 0;
        } else {
          q = Number(l.workingHours) || Number(l.netRunningHours) || Number(l.totalUtilization) || 0;
        }

        if (q > 0) {
          rows.push({
            equipment: erpCode,
            condition: eqCondition,
            unit: primaryUnit,
            date: formattedDate,
            activity: defaultActivityCode,
            utilization: formatErpUtil(q),
          });
        }
      }
    });
    // If an activity code filter was supplied, filter matching rows
    if (activityCodeParam) {
      rows = rows.filter((r) => r.activity.toLowerCase() === activityCodeParam.toLowerCase());
    }

    // Sort rows: Date ascending (chronological), then Equipment code ascending, then Activity ascending
    rows.sort((a, b) => {
      const [d1, m1, y1] = a.date.split('-');
      const [d2, m2, y2] = b.date.split('-');
      const t1 = new Date(`${y1}-${m1}-${d1}`).getTime();
      const t2 = new Date(`${y2}-${m2}-${d2}`).getTime();
      if (t1 !== t2) return t1 - t2;
      const eqCmp = a.equipment.localeCompare(b.equipment);
      if (eqCmp !== 0) return eqCmp;
      return a.activity.localeCompare(b.activity);
    });

    res.json({
      date: uploadDateFormatted,
      activityCode: defaultActivityCode,
      totalRows: rows.length,
      rows,
    });
  } catch (error) {
    console.error('Error generating equipment ERP upload report:', error);
    res.status(500).json({ error: 'Failed to generate equipment ERP upload report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 12. OPERATOR ERP UPLOAD EXPORT 
// GET /api/reports/operator-erp-upload?month=&dateFrom=&dateTo=&businessPartner=&employeeQuery=&tenantId=
// ─────────────────────────────────────────────────────────────────────────────
export const getOperatorErpUploadReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const month = qStr(req.query.month);
    const businessPartner = qStr(req.query.businessPartner);
    const employeeQuery = qStr(req.query.employeeQuery);
    const employeeType = qStr(req.query.employeeType);

    let from = dateFrom;
    let to = dateTo;

    if (month && (!from || !to)) {
      const [y, m] = month.split('-');
      const lastDay = new Date(parseInt(y, 10), parseInt(m, 10), 0).getDate();
      from = `${month}-01`;
      to = `${month}-${String(lastDay).padStart(2, '0')}`;
    }

    const dateFilter = buildDateFilter(from, to);
    const opEmpFilter = buildEmployeeFilter('operator', businessPartner, employeeQuery, employeeType)!;
    const statusFilter = resolveStatusFilter(qStr(req.query.status));

    // 1. Fetch all Operator Time Entries (which contain granular machine splits)
    const operatorTimeEntries = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        status: statusFilter,
        employee: opEmpFilter,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      include: {
        employee: {
          include: {
            corporateEmployee: true,
            businessPartner: true,
          },
        },
        equipment: {
          include: {
            corporateEquipment: true,
          },
        },
        equipmentSplits: {
          include: {
            equipment: {
              include: {
                corporateEquipment: true,
              },
            },
          },
        },
      },
      orderBy: [{ date: 'asc' }, { employee: { callingName: 'asc' } }],
    });

    // 2. Also fetch Daily Equipment Assignments in range (for machines assigned to operators)
    const opAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          status: statusFilter,
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        operator: opEmpFilter,
      },
      include: {
        dailySheet: { select: { date: true } },
        operator: {
          include: {
            corporateEmployee: true,
            businessPartner: true,
          },
        },
        equipment: {
          include: {
            corporateEquipment: true,
          },
        },
        dailyLog: true,
      },
      orderBy: { dailySheet: { date: 'asc' } },
    });

    // Group by operatorId + dateStr
    type OpDateKey = string;
    interface OpDayData {
      operatorId: string;
      employeeCode: string;
      callingName: string;
      fullName: string;
      dateFormatted: string; // DD-MM-YYYY
      overtimeHours: number;
      machines: Map<string, {
        equipmentCode: string;
        condition: string;
        unit: string;
        hours: number;
        remarks: string;
      }>;
    }

    const opDayMap = new Map<OpDateKey, OpDayData>();

    const getOrCreateOpDay = (op: any, dObj: Date): OpDayData => {
      const dStr = dObj.toISOString().slice(0, 10);
      const [y, m, d] = dStr.split('-');
      const dateFormatted = `${d}-${m}-${y}`; // DD-MM-YYYY format
      const key: OpDateKey = `${op.id}___${dStr}`;

      if (!opDayMap.has(key)) {
        opDayMap.set(key, {
          operatorId: op.id,
          employeeCode: op.corporateEmployee?.employeeCode || op.callingName || 'OPERATOR',
          callingName: op.callingName || op.corporateEmployee?.fullName || '',
          fullName: op.corporateEmployee?.fullName || op.callingName || '',
          dateFormatted,
          overtimeHours: 0,
          machines: new Map(),
        });
      }
      return opDayMap.get(key)!;
    };

    // Pre-fetch equipment in project to resolve split equipment IDs and codes
    const allProjectEquipment = await prisma.mF_P_Equipment.findMany({
      where: { projectId },
      include: { corporateEquipment: true },
    });
    const eqMap = new Map<string, typeof allProjectEquipment[0]>();
    for (const eq of allProjectEquipment) {
      eqMap.set(eq.id, eq);
      const code = eq.corporateEquipment?.standardEquipmentNumber || eq.corporateEquipment?.vehicleNo;
      if (code) eqMap.set(code, eq);
    }

    // Helper to parse multi-machine splits from remarks (e.g. "Splits: 241e...: 8h, 4006...: 5h")
    const parseSplitsFromRemarks = (remarks?: string | null): Array<{ equipmentRef: string; hours: number }> => {
      if (!remarks) return [];
      const match = remarks.match(/Splits:\s*([^|]+)/i);
      if (!match) return [];
      const splitsStr = match[1].trim();
      const items = splitsStr.split(",");
      const result: Array<{ equipmentRef: string; hours: number }> = [];
      for (const item of items) {
        const parts = item.trim().split(":");
        if (parts.length === 2) {
          const ref = parts[0].trim();
          const hrsStr = parts[1].replace(/[^0-9.]/g, "").trim();
          const hrs = parseFloat(hrsStr);
          if (ref && !isNaN(hrs) && hrs > 0) {
            result.push({ equipmentRef: ref, hours: hrs });
          }
        }
      }
      return result;
    };

    // Populate from Time Entries
    for (const te of operatorTimeEntries) {
      if (!te.employee) continue;
      const dayData = getOrCreateOpDay(te.employee, te.date);
      const otH = Number(te.overtimeHours) || 0;
      if (otH > dayData.overtimeHours) {
        dayData.overtimeHours = otH;
      }

      // Check if real equipment splits exist in the database
      if (te.equipmentSplits && te.equipmentSplits.length > 0) {
        for (const split of te.equipmentSplits) {
          const eq = split.equipment || eqMap.get(split.equipmentId) || (te.equipmentId === split.equipmentId ? te.equipment : undefined);
          const eqCode = eq?.corporateEquipment?.standardEquipmentNumber || eq?.corporateEquipment?.vehicleNo || "EQUIP";
          const cond = (eq?.condition || te.equipment?.condition || "DRY").toUpperCase();
          const unit = (eq?.meterUnitCode || eq?.corporateEquipment?.unit || te.equipment?.meterUnitCode || "hrs").toLowerCase();
          const h = Number(split.hours) || 0;

          if (dayData.machines.has(eqCode)) {
            dayData.machines.get(eqCode)!.hours += h;
          } else {
            dayData.machines.set(eqCode, {
              equipmentCode: eqCode,
              condition: cond,
              unit,
              hours: h,
              remarks: te.remarks || "",
            });
          }
        }
      } else {
        // Fallback: Check if this entry contains multi-machine splits in remarks
        const parsedSplits = parseSplitsFromRemarks(te.remarks);
        if (parsedSplits.length > 0) {
          for (const split of parsedSplits) {
            const eq = eqMap.get(split.equipmentRef) || (te.equipmentId === split.equipmentRef ? te.equipment : undefined);
            const eqCode = eq?.corporateEquipment?.standardEquipmentNumber || eq?.corporateEquipment?.vehicleNo || split.equipmentRef;
            const cond = (eq?.condition || te.equipment?.condition || "DRY").toUpperCase();
            const unit = (eq?.meterUnitCode || eq?.corporateEquipment?.unit || te.equipment?.meterUnitCode || "hrs").toLowerCase();
            const h = split.hours;

            if (dayData.machines.has(eqCode)) {
              dayData.machines.get(eqCode)!.hours += h;
            } else {
              dayData.machines.set(eqCode, {
                equipmentCode: eqCode,
                condition: cond,
                unit,
                hours: h,
                remarks: "",
              });
            }
          }
        } else if (te.equipment) {
          const eqCode = te.equipment.corporateEquipment?.standardEquipmentNumber || te.equipment.corporateEquipment?.vehicleNo || "EQUIP";
          const cond = (te.equipment.condition || "DRY").toUpperCase();
          const unit = (te.equipment.meterUnitCode || te.equipment.corporateEquipment?.unit || "hrs").toLowerCase();
          const h = Number(te.shiftHours || te.hours) || 0;

          if (dayData.machines.has(eqCode)) {
            dayData.machines.get(eqCode)!.hours += h;
          } else {
            dayData.machines.set(eqCode, {
              equipmentCode: eqCode,
              condition: cond,
              unit,
              hours: h,
              remarks: te.remarks || "",
            });
          }
        }
      }
    }

    // Complement from Daily Equipment Assignments
    for (const oa of opAssignments) {
      if (!oa.operator || !oa.equipment) continue;
      const dayData = getOrCreateOpDay(oa.operator, oa.dailySheet.date);

      const parsedSplits = parseSplitsFromRemarks(oa.dailyLog?.remarks);
      if (parsedSplits.length > 0) {
        for (const split of parsedSplits) {
          const eq = eqMap.get(split.equipmentRef) || (oa.equipmentId === split.equipmentRef ? oa.equipment : undefined);
          const eqCode = eq?.corporateEquipment?.standardEquipmentNumber || eq?.corporateEquipment?.vehicleNo || split.equipmentRef;
          const cond = (eq?.condition || oa.equipment.condition || "DRY").toUpperCase();
          const unit = (eq?.meterUnitCode || eq?.corporateEquipment?.unit || oa.equipment.meterUnitCode || "hrs").toLowerCase();
          const h = split.hours;

          if (dayData.machines.has(eqCode)) {
            dayData.machines.get(eqCode)!.hours = Math.max(dayData.machines.get(eqCode)!.hours, h);
          } else {
            dayData.machines.set(eqCode, {
              equipmentCode: eqCode,
              condition: cond,
              unit,
              hours: h,
              remarks: "",
            });
          }
        }
      } else {
        const eqCode = oa.equipment.corporateEquipment?.standardEquipmentNumber || oa.equipment.corporateEquipment?.vehicleNo || "EQUIP";
        if (!dayData.machines.has(eqCode)) {
          const cond = (oa.equipment.condition || "DRY").toUpperCase();
          const unit = (oa.equipment.meterUnitCode || oa.equipment.corporateEquipment?.unit || "hrs").toLowerCase();
          const h = Number(oa.dailyLog?.workingHours || oa.dailyLog?.netRunningHours || 0);

          if (h > 0) {
            dayData.machines.set(eqCode, {
              equipmentCode: eqCode,
              condition: cond,
              unit,
              hours: h,
              remarks: oa.dailyLog?.remarks || "",
            });
          }
        }
      }
    }

    // Build flat ERP rows exactly matching Maga SAP format
    const rows: Array<{
      id: string;
      employee: string;
      employeeName: string;
      date: string;
      equipment: string;
      condition: string;
      unit: string;
      hours: string;
      overtimeHours: string;
      remarks: string;
      isOtRow?: boolean;
    }> = [];

    let totalRegularHours = 0;
    let totalOtHours = 0;
    let rowIdx = 0;

    for (const dayData of opDayMap.values()) {
      // 1. Regular Equipment Rows
      for (const m of dayData.machines.values()) {
        if (m.hours <= 0) continue;
        totalRegularHours += m.hours;
        rows.push({
          id: `op-erp-${rowIdx++}`,
          employee: dayData.employeeCode,
          employeeName: dayData.fullName,
          date: dayData.dateFormatted,
          equipment: m.equipmentCode,
          condition: m.condition,
          unit: m.unit,
          hours: m.hours.toFixed(2),
          overtimeHours: '',
          remarks: m.remarks,
          isOtRow: false,
        });
      }

      // 2. Dedicated OT Row
      if (dayData.overtimeHours > 0) {
        totalOtHours += dayData.overtimeHours;
        rows.push({
          id: `op-erp-ot-${rowIdx++}`,
          employee: dayData.employeeCode,
          employeeName: dayData.fullName,
          date: dayData.dateFormatted,
          equipment: 'OT',
          condition: '',
          unit: '',
          hours: '',
          overtimeHours: Number.isInteger(dayData.overtimeHours)
            ? String(dayData.overtimeHours)
            : dayData.overtimeHours.toFixed(2),
          remarks: '',
          isOtRow: true,
        });
      }
    }

    res.json({
      dateFrom: from,
      dateTo: to,
      month,
      totalRows: rows.length,
      totalHours: Number(totalRegularHours.toFixed(2)),
      totalOtHours: Number(totalOtHours.toFixed(2)),
      rows,
    });
  } catch (error) {
    console.error('Error generating operator ERP upload report:', error);
    res.status(500).json({ error: 'Failed to generate operator ERP upload report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/reports/subcontractor-deduction?dateFrom=&dateTo=&businessPartner=
// Accountant report: company/supply manpower hours & cost lent to Subcontractors
// ─────────────────────────────────────────────────────────────────────────────
export const getSubcontractorDeductionReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const businessPartner = qStr(req.query.businessPartner);
    const employeeQuery = qStr(req.query.employeeQuery);
    const employeeType = qStr(req.query.employeeType);
    const activityCode = qStr(req.query.activityCode);
    const statusFilter = resolveStatusFilter(qStr(req.query.status));

    const dateFilter = buildDateFilter(dateFrom, dateTo);
    const empTypeFilter = buildEmployeeTypeWhere(employeeType);

    const timeEntryWhere: Record<string, any> = {
      projectId,
      status: statusFilter,
      ...(dateFilter ? { date: dateFilter } : {}),
    };

    if (empTypeFilter || employeeQuery) {
      timeEntryWhere.employee = {
        ...(empTypeFilter || {}),
        ...(employeeQuery
          ? {
              OR: [
                { callingName: { contains: employeeQuery, mode: 'insensitive' } },
                { corporateEmployee: { fullName: { contains: employeeQuery, mode: 'insensitive' } } },
                { corporateEmployee: { employeeCode: { contains: employeeQuery, mode: 'insensitive' } } },
              ],
            }
          : {}),
      };
    }

    const splitWhere: Record<string, any> = {
      chargedBusinessPartnerId: { not: null },
      timeEntry: timeEntryWhere,
    };

    if (businessPartner && businessPartner !== 'all') {
      splitWhere.chargedBusinessPartner = {
        OR: [
          { id: businessPartner },
          { name: { contains: businessPartner, mode: 'insensitive' } },
          { code: { contains: businessPartner, mode: 'insensitive' } },
        ],
      };
    }

    if (activityCode && activityCode !== 'all') {
      splitWhere.activityCode = {
        OR: [
          { id: activityCode },
          { code: { contains: activityCode, mode: 'insensitive' } },
        ],
      };
    }

    const splits = await prisma.mF_OP_LaborActivitySplit.findMany({
      where: splitWhere,
      include: {
        chargedBusinessPartner: {
          select: { id: true, code: true, name: true },
        },
        activityCode: {
          select: { id: true, code: true, description: true },
        },
        timeEntry: {
          include: {
            effectiveDayType: true,
            activitySplits: { select: { hours: true } },
            employee: {
              include: {
                corporateEmployee: {
                  select: { employeeCode: true, fullName: true, employeeType: true },
                },
                tradeGroup: { select: { name: true } },
                businessPartner: { select: { id: true, name: true, code: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { timeEntry: { date: 'asc' } },
        { createdAt: 'asc' },
      ],
    });

    const calendarMap = await getProjectCalendarDayMap(projectId, dateFrom, dateTo);
    const round2 = (v: number) => Math.round(v * 100) / 100;

    type DeductionItem = {
      id: string;
      date: string;
      employeeId: string;
      employeeCode: string;
      employeeName: string;
      employeeType: string;
      sourcePartnerCode: string;
      sourcePartner: string;
      tradeGroup: string;
      inTime: string;
      outTime: string;
      activityCode: string;
      activityDescription: string;
      splitHours: number;
      normalHours: number;
      otHours: number;
      dailyRate: number;
      hourlyRate: number;
      hourlyOtRate: number;
      normalAmount: number;
      otAmount: number;
      deductionAmount: number;
    };

    type SubGroup = {
      subcontractorId: string;
      subcontractorCode: string;
      subcontractorName: string;
      employeeIds: Set<string>;
      totalSplitHours: number;
      totalNormalHours: number;
      totalOtHours: number;
      totalDeductionAmount: number;
      items: DeductionItem[];
    };

    const groupMap = new Map<string, SubGroup>();

    for (const sp of splits) {
      if (!sp.chargedBusinessPartner) continue;
      const te = sp.timeEntry;
      const emp = te.employee;
      const subId = sp.chargedBusinessPartner.id;

      if (!groupMap.has(subId)) {
        groupMap.set(subId, {
          subcontractorId: subId,
          subcontractorCode: sp.chargedBusinessPartner.code,
          subcontractorName: sp.chargedBusinessPartner.name,
          employeeIds: new Set<string>(),
          totalSplitHours: 0,
          totalNormalHours: 0,
          totalOtHours: 0,
          totalDeductionAmount: 0,
          items: [],
        });
      }

      const grp = groupMap.get(subId)!;
      grp.employeeIds.add(emp.id);

      const splitHours = Number(sp.hours || 0);
      const totalDaySplitHours = te.activitySplits.reduce((sum, s) => sum + Number(s.hours || 0), 0);
      const dayShiftHours = Number(te.shiftHours ?? te.hours ?? totalDaySplitHours);
      const denom = totalDaySplitHours > 0 ? totalDaySplitHours : dayShiftHours;
      const proportion = denom > 0 ? Math.min(1, splitHours / denom) : 1;

      const dayOtHours = Math.max(0, Number(te.overtimeHours || 0));
      const dayNormalHours = Math.max(0, dayShiftHours - dayOtHours);

      const normalHours = round2(dayNormalHours * proportion);
      const otHours = round2(dayOtHours * proportion);

      const dateKey = te.date.toISOString().split('T')[0];
      const dayRule = resolveDayTypeRule(dateKey, calendarMap, te.effectiveDayType);

      const dailyRate =
        te.appliedDailyRate !== null && Number(te.appliedDailyRate) > 0
          ? Number(te.appliedDailyRate)
          : Number(emp.dailyRate || 0);

      const hourlyRate = round2(dailyRate / 8);
      const hourlyOtRate = round2((dailyRate / 8) * dayRule.rateMultiplier);
      const normalAmount = round2(normalHours * hourlyRate);
      const otAmount = round2(otHours * hourlyOtRate);
      const deductionAmount = round2(normalAmount + otAmount);

      grp.totalSplitHours = round2(grp.totalSplitHours + splitHours);
      grp.totalNormalHours = round2(grp.totalNormalHours + normalHours);
      grp.totalOtHours = round2(grp.totalOtHours + otHours);
      grp.totalDeductionAmount = round2(grp.totalDeductionAmount + deductionAmount);

      grp.items.push({
        id: sp.id,
        date: te.date.toISOString().split('T')[0],
        employeeId: emp.id,
        employeeCode: emp.corporateEmployee?.employeeCode || '',
        employeeName: emp.corporateEmployee?.fullName || emp.callingName || '',
        employeeType: emp.employeeType || emp.corporateEmployee?.employeeType || 'INTERNAL',
        sourcePartnerCode: emp.businessPartner?.code || '',
        sourcePartner: emp.businessPartner?.name || 'Maga (Direct)',
        tradeGroup: emp.tradeGroup?.name || '',
        inTime: te.inTime || '-',
        outTime: te.outTime || '-',
        activityCode: sp.activityCode?.code || '',
        activityDescription: sp.activityCode?.description || '',
        splitHours: round2(splitHours),
        normalHours,
        otHours,
        dailyRate: round2(dailyRate),
        hourlyRate,
        hourlyOtRate,
        normalAmount,
        otAmount,
        deductionAmount,
      });
    }

    const groups = Array.from(groupMap.values()).map((g) => ({
      subcontractorId: g.subcontractorId,
      subcontractorCode: g.subcontractorCode,
      subcontractorName: g.subcontractorName,
      workerCount: g.employeeIds.size,
      totalSplitHours: g.totalSplitHours,
      totalNormalHours: g.totalNormalHours,
      totalOtHours: g.totalOtHours,
      totalDeductionAmount: g.totalDeductionAmount,
      items: g.items,
    }));

    const grandTotalHours = round2(groups.reduce((s, g) => s + g.totalSplitHours, 0));
    const grandTotalNormalHours = round2(groups.reduce((s, g) => s + g.totalNormalHours, 0));
    const grandTotalOtHours = round2(groups.reduce((s, g) => s + g.totalOtHours, 0));
    const grandTotalDeduction = round2(groups.reduce((s, g) => s + g.totalDeductionAmount, 0));

    res.json({
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      grandTotalHours,
      grandTotalNormalHours,
      grandTotalOtHours,
      grandTotalDeduction,
      groups,
    });
  } catch (error) {
    console.error('Error generating subcontractor deduction report:', error);
    res.status(500).json({ error: 'Failed to generate subcontractor deduction report' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 14. COST BI DASHBOARD ANALYTICS
// GET /api/reports/cost-dashboard?tenantId=&month=&year=&dateFrom=&dateTo=&includeDrafts=
// ─────────────────────────────────────────────────────────────────────────────
function resolveCostDashboardRange(
  dateFrom?: string,
  dateTo?: string,
  month?: string,
  year?: string
): { from: string; to: string; prevFrom: string; prevTo: string } {
  const fmt = (d: Date) => d.toISOString().split('T')[0];

  if (dateFrom && dateTo) {
    const start = new Date(`${dateFrom}T00:00:00Z`);
    const end = new Date(`${dateTo}T00:00:00Z`);
    const spanDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
    const prevEnd = new Date(start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - (spanDays - 1) * 86400000);
    return { from: dateFrom, to: dateTo, prevFrom: fmt(prevStart), prevTo: fmt(prevEnd) };
  }

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    const start = new Date(Date.UTC(y, m - 1, 1));
    const end = new Date(Date.UTC(y, m, 0));
    const prevStart = new Date(Date.UTC(y, m - 2, 1));
    const prevEnd = new Date(Date.UTC(y, m - 1, 0));
    return { from: fmt(start), to: fmt(end), prevFrom: fmt(prevStart), prevTo: fmt(prevEnd) };
  }

  if (year && /^\d{4}$/.test(year)) {
    const y = Number(year);
    return {
      from: `${y}-01-01`,
      to: `${y}-12-31`,
      prevFrom: `${y - 1}-01-01`,
      prevTo: `${y - 1}-12-31`,
    };
  }

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m, 1));
  const end = new Date(Date.UTC(y, m + 1, 0));
  const prevStart = new Date(Date.UTC(y, m - 1, 1));
  const prevEnd = new Date(Date.UTC(y, m, 0));
  return { from: fmt(start), to: fmt(end), prevFrom: fmt(prevStart), prevTo: fmt(prevEnd) };
}

function calcPctChange(current: number, previous: number): number | null {
  if (previous <= 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export const getCostDashboardAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId = await resolveProjectId(req);
    const dateFrom = qStr(req.query.dateFrom);
    const dateTo = qStr(req.query.dateTo);
    const month = qStr(req.query.month);
    const year = qStr(req.query.year);
    const includeDrafts = qStr(req.query.includeDrafts) === 'true';

    const { from, to, prevFrom, prevTo } = resolveCostDashboardRange(dateFrom, dateTo, month, year);
    const currentDateFilter = buildDateFilter(from, to)!;
    const prevDateFilter = buildDateFilter(prevFrom, prevTo)!;
    const allowedStatuses = includeDrafts ? ['draft', 'submitted', 'approved'] : ['submitted', 'approved'];

    const [
      project,
      tradeRates,
      currentCalendarMap,
      prevCalendarMap,
      timeEntries,
      prevTimeEntries,
      equipAssignments,
      prevEquipAssignments,
    ] = await Promise.all([
      prisma.mF_P_Project.findUnique({
        where: { id: projectId },
        select: { currency: true, projectName: true, projectCode: true },
      }),
      prisma.mF_P_TradeRate.findMany({ where: { projectId } }),
      getProjectCalendarDayMap(projectId, from, to),
      getProjectCalendarDayMap(projectId, prevFrom, prevTo),
      prisma.mF_OP_TimeEntry.findMany({
        where: { projectId, date: currentDateFilter, status: { in: allowedStatuses } },
        include: {
          effectiveDayType: true,
          appliedBusinessPartner: true,
          employee: {
            include: {
              corporateEmployee: { include: { corporateBusinessPartner: true } },
              tradeGroup: true,
              businessPartner: true,
            },
          },
          activitySplits: {
            include: {
              activityCode: true,
              chargedBusinessPartner: true,
            },
          },
        },
      }),
      prisma.mF_OP_TimeEntry.findMany({
        where: { projectId, date: prevDateFilter, status: { in: allowedStatuses } },
        include: {
          effectiveDayType: true,
          employee: { include: { corporateEmployee: true } },
        },
      }),
      prisma.mF_OP_DailyEquipmentAssignment.findMany({
        where: {
          dailySheet: {
            projectId,
            date: currentDateFilter,
            status: { in: allowedStatuses },
          },
          dailyLog: { isNot: null },
        },
        include: {
          dailySheet: { select: { date: true } },
          equipment: {
            include: {
              corporateEquipment: true,
              ownerPartner: true,
            },
          },
          dailyLog: {
            include: {
              activities: { include: { activityCode: true } },
            },
          },
        },
      }),
      prisma.mF_OP_DailyEquipmentAssignment.findMany({
        where: {
          dailySheet: {
            projectId,
            date: prevDateFilter,
            status: { in: allowedStatuses },
          },
          dailyLog: { isNot: null },
        },
        include: {
          equipment: { include: { corporateEquipment: true } },
          dailyLog: { include: { activities: true } },
        },
      }),
    ]);

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const tradeRateMap = new Map(tradeRates.map((tr) => [tr.tradeGroupId, tr]));

    const resolveEffectiveDailyRate = (
      appliedDailyRate: unknown,
      emp: {
        dailyRate: unknown;
        tradeGroupId: string | null;
        employeeType: any;
        skillLevel: any;
      }
    ): number => {
      if (appliedDailyRate !== null && appliedDailyRate !== undefined && Number(appliedDailyRate) > 0) {
        return Number(appliedDailyRate);
      }
      if (Number(emp.dailyRate) > 0) {
        return Number(emp.dailyRate);
      }
      if (emp.tradeGroupId && tradeRateMap.has(emp.tradeGroupId)) {
        return pickRateFromTradeRateRow(tradeRateMap.get(emp.tradeGroupId), emp.employeeType, emp.skillLevel);
      }
      return 0;
    };

    const computeEntryLaborCost = (
      entry: {
        date: Date;
        inTime: string | null;
        outTime: string | null;
        hours: unknown;
        shiftHours: unknown;
        overtimeHours: unknown;
        appliedDailyRate: unknown;
        effectiveDayType: { code?: string | null; name?: string | null; rateMultiplier?: any } | null;
        employee: {
          dailyRate: unknown;
          tradeGroupId: string | null;
          employeeType: any;
          skillLevel: any;
          corporateEmployee?: { employeeType?: any } | null;
        };
      },
      calMap: Map<string, DayTypeRuleInfo>
    ) => {
      const dateKey = entry.date.toISOString().split('T')[0];
      const dayRule = resolveDayTypeRule(dateKey, calMap, entry.effectiveDayType);
      const empType = entry.employee.employeeType || entry.employee.corporateEmployee?.employeeType || 'INTERNAL';
      const { workHours, otHours } = computeAttendanceHoursAndOt(
        entry.inTime,
        entry.outTime,
        Number(entry.hours || 0),
        dayRule.standardCap,
        dayRule.isAllOvertime,
        entry.shiftHours !== null && entry.shiftHours !== undefined ? Number(entry.shiftHours) : null,
        entry.overtimeHours !== null && entry.overtimeHours !== undefined ? Number(entry.overtimeHours) : null,
        isExternalEmployeeType(empType)
      );
      const dailyRate = resolveEffectiveDailyRate(entry.appliedDailyRate, entry.employee);
      const hourlyRate = dailyRate / 8;
      const normalHours = dayRule.isAllOvertime ? 0 : Math.max(0, workHours - otHours);
      const regularCost = normalHours * hourlyRate;
      const otCost = otHours * hourlyRate * dayRule.rateMultiplier;
      return {
        dateKey,
        empType: String(empType),
        workHours,
        normalHours,
        otHours,
        regularCost,
        otCost,
        totalCost: regularCost + otCost,
      };
    };

    const computeEquipLogUtil = (log: any): number => {
      if (!log) return 0;
      if (Array.isArray(log.activities) && log.activities.length > 0) {
        const actSum = log.activities.reduce((s: number, a: any) => s + (Number(a.utilization) || 0), 0);
        if (actSum > 0) return actSum;
      }
      if (Number(log.totalUtilization) > 0) return Number(log.totalUtilization);
      if (Number(log.netRunningHours) > 0) return Number(log.netRunningHours);
      return (Number(log.workingHours) || 0) + (Number(log.idleHours) || 0);
    };

    const resolveEquipCostRate = (eq: { costRate: unknown; corporateEquipment?: { costRate?: unknown } | null }): number => {
      if (Number(eq.costRate) > 0) return Number(eq.costRate);
      if (Number(eq.corporateEquipment?.costRate) > 0) return Number(eq.corporateEquipment?.costRate);
      return 0;
    };

    // Aggregators for current period
    let regularLaborCost = 0;
    let otLaborCost = 0;
    let totalLaborHours = 0;
    let totalOtHours = 0;

    const dailyMap = new Map<string, { date: string; laborCost: number; regularCost: number; otCost: number; equipmentCost: number }>();
    const ensureDay = (dateKey: string) => {
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { date: dateKey, laborCost: 0, regularCost: 0, otCost: 0, equipmentCost: 0 });
      }
      return dailyMap.get(dateKey)!;
    };

    const resourceMixMap = new Map<string, { key: string; label: string; cost: number; hours: number; ids: Set<string> }>([
      ['INTERNAL', { key: 'INTERNAL', label: 'Internal Labor', cost: 0, hours: 0, ids: new Set() }],
      ['FOREIGN', { key: 'FOREIGN', label: 'Foreign Labor', cost: 0, hours: 0, ids: new Set() }],
      ['EXTERNAL_SUPPLY', { key: 'EXTERNAL_SUPPLY', label: 'External Supply', cost: 0, hours: 0, ids: new Set() }],
      ['EXTERNAL_SUBCONTRACTOR', { key: 'EXTERNAL_SUBCONTRACTOR', label: 'Subcontractor', cost: 0, hours: 0, ids: new Set() }],
      ['EQUIPMENT', { key: 'EQUIPMENT', label: 'Equipment', cost: 0, hours: 0, ids: new Set() }],
    ]);

    const activityMap = new Map<string, { code: string; description: string; laborCost: number; equipmentCost: number; laborHours: number; equipmentUtil: number }>();
    const ensureActivity = (code: string, description: string) => {
      if (!activityMap.has(code)) {
        activityMap.set(code, { code, description, laborCost: 0, equipmentCost: 0, laborHours: 0, equipmentUtil: 0 });
      }
      return activityMap.get(code)!;
    };

    const tradeGroupMap = new Map<string, { tradeGroup: string; skilledCost: number; unskilledCost: number; totalHours: number }>();
    const bpMap = new Map<string, { partnerId: string; partnerName: string; partnerCode: string; laborCost: number; equipmentCost: number; workerIds: Set<string>; equipIds: Set<string> }>();
    const ensureBp = (partnerId: string, partnerName: string, partnerCode: string) => {
      if (!bpMap.has(partnerId)) {
        bpMap.set(partnerId, { partnerId, partnerName, partnerCode, laborCost: 0, equipmentCost: 0, workerIds: new Set(), equipIds: new Set() });
      }
      return bpMap.get(partnerId)!;
    };

    // 1. Process current period labor entries
    for (const entry of timeEntries) {
      const calc = computeEntryLaborCost(entry, currentCalendarMap);
      regularLaborCost += calc.regularCost;
      otLaborCost += calc.otCost;
      totalLaborHours += calc.workHours;
      totalOtHours += calc.otHours;

      const day = ensureDay(calc.dateKey);
      day.laborCost += calc.totalCost;
      day.regularCost += calc.regularCost;
      day.otCost += calc.otCost;

      const mixBucket = resourceMixMap.get(calc.empType) || resourceMixMap.get('INTERNAL')!;
      mixBucket.cost += calc.totalCost;
      mixBucket.hours += calc.workHours;
      mixBucket.ids.add(entry.employeeId);

      const tgName = entry.employee.tradeGroup?.name || 'Unassigned Trade';
      if (!tradeGroupMap.has(tgName)) {
        tradeGroupMap.set(tgName, { tradeGroup: tgName, skilledCost: 0, unskilledCost: 0, totalHours: 0 });
      }
      const tg = tradeGroupMap.get(tgName)!;
      if (entry.employee.skillLevel === 'UNSKILLED') {
        tg.unskilledCost += calc.totalCost;
      } else {
        tg.skilledCost += calc.totalCost;
      }
      tg.totalHours += calc.workHours;

      const effectiveBp =
        entry.appliedBusinessPartner ||
        entry.employee.businessPartner ||
        entry.employee.corporateEmployee?.corporateBusinessPartner;
      if (effectiveBp) {
        const bp = ensureBp(effectiveBp.id, effectiveBp.name, effectiveBp.code);
        bp.laborCost += calc.totalCost;
        bp.workerIds.add(entry.employeeId);
      }

      if (entry.activitySplits.length > 0) {
        const splitHoursSum = entry.activitySplits.reduce((s, sp) => s + Number(sp.hours || 0), 0);
        for (const sp of entry.activitySplits) {
          const spHrs = Number(sp.hours || 0);
          const ratio = splitHoursSum > 0 ? spHrs / splitHoursSum : 1 / entry.activitySplits.length;
          const act = ensureActivity(sp.activityCode.code, sp.activityCode.description || '');
          act.laborCost += calc.totalCost * ratio;
          act.laborHours += spHrs;
        }
      }
    }

    // 2. Process current period equipment logs
    let equipmentCost = 0;
    let totalEquipmentFuelLiters = 0;
    let totalIdleHours = 0;
    let totalBreakdownHours = 0;
    let estimatedIdleCost = 0;

    const equipEffMap = new Map<string, {
      id: string;
      code: string;
      name: string;
      condition: string;
      unit: string;
      workingHours: number;
      idleHours: number;
      breakdownHours: number;
      fuelLiters: number;
      utilization: number;
      cost: number;
    }>();

    for (const asgn of equipAssignments) {
      const log = asgn.dailyLog;
      if (!log) continue;

      const dateKey = asgn.dailySheet.date.toISOString().split('T')[0];
      const util = computeEquipLogUtil(log);
      const rate = resolveEquipCostRate(asgn.equipment);
      const cost = util * rate;
      const workingHrs = Number(log.workingHours || 0);
      const idleHrs = Number(log.idleHours || 0);
      const breakdownHrs = Number(log.breakdownHours || 0);
      const fuel = Number(log.fuelLiters || 0);
      const unit = (log.unitCode || asgn.equipment.meterUnitCode || asgn.equipment.corporateEquipment.unit || 'hrs').toLowerCase();

      equipmentCost += cost;
      totalEquipmentFuelLiters += fuel;
      totalIdleHours += idleHrs;
      totalBreakdownHours += breakdownHrs;
      if (unit === 'hrs' || unit === 'hr' || unit === 'hours') {
        estimatedIdleCost += (idleHrs + breakdownHrs) * rate;
      }

      const day = ensureDay(dateKey);
      day.equipmentCost += cost;

      const eqMix = resourceMixMap.get('EQUIPMENT')!;
      eqMix.cost += cost;
      eqMix.hours += util;
      eqMix.ids.add(asgn.equipmentId);

      if (asgn.equipment.ownerPartner) {
        const op = asgn.equipment.ownerPartner;
        const bp = ensureBp(op.id, op.name, op.code);
        bp.equipmentCost += cost;
        bp.equipIds.add(asgn.equipmentId);
      }

      if (log.activities.length > 0) {
        const actUtilSum = log.activities.reduce((s, a) => s + Number(a.utilization || 0), 0);
        for (const a of log.activities) {
          const aUtil = Number(a.utilization || 0);
          const ratio = actUtilSum > 0 ? aUtil / actUtilSum : 1 / log.activities.length;
          const act = ensureActivity(a.activityCode.code, a.activityCode.description || '');
          act.equipmentCost += cost * ratio;
          act.equipmentUtil += aUtil;
        }
      }

      const eqId = asgn.equipmentId;
      if (!equipEffMap.has(eqId)) {
        equipEffMap.set(eqId, {
          id: eqId,
          code: asgn.equipment.corporateEquipment.standardEquipmentNumber || asgn.equipment.corporateEquipment.vehicleNo || '—',
          name: asgn.equipment.corporateEquipment.equipmentName,
          condition: asgn.equipment.condition || 'DRY',
          unit,
          workingHours: 0,
          idleHours: 0,
          breakdownHours: 0,
          fuelLiters: 0,
          utilization: 0,
          cost: 0,
        });
      }
      const eqAgg = equipEffMap.get(eqId)!;
      eqAgg.workingHours += workingHrs;
      eqAgg.idleHours += idleHrs;
      eqAgg.breakdownHours += breakdownHrs;
      eqAgg.fuelLiters += fuel;
      eqAgg.utilization += util;
      eqAgg.cost += cost;
    }

    // 3. Previous period totals for trend comparison
    let prevLaborCost = 0;
    for (const entry of prevTimeEntries) {
      prevLaborCost += computeEntryLaborCost(entry, prevCalendarMap).totalCost;
    }
    let prevEquipmentCost = 0;
    for (const asgn of prevEquipAssignments) {
      prevEquipmentCost += computeEquipLogUtil(asgn.dailyLog) * resolveEquipCostRate(asgn.equipment);
    }

    const laborCost = regularLaborCost + otLaborCost;
    const totalCost = laborCost + equipmentCost;
    const prevTotalCost = prevLaborCost + prevEquipmentCost;

    const dailyTrend = Array.from(dailyMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({
        date: d.date,
        laborCost: round2(d.laborCost),
        regularCost: round2(d.regularCost),
        otCost: round2(d.otCost),
        equipmentCost: round2(d.equipmentCost),
        totalCost: round2(d.laborCost + d.equipmentCost),
      }));

    const resourceMix = Array.from(resourceMixMap.values()).map((r) => ({
      key: r.key,
      label: r.label,
      cost: round2(r.cost),
      hours: round2(r.hours),
      count: r.ids.size,
    }));

    const activityCosts = Array.from(activityMap.values())
      .map((a) => ({
        code: a.code,
        description: a.description,
        laborCost: round2(a.laborCost),
        equipmentCost: round2(a.equipmentCost),
        totalCost: round2(a.laborCost + a.equipmentCost),
        laborHours: round2(a.laborHours),
        equipmentUtil: round2(a.equipmentUtil),
      }))
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 12);

    const tradeGroupCosts = Array.from(tradeGroupMap.values())
      .map((t) => ({
        tradeGroup: t.tradeGroup,
        skilledCost: round2(t.skilledCost),
        unskilledCost: round2(t.unskilledCost),
        totalCost: round2(t.skilledCost + t.unskilledCost),
        totalHours: round2(t.totalHours),
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    const businessPartnerSpend = Array.from(bpMap.values())
      .map((b) => ({
        partnerId: b.partnerId,
        partnerName: b.partnerName,
        partnerCode: b.partnerCode,
        laborCost: round2(b.laborCost),
        equipmentCost: round2(b.equipmentCost),
        totalCost: round2(b.laborCost + b.equipmentCost),
        workerCount: b.workerIds.size,
        equipmentCount: b.equipIds.size,
      }))
      .sort((a, b) => b.totalCost - a.totalCost);

    const equipmentEfficiency = Array.from(equipEffMap.values())
      .map((e) => ({
        ...e,
        workingHours: round2(e.workingHours),
        idleHours: round2(e.idleHours),
        breakdownHours: round2(e.breakdownHours),
        fuelLiters: round2(e.fuelLiters),
        utilization: round2(e.utilization),
        cost: round2(e.cost),
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 12);

    res.json({
      period: {
        from,
        to,
        previousFrom: prevFrom,
        previousTo: prevTo,
        currency: project?.currency || 'LKR',
        projectName: project?.projectName || '',
        projectCode: project?.projectCode || '',
        includeDrafts,
      },
      kpis: {
        totalCost: round2(totalCost),
        previousTotalCost: round2(prevTotalCost),
        totalCostChangePct: calcPctChange(totalCost, prevTotalCost),
        laborCost: round2(laborCost),
        regularLaborCost: round2(regularLaborCost),
        otLaborCost: round2(otLaborCost),
        previousLaborCost: round2(prevLaborCost),
        laborCostChangePct: calcPctChange(laborCost, prevLaborCost),
        equipmentCost: round2(equipmentCost),
        previousEquipmentCost: round2(prevEquipmentCost),
        equipmentCostChangePct: calcPctChange(equipmentCost, prevEquipmentCost),
        totalLaborHours: round2(totalLaborHours),
        totalOtHours: round2(totalOtHours),
        totalEquipmentFuelLiters: round2(totalEquipmentFuelLiters),
        totalIdleHours: round2(totalIdleHours),
        totalBreakdownHours: round2(totalBreakdownHours),
        estimatedIdleCost: round2(estimatedIdleCost),
      },
      dailyTrend,
      resourceMix,
      activityCosts,
      tradeGroupCosts,
      businessPartnerSpend,
      equipmentEfficiency,
    });
  } catch (error) {
    console.error('Error generating cost dashboard analytics:', error);
    res.status(500).json({ error: 'Failed to generate cost dashboard analytics' });
  }
};
