import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pw = 'ERP@';
  for (let i = 0; i <= 4; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
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

      // 5. Update corporate employee currentWorkingProject
      await tx.mF_G_Employee.update({
        where: { id: corporateEmployeeId },
        data: { currentWorkingProject: toProjectId },
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
      currentWorkingProject: emp.currentWorkingProject,
      activeProject: emp.projectEmployees[0]?.project || null,
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

    const created = await prisma.mF_G_Employee.create({
      data: {
        employeeCode: employeeCode.trim().toUpperCase(),
        fullName: fullName.trim(),
        nicNo: nicNo.trim().toUpperCase(),
        epfNo: epfNo ? epfNo.trim() : null,
        tradeGroupId: tradeGroupId || null,
        dailyRate: dailyRate !== undefined ? Number(dailyRate) : 1400.0,
        isOperator: Boolean(isOperator),
        employeeType: resolvedType,
        corporateBusinessPartnerId: finalBpId,
        currentWorkingProject: currentWorkingProject || null,
        status: 'active',
      },
      include: {
        tradeGroup: true,
        corporateBusinessPartner: true,
      },
    });

    // If currentWorkingProject was specified, auto-provision to site
    if (currentWorkingProject) {
      await prisma.mF_P_Employee.upsert({
        where: {
          projectId_corporateEmployeeId: {
            projectId: currentWorkingProject,
            corporateEmployeeId: created.id,
          },
        },
        update: {
          status: 'active',
          callingName: fullName.trim().split(' ')[0],
          dailyRate: created.dailyRate ?? 1400.0,
          tradeGroupId: created.tradeGroupId,
        },
        create: {
          projectId: currentWorkingProject,
          corporateEmployeeId: created.id,
          callingName: fullName.trim().split(' ')[0],
          status: 'active',
          dailyRate: created.dailyRate ?? 1400.0,
          tradeGroupId: created.tradeGroupId,
        },
      });

      await prisma.mF_G_EmployeeTransfer.create({
        data: {
          corporateEmployeeId: created.id,
          fromProjectId: null,
          toProjectId: currentWorkingProject,
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
          where: { name: { equals: item.tradeGroup, mode: 'insensitive' } },
        });
        if (tg) tradeGroupId = tg.id;
      }

      const existing = await prisma.mF_G_Employee.findFirst({
        where: {
          OR: [
            { employeeCode: code },
            nic ? { nicNo: nic } : undefined,
          ].filter(Boolean) as any,
        },
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
      currentWorkingProject,
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
        currentWorkingProject: currentWorkingProject || null,
        status: 'active',
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
    const { code, name, type, contactPerson, phone, email, rating, nicNo, businessEntityIdentifier, address, city, country } = req.body || {};
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
        address: address?.trim() || null,
        city: city?.trim() || null,
        country: country?.trim() || 'Sri Lanka',
        contactPerson: contactPerson || null,
        phone: phone || null,
        email: email || null,
        rating: rating || null,
        status: 'active',
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
    const { name, type, contactPerson, phone, email, rating, status, nicNo, businessEntityIdentifier, address, city, country } = req.body || {};

    const updated = await prisma.mF_G_BusinessPartner.update({
      where: { id },
      data: {
        ...(name ? { name: name.trim() } : {}),
        ...(type !== undefined ? { type: type ? String(type).trim() : null } : {}),
        ...(nicNo !== undefined || businessEntityIdentifier !== undefined ? { nicNo: (nicNo || businessEntityIdentifier)?.trim() || null } : {}),
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

  if (msg.includes('Foreign key constraint failed') || msg.includes('foreign key constraint')) {
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
      ]).toUpperCase();

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

      try {
        const existing = await prisma.mF_G_BusinessPartner.findUnique({
          where: { code },
        });

        if (existing) {
          await prisma.mF_G_BusinessPartner.update({
            where: { id: existing.id },
            data: {
              name,
              type: type || existing.type,
              nicNo: cleanNic || existing.nicNo,
              address: bAddress || existing.address,
              city: bCity || existing.city,
              country: bCountry || existing.country,
              contactPerson: contactPerson || existing.contactPerson,
              phone: phone || existing.phone,
              email: email || existing.email,
              rating: rating || existing.rating,
              status: 'active',
            },
          });
          updatedCount++;
        } else {
          await prisma.mF_G_BusinessPartner.create({
            data: {
              code,
              name,
              type,
              nicNo: cleanNic,
              address: bAddress,
              city: bCity,
              country: bCountry,
              contactPerson,
              phone,
              email,
              rating,
              status: 'active',
            },
          });
          insertedCount++;
        }
      } catch (err: any) {
        const translated = translateError(err, 'business partner', code);
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Database',
          reason: translated.reason,
          suggestion: translated.suggestion,
        });
      }
    }

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

// ── 20. POST /api/corporate/employees/bulk-import ──────────────────────────────
export const bulkImportCorporateEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
    }

    // Pre-cache Trade Groups and Business Partners for O(1) lookups
    const [allTradeGroups, allBusinessPartners] = await Promise.all([
      prisma.mF_G_TradeGroup.findMany({ select: { id: true, code: true, name: true } }),
      prisma.mF_G_BusinessPartner.findMany({ select: { id: true, code: true, name: true } }),
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
      ]).toUpperCase();

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
      ]).toUpperCase();

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

      // Resolve Trade Group with exact and partial matching
      const tradeGroupInput = getFieldVal(item, [
        'tradeGroup',
        'trade',
        'designation',
        'occupation',
        'tradeCode',
        'tradeGroupId',
      ]);

      let resolvedTradeGroupId: string | null = null;
      if (tradeGroupInput) {
        const lookup = tradeGroupInput.toLowerCase().trim();
        resolvedTradeGroupId = tradeGroupMap.get(lookup) || null;
        if (!resolvedTradeGroupId) {
          // Partial/fuzzy match
          const found = allTradeGroups.find(
            (tg) =>
              tg.name.toLowerCase().includes(lookup) ||
              lookup.includes(tg.name.toLowerCase()) ||
              tg.code.toLowerCase() === lookup,
          );
          if (found) resolvedTradeGroupId = found.id;
        }
      }

      // Resolve Business Partner & Employee Type
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
        resolvedBpId = bpMap.get(bpCodeInput.toLowerCase().trim()) || null;
        if (!resolvedBpId) {
          errors.push({
            row: rowNum,
            code,
            name,
            field: 'Business Partner Code',
            reason: `Business Partner '${bpCodeInput}' is not registered in the system`,
            suggestion: `Add '${bpCodeInput}' to the Business Partners master first, or leave blank if internal employee.`,
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
          reason: 'Business Partner Code is required for external / supply employees',
          suggestion: 'Provide a valid Business Partner Code (e.g. BP1002885) for external subcontractors.',
        });
        continue;
      }
      const finalBpId = isExternal ? resolvedBpId : null;

      try {
        const existing = await prisma.mF_G_Employee.findFirst({
          where: {
            OR: [
              { employeeCode: code },
              nic ? { nicNo: nic } : undefined,
            ].filter(Boolean) as any,
          },
        });

        const rawRate = getFieldVal(item, ['dailyRate', 'rateRs', 'rate', 'basicRate', 'rateLkr']);
        const dailyRate = rawRate !== '' && !isNaN(Number(rawRate)) ? Number(rawRate) : undefined;

        const rawOp = getFieldVal(item, ['isOperator', 'operator', 'operatorYN', 'machineOperator']).toLowerCase();
        const isOperator =
          rawOp === 'true' || rawOp === '1' || rawOp === 'yes' || rawOp === 'y' || rawOp === 'operator';

        const epfNo = getFieldVal(item, ['epfNo', 'epf', 'epfNumber']) || null;

        if (existing) {
          await prisma.mF_G_Employee.update({
            where: { id: existing.id },
            data: {
              fullName: name,
              nicNo: nic || existing.nicNo,
              dailyRate: dailyRate !== undefined ? dailyRate : existing.dailyRate,
              tradeGroupId: resolvedTradeGroupId || existing.tradeGroupId,
              employeeType: isExternal ? 'external' : 'internal',
              corporateBusinessPartnerId: finalBpId !== null ? finalBpId : existing.corporateBusinessPartnerId,
              epfNo: epfNo || existing.epfNo,
              isOperator: rawOp !== '' ? isOperator : existing.isOperator,
              status: 'active',
            },
          });
          updatedCount++;
        } else {
          await prisma.mF_G_Employee.create({
            data: {
              employeeCode: code,
              fullName: name,
              nicNo: nic || `NIC-${code}`,
              dailyRate: dailyRate !== undefined ? dailyRate : 1400.0,
              tradeGroupId: resolvedTradeGroupId,
              employeeType: isExternal ? 'external' : 'internal',
              corporateBusinessPartnerId: finalBpId,
              epfNo,
              isOperator,
              status: 'active',
            },
          });
          insertedCount++;
        }
      } catch (err: any) {
        const translated = translateError(err, 'employee', code);
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Database',
          reason: translated.reason,
          suggestion: translated.suggestion,
        });
      }
    }

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

