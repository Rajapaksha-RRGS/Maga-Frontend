import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pw = 'ERP@';
  for (let i = 0; i <= 4; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export interface SimpleProjectRef {
  id: string;
  projectCode: string;
  projectName: string;
  subdomain: string;
}

export function resolveProjectByCode(
  input: string | undefined | null,
  projects: SimpleProjectRef[]
): SimpleProjectRef | null {
  if (!input) return null;
  const raw = String(input).trim();
  if (!raw) return null;
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Exact ID (UUID)
  const byId = projects.find((p) => p.id.toLowerCase() === raw.toLowerCase());
  if (byId) return byId;

  // 2. Exact projectCode (e.g. "PRJ531" or "PRJ001")
  const byCode = projects.find((p) => p.projectCode.toUpperCase() === raw.toUpperCase());
  if (byCode) return byCode;

  // 3. Exact subdomain (e.g. "531" or "maga")
  const bySub = projects.find((p) => p.subdomain.toUpperCase() === raw.toUpperCase());
  if (bySub) return bySub;

  // 4. Normalized alphanumeric match (e.g. "531" matches "PRJ531" or "531M")
  const byClean = projects.find((p) => {
    const pClean = p.projectCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const sClean = p.subdomain.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return pClean === clean || sClean === clean || pClean.includes(clean) || clean.includes(pClean);
  });
  if (byClean) return byClean;

  return null;
}


export interface SimpleTradeGroupRef {
  id: string;
  code: string;
  name: string;
}

export function resolveTradeGroupSmart(
  rawInput: string | undefined | null,
  isExternal: boolean,
  allTradeGroups: SimpleTradeGroupRef[]
): SimpleTradeGroupRef | null {
  const trimmed = (rawInput || '').trim();
  const lower = trimmed.toLowerCase();

  // 1. Unassigned, '0', empty, or general helper indicators -> Fall back to Unskilled Worker
  const isHelperOrUnassigned =
    !trimmed ||
    lower === '0' ||
    lower === 'none' ||
    lower === 'null' ||
    lower === '-' ||
    lower === 'helper' ||
    lower === 'helpers' ||
    lower === 'general helper' ||
    lower === 'general labour' ||
    lower === 'general labor' ||
    lower === 'labour' ||
    lower === 'labor' ||
    lower === 'unskilled' ||
    lower === 'un skilled' ||
    lower === 'unskilled worker';

  if (isHelperOrUnassigned) {
    const defaultCode = isExternal ? 'SUS' : 'MUS';
    const fallback = allTradeGroups.find((tg) => tg.code.toUpperCase() === defaultCode);
    if (fallback) return fallback;
  }

  // 2. Direct code or name match (case-insensitive)
  const direct = allTradeGroups.find(
    (tg) => tg.code.toLowerCase() === lower || tg.name.toLowerCase() === lower
  );
  if (direct) return direct;

  // 3. Clean alphanumeric string (e.g. "barbender" matches "bar bender")
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cleanInput = clean(trimmed);

  // Common aliases & ERP trade mappings
  const ALIAS_MAP: Record<string, string> = {
    carpenter: 'carpenters',
    carpentry: 'carpenters',
    barbender: 'bar bender',
    ironbender: 'bar bender',
    steelfixer: 'bar bender',
    machanic: 'mechanic',
    traineemachanic: 'trainee mechanic',
    traineemechanic: 'trainee mechanic',
    storehelper: 'stores helper',
    storeshelper: 'stores helper',
    storekeeperhelper: 'stores helper',
    storeman: 'stores helper',
    surveyinghelper: 'survey helper',
    surveyorhelper: 'survey helper',
    labhelper: 'lab helper',
    laboratoryhelper: 'lab helper',
    officehelper: 'office helper',
    flagman: 'flagman',
    mason: 'mason',
    welder: 'welder',
    electrician: 'electrician',
    cook: 'cook',
    heavyvehicledriver: 'driver-heavy vehicle',
    lightvehicledriver: 'driver-light vehicle',
    powerelectrician: 'power electrician',
    tractordriver: 'tractor driver',
    caretaker: 'care taker',
    motorgraderoperator: 'motor grader operator',
    excavatoroperator: 'excavator operator',
    heavyrolleroperator: 'heavy roller operator',
    rolleroperator: 'roller operator',
    loaderbackhoeoperator: 'loader backhoe operator',
    backhoeloaderoperator: 'loader backhoe operator',
    craneoperator: 'crane operator',
    vibratoryrolleroperator: 'vibratory roller operator',
    skidsteerloaderoperator: 'skid steer loader operator',
    mobilecraneoperator: 'mobile crane operator',
    crawlercraneoperator: 'crawler crane operator',
    supplyhelper: 'supply - helper',
    supplycarpenter: 'supply - carpenters',
    supplymason: 'supply - mason',
  };

  const canonicalTarget = ALIAS_MAP[cleanInput] || null;

  // If external, check for "Supply - <target>" first
  if (isExternal) {
    const supplyMatch = allTradeGroups.find((tg) => {
      const cleanTg = clean(tg.name);
      if (canonicalTarget && (cleanTg === clean(`supply - ${canonicalTarget}`) || cleanTg === clean(`supply ${canonicalTarget}`))) return true;
      if (cleanTg === clean(`supply - ${trimmed}`) || cleanTg === clean(`supply ${trimmed}`)) return true;
      return false;
    });
    if (supplyMatch) return supplyMatch;
  }

  // Check alias target against trade groups
  if (canonicalTarget) {
    const aliasMatch = allTradeGroups.find((tg) => {
      return (
        tg.code.toLowerCase() === canonicalTarget ||
        tg.name.toLowerCase() === canonicalTarget ||
        clean(tg.name) === clean(canonicalTarget) ||
        clean(tg.code) === clean(canonicalTarget)
      );
    });
    if (aliasMatch) return aliasMatch;
  }

  // 4. Normalized alphanumeric match (including plural/singular tolerance)
  const alphaMatch = allTradeGroups.find((tg) => {
    const cName = clean(tg.name);
    const cCode = clean(tg.code);
    if (cName === cleanInput || cCode === cleanInput) return true;
    if (cName === cleanInput + 's' || cName + 's' === cleanInput) return true;
    return false;
  });
  if (alphaMatch) return alphaMatch;

  return null;
}

// ── 1. GET /api/corporate/stats ───────────────────────────────────────────────
export const getCorporateStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalProjects,
      totalEmployees,
      totalEquipment,
      pendingTransfers,
      activeBusinessPartners,
      totalTradeGroups,
      projectsList,
    ] = await Promise.all([
      prisma.mF_P_Project.count({ where: { status: 'active' } }),
      prisma.mF_G_Employee.count({ where: { status: 'active' } }),
      prisma.mF_G_Equipment.count({ where: { status: 'active' } }),
      prisma.mF_G_EmployeeTransfer.count({ where: { status: 'active' } }),
      prisma.mF_G_BusinessPartner.count({ where: { status: 'active' } }),
      prisma.mF_G_TradeGroup.count({ where: { status: 'active' } }),
      prisma.mF_P_Project.findMany({
        where: { status: 'active' },
        select: {
          id: true,
          projectCode: true,
          projectName: true,
          subdomain: true,
          _count: {
            select: {
              employees: { where: { status: 'active' } },
              equipment: { where: { status: 'active' } },
            },
          },
        },
        orderBy: { projectCode: 'asc' },
      }),
    ]);

    res.json({
      totalProjects,
      totalEmployees,
      totalEquipment,
      pendingTransfers,
      activeBusinessPartners,
      totalTradeGroups,
      projects: projectsList.map((p) => ({
        id: p.id,
        code: p.projectCode,
        name: p.projectName,
        subdomain: p.subdomain,
        activeEmployees: p._count.employees,
        activeEquipment: p._count.equipment,
      })),
    });
  } catch (error) {
    console.error('Error fetching corporate stats:', error);
    res.status(500).json({ error: 'Failed to fetch corporate stats' });
  }
};

// ── 2. GET /api/corporate/transfers ───────────────────────────────────────────
export const getCorporateTransfers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { corporateEmployee: { fullName: { contains: q, mode: 'insensitive' } } },
        { corporateEmployee: { employeeCode: { contains: q, mode: 'insensitive' } } },
        { corporateEmployee: { nicNo: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.mF_G_EmployeeTransfer.findMany({
        where,
        include: {
          corporateEmployee: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              nicNo: true,
              tradeGroup: { select: { name: true } },
            },
          },
          fromProject: {
            select: { id: true, projectCode: true, projectName: true },
          },
          toProject: {
            select: { id: true, projectCode: true, projectName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mF_G_EmployeeTransfer.count({ where }),
    ]);

    res.json({ items, total });
  } catch (error) {
    console.error('Error fetching corporate transfers:', error);
    res.status(500).json({ error: 'Failed to fetch corporate transfers' });
  }
};

// ── 3. POST /api/corporate/transfers ──────────────────────────────────────────
export const createCorporateTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      corporateEmployeeId,
      toProjectId,
      fromProjectId,
      startDate,
      remarks,
    } = req.body || {};

    if (!corporateEmployeeId || !toProjectId) {
      res.status(400).json({ error: 'corporateEmployeeId and toProjectId are required' });
      return;
    }

    const corpEmp = await prisma.mF_G_Employee.findUnique({
      where: { id: corporateEmployeeId },
      include: { tradeGroup: true, corporateBusinessPartner: true },
    });
    if (!corpEmp) {
      res.status(404).json({ error: 'Corporate employee not found' });
      return;
    }

    const effectiveStartDate = startDate ? new Date(startDate) : new Date();

    // Identify fromProjectId if not provided
    let resolvedFromProjectId = fromProjectId;
    if (!resolvedFromProjectId) {
      const prevActiveSite = await prisma.mF_P_Employee.findFirst({
        where: { corporateEmployeeId, status: 'active', projectId: { not: toProjectId } },
      });
      resolvedFromProjectId = prevActiveSite?.projectId || null;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Close any existing open transfers
      await tx.mF_G_EmployeeTransfer.updateMany({
        where: {
          corporateEmployeeId,
          status: 'active',
          endDate: null,
        },
        data: {
          status: 'transferred',
          endDate: effectiveStartDate,
        },
      });

      // 2. Insert new transfer ledger record
      const transfer = await tx.mF_G_EmployeeTransfer.create({
        data: {
          corporateEmployeeId,
          fromProjectId: resolvedFromProjectId,
          toProjectId,
          startDate: effectiveStartDate,
          status: 'active',
          remarks: remarks || `Dispatched to project by Super Admin`,
        },
        include: {
          corporateEmployee: true,
          fromProject: true,
          toProject: true,
        },
      });

      // 3. Deactivate from previous project site
      if (resolvedFromProjectId) {
        await tx.mF_P_Employee.updateMany({
          where: { corporateEmployeeId, projectId: resolvedFromProjectId },
          data: { status: 'inactive' },
        });
      }

      // 4. Upsert into target site
      await tx.mF_P_Employee.upsert({
        where: {
          projectId_corporateEmployeeId: {
            projectId: toProjectId,
            corporateEmployeeId,
          },
        },
        update: {
          callingName: corpEmp.fullName.split(' ')[0] || corpEmp.fullName,
          status: 'active',
          dailyRate: corpEmp.dailyRate ?? 1400.0,
          tradeGroupId: corpEmp.tradeGroupId,
        },
        create: {
          projectId: toProjectId,
          corporateEmployeeId,
          callingName: corpEmp.fullName.split(' ')[0] || corpEmp.fullName,
          status: 'active',
          dailyRate: corpEmp.dailyRate ?? 1400.0,
          tradeGroupId: corpEmp.tradeGroupId,
        },
      });

      // 5. Update corporate employee currentProjectId
      await tx.mF_G_Employee.update({
        where: { id: corporateEmployeeId },
        data: {
          currentProjectId: toProjectId,
        },
      });

      return transfer;
    });

    res.status(201).json({
      success: true,
      message: 'Transfer successfully executed',
      transfer: result,
    });
  } catch (error: any) {
    console.error('Error creating corporate transfer:', error);
    res.status(500).json({ error: error.message || 'Failed to create transfer' });
  }
};

