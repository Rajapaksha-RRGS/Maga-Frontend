import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';

// Helper to extract string param safely
const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

const partnerSelectOptimized = {
  id: true,
  code: true,
  name: true,
  type: true,
  contactPerson: true,
  phone: true,
  email: true,
  rating: true,
  nicNo: true,
  brNumber: true,
  documentUrl: true,
  address: true,
  city: true,
  country: true,
  status: true,
  createdAt: true,
  _count: {
    select: {
      employees: true,
      equipment: true,
    },
  },
};

// 1. GET /api/business-partners — List all business partners
export const getAllBusinessPartners = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, search } = req.query;

    const where: Record<string, any> = {};
    if (status && typeof status === 'string' && status !== 'all') {
      where.status = status;
    }
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { code: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
      ];
    }

    const currentProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (req.headers['x-tenant-id'] as string);

    const isCorporateScope =
      req.query.scope === 'corporate' ||
      req.query.all === 'true' ||
      currentProjectId === 'superadmin' ||
      currentProjectId === 'GLOBAL';

    let siteWorkerCounts: Record<string, number> = {};
    let siteEquipmentCounts: Record<string, number> = {};

    if (currentProjectId && currentProjectId !== 'superadmin' && currentProjectId !== 'GLOBAL') {
      try {
        const siteCounts = await prisma.mF_P_Employee.groupBy({
          by: ['businessPartnerId'],
          where: {
            projectId: currentProjectId,
            status: 'active',
            businessPartnerId: { not: null },
          },
          _count: { id: true },
        });
        siteCounts.forEach((sc) => {
          if (sc.businessPartnerId) {
            siteWorkerCounts[sc.businessPartnerId] = sc._count.id;
          }
        });
      } catch (err) {
        console.warn('Could not compute siteWorkerCounts:', err);
      }

      try {
        const siteEqCounts = await prisma.mF_P_Equipment.groupBy({
          by: ['ownerPartnerId'],
          where: {
            projectId: currentProjectId,
            status: 'active',
            ownerPartnerId: { not: null },
          },
          _count: { id: true },
        });
        siteEqCounts.forEach((sc) => {
          if (sc.ownerPartnerId) {
            siteEquipmentCounts[sc.ownerPartnerId] = sc._count.id;
          }
        });
      } catch (err) {
        console.warn('Could not compute siteEquipmentCounts:', err);
      }

      // In Site Admin context (not corporate scope), filter strictly to this site's partners
      if (!isCorporateScope) {
        try {
          const assignedRows: any[] = await prisma.$queryRawUnsafe(
            `SELECT "business_partner_id" FROM "MF_L_BUSINESS_PARTNER" WHERE "project_id" = $1 AND "status" != 'deleted'`,
            currentProjectId
          );
          const sitePartnerIds = new Set<string>(assignedRows.map((r) => r.business_partner_id));

          // Also include partners who currently have active workers or equipment on this site
          Object.keys(siteWorkerCounts).forEach((id) => sitePartnerIds.add(id));
          Object.keys(siteEquipmentCounts).forEach((id) => sitePartnerIds.add(id));

          // Also include walk-in registrations pending approval
          const pendingPartners = await prisma.mF_G_BusinessPartner.findMany({
            where: { status: 'pending_approval' },
            select: { id: true },
          });
          pendingPartners.forEach((p) => sitePartnerIds.add(p.id));

          where.id = { in: Array.from(sitePartnerIds) };
        } catch (err) {
          console.warn('Could not filter by site partner IDs:', err);
        }
      }
    }

    const partners = await prisma.mF_G_BusinessPartner.findMany({
      where,
      select: partnerSelectOptimized,
      orderBy: { code: 'asc' },
    });

    const formatted = partners.map((p) => {
      const workerCount = siteWorkerCounts[p.id] || 0;
      const equipmentCount = siteEquipmentCounts[p.id] || 0;
      const isActiveOnSite = workerCount > 0 || equipmentCount > 0;
      return {
        ...p,
        employeeCount: p._count.employees,
        equipmentCount: p._count.equipment,
        siteWorkerCount: workerCount,
        siteEquipmentCount: equipmentCount,
        isActiveOnSite,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching business partners:', error);
    res.status(500).json({ error: 'Failed to fetch business partners' });
  }
};

// 2. GET /api/business-partners/:id — Get single business partner by ID
export const getBusinessPartnerById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const partner = await prisma.mF_G_BusinessPartner.findUnique({
      where: { id },
      select: partnerSelectOptimized,
    });

    if (!partner) {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }

    const currentProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (req.headers['x-tenant-id'] as string);

    let siteWorkerCount = 0;
    let siteEquipmentCount = 0;

    if (currentProjectId && currentProjectId !== 'superadmin' && currentProjectId !== 'GLOBAL') {
      try {
        siteWorkerCount = await prisma.mF_P_Employee.count({
          where: { projectId: currentProjectId, status: 'active', businessPartnerId: id },
        });
        siteEquipmentCount = await prisma.mF_P_Equipment.count({
          where: { projectId: currentProjectId, status: 'active', ownerPartnerId: id },
        });
      } catch (err) {
        console.warn('Could not compute site counts for partner:', err);
      }
    }

    res.json({
      ...partner,
      employeeCount: partner._count.employees,
      equipmentCount: partner._count.equipment,
      siteWorkerCount,
      siteEquipmentCount,
      isActiveOnSite: Boolean(siteWorkerCount > 0 || siteEquipmentCount > 0),
    });
  } catch (error) {
    console.error('Error fetching business partner:', error);
    res.status(500).json({ error: 'Failed to fetch business partner' });
  }
};

