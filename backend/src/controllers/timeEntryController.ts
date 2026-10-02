import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getDefaultTenantId } from './employeeController';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

// Helper: resolve effective day type and Overtime rules for a date
interface DayTypeOvertimeRule {
  effectiveDayTypeId: string;
  standardHoursCap: number; // 8.0 for Normal, 6.0 for Saturday (07:00-13:00), 0.0 for Sunday/Holiday
  isAllOvertime: boolean;   // true for Sunday & Poya/Public Holiday
  dayTypeName: string;
}

export async function getDayTypeRulesAndId(tenantId: string, date: Date): Promise<DayTypeOvertimeRule> {
  // 1. Check if calendar day holiday/special day exists in CalendarDay table
  const calendarDay = await prisma.calendarDay.findUnique({
    where: {
      tenantId_date: {
        tenantId,
        date,
      },
    },
    include: { dayType: true },
  });

  if (calendarDay && calendarDay.dayType) {
    const name = calendarDay.dayType.name.toLowerCase();
    if (name.includes('sunday') || name.includes('public holiday') || name.includes('holiday') || name.includes('poya')) {
      return {
        effectiveDayTypeId: calendarDay.dayTypeId,
        standardHoursCap: 0.0,
        isAllOvertime: true,
        dayTypeName: calendarDay.dayType.name,
      };
    }
    if (name.includes('saturday')) {
      return {
        effectiveDayTypeId: calendarDay.dayTypeId,
        standardHoursCap: 6.0,
        isAllOvertime: false,
        dayTypeName: calendarDay.dayType.name,
      };
    }
    // 3. Shutdown: Indicator only! If someone works on a shutdown day, hours follow the actual day of week:
    if (name.includes('shutdown')) {
      const dayOfWeek = date.getUTCDay();
      if (dayOfWeek === 0) {
        return {
          effectiveDayTypeId: calendarDay.dayTypeId,
          standardHoursCap: 0.0,
          isAllOvertime: true,
          dayTypeName: 'Shutdown (Sunday - 100% OT)',
        };
      }
      if (dayOfWeek === 6) {
        return {
          effectiveDayTypeId: calendarDay.dayTypeId,
          standardHoursCap: 6.0,
          isAllOvertime: false,
          dayTypeName: 'Shutdown (Saturday - 6.0h Cap)',
        };
      }
      return {
        effectiveDayTypeId: calendarDay.dayTypeId,
        standardHoursCap: 8.0,
        isAllOvertime: false,
        dayTypeName: 'Shutdown (Weekday - 8.0h Cap)',
      };
    }

    // Normal Day (8.0 hours cap, >8h is OT)
    return {
      effectiveDayTypeId: calendarDay.dayTypeId,
      standardHoursCap: 8.0,
      isAllOvertime: false,
      dayTypeName: calendarDay.dayType.name,
    };
  }

  // 2. Determine Day Type from day of the week
  // 0 = Sunday, 6 = Saturday, 1..5 = Monday..Friday
  const dayOfWeek = date.getUTCDay();

  if (dayOfWeek === 0) {
    // Sunday: 0.0 normal hours, 100% overtime for all hours worked
    let sundayType = await prisma.dayType.findFirst({
      where: { tenantId, name: 'Sunday' },
    });
    if (!sundayType) {
      sundayType = await prisma.dayType.create({
        data: { tenantId, name: 'Sunday', rateMultiplier: 1.5 },
      });
    }
    return {
      effectiveDayTypeId: sundayType.id,
      standardHoursCap: 0.0,
      isAllOvertime: true,
      dayTypeName: 'Sunday',
    };
  }

  if (dayOfWeek === 6) {
    // Saturday: Half-day (07:00 to 13:00 = 6.0 standard hours), hours after 13:00 (>6h) are OT
    let satType = await prisma.dayType.findFirst({
      where: { tenantId, name: 'Saturday' },
    });
    if (!satType) {
      satType = await prisma.dayType.create({
        data: { tenantId, name: 'Saturday', rateMultiplier: 1.0 },
      });
    }
    return {
      effectiveDayTypeId: satType.id,
      standardHoursCap: 6.0,
      isAllOvertime: false,
      dayTypeName: 'Saturday',
    };
  }

  // Monday to Friday: Standard Normal Day (8.0 hours standard, >8h is OT)
  let normalDay = await prisma.dayType.findFirst({
    where: { tenantId, name: 'Normal Day' },
  });
  if (!normalDay) {
    normalDay = await prisma.dayType.create({
      data: { tenantId, name: 'Normal Day', rateMultiplier: 1.0 },
    });
  }
  return {
    effectiveDayTypeId: normalDay.id,
    standardHoursCap: 8.0,
    isAllOvertime: false,
    dayTypeName: 'Normal Day',
  };
}

// Helper: parse date to UTC midnight for date column (matches assignmentController)
function parseDate(dateStr?: string): Date {
  if (!dateStr) {
    const now = new Date();
    return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  const clean = dateStr.split('T')[0];
  const [year, month, day] = clean.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// Helper: compute break hours (lunch & late night) based on inTime & outTime
// Construction rules:
// 1. Shifts >= 5.0 hours (300 mins) have 1.0 hour lunch deducted; shifts < 5.0h have 0.0 deducted.
// 2. If out-time passes 11:00 PM (23:00), an additional 1.0 hour is deducted for dinner/night break.
export function computeBreakHours(inTime?: string | null, outTime?: string | null): number {
  if (!inTime || !outTime) return 0;
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  const inMins = inH * 60 + (inM || 0);
  const outMins = outH * 60 + (outM || 0);
  let diffMins = outMins - inMins;
  if (diffMins < 0) diffMins += 24 * 60;

  let breaks = diffMins >= 300 ? 1.0 : 0.0;
  const isPast11PM = (outMins >= inMins)
    ? (outMins >= 23 * 60)
    : (inMins <= 23 * 60 || outMins >= 23 * 60);
  if (isPast11PM) {
    breaks += 1.0;
  }
  return breaks;
}

// Master Helper: calculate net shift hours and Overtime (OT) strictly from In/Out attendance times
export function calculateShiftAndOvertime(
  inTime?: string | null,
  outTime?: string | null,
  standardHoursCap = 8.0,
  isAllOvertime = false
): { shiftHours: number; otHours: number; breakHours: number } {
  if (!inTime || !outTime) return { shiftHours: 0, otHours: 0, breakHours: 0 };
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  const inMins = inH * 60 + (inM || 0);
  const outMins = outH * 60 + (outM || 0);
  let diffMins = outMins - inMins;
  if (diffMins < 0) diffMins += 24 * 60; // Handles shifts crossing midnight

  let breakMinutes = 0;
  if (diffMins >= 300) breakMinutes += 60; // 1-hour lunch break deduction
  const isPast11PM = (outMins >= inMins)
    ? (outMins >= 23 * 60)
    : (inMins <= 23 * 60 || outMins >= 23 * 60);
  if (isPast11PM) breakMinutes += 60; // 1-hour late night break deduction

  diffMins = Math.max(0, diffMins - breakMinutes);
  const breakHours = Math.round((breakMinutes / 60) * 100) / 100;
  const shiftHours = diffMins > 0 ? Math.round((diffMins / 60) * 100) / 100 : 0;
  let otHours = 0;
  if (isAllOvertime) {
    otHours = shiftHours;
  } else if (shiftHours > standardHoursCap) {
    otHours = Math.round((shiftHours - standardHoursCap) * 100) / 100;
  }
  return { shiftHours, otHours, breakHours };
}

// 1. Get assigned employees for supervisor & date
export const getAssignedEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = req.query.supervisorId as string;
    const dateStr = req.query.date as string;
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());

    const targetDate = parseDate(dateStr);

    // If supervisorId is not provided, return empty array immediately
    if (!supervisorId) {
      res.json([]);
      return;
    }

    // Check DailyAssignment table strictly for this supervisor and date
    const assignedRecords = await prisma.dailyAssignment.findMany({
      where: {
        tenantId,
        supervisorId,
        date: targetDate,
        employee: {
          status: 'active',
        },
      },
      include: {
        employee: {
          include: { businessPartner: true },
        },
      },
      orderBy: {
        employee: {
          employeeCode: 'asc',
        },
      },
    });

    // Return ONLY employees assigned to this supervisor for this date.
    // If none assigned, return empty array [].
    const result = assignedRecords.map((rec) => ({
      id: rec.employee.id,
      employeeCode: rec.employee.employeeCode,
      callingName: rec.employee.callingName,
      fullName: rec.employee.fullName || rec.employee.callingName,
      tradeGroup: rec.employee.tradeGroup || 'General labour',
      businessPartner: rec.employee.businessPartner?.name || 'Direct',
    }));

    res.json(result);
  } catch (error) {
    console.error('Error fetching assigned employees:', error);
    res.status(500).json({ error: 'Failed to fetch assigned employees' });
  }
};

