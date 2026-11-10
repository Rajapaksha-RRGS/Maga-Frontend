import { Request, Response } from 'express';
import prisma from '../config/prisma';
import '../middleware/tenantMiddleware';
import { getDefaultTenantId } from '../utils/tenantHelper';
import { getDayTypeRulesAndId } from './calendarController';

// Re-export getDayTypeRulesAndId for backwards compatibility
export { getDayTypeRulesAndId };

// Helper: parse date to UTC midnight for date column
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Site Meal Policy configuration
export interface SiteMealPolicy {
  lunchBreakEnabled: boolean;
  lunchStartTime: string;
  lunchEndTime: string;
  lunchDuration: number;
  dinnerBreakEnabled: boolean;
  dinnerStartTime: string;
  dinnerEndTime: string;
  dinnerDuration: number;
}

export const DEFAULT_MEAL_POLICY: SiteMealPolicy = {
  lunchBreakEnabled: true,
  lunchStartTime: '12:00',
  lunchEndTime: '13:00',
  lunchDuration: 1.0,
  dinnerBreakEnabled: true,
  dinnerStartTime: '22:00',
  dinnerEndTime: '23:00',
  dinnerDuration: 1.0,
};

const mealPolicyCache = new Map<string, { policy: SiteMealPolicy; expiresAt: number }>();

export async function getSiteMealPolicy(projectId?: string | null): Promise<SiteMealPolicy> {
  if (!projectId) return DEFAULT_MEAL_POLICY;
  const cached = mealPolicyCache.get(projectId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.policy;
  }

  try {
    const proj = await prisma.mF_P_Project.findUnique({
      where: { id: projectId },
      select: {
        lunchBreakEnabled: true,
        lunchStartTime: true,
        lunchEndTime: true,
        lunchDurationHours: true,
        dinnerBreakEnabled: true,
        dinnerStartTime: true,
        dinnerEndTime: true,
        dinnerDurationHours: true,
      },
    });

    const policy: SiteMealPolicy = {
      lunchBreakEnabled: proj?.lunchBreakEnabled ?? true,
      lunchStartTime: proj?.lunchStartTime || '12:00',
      lunchEndTime: proj?.lunchEndTime || '13:00',
      lunchDuration: proj?.lunchDurationHours ? Number(proj.lunchDurationHours) : 1.0,
      dinnerBreakEnabled: proj?.dinnerBreakEnabled ?? true,
      dinnerStartTime: proj?.dinnerStartTime || '22:00',
      dinnerEndTime: proj?.dinnerEndTime || '23:00',
      dinnerDuration: proj?.dinnerDurationHours ? Number(proj.dinnerDurationHours) : 1.0,
    };

    mealPolicyCache.set(projectId, { policy, expiresAt: Date.now() + 60_000 });
    return policy;
  } catch (err) {
    return DEFAULT_MEAL_POLICY;
  }
}

// Window Overlap Break Calculator:
// Deducts lunch (default 12:00 - 13:00) and/or dinner (default 22:00 - 23:00) based on actual shift times
export function computeBreakHoursAndSnapshots(
  inTime?: string | null,
  outTime?: string | null,
  policy: SiteMealPolicy = DEFAULT_MEAL_POLICY
): { breakHours: number; isLunchDeducted: boolean; isDinnerDeducted: boolean } {
  if (!inTime || !outTime) {
    return { breakHours: 0, isLunchDeducted: false, isDinnerDeducted: false };
  }

  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  if (isNaN(inH) || isNaN(outH)) {
    return { breakHours: 0, isLunchDeducted: false, isDinnerDeducted: false };
  }

  const inMins = inH * 60 + (inM || 0);
  const outMins = outH * 60 + (outM || 0);

  let grossMins = outMins - inMins;
  if (grossMins <= 0) grossMins += 24 * 60; // Overnight or 24h shift

  // Parse lunch window
  const [lStartH, lStartM] = (policy.lunchStartTime || '12:00').split(':').map(Number);
  const [lEndH, lEndM] = (policy.lunchEndTime || '13:00').split(':').map(Number);
  const lunchStart = (lStartH || 12) * 60 + (lStartM || 0);
  const lunchEnd = (lEndH || 13) * 60 + (lEndM || 0);

  // Parse dinner window
  const [dStartH, dStartM] = (policy.dinnerStartTime || '22:00').split(':').map(Number);
  const [dEndH, dEndM] = (policy.dinnerEndTime || '23:00').split(':').map(Number);
  const dinnerStart = (dStartH || 22) * 60 + (dStartM || 0);
  const dinnerEnd = (dEndH || 23) * 60 + (dEndM || 0);

  const calcWindowOverlap = (wStart: number, wEnd: number): number => {
    if (outMins > inMins) {
      // Normal shift within same day
      const overlapStart = Math.max(inMins, wStart);
      const overlapEnd = Math.min(outMins, wEnd);
      return Math.max(0, overlapEnd - overlapStart);
    } else {
      // Overnight shift crossing midnight:
      // Segment 1: [inMins, 1440] (Day 1)
      // Segment 2: [0, outMins]    (Day 2)
      const seg1Overlap = Math.max(0, Math.min(1440, wEnd) - Math.max(inMins, wStart));
      const seg2Overlap = Math.max(0, Math.min(outMins, wEnd) - Math.max(0, wStart));
      return seg1Overlap + seg2Overlap;
    }
  };

  let isLunchDeducted = false;
  let isDinnerDeducted = false;
  let totalBreak = 0;

  if (policy.lunchBreakEnabled) {
    const lunchOverlap = calcWindowOverlap(lunchStart, lunchEnd);
    if (lunchOverlap > 0) {
      isLunchDeducted = true;
      totalBreak += policy.lunchDuration;
    }
  }

  if (policy.dinnerBreakEnabled) {
    const dinnerOverlap = calcWindowOverlap(dinnerStart, dinnerEnd);
    if (dinnerOverlap > 0) {
      isDinnerDeducted = true;
      totalBreak += policy.dinnerDuration;
    }
  }

  const grossHours = grossMins / 60;
  totalBreak = Math.min(totalBreak, grossHours);

  return {
    breakHours: Math.round(totalBreak * 100) / 100,
    isLunchDeducted,
    isDinnerDeducted,
  };
}

// Backwards-compatible helper returning total break hours
export function computeBreakHours(
  inTime?: string | null,
  outTime?: string | null,
  policy: SiteMealPolicy = DEFAULT_MEAL_POLICY
): number {
  return computeBreakHoursAndSnapshots(inTime, outTime, policy).breakHours;
}

// Helper: calculate gross shift hours, break hours, overtime, and regular hours per logic document
export function calculateShiftAndOvertime(
  inTime: string,
  outTime: string,
  standardHoursCap: number,
  isAllOvertime: boolean,
  isSaturday?: boolean,
  isExternal?: boolean,
  policy: SiteMealPolicy = DEFAULT_MEAL_POLICY,
  additionalHours: number = 0
): {
  shiftHours: number;
  otHours: number;
  breakHours: number;
  regularHours: number;
  daysWorked: number;
  isLunchDeducted: boolean;
  isDinnerDeducted: boolean;
  additionalHours: number;
} {
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
  if (diff <= 0) diff += 24 * 60;

  const grossHours = Math.round((diff / 60) * 100) / 100;
  const { breakHours, isLunchDeducted, isDinnerDeducted } = computeBreakHoursAndSnapshots(inTime, outTime, policy);
  const rawShiftHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);
  // Additional hours are added directly as effective shift hours:
  const shiftHours = Math.max(0, Math.round((rawShiftHours + (additionalHours || 0)) * 100) / 100);

  if (shiftHours <= 0) {
    return { shiftHours: 0, otHours: 0, breakHours, regularHours: 0, daysWorked: 0, isLunchDeducted, isDinnerDeducted, additionalHours: 0 };
  }

  let otHours = 0;
  let regularHours = 0;
  let daysWorked = 0;

  const isSat = isSaturday || standardHoursCap === 5.5;

  if (isAllOvertime) {
    // Sundays, Poya, Public Holidays: Entire work time counts directly as OT, no regular day
    otHours = shiftHours;
    regularHours = 0;
    daysWorked = 0;
  } else if (isExternal) {
    // External / Subcontractor Labor:
    // Billed purely on actual hours worked. No "Days" counted. No negative OT.
    const cap = isSat ? 5.5 : 8.0;
    regularHours = Math.min(shiftHours, cap);
    otHours = shiftHours > cap ? Math.round((shiftHours - cap) * 100) / 100 : 0;
    daysWorked = 0;
  } else if (isSat) {
    // Internal Saturday:
    // Any attendance is counted as Full Day (1.0). Regular working hours is actual worked hours (capped at 5.5).
    daysWorked = 1.0;
    regularHours = Math.min(shiftHours, 5.5);
    otHours = Math.round((shiftHours - 5.5) * 100) / 100;
  } else {
    // Internal Weekday:
    if (shiftHours > 6.0) {
      // Full Day (1.0): Base standard is 8.0 hours
      daysWorked = 1.0;
      regularHours = Math.min(shiftHours, 8.0);
      otHours = Math.round((shiftHours - 8.0) * 100) / 100;
    } else {
      // Half Day (0.5): Base standard is 4.0 hours
      daysWorked = 0.5;
      regularHours = Math.min(shiftHours, 4.0);
      otHours = Math.round((shiftHours - 4.0) * 100) / 100;
    }
  }

  return { shiftHours, otHours, breakHours, regularHours, daysWorked, isLunchDeducted, isDinnerDeducted, additionalHours };
}

async function getOrCreateDailySheet(projectId: string, supervisorId: string, date: Date) {
  return await prisma.mF_OP_DailySheet.upsert({
    where: {
      projectId_supervisorId_date: {
        projectId,
        supervisorId,
        date,
      },
    },
    update: {},
    create: {
      projectId,
      supervisorId,
      date,
      status: 'draft',
    },
  });
}