// ── 21. POST /api/corporate/equipment/bulk-import ──────────────────────────────
export const bulkImportCorporateEquipment = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
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
      ]).toUpperCase();

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

      const rawDailyRate = getFieldVal(item, ['dailyRate', 'dailyRateLkr', 'baseRate', 'rate']);
      const dailyRate = rawDailyRate !== '' && !isNaN(Number(rawDailyRate)) ? Number(rawDailyRate) : null;

      const rawCostRate = getFieldVal(item, ['costRate', 'costRateLkr', 'rate']);
      const costRate = rawCostRate !== '' && !isNaN(Number(rawCostRate)) ? Number(rawCostRate) : null;

      const rawMinUtil = getFieldVal(item, ['minimumUtilization', 'minUtilization', 'minHours']);
      const minUtil = rawMinUtil !== '' && !isNaN(Number(rawMinUtil)) ? Number(rawMinUtil) : null;

      const condition = getFieldVal(item, ['condition', 'machineCondition']) || 'DRY';
      const unit = getFieldVal(item, ['unit', 'meterUnit', 'unitOfMeasure']) || 'hrs';
      const vehicleNo = getFieldVal(item, ['vehicleNo', 'vehicleNumber', 'registrationNo', 'plateNo']) || null;
      const bp = getFieldVal(item, ['businessPartner', 'bpCode', 'businessPartnerCode', 'bp']) || null;

      try {
        const existing = await prisma.mF_G_Equipment.findFirst({
          where: { standardEquipmentNumber: standardNumber },
        });

        if (existing) {
          await prisma.mF_G_Equipment.update({
            where: { id: existing.id },
            data: {
              equipmentName: name,
              condition: condition || existing.condition,
              unit: unit || existing.unit,
              minimumUtilization: minUtil !== null ? minUtil : existing.minimumUtilization,
              dailyRate: dailyRate !== null ? dailyRate : existing.dailyRate,
              costRate: costRate !== null ? costRate : existing.costRate,
              vehicleNo: vehicleNo || existing.vehicleNo,
              businessPartner: bp || existing.businessPartner,
              status: 'active',
            },
          });
          updatedCount++;
        } else {
          await prisma.mF_G_Equipment.create({
            data: {
              standardEquipmentNumber: standardNumber,
              equipmentName: name,
              condition,
              unit,
              minimumUtilization: minUtil,
              dailyRate,
              costRate,
              vehicleNo,
              businessPartner: bp,
              currency: 'LKR',
              status: 'active',
            },
          });
          insertedCount++;
        }
      } catch (err: any) {
        const translated = translateError(err, 'equipment', standardNumber);
        errors.push({
          row: rowNum,
          code: standardNumber,
          name,
          field: 'Database',
          reason: translated.reason,
          suggestion: translated.suggestion,
        });
      }
    }

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