// 2. Check-in employee
export const checkInEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, supervisorId, date, inTime } = req.body;
    if (!employeeId || !inTime) {
      res.status(400).json({ error: 'employeeId and inTime are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const entryDate = parseDate(date);

    // Strict lock: Check if records for this employee or supervisor are already submitted or approved
    const lockedCheck = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        date: entryDate,
        status: { in: ['submitted', 'approved'] },
        OR: [
          { employeeId },
          ...(supervisorId ? [{ supervisorId }] : []),
        ],
      },
    });

    if (lockedCheck) {
      const msg = lockedCheck.status === 'approved'
        ? 'Cannot edit time entry: Daily attendance has already been Approved by Admin.'
        : 'Cannot check in: Daily attendance has already been submitted and locked.';
      res.status(403).json({ error: msg });
      return;
    }

    // Check if time entries already exist for this employee and date
    const existingEntries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        employeeId,
        date: entryDate,
      },
    });

    if (existingEntries.length > 0) {
      await prisma.timeEntry.updateMany({
        where: {
          tenantId,
          employeeId,
          date: entryDate,
        },
        data: { inTime },
      });
      res.json({ success: true, employeeId, inTime, count: existingEntries.length });
      return;
    }

    // If no existing record, create an initial draft time entry with inTime
    let defaultActivity = await prisma.activityCode.findFirst({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
    if (!defaultActivity) {
      defaultActivity = await prisma.activityCode.create({
        data: {
          tenantId,
          code: '00-00-11-11-M',
          description: 'Direct Labour Works',
        },
      });
    }

    let finalSupervisorId = supervisorId;
    if (!finalSupervisorId) {
      const assignment = await prisma.dailyAssignment.findFirst({
        where: { tenantId, employeeId, date: entryDate },
      });
      finalSupervisorId = assignment?.supervisorId;
    }
    if (!finalSupervisorId) {
      const supUser = await prisma.user.findFirst({
        where: { tenantId, role: 'supervisor' },
      });
      finalSupervisorId = supUser?.id;
    }

    const { effectiveDayTypeId } = await getDayTypeRulesAndId(tenantId, entryDate);

    const created = await prisma.timeEntry.create({
      data: {
        tenantId,
        employeeId,
        supervisorId: finalSupervisorId || '',
        activityId: defaultActivity.id,
        effectiveDayTypeId,
        date: entryDate,
        inTime,
        hours: 0,
        overtimeHours: 0,
        status: 'draft',
      },
    });

    res.json({ success: true, employeeId, inTime, entryId: created.id });
  } catch (error) {
    console.error('Error in checkInEmployee:', error);
    res.status(500).json({ error: 'Failed to record check-in' });
  }
};

// 2.1 Check-out employee
export const checkOutEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { employeeId, supervisorId, date, outTime } = req.body;
    if (!employeeId || !outTime) {
      res.status(400).json({ error: 'employeeId and outTime are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const entryDate = parseDate(date);

    // Strict lock: Check if records for this employee or supervisor are already submitted or approved
    const lockedCheck = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        date: entryDate,
        status: { in: ['submitted', 'approved'] },
        OR: [
          { employeeId },
          ...(supervisorId ? [{ supervisorId }] : []),
        ],
      },
    });

    if (lockedCheck) {
      const msg = lockedCheck.status === 'approved'
        ? 'Cannot edit time entry: Daily attendance has already been Approved by Admin.'
        : 'Cannot record checkout: Daily attendance has already been submitted and locked.';
      res.status(403).json({ error: msg });
      return;
    }

    const existingEntries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        employeeId,
        date: entryDate,
      },
    });

    if (existingEntries.length > 0) {
      const inTime = existingEntries.find((e) => e.inTime)?.inTime;
      const { standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, entryDate);
      const { shiftHours, otHours, breakHours } = calculateShiftAndOvertime(
        inTime,
        outTime,
        standardHoursCap,
        isAllOvertime
      );

      await prisma.timeEntry.updateMany({
        where: {
          tenantId,
          employeeId,
          date: entryDate,
        },
        data: {
          outTime,
          breakHours,
          shiftHours,
          otHours,
          overtimeHours: otHours,
        },
      });
      res.json({ success: true, employeeId, outTime, breakHours, shiftHours, otHours, count: existingEntries.length });
      return;
    }

    // If no record exists yet, create one with outTime
    let defaultActivity = await prisma.activityCode.findFirst({
      where: { tenantId },
      orderBy: { code: 'asc' },
    });
    if (!defaultActivity) {
      defaultActivity = await prisma.activityCode.create({
        data: {
          tenantId,
          code: '00-00-11-11-M',
          description: 'Direct Labour Works',
        },
      });
    }

    let finalSupervisorId = supervisorId;
    if (!finalSupervisorId) {
      const assignment = await prisma.dailyAssignment.findFirst({
        where: { tenantId, employeeId, date: entryDate },
      });
      finalSupervisorId = assignment?.supervisorId;
    }
    if (!finalSupervisorId) {
      const supUser = await prisma.user.findFirst({
        where: { tenantId, role: 'supervisor' },
      });
      finalSupervisorId = supUser?.id;
    }

    const { effectiveDayTypeId } = await getDayTypeRulesAndId(tenantId, entryDate);

    const created = await prisma.timeEntry.create({
      data: {
        tenantId,
        employeeId,
        supervisorId: finalSupervisorId || '',
        activityId: defaultActivity.id,
        effectiveDayTypeId,
        date: entryDate,
        outTime,
        hours: 0,
        overtimeHours: 0,
        status: 'draft',
      },
    });

    res.json({ success: true, employeeId, outTime, entryId: created.id });
  } catch (error) {
    console.error('Error in checkOutEmployee:', error);
    res.status(500).json({ error: 'Failed to record check-out' });
  }
};

