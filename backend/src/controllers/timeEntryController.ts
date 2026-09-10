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

// 1. Get assigned employees for supervisor & date
export const getAssignedEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = req.query.supervisorId as string;
    const dateStr = req.query.date as string;
    const tenantId = (req.query.tenantId as string) || (await getDefaultTenantId());

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

    const tenantId = req.body.tenantId || (await getDefaultTenantId());
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

    const tenantId = req.body.tenantId || (await getDefaultTenantId());
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
      await prisma.timeEntry.updateMany({
        where: {
          tenantId,
          employeeId,
          date: entryDate,
        },
        data: { outTime },
      });
      res.json({ success: true, employeeId, outTime, count: existingEntries.length });
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

    const tenantId = req.body.tenantId || (await getDefaultTenantId());
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

    const tenantId = req.body.tenantId || (await getDefaultTenantId());
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

    if (existing) {
      const updated = await prisma.timeEntry.update({
        where: { id: existing.id },
        data: {
          hours: numHours,
          overtimeHours,
          inTime: inTime ?? existing.inTime,
          outTime: outTime ?? existing.outTime,
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
        inTime: inTime || null,
        outTime: outTime || null,
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
    const tenantId = (req.query.tenantId as string) || (await getDefaultTenantId());

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
    const tenantId = req.body.tenantId || (await getDefaultTenantId());
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