async function getOrCreateDefaultActivityId(projectId: string): Promise<string> {
  const existing = await prisma.mF_P_ActivityCode.findFirst({
    where: { projectId },
    orderBy: { code: 'asc' },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await prisma.mF_P_ActivityCode.create({
    data: {
      projectId,
      code: 'GEN-01',
      description: 'General Site Works',
    },
    select: { id: true },
  });
  return created.id;
}

export async function resolveProjectActivityId(
  rawActivityId: string,
  projectId: string,
  cache?: Map<string, string>
): Promise<string> {
  if (!rawActivityId || !rawActivityId.trim()) {
    return await getOrCreateDefaultActivityId(projectId);
  }

  const clean = rawActivityId.trim();
  const cacheKey = `${projectId}_${clean}`;
  if (cache && cache.has(cacheKey)) {
    return cache.get(cacheKey)!;
  }

  // 0. Dedicated resolution for ZIDLE (Idle Hours)
  if (clean.toUpperCase() === 'ZIDLE') {
    let idleAct = await prisma.mF_P_ActivityCode.findFirst({
      where: { projectId, code: { equals: 'ZIDLE', mode: 'insensitive' } },
      select: { id: true },
    });
    if (!idleAct) {
      let corpIdle = await prisma.mF_G_ActivityCode.findFirst({
        where: { code: { equals: 'ZIDLE', mode: 'insensitive' } },
      });
      if (!corpIdle) {
        corpIdle = await prisma.mF_G_ActivityCode.create({
          data: { code: 'ZIDLE', description: 'Idle / Unallocated Hours', unit: 'hrs' },
        });
      }
      idleAct = await prisma.mF_P_ActivityCode.create({
        data: {
          projectId,
          code: 'ZIDLE',
          description: 'Idle / Unallocated Hours',
          unit: 'hrs',
          corporateActivityCodeId: corpIdle.id,
        },
        select: { id: true },
      });
    }
    if (cache) cache.set(cacheKey, idleAct.id);
    return idleAct.id;
  }

  // 1. Direct match by id in MF_P_ActivityCode for this project
  const directMatch = await prisma.mF_P_ActivityCode.findFirst({
    where: { id: clean, projectId },
    select: { id: true },
  });
  if (directMatch) {
    if (cache) cache.set(cacheKey, directMatch.id);
    return directMatch.id;
  }

  // 2. Check if clean matches code in MF_P_ActivityCode for this project (case-insensitive)
  const codeMatch = await prisma.mF_P_ActivityCode.findFirst({
    where: { projectId, code: { equals: clean, mode: 'insensitive' } },
    select: { id: true },
  });
  if (codeMatch) {
    if (cache) cache.set(cacheKey, codeMatch.id);
    return codeMatch.id;
  }

  // 3. Check if clean is a corporate activity code ID (MF_G_ActivityCode)
  const corpById = await prisma.mF_G_ActivityCode.findUnique({
    where: { id: clean },
    select: { id: true, code: true, description: true, unit: true },
  });
  if (corpById) {
    let projectAct = await prisma.mF_P_ActivityCode.findFirst({
      where: { projectId, code: { equals: corpById.code, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!projectAct) {
      projectAct = await prisma.mF_P_ActivityCode.create({
        data: {
          projectId,
          code: corpById.code,
          description: corpById.description,
          unit: corpById.unit,
          corporateActivityCodeId: corpById.id,
        },
        select: { id: true },
      });
    }
    if (cache) cache.set(cacheKey, projectAct.id);
    return projectAct.id;
  }

  // 4. Check if clean matches a code in corporate activity catalog (MF_G_ActivityCode) (case-insensitive)
  const corpByCode = await prisma.mF_G_ActivityCode.findFirst({
    where: { code: { equals: clean, mode: 'insensitive' } },
    select: { id: true, code: true, description: true, unit: true },
  });
  if (corpByCode) {
    let projectAct = await prisma.mF_P_ActivityCode.findFirst({
      where: { projectId, code: { equals: corpByCode.code, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!projectAct) {
      projectAct = await prisma.mF_P_ActivityCode.create({
        data: {
          projectId,
          code: corpByCode.code,
          description: corpByCode.description,
          unit: corpByCode.unit,
          corporateActivityCodeId: corpByCode.id,
        },
        select: { id: true },
      });
    }
    if (cache) cache.set(cacheKey, projectAct.id);
    return projectAct.id;
  }

  // 5. Check if it matches an MF_P_ActivityCode ID in another project
  const anyProjectMatch = await prisma.mF_P_ActivityCode.findUnique({
    where: { id: clean },
    select: { id: true, code: true, description: true, unit: true },
  });
  if (anyProjectMatch) {
    let localAct = await prisma.mF_P_ActivityCode.findFirst({
      where: { projectId, code: { equals: anyProjectMatch.code, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!localAct) {
      localAct = await prisma.mF_P_ActivityCode.create({
        data: {
          projectId,
          code: anyProjectMatch.code,
          description: anyProjectMatch.description,
          unit: anyProjectMatch.unit,
        },
        select: { id: true },
      });
    }
    if (cache) cache.set(cacheKey, localAct.id);
    return localAct.id;
  }

  // 6. If clean is not found in master catalogs, create it in MF_P_ActivityCode instead of mapping to a wrong default activity
  try {
    const createdCustom = await prisma.mF_P_ActivityCode.create({
      data: {
        projectId,
        code: clean,
        description: clean,
      },
      select: { id: true },
    });
    if (cache) cache.set(cacheKey, createdCustom.id);
    return createdCustom.id;
  } catch {
    const retryFind = await prisma.mF_P_ActivityCode.findFirst({
      where: { projectId, code: { equals: clean, mode: 'insensitive' } },
      select: { id: true },
    });
    if (retryFind) {
      if (cache) cache.set(cacheKey, retryFind.id);
      return retryFind.id;
    }
  }

  // 7. Fallback: default activity for this project
  const defId = await getOrCreateDefaultActivityId(projectId);
  if (cache) cache.set(cacheKey, defId);
  return defId;
}

// 1. GET /api/time-entries/assigned — Get assigned employees for supervisor & date
export const getAssignedEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = req.query.supervisorId as string;
    const dateStr = req.query.date as string;
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    if (!supervisorId || !dateStr) {
      res.json([]);
      return;
    }

    const targetDate = parseDate(dateStr);

    // 1. Check if Site Resource Pool Mode is enabled
    const project = await prisma.mF_P_Project.findUnique({
      where: { id: projectId },
      select: { equipmentAssignBySupervisor: true },
    });
    const isPoolMode = !!project?.equipmentAssignBySupervisor;

    // 2. Fetch explicit assignments for this supervisor (excluding operators)
    const assignedRecords = await prisma.mF_OP_DailyAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          supervisorId,
          date: targetDate,
        },
        employee: {
          isOperator: false,
          corporateEmployee: { isOperator: false },
        },
      },
      select: {
        id: true,
        employee: {
          select: {
            id: true,
            callingName: true,
            corporateEmployee: {
              select: { employeeCode: true, fullName: true, isOperator: true },
            },
            tradeGroup: { select: { name: true } },
            businessPartner: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let employeePool: any[] = [];
    const seenIds = new Set<string>();

    for (const r of assignedRecords) {
      if (!seenIds.has(r.employee.id)) {
        seenIds.add(r.employee.id);
        employeePool.push(r.employee);
      }
    }

    // Also include any employees this supervisor has already recorded entries for on this date (excluding operators)
    if (supervisorId) {
      const myRecordedEntries = await prisma.mF_OP_TimeEntry.findMany({
        where: {
          projectId,
          date: targetDate,
          dailySheet: { supervisorId },
          employee: {
            isOperator: false,
            corporateEmployee: { isOperator: false },
          },
        },
        select: {
          employee: {
            select: {
              id: true,
              callingName: true,
              corporateEmployee: {
                select: { employeeCode: true, fullName: true, isOperator: true },
              },
              tradeGroup: { select: { name: true } },
              businessPartner: { select: { name: true } },
            },
          },
        },
      });

      for (const me of myRecordedEntries) {
        if (me.employee && !seenIds.has(me.employee.id)) {
          seenIds.add(me.employee.id);
          employeePool.push(me.employee);
        }
      }
    }

    // 3. Query all time entries on this date across the project to attach Ownership/Claiming Context
    const existingEntriesOnDate = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        date: targetDate,
      },
      select: {
        id: true,
        employeeId: true,
        inTime: true,
        outTime: true,
        hours: true,
        shiftHours: true,
        dailySheet: {
          select: {
            supervisorId: true,
            supervisor: { select: { id: true, fullName: true, username: true, role: true } },
          },
        },
      },
    });

    // Group entries by employeeId
    const claimsMap = new Map<string, Array<{
      supervisorId: string;
      supervisorName: string;
      inTime?: string | null;
      outTime?: string | null;
      hours: number;
    }>>();

    for (const te of existingEntriesOnDate) {
      if (!te.employeeId) continue;
      const supId = te.dailySheet?.supervisorId || '';
      const supName = te.dailySheet?.supervisor?.fullName || te.dailySheet?.supervisor?.username || 'Another Supervisor';
      const list = claimsMap.get(te.employeeId) || [];
      list.push({
        supervisorId: supId,
        supervisorName: supName,
        inTime: te.inTime,
        outTime: te.outTime,
        hours: Number(te.shiftHours || te.hours || 0),
      });
      claimsMap.set(te.employeeId, list);
    }

    const result = employeePool.map((emp) => {
      const claims = claimsMap.get(emp.id) || [];
      const otherClaim = claims.find((c) => c.supervisorId !== supervisorId);
      const myClaim = claims.find((c) => c.supervisorId === supervisorId);

      return {
        id: emp.id,
        employeeCode: emp.corporateEmployee.employeeCode,
        callingName: emp.callingName || emp.corporateEmployee.fullName,
        fullName: emp.corporateEmployee.fullName,
        tradeGroup: emp.tradeGroup?.name || 'General labour',
        businessPartner: emp.businessPartner?.name || 'Direct',
        claimedBySupervisor: otherClaim?.supervisorName,
        claimedSupervisorId: otherClaim?.supervisorId,
        claimedInTime: otherClaim?.inTime || undefined,
        claimedOutTime: otherClaim?.outTime || undefined,
        claimedHours: otherClaim?.hours,
        claimedByMe: !!myClaim,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching assigned employees:', error);
    res.status(500).json({ error: 'Failed to fetch assigned employees' });
  }
};

// 2. POST /api/time-entries/check-in — Check-in employee
export const checkInEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, supervisorId, date, inTime } = req.body || {};
    if (!employeeId || !inTime || !date) {
      res.status(400).json({ error: 'employeeId, inTime, and date are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const entryDate = parseDate(date);

    // Guard: Prevent edit if already submitted or approved
    const lockedCheck = await prisma.mF_OP_TimeEntry.findFirst({
      where: {
        projectId,
        date: entryDate,
        employeeId,
        status: { in: ['submitted', 'approved'] },
      },
    });

    if (lockedCheck) {
      res.status(403).json({ error: 'Cannot check in: Daily attendance is locked or approved.' });
      return;
    }

    // Resolve supervisor
    let effectiveSupId = supervisorId;
    if (!effectiveSupId) {
      const assignment = await prisma.mF_OP_DailyAssignment.findFirst({
        where: {
          employeeId,
          dailySheet: { projectId, date: entryDate },
        },
        select: { dailySheet: { select: { supervisorId: true } } },
      });
      effectiveSupId = assignment?.dailySheet.supervisorId;
    }
    if (!effectiveSupId) {
      const supUser = await prisma.mF_P_User.findFirst({
        where: { projectId, role: 'supervisor' },
        select: { id: true },
      });
      effectiveSupId = supUser?.id || '';
    }

    const dailySheet = effectiveSupId ? await getOrCreateDailySheet(projectId, effectiveSupId, entryDate) : null;

    // Check existing entries
    const existingEntries = await prisma.mF_OP_TimeEntry.findMany({
      where: { projectId, employeeId, date: entryDate },
    });

    if (existingEntries.length > 0) {
      await prisma.mF_OP_TimeEntry.updateMany({
        where: { projectId, employeeId, date: entryDate },
        data: { inTime },
      });
      res.json({ success: true, employeeId, inTime, count: existingEntries.length });
      return;
    }

    // Default activity
    let defaultActivity = await prisma.mF_P_ActivityCode.findFirst({
      where: { projectId },
      orderBy: { code: 'asc' },
    });
    if (!defaultActivity) {
      defaultActivity = await prisma.mF_P_ActivityCode.create({
        data: {
          projectId,
          code: 'GEN-01',
          description: 'General Site Works',
        },
      });
    }

    const { effectiveDayTypeId } = await getDayTypeRulesAndId(projectId, entryDate);

    // Snapshot employee point-in-time rate and subcontractor
    const emp = await prisma.mF_P_Employee.findUnique({
      where: { id: employeeId },
      select: {
        dailyRate: true,
        businessPartnerId: true,
        tradeGroup: { select: { standardDailyRate: true } },
      },
    });
    const snapDailyRate = emp
      ? (Number(emp.dailyRate) > 0 ? Number(emp.dailyRate) : Number(emp.tradeGroup?.standardDailyRate || 1400.0))
      : null;
    const snapBpId = emp?.businessPartnerId || null;

    const created = await prisma.mF_OP_TimeEntry.create({
      data: {
        projectId,
        dailySheetId: dailySheet?.id || null,
        employeeId,
        recordedById: effectiveSupId || null,
        activityId: defaultActivity.id,
        effectiveDayTypeId,
        date: entryDate,
        inTime,
        hours: 0,
        overtimeHours: 0,
        appliedDailyRate: snapDailyRate,
        appliedBusinessPartnerId: snapBpId,
        status: 'draft',
      },
    });

    res.json({ success: true, employeeId, inTime, entryId: created.id });
  } catch (error) {
    console.error('Error in checkInEmployee:', error);
    res.status(500).json({ error: 'Failed to record check-in' });
  }
};

// 2.1 POST /api/time-entries/check-out — Check-out employee
export const checkOutEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, supervisorId, date, outTime } = req.body || {};
    if (!employeeId || !outTime || !date) {
      res.status(400).json({ error: 'employeeId, outTime, and date are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const entryDate = parseDate(date);

    const lockedCheck = await prisma.mF_OP_TimeEntry.findFirst({
      where: {
        projectId,
        date: entryDate,
        employeeId,
        status: { in: ['submitted', 'approved'] },
      },
    });

    if (lockedCheck) {
      res.status(403).json({ error: 'Cannot check out: Daily attendance is locked or approved.' });
      return;
    }

    const existingEntries = await prisma.mF_OP_TimeEntry.findMany({
      where: { projectId, employeeId, date: entryDate },
    });

    if (existingEntries.length === 0) {
      res.status(400).json({ error: 'Cannot check out: No check-in record found for this worker today.' });
      return;
    }

    const inTime = existingEntries[0].inTime || null;
    let shiftHours = 0;
    let otHours = 0;
    let breakHours = 0;
    let isLunchDeducted = false;
    let isDinnerDeducted = false;

    if (inTime) {
      const mealPolicy = await getSiteMealPolicy(projectId);
      const { standardHoursCap, isAllOvertime, isSaturday } = await getDayTypeRulesAndId(projectId, entryDate);
      const calc = calculateShiftAndOvertime(inTime, outTime, standardHoursCap, isAllOvertime, isSaturday, false, mealPolicy);
      shiftHours = calc.shiftHours;
      otHours = calc.otHours;
      breakHours = calc.breakHours;
      isLunchDeducted = calc.isLunchDeducted;
      isDinnerDeducted = calc.isDinnerDeducted;
    }

    await prisma.mF_OP_TimeEntry.updateMany({
      where: { projectId, employeeId, date: entryDate },
      data: {
        outTime,
        breakHours,
        isLunchDeducted,
        isDinnerDeducted,
        shiftHours,
        overtimeHours: otHours,
      },
    });

    res.json({ success: true, employeeId, outTime, shiftHours, otHours, breakHours, isLunchDeducted, isDinnerDeducted });
  } catch (error) {
    console.error('Error in checkOutEmployee:', error);
    res.status(500).json({ error: 'Failed to record check-out' });
  }
};

// 3. POST /api/time-entries/assign-activity — Assign activity to multiple workers
export const assignActivityBulk = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeIds, activityId, hours, date, supervisorId, equipmentId, remarks } = req.body || {};

    if (!Array.isArray(employeeIds) || employeeIds.length === 0 || !activityId || !date) {
      res.status(400).json({ error: 'employeeIds array, activityId, and date are required' });
      return;
    }

    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0) {
      res.status(400).json({ error: 'Valid positive hours number is required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const { effectiveDayTypeId, standardHoursCap, isAllOvertime, isSaturday } = await getDayTypeRulesAndId(projectId, targetDate);
    const mealPolicy = await getSiteMealPolicy(projectId);

    const resolvedActivityId = await resolveProjectActivityId(activityId, projectId);

    let validEquipmentId: string | null = null;
    if (equipmentId) {
      const eq = await prisma.mF_P_Equipment.findUnique({
        where: { id: equipmentId },
        select: { id: true },
      });
      validEquipmentId = eq ? eq.id : null;
    }

    let effectiveSupId = supervisorId;
    if (!effectiveSupId) {
      const supUser = await prisma.mF_P_User.findFirst({
        where: { projectId, role: 'supervisor' },
        select: { id: true },
      });
      effectiveSupId = supUser?.id || '';
    }

    const dailySheet = effectiveSupId ? await getOrCreateDailySheet(projectId, effectiveSupId, targetDate) : null;
    const createdEntries = [];

    // Pre-load employee snapshots for bulk assignment
    const employees = await prisma.mF_P_Employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        dailyRate: true,
        businessPartnerId: true,
        tradeGroup: { select: { standardDailyRate: true } },
      },
    });
    const empRateMap = new Map(
      employees.map((e) => [
        e.id,
        {
          rate: Number(e.dailyRate) > 0 ? Number(e.dailyRate) : Number(e.tradeGroup?.standardDailyRate || 1400.0),
          bpId: e.businessPartnerId || null,
        },
      ])
    );

    for (const empId of employeeIds) {
      const empSnap = empRateMap.get(empId);
      const existingEntries = await prisma.mF_OP_TimeEntry.findMany({
        where: { projectId, employeeId: empId, date: targetDate },
      });

      const previousHours = existingEntries.reduce((acc, curr) => acc + Number(curr.hours), 0);
      const newTotalHours = previousHours + numHours;

      const preservedInTime = existingEntries.find((e) => e.inTime)?.inTime || null;
      const preservedOutTime = existingEntries.find((e) => e.outTime)?.outTime || null;
      const breakHours = computeBreakHours(preservedInTime, preservedOutTime);

      let overtimeHours = 0;
      if (isAllOvertime) {
        overtimeHours = numHours;
      } else if (newTotalHours > standardHoursCap) {
        if (previousHours >= standardHoursCap) {
          overtimeHours = numHours;
        } else {
          overtimeHours = newTotalHours - standardHoursCap;
        }
      }

      if (existingEntries.length > 0) {
        const primary = existingEntries[0];
        // Add or update split in MF_OP_LaborActivitySplit using upsert
        await prisma.mF_OP_LaborActivitySplit.upsert({
          where: {
            timeEntryId_activityCodeId: {
              timeEntryId: primary.id,
              activityCodeId: resolvedActivityId,
            },
          },
          update: { hours: numHours },
          create: {
            timeEntryId: primary.id,
            activityCodeId: resolvedActivityId,
            hours: numHours,
          },
        });

        // Clean up redundant entries if any existed
        const redundant = existingEntries.slice(1);
        if (redundant.length > 0) {
          const redIds = redundant.map((r) => r.id);
          await prisma.mF_OP_LaborActivitySplit.deleteMany({
            where: { timeEntryId: { in: redIds } },
          });
          await prisma.mF_OP_TimeEntry.deleteMany({
            where: { id: { in: redIds } },
          });
        }

        // Recalculate total hours for primary from splits
        const allSplits = await prisma.mF_OP_LaborActivitySplit.findMany({
          where: { timeEntryId: primary.id },
        });
        const totalSplitHours = allSplits.reduce((s, x) => s + Number(x.hours || 0), 0);

        const updated = await prisma.mF_OP_TimeEntry.update({
          where: { id: primary.id },
          data: {
            hours: totalSplitHours > 0 ? totalSplitHours : numHours,
            inTime: primary.inTime || preservedInTime,
            outTime: primary.outTime || preservedOutTime,
            equipmentId: validEquipmentId || primary.equipmentId,
            remarks: remarks || primary.remarks,
          },
        });
        createdEntries.push(updated);
      } else {
        let parentId: string;
        try {
          const created = await prisma.mF_OP_TimeEntry.create({
            data: {
              projectId,
              dailySheetId: dailySheet?.id || null,
              employeeId: empId,
              recordedById: effectiveSupId || null,
              activityId: resolvedActivityId,
              equipmentId: validEquipmentId,
              effectiveDayTypeId,
              date: targetDate,
              inTime: preservedInTime,
              outTime: preservedOutTime,
              hours: numHours,
              overtimeHours,
              breakHours,
              appliedDailyRate: empSnap ? empSnap.rate : null,
              appliedBusinessPartnerId: empSnap ? empSnap.bpId : null,
              remarks: remarks || null,
              status: 'draft',
            },
          });
          parentId = created.id;
          createdEntries.push(created);
        } catch (err: any) {
          if (err?.code === 'P2002') {
            const existing = await prisma.mF_OP_TimeEntry.findUnique({
              where: {
                projectId_employeeId_date: {
                  projectId,
                  employeeId: empId,
                  date: targetDate,
                },
              },
            });
            parentId = existing!.id;
          } else {
            throw err;
          }
        }
        if (numHours > 0) {
          await prisma.mF_OP_LaborActivitySplit.upsert({
            where: {
              timeEntryId_activityCodeId: {
                timeEntryId: parentId,
                activityCodeId: resolvedActivityId,
              },
            },
            update: { hours: numHours },
            create: {
              timeEntryId: parentId,
              activityCodeId: resolvedActivityId,
              hours: numHours,
            },
          });
        }
      }
    }

    res.status(201).json({
      success: true,
      count: createdEntries.length,
      entries: createdEntries,
    });
  } catch (error) {
    console.error('Error in assignActivityBulk:', error);
    res.status(500).json({ error: 'Failed to assign activity in bulk' });
  }
};

// 4. POST /api/time-entries/upsert — Upsert single time entry
export const upsertTimeEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, supervisorId, date, activityId, equipmentId, hours, inTime, outTime, remarks } = req.body || {};

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const { effectiveDayTypeId, standardHoursCap, isAllOvertime, isSaturday } = await getDayTypeRulesAndId(projectId, targetDate);
    const mealPolicy = await getSiteMealPolicy(projectId);
    const numHours = hours !== undefined ? parseFloat(hours) : 0;

    let effectiveSupId = supervisorId;
    if (!effectiveSupId) {
      const supUser = await prisma.mF_P_User.findFirst({
        where: { projectId, role: 'supervisor' },
        select: { id: true },
      });
      effectiveSupId = supUser?.id || '';
    }

    const resolvedActivityId = await resolveProjectActivityId(activityId, projectId);

    let validEquipmentId: string | null = null;
    if (equipmentId) {
      const eq = await prisma.mF_P_Equipment.findUnique({
        where: { id: equipmentId },
        select: { id: true },
      });
      validEquipmentId = eq ? eq.id : null;
    }

    const dailySheet = effectiveSupId ? await getOrCreateDailySheet(projectId, effectiveSupId, targetDate) : null;

    const existing = await prisma.mF_OP_TimeEntry.findFirst({
      where: {
        projectId,
        employeeId,
        activityId: resolvedActivityId,
        date: targetDate,
      },
    });

    // Resolve snapshot rate and subcontractor
    const emp = await prisma.mF_P_Employee.findUnique({
      where: { id: employeeId },
      select: {
        dailyRate: true,
        businessPartnerId: true,
        tradeGroup: { select: { standardDailyRate: true } },
      },
    });
    const snapDailyRate = emp
      ? (Number(emp.dailyRate) > 0 ? Number(emp.dailyRate) : Number(emp.tradeGroup?.standardDailyRate || 1400.0))
      : null;
    const snapBpId = emp?.businessPartnerId || null;

    const finalInTime = inTime ?? existing?.inTime ?? null;
    const finalOutTime = outTime ?? existing?.outTime ?? null;
    let shiftHoursVal: number | null = null;
    let otHoursVal = 0;
    let breakHours = 0;

    if (finalInTime && finalOutTime) {
      const calc = calculateShiftAndOvertime(finalInTime, finalOutTime, standardHoursCap, isAllOvertime);
      shiftHoursVal = calc.shiftHours;
      otHoursVal = calc.otHours;
      breakHours = calc.breakHours;
    } else {
      breakHours = computeBreakHours(finalInTime, finalOutTime);
      otHoursVal = isAllOvertime ? numHours : numHours > standardHoursCap ? numHours - standardHoursCap : 0;
    }

    let record;
    if (existing) {
      record = await prisma.mF_OP_TimeEntry.update({
        where: { id: existing.id },
        data: {
          hours: numHours,
          shiftHours: shiftHoursVal,
          overtimeHours: otHoursVal,
          breakHours,
          inTime: finalInTime,
          outTime: finalOutTime,
          equipmentId: validEquipmentId ?? existing.equipmentId,
          remarks: remarks ?? existing.remarks,
          ...(existing.appliedDailyRate === null && snapDailyRate !== null ? {
            appliedDailyRate: snapDailyRate,
            appliedBusinessPartnerId: snapBpId,
          } : {}),
        },
      });
    } else {
      record = await prisma.mF_OP_TimeEntry.create({
        data: {
          projectId,
          dailySheetId: dailySheet?.id || null,
          employeeId,
          recordedById: effectiveSupId || null,
          activityId: resolvedActivityId,
          equipmentId: validEquipmentId,
          effectiveDayTypeId,
          date: targetDate,
          inTime: finalInTime,
          outTime: finalOutTime,
          hours: numHours,
          shiftHours: shiftHoursVal,
          overtimeHours: otHoursVal,
          breakHours,
          appliedDailyRate: snapDailyRate,
          appliedBusinessPartnerId: snapBpId,
          remarks: remarks || null,
          status: 'draft',
        },
      });
    }

    // Sync activity split for single entry
    await prisma.mF_OP_LaborActivitySplit.deleteMany({
      where: { timeEntryId: record.id },
    });
    if (numHours > 0) {
      await prisma.mF_OP_LaborActivitySplit.create({
        data: {
          timeEntryId: record.id,
          activityCodeId: resolvedActivityId,
          hours: numHours,
        },
      });
    }

    res.status(201).json(record);
  } catch (error) {
    console.error('Error upserting time entry:', error);
    res.status(500).json({ error: 'Failed to save time entry' });
  }
};

// 5. GET /api/time-entries — Query time entries
export const getTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, supervisorId, employeeId, status } = req.query;
    const startDate = (req.query.startDate || req.query.dateFrom) as string | undefined;
    const endDate = (req.query.endDate || req.query.dateTo) as string | undefined;
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const where: Record<string, any> = { projectId };
    if (date && typeof date === 'string') {
      where.date = parseDate(date);
    } else if (startDate || endDate) {
      where.date = {};
      if (startDate && typeof startDate === 'string') {
        where.date.gte = parseDate(startDate);
      }
      if (endDate && typeof endDate === 'string') {
        where.date.lte = parseDate(endDate);
      }
    }
    if (supervisorId && typeof supervisorId === 'string') {
      where.OR = [
        { dailySheet: { supervisorId } },
        { recordedById: supervisorId },
      ];
    }
    if (employeeId && typeof employeeId === 'string') {
      where.employeeId = employeeId;
    }
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const entries = await prisma.mF_OP_TimeEntry.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        dailySheetId: true,
        employeeId: true,
        date: true,
        inTime: true,
        outTime: true,
        hours: true,
        overtimeHours: true,
        shiftHours: true,
        breakHours: true,
        isLunchDeducted: true,
        isDinnerDeducted: true,
        additionalHours: true,
        status: true,
        remarks: true,
        appliedDailyRate: true,
        appliedBusinessPartnerId: true,
        appliedBusinessPartner: { select: { id: true, name: true, code: true } },
        employee: {
          select: {
            id: true,
            callingName: true,
            corporateEmployee: { select: { employeeCode: true, fullName: true } },
            tradeGroup: { select: { name: true } },
            businessPartner: { select: { name: true } },
          },
        },
        activity: { select: { id: true, code: true, description: true } },
        activitySplits: {
          include: {
            activityCode: { select: { id: true, code: true, description: true } },
          },
        },
        equipment: {
          select: {
            id: true,
            corporateEquipment: { select: { standardEquipmentNumber: true, equipmentName: true } },
          },
        },
        recordedBy: { select: { id: true, fullName: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(entries);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
};

// 6. POST /api/time-entries/submit — Submit day
export const submitDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, date } = req.body || {};
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const submittedAt = new Date();

    if (!supervisorId) {
      res.status(400).json({ error: 'supervisorId is required' });
      return;
    }

    const dailySheet = await getOrCreateDailySheet(projectId, supervisorId, targetDate);

    // Lock daily sheet
    await prisma.mF_OP_DailySheet.update({
      where: { id: dailySheet.id },
      data: {
        status: 'submitted',
        isLocked: true,
        submittedAt,
      },
    });

    // Auto-balance Idle (ZIDLE) on supervisor submission:
    // When the supervisor submits the daily sheet, any remaining shift shortage is officially recorded as ZIDLE
    const sheetEntries = await prisma.mF_OP_TimeEntry.findMany({
      where: { dailySheetId: dailySheet.id },
      include: {
        activitySplits: {
          include: { activityCode: true },
        },
      },
    });

    const actCache = new Map<string, string>();
    for (const te of sheetEntries) {
      const effShift = Number(te.shiftHours || 0);
      if (effShift <= 0) continue;

      const splits = te.activitySplits || [];
      const sumSplits = splits.reduce((sum, s) => sum + Number(s.hours || 0), 0);
      const shortage = Math.round((effShift - sumSplits) * 100) / 100;
      const hasZidle = splits.some((s) => s.activityCode?.code?.toUpperCase() === 'ZIDLE');

      if (shortage > 0.05 && !hasZidle) {
        const zidleId = await resolveProjectActivityId('ZIDLE', projectId, actCache);
        await prisma.mF_OP_LaborActivitySplit.upsert({
          where: {
            timeEntryId_activityCodeId: {
              timeEntryId: te.id,
              activityCodeId: zidleId,
            },
          },
          update: { hours: shortage },
          create: {
            timeEntryId: te.id,
            activityCodeId: zidleId,
            hours: shortage,
          },
        });
        await prisma.mF_OP_TimeEntry.update({
          where: { id: te.id },
          data: { hours: effShift },
        });
      }
    }

    // Update time entries
    const updated = await prisma.mF_OP_TimeEntry.updateMany({
      where: {
        dailySheetId: dailySheet.id,
        status: 'draft',
      },
      data: {
        status: 'submitted',
        submittedAt,
      },
    });

    // Update equipment logs
    const eqAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: { dailySheetId: dailySheet.id },
      select: { id: true },
    });

    if (eqAssignments.length > 0) {
      await prisma.mF_OP_EquipmentDailyLog.updateMany({
        where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
        data: { status: 'submitted' },
      });
    }

    res.json({
      success: true,
      submittedCount: updated.count,
      submittedAt: submittedAt.toISOString(),
      message: 'Successfully submitted daily entries.',
    });
  } catch (error) {
    console.error('Error submitting day:', error);
    res.status(500).json({ error: 'Failed to submit daily entries' });
  }
};