// 3. Bulk Activity Assignment (Main logic for ActivityAssignPage)
export const assignActivityBulk = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      employeeIds,
      activityId,
      hours,
      date,
      supervisorId,
      equipmentId,
      remarks,
    } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({ error: 'employeeIds array must contain at least one ID' });
      return;
    }
    if (!activityId) {
      res.status(400).json({ error: 'activityId is required' });
      return;
    }
    const numHours = parseFloat(hours);
    if (isNaN(numHours) || numHours <= 0) {
      res.status(400).json({ error: 'Valid positive hours number is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    // Strict lock: Check if records for this supervisor or date are already submitted or approved
    const lockedCheck = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        date: targetDate,
        status: { in: ['submitted', 'approved'] },
        ...(supervisorId ? { supervisorId } : {}),
      },
    });

    if (lockedCheck) {
      const msg = lockedCheck.status === 'approved'
        ? 'Cannot update activities: Daily records have already been Approved by Admin.'
        : 'Cannot update activities: Daily records have already been submitted and locked.';
      res.status(403).json({ error: msg });
      return;
    }

    // Validate that all employees have both inTime and outTime recorded before assigning activities
    const shiftCheckRecords = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        date: targetDate,
        employeeId: { in: employeeIds },
      },
      include: { employee: true },
    });

    for (const empId of employeeIds) {
      const records = shiftCheckRecords.filter((e) => e.employeeId === empId);
      const hasIn = records.some((e) => e.inTime);
      const hasOut = records.some((e) => e.outTime);
      if (!hasIn || !hasOut) {
        const empName = records[0]?.employee?.callingName || records[0]?.employee?.fullName || empId;
        res.status(400).json({
          error: `Cannot assign activity: Worker "${empName}" must have both Check-in and Check-out recorded first.`,
        });
        return;
      }
    }

    const { effectiveDayTypeId, standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);

    // Resolve supervisor ID
    let finalSupervisorId = supervisorId;
    if (!finalSupervisorId) {
      const supUser = await prisma.user.findFirst({
        where: { tenantId, role: 'supervisor' },
      });
      finalSupervisorId = supUser?.id;
    }

    if (!finalSupervisorId) {
      // Create or fallback to default supervisor
      const sup = await prisma.user.upsert({
        where: { tenantId_username: { tenantId, username: 'supervisor1' } },
        update: {},
        create: {
          tenantId,
          username: 'supervisor1',
          fullName: 'Site Supervisor',
          role: 'supervisor',
          passwordHash: 'dummy',
        },
      });
      finalSupervisorId = sup.id;
    }

    const createdEntries = [];

    for (const empId of employeeIds) {
      // Calculate total daily hours for this employee on this date
      const existingEntries = await prisma.timeEntry.findMany({
        where: {
          tenantId,
          employeeId: empId,
          date: targetDate,
        },
      });

      const previousHours = existingEntries.reduce((acc, curr) => acc + Number(curr.hours), 0);
      const newTotalHours = previousHours + numHours;

      // Preserve check-in and checkout times from any existing entries
      const preservedInTime = existingEntries.find((e) => e.inTime)?.inTime || null;
      const preservedOutTime = existingEntries.find((e) => e.outTime)?.outTime || null;
      const breakHours = computeBreakHours(preservedInTime, preservedOutTime);

      // Construction site OT rules:
      // - Sunday / Poya / Holiday: 100% of all hours are Overtime (standardCap = 0)
      // - Saturday: Half-day 07:00 to 13:00 (standardCap = 6.0), hours > 6.0 are Overtime
      // - Normal Day: standardCap = 8.0, hours > 8.0 are Overtime
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

      // Check if this specific activity entry already exists for this employee on this date
      const existingActivityEntry = existingEntries.find((e) => e.activityId === activityId);

      if (existingActivityEntry) {
        const updated = await prisma.timeEntry.update({
          where: { id: existingActivityEntry.id },
          data: {
            hours: numHours,
            overtimeHours,
            breakHours,
            inTime: existingActivityEntry.inTime || preservedInTime,
            outTime: existingActivityEntry.outTime || preservedOutTime,
            equipmentId: equipmentId || existingActivityEntry.equipmentId,
            remarks: remarks || existingActivityEntry.remarks,
          },
        });
        createdEntries.push(updated);
      } else {
        // If there was a zero-hour placeholder entry with another activityId, we can update or replace it
        const placeholder = existingEntries.find((e) => Number(e.hours) === 0 && e.activityId !== activityId);
        if (placeholder) {
          const updated = await prisma.timeEntry.update({
            where: { id: placeholder.id },
            data: {
              activityId,
              hours: numHours,
              overtimeHours,
              breakHours,
              inTime: placeholder.inTime || preservedInTime,
              outTime: placeholder.outTime || preservedOutTime,
              equipmentId: equipmentId || placeholder.equipmentId,
              remarks: remarks || placeholder.remarks,
            },
          });
          createdEntries.push(updated);
        } else {
          const created = await prisma.timeEntry.create({
            data: {
              tenantId,
              employeeId: empId,
              supervisorId: finalSupervisorId,
              activityId,
              equipmentId: equipmentId || null,
              effectiveDayTypeId,
              date: targetDate,
              inTime: preservedInTime,
              outTime: preservedOutTime,
              hours: numHours,
              overtimeHours,
              breakHours,
              remarks: remarks || null,
              status: 'draft',
            },
          });
          createdEntries.push(created);
        }
      }
    }

    // Recalculate and persist activity split totals and OT for each modified employee
    for (const empId of employeeIds) {
      const allEmpEntries = await prisma.timeEntry.findMany({
        where: { tenantId, employeeId: empId, date: targetDate },
      });
      const totalEmpHours = allEmpEntries.reduce((acc, curr) => acc + Number(curr.hours), 0);
      let dayOt = 0;
      if (isAllOvertime) {
        dayOt = totalEmpHours;
      } else if (totalEmpHours > standardHoursCap) {
        dayOt = Math.round((totalEmpHours - standardHoursCap) * 100) / 100;
      }
      await prisma.timeEntry.updateMany({
        where: { tenantId, employeeId: empId, date: targetDate },
        data: {
          shiftHours: totalEmpHours,
          otHours: dayOt,
        },
      });
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

// 4. Upsert single time entry
export const upsertTimeEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      employeeId,
      supervisorId,
      date,
      activityId,
      equipmentId,
      hours,
      inTime,
      outTime,
      remarks,
    } = req.body;

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);
    const { effectiveDayTypeId, standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);

    const numHours = hours !== undefined ? parseFloat(hours) : 0;

    const existing = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        employeeId,
        activityId,
        date: targetDate,
      },
    });

    const finalInTime = inTime ?? existing?.inTime ?? null;
    const finalOutTime = outTime ?? existing?.outTime ?? null;

    let shiftHoursVal: number | null = null;
    let overtimeHours = 0;
    let otHoursVal = 0;
    let breakHours = 0;

    // Strict In/Out Overtime calculation
    if (finalInTime && finalOutTime) {
      const calc = calculateShiftAndOvertime(finalInTime, finalOutTime, standardHoursCap, isAllOvertime);
      shiftHoursVal = calc.shiftHours;
      overtimeHours = calc.otHours;
      otHoursVal = calc.otHours;
      breakHours = calc.breakHours;
    } else {
      breakHours = computeBreakHours(finalInTime, finalOutTime);
      if (isAllOvertime) {
        overtimeHours = numHours;
        otHoursVal = numHours;
      } else if (numHours > standardHoursCap) {
        overtimeHours = numHours - standardHoursCap;
        otHoursVal = numHours - standardHoursCap;
      }
    }

    // Guard against modifying approved entries
    const approvedCheck = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        employeeId,
        date: targetDate,
        status: 'approved',
      },
    });
    if (approvedCheck) {
      res.status(403).json({ error: 'Cannot edit time entry: Daily attendance has already been Approved by Admin.' });
      return;
    }

    if (existing) {
      if (existing.status === 'submitted') {
        res.status(403).json({ error: 'Cannot edit time entry: Daily attendance has already been submitted and locked.' });
        return;
      }
      const updated = await prisma.timeEntry.update({
        where: { id: existing.id },
        data: {
          hours: numHours,
          shiftHours: shiftHoursVal,
          overtimeHours,
          otHours: otHoursVal,
          breakHours,
          inTime: finalInTime,
          outTime: finalOutTime,
          equipmentId: equipmentId ?? existing.equipmentId,
          remarks: remarks ?? existing.remarks,
        },
      });

      // Keep attendance times in sync across any other activity splits for this employee on this date
      if (finalInTime && finalOutTime) {
        await prisma.timeEntry.updateMany({
          where: {
            tenantId,
            employeeId,
            date: targetDate,
            id: { not: existing.id },
          },
          data: {
            inTime: finalInTime,
            outTime: finalOutTime,
            breakHours,
            shiftHours: shiftHoursVal,
            overtimeHours,
            otHours: otHoursVal,
          },
        });
      }

      res.json(updated);
      return;
    }

    const created = await prisma.timeEntry.create({
      data: {
        tenantId,
        employeeId,
        supervisorId,
        activityId,
        equipmentId: equipmentId || null,
        effectiveDayTypeId,
        date: targetDate,
        hours: numHours,
        shiftHours: shiftHoursVal,
        overtimeHours,
        otHours: otHoursVal,
        breakHours,
        inTime: finalInTime,
        outTime: finalOutTime,
        remarks: remarks || null,
        status: 'draft',
      },
    });

    // Keep attendance times in sync across any other activity splits for this employee on this date
    if (finalInTime && finalOutTime) {
      await prisma.timeEntry.updateMany({
        where: {
          tenantId,
          employeeId,
          date: targetDate,
          id: { not: created.id },
        },
        data: {
          inTime: finalInTime,
          outTime: finalOutTime,
          breakHours,
          shiftHours: shiftHoursVal,
          overtimeHours,
          otHours: otHoursVal,
        },
      });
    }

    res.status(201).json(created);
  } catch (error) {
    console.error('Error upserting time entry:', error);
    res.status(500).json({ error: 'Failed to save time entry' });
  }
};

// 5. Get time entries
export const getTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, supervisorId, employeeId, status } = req.query;
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());

    const where: Record<string, any> = { tenantId };
    if (date && typeof date === 'string') {
      where.date = parseDate(date);
    }
    if (supervisorId && typeof supervisorId === 'string') {
      where.supervisorId = supervisorId;
    }
    if (employeeId && typeof employeeId === 'string') {
      where.employeeId = employeeId;
    }
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const entries = await prisma.timeEntry.findMany({
      where,
      include: {
        employee: {
          include: { businessPartner: true },
        },
        activity: true,
        equipment: true,
        effectiveDayType: true,
        supervisor: {
          select: { id: true, fullName: true, username: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(entries);
  } catch (error) {
    console.error('Error fetching time entries:', error);
    res.status(500).json({ error: 'Failed to fetch time entries' });
  }
};

// 6. Submit day (Locks daily entries)
export const submitDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, date } = req.body;
    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    const whereClause: Record<string, any> = {
      tenantId,
      date: targetDate,
      status: 'draft',
    };
    if (supervisorId) {
      whereClause.supervisorId = supervisorId;
    }

    const supervisor = supervisorId
      ? await prisma.user.findUnique({
          where: { id: supervisorId },
          select: { id: true, fullName: true, username: true },
        })
      : null;

    // Validate: Verify that all draft entries being submitted have valid inTime and outTime
    const incompleteDrafts = await prisma.timeEntry.findMany({
      where: {
        ...whereClause,
        OR: [
          { inTime: null },
          { outTime: null },
        ],
      },
      include: {
        employee: true,
      },
    });

    if (incompleteDrafts.length > 0) {
      const names = Array.from(new Set(incompleteDrafts.map((e) => e.employee.callingName || e.employee.fullName || e.employeeId))).join(', ');
      res.status(400).json({
        error: `Cannot submit day: The following worker(s) do not have complete Check-in and Check-out recorded: ${names}. All workers must have both In Time and Out Time before submitting.`,
      });
      return;
    }

    // Recalculate shiftHours, otHours, overtimeHours, and breakHours strictly from inTime & outTime
    const attendedDrafts = await prisma.timeEntry.findMany({
      where: {
        ...whereClause,
        inTime: { not: null },
        outTime: { not: null },
      },
    });

    if (attendedDrafts.length > 0) {
      const { standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);

      const updates = attendedDrafts
        .filter((entry) => entry.inTime && entry.outTime)
        .map((entry) => {
          const { shiftHours, otHours, breakHours } = calculateShiftAndOvertime(
            entry.inTime,
            entry.outTime,
            standardHoursCap,
            isAllOvertime
          );
          const updateData: any = {
            shiftHours,
            otHours,
            overtimeHours: otHours,
            breakHours,
          };
          if (Number(entry.hours || 0) === 0 && shiftHours > 0) {
            updateData.hours = shiftHours;
          }
          return prisma.timeEntry.update({
            where: { id: entry.id },
            data: updateData,
          });
        });

      if (updates.length > 0) {
        await prisma.$transaction(updates);
      }
    }

    const submittedAt = new Date();

    const updated = await prisma.timeEntry.updateMany({
      where: whereClause,
      data: {
        status: 'submitted',
        submittedAt,
      },
    });

    // Also mark operator entries for this supervisor as submitted and recalculate shiftHours/otHours
    const opAssignments = await prisma.dailyOperatorAssignment.findMany({
      where: { tenantId, supervisorId, date: targetDate },
      include: { timeEntry: true },
    });
    if (opAssignments.length > 0) {
      const { standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);
      for (const opAssign of opAssignments) {
        if (opAssign.timeEntry) {
          const inTime = opAssign.timeEntry.inTime;
          const outTime = opAssign.timeEntry.outTime;
          let shiftHours = Number(opAssign.timeEntry.shiftHours) || 0;
          let otHours = Number(opAssign.timeEntry.otHours) || 0;
          if (inTime && outTime) {
            const { shiftHours: calcShift, otHours: calcOt } = calculateShiftAndOvertime(
              inTime,
              outTime,
              standardHoursCap,
              isAllOvertime
            );
            shiftHours = calcShift > 0 ? calcShift : shiftHours;
            otHours = calcOt;
          }
          await prisma.operatorTimeEntry.update({
            where: { id: opAssign.timeEntry.id },
            data: {
              status: 'submitted',
              shiftHours,
              otHours,
            },
          });
        }
      }
    }

    // Also mark equipment logs for this supervisor as submitted
    const eqAssignments = await prisma.dailyEquipmentAssignment.findMany({
      where: { tenantId, supervisorId, date: targetDate },
      select: { id: true },
    });
    if (eqAssignments.length > 0) {
      await prisma.equipmentDailyLog.updateMany({
        where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
        data: { status: 'submitted' },
      });
    }

    // Upsert DailySheet as submitted
    await prisma.dailySheet.upsert({
      where: {
        tenantId_supervisorId_date: {
          tenantId,
          supervisorId,
          date: targetDate,
        },
      },
      create: {
        tenantId,
        supervisorId,
        date: targetDate,
        status: 'submitted',
        isLocked: true,
        submittedAt,
        remarks: null,
      },
      update: {
        status: 'submitted',
        isLocked: true,
        submittedAt,
        remarks: null,
      },
    });

    res.json({
      success: true,
      submittedCount: updated.count,
      submittedAt: submittedAt.toISOString(),
      supervisor: supervisor ? { id: supervisor.id, fullName: supervisor.fullName, username: supervisor.username } : null,
      message: `Successfully submitted daily roster (Labor, Operators, and Equipment).`,
    });
  } catch (error) {
    console.error('Error submitting day:', error);
    res.status(500).json({ error: 'Failed to submit daily entries' });
  }
};