// ── 3B. POST /api/corporate/transfers/request (2-Way Handshake: Site Request) ─
export const requestCorporateTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { corporateEmployeeId, employeeCode, toProjectId, startDate, remarks } = req.body || {};
    const targetInput = toProjectId || req.resolvedProjectId || req.resolvedTenantId;

    if ((!corporateEmployeeId && !employeeCode) || !targetInput) {
      res.status(400).json({ error: 'corporateEmployeeId (or employeeCode) and toProjectId are required' });
      return;
    }

    let corpEmp = null;
    if (corporateEmployeeId) {
      corpEmp = await prisma.mF_G_Employee.findUnique({
        where: { id: corporateEmployeeId },
        include: { tradeGroup: true },
      });
    } else if (employeeCode) {
      corpEmp = await prisma.mF_G_Employee.findUnique({
        where: { employeeCode: String(employeeCode).trim().toUpperCase() },
        include: { tradeGroup: true },
      });
    }

    if (!corpEmp) {
      res.status(404).json({ error: 'Corporate employee not found' });
      return;
    }

    const resolvedCorpId = corpEmp.id;

    // Resolve target project by code or id
    const allProjects = await prisma.mF_P_Project.findMany({
      select: { id: true, projectCode: true, projectName: true, subdomain: true },
    });
    const targetProj = resolveProjectByCode(targetInput, allProjects);
    if (!targetProj) {
      res.status(404).json({ error: 'Target project not found' });
      return;
    }

    // Find current active site (fromProjectId)
    const prevActiveSite = await prisma.mF_P_Employee.findFirst({
      where: { corporateEmployeeId: resolvedCorpId, status: 'active', projectId: { not: targetProj.id } },
      include: { project: true },
    });
    const fromProjectId = prevActiveSite?.projectId || null;

    // Check if there is already a pending request for this employee
    const existingPending = await prisma.mF_G_EmployeeTransfer.findFirst({
      where: {
        corporateEmployeeId: resolvedCorpId,
        toProjectId: targetProj.id,
        status: 'pending_approval',
      },
    });
    if (existingPending) {
      res.status(409).json({ error: 'A transfer request for this employee is already pending release approval.' });
      return;
    }

    const effectiveStartDate = startDate ? new Date(startDate) : new Date();

    const transfer = await prisma.mF_G_EmployeeTransfer.create({
      data: {
        corporateEmployeeId: resolvedCorpId,
        fromProjectId,
        toProjectId: targetProj.id,
        startDate: effectiveStartDate,
        status: 'pending_approval',
        remarks: remarks || `Transfer requested by site ${targetProj.projectCode}`,
      },
      include: {
        corporateEmployee: {
          select: { id: true, employeeCode: true, fullName: true, nicNo: true },
        },
        fromProject: { select: { id: true, projectCode: true, projectName: true } },
        toProject: { select: { id: true, projectCode: true, projectName: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Transfer request submitted. Awaiting approval from current station.',
      transfer,
    });
  } catch (error: any) {
    console.error('Error requesting transfer:', error);
    res.status(500).json({ error: error.message || 'Failed to submit transfer request' });
  }
};

// ── 3C. GET /api/corporate/transfers/pending (Pending requests for project) ───
export const getPendingCorporateTransfers = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawProjectId =
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.headers['x-project-id'] as string);

    const isSuperAdmin =
      req.user?.role === 'super_admin' ||
      rawProjectId === 'GLOBAL' ||
      rawProjectId === 'superadmin' ||
      (req.headers['x-tenant-id'] === 'superadmin');

    const allProjects = await prisma.mF_P_Project.findMany({
      select: { id: true, projectCode: true, projectName: true, subdomain: true },
    });

    let targetProjectId: string | undefined = undefined;
    if (rawProjectId && !isSuperAdmin) {
      const resolved = resolveProjectByCode(rawProjectId, allProjects);
      targetProjectId = resolved?.id || rawProjectId;
    }

    const direction = (req.query.direction as string) || (req.query.type as string);

    // If super admin without specific target project, return all pending transfers
    if (isSuperAdmin && !req.query.projectId && !targetProjectId) {
      const allPending = await prisma.mF_G_EmployeeTransfer.findMany({
        where: { status: 'pending_approval' },
        include: {
          corporateEmployee: {
            select: {
              id: true,
              employeeCode: true,
              fullName: true,
              nicNo: true,
              tradeGroup: { select: { name: true } },
            },
          },
          fromProject: { select: { id: true, projectCode: true, projectName: true } },
          toProject: { select: { id: true, projectCode: true, projectName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ items: allPending, inboundItems: allPending, outboundItems: [] });
      return;
    }

    if (!targetProjectId) {
      res.json({ items: [], inboundItems: [], outboundItems: [] });
      return;
    }

    // Inbound: other sites requesting OUR employees (requires this site to Approve & Release)
    const inboundTransfers = await prisma.mF_G_EmployeeTransfer.findMany({
      where: {
        status: 'pending_approval',
        fromProjectId: targetProjectId,
      },
      include: {
        corporateEmployee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            nicNo: true,
            tradeGroup: { select: { name: true } },
          },
        },
        fromProject: { select: { id: true, projectCode: true, projectName: true } },
        toProject: { select: { id: true, projectCode: true, projectName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Outbound: requests WE made to other sites (waiting for them to release)
    const outboundTransfers = await prisma.mF_G_EmployeeTransfer.findMany({
      where: {
        status: 'pending_approval',
        toProjectId: targetProjectId,
      },
      include: {
        corporateEmployee: {
          select: {
            id: true,
            employeeCode: true,
            fullName: true,
            nicNo: true,
            tradeGroup: { select: { name: true } },
          },
        },
        fromProject: { select: { id: true, projectCode: true, projectName: true } },
        toProject: { select: { id: true, projectCode: true, projectName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    let items = inboundTransfers;
    if (direction === 'outbound') {
      items = outboundTransfers;
    } else if (direction === 'all' || direction === 'both') {
      items = [...inboundTransfers, ...outboundTransfers];
    }

    res.json({
      items,
      inboundItems: inboundTransfers,
      outboundItems: outboundTransfers,
    });
  } catch (error: any) {
    console.error('Error fetching pending transfers:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch pending transfers' });
  }
};

// ── 3D. POST /api/corporate/transfers/:id/approve (Release / Handshake Approve)
export const approveCorporateTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const transfer = await prisma.mF_G_EmployeeTransfer.findUnique({
      where: { id },
      include: {
        corporateEmployee: true,
        toProject: true,
        fromProject: true,
      },
    }); 

    if (!transfer) {
      res.status(404).json({ error: 'Transfer request not found' });
      return;
    }

    if (transfer.status === 'active') {
      res.status(400).json({ error: 'Transfer has already been approved and is active.' });
      return;
    }

    // Security Check: Only the source project (fromProject) or SuperAdmin can approve/release
    const rawRequesterProject =
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.headers['x-project-id'] as string);

    const isSuperAdmin =
      req.user?.role === 'super_admin' ||
      rawRequesterProject === 'GLOBAL' ||
      rawRequesterProject === 'superadmin' ||
      (req.headers['x-tenant-id'] === 'superadmin');

    if (!isSuperAdmin) {
      const allProjects = await prisma.mF_P_Project.findMany({
        select: { id: true, projectCode: true, projectName: true, subdomain: true },
      });
      const resolved = resolveProjectByCode(rawRequesterProject || '', allProjects);
      const requesterId = resolved?.id || rawRequesterProject;

      if (transfer.fromProjectId && transfer.fromProjectId !== requesterId) {
        res.status(403).json({
          error: `Unauthorized: Only project ${transfer.fromProject?.projectCode || 'the releasing site'} or Super Admin can release this employee.`,
        });
        return;
      }
    }

    const { corporateEmployeeId, fromProjectId, toProjectId, corporateEmployee, toProject } = transfer;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Close older active transfers
      await tx.mF_G_EmployeeTransfer.updateMany({
        where: {
          corporateEmployeeId,
          status: 'active',
          id: { not: id },
          endDate: null,
        },
        data: {
          status: 'transferred',
          endDate: transfer.startDate,
        },
      });

      // 2. Mark this transfer as active
      const updatedTransfer = await tx.mF_G_EmployeeTransfer.update({
        where: { id },
        data: { status: 'active' },
        include: {
          corporateEmployee: true,
          fromProject: true,
          toProject: true,
        },
      });

      // 3. Deactivate from old project site
      if (fromProjectId) {
        await tx.mF_P_Employee.updateMany({
          where: { corporateEmployeeId, projectId: fromProjectId },
          data: { status: 'inactive' },
        });
      }

      // 4. Activate / Upsert into target site
      await tx.mF_P_Employee.upsert({
        where: {
          projectId_corporateEmployeeId: {
            projectId: toProjectId,
            corporateEmployeeId,
          },
        },
        update: {
          callingName: corporateEmployee.fullName.split(' ')[0] || corporateEmployee.fullName,
          status: 'active',
          dailyRate: corporateEmployee.dailyRate ?? 1400.0,
          tradeGroupId: corporateEmployee.tradeGroupId,
          businessPartnerId: corporateEmployee.corporateBusinessPartnerId,
          isOperator: corporateEmployee.isOperator,
        },
        create: {
          projectId: toProjectId,
          corporateEmployeeId,
          callingName: corporateEmployee.fullName.split(' ')[0] || corporateEmployee.fullName,
          status: 'active',
          dailyRate: corporateEmployee.dailyRate ?? 1400.0,
          tradeGroupId: corporateEmployee.tradeGroupId,
          businessPartnerId: corporateEmployee.corporateBusinessPartnerId,
          isOperator: corporateEmployee.isOperator,
        },
      });

      // 5. Update corporate employee currentProjectId
      await tx.mF_G_Employee.update({
        where: { id: corporateEmployeeId },
        data: {
          currentProjectId: toProjectId,
        },
      });

      return updatedTransfer;
    });

    res.json({
      success: true,
      message: 'Transfer approved and employee successfully mobilized to new project site.',
      transfer: result,
    });
  } catch (error: any) {
    console.error('Error approving transfer:', error);
    res.status(500).json({ error: error.message || 'Failed to approve transfer' });
  }
};

// ── 3E. POST /api/corporate/transfers/:id/reject (Reject Transfer Request) ────
export const rejectCorporateTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { reason } = req.body || {};

    const transfer = await prisma.mF_G_EmployeeTransfer.findUnique({
      where: { id },
      include: {
        fromProject: true,
        toProject: true,
      },
    });

    if (!transfer) {
      res.status(404).json({ error: 'Transfer request not found' });
      return;
    }

    // Security Check: Only the involved project sites or Super Admin can reject or cancel
    const rawRequesterProject =
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.headers['x-tenant-id'] as string) ||
      (req.headers['x-project-id'] as string);

    const isSuperAdmin =
      req.user?.role === 'super_admin' ||
      rawRequesterProject === 'GLOBAL' ||
      rawRequesterProject === 'superadmin' ||
      (req.headers['x-tenant-id'] === 'superadmin');

    if (!isSuperAdmin) {
      const allProjects = await prisma.mF_P_Project.findMany({
        select: { id: true, projectCode: true, projectName: true, subdomain: true },
      });
      const resolved = resolveProjectByCode(rawRequesterProject || '', allProjects);
      const requesterId = resolved?.id || rawRequesterProject;

      const isReleasingSite = transfer.fromProjectId && transfer.fromProjectId === requesterId;
      const isRequestingSite = transfer.toProjectId === requesterId;

      if (!isReleasingSite && !isRequestingSite) {
        res.status(403).json({
          error: `Unauthorized: Only the involved project sites or Super Admin can reject or cancel this transfer.`,
        });
        return;
      }
    }

    const updated = await prisma.mF_G_EmployeeTransfer.update({
      where: { id },
      data: {
        status: 'rejected',
        remarks: reason ? `Rejected: ${reason}` : 'Transfer request rejected by releasing project.',
      },
    });

    res.json({ success: true, message: 'Transfer request rejected.', transfer: updated });
  } catch (error: any) {
    console.error('Error rejecting transfer:', error);
    res.status(500).json({ error: error.message || 'Failed to reject transfer' });
  }
};

// ── 4. GET /api/corporate/employees ───────────────────────────────────────────
export const getCorporateEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, tradeGroupId, status, employeeType } = req.query;

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }
    if (tradeGroupId && tradeGroupId !== 'all') {
      where.tradeGroupId = tradeGroupId;
    }
    if (employeeType && employeeType !== 'all') {
      where.employeeType = employeeType;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q, mode: 'insensitive' } },
        { employeeCode: { contains: q, mode: 'insensitive' } },
        { nicNo: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.mF_G_Employee.findMany({
        where,
        include: {
          tradeGroup: { select: { id: true, code: true, name: true } },
          corporateBusinessPartner: { select: { id: true, code: true, name: true } },
          currentProject: { select: { id: true, projectCode: true, projectName: true } },
          projectEmployees: {
            where: { status: 'active' },
            select: {
              projectId: true,
              project: { select: { id: true, projectCode: true, projectName: true } },
            },
          },
        },
        orderBy: { employeeCode: 'asc' },
      }),
      prisma.mF_G_Employee.count({ where }),
    ]);

    const formatted = items.map((emp) => ({
      id: emp.id,
      employeeCode: emp.employeeCode,
      fullName: emp.fullName,
      nicNo: emp.nicNo,
      epfNo: emp.epfNo,
      dailyRate: emp.dailyRate ? Number(emp.dailyRate) : 1400.0,
      isOperator: emp.isOperator,
      status: emp.status,
      tradeGroupId: emp.tradeGroupId,
      tradeGroup: emp.tradeGroup?.name || 'General Labour',
      tradeGroupCode: emp.tradeGroup?.code || '',
      employeeType: emp.employeeType || (emp.corporateBusinessPartnerId ? 'external' : 'internal'),
      businessPartnerId: emp.corporateBusinessPartnerId,
      businessPartner: emp.corporateBusinessPartner?.name || 'Mäga Engineering (Direct)',
      businessPartnerCode: emp.corporateBusinessPartner?.code || '',
      currentProjectId: emp.currentProjectId || null,
      currentProject: emp.currentProject || null,
      currentWorkingProject: emp.currentProject?.projectCode || null,
      activeProject: emp.projectEmployees[0]?.project || null,
      documentUrl: emp.documentUrl || null,
    }));

    res.json({ items: formatted, total });
  } catch (error) {
    console.error('Error fetching corporate employees:', error);
    res.status(500).json({ error: 'Failed to fetch corporate employees' });
  }
};