// 6.1 GET /api/time-entries/day-status — Get daily status
export const getDayStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = req.query.supervisorId as string;
    const dateStr = req.query.date as string;
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    if (!supervisorId || !dateStr) {
      res.status(400).json({ error: 'supervisorId and date query parameters are required' });
      return;
    }

    const targetDate = parseDate(dateStr);
    const dailySheet = await prisma.mF_OP_DailySheet.findUnique({
      where: {
        projectId_supervisorId_date: {
          projectId,
          supervisorId,
          date: targetDate,
        },
      },
      select: {
        status: true,
        isLocked: true,
        submittedAt: true,
        approvedAt: true,
        remarks: true,
      },
    });

    if (!dailySheet) {
      res.json({
        status: 'draft',
        isLocked: false,
        submittedAt: null,
        approvedAt: null,
        remarks: null,
      });
      return;
    }

    res.json({
      status: dailySheet.status,
      isLocked: dailySheet.status === 'submitted' || dailySheet.status === 'approved' || dailySheet.isLocked,
      submittedAt: dailySheet.submittedAt,
      approvedAt: dailySheet.approvedAt,
      remarks: dailySheet.remarks,
    });
  } catch (error) {
    console.error('Error fetching day status:', error);
    res.status(500).json({ error: 'Failed to fetch day status' });
  }
};