// 6.1 Get Day Status (Draft, Submitted, Approved) for Supervisor & Date
export const getDayStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = req.query.supervisorId as string;
    const dateStr = req.query.date as string;
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());

    if (!supervisorId || !dateStr) {
      res.status(400).json({ error: 'supervisorId and date query parameters are required' });
      return;
    }

    const targetDate = parseDate(dateStr);
    const dailySheet = await prisma.dailySheet.findUnique({
      where: {
        tenantId_supervisorId_date: {
          tenantId,
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

    const isLocked = dailySheet.status === 'submitted' || dailySheet.status === 'approved' || dailySheet.isLocked;

    res.json({
      status: dailySheet.status,
      isLocked,
      submittedAt: dailySheet.submittedAt,
      approvedAt: dailySheet.approvedAt,
      remarks: dailySheet.remarks,
    });
  } catch (error) {
    console.error('Error fetching day status:', error);
    res.status(500).json({ error: 'Failed to fetch day status' });
  }
};

// 7. Admin: Get Approval Overview for Date (Submitted, Not Submitted, Approved)
// Unified engine aggregating Labor, Machine Operators, and Equipment
export const getApprovalOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());
    const targetDate = parseDate(dateStr);

    // 1. Day Type rules for this date
    const dayTypeRules = await getDayTypeRulesAndId(tenantId, targetDate);

    // 2. Fetch Labor assignments & Time entries
    const assignments = await prisma.dailyAssignment.findMany({
      where: { tenantId, date: targetDate },
      include: {
        supervisor: { select: { id: true, fullName: true, username: true } },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            callingName: true,
            fullName: true,
            tradeGroup: true,
            businessPartner: { select: { name: true } },
          },
        },
      },
      orderBy: { supervisor: { fullName: 'asc' } },
    });

    const timeEntries = await prisma.timeEntry.findMany({
      where: { tenantId, date: targetDate },
      include: {
        supervisor: { select: { id: true, fullName: true, username: true } },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            callingName: true,
            fullName: true,
            tradeGroup: true,
            businessPartner: { select: { name: true } },
          },
        },
        activity: { select: { id: true, code: true, description: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 3. Fetch Operator assignments & Operator time entries
    const operatorAssignments = await prisma.dailyOperatorAssignment.findMany({
      where: { tenantId, date: targetDate },
      include: {
        supervisor: { select: { id: true, fullName: true, username: true } },
        operator: {
          select: {
            id: true,
            employeeCode: true,
            callingName: true,
            fullName: true,
            tradeGroup: true,
          },
        },
        timeEntry: {
          include: {
            assignedEquipment: {
              select: { id: true, code: true, magaNo: true, name: true, vehicleNo: true },
            },
          },
        },
      },
      orderBy: { supervisor: { fullName: 'asc' } },
    });

    // 4. Fetch Equipment assignments & Daily logs
    const equipmentAssignments = await prisma.dailyEquipmentAssignment.findMany({
      where: { tenantId, date: targetDate },
      include: {
        supervisor: { select: { id: true, fullName: true, username: true } },
        equipment: {
          select: {
            id: true,
            code: true,
            name: true,
            vehicleNo: true,
            magaNo: true,
            condition: true,
            primaryUnit: true,
            ownerPartner: { select: { name: true } },
          },
        },
        dailyLog: {
          include: {
            activities: {
              include: { activityCode: { select: { id: true, code: true, description: true } } },
            },
          },
        },
      },
      orderBy: { supervisor: { fullName: 'asc' } },
    });

    // 5. Fetch DailySheets
    const dailySheets = await prisma.dailySheet.findMany({
      where: { tenantId, date: targetDate },
    });

    // 6. Collect distinct supervisors across all 3 resource streams
    const supervisorMap = new Map<string, { id: string; fullName: string; username: string }>();

    assignments.forEach((a) => a.supervisor && supervisorMap.set(a.supervisor.id, a.supervisor));
    timeEntries.forEach((t) => t.supervisor && supervisorMap.set(t.supervisor.id, t.supervisor));
    operatorAssignments.forEach((o) => o.supervisor && supervisorMap.set(o.supervisor.id, o.supervisor));
    equipmentAssignments.forEach((e) => e.supervisor && supervisorMap.set(e.supervisor.id, e.supervisor));

    const submitted: any[] = [];
    const notSubmitted: any[] = [];
    const approved: any[] = [];

    let totalLaborAssigned = assignments.length;
    let totalLaborAttended = 0;
    let totalLaborNormalHours = 0;
    let totalLaborOtHours = 0;

    let totalOperatorsAssigned = operatorAssignments.length;
    let totalOperatorsDeployed = 0;
    let totalOperatorsMapped = 0;

    let totalEquipmentAssigned = equipmentAssignments.length;
    let totalEquipmentRunning = 0;
    let totalEquipmentDays = 0;
    let totalEquipmentHours = 0;
    let totalEquipmentFuel = 0;

    // 7. Group per supervisor
    for (const [supId, supInfo] of supervisorMap.entries()) {
      // ── Labor ──
      const supAssignments = assignments.filter((a) => a.supervisorId === supId);
      const supEntries = timeEntries.filter((t) => t.supervisorId === supId);

      const assignedWorkerIds = new Set(supAssignments.map((a) => a.employeeId));
      const workedWorkerIds = new Set(supEntries.map((t) => t.employeeId));
      const allEmpIds = Array.from(new Set([...assignedWorkerIds, ...workedWorkerIds]));

      const workerDetails = allEmpIds.map((empId) => {
        const assignment = supAssignments.find((a) => a.employeeId === empId);
        const entries = supEntries.filter((t) => t.employeeId === empId);
        const emp = assignment?.employee || entries[0]?.employee;

        const inTime = entries[0]?.inTime || '';
        const outTime = entries[0]?.outTime || '';
        const totalActivityHours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);

        let workerShiftHours = totalActivityHours;
        let workerOtHours = 0;

        if (inTime && outTime) {
          const { shiftHours, otHours } = calculateShiftAndOvertime(
            inTime,
            outTime,
            dayTypeRules.standardHoursCap,
            dayTypeRules.isAllOvertime
          );
          workerShiftHours = shiftHours > 0 ? shiftHours : totalActivityHours;
          workerOtHours = otHours;
        } else {
          workerOtHours = entries.reduce((sum, e) => sum + Number(e.overtimeHours || e.otHours || 0), 0);
        }

        const activities = entries.map((e) => ({
          code: e.activity?.code || 'N/A',
          description: e.activity?.description || '',
          hours: Number(e.hours || 0),
        }));

        const status = entries[0]?.status || (inTime && outTime ? 'draft' : 'pending');

        return {
          employeeId: empId,
          employeeCode: emp?.employeeCode || 'N/A',
          callingName: emp?.callingName || emp?.fullName || 'Worker',
          fullName: emp?.fullName || '',
          tradeGroup: emp?.tradeGroup || 'General labour',
          businessPartner: emp?.businessPartner?.name || 'Direct',
          inTime,
          outTime,
          hours: workerShiftHours,
          otHours: workerOtHours,
          activities,
          status,
        };
      });

      // ── Operators ──
      const supOpAssignments = operatorAssignments.filter((a) => a.supervisorId === supId);
      const operatorDetails = supOpAssignments.map((a) => {
        const op = a.operator;
        const entry = a.timeEntry;
        const inTime = entry?.inTime || '';
        const outTime = entry?.outTime || '';
        let hours = Number(entry?.shiftHours) || 0;
        let otHours = Number(entry?.otHours) || 0;

        if (inTime && outTime) {
          const { shiftHours: calcShift, otHours: calcOt } = calculateShiftAndOvertime(
            inTime,
            outTime,
            dayTypeRules.standardHoursCap,
            dayTypeRules.isAllOvertime
          );
          hours = calcShift > 0 ? calcShift : hours;
          otHours = calcOt;
        }

        const eq = entry?.assignedEquipment;
        let assignedEquipmentDisplay = eq ? (eq.magaNo || eq.code || eq.name) : '—';
        if (assignedEquipmentDisplay === '—') {
          if (entry?.notes?.includes('ZXQOPRIDLE') || entry?.assignedEquipmentId === 'ZXQOPRIDLE' || (inTime && !entry?.assignedEquipmentId)) {
            assignedEquipmentDisplay = 'ZXQOPRIDLE (Operator Idle)';
          }
        }

        if (inTime || hours > 0) totalOperatorsDeployed++;
        if (entry?.assignedEquipmentId || assignedEquipmentDisplay.includes('ZXQOPRIDLE')) totalOperatorsMapped++;

        return {
          operatorId: a.operatorId,
          operatorCode: op?.employeeCode || 'N/A',
          callingName: op?.callingName || op?.fullName || 'Operator',
          fullName: op?.fullName || '',
          tradeGroup: op?.tradeGroup || 'Machine Operator',
          inTime,
          outTime,
          hours,
          otHours,
          assignedEquipmentId: entry?.assignedEquipmentId || null,
          assignedEquipmentDisplay,
          status: entry?.status || (inTime ? 'draft' : 'pending'),
          notes: entry?.notes || '',
        };
      });

      // ── Equipment ──
      const supEqAssignments = equipmentAssignments.filter((a) => a.supervisorId === supId);
      const equipmentDetails = supEqAssignments.map((a) => {
        const eq = a.equipment;
        const log = a.dailyLog;
        const primaryUnit = (eq?.primaryUnit || 'hrs').toLowerCase();
        const condition = log?.condition || eq?.condition || 'DRY';
        const initialMeter = Number(log?.initialMeter) || 0;
        const finalMeter = Number(log?.finalMeter) || 0;
        const netHours = Number(log?.netRunningHours) || 0;
        const workingHours = Number(log?.workingHours) || 0;
        const idleHours = Number(log?.idleHours) || 0;
        const fuelLiters = Number(log?.fuelLiters) || 0;
        const totalMileage = Number(log?.totalMileage) || 0;
        const loggedQuantity = Number(log?.loggedQuantity) || 0;

        if (netHours > 0 || loggedQuantity > 0) {
          totalEquipmentRunning++;
          totalEquipmentFuel += fuelLiters;
          totalEquipmentHours += netHours;
          if (primaryUnit === 'mth' || primaryUnit === 'day' || primaryUnit === 'days') {
            totalEquipmentDays += loggedQuantity > 0 ? loggedQuantity : 1;
          }
        }

        const splits = (log?.activities || []).map((act) => ({
          activityCode: act.activityCode?.code || 'N/A',
          activityDesc: act.activityCode?.description || '',
          unit: act.unit,
          utilization: Number(act.utilization) || 0,
        }));

        return {
          equipmentId: a.equipmentId,
          equipmentCode: eq?.code || eq?.vehicleNo || '—',
          equipmentName: eq?.name || '',
          vehicleNo: eq?.vehicleNo || '—',
          magaNo: eq?.magaNo || '—',
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
          status: log?.status || (netHours > 0 || loggedQuantity > 0 ? 'draft' : 'pending'),
          splits,
        };
      });

      const laborHours = workerDetails.reduce((sum, w) => sum + Number(w.hours || 0), 0);
      const laborOvertime = workerDetails.reduce((sum, w) => sum + Number(w.otHours || 0), 0);
      const laborAttendedCount = workerDetails.filter((w) => w.inTime || w.hours > 0).length;

      totalLaborAttended += laborAttendedCount;
      totalLaborNormalHours += laborHours;
      totalLaborOtHours += laborOvertime;

      const equipmentFuel = equipmentDetails.reduce((sum, e) => sum + e.fuelLiters, 0);
      const equipmentDays = equipmentDetails.reduce((sum, e) => sum + (e.primaryUnit === 'mth' ? e.loggedQuantity : (e.loggedQuantity > 0 ? e.loggedQuantity : 0)), 0);

      const sheet = dailySheets.find((s) => s.supervisorId === supId);

      // Status resolution
      const isSheetApproved = sheet?.status === 'approved';
      const allLaborApproved = supEntries.length > 0 && supEntries.every((t) => t.status === 'approved');
      const allOpApproved = operatorDetails.length > 0 && operatorDetails.every((o) => o.status === 'approved');
      const allEqApproved = equipmentDetails.length > 0 && equipmentDetails.every((e) => e.status === 'approved');

      const isApproved = isSheetApproved || (allLaborApproved && (operatorDetails.length === 0 || allOpApproved) && (equipmentDetails.length === 0 || allEqApproved));

      const isSheetSubmitted = sheet?.status === 'submitted';
      const hasLaborSubmitted = supEntries.some((t) => t.status === 'submitted' || t.status === 'approved');
      const hasOpSubmitted = operatorDetails.some((o) => o.status === 'submitted' || o.status === 'approved');
      const hasEqSubmitted = equipmentDetails.some((e) => e.status === 'submitted' || e.status === 'approved');

      const isSubmitted = isSheetSubmitted || (!sheet && (hasLaborSubmitted || hasOpSubmitted || hasEqSubmitted));

      const hasAnyDraft = workerDetails.some((w) => w.status === 'draft') || operatorDetails.some((o) => o.status === 'draft') || equipmentDetails.some((e) => e.status === 'draft');

      let supervisorStatus = 'not_started';
      if (isApproved) {
        supervisorStatus = 'approved';
      } else if (isSubmitted) {
        supervisorStatus = 'submitted';
      } else if (sheet?.status === 'draft' || hasAnyDraft) {
        supervisorStatus = 'draft';
      }

      const groupData = {
        supervisorId: supId,
        supervisorName: supInfo.fullName,
        username: supInfo.username,
        status: supervisorStatus,
        submittedAt: sheet?.submittedAt || supEntries[0]?.submittedAt || null,
        approvedAt: sheet?.approvedAt || null,
        counts: {
          laborAssigned: supAssignments.length,
          laborWorked: laborAttendedCount,
          operatorsAssigned: supOpAssignments.length,
          operatorsWorked: operatorDetails.filter((o) => o.inTime || o.hours > 0).length,
          equipmentAssigned: supEqAssignments.length,
          equipmentRunning: equipmentDetails.filter((e) => e.netHours > 0 || e.loggedQuantity > 0).length,
        },
        totals: {
          laborHours,
          laborOvertime,
          equipmentFuel,
          equipmentDays,
        },
        // Backward-compat keys
        assignedCount: supAssignments.length,
        workedCount: laborAttendedCount,
        totalHours: laborHours,
        totalOvertime: laborOvertime,
        workers: workerDetails,
        operators: operatorDetails,
        equipment: equipmentDetails,
      };

      if (isApproved) {
        approved.push(groupData);
      } else if (isSubmitted) {
        submitted.push(groupData);
      } else {
        notSubmitted.push(groupData);
      }
    }

    res.json({
      date: dateStr,
      dayType: {
        name: dayTypeRules.dayTypeName,
        standardHoursCap: dayTypeRules.standardHoursCap,
        isAllOvertime: dayTypeRules.isAllOvertime,
      },
      submitted,
      notSubmitted,
      approved,
      stats: {
        totalSupervisors: supervisorMap.size,
        submittedCount: submitted.length,
        notSubmittedCount: notSubmitted.length,
        approvedCount: approved.length,
        totalWorkers: totalLaborAssigned,
        labor: {
          totalAssigned: totalLaborAssigned,
          attendedCount: totalLaborAttended,
          totalNormalHours: Math.round(totalLaborNormalHours * 10) / 10,
          totalOtHours: Math.round(totalLaborOtHours * 10) / 10,
        },
        operators: {
          totalAssigned: totalOperatorsAssigned,
          deployedCount: totalOperatorsDeployed,
          mappedCount: totalOperatorsMapped,
        },
        equipment: {
          totalAssigned: totalEquipmentAssigned,
          runningCount: totalEquipmentRunning,
          totalDays: Math.round(totalEquipmentDays * 100) / 100,
          totalHours: Math.round(totalEquipmentHours * 10) / 10,
          totalFuelLiters: Math.round(totalEquipmentFuel * 10) / 10,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching approval overview:', error);
    res.status(500).json({ error: 'Failed to fetch approval overview' });
  }
};

// 7.1 Admin: Approve supervisor day / records (Unified Labor + Operators + Equipment)
export const approveTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, date } = req.body;
    if (!date) {
      res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    // ── 1. Approve Labor ──
    const where: Record<string, any> = {
      tenantId,
      date: targetDate,
      status: { in: ['submitted', 'draft'] },
    };
    if (supervisorId) {
      where.supervisorId = supervisorId;
    }

    const attended = await prisma.timeEntry.findMany({
      where: {
        ...where,
        inTime: { not: null },
        outTime: { not: null },
      },
    });

    if (attended.length > 0) {
      const { standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);
      const updates = attended
        .filter((entry) => entry.inTime && entry.outTime)
        .map((entry) => {
          const { shiftHours, otHours, breakHours } = calculateShiftAndOvertime(
            entry.inTime,
            entry.outTime,
            standardHoursCap,
            isAllOvertime
          );
          return prisma.timeEntry.update({
            where: { id: entry.id },
            data: {
              shiftHours,
              otHours,
              overtimeHours: otHours,
              breakHours,
            },
          });
        });

      if (updates.length > 0) {
        await prisma.$transaction(updates);
      }
    }

    const laborResult = await prisma.timeEntry.updateMany({
      where,
      data: {
        status: 'approved',
      },
    });

    // ── 2. Approve Operators ──
    const opWhere: any = {
      tenantId,
      date: targetDate,
    };
    if (supervisorId) {
      opWhere.supervisorId = supervisorId;
    }
    const opAssignments = await prisma.dailyOperatorAssignment.findMany({
      where: opWhere,
      include: { timeEntry: true },
    });
    let opApprovedCount = 0;
    if (opAssignments.length > 0) {
      const { standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);
      for (const opAssign of opAssignments) {
        if (opAssign.timeEntry) {
          const inTime = opAssign.timeEntry.inTime;
          const outTime = opAssign.timeEntry.outTime;
          let shiftHours = Number(opAssign.timeEntry.shiftHours) || 0;
          let otHours = Number(opAssign.timeEntry.otHours) || 0;
          if (inTime && outTime) {
            const { shiftHours: calcShift, otHours: calcOt } = calculateShiftAndOvertime(
              inTime,
              outTime,
              standardHoursCap,
              isAllOvertime
            );
            shiftHours = calcShift > 0 ? calcShift : shiftHours;
            otHours = calcOt;
          }
          await prisma.operatorTimeEntry.update({
            where: { id: opAssign.timeEntry.id },
            data: {
              status: 'approved',
              shiftHours,
              otHours,
            },
          });
          opApprovedCount++;
        }
      }
    }

    // ── 3. Approve Equipment ──
    const eqWhere: any = {
      tenantId,
      date: targetDate,
    };
    if (supervisorId) {
      eqWhere.supervisorId = supervisorId;
    }
    const eqAssignments = await prisma.dailyEquipmentAssignment.findMany({
      where: eqWhere,
      select: { id: true },
    });
    let eqApprovedCount = 0;
    if (eqAssignments.length > 0) {
      const eqResult = await prisma.equipmentDailyLog.updateMany({
        where: {
          assignmentId: { in: eqAssignments.map((a) => a.id) },
        },
        data: { status: 'approved' },
      });
      eqApprovedCount = eqResult.count;
    }

    // ── 4. Approve DailySheet ──
    if (supervisorId) {
      await prisma.dailySheet.upsert({
        where: {
          tenantId_supervisorId_date: {
            tenantId,
            supervisorId,
            date: targetDate,
          },
        },
        create: {
          tenantId,
          supervisorId,
          date: targetDate,
          status: 'approved',
          isLocked: true,
          approvedAt: new Date(),
        },
        update: {
          status: 'approved',
          isLocked: true,
          approvedAt: new Date(),
        },
      });
    } else {
      await prisma.dailySheet.updateMany({
        where: { tenantId, date: targetDate },
        data: {
          status: 'approved',
          isLocked: true,
          approvedAt: new Date(),
        },
      });
    }

    res.json({
      success: true,
      approvedCount: laborResult.count,
      laborApprovedCount: laborResult.count,
      operatorApprovedCount: opApprovedCount,
      equipmentApprovedCount: eqApprovedCount,
      message: `Successfully approved daily records (${laborResult.count} labor, ${opApprovedCount} operators, ${eqApprovedCount} equipment).`,
    });
  } catch (error) {
    console.error('Error approving daily entries:', error);
    res.status(500).json({ error: 'Failed to approve daily entries' });
  }
};

// 7.2 Admin: Reject supervisor day / return to draft (Unified Labor + Operators + Equipment)
export const rejectTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, date, reason } = req.body;
    if (!date || !supervisorId) {
      res.status(400).json({ error: 'supervisorId and date are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    // 1. Return Labor to draft
    const laborResult = await prisma.timeEntry.updateMany({
      where: {
        tenantId,
        supervisorId,
        date: targetDate,
      },
      data: {
        status: 'draft',
        remarks: reason ? `Returned by Admin: ${reason}` : undefined,
      },
    });

    // 2. Return Operators to draft
    const opAssignments = await prisma.dailyOperatorAssignment.findMany({
      where: { tenantId, supervisorId, date: targetDate },
      select: { id: true },
    });
    if (opAssignments.length > 0) {
      await prisma.operatorTimeEntry.updateMany({
        where: { assignmentId: { in: opAssignments.map((a) => a.id) } },
        data: { status: 'draft' },
      });
    }

    // 3. Return Equipment to draft
    const eqAssignments = await prisma.dailyEquipmentAssignment.findMany({
      where: { tenantId, supervisorId, date: targetDate },
      select: { id: true },
    });
    if (eqAssignments.length > 0) {
      await prisma.equipmentDailyLog.updateMany({
        where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
        data: { status: 'draft' },
      });
    }

    // 4. Return DailySheet to draft
    await prisma.dailySheet.upsert({
      where: {
        tenantId_supervisorId_date: {
          tenantId,
          supervisorId,
          date: targetDate,
        },
      },
      create: {
        tenantId,
        supervisorId,
        date: targetDate,
        status: 'draft',
        isLocked: false,
        remarks: reason ? `Returned by Admin: ${reason}` : null,
      },
      update: {
        status: 'draft',
        isLocked: false,
        remarks: reason ? `Returned by Admin: ${reason}` : null,
      },
    });

    res.json({
      success: true,
      rejectedCount: laborResult.count,
      message: `Returned all daily records (labor, operators, equipment) to draft for supervisor to edit.`,
    });
  } catch (error) {
    console.error('Error rejecting daily entries:', error);
    res.status(500).json({ error: 'Failed to return daily entries to draft' });
  }
};

// 7.3 Admin: Inline edit worker time entry (In/Out & hours) during approval
export const adminAdjustWorkerTimeEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, employeeId, date, inTime, outTime, hours, overtimeHours } = req.body;
    if (!employeeId || !date) {
      res.status(400).json({ error: 'employeeId and date are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);
    const { standardHoursCap, isAllOvertime, effectiveDayTypeId } = await getDayTypeRulesAndId(tenantId, targetDate);

    // Calculate hours if inTime & outTime are provided
    let calculatedHours = hours !== undefined ? parseFloat(hours) : 0;
    let calculatedOt = overtimeHours !== undefined ? parseFloat(overtimeHours) : 0;
    let breakHours = 0;

    if (inTime && outTime) {
      const [inH, inM] = inTime.split(':').map(Number);
      const [outH, outM] = outTime.split(':').map(Number);
      let diff = (outH * 60 + outM) - (inH * 60 + inM);
      if (diff < 0) diff += 24 * 60;

      const gross = Math.round((diff / 60) * 100) / 100;
      breakHours = computeBreakHours(inTime, outTime);
      const net = Math.max(0, Math.round((gross - breakHours) * 100) / 100);

      calculatedHours = net;
      if (isAllOvertime) {
        calculatedOt = net;
      } else if (net > standardHoursCap) {
        calculatedOt = Math.round((net - standardHoursCap) * 100) / 100;
      } else {
        calculatedOt = 0;
      }
    }

    // Find all existing records for this employee on this date
    const existingEntries = await prisma.timeEntry.findMany({
      where: {
        tenantId,
        employeeId,
        date: targetDate,
      },
    });

    if (existingEntries.length > 0) {
      // If there's only 1 entry or 0 activity splits, update its hours as well
      if (existingEntries.length === 1) {
        await prisma.timeEntry.update({
          where: { id: existingEntries[0].id },
          data: {
            inTime,
            outTime,
            hours: calculatedHours,
            overtimeHours: calculatedOt,
            breakHours,
            remarks: 'Adjusted by Admin',
          },
        });
      } else {
        // Multiple activity splits: update attendance times, breakHours, and OT for all
        await prisma.timeEntry.updateMany({
          where: {
            tenantId,
            employeeId,
            date: targetDate,
          },
          data: {
            inTime,
            outTime,
            breakHours,
            shiftHours: calculatedHours,
            overtimeHours: calculatedOt,
            otHours: calculatedOt,
          },
        });
      }
    } else {
      // Create new record for this worker
      const defaultActivity = (await prisma.activityCode.findFirst({
        where: { tenantId },
      })) || (await prisma.activityCode.create({
        data: {
          tenantId,
          code: 'GEN-01',
          description: 'General Site Work',
          trade: 'General labour',
        },
      }));

      await prisma.timeEntry.create({
        data: {
          tenantId,
          employeeId,
          supervisorId: supervisorId || '',
          activityId: defaultActivity.id,
          effectiveDayTypeId,
          date: targetDate,
          inTime,
          outTime,
          hours: calculatedHours,
          overtimeHours: calculatedOt,
          breakHours,
          status: 'submitted',
          remarks: 'Created & Adjusted by Admin',
        },
      });
    }

    res.json({
      success: true,
      employeeId,
      inTime,
      outTime,
      hours: calculatedHours,
      overtimeHours: calculatedOt,
      message: 'Worker entry adjusted successfully by Admin.',
    });
  } catch (error) {
    console.error('Error in adminAdjustWorkerTimeEntry:', error);
    res.status(500).json({ error: 'Failed to adjust worker time entry' });
  }
};

// ─── OPERATOR TIME ENTRIES ──────────────────────────────────────────────────

// 8. Get operator entries for supervisor & date
export const getOperatorEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = req.query.supervisorId as string;
    const dateStr = req.query.date as string;
    if (!dateStr) {
      res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());
    const targetDate = parseDate(dateStr);

    const assignments = await prisma.dailyOperatorAssignment.findMany({
      where: {
        tenantId,
        date: targetDate,
        ...(supervisorId ? { supervisorId } : {}),
      },
      include: {
        operator: true,
        timeEntry: {
          include: {
            assignedEquipment: true,
          },
        },
      },
      orderBy: {
        operator: {
          employeeCode: 'asc',
        },
      },
    });

    const result = assignments.map((a) => {
      const entry = a.timeEntry;
      return {
        id: a.id,
        operatorId: a.operator.id,
        callingName: a.operator.callingName || a.operator.fullName,
        employeeNumber: a.operator.employeeCode,
        licenseNo: a.operator.nicNo || 'N/A',
        designation: a.operator.tradeGroup || 'Operator',
        inTime: entry?.inTime || '',
        outTime: entry?.outTime || '',
        shiftHours: entry ? Number(entry.shiftHours) : 0,
        otHours: entry ? Number(entry.otHours) : 0,
        assignedEquipmentId: entry?.assignedEquipmentId || '',
        assignedEquipmentCode: entry?.assignedEquipment?.code || '',
        status: entry?.status || 'draft',
        notes: entry?.notes || '',
        lastSavedAt: entry?.updatedAt ? new Date(entry.updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : undefined,
      };
    });

    res.json(result);
  } catch (error) {
    console.error('Error fetching operator entries:', error);
    res.status(500).json({ error: 'Failed to fetch operator entries' });
  }
};

// 9. Save / Upsert single operator entry
export const saveOperatorEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      operatorId,
      supervisorId,
      date,
      inTime,
      outTime,
      shiftHours,
      otHours,
      assignedEquipmentId,
      notes,
      status,
    } = req.body;

    if (!operatorId || !date) {
      res.status(400).json({ error: 'operatorId and date (YYYY-MM-DD) are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    let effectiveSupervisorId = supervisorId;
    if (!effectiveSupervisorId) {
      const defaultSupervisor = await prisma.user.findFirst({
        where: { tenantId, role: { in: ['supervisor', 'admin'] } },
      });
      effectiveSupervisorId = defaultSupervisor?.id;
    }

    if (!effectiveSupervisorId) {
      res.status(400).json({ error: 'Valid supervisorId is required' });
      return;
    }

    // 1. Ensure DailyOperatorAssignment exists
    let assignment = await prisma.dailyOperatorAssignment.findUnique({
      where: {
        tenantId_date_operatorId: {
          tenantId,
          date: targetDate,
          operatorId,
        },
      },
    });

    if (!assignment) {
      assignment = await prisma.dailyOperatorAssignment.create({
        data: {
          tenantId,
          date: targetDate,
          supervisorId: effectiveSupervisorId,
          operatorId,
        },
      });
    }

    // Guard: Prevent edits to approved or submitted operator time entries
    const existingEntry = await prisma.operatorTimeEntry.findUnique({
      where: { assignmentId: assignment.id },
    });
    if (existingEntry && (existingEntry.status === 'approved' || existingEntry.status === 'submitted')) {
      res.status(403).json({ error: 'Cannot edit operator time entry: Record has already been Submitted or Approved.' });
      return;
    }

    // 2. Upsert OperatorTimeEntry
    const timeEntry = await prisma.operatorTimeEntry.upsert({
      where: {
        assignmentId: assignment.id,
      },
      create: {
        tenantId,
        assignmentId: assignment.id,
        inTime: inTime || null,
        outTime: outTime || null,
        shiftHours: shiftHours !== undefined ? shiftHours : 0,
        otHours: otHours !== undefined ? otHours : 0,
        assignedEquipmentId: assignedEquipmentId || null,
        notes: notes || null,
        status: status || 'draft',
      },
      update: {
        inTime: inTime !== undefined ? inTime : undefined,
        outTime: outTime !== undefined ? outTime : undefined,
        shiftHours: shiftHours !== undefined ? shiftHours : undefined,
        otHours: otHours !== undefined ? otHours : undefined,
        assignedEquipmentId: assignedEquipmentId !== undefined ? (assignedEquipmentId || null) : undefined,
        notes: notes !== undefined ? notes : undefined,
        status: status || undefined,
      },
      include: {
        assignedEquipment: true,
      },
    });

    res.json({
      success: true,
      assignmentId: assignment.id,
      timeEntry,
    });
  } catch (error) {
    console.error('Error saving operator entry:', error);
    res.status(500).json({ error: 'Failed to save operator entry' });
  }
};

// 10. Save / Upsert bulk operator entries
export const saveBulkOperatorEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries, date, supervisorId } = req.body;
    if (!Array.isArray(entries) || !date) {
      res.status(400).json({ error: 'entries array and date are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);
    const dayTypeRules = await getDayTypeRulesAndId(tenantId, targetDate);

    let effectiveSupervisorId = supervisorId;
    if (!effectiveSupervisorId) {
      const defaultSupervisor = await prisma.user.findFirst({
        where: { tenantId, role: { in: ['supervisor', 'admin'] } },
      });
      effectiveSupervisorId = defaultSupervisor?.id;
    }

    const savedResults = [];

    for (const item of entries) {
      const opId = item.operatorId || item.id;
      if (!opId) continue;

      let assignment = await prisma.dailyOperatorAssignment.findUnique({
        where: {
          tenantId_date_operatorId: {
            tenantId,
            date: targetDate,
            operatorId: opId,
          },
        },
      });

      if (!assignment && effectiveSupervisorId) {
        assignment = await prisma.dailyOperatorAssignment.create({
          data: {
            tenantId,
            date: targetDate,
            supervisorId: effectiveSupervisorId,
            operatorId: opId,
          },
        });
      }

      if (assignment) {
        const inTime = item.inTime || null;
        const outTime = item.outTime || null;

        // Safely resolve assignedEquipmentId against Equipment table to avoid Foreign Key errors
        const rawEqId = item.assignedEquipmentId !== undefined 
          ? (item.assignedEquipmentId || null) 
          : (item.equipmentId !== undefined ? (item.equipmentId || null) : null);

        let safeEquipmentId: string | null = null;
        let isIdle = false;

        if (rawEqId) {
          if (rawEqId === 'ZXQOPRIDLE') {
            isIdle = true;
            // Check if there is an equipment entry with code 'ZXQOPRIDLE'
            const idleEq = await prisma.equipment.findFirst({
              where: { tenantId, code: 'ZXQOPRIDLE' },
              select: { id: true },
            });
            safeEquipmentId = idleEq ? idleEq.id : null;
          } else {
            // Check by ID or Code or magaNo
            const matchedEq = await prisma.equipment.findFirst({
              where: {
                tenantId,
                OR: [
                  { id: rawEqId },
                  { code: rawEqId },
                  { magaNo: rawEqId },
                ],
              },
              select: { id: true },
            });
            safeEquipmentId = matchedEq ? matchedEq.id : null;
          }
        }

        // Auto-note for idle operators
        let notes = item.notes || null;
        if (isIdle || (!safeEquipmentId && !rawEqId && inTime)) {
          if (!notes) {
            notes = 'Exter. Equipment Operator Idle (ZXQOPRIDLE)';
          } else if (!notes.includes('ZXQOPRIDLE')) {
            notes = `${notes} | Exter. Equipment Operator Idle (ZXQOPRIDLE)`;
          }
        }

        let shiftHours = item.shiftHours !== undefined ? Number(item.shiftHours) : (item.hours !== undefined ? Number(item.hours) : 0);
        let otHours = item.otHours !== undefined ? Number(item.otHours) : (item.overtimeHours !== undefined ? Number(item.overtimeHours) : 0);

        if (inTime && outTime) {
          const { shiftHours: calcShift, otHours: calcOt } = calculateShiftAndOvertime(
            inTime,
            outTime,
            dayTypeRules.standardHoursCap,
            dayTypeRules.isAllOvertime
          );
          shiftHours = calcShift > 0 ? calcShift : shiftHours;
          otHours = calcOt;
        }

        const timeEntry = await prisma.operatorTimeEntry.upsert({
          where: {
            assignmentId: assignment.id,
          },
          create: {
            tenantId,
            assignmentId: assignment.id,
            inTime,
            outTime,
            shiftHours,
            otHours,
            assignedEquipmentId: safeEquipmentId,
            notes,
            status: item.status || 'draft',
          },
          update: {
            inTime: item.inTime !== undefined ? inTime : undefined,
            outTime: item.outTime !== undefined ? outTime : undefined,
            shiftHours: (item.shiftHours !== undefined || item.hours !== undefined || (inTime && outTime)) ? shiftHours : undefined,
            otHours: (item.otHours !== undefined || item.overtimeHours !== undefined || (inTime && outTime)) ? otHours : undefined,
            assignedEquipmentId: rawEqId !== undefined ? safeEquipmentId : undefined,
            notes: notes !== undefined ? notes : undefined,
            status: item.status || undefined,
          },
        });
        savedResults.push(timeEntry);
      }
    }

    res.json({
      success: true,
      count: savedResults.length,
      savedResults,
    });
  } catch (error) {
    console.error('Error in bulk saving operator entries:', error);
    res.status(500).json({ error: 'Failed to bulk save operator entries' });
  }
};

// 11. Save / Upsert bulk equipment daily logs (Dynamic Units & Meter Engine)
export const saveBulkEquipmentLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries, date, supervisorId } = req.body;
    if (!Array.isArray(entries) || !date) {
      res.status(400).json({ error: 'entries array and date are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    let effectiveSupervisorId = supervisorId;
    if (!effectiveSupervisorId) {
      const defaultSupervisor = await prisma.user.findFirst({
        where: { tenantId, role: { in: ['supervisor', 'admin'] } },
      });
      effectiveSupervisorId = defaultSupervisor?.id;
    }

    const savedResults = [];

    for (const item of entries) {
      const eqId = item.id || item.equipmentId;
      if (!eqId) continue;

      let assignment = await prisma.dailyEquipmentAssignment.findUnique({
        where: {
          tenantId_date_equipmentId: {
            tenantId,
            date: targetDate,
            equipmentId: eqId,
          },
        },
      });

      if (!assignment && effectiveSupervisorId) {
        assignment = await prisma.dailyEquipmentAssignment.create({
          data: {
            tenantId,
            date: targetDate,
            supervisorId: effectiveSupervisorId,
            equipmentId: eqId,
          },
        });
      }

      if (assignment) {
        const loggedQty = item.daysValue !== undefined && item.daysValue > 0
          ? item.daysValue
          : (item.netHours || item.totalUtilization || 0);

        const dailyLog = await prisma.equipmentDailyLog.upsert({
          where: {
            assignmentId: assignment.id,
          },
          create: {
            tenantId,
            assignmentId: assignment.id,
            condition: item.condition || 'DRY',
            initialMeter: item.startMeter || 0,
            finalMeter: item.endMeter || 0,
            netRunningHours: item.netHours || 0,
            workingHours: item.workingHours || 0,
            idleHours: item.idleHours || 0,
            breakdownHours: item.breakdownHours || 0,
            fuelLiters: item.fuelIssuedLiters || item.fuelLiters || 0,
            totalMileage: item.totalMileage || 0,
            startMileage: item.startMileage || 0,
            endMileage: item.endMileage || 0,
            loggedQuantity: loggedQty,
            totalUtilization: item.totalUtilization || loggedQty,
            remarks: item.remarks || null,
            status: item.status || 'draft',
          },
          update: {
            condition: item.condition !== undefined ? item.condition : undefined,
            initialMeter: item.startMeter !== undefined ? item.startMeter : undefined,
            finalMeter: item.endMeter !== undefined ? item.endMeter : undefined,
            netRunningHours: item.netHours !== undefined ? item.netHours : undefined,
            workingHours: item.workingHours !== undefined ? item.workingHours : undefined,
            idleHours: item.idleHours !== undefined ? item.idleHours : undefined,
            breakdownHours: item.breakdownHours !== undefined ? item.breakdownHours : undefined,
            fuelLiters: item.fuelIssuedLiters !== undefined ? item.fuelIssuedLiters : (item.fuelLiters !== undefined ? item.fuelLiters : undefined),
            totalMileage: item.totalMileage !== undefined ? item.totalMileage : undefined,
            startMileage: item.startMileage !== undefined ? item.startMileage : undefined,
            endMileage: item.endMileage !== undefined ? item.endMileage : undefined,
            loggedQuantity: loggedQty,
            totalUtilization: item.totalUtilization || loggedQty,
            remarks: item.remarks !== undefined ? item.remarks : undefined,
            status: item.status || undefined,
          },
        });

        // Save activity splits if present
        if (Array.isArray(item.activitySplits) && item.activitySplits.length > 0) {
          await prisma.equipmentDailyLogActivity.deleteMany({
            where: { dailyLogId: dailyLog.id },
          });

          for (const split of item.activitySplits) {
            let actCodeId = split.activityCodeId;
            if (!actCodeId && split.activityCode) {
              const act = await prisma.activityCode.findFirst({
                where: { tenantId, code: split.activityCode },
              });
              actCodeId = act?.id;
            }

            if (actCodeId) {
              await prisma.equipmentDailyLogActivity.create({
                data: {
                  dailyLogId: dailyLog.id,
                  activityCodeId: actCodeId,
                  unit: split.unit || 'day',
                  utilization: split.utilization || 0,
                },
              });
            }
          }
        }

        savedResults.push(dailyLog);
      }
    }

    res.json({
      success: true,
      count: savedResults.length,
      savedResults,
    });
  } catch (error) {
    console.error('Error in bulk saving equipment logs:', error);
    res.status(500).json({ error: 'Failed to bulk save equipment logs' });
  }
};

// 12. Save / Upsert bulk labor time entries (high performance single-trip)
export const saveBulkLaborTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { entries, date, supervisorId } = req.body;
    if (!Array.isArray(entries) || !date) {
      res.status(400).json({ error: 'entries array and date are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);
    const { effectiveDayTypeId, standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);

    let effectiveSupervisorId = supervisorId;
    if (!effectiveSupervisorId) {
      const defaultSupervisor = await prisma.user.findFirst({
        where: { tenantId, role: { in: ['supervisor', 'admin'] } },
      });
      effectiveSupervisorId = defaultSupervisor?.id;
    }

    // Guard against modifying approved entries
    const approvedCheck = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        date: targetDate,
        status: 'approved',
      },
    });
    if (approvedCheck) {
      res.status(403).json({ error: 'Cannot edit time entries: Daily attendance has already been Approved by Admin.' });
      return;
    }

    for (const item of entries) {
      const { employeeId, activityId, hours, inTime, outTime, remarks, equipmentId } = item;
      if (!employeeId || !activityId) continue;

      const numHours = hours !== undefined ? parseFloat(hours) : 0;
      const finalInTime = inTime ?? null;
      const finalOutTime = outTime ?? null;

      let shiftHoursVal: number | null = null;
      let overtimeHours = 0;
      let otHoursVal = 0;
      let breakHours = 0;

      if (finalInTime && finalOutTime) {
        const calc = calculateShiftAndOvertime(finalInTime, finalOutTime, standardHoursCap, isAllOvertime);
        shiftHoursVal = calc.shiftHours;
        overtimeHours = calc.otHours;
        otHoursVal = calc.otHours;
        breakHours = calc.breakHours;
      } else {
        breakHours = computeBreakHours(finalInTime, finalOutTime);
        if (isAllOvertime) {
          overtimeHours = numHours;
          otHoursVal = numHours;
        } else if (numHours > standardHoursCap) {
          overtimeHours = numHours - standardHoursCap;
          otHoursVal = numHours - standardHoursCap;
        }
      }

      const existing = await prisma.timeEntry.findFirst({
        where: {
          tenantId,
          employeeId,
          activityId,
          date: targetDate,
        },
      });

      if (existing) {
        if (existing.status !== 'submitted') {
          await prisma.timeEntry.update({
            where: { id: existing.id },
            data: {
              hours: numHours,
              shiftHours: shiftHoursVal,
              overtimeHours,
              otHours: otHoursVal,
              breakHours,
              inTime: finalInTime,
              outTime: finalOutTime,
              equipmentId: equipmentId ?? existing.equipmentId,
              remarks: remarks ?? existing.remarks,
              supervisorId: effectiveSupervisorId || existing.supervisorId,
            },
          });
        }
      } else {
        await prisma.timeEntry.create({
          data: {
            tenantId,
            employeeId,
            supervisorId: effectiveSupervisorId,
            date: targetDate,
            activityId,
            equipmentId: equipmentId ?? null,
            effectiveDayTypeId,
            inTime: finalInTime,
            outTime: finalOutTime,
            hours: numHours,
            shiftHours: shiftHoursVal,
            overtimeHours,
            otHours: otHoursVal,
            breakHours,
            remarks: remarks || null,
            status: 'draft',
          },
        });
      }
    }

    res.json({ success: true, count: entries.length });
  } catch (error) {
    console.error('Error in saveBulkLaborTimeEntries:', error);
    res.status(500).json({ error: 'Failed to bulk save labor time entries' });
  }
};