// ── 5. POST /api/corporate/employees ──────────────────────────────────────────
export const createCorporateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      employeeCode,
      fullName,
      nicNo,
      epfNo,
      tradeGroupId,
      dailyRate,
      isOperator,
      employeeType,
      corporateBusinessPartnerId,
      currentProjectId,
      currentWorkingProject,
    } = req.body || {};

    if (!employeeCode || !fullName || !nicNo) {
      res.status(400).json({ error: 'employeeCode, fullName, and nicNo are required' });
      return;
    }

    const resolvedType = (employeeType === 'external' || (!employeeType && corporateBusinessPartnerId)) ? 'external' : 'internal';
    if (resolvedType === 'external' && !corporateBusinessPartnerId) {
      res.status(400).json({ error: 'Business Partner is required for external/subcontractor employees' });
      return;
    }
    const finalBpId = resolvedType === 'external' ? corporateBusinessPartnerId : null;

    // Check duplicate code or NIC
    const existing = await prisma.mF_G_Employee.findFirst({
      where: {
        OR: [
          { employeeCode: employeeCode.trim() },
          { nicNo: nicNo.trim() },
        ],
      },
    });

    if (existing) {
      res.status(409).json({
        error: existing.employeeCode === employeeCode.trim()
          ? `Employee Code ${employeeCode} already exists`
          : `NIC No ${nicNo} already registered`,
      });
      return;
    }

    if (!tradeGroupId || !String(tradeGroupId).trim()) {
      res.status(400).json({ error: 'Trade Group is strictly required. An employee must belong to a Trade Group.' });
      return;
    }
    const targetTradeGroupId = String(tradeGroupId).trim();

    // Resolve project relation
    const targetProjectInput = currentProjectId || currentWorkingProject;
    let resolvedProjectId: string | null = null;
    let resolvedProjObj: any = null;

    if (targetProjectInput) {
      const allProjects = await prisma.mF_P_Project.findMany({
        select: { id: true, projectCode: true, projectName: true, subdomain: true },
      });
      const resolvedProj = resolveProjectByCode(targetProjectInput, allProjects);
      if (resolvedProj) {
        resolvedProjectId = resolvedProj.id;
        resolvedProjObj = resolvedProj;
      }
    }

    const created = await prisma.mF_G_Employee.create({
      data: {
        employeeCode: employeeCode.trim().toUpperCase(),
        fullName: fullName.trim(),
        nicNo: nicNo.trim().toUpperCase(),
        epfNo: epfNo ? epfNo.trim() : null,
        tradeGroupId: targetTradeGroupId,
        dailyRate: dailyRate !== undefined ? Number(dailyRate) : 1400.0,
        isOperator: Boolean(isOperator),
        employeeType: resolvedType,
        corporateBusinessPartnerId: finalBpId,
        currentProjectId: resolvedProjectId,
        documentUrl: req.body.documentUrl || null,
        status: req.body.status || 'active',
      },
      include: {
        tradeGroup: true,
        corporateBusinessPartner: true,
      },
    });

    // If project was resolved, auto-provision to site
    if (resolvedProjObj) {
      await prisma.mF_P_Employee.upsert({
        where: {
          projectId_corporateEmployeeId: {
            projectId: resolvedProjObj.id,
            corporateEmployeeId: created.id,
          },
        },
          update: {
            status: 'active',
            callingName: fullName.trim().split(' ')[0],
            dailyRate: created.dailyRate ?? 1400.0,
            tradeGroupId: created.tradeGroupId,
            businessPartnerId: finalBpId,
            isOperator: Boolean(isOperator),
          },
          create: {
            projectId: resolvedProjObj.id,
            corporateEmployeeId: created.id,
            callingName: fullName.trim().split(' ')[0],
            status: 'active',
            dailyRate: created.dailyRate ?? 1400.0,
            tradeGroupId: created.tradeGroupId,
            businessPartnerId: finalBpId,
            isOperator: Boolean(isOperator),
          },
        });

        await prisma.mF_G_EmployeeTransfer.create({
          data: {
            corporateEmployeeId: created.id,
            fromProjectId: null,
            toProjectId: resolvedProjObj.id,
            startDate: new Date(),
            status: 'active',
            remarks: 'Initial assignment upon employee registration',
          },
        });
      }

    res.status(201).json({
      success: true,
      message: 'Global employee created successfully',
      employee: created,
    });
  } catch (error: any) {
    console.error('Error creating corporate employee:', error);
    res.status(500).json({ error: error.message || 'Failed to create corporate employee' });
  }
};

// ── 5A. PUT /api/corporate/employees/:id ───────────────────────────────────────
export const updateCorporateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const {
      fullName,
      nicNo,
      epfNo,
      tradeGroupId,
      dailyRate,
      isOperator,
      employeeType,
      corporateBusinessPartnerId,
      status,
      documentUrl,
    } = req.body || {};

    const existing = await prisma.mF_G_Employee.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Corporate employee not found' });
      return;
    }

    if (nicNo && nicNo.trim().toUpperCase() !== existing.nicNo) {
      const nicCheck = await prisma.mF_G_Employee.findFirst({
        where: {
          nicNo: nicNo.trim().toUpperCase(),
          id: { not: id },
        },
      });
      if (nicCheck) {
        res.status(409).json({ error: `NIC No ${nicNo} already registered to another employee` });
        return;
      }
    }

    const resolvedType = employeeType || existing.employeeType;
    const finalBpId = resolvedType === 'external'
      ? (corporateBusinessPartnerId !== undefined ? corporateBusinessPartnerId : existing.corporateBusinessPartnerId)
      : null;

    const updated = await prisma.mF_G_Employee.update({
      where: { id },
      data: {
        ...(fullName ? { fullName: fullName.trim() } : {}),
        ...(nicNo ? { nicNo: nicNo.trim().toUpperCase() } : {}),
        ...(epfNo !== undefined ? { epfNo: epfNo ? epfNo.trim() : null } : {}),
        ...(tradeGroupId ? { tradeGroupId: String(tradeGroupId).trim() } : {}),
        ...(dailyRate !== undefined && dailyRate !== '' && !isNaN(Number(dailyRate)) ? { dailyRate: Number(dailyRate) } : {}),
        ...(isOperator !== undefined ? { isOperator: Boolean(isOperator) } : {}),
        ...(employeeType ? { employeeType: resolvedType } : {}),
        ...(corporateBusinessPartnerId !== undefined || employeeType ? { corporateBusinessPartnerId: finalBpId } : {}),
        ...(status ? { status } : {}),
        ...(documentUrl !== undefined ? { documentUrl: documentUrl || null } : {}),
      },
      include: {
        tradeGroup: true,
        corporateBusinessPartner: true,
        currentProject: { select: { id: true, projectCode: true, projectName: true } },
      },
    });

    // Sync site employees (MF_P_Employee)
    await prisma.mF_P_Employee.updateMany({
      where: { corporateEmployeeId: id },
      data: {
        ...(fullName ? { callingName: fullName.trim().split(' ')[0] } : {}),
        ...(dailyRate !== undefined && dailyRate !== '' && !isNaN(Number(dailyRate)) ? { dailyRate: Number(dailyRate) } : {}),
        ...(tradeGroupId ? { tradeGroupId: String(tradeGroupId).trim() } : {}),
        ...(corporateBusinessPartnerId !== undefined || employeeType ? { businessPartnerId: finalBpId } : {}),
        ...(isOperator !== undefined ? { isOperator: Boolean(isOperator) } : {}),
        ...(status ? { status } : {}),
      },
    });

    res.json({
      success: true,
      message: 'Corporate employee updated successfully',
      employee: updated,
    });
  } catch (error: any) {
    console.error('Error updating corporate employee:', error);
    res.status(500).json({ error: error.message || 'Failed to update corporate employee' });
  }
};

// ── 6. POST /api/corporate/employees/batch ────────────────────────────────────
export const batchCreateCorporateEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array is required' });
      return;
    }

    let inserted = 0;
    let updated = 0;

    for (const item of items) {
      const code = (item.employeeCode || item.code || '').trim().toUpperCase();
      const nic = (item.nicNo || item.nic || '').trim().toUpperCase();
      const name = (item.fullName || item.name || item.callingName || '').trim();

      if (!code || !name) continue;

      let tradeGroupId = item.tradeGroupId || null;
      if (!tradeGroupId && item.tradeGroup) {
        const tg = await prisma.mF_G_TradeGroup.findFirst({
          where: {
            OR: [
              { name: { equals: item.tradeGroup, mode: 'insensitive' } },
              { code: { equals: item.tradeGroup, mode: 'insensitive' } },
            ],
          },
        });
        if (tg) tradeGroupId = tg.id;
      }

      if (!tradeGroupId) {
        const defaultCode = (item.employeeType === 'external' || item.corporateBusinessPartnerId) ? 'SUS' : 'MUS';
        const tg = await prisma.mF_G_TradeGroup.findFirst({ where: { code: defaultCode } });
        tradeGroupId = tg?.id || null;
      }

      if (!tradeGroupId) continue;

      const existing = await prisma.mF_G_Employee.findUnique({
        where: { employeeCode: code },
      });

      if (existing) {
        await prisma.mF_G_Employee.update({
          where: { id: existing.id },
          data: {
            fullName: name,
            dailyRate: item.dailyRate !== undefined ? Number(item.dailyRate) : existing.dailyRate,
            tradeGroupId: tradeGroupId || existing.tradeGroupId,
            epfNo: item.epfNo || existing.epfNo,
            isOperator: Boolean(item.isOperator ?? existing.isOperator),
          },
        });
        updated++;
      } else {
        await prisma.mF_G_Employee.create({
          data: {
            employeeCode: code,
            fullName: name,
            nicNo: nic || `TEMP-${Date.now().toString().slice(-6)}`,
            dailyRate: item.dailyRate !== undefined ? Number(item.dailyRate) : 1400.0,
            tradeGroupId,
            epfNo: item.epfNo || null,
            isOperator: Boolean(item.isOperator),
            employeeType: (item.employeeType === 'internal' || item.employeeType === 'external') ? item.employeeType : (item.corporateBusinessPartnerId ? 'external' : 'internal'),
            corporateBusinessPartnerId: item.employeeType === 'internal' ? null : (item.corporateBusinessPartnerId || null),
            status: 'active',
          },
        });
        inserted++;
      }
    }

    res.json({ success: true, count: inserted + updated, inserted, updated });
  } catch (error) {
    console.error('Error batch importing corporate employees:', error);
    res.status(500).json({ error: 'Failed to batch import corporate employees' });
  }
};

// ── 7. GET /api/corporate/equipment ───────────────────────────────────────────
export const getCorporateEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, type, status } = req.query;

    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (type && type !== 'all') where.type = type;
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { standardEquipmentNumber: { contains: q, mode: 'insensitive' } },
        { equipmentName: { contains: q, mode: 'insensitive' } },
        { vehicleNo: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.mF_G_Equipment.findMany({
        where,
        include: {
          currentProject: { select: { id: true, projectCode: true, projectName: true } },
          businesspartner: { select: { id: true, code: true, name: true } },
        },
        orderBy: { standardEquipmentNumber: 'asc' },
      }),
      prisma.mF_G_Equipment.count({ where }),
    ]);

    res.json({ items, total });
  } catch (error) {
    console.error('Error fetching corporate equipment:', error);
    res.status(500).json({ error: 'Failed to fetch corporate equipment' });
  }
};

// ── 8. POST /api/corporate/equipment ──────────────────────────────────────────
export const createCorporateEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      standardEquipmentNumber,
      equipmentName,
      condition,
      unit,
      costRate,
      dailyRate,
      vehicleNo,
      type,
      currentProjectId,
      currentWorkingProject,
      businessPartnerId,
    } = req.body || {};

    const code = (standardEquipmentNumber || '').trim().toUpperCase();
    if (!code) {
      res.status(400).json({ error: 'standardEquipmentNumber is required' });
      return;
    }

    const existing = await prisma.mF_G_Equipment.findFirst({
      where: { standardEquipmentNumber: code },
    });
    if (existing) {
      res.status(409).json({ error: `Equipment ${code} already exists` });
      return;
    }

    // Resolve project relation
    const targetProjectInput = currentProjectId || currentWorkingProject;
    let resolvedProjectId: string | null = null;

    if (targetProjectInput) {
      const allProjects = await prisma.mF_P_Project.findMany({
        select: { id: true, projectCode: true, projectName: true, subdomain: true },
      });
      const resolvedProj = resolveProjectByCode(targetProjectInput, allProjects);
      if (resolvedProj) {
        resolvedProjectId = resolvedProj.id;
      }
    }

    // Resolve business partner relation
    let resolvedBpId: string | null = null;
    const bpInput = businessPartnerId || (req.body as any).businessPartner || (req.body as any).bpCode;
    if (
      bpInput &&
      typeof bpInput === 'string' &&
      bpInput.trim() &&
      bpInput.trim() !== '-' &&
      bpInput.trim() !== '0' &&
      bpInput.toLowerCase() !== 'none' &&
      bpInput.toLowerCase() !== 'n/a'
    ) {
      const trimmed = bpInput.trim();
      const bpRecord = await prisma.mF_G_BusinessPartner.findFirst({
        where: {
          OR: [
            { id: trimmed },
            { code: { equals: trimmed, mode: 'insensitive' } },
            { name: { equals: trimmed, mode: 'insensitive' } },
          ],
        },
      });
      if (bpRecord) {
        resolvedBpId = bpRecord.id;
      } else {
        res.status(400).json({ error: `Business Partner '${trimmed}' is not registered in the system.` });
        return;
      }
    }

    const created = await prisma.mF_G_Equipment.create({
      data: {
        standardEquipmentNumber: code,
        equipmentName: (equipmentName || code).trim(),
        condition: condition || 'DRY',
        unit: unit || 'Hrs',
        costRate: costRate !== undefined && costRate !== '' && !isNaN(Number(costRate)) ? Number(costRate) : null,
        dailyRate: dailyRate !== undefined && dailyRate !== '' && !isNaN(Number(dailyRate)) ? Number(dailyRate) : null,
        vehicleNo: vehicleNo ? vehicleNo.trim() : null,
        type: type || null,
        businessPartnerId: resolvedBpId,
        currentProjectId: resolvedProjectId,
        status: 'active',
      },
      include: {
        currentProject: { select: { id: true, projectCode: true, projectName: true } },
        businesspartner: { select: { id: true, code: true, name: true } },
      },
    });

    res.status(201).json({
      success: true,
      message: 'Global equipment created successfully',
      equipment: created,
    });
  } catch (error: any) {
    console.error('Error creating corporate equipment:', error);
    res.status(500).json({ error: error.message || 'Failed to create equipment' });
  }
};

