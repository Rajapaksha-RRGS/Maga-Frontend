import { Request, Response } from 'express';
import prisma from '../config/prisma';
import '../middleware/tenantMiddleware';
import { getDefaultTenantId } from '../utils/tenantHelper';

// Standard fixed day types used in construction
const DEFAULT_DAY_TYPES = [
  { name: 'Normal Day',     code: 'NORMAL',         rateMultiplier: 1.0 },
  { name: 'Saturday',       code: 'SATURDAY',       rateMultiplier: 1.0 },
  { name: 'Sunday',         code: 'SUNDAY',         rateMultiplier: 1.5 },
  { name: 'Shutdown',       code: 'SHUTDOWN',       rateMultiplier: 1.0 },
  { name: 'Poya / Holiday', code: 'POYA',           rateMultiplier: 2.0 },
];

function deriveCode(codeOrName: string): string {
  const lower = codeOrName.toLowerCase();
  if (lower.includes('sunday')) return 'SUNDAY';
  if (lower.includes('saturday')) return 'SATURDAY';
  if (lower.includes('shutdown')) return 'SHUTDOWN';
  if (lower.includes('holiday') || lower.includes('poya')) return 'POYA';
  return 'NORMAL';
}

async function ensureSeedDayTypes(): Promise<void> {
  for (const dt of DEFAULT_DAY_TYPES) {
    await prisma.mF_G_DayType.upsert({
      where: { code: dt.code },
      update: {
        name: dt.name,
        rateMultiplier: dt.rateMultiplier,
      },
      create: {
        code: dt.code,
        name: dt.name,
        rateMultiplier: dt.rateMultiplier,
      },
    });
  }
}

function parseCalendarDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