// 7. GET /api/time-entries/approval-overview — Admin Approval Overview
export const getApprovalOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const targetDate = parseDate(dateStr);
    const dayTypeRules = await getDayTypeRulesAndId(projectId, targetDate);

    const dailySheets = await prisma.mF_OP_DailySheet.findMany({
      where: { projectId, date: targetDate },
      include: {
        supervisor: { select: { id: true, fullName: true, username: true } },
        assignments: {
          include: {
            employee: {
              select: {
                id: true,
                callingName: true,
                isOperator: true,
                corporateEmployee: { select: { employeeCode: true, fullName: true, isOperator: true } },
                tradeGroup: { select: { name: true } },
                businessPartner: { select: { name: true } },
              },
            },
          },
        },
        timeEntries: {
          include: {
            employee: {
              select: {
                id: true,
                callingName: true,
                isOperator: true,
                corporateEmployee: { select: { employeeCode: true, fullName: true } },
                tradeGroup: { select: { name: true } },
                businessPartner: { select: { name: true } },
              },
            },
            equipment: {
              select: {
                id: true,
                corporateEquipment: {
                  select: { standardEquipmentNumber: true, vehicleNo: true, equipmentName: true },
                },
              },
            },
            activity: { select: { code: true, description: true } },
            activitySplits: {
              include: {
                activityCode: { select: { code: true, description: true } },
              },
            },
          },
        },
        equipmentAssignments: {
          include: {
            equipment: {
              select: {
                id: true,
                condition: true,
                meterUnitCode: true,
                corporateEquipment: {
                  select: {
                    standardEquipmentNumber: true,
                    equipmentName: true,
                    vehicleNo: true,
                    condition: true,
                    unit: true,
                  },
                },
              },
            },
            operator: {
              select: {
                id: true,
                callingName: true,
                corporateEmployee: { select: { employeeCode: true, fullName: true } },
                tradeGroup: { select: { name: true } },
              },
            },
            dailyLog: {
              include: {
                activities: {
                  include: {
                    activityCode: { select: { code: true, description: true, unit: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    const submitted: any[] = [];
    const notSubmitted: any[] = [];
    const approved: any[] = [];
    const mealPolicy = await getSiteMealPolicy(projectId);

    for (const sheet of dailySheets) {
      const sup = sheet.supervisor;

      // Collect all operator employee IDs so they don't get mixed into Laborers list
      const operatorEmpIds = new Set<string>();
      for (const ea of sheet.equipmentAssignments) {
        if (ea.operatorId) operatorEmpIds.add(ea.operatorId);
      }
      for (const a of sheet.assignments) {
        if (a.employee && ((a.employee as any).isOperator || (a.employee as any).corporateEmployee?.isOperator)) {
          operatorEmpIds.add(a.employee.id);
        }
      }
      for (const te of sheet.timeEntries) {
        if (te.employee) {
          const isOp = (te.employee as any).isOperator || 
            te.employee.tradeGroup?.name?.toLowerCase().includes('operator') ||
            te.employee.tradeGroup?.name?.toLowerCase().includes('driver');
          if (isOp) operatorEmpIds.add(te.employee.id);
        }
      }

      // 1. Worker details (Laborers ONLY, excluding operators)
      const empMap = new Map<string, { employee: any; timeEntries: any[] }>();
      for (const a of sheet.assignments) {
        if (a.employee && !operatorEmpIds.has(a.employee.id)) {
          empMap.set(a.employee.id, {
            employee: a.employee,
            timeEntries: [],
          });
        }
      }
      for (const te of sheet.timeEntries) {
        if (te.employee && !operatorEmpIds.has(te.employee.id)) {
          if (!empMap.has(te.employee.id)) {
            empMap.set(te.employee.id, {
              employee: te.employee,
              timeEntries: [te],
            });
          } else {
            empMap.get(te.employee.id)!.timeEntries.push(te);
          }
        }
      }

      const workerDetails = Array.from(empMap.values()).map(({ employee: emp, timeEntries: entries }) => {
        const firstWithTimes = entries.find((e: any) => e.inTime && e.outTime) || entries[0];
        const inTime = firstWithTimes?.inTime || '';
        const outTime = firstWithTimes?.outTime || '';
        const additionalHours = firstWithTimes ? Number(firstWithTimes.additionalHours || 0) : 0;

        // Calculate shift hours, overtime, and regular hours
        let shiftHours = 0;
        let otHours = 0;
        let regularHours = 0;
        let daysWorked = 0;
        let breakHours = firstWithTimes ? Number(firstWithTimes.breakHours || 0) : 0;
        let isLunchDeducted = Boolean(firstWithTimes?.isLunchDeducted);
        let isDinnerDeducted = Boolean(firstWithTimes?.isDinnerDeducted);

        const isExternal = Boolean(
          emp.businessPartnerId ||
          emp.corporateEmployee?.corporateBusinessPartnerId ||
          emp.employeeType === 'external' ||
          (emp.businessPartner?.name && !emp.businessPartner?.name?.toLowerCase().includes('direct'))
        );

        if (inTime && outTime) {
          const calc = calculateShiftAndOvertime(
            inTime,
            outTime,
            dayTypeRules.standardHoursCap,
            dayTypeRules.isAllOvertime,
            dayTypeRules.isSaturday,
            isExternal,
            mealPolicy,
            additionalHours
          );
          shiftHours = calc.shiftHours;
          otHours = calc.otHours;
          regularHours = calc.regularHours;
          daysWorked = calc.daysWorked;
          breakHours = calc.breakHours;
          isLunchDeducted = calc.isLunchDeducted;
          isDinnerDeducted = calc.isDinnerDeducted;
        } else if (entries.length > 0) {
          shiftHours = entries.reduce((sum: number, e: any) => sum + Number(e.shiftHours ?? e.hours ?? 0), 0);
          otHours = entries.reduce((sum: number, e: any) => sum + Number(e.overtimeHours || 0), 0);
          regularHours = entries.reduce((sum: number, e: any) => sum + Number(e.hours || 0), 0);
          daysWorked = isExternal ? 0 : dayTypeRules.isAllOvertime ? 0 : (dayTypeRules.isSaturday || shiftHours > 6.0) ? 1.0 : shiftHours > 0 ? 0.5 : 0;
        }

        // Collect all activities worked across all entries
        const seenActivities = new Map<string, { code: string; description: string; hours: number }>();
        let totalAllocatedHours = 0;
        for (const te of entries) {
          if (te.activitySplits && te.activitySplits.length > 0) {
            for (const s of te.activitySplits) {
              const code = s.activityCode?.code || 'N/A';
              const description = s.activityCode?.description || '';
              const h = Number(s.hours || 0);
              totalAllocatedHours += h;
              if (seenActivities.has(code)) {
                seenActivities.get(code)!.hours += h;
              } else {
                seenActivities.set(code, { code, description, hours: h });
              }
            }
          } else if (te.activity) {
            const code = te.activity.code || 'N/A';
            const description = te.activity.description || '';
            const h = Number(te.hours || 0);
            totalAllocatedHours += h;
            if (seenActivities.has(code)) {
              seenActivities.get(code)!.hours += h;
            } else {
              seenActivities.set(code, { code, description, hours: h });
            }
          }
        }

        // Calculate idle hours: effective shiftHours - totalAllocatedHours
        let idleHours = 0;
        if (seenActivities.has('ZIDLE')) {
          idleHours = seenActivities.get('ZIDLE')!.hours;
        } else if (shiftHours > 0) {
          idleHours = Math.max(0, Math.round((shiftHours - totalAllocatedHours) * 100) / 100);
          if (idleHours > 0) {
            seenActivities.set('ZIDLE', {
              code: 'ZIDLE',
              description: 'Idle / Unallocated Hours',
              hours: idleHours,
            });
          }
        }

        const activities = Array.from(seenActivities.values());
        const primaryStatus = entries.find((e: any) => e.status)?.status || (inTime ? 'draft' : 'pending');

        return {
          employeeId: emp.id,
          employeeCode: emp.corporateEmployee?.employeeCode || 'N/A',
          callingName: emp.callingName || emp.corporateEmployee?.fullName || 'Worker',
          fullName: emp.corporateEmployee?.fullName || emp.callingName || '',
          tradeGroup: emp.tradeGroup?.name || 'General',
          businessPartner: emp.businessPartner?.name || 'Direct / Maga',
          isExternal,
          inTime,
          outTime,
          hours: regularHours,
          otHours,
          shiftHours,
          effectiveHours: shiftHours,
          daysWorked,
          breakHours,
          isLunchDeducted,
          isDinnerDeducted,
          additionalHours,
          idleHours,
          activities,
          status: primaryStatus,
        };
      });

      // 2. Operator details (Grouped by unique operator)
      const opMap = new Map<string, {
        operator: any;
        equipmentDisplays: string[];
        equipmentIds: string[];
      }>();

      for (const a of sheet.assignments) {
        if (a.employee && operatorEmpIds.has(a.employee.id)) {
          if (!opMap.has(a.employee.id)) {
            opMap.set(a.employee.id, {
              operator: a.employee,
              equipmentDisplays: [],
              equipmentIds: [],
            });
          }
        }
      }

      for (const ea of sheet.equipmentAssignments) {
        if (ea.operator && ea.operatorId) {
          const eqDisplay =
            ea.equipment?.corporateEquipment?.standardEquipmentNumber ||
            ea.equipment?.corporateEquipment?.vehicleNo ||
            ea.equipment?.corporateEquipment?.equipmentName ||
            '—';
          if (!opMap.has(ea.operatorId)) {
            opMap.set(ea.operatorId, {
              operator: ea.operator,
              equipmentDisplays: eqDisplay !== '—' ? [eqDisplay] : [],
              equipmentIds: ea.equipmentId ? [ea.equipmentId] : [],
            });
          } else {
            const existing = opMap.get(ea.operatorId)!;
            if (eqDisplay !== '—' && !existing.equipmentDisplays.includes(eqDisplay)) {
              existing.equipmentDisplays.push(eqDisplay);
            }
            if (ea.equipmentId && !existing.equipmentIds.includes(ea.equipmentId)) {
              existing.equipmentIds.push(ea.equipmentId);
            }
          }
        }
      }

      for (const te of sheet.timeEntries) {
        if (te.employee && operatorEmpIds.has(te.employee.id)) {
          const teEqDisplay =
            (te as any).equipment?.corporateEquipment?.standardEquipmentNumber ||
            (te as any).equipment?.corporateEquipment?.vehicleNo ||
            (te as any).equipment?.corporateEquipment?.equipmentName ||
            '';
          if (!opMap.has(te.employee.id)) {
            opMap.set(te.employee.id, {
              operator: te.employee,
              equipmentDisplays: teEqDisplay ? [teEqDisplay] : [],
              equipmentIds: te.equipmentId ? [te.equipmentId] : [],
            });
          } else {
            const existing = opMap.get(te.employee.id)!;
            if (teEqDisplay && !existing.equipmentDisplays.includes(teEqDisplay)) {
              existing.equipmentDisplays.push(teEqDisplay);
            }
            if (te.equipmentId && !existing.equipmentIds.includes(te.equipmentId)) {
              existing.equipmentIds.push(te.equipmentId);
            }
          }
        }
      }

      const operatorDetails = Array.from(opMap.values()).map(({ operator: op, equipmentDisplays, equipmentIds }) => {
        const opTeList = sheet.timeEntries.filter((t) => t.employeeId === op.id);
        const firstOpTe = opTeList.find((t) => t.inTime && t.outTime) || opTeList[0];
        const inTime = firstOpTe?.inTime || '';
        const outTime = firstOpTe?.outTime || '';
        let shiftHours = 0;
        let hours = 0;
        let otHours = 0;
        let daysWorked = 0;

        const isExternal = Boolean(
          op.businessPartnerId ||
          op.corporateEmployee?.corporateBusinessPartnerId ||
          op.employeeType === 'external' ||
          (op.businessPartner?.name && !op.businessPartner?.name?.toLowerCase().includes('direct'))
        );

        const additionalHours = firstOpTe ? Number(firstOpTe.additionalHours || 0) : 0;
        let breakHours = firstOpTe ? Number(firstOpTe.breakHours || 0) : 0;
        let isLunchDeducted = Boolean(firstOpTe?.isLunchDeducted);
        let isDinnerDeducted = Boolean(firstOpTe?.isDinnerDeducted);

        if (inTime && outTime) {
          const calc = calculateShiftAndOvertime(
            inTime,
            outTime,
            dayTypeRules.standardHoursCap,
            dayTypeRules.isAllOvertime,
            dayTypeRules.isSaturday,
            isExternal,
            mealPolicy,
            additionalHours
          );
          shiftHours = calc.shiftHours;
          otHours = calc.otHours;
          hours = calc.regularHours;
          daysWorked = calc.daysWorked;
          breakHours = calc.breakHours;
          isLunchDeducted = calc.isLunchDeducted;
          isDinnerDeducted = calc.isDinnerDeducted;
        } else if (opTeList.length > 0) {
          shiftHours = opTeList.reduce((sum, t) => sum + Number(t.shiftHours ?? t.hours ?? 0), 0);
          otHours = opTeList.reduce((sum, t) => sum + Number(t.overtimeHours || 0), 0);
          hours = opTeList.reduce((sum, t) => sum + Number(t.hours || 0), 0);
          daysWorked = isExternal ? 0 : dayTypeRules.isAllOvertime ? 0 : (dayTypeRules.isSaturday || shiftHours > 6.0) ? 1.0 : shiftHours > 0 ? 0.5 : 0;
        }
        const eqDisplay = equipmentDisplays.length > 0 ? equipmentDisplays.join(', ') : '—';

        return {
          operatorId: op.id,
          operatorCode: op.corporateEmployee?.employeeCode || 'N/A',
          callingName: op.callingName || op.corporateEmployee?.fullName || 'Operator',
          fullName: op.corporateEmployee?.fullName || op.callingName || '',
          tradeGroup: op.tradeGroup?.name || 'Machine Operator',
          isExternal,
          inTime,
          outTime,
          hours,
          otHours,
          shiftHours,
          effectiveHours: shiftHours,
          daysWorked,
          breakHours,
          isLunchDeducted,
          isDinnerDeducted,
          additionalHours,
          assignedEquipmentId: equipmentIds[0] || null,
          assignedEquipmentDisplay: eqDisplay,
          status: firstOpTe?.status || (inTime ? 'draft' : 'pending'),
          notes: firstOpTe?.remarks || '',
        };
      });

      // 3. Equipment details (Method 2: Show only equipment that have actual logged hours/usage)
      const allEquipmentDetails = sheet.equipmentAssignments.map((ea) => {
        const eq = ea.equipment;
        const corp = eq?.corporateEquipment;
        const log = ea.dailyLog;
        const primaryUnit = (eq?.meterUnitCode || corp?.unit || 'hrs').toLowerCase();
        const condition = eq?.condition || corp?.condition || 'DRY';
        const initialMeter = Number(log?.initialMeter || 0);
        const finalMeter = Number(log?.finalMeter || 0);
        const isHrUnit = primaryUnit === 'hrs' || primaryUnit === 'hr';
        const netHours = Number(log?.netRunningHours || log?.workingHours || (isHrUnit ? log?.totalUtilization : 0) || 0);
        const workingHours = Number(log?.workingHours || log?.netRunningHours || (isHrUnit ? log?.totalUtilization : 0) || 0);
        const idleHours = Number(log?.idleHours || 0);
        const fuelLiters = Number(log?.fuelLiters || 0);
        const totalMileage = Number(log?.totalMileage || 0);
        const loggedQuantity = Number(log?.totalUtilization || (isHrUnit ? netHours : 0) || 0);

        const splits = (log?.activities || []).map((act) => ({
          activityCode: act.activityCode?.code || 'N/A',
          activityDesc: act.activityCode?.description || '',
          unit: primaryUnit || 'hrs',
          utilization: Number(act.utilization || 0),
        }));

        const isLogged = netHours > 0 || workingHours > 0 || loggedQuantity > 0 || fuelLiters > 0 || splits.length > 0;

        return {
          equipmentId: ea.equipmentId,
          equipmentCode: corp?.standardEquipmentNumber || corp?.vehicleNo || '—',
          equipmentName: corp?.equipmentName || '',
          vehicleNo: corp?.vehicleNo || '—',
          magaNo: corp?.standardEquipmentNumber || '—',
          condition,
          primaryUnit,
          loggedQuantity,
          initialMeter,
          finalMeter,
          netHours,
          workingHours,
          idleHours,
          fuelLiters,
          totalMileage,
          remarks: log?.remarks || '',
          status: log?.status === 'approved' ? 'approved' : (isLogged ? 'logged' : 'assigned'),
          isLogged,
          splits,
        };
      });

      // Filter only machines that were actually logged by supervisor
      const equipmentDetails = allEquipmentDetails.filter((e) => e.isLogged || e.status === 'approved');

      const laborHours = workerDetails.reduce((sum, w) => sum + Number(w.hours || 0), 0);
      const laborOvertime = workerDetails.reduce((sum, w) => sum + Number(w.otHours || 0), 0);
      const equipmentFuel = equipmentDetails.reduce((sum, e) => sum + Number(e.fuelLiters || 0), 0);
      const equipmentDays = equipmentDetails.reduce(
        (sum, e) =>
          sum +
          (e.primaryUnit === 'mth' || e.primaryUnit === 'day' || e.primaryUnit === 'days'
            ? e.loggedQuantity > 0
              ? e.loggedQuantity
              : 1
            : 0),
        0
      );

      const laborAssignedCount = Math.max(
        sheet.assignments.filter((a) => a.employee && !operatorEmpIds.has(a.employee.id)).length,
        workerDetails.length
      );
      const laborWorkedCount = workerDetails.filter((w) => w.inTime || w.hours > 0).length;
      const operatorsWorkedCount = operatorDetails.filter((o) => o.inTime || o.hours > 0).length;
      const equipmentRunningCount = equipmentDetails.filter((e) => e.netHours > 0 || e.loggedQuantity > 0).length;

      const groupData = {
        supervisorId: sup.id,
        supervisorName: sup.fullName,
        username: sup.username,
        status: sheet.status,
        submittedAt: sheet.submittedAt,
        approvedAt: sheet.approvedAt,
        assignedCount: laborAssignedCount,
        workedCount: laborWorkedCount,
        totalHours: laborHours,
        totalOvertime: laborOvertime,
        counts: {
          laborAssigned: laborAssignedCount,
          laborWorked: laborWorkedCount,
          operatorsAssigned: operatorDetails.length,
          operatorsWorked: operatorsWorkedCount,
          equipmentAssigned: equipmentDetails.length,
          equipmentRunning: equipmentRunningCount,
        },
        totals: {
          laborHours,
          laborOvertime,
          equipmentFuel,
          equipmentDays,
        },
        workers: workerDetails,
        operators: operatorDetails,
        equipment: equipmentDetails,
      };

      // Skip completely empty draft sheets (e.g. admin test view or supervisor with 0 gang/logs)
      const hasAnyActivity =
        sheet.assignments.length > 0 ||
        sheet.timeEntries.length > 0 ||
        sheet.equipmentAssignments.length > 0 ||
        workerDetails.length > 0 ||
        operatorDetails.length > 0 ||
        allEquipmentDetails.length > 0;

      if (!hasAnyActivity && sheet.status === 'draft') {
        continue;
      }

      if (sheet.status === 'approved') {
        approved.push(groupData);
      } else if (sheet.status === 'submitted') {
        submitted.push(groupData);
      } else {
        notSubmitted.push(groupData);
      }
    }

    const allGroups = [...submitted, ...notSubmitted, ...approved];

    res.json({
      date: dateStr,
      dayType: {
        name: dayTypeRules.name,
        standardHoursCap: dayTypeRules.standardHoursCap,
        isAllOvertime: dayTypeRules.isAllOvertime,
      },
      submitted,
      notSubmitted,
      approved,
      stats: {
        totalSupervisors: allGroups.length,
        submittedCount: submitted.length,
        notSubmittedCount: notSubmitted.length,
        approvedCount: approved.length,
        totalWorkers: allGroups.reduce((sum, g) => sum + (g.counts?.laborAssigned || 0) + (g.counts?.operatorsAssigned || 0), 0),
        labor: {
          totalAssigned: allGroups.reduce((sum, g) => sum + (g.counts?.laborAssigned || 0), 0),
          attendedCount: allGroups.reduce((sum, g) => sum + (g.counts?.laborWorked || 0), 0),
          totalNormalHours: Math.round(allGroups.reduce((sum, g) => sum + (g.totals?.laborHours || 0), 0) * 100) / 100,
          totalOtHours: Math.round(allGroups.reduce((sum, g) => sum + (g.totals?.laborOvertime || 0), 0) * 100) / 100,
        },
        operators: {
          totalAssigned: allGroups.reduce((sum, g) => sum + (g.counts?.operatorsAssigned || 0), 0),
          deployedCount: allGroups.reduce((sum, g) => sum + (g.counts?.operatorsWorked || 0), 0),
          mappedCount: allGroups.reduce(
            (sum, g) =>
              sum +
              (g.operators || []).filter((o: any) => o.assignedEquipmentId || (o.assignedEquipmentDisplay && o.assignedEquipmentDisplay !== '—')).length,
            0
          ),
        },
        equipment: {
          totalAssigned: allGroups.reduce((sum, g) => sum + (g.counts?.equipmentAssigned || 0), 0),
          runningCount: allGroups.reduce((sum, g) => sum + (g.counts?.equipmentRunning || 0), 0),
          totalDays: allGroups.reduce((sum, g) => sum + (g.totals?.equipmentDays || 0), 0),
          totalHours: 0,
          totalFuelLiters: allGroups.reduce((sum, g) => sum + (g.totals?.equipmentFuel || 0), 0),
        },
      },
    });
  } catch (error) {
    console.error('Error fetching approval overview:', error);
    res.status(500).json({ error: 'Failed to fetch approval overview' });
  }
};

// 7.1 POST /api/time-entries/approve — Approve time entries
export const approveTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, date } = req.body || {};
    if (!date) {
      res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const approvedAt = new Date();

    const sheetWhere: Record<string, any> = { projectId, date: targetDate };
    if (supervisorId) sheetWhere.supervisorId = supervisorId;

    const sheets = await prisma.mF_OP_DailySheet.findMany({
      where: sheetWhere,
      select: { id: true },
    });

    const sheetIds = sheets.map((s) => s.id);

    await prisma.mF_OP_DailySheet.updateMany({
      where: { id: { in: sheetIds } },
      data: { status: 'approved', isLocked: true, approvedAt },
    });

    // Ensure any remaining shift shortage is balanced as ZIDLE before approving
    const unapprovedEntries = await prisma.mF_OP_TimeEntry.findMany({
      where: { dailySheetId: { in: sheetIds } },
      include: {
        activitySplits: {
          include: { activityCode: true },
        },
      },
    });

    const actCache = new Map<string, string>();
    for (const te of unapprovedEntries) {
      const effShift = Number(te.shiftHours || 0);
      if (effShift <= 0) continue;

      const splits = te.activitySplits || [];
      const sumSplits = splits.reduce((sum, s) => sum + Number(s.hours || 0), 0);
      const shortage = Math.round((effShift - sumSplits) * 100) / 100;
      const hasZidle = splits.some((s) => s.activityCode?.code?.toUpperCase() === 'ZIDLE');

      if (shortage > 0.05 && !hasZidle) {
        const zidleId = await resolveProjectActivityId('ZIDLE', projectId, actCache);
        await prisma.mF_OP_LaborActivitySplit.upsert({
          where: {
            timeEntryId_activityCodeId: {
              timeEntryId: te.id,
              activityCodeId: zidleId,
            },
          },
          update: { hours: shortage },
          create: {
            timeEntryId: te.id,
            activityCodeId: zidleId,
            hours: shortage,
          },
        });
        await prisma.mF_OP_TimeEntry.update({
          where: { id: te.id },
          data: { hours: effShift, status: 'approved' },
        });
      }
    }

    const timeResult = await prisma.mF_OP_TimeEntry.updateMany({
      where: { dailySheetId: { in: sheetIds } },
      data: { status: 'approved' },
    });

    const eqAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: { dailySheetId: { in: sheetIds } },
      select: { id: true },
    });

    if (eqAssignments.length > 0) {
      await prisma.mF_OP_EquipmentDailyLog.updateMany({
        where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
        data: { status: 'approved' },
      });
    }

    res.json({
      success: true,
      approvedCount: timeResult.count,
      message: `Successfully approved daily records for ${sheets.length} supervisor sheet(s).`,
    });
  } catch (error) {
    console.error('Error approving daily entries:', error);
    res.status(500).json({ error: 'Failed to approve daily entries' });
  }
};

// 7.2 POST /api/time-entries/reject — Reject time entries / return to draft
export const rejectTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, date, reason } = req.body || {};
    if (!date || !supervisorId) {
      res.status(400).json({ error: 'supervisorId and date are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);

    const sheet = await prisma.mF_OP_DailySheet.findUnique({
      where: {
        projectId_supervisorId_date: {
          projectId,
          supervisorId,
          date: targetDate,
        },
      },
    });

    if (sheet) {
      await prisma.mF_OP_DailySheet.update({
        where: { id: sheet.id },
        data: { status: 'draft', isLocked: false, remarks: reason ? `Returned: ${reason}` : null },
      });

      await prisma.mF_OP_TimeEntry.updateMany({
        where: { dailySheetId: sheet.id },
        data: { status: 'draft', remarks: reason ? `Returned: ${reason}` : undefined },
      });

      const eqAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
        where: { dailySheetId: sheet.id },
        select: { id: true },
      });

      if (eqAssignments.length > 0) {
        await prisma.mF_OP_EquipmentDailyLog.updateMany({
          where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
          data: { status: 'draft' },
        });
      }
    }

    res.json({
      success: true,
      message: 'Daily records returned to draft for supervisor editing.',
    });
  } catch (error) {
    console.error('Error rejecting daily entries:', error);
    res.status(500).json({ error: 'Failed to return daily entries to draft' });
  }
};

// 7.3 POST /api/time-entries/admin-adjust — Admin inline adjustment
export const adminAdjustWorkerTimeEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, date, inTime, outTime, hours, overtimeHours, additionalHours } = req.body || {};
    if (!employeeId || !date) {
      res.status(400).json({ error: 'employeeId and date are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const { standardHoursCap, isAllOvertime, isSaturday } = await getDayTypeRulesAndId(projectId, targetDate);
    const mealPolicy = await getSiteMealPolicy(projectId);
    const addHoursVal = additionalHours !== undefined ? parseFloat(additionalHours) : 0;

    let calculatedHours = hours !== undefined ? parseFloat(hours) : 0;
    let calculatedOt = overtimeHours !== undefined ? parseFloat(overtimeHours) : 0;
    let breakHours = 0;
    let regularHours = calculatedHours;
    let daysWorked = 0;
    let isLunchDeducted = false;
    let isDinnerDeducted = false;

    const emp = await prisma.mF_P_Employee.findUnique({
      where: { id: employeeId },
      select: { businessPartnerId: true, corporateEmployee: { select: { corporateBusinessPartnerId: true } } },
    });
    const isExternal = Boolean(emp?.businessPartnerId || emp?.corporateEmployee?.corporateBusinessPartnerId);

    if (inTime && outTime) {
      const calc = calculateShiftAndOvertime(inTime, outTime, standardHoursCap, isAllOvertime, isSaturday, isExternal, mealPolicy, addHoursVal);
      calculatedHours = calc.shiftHours;
      calculatedOt = calc.otHours;
      breakHours = calc.breakHours;
      regularHours = calc.regularHours;
      daysWorked = calc.daysWorked;
      isLunchDeducted = calc.isLunchDeducted;
      isDinnerDeducted = calc.isDinnerDeducted;
    }

    const entries = await prisma.mF_OP_TimeEntry.findMany({
      where: { projectId, employeeId, date: targetDate },
      orderBy: { createdAt: 'asc' },
      include: { activitySplits: true },
    });

    if (entries.length > 0) {
      const primary = entries.find((e) => e.activitySplits.length > 0) || entries[0];
      const redundant = entries.filter((e) => e.id !== primary.id);

      // Consolidate redundant entries into primary if any exist
      if (redundant.length > 0) {
        for (const r of redundant) {
          if (r.activitySplits.length > 0) {
            await prisma.mF_OP_LaborActivitySplit.updateMany({
              where: { timeEntryId: r.id },
              data: { timeEntryId: primary.id },
            });
          } else {
            const splitExists = await prisma.mF_OP_LaborActivitySplit.findFirst({
              where: { timeEntryId: primary.id, activityCodeId: r.activityId },
            });
            if (!splitExists) {
              await prisma.mF_OP_LaborActivitySplit.create({
                data: {
                  timeEntryId: primary.id,
                  activityCodeId: r.activityId,
                  hours: r.hours,
                },
              });
            }
          }
        }
        const redIds = redundant.map((r) => r.id);
        await prisma.mF_OP_LaborActivitySplit.deleteMany({
          where: { timeEntryId: { in: redIds } },
        });
        await prisma.mF_OP_TimeEntry.deleteMany({
          where: { id: { in: redIds } },
        });
      }

      // Update primary time entry
      await prisma.mF_OP_TimeEntry.update({
        where: { id: primary.id },
        data: {
          inTime,
          outTime,
          breakHours,
          isLunchDeducted,
          isDinnerDeducted,
          additionalHours: addHoursVal,
          shiftHours: calculatedHours,
          hours: calculatedHours,
          overtimeHours: calculatedOt,
          remarks: 'Adjusted by Admin',
        },
      });

      // Update splits proportionally
      const existingSplits = await prisma.mF_OP_LaborActivitySplit.findMany({
        where: { timeEntryId: primary.id },
      });

      if (existingSplits.length > 1) {
        const oldSplitSum = existingSplits.reduce((s, x) => s + Number(x.hours || 0), 0);
        let allocated = 0;
        for (let i = 0; i < existingSplits.length; i++) {
          const split = existingSplits[i];
          let newHours = oldSplitSum > 0
            ? Math.round((Number(split.hours || 0) / oldSplitSum) * calculatedHours * 100) / 100
            : Math.round((calculatedHours / existingSplits.length) * 100) / 100;
          if (i === existingSplits.length - 1) {
            newHours = Math.max(0, Math.round((calculatedHours - allocated) * 100) / 100);
          } else {
            allocated += newHours;
          }
          await prisma.mF_OP_LaborActivitySplit.update({
            where: { id: split.id },
            data: { hours: newHours },
          });
        }
      } else if (existingSplits.length === 1) {
        await prisma.mF_OP_LaborActivitySplit.update({
          where: { id: existingSplits[0].id },
          data: { hours: calculatedHours },
        });
      } else {
        await prisma.mF_OP_LaborActivitySplit.create({
          data: {
            timeEntryId: primary.id,
            activityCodeId: primary.activityId,
            hours: calculatedHours,
          },
        });
      }
    }

    res.json({
      success: true,
      employeeId,
      inTime,
      outTime,
      hours: regularHours,
      shiftHours: calculatedHours,
      effectiveHours: calculatedHours,
      overtimeHours: calculatedOt,
      additionalHours: addHoursVal,
      breakHours,
      isLunchDeducted,
      isDinnerDeducted,
      daysWorked,
      message: 'Worker entry adjusted successfully by Admin.',
    });
  } catch (error) {
    console.error('Error in adminAdjustWorkerTimeEntry:', error);
    res.status(500).json({ error: 'Failed to adjust worker time entry' });
  }
};

// 8. GET /api/time-entries/operators — Get operator entries
export const getOperatorEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = req.query.supervisorId as string;
    const dateStr = req.query.date as string;
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    if (!dateStr) {
      res.status(400).json({ error: 'Date query parameter is required' });
      return;
    }

    const targetDate = parseDate(dateStr);

    const assignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          date: targetDate,
          ...(supervisorId ? { supervisorId } : {}),
        },
        operatorId: { not: null },
      },
      include: {
        operator: {
          select: {
            id: true,
            callingName: true,
            corporateEmployee: { select: { employeeCode: true, fullName: true, nicNo: true } },
            tradeGroup: { select: { name: true } },
          },
        },
        equipment: {
          select: {
            id: true,
            corporateEquipment: { select: { standardEquipmentNumber: true } },
          },
        },
        dailyLog: true,
      },
    });

    const result = assignments
      .filter((a) => Boolean(a.operator))
      .map((a) => ({
        id: a.id,
        operatorId: a.operator!.id,
        callingName: a.operator!.callingName || a.operator!.corporateEmployee.fullName,
        employeeNumber: a.operator!.corporateEmployee.employeeCode,
        licenseNo: a.operator!.corporateEmployee.nicNo || 'N/A',
        designation: a.operator!.tradeGroup?.name || 'Operator',
        assignedEquipmentId: a.equipmentId,
        assignedEquipmentCode: a.equipment.corporateEquipment.standardEquipmentNumber,
        status: a.dailyLog?.status || 'draft',
        notes: a.dailyLog?.remarks || '',
      }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching operator entries:', error);
    res.status(500).json({ error: 'Failed to fetch operator entries' });
  }
};

