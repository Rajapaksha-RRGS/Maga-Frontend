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
    // Shutdown and Normal Day follow Normal Day rules (8.0 hours cap, >8h is OT)
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

// Helper: compute lunch break hours based on inTime & outTime
// Construction rule: shifts >= 5.0 hours (300 mins) have 1.0 hour lunch deducted; shifts < 5.0h have 0.0 deducted.
export function computeBreakHours(inTime?: string | null, outTime?: string | null): number {
  if (!inTime || !outTime) return 0;
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  const diffMins = (outH * 60 + outM) - (inH * 60 + inM);
  return diffMins >= 300 ? 1.0 : 0.0;
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

    // Strict lock: Check if records for this employee or supervisor are already submitted
    const submittedCheck = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        date: entryDate,
        status: 'submitted',
        OR: [
          { employeeId },
          ...(supervisorId ? [{ supervisorId }] : []),
        ],
      },
    });

    if (submittedCheck) {
      res.status(403).json({ error: 'Cannot check in: Daily attendance has already been submitted and locked.' });
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

    // Strict lock: Check if records for this employee or supervisor are already submitted
    const submittedCheck = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        date: entryDate,
        status: 'submitted',
        OR: [
          { employeeId },
          ...(supervisorId ? [{ supervisorId }] : []),
        ],
      },
    });

    if (submittedCheck) {
      res.status(403).json({ error: 'Cannot record checkout: Daily attendance has already been submitted and locked.' });
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
      const breakHours = computeBreakHours(inTime, outTime);

      await prisma.timeEntry.updateMany({
        where: {
          tenantId,
          employeeId,
          date: entryDate,
        },
        data: { outTime, breakHours },
      });
      res.json({ success: true, employeeId, outTime, breakHours, count: existingEntries.length });
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

    // Strict lock: Check if records for this supervisor or date are already submitted
    const submittedCheck = await prisma.timeEntry.findFirst({
      where: {
        tenantId,
        date: targetDate,
        status: 'submitted',
        ...(supervisorId ? { supervisorId } : {}),
      },
    });

    if (submittedCheck) {
      res.status(403).json({ error: 'Cannot update activities: Daily records have already been submitted and locked.' });
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
    let overtimeHours = 0;
    if (isAllOvertime) {
      overtimeHours = numHours;
    } else if (numHours > standardHoursCap) {
      overtimeHours = numHours - standardHoursCap;
    }

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
    const breakHours = computeBreakHours(finalInTime, finalOutTime);

    if (existing) {
      const updated = await prisma.timeEntry.update({
        where: { id: existing.id },
        data: {
          hours: numHours,
          overtimeHours,
          breakHours,
          inTime: finalInTime,
          outTime: finalOutTime,
          equipmentId: equipmentId ?? existing.equipmentId,
          remarks: remarks ?? existing.remarks,
        },
      });
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
        overtimeHours,
        breakHours,
        inTime: finalInTime,
        outTime: finalOutTime,
        remarks: remarks || null,
        status: 'draft',
      },
    });

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

    // Auto-populate default shift hours for any entries that have inTime & outTime but hours === 0
    const zeroHourDrafts = await prisma.timeEntry.findMany({
      where: {
        ...whereClause,
        inTime: { not: null },
        outTime: { not: null },
        hours: 0,
      },
    });

    if (zeroHourDrafts.length > 0) {
      const { standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);

      for (const entry of zeroHourDrafts) {
        if (!entry.inTime || !entry.outTime) continue;
        const [inH, inM] = entry.inTime.split(':').map(Number);
        const [outH, outM] = entry.outTime.split(':').map(Number);
        const diff = (outH * 60 + outM) - (inH * 60 + inM);
        if (diff > 0) {
          const gross = Math.round((diff / 60) * 100) / 100;
          const breakHours = computeBreakHours(entry.inTime, entry.outTime);
          const netHours = Math.max(0, Math.round((gross - breakHours) * 100) / 100);
          let otHours = 0;
          if (isAllOvertime) {
            otHours = netHours;
          } else if (netHours > standardHoursCap) {
            otHours = Math.round((netHours - standardHoursCap) * 100) / 100;
          }
          await prisma.timeEntry.update({
            where: { id: entry.id },
            data: {
              hours: netHours,
              overtimeHours: otHours,
              breakHours,
            },
          });
        }
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

    res.json({
      success: true,
      submittedCount: updated.count,
      submittedAt: submittedAt.toISOString(),
      supervisor: supervisor ? { id: supervisor.id, fullName: supervisor.fullName, username: supervisor.username } : null,
      message: `Successfully submitted ${updated.count} daily time entry record(s).`,
    });
  } catch (error) {
    console.error('Error submitting day:', error);
    res.status(500).json({ error: 'Failed to submit daily entries' });
  }
};

