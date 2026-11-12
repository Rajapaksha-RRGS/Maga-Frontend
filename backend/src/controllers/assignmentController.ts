import { Request, Response } from 'express';
import prisma from '../config/prisma';
import '../middleware/tenantMiddleware';
import { getDefaultTenantId } from '../utils/tenantHelper';

// Helper: parse date to UTC midnight for date column
function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
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

function isSheetLocked(sheet: { status?: string | null; isLocked?: boolean | null } | null | undefined): boolean {
  if (!sheet) return false;
  return sheet.status === 'submitted' || sheet.status === 'approved' || Boolean(sheet.isLocked);
}

// 0. GET /api/assignments/sheet-statuses?date=YYYY-MM-DD — Supervisor daily sheet lock statuses for a date
export const getDailySheetStatusesForDate = async (req: Request, res: Response): Promise<void> => {
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
    const sheets = await prisma.mF_OP_DailySheet.findMany({
      where: { projectId, date: targetDate },
      select: {
        supervisorId: true,
        status: true,
        isLocked: true,
        submittedAt: true,
        approvedAt: true,
      },
    });

    const statuses: Record<string, { status: string; isLocked: boolean; submittedAt: Date | null; approvedAt: Date | null }> = {};
    for (const s of sheets) {
      statuses[s.supervisorId] = {
        status: s.status,
        isLocked: isSheetLocked(s),
        submittedAt: s.submittedAt,
        approvedAt: s.approvedAt,
      };
    }

    res.json(statuses);
  } catch (error) {
    console.error('Error fetching daily sheet statuses:', error);
    res.status(500).json({ error: 'Failed to fetch daily sheet statuses' });
  }
};