// 9. POST /api/time-entries/operators — Save single operator entry
export const saveOperatorEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { operatorId, supervisorId, date, inTime, outTime, assignedEquipmentId, notes, status, shiftHours, hours, otHours, additionalHours } = req.body || {};

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const { effectiveDayTypeId, standardHoursCap, isAllOvertime, isSaturday } = await getDayTypeRulesAndId(projectId, targetDate);
    const mealPolicy = await getSiteMealPolicy(projectId);
    const defaultActivityId = await getOrCreateDefaultActivityId(projectId);

    let effectiveSupId = supervisorId;
    if (!effectiveSupId) {
      const supUser = await prisma.mF_P_User.findFirst({
        where: { projectId, role: 'supervisor' },
        select: { id: true },
      });
      effectiveSupId = supUser?.id || '';
    }

    const dailySheet = await getOrCreateDailySheet(projectId, effectiveSupId, targetDate);

    // Resolve an equipment
    let rawEqId = assignedEquipmentId;
    let validEquipmentId: string | null = null;
    if (rawEqId && rawEqId !== 'ZXQOPRIDLE') {
      const eqExists = await prisma.mF_P_Equipment.findUnique({
        where: { id: rawEqId },
        select: { id: true },
      });
      validEquipmentId = eqExists ? eqExists.id : null;
    }

    let assignmentId: string | undefined;
    if (validEquipmentId) {
      const assignment = await prisma.mF_OP_DailyEquipmentAssignment.upsert({
        where: {
          dailySheetId_equipmentId: {
            dailySheetId: dailySheet.id,
            equipmentId: validEquipmentId,
          },
        },
        update: {
          operatorId,
        },
        create: {
          dailySheetId: dailySheet.id,
          operatorId,
          equipmentId: validEquipmentId,
        },
      });
      assignmentId = assignment.id;

      if (notes || status) {
        await prisma.mF_OP_EquipmentDailyLog.upsert({
          where: { assignmentId: assignment.id },
          update: {
            remarks: notes || undefined,
            status: status || undefined,
          },
          create: {
            assignmentId: assignment.id,
            remarks: notes || null,
            status: status || 'draft',
          },
        });
      }
    }

    // Save/update operator shift time entry
    if (operatorId && (inTime || outTime || shiftHours)) {
      const addHoursVal = Number(additionalHours || 0);
      let shiftHoursVal = Number(shiftHours || 0);
      let overtimeHours = Number(otHours || 0);
      let breakHours = 0;
      let isLunchDeducted = false;
      let isDinnerDeducted = false;
      let regularHours = Number(hours || 0);

      // Preload operator snapshot rate and subcontractor
      const opEmp = await prisma.mF_P_Employee.findUnique({
        where: { id: operatorId },
        select: {
          dailyRate: true,
          businessPartnerId: true,
          tradeGroup: { select: { standardDailyRate: true } },
        },
      });
      const snapRate = opEmp
        ? (Number(opEmp.dailyRate) > 0 ? Number(opEmp.dailyRate) : Number(opEmp.tradeGroup?.standardDailyRate || 1400.0))
        : null;
      const snapBpId = opEmp?.businessPartnerId || null;
      const isExternal = Boolean(snapBpId);

      if (inTime && outTime) {
        const calc = calculateShiftAndOvertime(inTime, outTime, standardHoursCap, isAllOvertime, isSaturday, isExternal, mealPolicy, addHoursVal);
        shiftHoursVal = calc.shiftHours;
        overtimeHours = calc.otHours;
        breakHours = calc.breakHours;
        isLunchDeducted = calc.isLunchDeducted;
        isDinnerDeducted = calc.isDinnerDeducted;
        regularHours = calc.regularHours;
      }

      const teStatus = (dailySheet.status === 'submitted' || dailySheet.status === 'approved')
        ? dailySheet.status
        : (status === 'done' ? 'draft' : (status || 'draft'));

      const existingTe = await prisma.mF_OP_TimeEntry.findFirst({
        where: {
          projectId,
          employeeId: operatorId,
          date: targetDate,
        },
      });

      const teData: any = {
        projectId,
        dailySheetId: dailySheet.id,
        employeeId: operatorId,
        date: targetDate,
        activityId: defaultActivityId,
        equipmentId: validEquipmentId,
        effectiveDayTypeId,
        inTime: inTime || null,
        outTime: outTime || null,
        shiftHours: shiftHoursVal,
        hours: regularHours,
        overtimeHours,
        breakHours,
        isLunchDeducted,
        isDinnerDeducted,
        additionalHours: addHoursVal,
        appliedDailyRate: snapRate,
        appliedBusinessPartnerId: snapBpId,
        remarks: notes || null,
        status: teStatus,
      };

      if (existingTe) {
        if (existingTe.appliedDailyRate !== null) {
          delete teData.appliedDailyRate;
          delete teData.appliedBusinessPartnerId;
        }
        await prisma.mF_OP_TimeEntry.update({
          where: { id: existingTe.id },
          data: teData,
        });
      } else {
        await prisma.mF_OP_TimeEntry.create({
          data: teData,
        });
      }
    }

    res.json({
      success: true,
      assignmentId,
    });
  } catch (error) {
    console.error('Error saving operator entry:', error);
    res.status(500).json({ error: 'Failed to save operator entry' });
  }
};

