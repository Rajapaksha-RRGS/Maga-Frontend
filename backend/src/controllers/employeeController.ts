import { Request, Response } from 'express';
import prisma from '../config/prisma';
import '../middleware/tenantMiddleware';
import { getDefaultTenantId } from '../utils/tenantHelper';

// Re-export getDefaultTenantId for backwards compatibility
export { getDefaultTenantId };

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

const employeeSelectOptimized = {
  id: true,
  projectId: true,
  corporateEmployeeId: true,
  callingName: true,
  dailyRate: true,
  isOperator: true,
  status: true,
  createdAt: true,
  corporateEmployee: {
    select: {
      id: true,
      employeeCode: true,
      fullName: true,
      nicNo: true,
      epfNo: true,
      dailyRate: true,
      isOperator: true,
      status: true,
    },
  },
  tradeGroup: {
    select: {
      id: true,
      code: true,
      name: true,
      standardDailyRate: true,
    },
  },
  businessPartner: {
    select: {
      id: true,
      code: true,
      name: true,
      type: true,
    },
  },
};

function formatEmployee(emp: any) {
  const corp = emp.corporateEmployee || {};
  return {
    id: emp.id,
    projectId: emp.projectId,
    tenantId: emp.projectId, // Frontend compatibility
    corporateEmployeeId: emp.corporateEmployeeId,
    employeeCode: corp.employeeCode || emp.id,
    employee_code: corp.employeeCode || emp.id,
    callingName: emp.callingName || corp.fullName || '',
    calling_name: emp.callingName || corp.fullName || '',
    fullName: corp.fullName || emp.callingName || '',
    full_name: corp.fullName || emp.callingName || '',
    nicNo: corp.nicNo || '',
    nic_no: corp.nicNo || '',
    epfNo: corp.epfNo || '',
    epf_no: corp.epfNo || '',
    dailyRate: Number(emp.dailyRate ?? corp.dailyRate ?? 1400.0),
    isOperator: Boolean(emp.isOperator ?? corp.isOperator ?? false),
    status: emp.status || 'active',
    tradeGroupId: emp.tradeGroup?.id || null,
    tradeGroup: emp.tradeGroup?.name || 'General Labour',
    trade_group: emp.tradeGroup?.name || 'General Labour',
    businessPartnerId: emp.businessPartner?.id || null,
    businessPartner: emp.businessPartner
      ? {
          id: emp.businessPartner.id,
          code: emp.businessPartner.code,
          name: emp.businessPartner.name,
        }
      : null,
    createdAt: emp.createdAt,
  };
}

// 1. GET /api/employees — List all employees scoped to project
export const getAllEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, tradeGroup, businessPartner } = req.query;
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const where: Record<string, any> = { projectId };
    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }
    if (tradeGroup && typeof tradeGroup === 'string') {
      where.tradeGroup = {
        name: { contains: tradeGroup, mode: 'insensitive' },
      };
    }
    if (businessPartner && typeof businessPartner === 'string') {
      where.businessPartner = {
        name: { contains: businessPartner, mode: 'insensitive' },
      };
    }

    const employees = await prisma.employee.findMany({
      where,
      select: employeeSelectOptimized,
      orderBy: {
        corporateEmployee: {
          employeeCode: 'asc',
        },
      },
    });

    res.json(employees.map(formatEmployee));
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

// 2. GET /api/employees/:id — Fetch single employee by ID
export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const employee = await prisma.employee.findUnique({
      where: { id },
      select: employeeSelectOptimized,
    });

    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    res.json(formatEmployee(employee));
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
};

// Helper: Resolve or create a Corporate Trade Group
async function resolveTradeGroup(tradeGroupName?: string): Promise<string | null> {
  if (!tradeGroupName || !tradeGroupName.trim()) return null;
  const cleanName = tradeGroupName.trim();

  const found = await prisma.corporateTradeGroup.findFirst({
    where: {
      OR: [
        { name: { equals: cleanName, mode: 'insensitive' } },
        { code: { equals: cleanName, mode: 'insensitive' } },
      ],
    },
    select: { id: true },
  });
  if (found) return found.id;

  const count = await prisma.corporateTradeGroup.count();
  const code = `TG${String(count + 1).padStart(3, '0')}`;
  const created = await prisma.corporateTradeGroup.create({
    data: {
      code,
      name: cleanName,
      standardDailyRate: 1400.0,
      status: 'active',
    },
    select: { id: true },
  });
  return created.id;
}