// 1. GET /api/assignments?date=YYYY-MM-DD
export const getAssignmentsForDate = async (req: Request, res: Response): Promise<void> => {
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

    const assignments = await prisma.mF_OP_DailyAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          date: targetDate,
        },
        employee: {
          isOperator: false,
          corporateEmployee: { isOperator: false },
        },
      },
      select: {
        id: true,
        employeeId: true,
        isStandby: true,
        dailySheet: {
          select: {
            id: true,
            supervisorId: true,
            supervisor: {
              select: { id: true, fullName: true, username: true },
            },
          },
        },
        employee: {
          select: {
            id: true,
            callingName: true,
            corporateEmployee: {
              select: { employeeCode: true, fullName: true },
            },
            tradeGroup: {
              select: { name: true },
            },
            businessPartner: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = assignments.map((a) => ({
      id: a.id,
      date: dateStr,
      supervisorId: a.dailySheet.supervisorId,
      employeeId: a.employeeId,
      supervisorName: a.dailySheet.supervisor.fullName,
      employeeName: a.employee.callingName || a.employee.corporateEmployee.fullName,
      employeeCode: a.employee.corporateEmployee.employeeCode,
      employeeTrade: a.employee.tradeGroup?.name || 'General Labour',
      businessPartner: a.employee.businessPartner?.name || 'Direct',
      isStandby: a.isStandby,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
};

// 2. GET /api/assignments/recent-gangs?days=5
export const getRecentGangSummaries = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const limitDays = parseInt(req.query.days as string, 10) || 5;
    const beforeDateStr = (req.query.before as string) || (req.query.targetDate as string);
    const beforeDate = beforeDateStr ? parseDate(beforeDateStr) : undefined;

    const sheets = await prisma.mF_OP_DailySheet.findMany({
      where: {
        projectId,
        ...(beforeDate ? { date: { lt: beforeDate } } : {}),
      },
      select: {
        date: true,
        supervisorId: true,
        supervisor: { select: { id: true, fullName: true } },
        _count: { select: { assignments: true } },
      },
      orderBy: { date: 'desc' },
      take: limitDays * 10,
    });

    const dateMap = new Map<string, {
      date: string;
      totalWorkers: number;
      supervisorsCount: number;
      gangs: { supervisorId: string; supervisorName: string; workerCount: number }[];
    }>();

    for (const s of sheets) {
      const key = s.date.toISOString().split('T')[0];
      if (!dateMap.has(key)) {
        if (dateMap.size >= limitDays) continue;
        dateMap.set(key, {
          date: key,
          totalWorkers: 0,
          supervisorsCount: 0,
          gangs: [],
        });
      }

      const item = dateMap.get(key)!;
      const count = s._count.assignments;
      item.totalWorkers += count;
      item.supervisorsCount += 1;
      item.gangs.push({
        supervisorId: s.supervisorId,
        supervisorName: s.supervisor.fullName,
        workerCount: count,
      });
    }

    res.json(Array.from(dateMap.values()));
  } catch (error) {
    console.error('Error fetching recent gang summaries:', error);
    res.status(500).json({ error: 'Failed to fetch recent gang summaries' });
  }
};

// 2b. GET /api/assignments/supervisor-past-gangs — Fast single-query past gang lookup for supervisor
export const getSupervisorPastGangs = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = req.query.supervisorId as string;
    const beforeDateStr = req.query.before as string;
    const limit = Math.min(Math.max(parseInt(req.query.limit as string, 10) || 5, 1), 14);
    const type = (req.query.type as string) || 'labor';

    if (!supervisorId) {
      res.status(400).json({ error: 'supervisorId query parameter is required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const beforeDate = beforeDateStr ? parseDate(beforeDateStr) : new Date();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (type === 'operator') {
      const sheets = await prisma.mF_OP_DailySheet.findMany({
        where: {
          projectId,
          supervisorId,
          date: { lt: beforeDate },
          equipmentAssignments: { some: { operatorId: { not: null } } },
        },
        select: {
          date: true,
          equipmentAssignments: {
            where: { operatorId: { not: null } },
            select: {
              equipmentId: true,
              operator: {
                select: {
                  id: true,
                  callingName: true,
                  corporateEmployee: {
                    select: { employeeCode: true, fullName: true },
                  },
                  tradeGroup: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        take: limit,
      });

      const results = sheets.map((s) => {
        const dateStr = s.date.toISOString().split('T')[0];
        const dayName = dayNames[s.date.getUTCDay()];
        const validOps = s.equipmentAssignments.filter((ea) => ea.operator);
        const opIds = Array.from(new Set(validOps.map((ea) => ea.operator!.id)));
        const operators = validOps.map((ea) => ({
          id: ea.operator!.id,
          callingName: ea.operator!.callingName || ea.operator!.corporateEmployee?.fullName || 'Operator',
          employeeNumber: ea.operator!.corporateEmployee?.employeeCode || '',
          licenseNo: '',
          designation: ea.operator!.tradeGroup?.name || 'Machine Operator',
          inTime: '',
          outTime: '',
          shiftHours: 0,
          otHours: 0,
          assignedEquipmentId: ea.equipmentId || '',
          equipmentSplits: [],
        }));
        return {
          date: dateStr,
          dayName,
          operatorIds: opIds,
          operatorCount: opIds.length,
          operators,
        };
      });

      res.json(results);
      return;
    }

    // Labor past gangs
    const sheets = await prisma.mF_OP_DailySheet.findMany({
      where: {
        projectId,
        supervisorId,
        date: { lt: beforeDate },
        assignments: {
          some: {
            employee: {
              isOperator: false,
              corporateEmployee: { isOperator: false },
            },
          },
        },
      },
      select: {
        date: true,
        assignments: {
          where: {
            employee: {
              isOperator: false,
              corporateEmployee: { isOperator: false },
            },
          },
          select: { employeeId: true },
        },
      },
      orderBy: { date: 'desc' },
      take: limit,
    });

    const results = sheets.map((s) => {
      const dateStr = s.date.toISOString().split('T')[0];
      const dayName = dayNames[s.date.getUTCDay()];
      const wIds = Array.from(new Set(s.assignments.map((a) => a.employeeId)));
      return {
        date: dateStr,
        dayName,
        workerIds: wIds,
        workerCount: wIds.length,
      };
    });

    res.json(results);
  } catch (error) {
    console.error('Error fetching supervisor past gangs:', error);
    res.status(500).json({ error: 'Failed to fetch supervisor past gangs' });
  }
};

// 3. POST /api/assignments — Assign employees to supervisor for a date
export const assignEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, supervisorId, employeeIds } = req.body || {};
    if (!date || !supervisorId || !Array.isArray(employeeIds) || employeeIds.length === 0) {
      res.status(400).json({ error: 'date, supervisorId, and non-empty employeeIds array are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);

    // Verify supervisor belongs to project
    const supervisor = await prisma.mF_P_User.findFirst({
      where: { id: supervisorId, projectId },
    });
    if (!supervisor) {
      res.status(404).json({ error: 'Supervisor not found for this project' });
      return;
    }

    // Ensure DailySheet exists & verify it is not already submitted/approved
    const dailySheet = await getOrCreateDailySheet(projectId, supervisorId, targetDate);
    if (isSheetLocked(dailySheet)) {
      res.status(403).json({
        error: 'Cannot assign employees: This supervisor\'s daily sheet for this date is already submitted or approved.',
      });
      return;
    }

    // Strictly validate that operators CANNOT be assigned as laborers
    const validLaborers = await prisma.mF_P_Employee.findMany({
      where: {
        id: { in: employeeIds },
        projectId,
        isOperator: false,
        corporateEmployee: { isOperator: false },
      },
      select: { id: true },
    });
    const validLaborIds = validLaborers.map((l) => l.id);

    if (validLaborIds.length === 0) {
      res.status(400).json({ error: 'No valid non-operator laborers found in the provided IDs' });
      return;
    }

    // Prevent stealing workers who are already locked on another supervisor's submitted/approved sheet
    const lockedElsewhere = await prisma.mF_OP_DailyAssignment.findMany({
      where: {
        employeeId: { in: validLaborIds },
        dailySheet: {
          projectId,
          date: targetDate,
          id: { not: dailySheet.id },
          OR: [
            { status: { in: ['submitted', 'approved'] } },
            { isLocked: true },
          ],
        },
      },
      select: {
        employee: {
          select: {
            callingName: true,
            corporateEmployee: { select: { employeeCode: true, fullName: true } },
          },
        },
        dailySheet: {
          select: { supervisor: { select: { fullName: true } } },
        },
      },
    });

    if (lockedElsewhere.length > 0) {
      const names = lockedElsewhere
        .map((l) => l.employee.callingName || l.employee.corporateEmployee?.fullName || l.employee.corporateEmployee?.employeeCode)
        .filter(Boolean)
        .join(', ');
      res.status(409).json({
        error: `Cannot reassign worker(s) already locked on a submitted/approved sheet: ${names}`,
      });
      return;
    }

    // 1. Remove any existing assignment on the same date under other unlocked sheets in bulk
    await prisma.mF_OP_DailyAssignment.deleteMany({
      where: {
        employeeId: { in: validLaborIds },
        dailySheet: {
          projectId,
          date: targetDate,
          id: { not: dailySheet.id },
          status: 'draft',
          isLocked: false,
        },
      },
    });

    // 2. Bulk insert all assignments into dailySheet in one shot
    await prisma.mF_OP_DailyAssignment.createMany({
      data: validLaborIds.map((empId: string) => ({
        dailySheetId: dailySheet.id,
        employeeId: empId,
      })),
      skipDuplicates: true,
    });

    // 3. Query created assignments for response
    const createdAssignments = await prisma.mF_OP_DailyAssignment.findMany({
      where: {
        dailySheetId: dailySheet.id,
        employeeId: { in: validLaborIds },
      },
      select: {
        id: true,
        employeeId: true,
      },
    });

    res.status(201).json({
      success: true,
      count: createdAssignments.length,
      assignments: createdAssignments.map((a) => ({
        id: a.id,
        date,
        supervisorId,
        employeeId: a.employeeId,
      })),
    });
  } catch (error) {
    console.error('Error assigning employees:', error);
    res.status(500).json({ error: 'Failed to assign employees' });
  }
};

// 4. DELETE /api/assignments/:id — Unassign employee
export const unassignEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const dateStr = (req.query.date as string) || (req.body?.date as string);
    const supervisorId = (req.query.supervisorId as string) || (req.body?.supervisorId as string);
    const targetDate = dateStr ? parseDate(dateStr) : undefined;

    const existingAsgn = await prisma.mF_OP_DailyAssignment.findFirst({
      where: {
        OR: [{ id }, { employeeId: id }],
        ...(targetDate || supervisorId ? {
          dailySheet: {
            ...(targetDate ? { date: targetDate } : {}),
            ...(supervisorId ? { supervisorId } : {}),
          },
        } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        dailySheet: {
          select: { id: true, status: true, isLocked: true, date: true, supervisorId: true },
        },
      },
    });
    const targetEmpId = existingAsgn?.employeeId || id;

    if (isSheetLocked(existingAsgn?.dailySheet)) {
      res.status(403).json({
        error: 'Cannot unassign employee: This daily sheet is already submitted or approved.',
      });
      return;
    }

    const lockedTimeEntry = await prisma.mF_OP_TimeEntry.findFirst({
      where: {
        ...(targetDate ? { date: targetDate } : {}),
        ...(supervisorId ? { dailySheet: { supervisorId } } : {}),
        AND: [
          {
            OR: [
              { employeeId: id },
              { id },
              ...(targetEmpId ? [{ employeeId: targetEmpId }] : []),
            ],
          },
          {
            OR: [
              { status: { in: ['submitted', 'approved'] } },
              { dailySheet: { isLocked: true } },
              { dailySheet: { status: { in: ['submitted', 'approved'] } } },
            ],
          },
        ],
      },
      select: { id: true },
    });

    if (lockedTimeEntry) {
      res.status(403).json({
        error: 'Cannot unassign employee: Time entries for this daily sheet are already submitted or approved.',
      });
      return;
    }

    // 1. Delete from DailyAssignment (only unlocked draft sheets)
    await prisma.mF_OP_DailyAssignment.deleteMany({
      where: {
        OR: [
          { id },
          { employeeId: id },
          ...(targetEmpId ? [{ employeeId: targetEmpId }] : []),
        ],
        dailySheet: {
          status: 'draft',
          isLocked: false,
          ...(targetDate ? { date: targetDate } : {}),
          ...(supervisorId ? { supervisorId } : {}),
        },
      },
    });

    // 2. Also delete any draft time entries for this employee
    await prisma.mF_OP_TimeEntry.deleteMany({
      where: {
        OR: [
          { employeeId: id },
          { id },
          ...(targetEmpId ? [{ employeeId: targetEmpId }] : []),
        ],
        status: 'draft',
        ...(targetDate ? { date: targetDate } : {}),
        ...(supervisorId ? { dailySheet: { supervisorId } } : {}),
      },
    });

    res.json({ success: true, message: 'Employee unassigned successfully' });
  } catch (error: any) {
    console.error('Error unassigning employee:', error);
    res.status(500).json({ error: 'Failed to unassign employee' });
  }
};

// 5. POST /api/assignments/copy — Copy gangs from a past date
export const copyGangsFromDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceDate, targetDate, supervisorIds, overwrite = true } = req.body || {};
    if (!sourceDate || !targetDate) {
      res.status(400).json({ error: 'sourceDate and targetDate are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const srcDateParsed = parseDate(sourceDate);
    const tgtDateParsed = parseDate(targetDate);

    const sourceSheets = await prisma.mF_OP_DailySheet.findMany({
      where: {
        projectId,
        date: srcDateParsed,
        ...(Array.isArray(supervisorIds) && supervisorIds.length > 0
          ? { supervisorId: { in: supervisorIds } }
          : {}),
      },
      include: {
        assignments: true,
      },
    });

    let copiedCount = 0;
    let skippedLockedCount = 0;

    // Pre-find workers locked on any submitted/approved sheet on tgtDateParsed
    const lockedTargetAssignments = await prisma.mF_OP_DailyAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          date: tgtDateParsed,
          OR: [
            { status: { in: ['submitted', 'approved'] } },
            { isLocked: true },
          ],
        },
      },
      select: { employeeId: true },
    });
    const lockedEmpIdSet = new Set(lockedTargetAssignments.map((a) => a.employeeId));

    for (const srcSheet of sourceSheets) {
      if (srcSheet.assignments.length === 0) continue;

      const targetSheet = await getOrCreateDailySheet(projectId, srcSheet.supervisorId, tgtDateParsed);
      if (isSheetLocked(targetSheet)) {
        skippedLockedCount++;
        continue;
      }

      if (overwrite) {
        await prisma.mF_OP_DailyAssignment.deleteMany({
          where: { dailySheetId: targetSheet.id },
        });
      }

      const eligibleAssignments = srcSheet.assignments.filter((a) => !lockedEmpIdSet.has(a.employeeId));
      if (eligibleAssignments.length > 0) {
        const createRes = await prisma.mF_OP_DailyAssignment.createMany({
          data: eligibleAssignments.map((assign) => ({
            dailySheetId: targetSheet.id,
            employeeId: assign.employeeId,
            isStandby: assign.isStandby,
          })),
          skipDuplicates: true,
        });
        copiedCount += createRes.count;
      }
    }

    if (copiedCount === 0 && skippedLockedCount > 0) {
      res.status(403).json({
        error: 'Cannot copy gang: Target supervisor daily sheet(s) are already submitted or approved.',
      });
      return;
    }

    res.json({
      success: true,
      copiedCount,
      skippedLockedCount,
      message: skippedLockedCount > 0
        ? `Copied ${copiedCount} gang assignment(s). Skipped ${skippedLockedCount} locked/submitted supervisor sheet(s).`
        : `Successfully copied ${copiedCount} gang assignment(s) from ${sourceDate} to ${targetDate}.`,
    });
  } catch (error) {
    console.error('Error copying gangs from date:', error);
    res.status(500).json({ error: 'Failed to copy gangs from date' });
  }
};

// 6. GET /api/assignments/operator?date=YYYY-MM-DD
export const getOperatorAssignmentsForDate = async (req: Request, res: Response): Promise<void> => {
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

    const supervisorId = req.query.supervisorId as string;
    const targetDate = parseDate(dateStr);

    // 1. Check if Site Resource Pool Mode is enabled
    const project = await prisma.mF_P_Project.findUnique({
      where: { id: projectId },
      select: { equipmentAssignBySupervisor: true },
    });
    const isPoolMode = !!project?.equipmentAssignBySupervisor;

    // 2. Fetch explicit pre-assignments for this date
    const assignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          date: targetDate,
          ...(supervisorId ? { supervisorId } : {}),
        },
        operatorId: { not: null },
        operator: {
          isOperator: true,
        },
      },
      include: {
        dailySheet: {
          select: {
            supervisorId: true,
            supervisor: { select: { id: true, fullName: true, username: true } },
          },
        },
        operator: {
          select: {
            id: true,
            callingName: true,
            corporateEmployee: {
              select: { employeeCode: true, fullName: true },
            },
            tradeGroup: { select: { name: true } },
            businessPartner: { select: { name: true } },
          },
        },
        equipment: {
          select: {
            id: true,
            corporateEquipment: {
              select: {
                standardEquipmentNumber: true,
                vehicleNo: true,
                equipmentName: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // 3. Query all operator time entries on this date to attach Claiming / Ownership Context
    const existingOpEntries = await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        date: targetDate,
        employee: {
          OR: [
            { isOperator: true },
            { corporateEmployee: { isOperator: true } },
          ],
        },
      },
      include: {
        dailySheet: {
          select: {
            supervisorId: true,
            supervisor: { select: { id: true, fullName: true, username: true } },
          },
        },
        equipment: {
          select: {
            corporateEquipment: {
              select: { standardEquipmentNumber: true, vehicleNo: true },
            },
          },
        },
      },
    });

    const opClaimsMap = new Map<string, Array<{
      supervisorId: string;
      supervisorName: string;
      inTime?: string | null;
      outTime?: string | null;
      hours: number;
      machineCode?: string;
    }>>();

    for (const te of existingOpEntries) {
      if (!te.employeeId) continue;
      const sId = te.dailySheet?.supervisorId || '';
      const sName = te.dailySheet?.supervisor?.fullName || te.dailySheet?.supervisor?.username || 'Another Supervisor';
      const mCode = te.equipment?.corporateEquipment?.standardEquipmentNumber || te.equipment?.corporateEquipment?.vehicleNo;
      const list = opClaimsMap.get(te.employeeId) || [];
      list.push({
        supervisorId: sId,
        supervisorName: sName,
        inTime: te.inTime,
        outTime: te.outTime,
        hours: Number(te.shiftHours || te.hours || 0),
        machineCode: mCode || undefined,
      });
      opClaimsMap.set(te.employeeId, list);
    }

    const seen = new Set<string>();
    const formatted: any[] = [];

    // Query my supervisor's operator time entries to attach timeEntry object
    const myOpEntries = supervisorId ? await prisma.mF_OP_TimeEntry.findMany({
      where: {
        projectId,
        date: targetDate,
        dailySheet: { supervisorId },
        employee: {
          OR: [
            { isOperator: true },
            { corporateEmployee: { isOperator: true } },
          ],
        },
      },
      include: {
        employee: {
          include: {
            corporateEmployee: true,
            tradeGroup: true,
            businessPartner: true,
          },
        },
        equipment: {
          include: { corporateEquipment: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    }) : [];

    const myOpByEmp = new Map<string, typeof myOpEntries>();
    for (const me of myOpEntries) {
      if (!me.employeeId || !me.employee) continue;
      if (!myOpByEmp.has(me.employeeId)) {
        myOpByEmp.set(me.employeeId, []);
      }
      myOpByEmp.get(me.employeeId)!.push(me);
    }

    // Map pre-assignments
    for (const a of assignments) {
      if (!a.operator || !a.operatorId) continue;
      const key = `${a.dailySheet.supervisorId}_${a.operatorId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const claims = opClaimsMap.get(a.operatorId) || [];
      const otherClaim = claims.find((c) => c.supervisorId !== supervisorId);
      const myClaim = claims.find((c) => c.supervisorId === supervisorId);

      const empEntries = myOpByEmp.get(a.operatorId);
      const firstTe = empEntries && empEntries.length > 0 ? empEntries[0] : null;
      const timeEntry = firstTe ? {
        inTime: firstTe.inTime || undefined,
        outTime: firstTe.outTime || undefined,
        shiftHours: Number(firstTe.shiftHours || 0) || empEntries!.reduce((sum, e) => sum + Number(e.hours || 0), 0),
        otHours: Math.max(...empEntries!.map((e) => Number(e.overtimeHours || 0))),
        assignedEquipmentId: firstTe.equipmentId || a.equipmentId || undefined,
        equipmentSplits: empEntries!.filter((e) => e.equipmentId).map((e) => ({
          id: e.id,
          equipmentId: e.equipmentId!,
          hours: Number(e.hours || e.shiftHours || 0),
        })),
        status: firstTe.status,
        notes: firstTe.remarks || '',
      } : undefined;

      formatted.push({
        id: a.id,
        date: dateStr,
        supervisorId: a.dailySheet.supervisorId,
        operatorId: a.operatorId,
        equipmentId: a.equipmentId,
        supervisorName: a.dailySheet.supervisor.fullName,
        operatorName: a.operator.callingName || a.operator.corporateEmployee.fullName,
        operatorCode: a.operator.corporateEmployee.employeeCode,
        operatorTrade: a.operator.tradeGroup?.name || 'Operator',
        equipmentCode: a.equipment.corporateEquipment.standardEquipmentNumber,
        equipmentName: a.equipment.corporateEquipment.equipmentName,
        vehicleNo: a.equipment.corporateEquipment.vehicleNo,
        businessPartner: a.operator.businessPartner?.name || 'Direct',
        claimedBySupervisor: otherClaim?.supervisorName,
        claimedSupervisorId: otherClaim?.supervisorId,
        claimedInTime: otherClaim?.inTime || undefined,
        claimedOutTime: otherClaim?.outTime || undefined,
        claimedHours: otherClaim?.hours,
        claimedMachineCodes: claims.map((c) => c.machineCode).filter(Boolean),
        claimedByMe: !!myClaim || !!timeEntry,
        timeEntry,
      });
    }

    // Also include operators assigned to this daily sheet via DailyAssignment (MF_OP_DailyAssignment)
    const dailyOpAssignments = await prisma.mF_OP_DailyAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          date: targetDate,
          ...(supervisorId ? { supervisorId } : {}),
        },
        employee: {
          OR: [
            { isOperator: true },
            { corporateEmployee: { isOperator: true } },
          ],
        },
      },
      include: {
        dailySheet: {
          select: {
            supervisorId: true,
            supervisor: { select: { id: true, fullName: true, username: true } },
          },
        },
        employee: {
          select: {
            id: true,
            callingName: true,
            corporateEmployee: {
              select: { employeeCode: true, fullName: true },
            },
            tradeGroup: { select: { name: true } },
            businessPartner: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    for (const da of dailyOpAssignments) {
      if (!da.employee || !da.employeeId) continue;
      const key = `${da.dailySheet.supervisorId}_${da.employeeId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const claims = opClaimsMap.get(da.employeeId) || [];
      const otherClaim = claims.find((c) => c.supervisorId !== supervisorId);
      const myClaim = claims.find((c) => c.supervisorId === supervisorId);

      const empEntries = myOpByEmp.get(da.employeeId);
      const firstTe = empEntries && empEntries.length > 0 ? empEntries[0] : null;
      const timeEntry = firstTe ? {
        inTime: firstTe.inTime || undefined,
        outTime: firstTe.outTime || undefined,
        shiftHours: Number(firstTe.shiftHours || 0) || empEntries!.reduce((sum, e) => sum + Number(e.hours || 0), 0),
        otHours: Math.max(...empEntries!.map((e) => Number(e.overtimeHours || 0))),
        assignedEquipmentId: firstTe.equipmentId || undefined,
        equipmentSplits: empEntries!.filter((e) => e.equipmentId).map((e) => ({
          id: e.id,
          equipmentId: e.equipmentId!,
          hours: Number(e.hours || e.shiftHours || 0),
        })),
        status: firstTe.status,
        notes: firstTe.remarks || '',
      } : undefined;

      formatted.push({
        id: da.id,
        date: dateStr,
        supervisorId: da.dailySheet.supervisorId,
        operatorId: da.employeeId,
        equipmentId: firstTe?.equipmentId || '',
        supervisorName: da.dailySheet.supervisor.fullName,
        operatorName: da.employee.callingName || da.employee.corporateEmployee.fullName,
        operatorCode: da.employee.corporateEmployee.employeeCode,
        operatorTrade: da.employee.tradeGroup?.name || 'Operator',
        equipmentCode: (firstTe as any)?.equipment?.corporateEquipment?.standardEquipmentNumber || '',
        equipmentName: (firstTe as any)?.equipment?.corporateEquipment?.equipmentName || '',
        vehicleNo: (firstTe as any)?.equipment?.corporateEquipment?.vehicleNo || '',
        businessPartner: da.employee.businessPartner?.name || 'Direct',
        claimedBySupervisor: otherClaim?.supervisorName,
        claimedSupervisorId: otherClaim?.supervisorId,
        claimedInTime: otherClaim?.inTime || undefined,
        claimedOutTime: otherClaim?.outTime || undefined,
        claimedHours: otherClaim?.hours,
        claimedMachineCodes: claims.map((c) => c.machineCode).filter(Boolean),
        claimedByMe: !!myClaim || !!timeEntry,
        timeEntry,
      });
    }

    // Also include any operators this supervisor has already recorded entries for on this date (e.g. added from pool)
    if (supervisorId) {
      for (const [empId, empEntries] of myOpByEmp.entries()) {
        const key = `${supervisorId}_${empId}`;
        if (seen.has(key)) continue;
        seen.add(key);

        const firstTe = empEntries[0];
        const timeEntry = {
          inTime: firstTe.inTime || undefined,
          outTime: firstTe.outTime || undefined,
          shiftHours: Number(firstTe.shiftHours || 0) || empEntries.reduce((sum, e) => sum + Number(e.hours || 0), 0),
          otHours: Math.max(...empEntries.map((e) => Number(e.overtimeHours || 0))),
          assignedEquipmentId: firstTe.equipmentId || undefined,
          equipmentSplits: empEntries.filter((e) => e.equipmentId).map((e) => ({
            id: e.id,
            equipmentId: e.equipmentId!,
            hours: Number(e.hours || e.shiftHours || 0),
          })),
          status: firstTe.status,
          notes: firstTe.remarks || '',
        };

        formatted.push({
          id: `op-entry-${firstTe.id}`,
          date: dateStr,
          supervisorId,
          operatorId: empId,
          equipmentId: firstTe.equipmentId || '',
          supervisorName: '',
          operatorName: firstTe.employee.callingName || firstTe.employee.corporateEmployee.fullName,
          operatorCode: firstTe.employee.corporateEmployee.employeeCode,
          operatorTrade: firstTe.employee.tradeGroup?.name || 'Operator',
          equipmentCode: firstTe.equipment?.corporateEquipment?.standardEquipmentNumber || '',
          equipmentName: firstTe.equipment?.corporateEquipment?.equipmentName || '',
          vehicleNo: firstTe.equipment?.corporateEquipment?.vehicleNo || '',
          businessPartner: firstTe.employee.businessPartner?.name || 'Direct',
          claimedByMe: true,
          timeEntry,
        });
      }
    }

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching operator assignments:', error);
    res.status(500).json({ error: 'Failed to fetch operator assignments' });
  }
};

export const assignOperators = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, supervisorId, operatorIds, equipmentId } = req.body || {};
    if (!date || !supervisorId || !Array.isArray(operatorIds) || operatorIds.length === 0) {
      res.status(400).json({ error: 'date, supervisorId, and non-empty operatorIds array are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const dailySheet = await getOrCreateDailySheet(projectId, supervisorId, targetDate);
    if (isSheetLocked(dailySheet)) {
      res.status(403).json({
        error: 'Cannot assign operators: This supervisor\'s daily sheet for this date is already submitted or approved.',
      });
      return;
    }

    // Prevent stealing operators locked on another supervisor's submitted/approved sheet
    const lockedElsewhere = await prisma.mF_OP_DailyAssignment.findMany({
      where: {
        employeeId: { in: operatorIds },
        dailySheet: {
          projectId,
          date: targetDate,
          id: { not: dailySheet.id },
          OR: [
            { status: { in: ['submitted', 'approved'] } },
            { isLocked: true },
          ],
        },
      },
      select: {
        employee: {
          select: {
            callingName: true,
            corporateEmployee: { select: { employeeCode: true, fullName: true } },
          },
        },
      },
    });
    if (lockedElsewhere.length > 0) {
      const names = lockedElsewhere
        .map((l) => l.employee.callingName || l.employee.corporateEmployee?.fullName || l.employee.corporateEmployee?.employeeCode)
        .filter(Boolean)
        .join(', ');
      res.status(409).json({
        error: `Cannot reassign operator(s) already locked on a submitted/approved sheet: ${names}`,
      });
      return;
    }

    // 1. ALWAYS assign operators to the dailySheet in MF_OP_DailyAssignment in bulk!
    await prisma.mF_OP_DailyAssignment.deleteMany({
      where: {
        employeeId: { in: operatorIds },
        dailySheet: {
          projectId,
          date: targetDate,
          id: { not: dailySheet.id },
          status: 'draft',
          isLocked: false,
        },
      },
    });

    await prisma.mF_OP_DailyAssignment.createMany({
      data: operatorIds.map((opId: string) => ({
        dailySheetId: dailySheet.id,
        employeeId: opId,
      })),
      skipDuplicates: true,
    });

    const createdAssignments = await prisma.mF_OP_DailyAssignment.findMany({
      where: {
        dailySheetId: dailySheet.id,
        employeeId: { in: operatorIds },
      },
    });

    // 2. If equipmentId was provided (or equipment exists), also link to DailyEquipmentAssignment
    let targetEquipmentId = equipmentId;
    if (!targetEquipmentId) {
      const firstEq = await prisma.mF_P_Equipment.findFirst({
        where: { projectId, status: 'active' },
        select: { id: true },
      });
      targetEquipmentId = firstEq?.id;
    }

    if (targetEquipmentId) {
      for (const opId of operatorIds) {
        await prisma.mF_OP_DailyEquipmentAssignment.upsert({
          where: {
            dailySheetId_equipmentId: {
              dailySheetId: dailySheet.id,
              equipmentId: targetEquipmentId,
            },
          },
          update: {
            operatorId: opId,
          },
          create: {
            dailySheetId: dailySheet.id,
            operatorId: opId,
            equipmentId: targetEquipmentId,
          },
        });
      }
    }

    res.status(201).json({
      success: true,
      count: createdAssignments.length,
      assignments: createdAssignments,
    });
  } catch (error) {
    console.error('Error assigning operators:', error);
    res.status(500).json({ error: 'Failed to assign operators' });
  }
};

// 8. DELETE /api/assignments/operator/:id
export const unassignOperator = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const dateStr = (req.query.date as string) || (req.body?.date as string);
    const supervisorId = (req.query.supervisorId as string) || (req.body?.supervisorId as string);
    const targetDate = dateStr ? parseDate(dateStr) : undefined;

    const existingEqAsgn = await prisma.mF_OP_DailyEquipmentAssignment.findFirst({
      where: {
        OR: [{ id }, { operatorId: id }],
        ...(targetDate || supervisorId ? {
          dailySheet: {
            ...(targetDate ? { date: targetDate } : {}),
            ...(supervisorId ? { supervisorId } : {}),
          },
        } : {}),
      },
      select: {
        id: true,
        operatorId: true,
        dailySheetId: true,
        dailySheet: { select: { id: true, status: true, isLocked: true, date: true, supervisorId: true } },
      },
    });
    const existingDailyAsgn = await prisma.mF_OP_DailyAssignment.findFirst({
      where: {
        OR: [{ id }, { employeeId: id }],
        ...(targetDate || supervisorId ? {
          dailySheet: {
            ...(targetDate ? { date: targetDate } : {}),
            ...(supervisorId ? { supervisorId } : {}),
          },
        } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        dailySheetId: true,
        dailySheet: { select: { id: true, status: true, isLocked: true, date: true, supervisorId: true } },
      },
    });

    if (isSheetLocked(existingEqAsgn?.dailySheet) || isSheetLocked(existingDailyAsgn?.dailySheet)) {
      res.status(403).json({
        error: 'Cannot unassign operator: This daily sheet is already submitted or approved.',
      });
      return;
    }

    const targetOpId = existingEqAsgn?.operatorId || existingDailyAsgn?.employeeId || id;
    const lockedOpEntry = await prisma.mF_OP_TimeEntry.findFirst({
      where: {
        ...(targetDate ? { date: targetDate } : {}),
        ...(supervisorId ? { dailySheet: { supervisorId } } : {}),
        AND: [
          {
            OR: [
              { employeeId: id },
              { id },
              ...(targetOpId ? [{ employeeId: targetOpId }] : []),
            ],
          },
          {
            OR: [
              { status: { in: ['submitted', 'approved'] } },
              { dailySheet: { isLocked: true } },
              { dailySheet: { status: { in: ['submitted', 'approved'] } } },
            ],
          },
        ],
      },
      select: { id: true },
    });

    if (lockedOpEntry) {
      res.status(403).json({
        error: 'Cannot unassign operator: Time entries for this daily sheet are already submitted or approved.',
      });
      return;
    }

    // 1. Delete from DailyEquipmentAssignment (only unlocked draft sheets)
    await prisma.mF_OP_DailyEquipmentAssignment.deleteMany({
      where: {
        OR: [
          { id },
          { operatorId: id },
          ...(targetOpId ? [{ operatorId: targetOpId }] : []),
        ],
        dailySheet: {
          status: 'draft',
          isLocked: false,
          ...(targetDate ? { date: targetDate } : {}),
          ...(supervisorId ? { supervisorId } : {}),
        },
      },
    });

    // 2. Delete from DailyAssignment for this operator on unlocked draft sheets
    await prisma.mF_OP_DailyAssignment.deleteMany({
      where: {
        OR: [
          { id },
          { employeeId: id },
          ...(targetOpId ? [{ employeeId: targetOpId }] : []),
        ],
        dailySheet: {
          status: 'draft',
          isLocked: false,
          ...(targetDate ? { date: targetDate } : {}),
          ...(supervisorId ? { supervisorId } : {}),
        },
      },
    });

    // 3. Also delete any draft operator time entries
    await prisma.mF_OP_TimeEntry.deleteMany({
      where: {
        OR: [
          { employeeId: id },
          { id },
          ...(targetOpId ? [{ employeeId: targetOpId }] : []),
        ],
        status: 'draft',
        ...(targetDate ? { date: targetDate } : {}),
        ...(supervisorId ? { dailySheet: { supervisorId } } : {}),
      },
    });

    res.json({ success: true, message: 'Operator unassigned successfully' });
  } catch (error: any) {
    console.error('Error unassigning operator:', error);
    res.status(500).json({ error: 'Failed to unassign operator' });
  }
};

// 9. POST /api/assignments/operator/copy
export const copyOperatorGangsFromDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceDate, targetDate, supervisorIds, overwrite = true } = req.body || {};
    if (!sourceDate || !targetDate) {
      res.status(400).json({ error: 'sourceDate and targetDate are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const srcDateParsed = parseDate(sourceDate);
    const tgtDateParsed = parseDate(targetDate);

    const sourceSheets = await prisma.mF_OP_DailySheet.findMany({
      where: {
        projectId,
        date: srcDateParsed,
        ...(Array.isArray(supervisorIds) && supervisorIds.length > 0
          ? { supervisorId: { in: supervisorIds } }
          : {}),
      },
      include: {
        equipmentAssignments: true,
      },
    });

    let copiedCount = 0;
    let skippedLockedCount = 0;

    for (const srcSheet of sourceSheets) {
      if (srcSheet.equipmentAssignments.length === 0) continue;

      const targetSheet = await getOrCreateDailySheet(projectId, srcSheet.supervisorId, tgtDateParsed);
      if (isSheetLocked(targetSheet)) {
        skippedLockedCount++;
        continue;
      }

      if (overwrite) {
        await prisma.mF_OP_DailyEquipmentAssignment.deleteMany({
          where: { dailySheetId: targetSheet.id },
        });
      }

      for (const eqAssign of srcSheet.equipmentAssignments) {
        await prisma.mF_OP_DailyEquipmentAssignment.upsert({
          where: {
            dailySheetId_equipmentId: {
              dailySheetId: targetSheet.id,
              equipmentId: eqAssign.equipmentId,
            },
          },
          update: {
            operatorId: eqAssign.operatorId,
          },
          create: {
            dailySheetId: targetSheet.id,
            operatorId: eqAssign.operatorId,
            equipmentId: eqAssign.equipmentId,
          },
        });
        copiedCount++;
      }
    }

    if (copiedCount === 0 && skippedLockedCount > 0) {
      res.status(403).json({
        error: 'Cannot copy assignments: Target supervisor daily sheet(s) are already submitted or approved.',
      });
      return;
    }

    res.json({
      success: true,
      copiedCount,
      skippedLockedCount,
      message: skippedLockedCount > 0
        ? `Copied ${copiedCount} assignment(s). Skipped ${skippedLockedCount} locked/submitted supervisor sheet(s).`
        : `Successfully copied ${copiedCount} operator assignment(s) from ${sourceDate} to ${targetDate}.`,
    });
  } catch (error) {
    console.error('Error copying operator gangs:', error);
    res.status(500).json({ error: 'Failed to copy operator gangs' });
  }
};

// 10. GET /api/assignments/equipment?date=YYYY-MM-DD
export const getEquipmentAssignmentsForDate = async (req: Request, res: Response): Promise<void> => {
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

    const supervisorId = req.query.supervisorId as string;
    const targetDate = parseDate(dateStr);

    const assignments = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          date: targetDate,
          ...(supervisorId ? { supervisorId } : {}),
        },
      },
      include: {
        dailySheet: {
          select: {
            supervisorId: true,
            supervisor: { select: { id: true, fullName: true, username: true } },
          },
        },
        equipment: {
          select: {
            id: true,
            condition: true,
            costRate: true,
            meterUnitCode: true,
            corporateEquipment: {
              select: {
                standardEquipmentNumber: true,
                vehicleNo: true,
                equipmentName: true,
                type: true,
                unit: true,
              },
            },
          },
        },
        operator: {
          select: {
            id: true,
            callingName: true,
            corporateEmployee: { select: { fullName: true } },
          },
        },
        dailyLog: {
          include: {
            activities: {
              include: {
                activityCode: { select: { id: true, code: true, description: true, unit: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = assignments.map((a) => {
      const corp = a.equipment.corporateEquipment;
      const primaryUnit = a.equipment.meterUnitCode || corp.unit || 'Hrs';
      return {
        id: a.id,
        date: dateStr,
        supervisorId: a.dailySheet.supervisorId,
        equipmentId: a.equipmentId,
        operatorId: a.operatorId,
        operatorName: a.operator?.callingName || a.operator?.corporateEmployee?.fullName || 'Unassigned',
        supervisorName: a.dailySheet.supervisor.fullName,
        equipmentName: corp.equipmentName,
        equipmentCode: corp.standardEquipmentNumber,
        vehicleNo: corp.vehicleNo || corp.standardEquipmentNumber,
        condition: a.equipment.condition,
        equipmentType: corp.type || '',
        costRate: Number(a.equipment.costRate || 0),
        primaryUnit,
        dailyLog: a.dailyLog
          ? {
              startMeter: Number(a.dailyLog.initialMeter || 0),
              endMeter: Number(a.dailyLog.finalMeter || 0),
              netHours: Number(a.dailyLog.netRunningHours || 0),
              workingHours: Number(a.dailyLog.workingHours || 0),
              idleHours: Number(a.dailyLog.idleHours || 0),
              breakdownHours: Number(a.dailyLog.breakdownHours || 0),
              fuelIssuedLiters: Number(a.dailyLog.fuelLiters || 0),
              startMileage: Number(a.dailyLog.startMileage || 0),
              endMileage: Number(a.dailyLog.endMileage || 0),
              totalMileage: Number(a.dailyLog.totalMileage || 0),
              totalUtilization: Number(a.dailyLog.totalUtilization || 0),
              daysValue: (primaryUnit.toLowerCase() === 'day' || primaryUnit.toLowerCase() === 'days' || primaryUnit.toLowerCase() === 'mth')
                ? Number(a.dailyLog.totalUtilization || 0)
                : undefined,
              hoursValue: (primaryUnit.toLowerCase() === 'hrs' || primaryUnit.toLowerCase() === 'hr')
                ? Number(a.dailyLog.totalUtilization || a.dailyLog.workingHours || 0)
                : undefined,
              remarks: a.dailyLog.remarks,
              status: a.dailyLog.status,
              activityCode: a.dailyLog.activities[0]?.activityCode?.code || '',
              activitySplits: a.dailyLog.activities.map((act) => ({
                id: act.id,
                activityCode: act.activityCode?.code || '',
                unit: a.dailyLog?.unitCode || primaryUnit || "Hrs",
                utilization: Number(act.utilization || 0),
              })),
            }
          : null,
        activityCode: a.dailyLog?.activities[0]?.activityCode?.code || '',
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching equipment assignments:', error);
    res.status(500).json({ error: 'Failed to fetch equipment assignments' });
  }
};

// 11. POST /api/assignments/equipment
export const assignEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, supervisorId, equipmentIds, operatorId } = req.body || {};
    if (!date || !supervisorId || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      res.status(400).json({ error: 'date, supervisorId, and non-empty equipmentIds array are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const targetDate = parseDate(date);
    const dailySheet = await getOrCreateDailySheet(projectId, supervisorId, targetDate);
    if (isSheetLocked(dailySheet)) {
      res.status(403).json({
        error: 'Cannot assign equipment: This supervisor\'s daily sheet for this date is already submitted or approved.',
      });
      return;
    }

    // Resolve an operator: either provided or fallback to first operator or employee
    const targetOperatorId = operatorId || null;

    const created = [];
    for (const eqId of equipmentIds) {
      const assignment = await prisma.mF_OP_DailyEquipmentAssignment.upsert({
        where: {
          dailySheetId_equipmentId: {
            dailySheetId: dailySheet.id,
            equipmentId: eqId,
          },
        },
        update: {
          ...(targetOperatorId ? { operatorId: targetOperatorId } : {}),
        },
        create: {
          dailySheetId: dailySheet.id,
          operatorId: targetOperatorId,
          equipmentId: eqId,
        },
      });
      created.push(assignment);
    }

    res.status(201).json({
      success: true,
      count: created.length,
      assignments: created,
    });
  } catch (error) {
    console.error('Error assigning equipment:', error);
    res.status(500).json({ error: 'Failed to assign equipment' });
  }
};

// 12. DELETE /api/assignments/equipment/:id
export const unassignEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const dateStr = (req.query.date as string) || (req.body?.date as string);
    const supervisorId = (req.query.supervisorId as string) || (req.body?.supervisorId as string);
    const targetDate = dateStr ? parseDate(dateStr) : undefined;

    // Support deleting by either assignment ID or equipment ID
    const existingAsgn = await prisma.mF_OP_DailyEquipmentAssignment.findFirst({
      where: {
        OR: [{ id }, { equipmentId: id }],
      },
      select: { id: true, equipmentId: true },
    });
    const targetEqId = existingAsgn?.equipmentId || id;

    const whereClause: any = {
      OR: [
        { id },
        { equipmentId: id },
        ...(targetEqId ? [{ equipmentId: targetEqId }] : []),
      ],
    };

    if (targetDate || supervisorId) {
      whereClause.dailySheet = {
        ...(targetDate ? { date: targetDate } : {}),
        ...(supervisorId ? { supervisorId } : {}),
      };
    }

    const assignmentsToDelete = await prisma.mF_OP_DailyEquipmentAssignment.findMany({
      where: whereClause,
      include: {
        dailyLog: true,
        dailySheet: { select: { status: true, isLocked: true } },
      },
    });

    const hasLockedEquipmentSheet = assignmentsToDelete.some(
      (asgn) => isSheetLocked(asgn.dailySheet) || asgn.dailyLog?.status === 'submitted' || asgn.dailyLog?.status === 'approved'
    );
    if (hasLockedEquipmentSheet) {
      res.status(403).json({
        error: 'Cannot unassign equipment: This daily sheet is already submitted or approved.',
      });
      return;
    }

    if (assignmentsToDelete.length === 0) {
      const byId = await prisma.mF_OP_DailyEquipmentAssignment.findUnique({
        where: { id },
        include: { dailyLog: true, dailySheet: { select: { status: true, isLocked: true } } },
      });
      if (byId && (isSheetLocked(byId.dailySheet) || byId.dailyLog?.status === 'submitted' || byId.dailyLog?.status === 'approved')) {
        res.status(403).json({
          error: 'Cannot unassign equipment: This daily sheet is already submitted or approved.',
        });
        return;
      }
      try {
        await prisma.mF_OP_DailyEquipmentAssignment.delete({ where: { id } });
      } catch (err: any) {
        if (err.code !== 'P2025') throw err;
      }
      res.json({ success: true, message: 'Equipment unassigned successfully' });
      return;
    }

    for (const asgn of assignmentsToDelete) {
      if (asgn.dailyLog) {
        await prisma.mF_OP_EquipmentDailyLogActivity.deleteMany({
          where: { dailyLogId: asgn.dailyLog.id },
        });
        await prisma.mF_OP_EquipmentDailyLog.delete({
          where: { id: asgn.dailyLog.id },
        });
      }
      await prisma.mF_OP_DailyEquipmentAssignment.delete({
        where: { id: asgn.id },
      });
    }

    res.json({ success: true, message: 'Equipment unassigned successfully' });
  } catch (error: any) {
    console.error('Error unassigning equipment:', error);
    res.status(500).json({ error: 'Failed to unassign equipment' });
  }
};

// 13. POST /api/assignments/equipment/copy
export const copyEquipmentGangsFromDate = copyOperatorGangsFromDate;

// 14. GET /api/assignments/standby-pool?date=YYYY-MM-DD
export const getStandbyPoolForDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = req.query.date as string;
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const allEmployees = await prisma.mF_P_Employee.findMany({
      where: {
        projectId,
        status: 'active',
      },
      select: {
        id: true,
        callingName: true,
        corporateEmployee: {
          select: { employeeCode: true, fullName: true, nicNo: true },
        },
        tradeGroup: { select: { name: true } },
        businessPartner: { select: { name: true } },
      },
      orderBy: {
        corporateEmployee: { employeeCode: 'asc' },
      },
    });

    const assignedIds = new Set<string>();
    if (dateStr) {
      const targetDate = parseDate(dateStr);
      const assignments = await prisma.mF_OP_DailyAssignment.findMany({
        where: {
          dailySheet: {
            projectId,
            date: targetDate,
          },
        },
        select: { employeeId: true },
      });
      assignments.forEach((a) => assignedIds.add(a.employeeId));
    }

    const available = allEmployees.filter((e) => !assignedIds.has(e.id));
    const poolList = available.length > 0 ? available : allEmployees;

    const formatted = poolList.map((e) => ({
      id: e.id,
      employeeCode: e.corporateEmployee.employeeCode,
      callingName: e.callingName || e.corporateEmployee.fullName,
      fullName: e.corporateEmployee.fullName,
      tradeGroup: e.tradeGroup?.name || 'General Helper',
      businessPartner: e.businessPartner?.name || 'Mäga Direct',
      nic: e.corporateEmployee.nicNo,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching standby pool:', error);
    res.status(500).json({ error: 'Failed to fetch standby pool' });
  }
};