// ── 8A. PUT /api/corporate/equipment/:id ───────────────────────────────────────
export const updateCorporateEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const {
      standardEquipmentNumber,
      equipmentName,
      condition,
      unit,
      costRate,
      dailyRate,
      vehicleNo,
      type,
      status,
      businessPartnerId,
    } = req.body || {};

    const existing = await prisma.mF_G_Equipment.findUnique({
      where: { id },
    });

    if (!existing) {
      res.status(404).json({ error: 'Equipment not found' });
      return;
    }

    if (standardEquipmentNumber && standardEquipmentNumber.trim().toUpperCase() !== existing.standardEquipmentNumber) {
      const codeCheck = await prisma.mF_G_Equipment.findFirst({
        where: {
          standardEquipmentNumber: standardEquipmentNumber.trim().toUpperCase(),
          id: { not: id },
        },
      });
      if (codeCheck) {
        res.status(409).json({ error: `Equipment number ${standardEquipmentNumber} already exists` });
        return;
      }
    }

    // Resolve business partner relation if provided
    let resolvedBpId: string | null | undefined = undefined;
    const bpInput = businessPartnerId !== undefined ? businessPartnerId : ((req.body as any).businessPartner || (req.body as any).bpCode);
    if (bpInput !== undefined) {
      if (
        !bpInput ||
        typeof bpInput !== 'string' ||
        !bpInput.trim() ||
        bpInput.trim() === '-' ||
        bpInput.trim() === '0' ||
        bpInput.toLowerCase() === 'none' ||
        bpInput.toLowerCase() === 'n/a'
      ) {
        resolvedBpId = null;
      } else {
        const trimmed = bpInput.trim();
        const bpRecord = await prisma.mF_G_BusinessPartner.findFirst({
          where: {
            OR: [
              { id: trimmed },
              { code: { equals: trimmed, mode: 'insensitive' } },
              { name: { equals: trimmed, mode: 'insensitive' } },
            ],
          },
        });
        if (bpRecord) {
          resolvedBpId = bpRecord.id;
        } else {
          res.status(400).json({ error: `Business Partner '${trimmed}' is not registered in the system.` });
          return;
        }
      }
    }

    const updated = await prisma.mF_G_Equipment.update({
      where: { id },
      data: {
        ...(standardEquipmentNumber ? { standardEquipmentNumber: standardEquipmentNumber.trim().toUpperCase() } : {}),
        ...(equipmentName ? { equipmentName: equipmentName.trim() } : {}),
        ...(condition ? { condition } : {}),
        ...(unit !== undefined ? { unit: unit || 'Hrs' } : {}),
        ...(costRate !== undefined && costRate !== '' && !isNaN(Number(costRate)) ? { costRate: Number(costRate) } : {}),
        ...(dailyRate !== undefined && dailyRate !== '' && !isNaN(Number(dailyRate)) ? { dailyRate: Number(dailyRate) } : {}),
        ...(vehicleNo !== undefined ? { vehicleNo: vehicleNo ? vehicleNo.trim() : null } : {}),
        ...(type !== undefined ? { type: type || null } : {}),
        ...(status ? { status } : {}),
        ...(resolvedBpId !== undefined ? { businessPartnerId: resolvedBpId } : {}),
      },
      include: {
        currentProject: { select: { id: true, projectCode: true, projectName: true } },
        businesspartner: { select: { id: true, code: true, name: true } },
      },
    });

    // Also update any site equipment referencing this corporate equipment so descriptions and rates sync
    await prisma.mF_P_Equipment.updateMany({
      where: { corporateEquipmentId: id },
      data: {
        ...(equipmentName ? { name: equipmentName.trim() } : {}),
        ...(condition ? { condition } : {}),
        ...(type !== undefined ? { type: type || null } : {}),
        ...(vehicleNo !== undefined ? { vehicleNo: vehicleNo ? vehicleNo.trim() : null } : {}),
        ...(costRate !== undefined && costRate !== '' && !isNaN(Number(costRate)) ? { costRate: Number(costRate) } : {}),
        ...(unit !== undefined ? { primaryUnit: unit || 'Hrs' } : {}),
        ...(status ? { status } : {}),
      },
    });

    res.json({
      success: true,
      message: 'Corporate equipment updated successfully',
      equipment: updated,
    });
  } catch (error: any) {
    console.error('Error updating corporate equipment:', error);
    res.status(500).json({ error: error.message || 'Failed to update equipment' });
  }
};

// ── 8B. POST /api/corporate/equipment/transfer ─────────────────────────────────
export const createCorporateEquipmentTransfer = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      corporateEquipmentId,
      toProjectId,
      fromProjectId,
      startDate,
      remarks,
    } = req.body || {};

    if (!corporateEquipmentId) {
      res.status(400).json({ error: 'corporateEquipmentId is required' });
      return;
    }

    const corpEquip = await prisma.mF_G_Equipment.findUnique({
      where: { id: corporateEquipmentId },
      include: { businesspartner: true },
    });

    if (!corpEquip) {
      res.status(404).json({ error: 'Corporate equipment not found' });
      return;
    }

    const effectiveStartDate = startDate ? new Date(startDate) : new Date();

    // Determine current/from location
    let resolvedFromProjectId = fromProjectId;
    if (!resolvedFromProjectId) {
      resolvedFromProjectId = corpEquip.currentProjectId || null;
      if (!resolvedFromProjectId) {
        const activeSiteEquip = await prisma.mF_P_Equipment.findFirst({
          where: { corporateEquipmentId, status: 'active' },
        });
        resolvedFromProjectId = activeSiteEquip?.projectId || null;
      }
    }

    // Target project ID or null for Central Yard
    const targetProjectId = toProjectId || null;

    if (resolvedFromProjectId && targetProjectId && resolvedFromProjectId === targetProjectId) {
      res.status(400).json({ error: 'Equipment is already deployed at this project site' });
      return;
    }

    if (!resolvedFromProjectId && !targetProjectId) {
      res.status(400).json({ error: 'Equipment is already at Central Equipment Yard' });
      return;
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Close open active transfers
      await tx.mF_G_EquipmentTransfer.updateMany({
        where: {
          corporateEquipmentId,
          status: 'active',
          endDate: null,
        },
        data: {
          status: 'transferred',
          endDate: effectiveStartDate,
        },
      });

      // 2. Create new transfer record
      const transfer = await tx.mF_G_EquipmentTransfer.create({
        data: {
          corporateEquipmentId,
          fromProjectId: resolvedFromProjectId,
          toProjectId: targetProjectId,
          startDate: effectiveStartDate,
          status: 'active',
          remarks:
            remarks ||
            (targetProjectId
              ? 'Dispatched to project site by Super Admin'
              : 'Returned to Central Equipment Yard by Super Admin'),
        },
        include: {
          corporateEquipment: true,
          fromProject: true,
          toProject: true,
        },
      });

      // 3. Deactivate on previous site
      if (resolvedFromProjectId) {
        await tx.mF_P_Equipment.updateMany({
          where: { corporateEquipmentId, projectId: resolvedFromProjectId },
          data: { status: 'transferred' },
        });
      }

      // 4. Enroll or activate on new site (if deployed to site)
      if (targetProjectId) {
        await tx.mF_P_Equipment.upsert({
          where: {
            projectId_corporateEquipmentId: {
              projectId: targetProjectId,
              corporateEquipmentId,
            },
          },
          update: {
            status: 'active',
            condition: corpEquip.condition || 'DRY',
            costRate: corpEquip.costRate,
            meterUnitCode: corpEquip.unit,
            ownerPartnerId: corpEquip.businessPartnerId,
          },
          create: {
            projectId: targetProjectId,
            corporateEquipmentId,
            status: 'active',
            condition: corpEquip.condition || 'DRY',
            costRate: corpEquip.costRate,
            meterUnitCode: corpEquip.unit,
            ownerPartnerId: corpEquip.businessPartnerId,
          },
        });
      }

      // 5. Update corporate equipment master location
      await tx.mF_G_Equipment.update({
        where: { id: corporateEquipmentId },
        data: {
          currentProjectId: targetProjectId,
        },
      });

      return transfer;
    });

    res.status(201).json({
      success: true,
      message: targetProjectId ? 'Equipment transferred successfully to project site' : 'Equipment returned to Central Yard',
      transfer: result,
    });
  } catch (error: any) {
    console.error('Error executing equipment transfer:', error);
    res.status(500).json({ error: error.message || 'Failed to transfer equipment' });
  }
};

// ── 8C. GET /api/corporate/equipment/transfers ─────────────────────────────────
export const getCorporateEquipmentTransfers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { equipmentId, projectId } = req.query;
    const where: any = {};
    if (equipmentId) where.corporateEquipmentId = String(equipmentId);
    if (projectId) {
      where.OR = [{ fromProjectId: String(projectId) }, { toProjectId: String(projectId) }];
    }

    const transfers = await prisma.mF_G_EquipmentTransfer.findMany({
      where,
      include: {
        corporateEquipment: {
          select: {
            id: true,
            standardEquipmentNumber: true,
            equipmentName: true,
            vehicleNo: true,
            unit: true,
          },
        },
        fromProject: { select: { id: true, projectCode: true, projectName: true } },
        toProject: { select: { id: true, projectCode: true, projectName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    res.json({ items: transfers, total: transfers.length });
  } catch (error: any) {
    console.error('Error fetching equipment transfers:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch equipment transfers' });
  }
};

// ── 9. GET /api/corporate/trade-groups ────────────────────────────────────────
export const getCorporateTradeGroups = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.mF_G_TradeGroup.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { corporateEmployees: true },
        },
      },
    });
    res.json({ items: list, total: list.length });
  } catch (error) {
    console.error('Error fetching trade groups:', error);
    res.status(500).json({ error: 'Failed to fetch trade groups' });
  }
};

// ── 10. POST /api/corporate/trade-groups ──────────────────────────────────────
export const createCorporateTradeGroup = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, standardDailyRate, standardOtRate } = req.body || {};
    if (!code || !name) {
      res.status(400).json({ error: 'code and name are required' });
      return;
    }

    const created = await prisma.mF_G_TradeGroup.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        standardDailyRate: standardDailyRate !== undefined ? Number(standardDailyRate) : 1400.0,
        standardOtRate: standardOtRate !== undefined ? Number(standardOtRate) : null,
        status: 'active',
      },
    });

    res.status(201).json({ success: true, tradeGroup: created });
  } catch (error: any) {
    console.error('Error creating trade group:', error);
    res.status(500).json({ error: error.message || 'Failed to create trade group' });
  }
};

// ── 11. GET /api/corporate/business-partners ──────────────────────────────────
export const getCorporateBusinessPartners = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.mF_G_BusinessPartner.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { corporateEmployees: true },
        },
      },
    });
    res.json({ items: list, total: list.length });
  } catch (error) {
    console.error('Error fetching business partners:', error);
    res.status(500).json({ error: 'Failed to fetch business partners' });
  }
};

// ── 12. POST /api/corporate/business-partners ─────────────────────────────────
export const createCorporateBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, type, contactPerson, phone, email, rating, nicNo, businessEntityIdentifier, address, city, country, brNumber, documentUrl, status } = req.body || {};
    if (!code || !name) {
      res.status(400).json({ error: 'code and name are required' });
      return;
    }

    const created = await prisma.mF_G_BusinessPartner.create({
      data: {
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type: type ? String(type).trim() : null,
        nicNo: (nicNo || businessEntityIdentifier)?.trim() || null,
        brNumber: brNumber?.trim() || null,
        documentUrl: documentUrl?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        country: country?.trim() || 'Sri Lanka',
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        rating: rating || null,
        status: status || 'active',
      },
    });

    res.status(201).json({ success: true, businessPartner: created });
  } catch (error: any) {
    console.error('Error creating business partner:', error);
    res.status(500).json({ error: error.message || 'Failed to create business partner' });
  }
};

// ── 13. PUT /api/corporate/business-partners/:id ──────────────────────────────
export const updateCorporateBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { name, type, contactPerson, phone, email, rating, status, nicNo, businessEntityIdentifier, address, city, country, brNumber, documentUrl } = req.body || {};

    const updated = await prisma.mF_G_BusinessPartner.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(type !== undefined ? { type: type ? String(type).trim() : null } : {}),
        ...(nicNo !== undefined || businessEntityIdentifier !== undefined ? { nicNo: (nicNo || businessEntityIdentifier)?.trim() || null } : {}),
        ...(brNumber !== undefined ? { brNumber: brNumber?.trim() || null } : {}),
        ...(documentUrl !== undefined ? { documentUrl: documentUrl?.trim() || null } : {}),
        ...(address !== undefined ? { address: address?.trim() || null } : {}),
        ...(city !== undefined ? { city: city?.trim() || null } : {}),
        ...(country !== undefined ? { country: country?.trim() || 'Sri Lanka' } : {}),
        ...(contactPerson !== undefined ? { contactPerson: contactPerson || null } : {}),
        ...(phone !== undefined ? { phone: phone || null } : {}),
        ...(email !== undefined ? { email: email || null } : {}),
        ...(rating !== undefined ? { rating: rating || null } : {}),
        ...(status ? { status } : {}),
      },
    });

    res.json({ success: true, businessPartner: updated });
  } catch (error: any) {
    console.error('Error updating business partner:', error);
    res.status(500).json({ error: error.message || 'Failed to update business partner' });
  }
};