// 10. POST /api/time-entries/operators/bulk — Save bulk operator entries
export const saveBulkOperatorEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries, date, supervisorId, activeEmployeeIds } = req.body || {};
    if (!Array.isArray(entries) || !date) {
      res.status(400).json({ error: 'entries array and date are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const { effectiveDayTypeId, standardHoursCap, isAllOvertime, isSaturday } = await getDayTypeRulesAndId(projectId, targetDate);
    const mealPolicy = await getSiteMealPolicy(projectId);
    const defaultActivityId = await getOrCreateDefaultActivityId(projectId);

    let effectiveSupId = supervisorId;
    if (!effectiveSupId) {
      const supUser = await prisma.mF_P_User.findFirst({
        where: { projectId, role: 'supervisor' },
        select: { id: true },
      });
      effectiveSupId = supUser?.id || '';
    }

    const dailySheet = await getOrCreateDailySheet(projectId, effectiveSupId, targetDate);

    if (Array.isArray(activeEmployeeIds) && dailySheet) {
      await prisma.mF_OP_TimeEntry.deleteMany({
        where: {
          dailySheetId: dailySheet.id,
          status: { not: 'approved' },
          employeeId: { notIn: activeEmployeeIds },
        },
      });
      await prisma.mF_OP_DailyEquipmentAssignment.deleteMany({
        where: {
          dailySheetId: dailySheet.id,
          operatorId: { not: null, notIn: activeEmployeeIds },
        },
      });

      // Synchronize MF_OP_DailyAssignment for operators on sync
      await prisma.mF_OP_DailyAssignment.deleteMany({
        where: {
          dailySheetId: dailySheet.id,
          employeeId: { notIn: activeEmployeeIds },
          employee: {
            OR: [
              { isOperator: true },
              { corporateEmployee: { isOperator: true } },
            ],
          },
        },
      });

      for (const opId of activeEmployeeIds) {
        await prisma.mF_OP_DailyAssignment.upsert({
          where: {
            dailySheetId_employeeId: {
              dailySheetId: dailySheet.id,
              employeeId: opId,
            },
          },
          update: {},
          create: {
            dailySheetId: dailySheet.id,
            employeeId: opId,
          },
        });
      }
    }

    // Pre-load operator snapshots for bulk processing
    const opIds = entries.map((e: any) => e.operatorId || e.id).filter(Boolean);
    const opEmployees = await prisma.mF_P_Employee.findMany({
      where: { id: { in: opIds } },
      select: {
        id: true,
        dailyRate: true,
        businessPartnerId: true,
        tradeGroup: { select: { standardDailyRate: true } },
      },
    });
    const opEmpMap = new Map(
      opEmployees.map((e) => [
        e.id,
        {
          rate: Number(e.dailyRate) > 0 ? Number(e.dailyRate) : Number(e.tradeGroup?.standardDailyRate || 1400.0),
          bpId: e.businessPartnerId || null,
        },
      ])
    );

    for (const item of entries) {
      const opId = item.operatorId || item.id;
      if (!opId) continue;

      const opSnap = opEmpMap.get(opId);
      const snapRate = opSnap ? opSnap.rate : null;
      const snapBpId = opSnap ? opSnap.bpId : null;

      const rawEqId = item.assignedEquipmentId || item.equipmentId;
      let validEquipmentId: string | null = null;
      if (rawEqId && rawEqId !== 'ZXQOPRIDLE') {
        const eqExists = await prisma.mF_P_Equipment.findUnique({
          where: { id: rawEqId },
          select: { id: true },
        });
        validEquipmentId = eqExists ? eqExists.id : null;
      }

      const rawSplits = Array.isArray(item.splits) && item.splits.length > 0
        ? item.splits
        : (Array.isArray(item.equipmentSplits) && item.equipmentSplits.length > 0 ? item.equipmentSplits : []);

      // Validate all machine splits
      const validSplits: Array<{ equipmentId: string; hours: number }> = [];
      for (const s of rawSplits) {
        if (!s.equipmentId || s.equipmentId === 'ZXQOPRIDLE') continue;
        const eqExists = await prisma.mF_P_Equipment.findUnique({
          where: { id: s.equipmentId },
          select: { id: true },
        });
        if (eqExists && Number(s.hours) > 0) {
          validSplits.push({ equipmentId: eqExists.id, hours: Number(s.hours) });
        }
      }

      // If no valid splits passed but single assignedEquipmentId exists:
      if (validSplits.length === 0 && validEquipmentId) {
        validSplits.push({ equipmentId: validEquipmentId, hours: Number(item.hours || item.shiftHours || 0) });
      }

      // Operator machine assignments are recorded directly on the operator's time entry splits.
      // Do NOT auto-create DailyEquipmentAssignment / EquipmentDailyLog records here so they do not pollute the Equipment tab or Admin Plant & Equipment logs.
      const activeEqIds = validSplits.map((s) => s.equipmentId);

      // 2. Upsert Operator Shift Time Entry with In/Out Times
      if (item.inTime || item.outTime || item.shiftHours || validSplits.length > 0) {
        let shiftHoursVal: number = Number(item.shiftHours || 0);
        let overtimeHours: number = Number(item.otHours || item.overtimeHours || 0);
        let breakHours: number = 0;
        let isLunchDeducted: boolean = false;
        let isDinnerDeducted: boolean = false;
        let regularHours: number = Number(item.hours || 0);

        const addHoursVal = Number(item.additionalHours || 0);
        const isExternal = Boolean(snapBpId);

        if (item.inTime && item.outTime) {
          // Conflict Protection: Check if operator is already booked on overlapping hours by another supervisor
          const otherSupOpEntries = await prisma.mF_OP_TimeEntry.findMany({
            where: {
              projectId,
              employeeId: opId,
              date: targetDate,
              dailySheetId: { not: dailySheet.id },
              inTime: { not: null },
              outTime: { not: null },
            },
            include: {
              dailySheet: {
                select: {
                  supervisor: { select: { fullName: true, username: true } },
                },
              },
              equipment: {
                select: {
                  corporateEquipment: { select: { standardEquipmentNumber: true } },
                },
              },
            },
          });

          const conflictingOp = otherSupOpEntries.find((oe) => {
            if (!oe.inTime || !oe.outTime) return false;
            return item.inTime < oe.outTime && item.outTime > oe.inTime;
          });

          if (conflictingOp) {
            const supName = conflictingOp.dailySheet?.supervisor?.fullName || conflictingOp.dailySheet?.supervisor?.username || 'another supervisor';
            const eqCode = conflictingOp.equipment?.corporateEquipment?.standardEquipmentNumber || 'a machine';
            res.status(409).json({
              error: `Time conflict: Operator is already recorded by Supervisor ${supName} on ${eqCode} from ${conflictingOp.inTime} to ${conflictingOp.outTime}. Overlapping shifts cannot overwrite existing attendance.`,
            });
            return;
          }

          const calc = calculateShiftAndOvertime(item.inTime, item.outTime, standardHoursCap, isAllOvertime, isSaturday, isExternal, mealPolicy, addHoursVal);
          shiftHoursVal = calc.shiftHours;
          overtimeHours = calc.otHours;
          breakHours = calc.breakHours;
          isLunchDeducted = calc.isLunchDeducted;
          isDinnerDeducted = calc.isDinnerDeducted;
          regularHours = calc.regularHours;
        }

        const teStatus = (dailySheet.status === 'submitted' || dailySheet.status === 'approved')
          ? dailySheet.status
          : (item.status === 'done' ? 'draft' : (item.status || 'draft'));

        // Reconcile operator time entries: delete stale draft entries for this operator on this date under this sheet
        // that are not part of current valid splits
        if (activeEqIds.length > 0) {
          await prisma.mF_OP_TimeEntry.deleteMany({
            where: {
              projectId,
              dailySheetId: dailySheet.id,
              employeeId: opId,
              date: targetDate,
              status: { not: 'approved' },
              OR: [
                { equipmentId: null },
                { equipmentId: { notIn: activeEqIds } },
              ],
            },
          });
        } else {
          await prisma.mF_OP_TimeEntry.deleteMany({
            where: {
              projectId,
              dailySheetId: dailySheet.id,
              employeeId: opId,
              date: targetDate,
              status: { not: 'approved' },
              equipmentId: { not: null },
            },
          });
        }

        if (validSplits.length > 0) {
          // Persist a time entry per machine split for granular ERP reporting
          for (let sIdx = 0; sIdx < validSplits.length; sIdx++) {
            const split = validSplits[sIdx];
            // Strictly scope to current supervisor dailySheet to prevent cross-supervisor overwriting
            const existingTe = await prisma.mF_OP_TimeEntry.findFirst({
              where: {
                projectId,
                dailySheetId: dailySheet.id,
                employeeId: opId,
                date: targetDate,
                equipmentId: split.equipmentId,
              },
            });

            const teData: any = {
              projectId,
              dailySheetId: dailySheet.id,
              employeeId: opId,
              date: targetDate,
              activityId: defaultActivityId,
              equipmentId: split.equipmentId,
              effectiveDayTypeId,
              inTime: item.inTime || null,
              outTime: item.outTime || null,
              shiftHours: shiftHoursVal,
              hours: split.hours,
              overtimeHours: sIdx === 0 ? overtimeHours : 0,
              breakHours: sIdx === 0 ? breakHours : 0,
              isLunchDeducted: sIdx === 0 ? isLunchDeducted : false,
              isDinnerDeducted: sIdx === 0 ? isDinnerDeducted : false,
              additionalHours: sIdx === 0 ? addHoursVal : 0,
              appliedDailyRate: snapRate,
              appliedBusinessPartnerId: snapBpId,
              remarks: item.notes || null,
              status: teStatus,
            };

            if (existingTe) {
              if (existingTe.appliedDailyRate !== null) {
                delete teData.appliedDailyRate;
                delete teData.appliedBusinessPartnerId;
              }
              await prisma.mF_OP_TimeEntry.update({
                where: { id: existingTe.id },
                data: teData,
              });
            } else {
              await prisma.mF_OP_TimeEntry.create({
                data: teData,
              });
            }
          }
        } else {
          // No equipment (e.g. idle operator)
          const existingTe = await prisma.mF_OP_TimeEntry.findFirst({
            where: {
              projectId,
              dailySheetId: dailySheet.id,
              employeeId: opId,
              date: targetDate,
            },
          });

          const teData: any = {
            projectId,
            dailySheetId: dailySheet.id,
            employeeId: opId,
            date: targetDate,
            activityId: defaultActivityId,
            equipmentId: null,
            effectiveDayTypeId,
            inTime: item.inTime || null,
            outTime: item.outTime || null,
            shiftHours: shiftHoursVal,
            hours: regularHours,
            overtimeHours,
            breakHours,
            isLunchDeducted,
            isDinnerDeducted,
            additionalHours: addHoursVal,
            appliedDailyRate: snapRate,
            appliedBusinessPartnerId: snapBpId,
            remarks: item.notes || 'Exter. Equipment Operator Idle (ZXQOPRIDLE)',
            status: teStatus,
          };

          if (existingTe) {
            if (existingTe.appliedDailyRate !== null) {
              delete teData.appliedDailyRate;
              delete teData.appliedBusinessPartnerId;
            }
            await prisma.mF_OP_TimeEntry.update({
              where: { id: existingTe.id },
              data: teData,
            });
          } else {
            await prisma.mF_OP_TimeEntry.create({
              data: teData,
            });
          }
        }
      }
    }

    res.json({ success: true, count: entries.length });
  } catch (error) {
    console.error('Error saving bulk operator entries:', error);
    res.status(500).json({ error: 'Failed to save bulk operator entries' });
  }
};

// 11. POST /api/time-entries/equipment/bulk — Save bulk equipment daily logs
export const saveBulkEquipmentLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries, date, supervisorId } = req.body || {};
    if (!Array.isArray(entries) || !date) {
      res.status(400).json({ error: 'entries array and date are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    let effectiveSupId = supervisorId;
    if (!effectiveSupId) {
      const supUser = await prisma.mF_P_User.findFirst({
        where: { projectId, role: 'supervisor' },
        select: { id: true },
      });
      effectiveSupId = supUser?.id || '';
    }

    const dailySheet = await getOrCreateDailySheet(projectId, effectiveSupId, targetDate);

    // Reconcile: delete stale draft equipment assignments removed by supervisor
    const incomingEqIds = (entries || []).map((item: any) => item.id || item.equipmentId).filter(Boolean);
    const staleAssignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheetId: dailySheet.id,
        ...(incomingEqIds.length > 0 ? { equipmentId: { notIn: incomingEqIds } } : {}),
      },
      include: { dailyLog: true },
    });
    for (const asgn of staleAssignments) {
      if (!asgn.dailyLog || asgn.dailyLog.status === 'draft' || asgn.dailyLog.status === 'pending') {
        if (asgn.dailyLog) {
          await prisma.mF_OP_EquipmentDailyLogActivity.deleteMany({ where: { dailyLogId: asgn.dailyLog.id } });
          await prisma.mF_OP_EquipmentDailyLog.delete({ where: { id: asgn.dailyLog.id } });
        }
        await prisma.mF_OP_DailyEquipmentAssignment.delete({ where: { id: asgn.id } });
      }
    }

    for (const item of entries) {
      const eqId = item.id || item.equipmentId;
      if (!eqId) continue;

      // Do NOT fallback to firstOp! Never hijack all machines to the first operator.
      const explicitOpId = item.operatorId || null;

      const assignment = await prisma.mF_OP_DailyEquipmentAssignment.upsert({
        where: {
          dailySheetId_equipmentId: {
            dailySheetId: dailySheet.id,
            equipmentId: eqId,
          },
        },
        update: {
          operatorId: explicitOpId,
        },
        create: {
          dailySheetId: dailySheet.id,
          operatorId: explicitOpId,
          equipmentId: eqId,
        },
      });

      const effectiveNetHours = Number(item.netHours || item.hoursValue || item.workingHours || 0);
      const effectiveWorkingHours = Number(item.workingHours || item.hoursValue || item.netHours || 0);

      const loggedQty = item.daysValue !== undefined && Number(item.daysValue) > 0
        ? Number(item.daysValue)
        : (effectiveNetHours > 0 ? effectiveNetHours : Number(item.totalUtilization || 0));

      const dailyLog = await prisma.mF_OP_EquipmentDailyLog.upsert({
        where: { assignmentId: assignment.id },
        create: {
          assignmentId: assignment.id,
          initialMeter: item.startMeter !== undefined ? Number(item.startMeter) : 0,
          finalMeter: item.endMeter !== undefined ? Number(item.endMeter) : 0,
          netRunningHours: effectiveNetHours,
          workingHours: effectiveWorkingHours,
          idleHours: item.idleHours !== undefined ? Number(item.idleHours) : 0,
          breakdownHours: item.breakdownHours !== undefined ? Number(item.breakdownHours) : 0,
          fuelLiters: item.fuelIssuedLiters !== undefined ? Number(item.fuelIssuedLiters) : (item.fuelLiters ? Number(item.fuelLiters) : 0),
          totalMileage: item.totalMileage !== undefined ? Number(item.totalMileage) : 0,
          startMileage: item.startMileage !== undefined ? Number(item.startMileage) : 0,
          endMileage: item.endMileage !== undefined ? Number(item.endMileage) : 0,
          totalUtilization: loggedQty,
          remarks: item.remarks || null,
          status: item.status || 'draft',
        },
        update: {
          initialMeter: item.startMeter !== undefined ? Number(item.startMeter) : undefined,
          finalMeter: item.endMeter !== undefined ? Number(item.endMeter) : undefined,
          netRunningHours: effectiveNetHours > 0 ? effectiveNetHours : (item.netHours !== undefined ? Number(item.netHours) : undefined),
          workingHours: effectiveWorkingHours > 0 ? effectiveWorkingHours : (item.workingHours !== undefined ? Number(item.workingHours) : undefined),
          idleHours: item.idleHours !== undefined ? Number(item.idleHours) : undefined,
          breakdownHours: item.breakdownHours !== undefined ? Number(item.breakdownHours) : undefined,
          fuelLiters: item.fuelIssuedLiters !== undefined ? Number(item.fuelIssuedLiters) : (item.fuelLiters !== undefined ? Number(item.fuelLiters) : undefined),
          totalMileage: item.totalMileage !== undefined ? Number(item.totalMileage) : undefined,
          startMileage: item.startMileage !== undefined ? Number(item.startMileage) : undefined,
          endMileage: item.endMileage !== undefined ? Number(item.endMileage) : undefined,
          totalUtilization: loggedQty,
          remarks: item.remarks !== undefined ? item.remarks : undefined,
          status: item.status || undefined,
        },
      });

      const rawSplits = (Array.isArray(item.activitySplits) && item.activitySplits.length > 0)
        ? item.activitySplits
        : (Array.isArray(item.splits) && item.splits.length > 0)
        ? item.splits
        : [];

      if (rawSplits.length > 0) {
        await prisma.mF_OP_EquipmentDailyLogActivity.deleteMany({
          where: { dailyLogId: dailyLog.id },
        });

        for (const split of rawSplits) {
          let actCodeId = null;
          const rawCode = split.activityCode || split.code;

          if (rawCode) {
            actCodeId = await resolveProjectActivityId(rawCode, projectId);
          } else if (split.activityCodeId || split.activityId) {
            const possibleId = String(split.activityCodeId || split.activityId);
            if (!possibleId.startsWith('split-')) {
              actCodeId = await resolveProjectActivityId(possibleId, projectId);
            }
          }

          if (!actCodeId) {
            actCodeId = await getOrCreateDefaultActivityId(projectId);
          }

          if (actCodeId) {
            const utilVal = Number(split.utilization ?? split.hours ?? split.quantity ?? 0);
            await prisma.mF_OP_EquipmentDailyLogActivity.create({
              data: {
                dailyLogId: dailyLog.id,
                activityCodeId: actCodeId,
                utilization: utilVal > 0 ? utilVal : (loggedQty > 0 ? loggedQty : effectiveWorkingHours),
              },
            });
          }
        }
      } else if (loggedQty > 0 || effectiveWorkingHours > 0) {
        // Fallback: If equipment has logged hours/days but no explicit split was picked, auto-assign default activity
        const existingCount = await prisma.mF_OP_EquipmentDailyLogActivity.count({
          where: { dailyLogId: dailyLog.id },
        });
        if (existingCount === 0) {
          const opTe = await prisma.mF_OP_TimeEntry.findFirst({
            where: {
              projectId,
              dailySheetId: dailySheet.id,
              equipmentId: eqId,
              date: targetDate,
            },
            select: { activityId: true },
          });

          const defaultActId = opTe?.activityId || (await getOrCreateDefaultActivityId(projectId));
          if (defaultActId) {
            await prisma.mF_OP_EquipmentDailyLogActivity.create({
              data: {
                dailyLogId: dailyLog.id,
                activityCodeId: defaultActId,
                utilization: loggedQty > 0 ? loggedQty : effectiveWorkingHours,
              },
            });
          }
        }
      }
    }

    res.json({ success: true, count: entries.length });
  } catch (error) {
    console.error('Error saving equipment logs:', error);
    res.status(500).json({ error: 'Failed to save equipment logs' });
  }
};