function formatUtcDate(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export async function getDayTypeRulesAndId(projectId: string, date: Date) {
  const calDay = await prisma.mF_P_CalendarDay.findUnique({
    where: {
      projectId_date: {
        projectId,
        date,
      },
    },
    include: { dayType: true },
  });

  let dayType = calDay?.dayType;
  if (!dayType) {
    const dayOfWeek = date.getUTCDay(); // 0 = Sun, 6 = Sat
    const defaultCode = dayOfWeek === 0 ? 'SUNDAY' : dayOfWeek === 6 ? 'SATURDAY' : 'NORMAL';
    dayType = (await prisma.mF_G_DayType.findFirst({
      where: { code: defaultCode },
    })) || undefined;
  }

  const code = (dayType?.code || 'NORMAL').toUpperCase();
  const mult = Number(dayType?.rateMultiplier ?? 1.0);

  return {
    effectiveDayTypeId: dayType?.id || '',
    rateMultiplier: mult,
    isAllOvertime: code === 'SUNDAY' || code === 'POYA',
    standardHoursCap: code === 'SATURDAY' ? 6.5 : 8.0,
  };
}

/**
 * Helper: Recalculate hours and overtime for open (draft/submitted) time entries
 * when the calendar Day Type for a date is altered by Admin.
 */
async function recalculateUnapprovedEntriesForDate(projectId: string, date: Date): Promise<number> {
  const rules = await getDayTypeRulesAndId(projectId, date);

  const unapproved = await prisma.mF_OP_TimeEntry.findMany({
    where: {
      projectId,
      date,
      status: { in: ['draft', 'submitted'] },
    },
    select: {
      id: true,
      hours: true,
    },
  });

  if (unapproved.length > 0) {
    for (const entry of unapproved) {
      const netHours = Number(entry.hours) || 0;
      let otHours = 0;

      if (rules.isAllOvertime) {
        otHours = netHours;
      } else if (netHours > rules.standardHoursCap) {
        otHours = Math.round((netHours - rules.standardHoursCap) * 100) / 100;
      } else {
        otHours = 0;
      }

      await prisma.mF_OP_TimeEntry.update({
        where: { id: entry.id },
        data: {
          effectiveDayTypeId: rules.effectiveDayTypeId,
          overtimeHours: otHours,
        },
      });
    }
  }

  return unapproved.length;
}

// 1. GET /api/calendar/day-types — List all day types
export const getDayTypes = async (_req: Request, res: Response): Promise<void> => {
  try {
    await ensureSeedDayTypes();
    const dayTypes = await prisma.mF_G_DayType.findMany({
      orderBy: { rateMultiplier: 'asc' },
    });

    const formatted = dayTypes.map((dt) => ({
      id: dt.id,
      name: dt.name,
      code: dt.code.toLowerCase(),
      rateMultiplier: Number(dt.rateMultiplier),
      overtimeAllowed: true,
      requiresApproval: dt.code === 'POYA' || dt.code === 'SUNDAY',
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching day types:', error);
    res.status(500).json({ error: 'Failed to fetch day types' });
  }
};

// 2. GET /api/calendar?year=&month= — Get full month calendar for site
export const getCalendarMonth = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    await ensureSeedDayTypes();

    const year = parseInt(req.query.year as string, 10) || new Date().getFullYear();
    const month = parseInt(req.query.month as string, 10) ?? new Date().getMonth();

    const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const endDate = new Date(Date.UTC(year, month, daysInMonth, 23, 59, 59));

    const allTypes = await prisma.mF_G_DayType.findMany();
    const normalType = allTypes.find((t) => deriveCode(t.code) === 'NORMAL') || allTypes[0];
    const satType = allTypes.find((t) => deriveCode(t.code) === 'SATURDAY') || normalType;
    const sunType = allTypes.find((t) => deriveCode(t.code) === 'SUNDAY') || normalType;

    const savedDays = await prisma.mF_P_CalendarDay.findMany({
      where: {
        projectId,
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: { dayType: true },
    });

    const savedMap = new Map<string, { dayTypeId: string; remarks: string | null }>();
    savedDays.forEach((sd) => {
      savedMap.set(formatUtcDate(new Date(sd.date)), {
        dayTypeId: sd.dayTypeId,
        remarks: sd.remarks,
      });
    });

    const entries: { date: string; dayTypeId: string; remarks?: string | null }[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(Date.UTC(year, month, d));
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dow = date.getUTCDay();

      const savedItem = savedMap.get(key);
      let dayTypeId = savedItem?.dayTypeId;
      if (!dayTypeId) {
        if (dow === 0 && sunType) dayTypeId = sunType.id;
        else if (dow === 6 && satType) dayTypeId = satType.id;
        else dayTypeId = normalType ? normalType.id : '';
      }

      entries.push({ date: key, dayTypeId, remarks: savedItem?.remarks || null });
    }

    res.json(entries);
  } catch (error) {
    console.error('Error fetching calendar month:', error);
    res.status(500).json({ error: 'Failed to fetch calendar entries' });
  }
};

// 3. POST /api/calendar/set-day — Set day type for a date
export const setCalendarDay = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const { date: dateStr, dayTypeId } = req.body || {};

    if (!dateStr || !dayTypeId) {
      res.status(400).json({ error: 'date and dayTypeId are required' });
      return;
    }

    const date = parseCalendarDate(dateStr);

    const approvedCount = await prisma.mF_OP_TimeEntry.count({
      where: {
        projectId,
        date,
        status: 'approved',
      },
    });

    if (approvedCount > 0) {
      res.status(400).json({
        error: `Cannot change Day Type: ${approvedCount} time entry record(s) on ${dateStr} are already Approved.`,
        isLocked: true,
      });
      return;
    }

    const entry = await prisma.mF_P_CalendarDay.upsert({
      where: {
        projectId_date: {
          projectId,
          date,
        },
      },
      update: {
        dayTypeId,
      },
      create: {
        projectId,
        date,
        dayTypeId,
      },
    });

    const recalculatedCount = await recalculateUnapprovedEntriesForDate(projectId, date);

    res.json({
      date: formatUtcDate(new Date(entry.date)),
      dayTypeId: entry.dayTypeId,
      recalculatedCount,
      message:
        recalculatedCount > 0
          ? `Day type updated and ${recalculatedCount} open time entries recalculated.`
          : 'Day type updated successfully.',
    });
  } catch (error) {
    console.error('Error setting calendar day:', error);
    res.status(500).json({ error: 'Failed to set calendar day' });
  }
};

// 4. POST /api/calendar/batch-set — Batch set calendar days
export const batchSetCalendarDays = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const { entries } = req.body || {};

    if (!Array.isArray(entries) || entries.length === 0) {
      res.status(400).json({ error: 'entries array is required' });
      return;
    }

    let updatedCount = 0;
    let totalRecalculated = 0;

    for (const item of entries) {
      const date = parseCalendarDate(item.date);

      const approvedCount = await prisma.mF_OP_TimeEntry.count({
        where: { projectId, date, status: 'approved' },
      });
      if (approvedCount > 0) {
        continue;
      }

      await prisma.mF_P_CalendarDay.upsert({
        where: {
          projectId_date: {
            projectId,
            date,
          },
        },
        update: {
          dayTypeId: item.dayTypeId,
        },
        create: {
          projectId,
          date,
          dayTypeId: item.dayTypeId,
        },
      });

      const recCount = await recalculateUnapprovedEntriesForDate(projectId, date);
      totalRecalculated += recCount;
      updatedCount++;
    }

    res.json({ updatedCount, totalRecalculated });
  } catch (error) {
    console.error('Error batch setting calendar days:', error);
    res.status(500).json({ error: 'Failed to batch set calendar days' });
  }
};