// ── 14. DELETE /api/corporate/business-partners/:id ───────────────────────────
export const deleteCorporateBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const empCount = await prisma.mF_G_Employee.count({
      where: { corporateBusinessPartnerId: id },
    });
    if (empCount > 0) {
      res.status(400).json({
        error: `Cannot delete: ${empCount} corporate employee(s) are associated with this business partner.`,
      });
      return;
    }

    await prisma.mF_G_BusinessPartner.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Business partner deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting business partner:', error);
    res.status(500).json({ error: error.message || 'Failed to delete business partner' });
  }
};

// ── 15. GET /api/corporate/activity-codes ──────────────────────────────────────
export const getCorporateActivityCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const where: any = {};
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const items = await prisma.mF_G_ActivityCode.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    res.json({ items, total: items.length });
  } catch (error) {
    console.error('Error fetching corporate activity codes:', error);
    res.status(500).json({ error: 'Failed to fetch corporate activity codes' });
  }
};

// ── 16. POST /api/corporate/activity-codes ─────────────────────────────────────
export const createCorporateActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, description, unit } = req.body || {};
    if (!code || !description) {
      res.status(400).json({ error: 'code and description are required' });
      return;
    }

    const cleanCode = String(code).trim().toUpperCase();
    const existing = await prisma.mF_G_ActivityCode.findUnique({
      where: { code: cleanCode },
    });
    if (existing) {
      res.status(409).json({ error: `Activity Code ${cleanCode} already exists in corporate master` });
      return;
    }

    const created = await prisma.mF_G_ActivityCode.create({
      data: {
        code: cleanCode,
        description: String(description).trim(),
        unit: unit ? String(unit).trim() : null,
      },
    });

    res.status(201).json({ success: true, activityCode: created });
  } catch (error: any) {
    console.error('Error creating corporate activity code:', error);
    res.status(500).json({ error: error.message || 'Failed to create corporate activity code' });
  }
};

// ── 17. PUT /api/corporate/activity-codes/:id ──────────────────────────────────
export const updateCorporateActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { description, unit } = req.body || {};

    const updated = await prisma.mF_G_ActivityCode.update({
      where: { id },
      data: {
        ...(description ? { description: String(description).trim() } : {}),
        ...(unit !== undefined ? { unit: unit ? String(unit).trim() : null } : {}),
      },
    });

    res.json({ success: true, activityCode: updated });
  } catch (error: any) {
    console.error('Error updating corporate activity code:', error);
    res.status(500).json({ error: error.message || 'Failed to update corporate activity code' });
  }
};

// ── 18. DELETE /api/corporate/activity-codes/:id ───────────────────────────────
export const deleteCorporateActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);

    const projectUsageCount = await prisma.mF_P_ActivityCode.count({
      where: { corporateActivityCodeId: id },
    });
    if (projectUsageCount > 0) {
      res.status(400).json({
        error: `Cannot delete: ${projectUsageCount} project(s) have adopted this activity code.`,
      });
      return;
    }

    await prisma.mF_G_ActivityCode.delete({
      where: { id },
    });

    res.json({ success: true, message: 'Activity code deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting corporate activity code:', error);
    res.status(500).json({ error: error.message || 'Failed to delete activity code' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// BULK IMPORT UTILITIES: Smart Field Normalization & Human-Friendly Error Translation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Safely extracts a value from an object using a list of possible alias keys.
 * Matches case-insensitively and strips non-alphanumeric formatting.
 */
function getFieldVal(item: Record<string, any>, aliases: string[]): string {
  if (!item || typeof item !== 'object') return '';
  const itemKeys = Object.keys(item);
  const cleanKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const alias of aliases) {
    const target = cleanKey(alias);
    if (item[alias] !== undefined && item[alias] !== null && String(item[alias]).trim() !== '') {
      return String(item[alias]).trim();
    }
    const matchedKey = itemKeys.find((k) => cleanKey(k) === target);
    if (matchedKey && item[matchedKey] !== undefined && item[matchedKey] !== null && String(item[matchedKey]).trim() !== '') {
      return String(item[matchedKey]).trim();
    }
  }
  return '';
}

/**
 * Checks if an entire row is blank / empty
 */
function isRowEmpty(item: Record<string, any>): boolean {
  if (!item || typeof item !== 'object') return true;
  return Object.values(item).every((v) => v === undefined || v === null || String(v).trim() === '');
}

/**
 * Translates raw database/Prisma errors into clean human-readable reasons & suggestions
 */
function translateError(err: any, entity: string, code?: string): { reason: string; suggestion: string } {
  const msg = String(err?.message || '');
  if (msg.includes('Unique constraint failed') || msg.includes('unique constraint')) {
    if (msg.includes('nic_no') || msg.includes('nic')) {
      return {
        reason: `Duplicate NIC number. Another record with this National ID already exists in the system.`,
        suggestion: `Verify the NIC in your spreadsheet row. Each record must have a unique National ID.`,
      };
    }
    if (msg.includes('employee_code')) {
      return {
        reason: `Duplicate Employee Code '${code || ''}'. An employee with this Code is already registered.`,
        suggestion: `Use a unique Employee Code or edit the existing employee.`,
      };
    }
    if (msg.includes('standard_equipment_number')) {
      return {
        reason: `Duplicate Equipment Number '${code || ''}'. Equipment with this number is already logged.`,
        suggestion: `Check your equipment list for duplicated asset numbers.`,
      };
    }
    if (msg.includes('vehicle_no')) {
      return {
        reason: `Duplicate Vehicle Registration Number.`,
        suggestion: `Check the vehicle number column for duplicate plate numbers.`,
      };
    }
    if (msg.includes('code')) {
      return {
        reason: `Duplicate Code '${code || ''}'. This code is already in use.`,
        suggestion: `Ensure every entry has a distinct identifier code.`,
      };
    }
    return {
      reason: `Duplicate record conflict in database. A record with identical unique fields already exists.`,
      suggestion: `Check for existing records in the system or duplicates in your spreadsheet.`,
    };
  }

  if (
    msg.includes('Foreign key constraint failed') ||
    msg.includes('Foreign key constraint violated') ||
    msg.includes('foreign key constraint')
  ) {
    if (msg.includes('business_partner_id') || msg.includes('businessPartner')) {
      return {
        reason: `Business Partner reference not found in database.`,
        suggestion: `Ensure the specified Business Partner is registered in the Business Partner Master first.`,
      };
    }
    if (msg.includes('unit')) {
      return {
        reason: `Invalid Unit of Measure.`,
        suggestion: `Use a valid registered unit (e.g. Hrs, Days, km, mth, ton).`,
      };
    }
    return {
      reason: `Linked reference not found in database.`,
      suggestion: `Make sure referenced items (such as Business Partner, Trade Group, or Unit) exist first.`,
    };
  }

  return {
    reason: err?.message || `Database error while saving ${entity}`,
    suggestion: `Verify that all column values are properly formatted.`,
  };
}

// ── 19. POST /api/corporate/business-partners/bulk-import ──────────────────────
export const bulkImportCorporateBusinessPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
    }

    const codes = rawItems
      .map((item: any) =>
        getFieldVal(item, [
          'code',
          'bpCode',
          'partnerCode',
          'vendorCode',
          'supplierCode',
          'erpCode',
          'erpNewCode',
          'bp',
        ]).toUpperCase().trim()
      )
      .filter(Boolean);

    // Pre-fetch all matching business partners in 1 single query
    const existingBPs = codes.length > 0
      ? await prisma.mF_G_BusinessPartner.findMany({
          where: { code: { in: codes } },
        })
      : [];

    const existingMap = new Map<string, (typeof existingBPs)[0]>();
    for (const bp of existingBPs) {
      existingMap.set(bp.code.toUpperCase().trim(), bp);
    }

    const errors: Array<{
      row: number;
      code?: string;
      name?: string;
      field?: string;
      reason: string;
      suggestion?: string;
    }> = [];
    let insertedCount = 0;
    let updatedCount = 0;

    interface ValidBpOp {
      rowNum: number;
      code: string;
      name: string;
      cleanNic: string | null;
      type: string | null;
      bAddress: string | null;
      bCity: string | null;
      bCountry: string;
      contactPerson: string | null;
      phone: string | null;
      email: string | null;
      rating: string | null;
      existing?: (typeof existingBPs)[0];
    }

    const ops: ValidBpOp[] = [];
    const seenCodesInBatch = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const rowNum = i + 1;
      const item = rawItems[i] || {};

      if (isRowEmpty(item)) continue;

      const code = getFieldVal(item, [
        'code',
        'bpCode',
        'partnerCode',
        'vendorCode',
        'supplierCode',
        'erpCode',
        'erpNewCode',
        'bp',
      ]).toUpperCase().trim();

      const name = getFieldVal(item, [
        'name',
        'companyName',
        'partnerName',
        'businessPartner',
        'bpName',
        'supplierName',
        'vendorName',
        'title',
      ]);

      if (!code || !name) {
        errors.push({
          row: rowNum,
          code: code || undefined,
          name: name || undefined,
          field: !code ? 'Partner Code' : 'Partner Name',
          reason: !code ? 'Partner Code is required' : 'Company / Partner Name is required',
          suggestion: 'Provide both a unique Partner Code (e.g. BP1002885) and Partner Name.',
        });
        continue;
      }

      if (seenCodesInBatch.has(code)) {
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Partner Code',
          reason: `Duplicate partner code '${code}' found within the uploaded spreadsheet.`,
          suggestion: 'Ensure each row has a unique Partner Code.',
        });
        continue;
      }
      seenCodesInBatch.add(code);

      const cleanNic = getFieldVal(item, [
        'nicNo',
        'nic',
        'businessEntityIdentifier',
        'brNumber',
        'brNo',
        'businessRegistrationNo',
        'idNumber',
      ]) || null;

      const type = getFieldVal(item, ['type', 'partnerType', 'category']) || null;
      const bAddress = getFieldVal(item, ['address', 'street', 'addressLine1']) || null;
      const bCity = getFieldVal(item, ['city', 'town']) || null;
      const bCountry = getFieldVal(item, ['country']) || 'Sri Lanka';
      const contactPerson = getFieldVal(item, ['contactPerson', 'contact', 'person', 'representative']) || null;
      const phone = getFieldVal(item, ['phone', 'telephone', 'mobile', 'contactNo', 'phoneNo']) || null;
      const email = getFieldVal(item, ['email', 'emailAddress', 'mail']) || null;
      const rating = getFieldVal(item, ['rating', 'grade', 'score']) || null;

      ops.push({
        rowNum,
        code,
        name,
        cleanNic,
        type,
        bAddress,
        bCity,
        bCountry,
        contactPerson,
        phone,
        email,
        rating,
        existing: existingMap.get(code),
      });
    }

    // Parallel DB writes for high performance
    await Promise.all(
      ops.map(async (op) => {
        try {
          if (op.existing) {
            await prisma.mF_G_BusinessPartner.update({
              where: { id: op.existing.id },
              data: {
                name: op.name,
                type: op.type || op.existing.type,
                nicNo: op.cleanNic || op.existing.nicNo,
                address: op.bAddress || op.existing.address,
                city: op.bCity || op.existing.city,
                country: op.bCountry || op.existing.country,
                contactPerson: op.contactPerson || op.existing.contactPerson,
                phone: op.phone || op.existing.phone,
                email: op.email || op.existing.email,
                rating: op.rating || op.existing.rating,
                status: 'active',
              },
            });
            updatedCount++;
          } else {
            await prisma.mF_G_BusinessPartner.create({
              data: {
                code: op.code,
                name: op.name,
                type: op.type,
                nicNo: op.cleanNic,
                address: op.bAddress,
                city: op.bCity,
                country: op.bCountry,
                contactPerson: op.contactPerson,
                phone: op.phone,
                email: op.email,
                rating: op.rating,
                status: 'active',
              },
            });
            insertedCount++;
          }
        } catch (err: any) {
          const translated = translateError(err, 'business partner', op.code);
          errors.push({
            row: op.rowNum,
            code: op.code,
            name: op.name,
            field: 'Database',
            reason: translated.reason,
            suggestion: translated.suggestion,
          });
        }
      })
    );

    res.json({
      success: true,
      total: rawItems.length,
      importedCount: insertedCount + updatedCount,
      insertedCount,
      updatedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error('Error in bulkImportCorporateBusinessPartners:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk import business partners' });
  }
};