// 12. POST /api/time-entries/labor/bulk — Save bulk labor time entries
export const saveBulkLaborTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries, date, supervisorId, activeEmployeeIds } = req.body || {};
    if (!Array.isArray(entries) || !date) {
      res.status(400).json({ error: 'entries array and date are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const { effectiveDayTypeId, standardHoursCap, isAllOvertime, isSaturday } = await getDayTypeRulesAndId(projectId, targetDate);
    const mealPolicy = await getSiteMealPolicy(projectId);

    let effectiveSupId = supervisorId;
    if (!effectiveSupId) {
      const supUser = await prisma.mF_P_User.findFirst({
        where: { projectId, role: 'supervisor' },
        select: { id: true },
      });
      effectiveSupId = supUser?.id || '';
    }

    const dailySheet = effectiveSupId ? await getOrCreateDailySheet(projectId, effectiveSupId, targetDate) : null;

    if (Array.isArray(activeEmployeeIds) && dailySheet) {
      await prisma.mF_OP_TimeEntry.deleteMany({
        where: {
          dailySheetId: dailySheet.id,
          status: 'draft',
          employeeId: { notIn: activeEmployeeIds },
        },
      });

      // Synchronize MF_OP_DailyAssignment for laborers on sync
      await prisma.mF_OP_DailyAssignment.deleteMany({
        where: {
          dailySheetId: dailySheet.id,
          employeeId: { notIn: activeEmployeeIds },
          employee: {
            isOperator: false,
            corporateEmployee: { isOperator: false },
          },
        },
      });

      if (activeEmployeeIds.length > 0) {
        await prisma.mF_OP_DailyAssignment.createMany({
          data: activeEmployeeIds.map((empId: string) => ({
            dailySheetId: dailySheet.id,
            employeeId: empId,
          })),
          skipDuplicates: true,
        });
      }
    }
    const activityResolutionCache = new Map<string, string>();
    const equipmentValidationCache = new Map<string, string | null>();

    // Group incoming entries by employeeId
    const entriesByEmployee = new Map<string, typeof entries>();
    for (const item of entries) {
      const { employeeId, activityId } = item;
      if (!employeeId || !activityId) continue;
      if (!entriesByEmployee.has(employeeId)) {
        entriesByEmployee.set(employeeId, []);
      }
      entriesByEmployee.get(employeeId)!.push(item);
    }

    // Pre-load labor snapshots for bulk processing
    const allEmpIds = Array.from(entriesByEmployee.keys());
    const empRecords = await prisma.mF_P_Employee.findMany({
      where: { id: { in: allEmpIds } },
      select: {
        id: true,
        dailyRate: true,
        businessPartnerId: true,
        tradeGroup: { select: { standardDailyRate: true } },
      },
    });
    const empSnapMap = new Map(
      empRecords.map((e) => [
        e.id,
        {
          rate: Number(e.dailyRate) > 0 ? Number(e.dailyRate) : Number(e.tradeGroup?.standardDailyRate || 1400.0),
          bpId: e.businessPartnerId || null,
        },
      ])
    );

    for (const [employeeId, empEntries] of entriesByEmployee.entries()) {
      const empSnap = empSnapMap.get(employeeId);
      const snapRate = empSnap ? empSnap.rate : null;
      const snapBpId = empSnap ? empSnap.bpId : null;

      // Extract shift attributes across all activity splits for this worker
      const finalInTime = empEntries.find((e) => e.inTime)?.inTime ?? null;
      const finalOutTime = empEntries.find((e) => e.outTime)?.outTime ?? null;
      const addHoursVal = Math.max(...empEntries.map((e) => Number(e.additionalHours || 0)), 0);
      const totalActivityHours = empEntries.reduce((sum, item) => sum + (item.hours !== undefined ? parseFloat(item.hours) : 0), 0);
      const firstEntry = empEntries[0];
      const primaryResolvedActivityId = await resolveProjectActivityId(firstEntry.activityId, projectId, activityResolutionCache);

      let validEquipmentId: string | null = null;
      const eqIdCandidate = empEntries.find((e) => e.equipmentId)?.equipmentId;
      if (eqIdCandidate) {
        if (equipmentValidationCache.has(eqIdCandidate)) {
          validEquipmentId = equipmentValidationCache.get(eqIdCandidate)!;
        } else {
          const eqExists = await prisma.mF_P_Equipment.findUnique({
            where: { id: eqIdCandidate },
            select: { id: true },
          });
          validEquipmentId = eqExists ? eqExists.id : null;
          equipmentValidationCache.set(eqIdCandidate, validEquipmentId);
        }
      }
      const combinedRemarks = empEntries.map((e) => e.remarks).filter(Boolean).join('; ') || null;

      let shiftHoursVal: number | null = null;
      let overtimeHours = 0;
      let breakHours = 0;
      let isLunchDeducted = false;
      let isDinnerDeducted = false;
      const isExternal = Boolean(empSnap?.bpId);

      if (finalInTime && finalOutTime) {
        const calc = calculateShiftAndOvertime(finalInTime, finalOutTime, standardHoursCap, isAllOvertime, isSaturday, isExternal, mealPolicy, addHoursVal);
        shiftHoursVal = calc.shiftHours;
        overtimeHours = calc.otHours;
        breakHours = calc.breakHours;
        isLunchDeducted = calc.isLunchDeducted;
        isDinnerDeducted = calc.isDinnerDeducted;
      } else {
        const breakSnap = computeBreakHoursAndSnapshots(finalInTime, finalOutTime, mealPolicy);
        breakHours = breakSnap.breakHours;
        isLunchDeducted = breakSnap.isLunchDeducted;
        isDinnerDeducted = breakSnap.isDinnerDeducted;
        const effectiveWithAdd = Math.max(0, totalActivityHours + addHoursVal);
        shiftHoursVal = effectiveWithAdd;
        if (effectiveWithAdd <= 0) {
          overtimeHours = 0;
        } else if (isAllOvertime) {
          overtimeHours = effectiveWithAdd;
        } else if (isExternal) {
          const cap = isSaturday || standardHoursCap === 5.5 ? 5.5 : 8.0;
          overtimeHours = effectiveWithAdd > cap ? Math.round((effectiveWithAdd - cap) * 100) / 100 : 0;
        } else if (isSaturday || standardHoursCap === 5.5) {
          overtimeHours = Math.round((effectiveWithAdd - 5.5) * 100) / 100;
        } else if (effectiveWithAdd > 6.0) {
          overtimeHours = Math.round((effectiveWithAdd - 8.0) * 100) / 100;
        } else {
          overtimeHours = Math.round((effectiveWithAdd - 4.0) * 100) / 100;
        }
      }

      // Conflict Protection: Check if worker has an active overlapping shift logged by another supervisor
      if (finalInTime && finalOutTime) {
        const otherSupEntries = await prisma.mF_OP_TimeEntry.findMany({
          where: {
            projectId,
            employeeId,
            date: targetDate,
            dailySheetId: { not: dailySheet?.id },
            inTime: { not: null },
            outTime: { not: null },
          },
          include: {
            dailySheet: {
              select: {
                supervisor: { select: { fullName: true, username: true } },
              },
            },
          },
        });

        const conflicting = otherSupEntries.find((oe) => {
          if (!oe.inTime || !oe.outTime) return false;
          return finalInTime < oe.outTime && finalOutTime > oe.inTime;
        });

        if (conflicting) {
          const supName = conflicting.dailySheet?.supervisor?.fullName || conflicting.dailySheet?.supervisor?.username || 'another supervisor';
          res.status(409).json({
            error: `Time conflict: Worker is already recorded by Supervisor ${supName} from ${conflicting.inTime} to ${conflicting.outTime}. Overlapping shifts cannot overwrite existing attendance.`,
          });
          return;
        }
      }

      // Scope to employee and date to find existing entries (consolidates any historical duplicates)
      const existingEntries = await prisma.mF_OP_TimeEntry.findMany({
        where: {
          projectId,
          employeeId,
          date: targetDate,
        },
        orderBy: { createdAt: 'asc' },
      });

      let parentEntryId: string;
      const primary = existingEntries[0];
      const redundant = existingEntries.slice(1);

      if (primary) {
        parentEntryId = primary.id;
        if (primary.status !== 'submitted' && primary.status !== 'approved') {
          await prisma.mF_OP_TimeEntry.update({
            where: { id: primary.id },
            data: {
              dailySheetId: dailySheet?.id || primary.dailySheetId || null,
              recordedById: effectiveSupId || primary.recordedById || null,
              hours: totalActivityHours,
              shiftHours: shiftHoursVal,
              overtimeHours,
              breakHours,
              isLunchDeducted,
              isDinnerDeducted,
              additionalHours: addHoursVal,
              inTime: finalInTime,
              outTime: finalOutTime,
              activityId: primaryResolvedActivityId,
              equipmentId: validEquipmentId ?? primary.equipmentId,
              remarks: combinedRemarks ?? primary.remarks,
              ...(primary.appliedDailyRate === null && snapRate !== null ? {
                appliedDailyRate: snapRate,
                appliedBusinessPartnerId: snapBpId,
              } : {}),
            },
          });
        }
      } else {
        try {
          const created = await prisma.mF_OP_TimeEntry.create({
            data: {
              projectId,
              dailySheetId: dailySheet?.id || null,
              employeeId,
              recordedById: effectiveSupId || null,
              date: targetDate,
              activityId: primaryResolvedActivityId,
              equipmentId: validEquipmentId,
              effectiveDayTypeId,
              inTime: finalInTime,
              outTime: finalOutTime,
              hours: totalActivityHours,
              shiftHours: shiftHoursVal,
              overtimeHours,
              breakHours,
              isLunchDeducted,
              isDinnerDeducted,
              additionalHours: addHoursVal,
              appliedDailyRate: snapRate,
              appliedBusinessPartnerId: snapBpId,
              remarks: combinedRemarks,
              status: 'draft',
            },
          });
          parentEntryId = created.id;
        } catch (err: any) {
          if (err?.code === 'P2002') {
            const existing = await prisma.mF_OP_TimeEntry.findUnique({
              where: {
                projectId_employeeId_date: {
                  projectId,
                  employeeId,
                  date: targetDate,
                },
              },
            });
            parentEntryId = existing!.id;
          } else {
            throw err;
          }
        }
      }

      // Delete any redundant secondary entries from previous multi-activity records
      if (redundant.length > 0) {
        const redIds = redundant.map((r) => r.id);
        await prisma.mF_OP_LaborActivitySplit.deleteMany({
          where: { timeEntryId: { in: redIds } },
        });
        await prisma.mF_OP_TimeEntry.deleteMany({
          where: { id: { in: redIds } },
        });
      }

      // Sync MF_OP_LaborActivitySplit child records for this parentEntryId
      await prisma.mF_OP_LaborActivitySplit.deleteMany({
        where: { timeEntryId: parentEntryId },
      });

      let totalSavedSplitHours = 0;
      let hasZidleExplicit = false;

      for (const item of empEntries) {
        const resolvedId = await resolveProjectActivityId(item.activityId, projectId, activityResolutionCache);
        const itemHours = item.hours !== undefined ? parseFloat(item.hours) : 0;
        if (itemHours > 0) {
          const actCodeRecord = await prisma.mF_P_ActivityCode.findUnique({
            where: { id: resolvedId },
            select: { code: true },
          });
          if (actCodeRecord?.code?.toUpperCase() === 'ZIDLE') {
            hasZidleExplicit = true;
          }

          totalSavedSplitHours += itemHours;
          await prisma.mF_OP_LaborActivitySplit.upsert({
            where: {
              timeEntryId_activityCodeId: {
                timeEntryId: parentEntryId,
                activityCodeId: resolvedId,
              },
            },
            update: { hours: itemHours },
            create: {
              timeEntryId: parentEntryId,
              activityCodeId: resolvedId,
              hours: itemHours,
            },
          });
        }
      }

      // Auto-balance Idle (ZIDLE) into Database:
      // Only finalize ZIDLE if this sheet is locked/submitted OR if supervisor marked this worker as 'done'.
      // While in pure 'draft' mode, supervisor is actively entering hours so we do NOT inject premature ZIDLE records.
      const isSheetLockedOrSubmitted = dailySheet?.status === 'submitted' || dailySheet?.status === 'approved' || dailySheet?.isLocked;
      const isDone = empEntries.some((e: any) => e.status === 'done');

      const effectiveShift = shiftHoursVal !== null && shiftHoursVal !== undefined ? Number(shiftHoursVal) : totalSavedSplitHours;
      const idleShortage = !hasZidleExplicit && effectiveShift > totalSavedSplitHours
        ? Math.round((effectiveShift - totalSavedSplitHours) * 100) / 100
        : 0;

      if (idleShortage > 0 && (isSheetLockedOrSubmitted || isDone)) {
        const zidleId = await resolveProjectActivityId('ZIDLE', projectId, activityResolutionCache);
        await prisma.mF_OP_LaborActivitySplit.upsert({
          where: {
            timeEntryId_activityCodeId: {
              timeEntryId: parentEntryId,
              activityCodeId: zidleId,
            },
          },
          update: { hours: idleShortage },
          create: {
            timeEntryId: parentEntryId,
            activityCodeId: zidleId,
            hours: idleShortage,
          },
        });
        totalSavedSplitHours += idleShortage;
      }

      // Update parent TimeEntry hours to match the full shift / total of all splits (productive + ZIDLE)
      if (totalSavedSplitHours > 0) {
        await prisma.mF_OP_TimeEntry.update({
          where: { id: parentEntryId },
          data: {
            hours: totalSavedSplitHours,
          },
        });
      }
    }

    res.json({ success: true, count: entries.length });
  } catch (error) {
    console.error('Error saving bulk labor time entries:', error);
    res.status(500).json({ error: 'Failed to save labor time entries' });
  }
};