// ── 22. POST /api/corporate/activity-codes/bulk-import ─────────────────────────
export const bulkImportCorporateActivityCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
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

      try {
        const existing = await prisma.mF_G_ActivityCode.findUnique({
          where: { code },
        });

        if (existing) {
          await prisma.mF_G_ActivityCode.update({
            where: { id: existing.id },
            data: {
              description,
              unit: unit || existing.unit,
            },
          });
          updatedCount++;
        } else {
          await prisma.mF_G_ActivityCode.create({
            data: {
              code,
              description,
              unit,
            },
          });
          insertedCount++;
        }
      } catch (err: any) {
        const translated = translateError(err, 'activity code', code);
        errors.push({
          row: rowNum,
          code,
          name: description,
          field: 'Database',
          reason: translated.reason,
          suggestion: translated.suggestion,
        });
      }
    }

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

// ── 23. POST /api/corporate/trade-groups/bulk-import ───────────────────────────
export const bulkImportCorporateTradeGroups = async (req: Request, res: Response): Promise<void> => {
  try {
    const rawItems = req.body.records || req.body.items || [];
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      res.status(400).json({ error: 'records array is required' });
      return;
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

    for (let i = 0; i < rawItems.length; i++) {
      const rowNum = i + 1;
      const item = rawItems[i] || {};

      if (isRowEmpty(item)) continue;

      const code = getFieldVal(item, ['code', 'tradeGroup', 'tradeCode', 'tradeGroupId']).toUpperCase();
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

      try {
        const existing = await prisma.mF_G_TradeGroup.findUnique({
          where: { code },
        });

        if (existing) {
          await prisma.mF_G_TradeGroup.update({
            where: { id: existing.id },
            data: {
              name,
              standardDailyRate: normalRate,
              standardOtRate: otRate !== null ? otRate : existing.standardOtRate,
              status: 'active',
            },
          });
          updatedCount++;
        } else {
          await prisma.mF_G_TradeGroup.create({
            data: {
              code,
              name,
              standardDailyRate: normalRate,
              standardOtRate: otRate,
              status: 'active',
            },
          });
          insertedCount++;
        }
      } catch (err: any) {
        const translated = translateError(err, 'trade group', code);
        errors.push({
          row: rowNum,
          code,
          name,
          field: 'Database',
          reason: translated.reason,
          suggestion: translated.suggestion,
        });
      }
    }

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