export const bulkImportCorporateEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
    }

    const codes = rawItems
      .map((item: any) =>
        getFieldVal(item, [
          'employeeCode',
          'empCode',
          'erpNewCode',
          'erpCode',
          'code',
          'empNo',
          'employeeNo',
          'emp_no',
        ]).toUpperCase().trim()
      )
      .filter(Boolean);

    // Pre-cache Trade Groups, Business Partners, Projects, and Existing Corporate Employees in parallel
    const [allTradeGroups, allBusinessPartners, allProjects, existingEmployees] = await Promise.all([
      prisma.mF_G_TradeGroup.findMany({ select: { id: true, code: true, name: true } }),
      prisma.mF_G_BusinessPartner.findMany({ select: { id: true, code: true, name: true } }),
      prisma.mF_P_Project.findMany({ select: { id: true, projectCode: true, projectName: true, subdomain: true } }),
      codes.length > 0
        ? prisma.mF_G_Employee.findMany({
            where: { employeeCode: { in: codes } },
          })
        : Promise.resolve([]),
    ]);

    const tradeGroupMap = new Map<string, string>();
    for (const tg of allTradeGroups) {
      tradeGroupMap.set(tg.name.toLowerCase().trim(), tg.id);
      tradeGroupMap.set(tg.code.toLowerCase().trim(), tg.id);
    }

    const bpMap = new Map<string, string>();
    for (const bp of allBusinessPartners) {
      bpMap.set(bp.code.toLowerCase().trim(), bp.id);
      bpMap.set(bp.name.toLowerCase().trim(), bp.id);
    }

    const existingMap = new Map<string, (typeof existingEmployees)[0]>();
    for (const emp of existingEmployees) {
      existingMap.set(emp.employeeCode.toUpperCase().trim(), emp);
    }

    const errors: Array<{
      row: number;
      code?: string;
      name?: string;
      field?: string;
      reason: string;
      suggestion?: string;
    }> = [];
    let insertedCount = 0;
    let updatedCount = 0;

    interface ValidEmpOp {
      rowNum: number;
      code: string;
      name: string;
      nic: string;
      dailyRate?: number;
      isOperator: boolean;
      rawOp: string;
      epfNo: string | null;
      resolvedTradeGroupId: string;
      isExternal: boolean;
      finalBpId: string | null;
      resolvedProj: (typeof allProjects)[0] | null;
      existing?: (typeof existingEmployees)[0];
    }

    const ops: ValidEmpOp[] = [];
    const seenCodesInBatch = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const rowNum = i + 1;
      const item = rawItems[i] || {};

      if (isRowEmpty(item)) continue;

      const code = getFieldVal(item, [
        'employeeCode',
        'empCode',
        'erpNewCode',
        'erpCode',
        'code',
        'empNo',
        'employeeNo',
        'emp_no',
      ]).toUpperCase().trim();

      const name = getFieldVal(item, [
        'fullName',
        'employeeName',
        'name',
        'callingName',
        'empName',
        'workerName',
      ]);

      const nic = getFieldVal(item, [
        'nicNo',
        'nic',
        'nationalId',
        'idNumber',
        'nicNumber',
      ]).toUpperCase().trim();

      if (!code || !name) {
        errors.push({
          row: rowNum,
          code: code || undefined,
          name: name || undefined,
          field: !code ? 'Employee Code' : 'Full Name',
          reason: !code ? 'Employee Code is required' : 'Full Name is required',
          suggestion: 'Ensure both Employee Code (e.g. X52106 or R8184) and Full Name are provided.',
        });
        continue;
      }

      if (seenCodesInBatch.has(code)) {
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Employee Code',
          reason: `Duplicate employee code '${code}' found within the uploaded spreadsheet.`,
          suggestion: 'Ensure each row has a unique Employee Code.',
        });
        continue;
      }
      seenCodesInBatch.add(code);

      // Resolve Business Partner & Employee Type (Strict Enterprise Validation)
      const explicitType = getFieldVal(item, ['employeeType', 'type', 'employmentType']).toLowerCase();
      const bpCodeInput = getFieldVal(item, [
        'businessPartnerCode',
        'bpCode',
        'businessPartner',
        'bp',
        'supplier',
        'vendor',
        'partnerCode',
      ]);

      let resolvedBpId: string | null = null;
      if (bpCodeInput) {
        const cleanBpCode = bpCodeInput.toUpperCase().trim();
        resolvedBpId = bpMap.get(cleanBpCode.toLowerCase()) || null;
        if (!resolvedBpId) {
          errors.push({
            row: rowNum,
            code,
            name,
            field: 'Business Partner Code',
            reason: `Business Partner '${cleanBpCode}' is NOT registered in the system.`,
            suggestion: `Please register '${cleanBpCode}' in the Business Partner Master first before importing employees under this partner.`,
          });
          continue;
        }
      }

      const isExternal =
        explicitType === 'external' ||
        (explicitType !== 'internal' && Boolean(bpCodeInput || resolvedBpId));

      if (isExternal && !resolvedBpId) {
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Business Partner Code',
          reason: 'Business Partner Code is required for external / supply employees and must be registered in the system.',
          suggestion: 'Provide a valid Business Partner Code that is registered in the Business Partner Master table.',
        });
        continue;
      }

      // Resolve Trade Group intelligently using smart normalization & ERP aliases
      const tradeGroupInput = getFieldVal(item, [
        'tradeGroup',
        'trade',
        'designation',
        'occupation',
        'tradeCode',
        'tradeGroupId',
      ]);

      if (!tradeGroupInput || !tradeGroupInput.trim()) {
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Trade Group',
          reason: 'Trade Group is strictly required. An employee cannot exist without a Trade Group.',
          suggestion: 'Provide a valid Trade Group Name or Code from the Trade Group Master table.',
        });
        continue;
      }

      const matchedTradeGroup = resolveTradeGroupSmart(tradeGroupInput, isExternal, allTradeGroups);

      if (!matchedTradeGroup) {
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Trade Group',
          reason: `Trade Group '${tradeGroupInput}' is not found in the Trade Group Master table.`,
          suggestion: 'Please specify a valid Trade Group Name or Code that is registered in your Trade Group table.',
        });
        continue;
      }

      const rawRate = getFieldVal(item, ['dailyRate', 'rateRs', 'rate', 'basicRate', 'rateLkr']);
      const dailyRate = rawRate !== '' && !isNaN(Number(rawRate)) ? Number(rawRate) : undefined;

      const rawOp = getFieldVal(item, ['isOperator', 'operator', 'operatorYN', 'machineOperator']).toLowerCase();
      const isOperator =
        rawOp === 'true' || rawOp === '1' || rawOp === 'yes' || rawOp === 'y' || rawOp === 'operator';

      const epfNo = getFieldVal(item, ['epfNo', 'epf', 'epfNumber']) || null;

      const rawProject = getFieldVal(item, [
        'currentWorkingProject',
        'currentProject',
        'workingProject',
        'projectCode',
        'project',
        'site',
        'workingPlace',
        'siteCode',
      ]);
      const resolvedProj = resolveProjectByCode(rawProject, allProjects);

      ops.push({
        rowNum,
        code,
        name,
        nic,
        dailyRate,
        isOperator,
        rawOp,
        epfNo,
        resolvedTradeGroupId: matchedTradeGroup.id,
        isExternal,
        finalBpId: isExternal ? resolvedBpId : null,
        resolvedProj: resolvedProj || null,
        existing: existingMap.get(code),
      });
    }

    // Parallel DB writes for high performance
    await Promise.all(
      ops.map(async (op) => {
        try {
          let savedEmployeeId: string;
          let finalDailyRate = op.dailyRate !== undefined ? op.dailyRate : 1400.0;

          if (op.existing) {
            const updated = await prisma.mF_G_Employee.update({
              where: { id: op.existing.id },
              data: {
                fullName: op.name,
                nicNo: op.nic || op.existing.nicNo,
                dailyRate: op.dailyRate !== undefined ? op.dailyRate : op.existing.dailyRate,
                tradeGroupId: op.resolvedTradeGroupId || op.existing.tradeGroupId,
                employeeType: op.isExternal ? 'external' : 'internal',
                corporateBusinessPartnerId: op.finalBpId !== null ? op.finalBpId : op.existing.corporateBusinessPartnerId,
                epfNo: op.epfNo || op.existing.epfNo,
                isOperator: op.rawOp !== '' ? op.isOperator : op.existing.isOperator,
                currentProjectId: op.resolvedProj?.id || op.existing.currentProjectId,
                status: 'active',
              },
            });
            savedEmployeeId = updated.id;
            finalDailyRate = Number(updated.dailyRate ?? 1400.0);
            updatedCount++;
          } else {
            const created = await prisma.mF_G_Employee.create({
              data: {
                employeeCode: op.code,
                fullName: op.name,
                nicNo: op.nic || `NIC-${op.code}`,
                dailyRate: op.dailyRate !== undefined ? op.dailyRate : 1400.0,
                tradeGroupId: op.resolvedTradeGroupId,
                employeeType: op.isExternal ? 'external' : 'internal',
                corporateBusinessPartnerId: op.finalBpId,
                epfNo: op.epfNo,
                isOperator: op.isOperator,
                currentProjectId: op.resolvedProj?.id || null,
                status: 'active',
              },
            });
            savedEmployeeId = created.id;
            insertedCount++;
          }

          // Auto-provision to site if a valid project was specified
          if (op.resolvedProj) {
            await prisma.mF_P_Employee.upsert({
              where: {
                projectId_corporateEmployeeId: {
                  projectId: op.resolvedProj.id,
                  corporateEmployeeId: savedEmployeeId,
                },
              },
              update: {
                callingName: op.name.split(' ')[0] || op.name,
                status: 'active',
                dailyRate: finalDailyRate,
                tradeGroupId: op.resolvedTradeGroupId,
                businessPartnerId: op.finalBpId,
                isOperator: op.isOperator,
              },
              create: {
                projectId: op.resolvedProj.id,
                corporateEmployeeId: savedEmployeeId,
                callingName: op.name.split(' ')[0] || op.name,
                status: 'active',
                dailyRate: finalDailyRate,
                tradeGroupId: op.resolvedTradeGroupId,
                businessPartnerId: op.finalBpId,
                isOperator: op.isOperator,
              },
            });
          }
        } catch (err: any) {
          const translated = translateError(err, 'employee', op.code);
          errors.push({
            row: op.rowNum,
            code: op.code,
            name: op.name,
            field: 'Database',
            reason: translated.reason,
            suggestion: translated.suggestion,
          });
        }
      })
    );

    res.json({
      success: true,
      total: rawItems.length,
      importedCount: insertedCount + updatedCount,
      insertedCount,
      updatedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error('Error in bulkImportCorporateEmployees:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk import employees' });
  }
};