// Helper: Resolve or create a Corporate Business Partner
export const resolveOrCreateBusinessPartner = async (
  _projectId: string,
  input?: { id?: string; code?: string; name?: string }
): Promise<string | null> => {
  if (input?.id && input.id.length > 20) {
    const existing = await prisma.corporateBusinessPartner.findUnique({
      where: { id: input.id },
      select: { id: true },
    });
    if (existing) return existing.id;
  }

  const searchCode = input?.code?.trim();
  const searchName = input?.name?.trim();

  if (searchCode || searchName) {
    const existing = await prisma.corporateBusinessPartner.findFirst({
      where: {
        OR: [
          ...(searchCode ? [{ code: { equals: searchCode, mode: 'insensitive' as const } }] : []),
          ...(searchName ? [{ name: { equals: searchName, mode: 'insensitive' as const } }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const count = await prisma.corporateBusinessPartner.count();
    const bpCode = searchCode || `BP1${String(count + 1).padStart(6, '0')}`;
    const created = await prisma.corporateBusinessPartner.create({
      data: {
        code: bpCode,
        name: searchName || searchCode || 'Mäga Engineering (Pvt) Ltd',
        type: (searchName || '').toLowerCase().includes('maga') ? 'internal' : 'subcontractor',
        status: 'active',
      },
      select: { id: true },
    });
    return created.id;
  }

  // Default partner
  let defaultPartner = await prisma.corporateBusinessPartner.findFirst({
    where: { code: 'BP1002885' },
    select: { id: true },
  });
  if (!defaultPartner) {
    defaultPartner = await prisma.corporateBusinessPartner.findFirst({
      select: { id: true },
    });
  }
  return defaultPartner?.id || null;
};

// 3. POST /api/employees — Create employee
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      employeeCode,
      callingName,
      fullName,
      businessPartnerId,
      businessPartnerCode,
      businessPartnerName,
      businessPartner,
      tradeGroup,
      nicNo,
      dailyRate,
      epfNo,
      status,
      isOperator,
    } = req.body || {};

    if (!callingName || !nicNo) {
      res.status(400).json({ error: 'Calling name and NIC number are required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const cleanCode = employeeCode?.trim() || `EMP${Date.now().toString().slice(-4)}`;
    const cleanNic = String(nicNo).trim();

    const resolvedBpId = await resolveOrCreateBusinessPartner(projectId, {
      id: businessPartnerId,
      code: businessPartnerCode || (typeof businessPartner === 'string' && businessPartner.startsWith('BP') ? businessPartner : undefined),
      name: businessPartnerName || (typeof businessPartner === 'string' ? businessPartner : undefined),
    });

    const resolvedTradeGroupId = await resolveTradeGroup(tradeGroup);

    const isOperatorBool = Boolean(
      isOperator === true ||
      isOperator === 'true' ||
      (tradeGroup && ['operator', 'driver', 'heavy operator'].some((t: string) => tradeGroup.toLowerCase().includes(t)))
    );

    const result = await prisma.$transaction(async (tx) => {
      // 1. Ensure Corporate Employee exists
      let corpEmp = await tx.corporateEmployee.findFirst({
        where: {
          OR: [{ employeeCode: cleanCode }, { nicNo: cleanNic }],
        },
      });

      if (!corpEmp) {
        corpEmp = await tx.corporateEmployee.create({
          data: {
            employeeCode: cleanCode,
            fullName: fullName?.trim() || callingName.trim(),
            nicNo: cleanNic,
            epfNo: epfNo?.trim() || null,
            dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : 1400.0,
            isOperator: isOperatorBool,
            tradeGroupId: resolvedTradeGroupId,
            corporateBusinessPartnerId: resolvedBpId,
            status: 'active',
          },
        });
      }

      // 2. Create Site Employee enrollment
      const siteEmp = await tx.employee.create({
        data: {
          projectId,
          corporateEmployeeId: corpEmp.id,
          callingName: callingName.trim(),
          dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : (corpEmp.dailyRate ?? 1400.0),
          isOperator: isOperatorBool,
          tradeGroupId: resolvedTradeGroupId,
          businessPartnerId: resolvedBpId,
          status: status || 'active',
        },
        select: employeeSelectOptimized,
      });

      return siteEmp;
    });

    res.status(201).json(formatEmployee(result));
  } catch (error: any) {
    console.error('Error creating employee:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Employee already exists in this project' });
      return;
    }
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

// 4. PUT /api/employees/:id — Update employee
export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const {
      callingName,
      fullName,
      dailyRate,
      isOperator,
      status,
      tradeGroup,
      businessPartnerId,
      businessPartnerName,
      epfNo,
      nicNo,
    } = req.body || {};

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, corporateEmployeeId: true, projectId: true },
    });

    if (!existing) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    const tradeGroupId = tradeGroup !== undefined ? await resolveTradeGroup(tradeGroup) : undefined;
    const bpId = businessPartnerId || (businessPartnerName ? await resolveOrCreateBusinessPartner(existing.projectId, { name: businessPartnerName }) : undefined);

    const updateData: Record<string, any> = {};
    if (callingName !== undefined) updateData.callingName = callingName.trim();
    if (dailyRate !== undefined) updateData.dailyRate = parseFloat(dailyRate);
    if (isOperator !== undefined) updateData.isOperator = Boolean(isOperator);
    if (status !== undefined) updateData.status = status;
    if (tradeGroupId !== undefined) updateData.tradeGroupId = tradeGroupId;
    if (bpId !== undefined) updateData.businessPartnerId = bpId;

    await prisma.$transaction(async (tx) => {
      await tx.employee.update({
        where: { id },
        data: updateData,
      });

      if (fullName || nicNo || epfNo) {
        await tx.corporateEmployee.update({
          where: { id: existing.corporateEmployeeId },
          data: {
            fullName: fullName?.trim() || undefined,
            nicNo: nicNo?.trim() || undefined,
            epfNo: epfNo?.trim() || undefined,
          },
        });
      }
    });

    const refreshed = await prisma.employee.findUnique({
      where: { id },
      select: employeeSelectOptimized,
    });

    res.json(formatEmployee(refreshed));
  } catch (error: any) {
    console.error('Error updating employee:', error);
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

// 5. PATCH /api/employees/:id/status — Toggle status
export const updateEmployeeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { status } = req.body || {};

    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(400).json({ error: 'Valid status ("active" | "inactive") is required' });
      return;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: { status },
      select: employeeSelectOptimized,
    });

    res.json(formatEmployee(updated));
  } catch (error: any) {
    console.error('Error updating employee status:', error);
    res.status(500).json({ error: 'Failed to update employee status' });
  }
};