// 3. GET /api/business-partners/next-code — Get next available BP code
export const getNextBusinessPartnerCode = async (_req: Request, res: Response): Promise<void> => {
  try {
    const regularPartners = await prisma.mF_G_BusinessPartner.findMany({
      where: { code: { startsWith: 'BP1' } },
      select: { code: true },
    });

    let maxBp = 1001000;
    for (const p of regularPartners) {
      const num = parseInt(p.code.replace(/[^0-9]/g, ''), 10);
      if (!isNaN(num) && num > maxBp) maxBp = num;
    }

    const nextCode = `BP${maxBp + 1}`;
    res.json({ nextCode });
  } catch (error) {
    console.error('Error getting next code:', error);
    res.status(500).json({ error: 'Failed to generate next code' });
  }
};

// 4. POST /api/business-partners — Create business partner
export const createBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      code,
      name,
      contactPerson,
      phone,
      email,
      status,
      type,
      nicNo,
      businessEntityIdentifier,
      address,
      city,
      country,
      brNumber,
      documentUrl,
    } = req.body || {};

    const cleanName = String(name || '').trim();
    if (!cleanName) {
      res.status(400).json({ error: 'Company or Subcontractor name is required' });
      return;
    }

    const cleanBr = brNumber?.trim();

    // Check if partner with same BR Number already exists to prevent duplicate entries
    if (cleanBr) {
      const existingBr = await prisma.mF_G_BusinessPartner.findFirst({
        where: { brNumber: { equals: cleanBr, mode: 'insensitive' } },
        select: partnerSelectOptimized,
      });
      if (existingBr) {
        res.status(409).json({
          error: `A Business Partner with BR Number "${cleanBr}" is already enrolled (${existingBr.name} - ${existingBr.code}).`,
          existingPartner: {
            ...existingBr,
            employeeCount: existingBr._count.employees,
            equipmentCount: existingBr._count.equipment,
          },
        });
        return;
      }
    }

    const cleanStatus = status || 'active';
    let cleanCode = code ? String(code).trim().toUpperCase() : '';

    if (!cleanCode) {
      if (cleanStatus === 'pending_approval') {
        const tmpPartners = await prisma.mF_G_BusinessPartner.findMany({
          where: { code: { startsWith: 'BP-TMP-' } },
          select: { code: true },
        });
        let maxTmp = 0;
        for (const p of tmpPartners) {
          const num = parseInt(p.code.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num) && num > maxTmp) maxTmp = num;
        }
        let nextTmpNum = maxTmp + 1;
        cleanCode = `BP-TMP-${String(nextTmpNum).padStart(4, '0')}`;
        while (await prisma.mF_G_BusinessPartner.findUnique({ where: { code: cleanCode } })) {
          nextTmpNum++;
          cleanCode = `BP-TMP-${String(nextTmpNum).padStart(4, '0')}`;
        }
      } else {
        const regularPartners = await prisma.mF_G_BusinessPartner.findMany({
          where: { code: { startsWith: 'BP1' } },
          select: { code: true },
        });
        let maxBp = 1001000;
        for (const p of regularPartners) {
          const num = parseInt(p.code.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(num) && num > maxBp) maxBp = num;
        }
        let nextBpNum = maxBp + 1;
        cleanCode = `BP${nextBpNum}`;
        while (await prisma.mF_G_BusinessPartner.findUnique({ where: { code: cleanCode } })) {
          nextBpNum++;
          cleanCode = `BP${nextBpNum}`;
        }
      }
    }

    const partner = await prisma.mF_G_BusinessPartner.create({
      data: {
        code: cleanCode,
        name: cleanName,
        type: type ? String(type).trim() : null,
        nicNo: (nicNo || businessEntityIdentifier)?.trim() || null,
        brNumber: brNumber?.trim() || null,
        documentUrl: documentUrl?.trim() || null,
        address: address?.trim() || null,
        city: city?.trim() || null,
        country: country?.trim() || 'Sri Lanka',
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        status: cleanStatus,
      },
      select: partnerSelectOptimized,
    });

    const currentProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (req.headers['x-tenant-id'] as string) ||
      req.body?.projectId;

    if (currentProjectId && currentProjectId !== 'superadmin' && currentProjectId !== 'GLOBAL') {
      try {
        const linkId = crypto.randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO "MF_L_BUSINESS_PARTNER" ("id", "project_id", "business_partner_id", "status")
           VALUES ($1, $2, $3, 'active')
           ON CONFLICT ("project_id", "business_partner_id") DO NOTHING`,
          linkId,
          currentProjectId,
          partner.id
        );
      } catch (linkErr) {
        console.warn('Could not associate new partner with current site:', linkErr);
      }
    }

    res.status(201).json({
      ...partner,
      employeeCount: 0,
      equipmentCount: 0,
      siteWorkerCount: 0,
      siteEquipmentCount: 0,
      isActiveOnSite: false,
    });
  } catch (error: any) {
    console.error('Error creating business partner:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: `Business Partner with code ${req.body?.code || 'specified'} already exists` });
      return;
    }
    res.status(500).json({ error: 'Failed to create business partner' });
  }
};

// 5. PUT /api/business-partners/:id — Update business partner
export const updateBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const {
      name,
      contactPerson,
      phone,
      email,
      status,
      type,
      nicNo,
      businessEntityIdentifier,
      address,
      city,
      country,
      brNumber,
      documentUrl,
    } = req.body || {};

    const partner = await prisma.mF_G_BusinessPartner.update({
      where: { id },
      data: {
        name: name?.trim(),
        type: type !== undefined ? (type ? String(type).trim() : null) : undefined,
        nicNo: (nicNo !== undefined || businessEntityIdentifier !== undefined) ? ((nicNo || businessEntityIdentifier)?.trim() || null) : undefined,
        brNumber: brNumber !== undefined ? (brNumber?.trim() || null) : undefined,
        documentUrl: documentUrl !== undefined ? (documentUrl?.trim() || null) : undefined,
        address: address !== undefined ? (address?.trim() || null) : undefined,
        city: city !== undefined ? (city?.trim() || null) : undefined,
        country: country !== undefined ? (country?.trim() || 'Sri Lanka') : undefined,
        contactPerson: contactPerson?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        status: status || undefined,
      },
      select: partnerSelectOptimized,
    });

    const currentProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (req.headers['x-tenant-id'] as string);

    let siteWorkerCount = 0;
    let siteEquipmentCount = 0;

    if (currentProjectId && currentProjectId !== 'superadmin' && currentProjectId !== 'GLOBAL') {
      try {
        siteWorkerCount = await prisma.mF_P_Employee.count({
          where: { projectId: currentProjectId, status: 'active', businessPartnerId: id },
        });
        siteEquipmentCount = await prisma.mF_P_Equipment.count({
          where: { projectId: currentProjectId, status: 'active', ownerPartnerId: id },
        });
      } catch (err) {
        console.warn('Could not compute site counts for partner:', err);
      }
    }

    res.json({
      ...partner,
      employeeCount: partner._count.employees,
      equipmentCount: partner._count.equipment,
      siteWorkerCount,
      siteEquipmentCount,
      isActiveOnSite: Boolean(siteWorkerCount > 0 || siteEquipmentCount > 0),
    });
  } catch (error: any) {
    console.error('Error updating business partner:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update business partner' });
  }
};

// 6. DELETE /api/business-partners/:id — Delete business partner
export const deleteBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    // Check if any employees or equipment are linked
    const linkedEmployees = await prisma.mF_P_Employee.count({
      where: { businessPartnerId: id },
    });
    const linkedCorpEmployees = await prisma.mF_G_Employee.count({
      where: { corporateBusinessPartnerId: id },
    });
    const linkedEquipment = await prisma.mF_P_Equipment.count({
      where: { ownerPartnerId: id },
    });
    const linkedCorpEquipment = await prisma.mF_G_Equipment.count({
      where: { businessPartnerId: id },
    });

    const totalEq = linkedEquipment + linkedCorpEquipment;
    if (linkedEmployees > 0 || linkedCorpEmployees > 0 || totalEq > 0) {
      res.status(400).json({
        error: `Cannot delete: ${linkedEmployees + linkedCorpEmployees} employee(s) and ${totalEq} equipment unit(s) are assigned to this Business Partner.`,
      });
      return;
    }

    await prisma.mF_G_BusinessPartner.delete({
      where: { id },
    });

    res.json({ message: 'Business partner deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting business partner:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete business partner' });
  }
};

// 7. PATCH /api/business-partners/:id/status — Toggle status
export const toggleBusinessPartnerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { status } = req.body || {};

    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(400).json({ error: 'Valid status ("active" | "inactive") is required' });
      return;
    }

    const partner = await prisma.mF_G_BusinessPartner.update({
      where: { id },
      data: { status },
      select: partnerSelectOptimized,
    });

    const currentProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (req.headers['x-tenant-id'] as string);

    let siteWorkerCount = 0;
    let siteEquipmentCount = 0;

    if (currentProjectId && currentProjectId !== 'superadmin' && currentProjectId !== 'GLOBAL') {
      try {
        siteWorkerCount = await prisma.mF_P_Employee.count({
          where: { projectId: currentProjectId, status: 'active', businessPartnerId: id },
        });
        siteEquipmentCount = await prisma.mF_P_Equipment.count({
          where: { projectId: currentProjectId, status: 'active', ownerPartnerId: id },
        });
      } catch (err) {
        console.warn('Could not compute site counts for partner:', err);
      }
    }

    res.json({
      ...partner,
      employeeCount: partner._count.employees,
      equipmentCount: partner._count.equipment,
      siteWorkerCount,
      siteEquipmentCount,
      isActiveOnSite: Boolean(siteWorkerCount > 0 || siteEquipmentCount > 0),
    });
  } catch (error: any) {
    console.error('Error toggling business partner status:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// 8. GET /api/business-partners/catalog — Catalog for dropdowns/pickers
export const getCorporateBusinessPartnersCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.mF_G_BusinessPartner.findMany({
      where: { status: 'active' },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        contactPerson: true,
        phone: true,
        rating: true,
        status: true,
      },
      orderBy: { code: 'asc' },
    });
    res.json(list);
  } catch (error) {
    console.error('Error fetching corporate business partners catalog:', error);
    res.status(500).json({ error: 'Failed to fetch corporate business partners catalog' });
  }
};

// 9. GET /api/business-partners/pending — List partners pending Super Admin approval
export const getPendingBusinessPartners = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.mF_G_BusinessPartner.findMany({
      where: { status: 'pending_approval' },
      select: partnerSelectOptimized,
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      items: list.map((p) => ({
        ...p,
        employeeCount: p._count.employees,
        equipmentCount: p._count.equipment,
      })),
      total: list.length,
    });
  } catch (error) {
    console.error('Error fetching pending business partners:', error);
    res.status(500).json({ error: 'Failed to fetch pending business partners' });
  }
};

// 10. POST /api/business-partners/:id/approve — Super Admin approve partner & assign official code
export const approveBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { officialCode } = req.body || {};

    const existing = await prisma.mF_G_BusinessPartner.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }

    let finalCode = officialCode ? String(officialCode).trim().toUpperCase() : '';
    if (!finalCode || finalCode.startsWith('BP-TMP')) {
      const latest = await prisma.mF_G_BusinessPartner.findFirst({
        where: { code: { startsWith: 'BP1' } },
        select: { code: true },
        orderBy: { code: 'desc' },
      });
      const currentNum = latest ? parseInt(latest.code.replace(/[^0-9]/g, ''), 10) : 1001000;
      finalCode = `BP${(isNaN(currentNum) ? 1001000 : currentNum) + 1}`;
    }

    const updated = await prisma.mF_G_BusinessPartner.update({
      where: { id },
      data: {
        code: finalCode,
        status: 'active',
      },
      select: partnerSelectOptimized,
    });

    res.json({
      success: true,
      message: `Business Partner approved successfully. Official Code: ${finalCode}`,
      businessPartner: {
        ...updated,
        employeeCount: updated._count.employees,
        equipmentCount: updated._count.equipment,
      },
    });
  } catch (error: any) {
    console.error('Error approving business partner:', error);
    res.status(500).json({ error: error.message || 'Failed to approve business partner' });
  }
};

// 11. POST /api/business-partners/:id/reject — Super Admin reject business partner
export const rejectBusinessPartner = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { reason } = req.body || {};

    const existing = await prisma.mF_G_BusinessPartner.findUnique({
      where: { id },
    });
    if (!existing) {
      res.status(404).json({ error: 'Business partner not found' });
      return;
    }

    const updated = await prisma.mF_G_BusinessPartner.update({
      where: { id },
      data: {
        status: 'rejected',
      },
      select: partnerSelectOptimized,
    });

    res.json({
      success: true,
      message: 'Business partner registration rejected',
      reason: reason || null,
      businessPartner: updated,
    });
  } catch (error: any) {
    console.error('Error rejecting business partner:', error);
    res.status(500).json({ error: error.message || 'Failed to reject business partner' });
  }
};

// 12. POST /api/business-partners/assign-site — Assign partner(s) to this site
export const assignBusinessPartnerToSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const currentProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (req.headers['x-tenant-id'] as string) ||
      req.body?.projectId;

    if (!currentProjectId || currentProjectId === 'superadmin' || currentProjectId === 'GLOBAL') {
      res.status(400).json({ error: 'Valid site project ID is required' });
      return;
    }

    const { partnerId, partnerIds } = req.body || {};
    const ids: string[] = Array.isArray(partnerIds) ? partnerIds : partnerId ? [partnerId] : [];

    if (ids.length === 0) {
      res.status(400).json({ error: 'At least one business partner ID is required' });
      return;
    }

    let assignedCount = 0;
    for (const pId of ids) {
      const linkId = crypto.randomUUID();
      await prisma.$executeRawUnsafe(
        `INSERT INTO "MF_L_BUSINESS_PARTNER" ("id", "project_id", "business_partner_id", "status")
         VALUES ($1, $2, $3, 'active')
         ON CONFLICT ("project_id", "business_partner_id") DO UPDATE SET "status" = 'active'`,
        linkId,
        currentProjectId,
        pId
      );
      assignedCount++;
    }

    res.json({
      success: true,
      count: assignedCount,
      message: `Successfully assigned ${assignedCount} partner(s) to this site.`,
    });
  } catch (error) {
    console.error('Error assigning partner to site:', error);
    res.status(500).json({ error: 'Failed to assign partner to site' });
  }
};

// 13. DELETE /api/business-partners/:id/site-assignment — Unassign partner from this site
export const unassignBusinessPartnerFromSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const currentProjectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (req.headers['x-tenant-id'] as string);

    if (!currentProjectId || currentProjectId === 'superadmin' || currentProjectId === 'GLOBAL') {
      res.status(400).json({ error: 'Valid site project ID is required' });
      return;
    }

    // Check if partner has active employees or equipment on this site
    const activeEmployees = await prisma.mF_P_Employee.count({
      where: { projectId: currentProjectId, businessPartnerId: id, status: 'active' },
    });
    const activeEquipment = await prisma.mF_P_Equipment.count({
      where: { projectId: currentProjectId, ownerPartnerId: id, status: 'active' },
    });

    if (activeEmployees > 0 || activeEquipment > 0) {
      res.status(400).json({
        error: `Cannot remove partner: this partner currently has ${activeEmployees} active worker(s) and ${activeEquipment} active equipment assigned on this site.`,
      });
      return;
    }

    await prisma.$executeRawUnsafe(
      `DELETE FROM "MF_L_BUSINESS_PARTNER" WHERE "project_id" = $1 AND "business_partner_id" = $2`,
      currentProjectId,
      id
    );

    res.json({ success: true, message: 'Partner removed from this site successfully' });
  } catch (error) {
    console.error('Error unassigning partner from site:', error);
    res.status(500).json({ error: 'Failed to remove partner from site' });
  }
};