export const bulkImportCorporateEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
    }

    const standardNumbers = rawItems
      .map((item: any) =>
        getFieldVal(item, [
          'standardEquipmentNumber',
          'equipmentNumber',
          'erpNewCode',
          'erpCode',
          'equipmentCode',
          'machineCode',
          'assetNo',
          'code',
        ]).toUpperCase().trim()
      )
      .filter(Boolean);

    // Pre-cache Business Partners, Unit Master, and Existing Equipment for fast O(1) relational lookups
    const [allPartners, allUnits, existingEquipment] = await Promise.all([
      prisma.mF_G_BusinessPartner.findMany({ select: { id: true, code: true, name: true } }),
      prisma.mF_G_UnitMaster.findMany({ select: { id: true, code: true, name: true } }),
      standardNumbers.length > 0
        ? prisma.mF_G_Equipment.findMany({
            where: { standardEquipmentNumber: { in: standardNumbers } },
          })
        : Promise.resolve([]),
    ]);

    const bpMap = new Map<string, string>();
    for (const p of allPartners) {
      bpMap.set(p.id.toLowerCase().trim(), p.id);
      bpMap.set(p.code.toLowerCase().trim(), p.id);
      bpMap.set(p.name.toLowerCase().trim(), p.id);
    }

    const unitSet = new Set<string>();
    for (const u of allUnits) {
      unitSet.add(u.code);
    }

    const existingMap = new Map<string, (typeof existingEquipment)[0]>();
    for (const eq of existingEquipment) {
      existingMap.set(eq.standardEquipmentNumber.toUpperCase().trim(), eq);
    }

    const normalizeUnit = (rawUnit: string | null | undefined): string => {
      if (!rawUnit || !rawUnit.trim()) return 'Hrs';
      const clean = rawUnit.trim();
      if (unitSet.has(clean)) return clean;
      const lower = clean.toLowerCase();
      if (lower.includes('hr') || lower.includes('hour')) return 'Hrs';
      if (lower.includes('day')) return 'Days';
      if (lower.includes('km') || lower.includes('kilo')) return 'km';
      if (lower.includes('mth') || lower.includes('month')) return 'mth';
      if (lower.includes('ton')) return 'ton';
      if (lower.includes('ex')) return 'EX.hrs';
      return 'Hrs';
    };

    const errors: Array<{
      row: number;
      code?: string;
      name?: string;
      field?: string;
      reason: string;
      suggestion?: string;
    }> = [];
    let insertedCount = 0;
    let updatedCount = 0;

    interface ValidEquipmentOp {
      rowNum: number;
      standardNumber: string;
      name: string;
      condition: string;
      unit: string;
      minUtil: number | null;
      dailyRate: number | null;
      costRate: number | null;
      vehicleNo: string | null;
      resolvedBpId: string | null;
      existing?: (typeof existingEquipment)[0];
    }

    const ops: ValidEquipmentOp[] = [];
    const seenCodesInBatch = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const rowNum = i + 1;
      const item = rawItems[i] || {};

      if (isRowEmpty(item)) continue;

      const standardNumber = getFieldVal(item, [
        'standardEquipmentNumber',
        'equipmentNumber',
        'erpNewCode',
        'erpCode',
        'equipmentCode',
        'machineCode',
        'assetNo',
        'code',
      ]).toUpperCase().trim();

      const name = getFieldVal(item, [
        'equipmentName',
        'machineName',
        'name',
        'description',
        'model',
      ]);

      if (!standardNumber || !name) {
        errors.push({
          row: rowNum,
          code: standardNumber || undefined,
          name: name || undefined,
          field: !standardNumber ? 'Equipment Number' : 'Equipment Name',
          reason: !standardNumber ? 'Equipment Number / Code is required' : 'Equipment Name is required',
          suggestion: 'Provide both Standard Equipment Number (e.g. MEXC0012) and Equipment Name.',
        });
        continue;
      }

      if (seenCodesInBatch.has(standardNumber)) {
        errors.push({
          row: rowNum,
          code: standardNumber,
          name,
          field: 'Equipment Number',
          reason: `Duplicate equipment number '${standardNumber}' found within the uploaded spreadsheet.`,
          suggestion: 'Ensure each row has a unique Standard Equipment Number.',
        });
        continue;
      }
      seenCodesInBatch.add(standardNumber);

      const rawDailyRate = getFieldVal(item, ['dailyRate', 'dailyRateLkr', 'baseRate', 'rate']);
      const dailyRate = rawDailyRate !== '' && !isNaN(Number(rawDailyRate)) ? Number(rawDailyRate) : null;

      const rawCostRate = getFieldVal(item, ['costRate', 'costRateLkr', 'rate']);
      const costRate = rawCostRate !== '' && !isNaN(Number(rawCostRate)) ? Number(rawCostRate) : null;

      const rawMinUtil = getFieldVal(item, ['minimumUtilization', 'minUtilization', 'minHours']);
      const minUtil = rawMinUtil !== '' && !isNaN(Number(rawMinUtil)) ? Number(rawMinUtil) : null;

      const rawCondition = getFieldVal(item, ['condition', 'machineCondition']);
      const condition = rawCondition ? rawCondition.toUpperCase().trim() : 'DRY';

      const rawUnit = getFieldVal(item, ['unit', 'meterUnit', 'unitOfMeasure']);
      const unit = normalizeUnit(rawUnit);

      const vehicleNo = getFieldVal(item, ['vehicleNo', 'vehicleNumber', 'registrationNo', 'plateNo']) || null;
      
      const bpInput = getFieldVal(item, [
        'businessPartner',
        'bpCode',
        'businessPartnerCode',
        'bp',
        'supplier',
        'vendor',
        'partnerCode',
      ]);

      let resolvedBpId: string | null = null;
      if (
        bpInput &&
        bpInput.trim() &&
        bpInput.trim() !== '-' &&
        bpInput.trim() !== '0' &&
        bpInput.toLowerCase() !== 'none' &&
        bpInput.toLowerCase() !== 'n/a'
      ) {
        const cleanBp = bpInput.trim().toLowerCase();
        resolvedBpId = bpMap.get(cleanBp) || null;
        if (!resolvedBpId) {
          errors.push({
            row: rowNum,
            code: standardNumber,
            name,
            field: 'Business Partner Code',
            reason: `Business Partner '${bpInput.trim()}' is NOT registered in the Business Partner Master.`,
            suggestion: `Please register '${bpInput.trim()}' in the Business Partner Master first before importing equipment for this partner, or leave blank for internal equipment.`,
          });
          continue;
        }
      }

      ops.push({
        rowNum,
        standardNumber,
        name,
        condition,
        unit,
        minUtil,
        dailyRate,
        costRate,
        vehicleNo,
        resolvedBpId,
        existing: existingMap.get(standardNumber),
      });
    }

    // Parallel DB writes for high performance
    await Promise.all(
      ops.map(async (op) => {
        try {
          if (op.existing) {
            await prisma.mF_G_Equipment.update({
              where: { id: op.existing.id },
              data: {
                equipmentName: op.name,
                condition: op.condition || op.existing.condition,
                unit: op.unit || op.existing.unit,
                minimumUtilization: op.minUtil !== null ? op.minUtil : op.existing.minimumUtilization,
                dailyRate: op.dailyRate !== null ? op.dailyRate : op.existing.dailyRate,
                costRate: op.costRate !== null ? op.costRate : op.existing.costRate,
                vehicleNo: op.vehicleNo || op.existing.vehicleNo,
                businessPartnerId: op.resolvedBpId !== null ? op.resolvedBpId : op.existing.businessPartnerId,
                status: 'active',
              },
            });
            updatedCount++;
          } else {
            await prisma.mF_G_Equipment.create({
              data: {
                standardEquipmentNumber: op.standardNumber,
                equipmentName: op.name,
                condition: op.condition,
                unit: op.unit,
                minimumUtilization: op.minUtil,
                dailyRate: op.dailyRate,
                costRate: op.costRate,
                vehicleNo: op.vehicleNo,
                businessPartnerId: op.resolvedBpId,
                currency: 'LKR',
                status: 'active',
              },
            });
            insertedCount++;
          }
        } catch (err: any) {
          const translated = translateError(err, 'equipment', op.standardNumber);
          errors.push({
            row: op.rowNum,
            code: op.standardNumber,
            name: op.name,
            field: 'Database',
            reason: translated.reason,
            suggestion: translated.suggestion,
          });
        }
      })
    );

    res.json({
      success: true,
      total: rawItems.length,
      importedCount: insertedCount + updatedCount,
      insertedCount,
      updatedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error('Error in bulkImportCorporateEquipment:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk import equipment' });
  }
};

export const bulkImportCorporateActivityCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
    }

    const codes = rawItems
      .map((item: any) => getFieldVal(item, ['code', 'activityCode', 'activity', 'codeNo']).trim())
      .filter(Boolean);

    const existingCodes = codes.length > 0
      ? await prisma.mF_G_ActivityCode.findMany({
          where: { code: { in: codes } },
        })
      : [];

    const existingMap = new Map<string, (typeof existingCodes)[0]>();
    for (const ac of existingCodes) {
      existingMap.set(ac.code.toLowerCase().trim(), ac);
    }

    const errors: Array<{
      row: number;
      code?: string;
      name?: string;
      field?: string;
      reason: string;
      suggestion?: string;
    }> = [];
    let insertedCount = 0;
    let updatedCount = 0;

    interface ValidActivityOp {
      rowNum: number;
      code: string;
      description: string;
      unit: string;
      existing?: (typeof existingCodes)[0];
    }

    const ops: ValidActivityOp[] = [];
    const seenCodesInBatch = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const rowNum = i + 1;
      const item = rawItems[i] || {};

      if (isRowEmpty(item)) continue;

      const code = getFieldVal(item, ['code', 'activityCode', 'activity', 'codeNo']).trim();
      const description = getFieldVal(item, ['description', 'name', 'activityName', 'title']).trim();
      const unit = getFieldVal(item, ['unit', 'unitOfMeasure', 'uom']) || 'm3';

      if (!code || !description) {
        errors.push({
          row: rowNum,
          code: code || undefined,
          name: description || undefined,
          field: !code ? 'Activity Code' : 'Description',
          reason: !code ? 'Activity Code is required' : 'Description is required',
          suggestion: 'Provide an activity code (e.g. 01-10-10-00) and short description.',
        });
        continue;
      }

      const lowerCode = code.toLowerCase();
      if (seenCodesInBatch.has(lowerCode)) {
        errors.push({
          row: rowNum,
          code,
          name: description,
          field: 'Activity Code',
          reason: `Duplicate activity code '${code}' found within the uploaded spreadsheet.`,
          suggestion: 'Ensure each row has a unique Activity Code.',
        });
        continue;
      }
      seenCodesInBatch.add(lowerCode);

      ops.push({
        rowNum,
        code,
        description,
        unit,
        existing: existingMap.get(lowerCode),
      });
    }

    // Parallel DB writes for high performance
    await Promise.all(
      ops.map(async (op) => {
        try {
          if (op.existing) {
            await prisma.mF_G_ActivityCode.update({
              where: { id: op.existing.id },
              data: {
                description: op.description,
                unit: op.unit || op.existing.unit,
              },
            });
            updatedCount++;
          } else {
            await prisma.mF_G_ActivityCode.create({
              data: {
                code: op.code,
                description: op.description,
                unit: op.unit,
              },
            });
            insertedCount++;
          }
        } catch (err: any) {
          const translated = translateError(err, 'activity code', op.code);
          errors.push({
            row: op.rowNum,
            code: op.code,
            name: op.description,
            field: 'Database',
            reason: translated.reason,
            suggestion: translated.suggestion,
          });
        }
      })
    );

    res.json({
      success: true,
      total: rawItems.length,
      importedCount: insertedCount + updatedCount,
      insertedCount,
      updatedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error('Error in bulkImportCorporateActivityCodes:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk import activity codes' });
  }
};

export const bulkImportCorporateTradeGroups = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
    }

    const codes = rawItems
      .map((item: any) => getFieldVal(item, ['code', 'tradeGroup', 'tradeCode', 'tradeGroupId']).toUpperCase().trim())
      .filter(Boolean);

    const existingTg = codes.length > 0
      ? await prisma.mF_G_TradeGroup.findMany({
          where: { code: { in: codes } },
        })
      : [];

    const existingMap = new Map<string, (typeof existingTg)[0]>();
    for (const tg of existingTg) {
      existingMap.set(tg.code.toUpperCase().trim(), tg);
    }

    const errors: Array<{
      row: number;
      code?: string;
      name?: string;
      field?: string;
      reason: string;
      suggestion?: string;
    }> = [];
    let insertedCount = 0;
    let updatedCount = 0;

    interface ValidTgOp {
      rowNum: number;
      code: string;
      name: string;
      normalRate: number;
      otRate: number | null;
      existing?: (typeof existingTg)[0];
    }

    const ops: ValidTgOp[] = [];
    const seenCodesInBatch = new Set<string>();

    for (let i = 0; i < rawItems.length; i++) {
      const rowNum = i + 1;
      const item = rawItems[i] || {};

      if (isRowEmpty(item)) continue;

      const code = getFieldVal(item, ['code', 'tradeGroup', 'tradeCode', 'tradeGroupId']).toUpperCase().trim();
      const name = getFieldVal(item, ['name', 'tradeName', 'tradeGroupName', 'title']);

      const rawRate = getFieldVal(item, ['standardDailyRate', 'normalRate', 'dailyRate', 'rate', 'rateRs']);
      const rawOt = getFieldVal(item, ['standardOtRate', 'otRate', 'otRateRs']);
      const normalRate = rawRate !== '' && !isNaN(Number(rawRate)) ? Number(rawRate) : 100.0;
      const otRate = rawOt !== '' && !isNaN(Number(rawOt)) ? Number(rawOt) : null;

      if (!code || !name) {
        errors.push({
          row: rowNum,
          code: code || undefined,
          name: name || undefined,
          field: !code ? 'Trade Code' : 'Trade Name',
          reason: !code ? 'Trade Group Code is required' : 'Trade Group Name is required',
          suggestion: 'Provide a code (e.g. MMS or MAS) and trade name (e.g. Mason).',
        });
        continue;
      }

      if (seenCodesInBatch.has(code)) {
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Trade Code',
          reason: `Duplicate trade group code '${code}' found within the uploaded spreadsheet.`,
          suggestion: 'Ensure each row has a unique Trade Group Code.',
        });
        continue;
      }
      seenCodesInBatch.add(code);

      ops.push({
        rowNum,
        code,
        name,
        normalRate,
        otRate,
        existing: existingMap.get(code),
      });
    }

    // Parallel DB writes for high performance
    await Promise.all(
      ops.map(async (op) => {
        try {
          if (op.existing) {
            await prisma.mF_G_TradeGroup.update({
              where: { id: op.existing.id },
              data: {
                name: op.name,
                standardDailyRate: op.normalRate,
                standardOtRate: op.otRate !== null ? op.otRate : op.existing.standardOtRate,
                status: 'active',
              },
            });
            updatedCount++;
          } else {
            await prisma.mF_G_TradeGroup.create({
              data: {
                code: op.code,
                name: op.name,
                standardDailyRate: op.normalRate,
                standardOtRate: op.otRate,
                status: 'active',
              },
            });
            insertedCount++;
          }
        } catch (err: any) {
          const translated = translateError(err, 'trade group', op.code);
          errors.push({
            row: op.rowNum,
            code: op.code,
            name: op.name,
            field: 'Database',
            reason: translated.reason,
            suggestion: translated.suggestion,
          });
        }
      })
    );

    res.json({
      success: true,
      total: rawItems.length,
      importedCount: insertedCount + updatedCount,
      insertedCount,
      updatedCount,
      failedCount: errors.length,
      errors,
    });
  } catch (error: any) {
    console.error('Error in bulkImportCorporateTradeGroups:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk import trade groups' });
  }
};

// ── 25. Corporate Projects Management (Super Admin Project Master) ───────────

function formatCorporateProject(p: any) {
  const primaryAdmin = p.users && p.users.length > 0 ? {
    id: p.users[0].id,
    username: p.users[0].username,
    fullName: p.users[0].fullName,
    status: p.users[0].status,
  } : null;

  return {
    id: p.id,
    projectCode: p.projectCode,
    projectName: p.projectName,
    subdomain: p.subdomain,
    description: p.description || '',
    searchKey: p.searchKey || '',
    projectManager: p.projectManager || '',
    addressCode: p.addressCode || '',
    enterpriseUnit: p.enterpriseUnit || '',
    currency: p.currency || 'LKR',
    addressLine1: p.addressLine1 || '',
    addressLine2: p.addressLine2 || '',
    phone: p.phone || '',
    fax: p.fax || '',
    email: p.email || '',
    status: p.status || 'active',
    createdAt: p.createdAt,
    userCount: p._count?.users ?? 0,
    employeeCount: p._count?.employees ?? 0,
    equipmentCount: p._count?.equipment ?? 0,
    dailySheetCount: p._count?.dailySheets ?? 0,
    primaryAdmin,
  };
}

// GET /api/corporate/projects — Get all projects with counts and admin info
export const getCorporateProjects = async (_req: Request, res: Response): Promise<void> => {
  try {
    const projects = await prisma.mF_P_Project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { role: 'admin' },
          take: 1,
          select: {
            id: true,
            username: true,
            fullName: true,
            status: true,
          },
        },
        _count: {
          select: {
            users: true,
            employees: true,
            equipment: true,
            dailySheets: true,
          },
        },
      },
    });

    res.json({
      success: true,
      items: projects.map(formatCorporateProject),
      total: projects.length,
    });
  } catch (error: any) {
    console.error('Error fetching corporate projects:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch corporate projects' });
  }
};