// 6. DELETE /api/employees/:id — Delete or soft-deactivate
export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    const [assignmentsCount, opAssignmentsCount, entriesCount] = await Promise.all([
      prisma.dailyAssignment.count({ where: { employeeId: id } }),
      prisma.dailyEquipmentAssignment.count({ where: { operatorId: id } }),
      prisma.timeEntry.count({ where: { employeeId: id } }),
    ]);

    const totalUsage = assignmentsCount + opAssignmentsCount + entriesCount;
    if (totalUsage > 0) {
      await prisma.employee.update({
        where: { id },
        data: { status: 'inactive' },
      });
      res.json({ message: 'Employee deactivated successfully (has operational history)' });
      return;
    }

    await prisma.employee.delete({
      where: { id },
    });

    res.json({ message: 'Employee deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};

// 7. POST /api/employees/cross-tenant-status — Check cross-project employee availability
export const getCrossTenantEmployeeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const { items } = req.body || {};
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.json({});
      return;
    }

    const nics = items.map((i: any) => i.nicNo).filter(Boolean) as string[];
    const codes = items.map((i: any) => i.code).filter(Boolean) as string[];

    const existingEmployees = await prisma.employee.findMany({
      where: {
        OR: [
          nics.length > 0 ? { corporateEmployee: { nicNo: { in: nics } } } : undefined,
          codes.length > 0 ? { corporateEmployee: { employeeCode: { in: codes } } } : undefined,
        ].filter(Boolean) as any,
      },
      select: {
        id: true,
        projectId: true,
        status: true,
        project: {
          select: {
            id: true,
            projectName: true,
            subdomain: true,
            projectCode: true,
          },
        },
        corporateEmployee: {
          select: {
            employeeCode: true,
            nicNo: true,
            fullName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const resultMap: Record<
      string,
      {
        status: 'in_current_site' | 'in_other_site' | 'available';
        currentSiteName?: string;
        currentSiteCode?: string;
        currentTenantId?: string;
        employeeId?: string;
      }
    > = {};

    for (const item of items) {
      const matches = existingEmployees.filter(
        (emp) =>
          (item.nicNo && emp.corporateEmployee.nicNo === item.nicNo) ||
          (item.code && emp.corporateEmployee.employeeCode === item.code)
      );

      const inCurrent = matches.find((m) => m.projectId === currentProjectId && m.status === 'active');
      const inOther = matches.find((m) => m.projectId !== currentProjectId && m.status === 'active');

      if (inCurrent) {
        resultMap[item.code] = {
          status: 'in_current_site',
          currentSiteName: inCurrent.project?.projectName,
          currentSiteCode: inCurrent.project?.projectCode || inCurrent.project?.subdomain,
          currentTenantId: inCurrent.projectId,
          employeeId: inCurrent.id,
        };
      } else if (inOther) {
        resultMap[item.code] = {
          status: 'in_other_site',
          currentSiteName: inOther.project?.projectName || `Site ${inOther.project?.subdomain}`,
          currentSiteCode: inOther.project?.projectCode || inOther.project?.subdomain,
          currentTenantId: inOther.projectId,
          employeeId: inOther.id,
        };
      } else {
        resultMap[item.code] = { status: 'available' };
      }
    }

    res.json(resultMap);
  } catch (error) {
    console.error('Error checking cross-tenant employee status:', error);
    res.status(500).json({ error: 'Failed to check cross-tenant employee status' });
  }
};

// 8. POST /api/employees/transfer — Transfer employee between projects
export const transferEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const targetProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.targetTenantId ||
      req.body.targetProjectId ||
      (await getDefaultTenantId());

    const {
      employeeCode,
      callingName,
      fullName,
      nicNo,
      businessPartnerName,
      tradeGroup,
      dailyRate,
      epfNo,
      remarks,
    } = req.body || {};

    if (!callingName || !nicNo) {
      res.status(400).json({ error: 'Calling name and NIC number are required' });
      return;
    }

    const cleanCode = employeeCode?.trim();
    const cleanNic = nicNo.trim();

    // 1. Find corporate employee
    let corpEmp = await prisma.corporateEmployee.findFirst({
      where: {
        OR: [
          { nicNo: cleanNic },
          cleanCode ? { employeeCode: cleanCode } : undefined,
        ].filter(Boolean) as any,
      },
    });

    if (!corpEmp) {
      corpEmp = await prisma.corporateEmployee.create({
        data: {
          employeeCode: cleanCode || `EMP${Date.now().toString().slice(-4)}`,
          fullName: fullName?.trim() || callingName.trim(),
          nicNo: cleanNic,
          epfNo: epfNo?.trim() || null,
          status: 'active',
        },
      });
    }

    // 2. Identify previous active site assignment
    const prevSiteEmp = await prisma.employee.findFirst({
      where: {
        corporateEmployeeId: corpEmp.id,
        status: 'active',
        projectId: { not: targetProjectId },
      },
    });

    const fromProjectId = prevSiteEmp?.projectId || null;

    // 3. Perform transfer atomically
    const result = await prisma.$transaction(async (tx) => {
      // Deactivate in previous site
      if (prevSiteEmp) {
        await tx.employee.update({
          where: { id: prevSiteEmp.id },
          data: { status: 'inactive' },
        });
      }

      // Record transfer in ledger
      await tx.employeeTransfer.create({
        data: {
          corporateEmployeeId: corpEmp.id,
          fromProjectId,
          toProjectId: targetProjectId,
          startDate: new Date(),
          status: 'active',
          remarks: remarks || `Transferred to site ${targetProjectId}`,
        },
      });

      // Resolve business partner and trade group for target site
      const targetBpId = await resolveOrCreateBusinessPartner(targetProjectId, {
        name: businessPartnerName || 'Mäga Engineering (Direct)',
      });
      const targetTradeGroupId = await resolveTradeGroup(tradeGroup);

      // Upsert into target site
      const siteEmp = await tx.employee.upsert({
        where: {
          projectId_corporateEmployeeId: {
            projectId: targetProjectId,
            corporateEmployeeId: corpEmp.id,
          },
        },
        update: {
          callingName: callingName.trim(),
          dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : (corpEmp.dailyRate ?? 1400.0),
          tradeGroupId: targetTradeGroupId,
          businessPartnerId: targetBpId,
          status: 'active',
        },
        create: {
          projectId: targetProjectId,
          corporateEmployeeId: corpEmp.id,
          callingName: callingName.trim(),
          dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : (corpEmp.dailyRate ?? 1400.0),
          tradeGroupId: targetTradeGroupId,
          businessPartnerId: targetBpId,
          status: 'active',
        },
        select: employeeSelectOptimized,
      });

      return siteEmp;
    });

    res.status(200).json({
      success: true,
      message: `Employee ${callingName} successfully transferred to target site`,
      employee: formatEmployee(result),
    });
  } catch (error: any) {
    console.error('Error transferring employee:', error);
    res.status(500).json({ error: 'Failed to transfer employee' });
  }
};

// 9. GET /api/employees/corporate-master — Catalog from corporate master
export const getCorporateEmployeesCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.corporateEmployee.findMany({
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        nicNo: true,
        epfNo: true,
        dailyRate: true,
        isOperator: true,
        status: true,
        currentWorkingProject: true,
        tradeGroup: {
          select: { id: true, code: true, name: true },
        },
        corporateBusinessPartner: {
          select: { id: true, code: true, name: true },
        },
      },
      orderBy: { employeeCode: 'asc' },
    });
    res.json(list);
  } catch (error) {
    console.error('Error fetching corporate employees catalog:', error);
    res.status(500).json({ error: 'Failed to fetch corporate employees catalog' });
  }
};