// 5. GET /api/calendar/events?date=YYYY-MM-DD
export const getCalendarEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const dateStr = req.query.date as string;

    if (!dateStr) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const date = parseCalendarDate(dateStr);
    const day = await prisma.mF_P_CalendarDay.findUnique({
      where: {
        projectId_date: {
          projectId,
          date,
        },
      },
    });

    let events: any[] = [];
    if (day?.remarks) {
      try {
        events = JSON.parse(day.remarks);
        if (!Array.isArray(events)) events = [];
      } catch {
        events = [];
      }
    }

    res.json({ date: dateStr, events });
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    res.status(500).json({ error: 'Failed to fetch calendar events' });
  }
};

// 6. POST /api/calendar/events
export const setCalendarEvents = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const { date: dateStr, events } = req.body || {};

    if (!dateStr || !Array.isArray(events)) {
      res.status(400).json({ error: 'date and events array are required' });
      return;
    }

    const date = parseCalendarDate(dateStr);
    const remarksJson = JSON.stringify(events);

    const allTypes = await prisma.mF_G_DayType.findMany();
    const normalType = allTypes.find((t) => deriveCode(t.code) === 'NORMAL') || allTypes[0];
    const satType = allTypes.find((t) => deriveCode(t.code) === 'SATURDAY') || normalType;
    const sunType = allTypes.find((t) => deriveCode(t.code) === 'SUNDAY') || normalType;

    const dow = date.getUTCDay();
    let defaultDayTypeId = normalType ? normalType.id : '';
    if (dow === 0 && sunType) defaultDayTypeId = sunType.id;
    else if (dow === 6 && satType) defaultDayTypeId = satType.id;

    const entry = await prisma.mF_P_CalendarDay.upsert({
      where: {
        projectId_date: {
          projectId,
          date,
        },
      },
      update: {
        remarks: remarksJson,
      },
      create: {
        projectId,
        date,
        dayTypeId: defaultDayTypeId,
        remarks: remarksJson,
      },
    });

    res.json({
      success: true,
      date: formatUtcDate(new Date(entry.date)),
      events,
    });
  } catch (error) {
    console.error('Error saving calendar events:', error);
    res.status(500).json({ error: 'Failed to save calendar events' });
  }
};

// 7. GET /api/calendar/supervisor-reminders
export const getSupervisorReminders = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const supervisorId = req.query.supervisorId as string;
    const dateStr = req.query.date as string;

    if (!dateStr) {
      res.status(400).json({ error: 'date query parameter is required' });
      return;
    }

    const date = parseCalendarDate(dateStr);
    const day = await prisma.mF_P_CalendarDay.findUnique({
      where: {
        projectId_date: {
          projectId,
          date,
        },
      },
    });

    let allEvents: any[] = [];
    if (day?.remarks) {
      try {
        allEvents = JSON.parse(day.remarks);
        if (!Array.isArray(allEvents)) allEvents = [];
      } catch {
        allEvents = [];
      }
    }

    const relevantReminders = allEvents.filter((evt) => {
      if (!evt.targetSupervisorId) return false;
      if (evt.targetSupervisorId === 'ADMIN_ONLY') return false;
      if (evt.targetSupervisorId === 'ALL') return true;
      if (supervisorId && evt.targetSupervisorId === supervisorId) return true;
      return false;
    });

    res.json({
      date: dateStr,
      reminders: relevantReminders,
      count: relevantReminders.length,
    });
  } catch (error) {
    console.error('Error fetching supervisor reminders:', error);
    res.status(500).json({ error: 'Failed to fetch supervisor reminders' });
  }
};
