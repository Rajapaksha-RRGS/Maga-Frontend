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
  return await prisma.dailySheet.upsert({
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

    const assignments = await prisma.dailyAssignment.findMany({
      where: {
        dailySheet: {
          projectId,
          date: targetDate,
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

    const sheets = await prisma.dailySheet.findMany({
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
    const supervisor = await prisma.user.findFirst({
      where: { id: supervisorId, projectId },
    });
    if (!supervisor) {
      res.status(404).json({ error: 'Supervisor not found for this project' });
      return;
    }

    // Ensure DailySheet exists
    const dailySheet = await getOrCreateDailySheet(projectId, supervisorId, targetDate);

    const createdAssignments = [];
    for (const empId of employeeIds) {
      // Remove any existing assignment on the same date under other sheets
      const otherSheets = await prisma.dailyAssignment.findMany({
        where: {
          employeeId: empId,
          dailySheet: {
            projectId,
            date: targetDate,
            id: { not: dailySheet.id },
          },
        },
        select: { id: true },
      });

      if (otherSheets.length > 0) {
        await prisma.dailyAssignment.deleteMany({
          where: { id: { in: otherSheets.map((o) => o.id) } },
        });
      }

      const assignment = await prisma.dailyAssignment.upsert({
        where: {
          dailySheetId_employeeId: {
            dailySheetId: dailySheet.id,
            employeeId: empId,
          },
        },
        update: {},
        create: {
          dailySheetId: dailySheet.id,
          employeeId: empId,
        },
      });
      createdAssignments.push(assignment);
    }

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

    const sourceSheets = await prisma.dailySheet.findMany({
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

    for (const srcSheet of sourceSheets) {
      if (srcSheet.assignments.length === 0) continue;

      const targetSheet = await getOrCreateDailySheet(projectId, srcSheet.supervisorId, tgtDateParsed);

      if (overwrite) {
        await prisma.dailyAssignment.deleteMany({
          where: { dailySheetId: targetSheet.id },
        });
      }

      for (const assign of srcSheet.assignments) {
        await prisma.dailyAssignment.upsert({
          where: {
            dailySheetId_employeeId: {
              dailySheetId: targetSheet.id,
              employeeId: assign.employeeId,
            },
          },
          update: {},
          create: {
            dailySheetId: targetSheet.id,
            employeeId: assign.employeeId,
            isStandby: assign.isStandby,
          },
        });
        copiedCount++;
      }
    }

    res.json({
      success: true,
      copiedCount,
      message: `Successfully copied ${copiedCount} gang assignment(s) from ${sourceDate} to ${targetDate}.`,
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

    const assignments = await prisma.dailyEquipmentAssignment.findMany({
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

    const formatted = assignments.map((a) => ({
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
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching operator assignments:', error);
    res.status(500).json({ error: 'Failed to fetch operator assignments' });
  }
};

// 7. POST /api/assignments/operator
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

    // Resolve an equipment ID: either provided or fallback to first active project equipment
    let targetEquipmentId = equipmentId;
    if (!targetEquipmentId) {
      const firstEq = await prisma.equipment.findFirst({
        where: { projectId, status: 'active' },
        select: { id: true },
      });
      targetEquipmentId = firstEq?.id;
    }

    if (!targetEquipmentId) {
      res.status(400).json({ error: 'No equipment available to assign operators to' });
      return;
    }

    const created = [];
    for (const opId of operatorIds) {
      const assignment = await prisma.dailyEquipmentAssignment.upsert({
        where: {
          dailySheetId_operatorId_equipmentId: {
            dailySheetId: dailySheet.id,
            operatorId: opId,
            equipmentId: targetEquipmentId,
          },
        },
        update: {},
        create: {
          dailySheetId: dailySheet.id,
          operatorId: opId,
          equipmentId: targetEquipmentId,
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
    console.error('Error assigning operators:', error);
    res.status(500).json({ error: 'Failed to assign operators' });
  }
};

// 8. DELETE /api/assignments/operator/:id
export const unassignOperator = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await prisma.dailyEquipmentAssignment.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Operator unassigned successfully' });
  } catch (error: any) {
    console.error('Error unassigning operator:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Operator assignment not found' });
      return;
    }
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

    const sourceSheets = await prisma.dailySheet.findMany({
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

    for (const srcSheet of sourceSheets) {
      if (srcSheet.equipmentAssignments.length === 0) continue;

      const targetSheet = await getOrCreateDailySheet(projectId, srcSheet.supervisorId, tgtDateParsed);

      if (overwrite) {
        await prisma.dailyEquipmentAssignment.deleteMany({
          where: { dailySheetId: targetSheet.id },
        });
      }

      for (const eqAssign of srcSheet.equipmentAssignments) {
        await prisma.dailyEquipmentAssignment.upsert({
          where: {
            dailySheetId_operatorId_equipmentId: {
              dailySheetId: targetSheet.id,
              operatorId: eqAssign.operatorId,
              equipmentId: eqAssign.equipmentId,
            },
          },
          update: {},
          create: {
            dailySheetId: targetSheet.id,
            operatorId: eqAssign.operatorId,
            equipmentId: eqAssign.equipmentId,
          },
        });
        copiedCount++;
      }
    }

    res.json({
      success: true,
      copiedCount,
      message: `Successfully copied ${copiedCount} operator assignment(s) from ${sourceDate} to ${targetDate}.`,
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

    const assignments = await prisma.dailyEquipmentAssignment.findMany({
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
                activityCode: { select: { id: true, code: true, description: true } },
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
        operatorName: a.operator.callingName || a.operator.corporateEmployee.fullName,
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
              remarks: a.dailyLog.remarks,
              status: a.dailyLog.status,
              activitySplits: a.dailyLog.activities.map((act) => ({
                id: act.id,
                activityCode: act.activityCode?.code || '',
                utilization: Number(act.utilization || 0),
              })),
            }
          : null,
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

    // Resolve an operator: either provided or fallback to first operator or employee
    let targetOperatorId = operatorId;
    if (!targetOperatorId) {
      const firstOp = await prisma.employee.findFirst({
        where: { projectId, isOperator: true, status: 'active' },
        select: { id: true },
      });
      targetOperatorId = firstOp?.id;
    }
    if (!targetOperatorId) {
      const anyEmp = await prisma.employee.findFirst({
        where: { projectId, status: 'active' },
        select: { id: true },
      });
      targetOperatorId = anyEmp?.id;
    }

    if (!targetOperatorId) {
      res.status(400).json({ error: 'No operator or employee available to pair with equipment' });
      return;
    }

    const created = [];
    for (const eqId of equipmentIds) {
      const assignment = await prisma.dailyEquipmentAssignment.upsert({
        where: {
          dailySheetId_operatorId_equipmentId: {
            dailySheetId: dailySheet.id,
            operatorId: targetOperatorId,
            equipmentId: eqId,
          },
        },
        update: {},
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
    await prisma.dailyEquipmentAssignment.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Equipment unassigned successfully' });
  } catch (error: any) {
    console.error('Error unassigning equipment:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Equipment assignment not found' });
      return;
    }
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

    const allEmployees = await prisma.employee.findMany({
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
      const assignments = await prisma.dailyAssignment.findMany({
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