// POST /api/corporate/projects — Register new project (with optional site admin)
export const createCorporateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectCode,
      projectName,
      subdomain,
      description,
      searchKey,
      projectManager,
      addressCode,
      enterpriseUnit,
      currency,
      addressLine1,
      addressLine2,
      phone,
      fax,
      email,
      status,
      adminFullName,
      adminUsername,
      adminPassword,
    } = req.body || {};

    if (!projectCode?.trim() || !projectName?.trim()) {
      res.status(400).json({ error: 'Project Code (M-Code) and Project Name are required.' });
      return;
    }

    const cleanCode = projectCode.trim().toUpperCase();
    const cleanSubdomain = (subdomain?.trim() || cleanCode).toLowerCase();

    // Check uniqueness
    const existing = await prisma.mF_P_Project.findFirst({
      where: {
        OR: [
          { projectCode: { equals: cleanCode, mode: 'insensitive' } },
          { subdomain: { equals: cleanSubdomain, mode: 'insensitive' } },
        ],
      },
    });

    if (existing) {
      res.status(409).json({ error: `Project with code "${cleanCode}" or subdomain "${cleanSubdomain}" already exists.` });
      return;
    }

    let tempPassword: string | undefined = undefined;

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.mF_P_Project.create({
        data: {
          projectCode: cleanCode,
          projectName: projectName.trim(),
          subdomain: cleanSubdomain,
          description: description?.trim() || null,
          searchKey: searchKey?.trim() || null,
          projectManager: projectManager?.trim() || null,
          addressCode: addressCode?.trim() || null,
          enterpriseUnit: enterpriseUnit?.trim() || null,
          currency: currency?.trim() || 'LKR',
          addressLine1: addressLine1?.trim() || null,
          addressLine2: addressLine2?.trim() || null,
          phone: phone?.trim() || null,
          fax: fax?.trim() || null,
          email: email?.trim() || null,
          status: status || 'active',
        },
        include: {
          users: {
            where: { role: 'admin' },
            take: 1,
            select: { id: true, username: true, fullName: true, status: true },
          },
          _count: {
            select: { users: true, employees: true, equipment: true, dailySheets: true },
          },
        },
      });

      // Optional Site Admin
      if (adminUsername?.trim() && adminFullName?.trim()) {
        const finalPassword = adminPassword?.trim() || generateTempPassword();
        tempPassword = finalPassword;
        const passwordHash = await bcrypt.hash(finalPassword, 10);

        const adminUser = await tx.mF_P_User.create({
          data: {
            projectId: project.id,
            username: adminUsername.trim().toLowerCase(),
            fullName: adminFullName.trim(),
            passwordHash,
            role: 'admin',
            status: 'active',
            mustChangePassword: !adminPassword,
          },
        });

        project.users = [{
          id: adminUser.id,
          username: adminUser.username,
          fullName: adminUser.fullName,
          status: adminUser.status,
        }];
      }

      return project;
    });

    res.status(201).json({
      success: true,
      project: formatCorporateProject(result),
      tempPassword,
    });
  } catch (error: any) {
    console.error('Error creating corporate project:', error);
    res.status(500).json({ error: error.message || 'Failed to create project' });
  }
};

// PUT /api/corporate/projects/:id — Update project details (and optionally create/update site admin)
export const updateCorporateProject = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const {
      projectName,
      description,
      searchKey,
      projectManager,
      addressCode,
      enterpriseUnit,
      currency,
      addressLine1,
      addressLine2,
      phone,
      fax,
      email,
      status,
      adminFullName,
      adminUsername,
      adminPassword,
    } = req.body || {};

    if (!projectName?.trim()) {
      res.status(400).json({ error: 'Project Name is required.' });
      return;
    }

    let tempPassword: string | undefined = undefined;

    const updated = await prisma.$transaction(async (tx) => {
      const proj = await tx.mF_P_Project.update({
        where: { id },
        data: {
          projectName: projectName.trim(),
          description: description !== undefined ? (description?.trim() || null) : undefined,
          searchKey: searchKey !== undefined ? (searchKey?.trim() || null) : undefined,
          projectManager: projectManager !== undefined ? (projectManager?.trim() || null) : undefined,
          addressCode: addressCode !== undefined ? (addressCode?.trim() || null) : undefined,
          enterpriseUnit: enterpriseUnit !== undefined ? (enterpriseUnit?.trim() || null) : undefined,
          currency: currency !== undefined ? (currency?.trim() || 'LKR') : undefined,
          addressLine1: addressLine1 !== undefined ? (addressLine1?.trim() || null) : undefined,
          addressLine2: addressLine2 !== undefined ? (addressLine2?.trim() || null) : undefined,
          phone: phone !== undefined ? (phone?.trim() || null) : undefined,
          fax: fax !== undefined ? (fax?.trim() || null) : undefined,
          email: email !== undefined ? (email?.trim() || null) : undefined,
          status: status || undefined,
        },
        include: {
          users: {
            where: { role: 'admin' },
            take: 1,
            select: { id: true, username: true, fullName: true, status: true },
          },
          _count: {
            select: { users: true, employees: true, equipment: true, dailySheets: true },
          },
        },
      });

      // If admin details are provided, create or update the admin
      if (adminUsername?.trim() && adminFullName?.trim()) {
        const existingAdmin = await tx.mF_P_User.findFirst({
          where: { projectId: id, role: 'admin' },
        });

        if (existingAdmin) {
          // Update existing admin
          let updateData: any = {
            fullName: adminFullName.trim(),
            username: adminUsername.trim().toLowerCase(),
          };
          if (adminPassword?.trim()) {
            const newPwd = adminPassword.trim();
            tempPassword = newPwd;
            updateData.passwordHash = await bcrypt.hash(newPwd, 10);
            updateData.mustChangePassword = false;
          }
          await tx.mF_P_User.update({
            where: { id: existingAdmin.id },
            data: updateData,
          });
          proj.users = [{
            id: existingAdmin.id,
            username: adminUsername.trim().toLowerCase(),
            fullName: adminFullName.trim(),
            status: existingAdmin.status,
          }];
        } else {
          // Create new admin
          const finalPassword = adminPassword?.trim() || generateTempPassword();
          tempPassword = finalPassword;
          const passwordHash = await bcrypt.hash(finalPassword, 10);

          const newAdmin = await tx.mF_P_User.create({
            data: {
              projectId: id,
              username: adminUsername.trim().toLowerCase(),
              fullName: adminFullName.trim(),
              passwordHash,
              role: 'admin',
              status: 'active',
              mustChangePassword: !adminPassword,
            },
          });

          proj.users = [{
            id: newAdmin.id,
            username: newAdmin.username,
            fullName: newAdmin.fullName,
            status: newAdmin.status,
          }];
        }
      }

      return proj;
    });

    res.json({
      success: true,
      project: formatCorporateProject(updated),
      tempPassword,
    });
  } catch (error: any) {
    console.error('Error updating corporate project:', error);
    res.status(500).json({ error: error.message || 'Failed to update project' });
  }
};

// PATCH /api/corporate/projects/:id/status — Toggle or update status
export const updateCorporateProjectStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { status } = req.body || {};

    if (!status || !['active', 'on_hold', 'completed', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Status must be active, on_hold, completed, or suspended.' });
      return;
    }

    const updated = await prisma.mF_P_Project.update({
      where: { id },
      data: { status },
      include: {
        users: {
          where: { role: 'admin' },
          take: 1,
          select: { id: true, username: true, fullName: true, status: true },
        },
        _count: {
          select: { users: true, employees: true, equipment: true, dailySheets: true },
        },
      },
    });

    res.json({
      success: true,
      project: formatCorporateProject(updated),
    });
  } catch (error: any) {
    console.error('Error updating project status:', error);
    res.status(500).json({ error: error.message || 'Failed to update status' });
  }
};

// POST /api/corporate/projects/:id/reset-admin-password — Reset site admin password
export const resetCorporateProjectAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const admin = await prisma.mF_P_User.findFirst({
      where: { projectId: id, role: 'admin' },
    });

    if (!admin) {
      res.status(404).json({ error: 'No admin user found for this project.' });
      return;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await prisma.mF_P_User.update({
      where: { id: admin.id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    res.json({
      success: true,
      adminName: admin.fullName,
      adminUsername: admin.username,
      tempPassword,
    });
  } catch (error: any) {
    console.error('Error resetting project admin password:', error);
    res.status(500).json({ error: error.message || 'Failed to reset password' });
  }
};

// ── 20. GET /api/corporate/employees/pending (Pending Super Admin Approvals) ──
export const getPendingCorporateEmployees = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.mF_G_Employee.findMany({
      where: { status: 'pending_approval' },
      include: {
        tradeGroup: { select: { id: true, code: true, name: true } },
        corporateBusinessPartner: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
            brNumber: true,
            documentUrl: true,
          },
        },
        currentProject: { select: { id: true, projectCode: true, projectName: true } },
        projectEmployees: {
          select: {
            id: true,
            callingName: true,
            status: true,
            projectId: true,
            project: { select: { id: true, projectCode: true, projectName: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const items = list.map((emp) => {
      const siteEmp = emp.projectEmployees[0];
      const partner = emp.corporateBusinessPartner;
      const isPartnerApproved = !partner || partner.status === 'active';
      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        fullName: emp.fullName,
        nicNo: emp.nicNo,
        epfNo: emp.epfNo,
        dailyRate: emp.dailyRate ? Number(emp.dailyRate) : 1400.0,
        isOperator: emp.isOperator,
        employeeType: emp.employeeType,
        documentUrl: emp.documentUrl,
        status: emp.status,
        createdAt: emp.createdAt,
        tradeGroup: emp.tradeGroup?.name || 'General Labour',
        tradeGroupCode: emp.tradeGroup?.code || '',
        tradeGroupId: emp.tradeGroupId,
        businessPartnerId: partner?.id || null,
        businessPartnerName: partner?.name || 'Direct / Maga',
        businessPartnerCode: partner?.code || '',
        businessPartnerStatus: partner?.status || 'active',
        businessPartnerBrNumber: partner?.brNumber || null,
        businessPartnerDocumentUrl: partner?.documentUrl || null,
        isBusinessPartnerApproved: isPartnerApproved,
        projectCode: siteEmp?.project?.projectCode || emp.currentProject?.projectCode || 'N/A',
        projectName: siteEmp?.project?.projectName || emp.currentProject?.projectName || 'Project Site',
        siteEmployeeId: siteEmp?.id || null,
        isReadyForPayroll: false, // Locked until approved!
      };
    });

    res.json({ items, total: items.length });
  } catch (error) {
    console.error('Error fetching pending employees:', error);
    res.status(500).json({ error: 'Failed to fetch pending employees' });
  }
};

// ── 21. POST /api/corporate/employees/:id/approve (Approve & Assign Permanent Code)
export const approveCorporateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { officialCode } = req.body || {};

    const existing = await prisma.mF_G_Employee.findUnique({
      where: { id },
      include: { corporateBusinessPartner: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Corporate employee not found' });
      return;
    }

    let finalCode = officialCode ? String(officialCode).trim().toUpperCase() : '';
    if (!finalCode || finalCode.includes('TMP')) {
      const prefix = existing.employeeType === 'internal' ? 'HI' : 'HK';
      const latest = await prisma.mF_G_Employee.findFirst({
        where: { employeeCode: { startsWith: prefix } },
        orderBy: { employeeCode: 'desc' },
      });
      let nextNum = 500;
      if (latest) {
        const numPart = parseInt(latest.employeeCode.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(numPart)) nextNum = numPart + 1;
      }
      finalCode = `${prefix}${nextNum}`;
    }

    // Check code uniqueness
    const duplicate = await prisma.mF_G_Employee.findFirst({
      where: { employeeCode: finalCode, id: { not: id } },
    });
    if (duplicate) {
      finalCode = `${finalCode}_${Date.now().toString().slice(-3)}`;
    }

    const updated = await prisma.$transaction(async (tx) => {
      const gEmp = await tx.mF_G_Employee.update({
        where: { id },
        data: {
          employeeCode: finalCode,
          status: 'active',
        },
        include: {
          tradeGroup: true,
          corporateBusinessPartner: true,
        },
      });

      await tx.mF_P_Employee.updateMany({
        where: { corporateEmployeeId: id },
        data: {
          status: 'active',
        },
      });

      return gEmp;
    });

    res.json({
      success: true,
      message: `Employee approved successfully. Permanent Code issued: ${finalCode}`,
      employee: updated,
    });
  } catch (error: any) {
    console.error('Error approving corporate employee:', error);
    res.status(500).json({ error: error.message || 'Failed to approve employee' });
  }
};

// ── 22. POST /api/corporate/employees/:id/reject (Reject Employee Registration)
export const rejectCorporateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { reason } = req.body || {};

    const updated = await prisma.$transaction(async (tx) => {
      const gEmp = await tx.mF_G_Employee.update({
        where: { id },
        data: {
          status: 'rejected',
        },
      });

      await tx.mF_P_Employee.updateMany({
        where: { corporateEmployeeId: id },
        data: {
          status: 'rejected',
        },
      });

      return gEmp;
    });

    res.json({
      success: true,
      message: 'Employee registration rejected',
      reason: reason || null,
      employee: updated,
    });
  } catch (error: any) {
    console.error('Error rejecting corporate employee:', error);
    res.status(500).json({ error: error.message || 'Failed to reject employee' });
  }
};