// 7. Admin: Get Approval Overview for Date (Submitted, Not Submitted, Approved)
export const getApprovalOverview = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());
    const targetDate = parseDate(dateStr);

    // 1. Get Day Type rules for this date
    const dayTypeRules = await getDayTypeRulesAndId(tenantId, targetDate);

    // 2. Fetch all daily assignments for this date
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

    // 3. Fetch all time entries for this date
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

    // 4. Collect all distinct supervisors involved on this date
    const supervisorMap = new Map<string, { id: string; fullName: string; username: string }>();

    assignments.forEach((a) => {
      if (a.supervisor) {
        supervisorMap.set(a.supervisor.id, a.supervisor);
      }
    });

    timeEntries.forEach((t) => {
      if (t.supervisor) {
        supervisorMap.set(t.supervisor.id, t.supervisor);
      }
    });

    const submitted: any[] = [];
    const notSubmitted: any[] = [];
    const approved: any[] = [];

    // 5. Categorize per supervisor
    for (const [supId, supInfo] of supervisorMap.entries()) {
      const supAssignments = assignments.filter((a) => a.supervisorId === supId);
      const supEntries = timeEntries.filter((t) => t.supervisorId === supId);

      const assignedWorkerIds = new Set(supAssignments.map((a) => a.employeeId));
      const workedWorkerIds = new Set(supEntries.map((t) => t.employeeId));

      const totalHours = supEntries.reduce((sum, t) => sum + Number(t.hours || 0), 0);
      const totalOvertime = supEntries.reduce((sum, t) => sum + Number(t.overtimeHours || 0), 0);

      const hasSubmitted = supEntries.some((t) => t.status === 'submitted');
      const allApproved = supEntries.length > 0 && supEntries.every((t) => t.status === 'approved');

      // Group workers
      const allEmpIds = Array.from(new Set([...assignedWorkerIds, ...workedWorkerIds]));
      const workerDetails = allEmpIds.map((empId) => {
        const assignment = supAssignments.find((a) => a.employeeId === empId);
        const entries = supEntries.filter((t) => t.employeeId === empId);
        const emp = assignment?.employee || entries[0]?.employee;

        const inTime = entries[0]?.inTime || '';
        const outTime = entries[0]?.outTime || '';
        const hours = entries.reduce((sum, e) => sum + Number(e.hours || 0), 0);
        const otHours = entries.reduce((sum, e) => sum + Number(e.overtimeHours || 0), 0);

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
          hours,
          otHours,
          activities,
          status,
        };
      });

      const groupData = {
        supervisorId: supId,
        supervisorName: supInfo.fullName,
        username: supInfo.username,
        assignedCount: supAssignments.length,
        workedCount: workerDetails.filter((w) => w.inTime || w.hours > 0).length,
        totalHours,
        totalOvertime,
        submittedAt: supEntries[0]?.submittedAt || null,
        status: allApproved ? 'approved' : (hasSubmitted ? 'submitted' : (supEntries.length > 0 ? 'draft' : 'not_started')),
        workers: workerDetails,
      };

      if (allApproved) {
        approved.push(groupData);
      } else if (hasSubmitted) {
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
        totalWorkers: assignments.length,
      },
    });
  } catch (error) {
    console.error('Error fetching approval overview:', error);
    res.status(500).json({ error: 'Failed to fetch approval overview' });
  }
};

// 7.1 Admin: Approve supervisor day / records
export const approveTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, date } = req.body;
    if (!date) {
      res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    const where: Record<string, any> = {
      tenantId,
      date: targetDate,
      status: { in: ['submitted', 'draft'] },
    };
    if (supervisorId) {
      where.supervisorId = supervisorId;
    }

    const result = await prisma.timeEntry.updateMany({
      where,
      data: {
        status: 'approved',
      },
    });

    res.json({
      success: true,
      approvedCount: result.count,
      message: `Successfully approved ${result.count} time entry record(s).`,
    });
  } catch (error) {
    console.error('Error approving time entries:', error);
    res.status(500).json({ error: 'Failed to approve time entries' });
  }
};

// 7.2 Admin: Reject supervisor day / return to draft
export const rejectTimeEntries = async (req: Request, res: Response): Promise<void> => {
  try {
    const { supervisorId, date, reason } = req.body;
    if (!date || !supervisorId) {
      res.status(400).json({ error: 'supervisorId and date are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    const result = await prisma.timeEntry.updateMany({
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

    res.json({
      success: true,
      rejectedCount: result.count,
      message: `Returned ${result.count} record(s) to draft for supervisor to edit.`,
    });
  } catch (error) {
    console.error('Error rejecting time entries:', error);
    res.status(500).json({ error: 'Failed to return entries to draft' });
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
        const timeEntry = await prisma.operatorTimeEntry.upsert({
          where: {
            assignmentId: assignment.id,
          },
          create: {
            tenantId,
            assignmentId: assignment.id,
            inTime: item.inTime || null,
            outTime: item.outTime || null,
            shiftHours: item.shiftHours !== undefined ? item.shiftHours : 0,
            otHours: item.otHours !== undefined ? item.otHours : 0,
            assignedEquipmentId: item.assignedEquipmentId || null,
            notes: item.notes || null,
            status: item.status || 'draft',
          },
          update: {
            inTime: item.inTime !== undefined ? item.inTime : undefined,
            outTime: item.outTime !== undefined ? item.outTime : undefined,
            shiftHours: item.shiftHours !== undefined ? item.shiftHours : undefined,
            otHours: item.otHours !== undefined ? item.otHours : undefined,
            assignedEquipmentId: item.assignedEquipmentId !== undefined ? (item.assignedEquipmentId || null) : undefined,
            notes: item.notes !== undefined ? item.notes : undefined,
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

