import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getDefaultTenantId } from './employeeController';

// Helper: parse date to UTC midnight for date column
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

// 1. Get assignments for a specific date
export const getAssignmentsForDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
      return;
    }

    const tenantId = (req.query.tenantId as string) || (await getDefaultTenantId());
    const targetDate = parseDate(dateStr);

    const assignments = await prisma.dailyAssignment.findMany({
      where: {
        tenantId,
        date: targetDate,
      },
      include: {
        supervisor: {
          select: { id: true, fullName: true, username: true },
        },
        employee: {
          select: {
            id: true,
            employeeCode: true,
            callingName: true,
            fullName: true,
            tradeGroup: true,
            businessPartner: { select: { id: true, name: true, code: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = assignments.map((a) => ({
      id: a.id,
      date: dateStr,
      supervisorId: a.supervisorId,
      employeeId: a.employeeId,
      supervisorName: a.supervisor.fullName,
      employeeName: a.employee.callingName,
      employeeTrade: a.employee.tradeGroup,
      businessPartner: a.employee.businessPartner?.name || 'Direct',
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

// 2. Get past days gang summary (Past 5-7 days of recorded gangs)
export const getRecentGangSummaries = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req.query.tenantId as string) || (await getDefaultTenantId());
    const limitDays = parseInt(req.query.days as string, 10) || 5;
    const beforeDateStr = (req.query.before as string) || (req.query.targetDate as string);
    const beforeDate = beforeDateStr ? parseDate(beforeDateStr) : undefined;

    // Fetch distinct assignment dates (strictly before beforeDate if provided)
    const distinctDates = await prisma.dailyAssignment.findMany({
      where: {
        tenantId,
        ...(beforeDate ? { date: { lt: beforeDate } } : {}),
      },
      select: { date: true },
      distinct: ['date'],
      orderBy: { date: 'desc' },
      take: limitDays,
    });

    const summaries = await Promise.all(
      distinctDates.map(async ({ date }) => {
        const dateISO = date.toISOString().split('T')[0];

        const dayAssignments = await prisma.dailyAssignment.findMany({
          where: { tenantId, date },
          include: {
            supervisor: { select: { id: true, fullName: true } },
          },
        });

        const supervisorGangMap: Record<string, { supervisorId: string; supervisorName: string; workerCount: number }> = {};
        dayAssignments.forEach((a) => {
          if (!supervisorGangMap[a.supervisorId]) {
            supervisorGangMap[a.supervisorId] = {
              supervisorId: a.supervisorId,
              supervisorName: a.supervisor.fullName,
              workerCount: 0,
            };
          }
          supervisorGangMap[a.supervisorId].workerCount += 1;
        });

        return {
          date: dateISO,
          totalWorkers: dayAssignments.length,
          supervisorsCount: Object.keys(supervisorGangMap).length,
          gangs: Object.values(supervisorGangMap),
        };
      })
    );

    res.json(summaries);
  } catch (error) {
    console.error('Error fetching recent gang summaries:', error);
    res.status(500).json({ error: 'Failed to fetch recent gang summaries' });
  }
};

// 3. Assign employees to a supervisor for a date
export const assignEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, supervisorId, employeeIds } = req.body;
    if (!date || !supervisorId || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({ error: 'date, supervisorId, and non-empty employeeIds array are required' });
      return;
    }

    const tenantId = req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    const createdAssignments = [];

    for (const empId of employeeIds) {
      const assignment = await prisma.dailyAssignment.upsert({
        where: {
          tenantId_date_employeeId: {
            tenantId,
            date: targetDate,
            employeeId: empId,
          },
        },
        update: {
          supervisorId,
        },
        create: {
          tenantId,
          date: targetDate,
          supervisorId,
          employeeId: empId,
        },
      });
      createdAssignments.push(assignment);
    }

    res.status(201).json({
      success: true,
      count: createdAssignments.length,
      assignments: createdAssignments,
    });
  } catch (error) {
    console.error('Error assigning employees:', error);
    res.status(500).json({ error: 'Failed to assign employees' });
  }
};

// 4. Unassign an employee
export const unassignEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.dailyAssignment.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Employee unassigned successfully' });
  } catch (error: any) {
    console.error('Error unassigning employee:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Assignment record not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to unassign employee' });
  }
};

// 5. Copy gang from any selected past date to target date
export const copyGangsFromDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceDate, targetDate, supervisorIds, overwrite = true } = req.body;
    if (!sourceDate || !targetDate) {
      res.status(400).json({ error: 'sourceDate and targetDate are required' });
      return;
    }

    const tenantId = req.body.tenantId || (await getDefaultTenantId());
    const srcDateParsed = parseDate(sourceDate);
    const tgtDateParsed = parseDate(targetDate);

    // Fetch assignments from source date
    const sourceWhere: Record<string, any> = {
      tenantId,
      date: srcDateParsed,
    };
    if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
      sourceWhere.supervisorId = { in: supervisorIds };
    }

    const sourceAssignments = await prisma.dailyAssignment.findMany({
      where: sourceWhere,
    });

    if (sourceAssignments.length === 0) {
      res.json({
        success: true,
        copiedCount: 0,
        message: `No gang records found on ${sourceDate} to copy.`,
      });
      return;
    }

    // Overwrite existing assignments on target date so stale old assignments don't stay attached to other supervisors
    if (overwrite !== false) {
      const deleteWhere: Record<string, any> = {
        tenantId,
        date: tgtDateParsed,
      };
      if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
        deleteWhere.supervisorId = { in: supervisorIds };
      }
      await prisma.dailyAssignment.deleteMany({
        where: deleteWhere,
      });
    }

    // Insert copied assignments into target date
    await prisma.dailyAssignment.createMany({
      data: sourceAssignments.map((src) => ({
        tenantId,
        date: tgtDateParsed,
        supervisorId: src.supervisorId,
        employeeId: src.employeeId,
      })),
      skipDuplicates: true,
    });

    res.json({
      success: true,
      copiedCount: sourceAssignments.length,
      message: `Successfully copied ${sourceAssignments.length} gang assignment(s) from ${sourceDate} to ${targetDate}.`,
    });
  } catch (error) {
    console.error('Error copying gangs from date:', error);
    res.status(500).json({ error: 'Failed to copy gangs from date' });
  }
};
