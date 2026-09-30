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

    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());
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
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());
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

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    // Validate supervisor belongs to tenant
    const supervisor = await prisma.user.findFirst({
      where: { id: supervisorId, tenantId },
    });
    if (!supervisor) {
      res.status(404).json({ error: 'Supervisor not found for this tenant' });
      return;
    }

    // Validate employee IDs belong to tenant
    const validEmployees = await prisma.employee.findMany({
      where: { id: { in: employeeIds }, tenantId },
      select: { id: true },
    });
    const validEmpIdSet = new Set(validEmployees.map((e) => e.id));
    const invalidEmpIds = employeeIds.filter((id) => !validEmpIdSet.has(id));
    if (invalidEmpIds.length > 0) {
      res.status(400).json({ error: `The following employee ID(s) do not belong to this tenant: ${invalidEmpIds.join(', ')}` });
      return;
    }

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
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());

    const existing = await prisma.dailyAssignment.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Assignment record not found' });
      return;
    }

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

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
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

// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR ASSIGNMENT CONTROLLER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// 6. Get operator assignments for a specific date
export const getOperatorAssignmentsForDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());
    const supervisorId = req.query.supervisorId as string;
    const targetDate = parseDate(dateStr);

    const where: Record<string, any> = {
      tenantId,
      date: targetDate,
    };
    if (supervisorId) {
      where.supervisorId = supervisorId;
    }

    const assignments = await prisma.dailyOperatorAssignment.findMany({
      where,
      include: {
        supervisor: {
          select: { id: true, fullName: true, username: true },
        },
        operator: {
          select: {
            id: true,
            employeeCode: true,
            callingName: true,
            fullName: true,
            tradeGroup: true,
            isOperator: true,
            licenseNo: true,
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
      operatorId: a.operatorId,
      supervisorName: a.supervisor.fullName,
      operatorName: a.operator.callingName,
      operatorCode: a.operator.employeeCode,
      operatorTrade: a.operator.tradeGroup,
      licenseNo: a.operator.licenseNo || null,
      businessPartner: a.operator.businessPartner?.name || 'Direct',
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching operator assignments:', error);
    res.status(500).json({ error: 'Failed to fetch operator assignments' });
  }
};

// 7. Assign operators to a supervisor for a date
export const assignOperators = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, supervisorId, operatorIds } = req.body;
    if (!date || !supervisorId || !Array.isArray(operatorIds) || operatorIds.length === 0) {
      res.status(400).json({ error: 'date, supervisorId, and non-empty operatorIds array are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    // Validate supervisor belongs to tenant
    const supervisor = await prisma.user.findFirst({
      where: { id: supervisorId, tenantId },
    });
    if (!supervisor) {
      res.status(404).json({ error: 'Supervisor not found for this tenant' });
      return;
    }

    // Validate operator IDs belong to tenant
    const validOperators = await prisma.employee.findMany({
      where: { id: { in: operatorIds }, tenantId },
      select: { id: true },
    });
    const validOpIdSet = new Set(validOperators.map((o) => o.id));
    const invalidOpIds = operatorIds.filter((id) => !validOpIdSet.has(id));
    if (invalidOpIds.length > 0) {
      res.status(400).json({ error: `The following operator ID(s) do not belong to this tenant: ${invalidOpIds.join(', ')}` });
      return;
    }

    const createdAssignments = [];

    for (const opId of operatorIds) {
      const assignment = await prisma.dailyOperatorAssignment.upsert({
        where: {
          tenantId_date_operatorId: {
            tenantId,
            date: targetDate,
            operatorId: opId,
          },
        },
        update: {
          supervisorId,
        },
        create: {
          tenantId,
          date: targetDate,
          supervisorId,
          operatorId: opId,
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
    console.error('Error assigning operators:', error);
    res.status(500).json({ error: 'Failed to assign operators' });
  }
};

// 8. Unassign an operator
export const unassignOperator = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());

    const existing = await prisma.dailyOperatorAssignment.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Operator assignment record not found' });
      return;
    }

    await prisma.dailyOperatorAssignment.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Operator unassigned successfully' });
  } catch (error: any) {
    console.error('Error unassigning operator:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Operator assignment record not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to unassign operator' });
  }
};

// 9. Copy operator gangs from a past date to target date
export const copyOperatorGangsFromDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceDate, targetDate, supervisorIds, overwrite = true } = req.body;
    if (!sourceDate || !targetDate) {
      res.status(400).json({ error: 'sourceDate and targetDate are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const srcDateParsed = parseDate(sourceDate);
    const tgtDateParsed = parseDate(targetDate);

    const sourceWhere: Record<string, any> = {
      tenantId,
      date: srcDateParsed,
    };
    if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
      sourceWhere.supervisorId = { in: supervisorIds };
    }

    const sourceAssignments = await prisma.dailyOperatorAssignment.findMany({
      where: sourceWhere,
    });

    if (sourceAssignments.length === 0) {
      res.json({
        success: true,
        copiedCount: 0,
        message: `No operator gang records found on ${sourceDate} to copy.`,
      });
      return;
    }

    if (overwrite !== false) {
      const deleteWhere: Record<string, any> = {
        tenantId,
        date: tgtDateParsed,
      };
      if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
        deleteWhere.supervisorId = { in: supervisorIds };
      }
      await prisma.dailyOperatorAssignment.deleteMany({
        where: deleteWhere,
      });
    }

    await prisma.dailyOperatorAssignment.createMany({
      data: sourceAssignments.map((src) => ({
        tenantId,
        date: tgtDateParsed,
        supervisorId: src.supervisorId,
        operatorId: src.operatorId,
      })),
      skipDuplicates: true,
    });

    res.json({
      success: true,
      copiedCount: sourceAssignments.length,
      message: `Successfully copied ${sourceAssignments.length} operator assignment(s) from ${sourceDate} to ${targetDate}.`,
    });
  } catch (error) {
    console.error('Error copying operator gangs from date:', error);
    res.status(500).json({ error: 'Failed to copy operator gangs from date' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT ASSIGNMENT CONTROLLER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// 10. Get equipment assignments for a specific date
export const getEquipmentAssignmentsForDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const dateStr = req.query.date as string;
    if (!dateStr) {
      res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());
    const supervisorId = req.query.supervisorId as string;
    const targetDate = parseDate(dateStr);

    const where: Record<string, any> = {
      tenantId,
      date: targetDate,
    };
    if (supervisorId) {
      where.supervisorId = supervisorId;
    }

    const assignments = await prisma.dailyEquipmentAssignment.findMany({
      where,
      include: {
        supervisor: {
          select: { id: true, fullName: true, username: true },
        },
        equipment: {
          select: {
            id: true,
            code: true,
            vehicleNo: true,
            magaNo: true,
            name: true,
            type: true,
            condition: true,
            costRate: true,
            primaryUnit: true,
            availableUnits: true,
            status: true,
            unitRates: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = assignments.map((a) => ({
      id: a.id,
      date: dateStr,
      supervisorId: a.supervisorId,
      equipmentId: a.equipmentId,
      supervisorName: a.supervisor.fullName,
      equipmentName: a.equipment.name,
      equipmentCode: a.equipment.code || '',
      vehicleNo: a.equipment.vehicleNo || a.equipment.code || '',
      magaNo: a.equipment.magaNo || '',
      condition: a.equipment.condition || 'DRY',
      equipmentType: a.equipment.type || '',
      costRate: a.equipment.costRate !== null && a.equipment.costRate !== undefined ? Number(a.equipment.costRate) : 0,
      primaryUnit: a.equipment.primaryUnit || 'mth',
      availableUnits: a.equipment.availableUnits || [],
      unitRates: a.equipment.unitRates || [],
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching equipment assignments:', error);
    res.status(500).json({ error: 'Failed to fetch equipment assignments' });
  }
};

// 11. Assign equipment items to a supervisor for a date
export const assignEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { date, supervisorId, equipmentIds } = req.body;
    if (!date || !supervisorId || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
      res.status(400).json({ error: 'date, supervisorId, and non-empty equipmentIds array are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const targetDate = parseDate(date);

    // Validate supervisor belongs to tenant
    const supervisor = await prisma.user.findFirst({
      where: { id: supervisorId, tenantId },
    });
    if (!supervisor) {
      res.status(404).json({ error: 'Supervisor not found for this tenant' });
      return;
    }

    // Validate equipment IDs belong to tenant
    const validEquipment = await prisma.equipment.findMany({
      where: { id: { in: equipmentIds }, tenantId },
      select: { id: true },
    });
    const validEqIdSet = new Set(validEquipment.map((eq) => eq.id));
    const invalidEqIds = equipmentIds.filter((id) => !validEqIdSet.has(id));
    if (invalidEqIds.length > 0) {
      res.status(400).json({ error: `The following equipment ID(s) do not belong to this tenant: ${invalidEqIds.join(', ')}` });
      return;
    }

    const createdAssignments = [];

    for (const eqId of equipmentIds) {
      const assignment = await prisma.dailyEquipmentAssignment.upsert({
        where: {
          tenantId_date_equipmentId: {
            tenantId,
            date: targetDate,
            equipmentId: eqId,
          },
        },
        update: {
          supervisorId,
        },
        create: {
          tenantId,
          date: targetDate,
          supervisorId,
          equipmentId: eqId,
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
    console.error('Error assigning equipment:', error);
    res.status(500).json({ error: 'Failed to assign equipment' });
  }
};

// 12. Unassign an equipment item
export const unassignEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());

    const existing = await prisma.dailyEquipmentAssignment.findFirst({
      where: { id, tenantId },
    });

    if (!existing) {
      res.status(404).json({ error: 'Equipment assignment record not found' });
      return;
    }

    await prisma.dailyEquipmentAssignment.delete({
      where: { id },
    });
    res.json({ success: true, message: 'Equipment unassigned successfully' });
  } catch (error: any) {
    console.error('Error unassigning equipment:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Equipment assignment record not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to unassign equipment' });
  }
};

// 13. Copy equipment gangs from a past date to target date
export const copyEquipmentGangsFromDate = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sourceDate, targetDate, supervisorIds, overwrite = true } = req.body;
    if (!sourceDate || !targetDate) {
      res.status(400).json({ error: 'sourceDate and targetDate are required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const srcDateParsed = parseDate(sourceDate);
    const tgtDateParsed = parseDate(targetDate);

    const sourceWhere: Record<string, any> = {
      tenantId,
      date: srcDateParsed,
    };
    if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
      sourceWhere.supervisorId = { in: supervisorIds };
    }

    const sourceAssignments = await prisma.dailyEquipmentAssignment.findMany({
      where: sourceWhere,
    });

    if (sourceAssignments.length === 0) {
      res.json({
        success: true,
        copiedCount: 0,
        message: `No equipment gang records found on ${sourceDate} to copy.`,
      });
      return;
    }

    if (overwrite !== false) {
      const deleteWhere: Record<string, any> = {
        tenantId,
        date: tgtDateParsed,
      };
      if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
        deleteWhere.supervisorId = { in: supervisorIds };
      }
      await prisma.dailyEquipmentAssignment.deleteMany({
        where: deleteWhere,
      });
    }

    await prisma.dailyEquipmentAssignment.createMany({
      data: sourceAssignments.map((src) => ({
        tenantId,
        date: tgtDateParsed,
        supervisorId: src.supervisorId,
        equipmentId: src.equipmentId,
      })),
      skipDuplicates: true,
    });

    res.json({
      success: true,
      copiedCount: sourceAssignments.length,
      message: `Successfully copied ${sourceAssignments.length} equipment assignment(s) from ${sourceDate} to ${targetDate}.`,
    });
  } catch (error) {
    console.error('Error copying equipment gangs from date:', error);
    res.status(500).json({ error: 'Failed to copy equipment gangs from date' });
  }
};


