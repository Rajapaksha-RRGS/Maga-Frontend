import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pw = 'ERP@';
  for (let i = 0; i <= 4; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function formatTenant(t: any) {
  const primaryAdmin = t.users && t.users.length > 0 ? {
    id: t.users[0].id,
    username: t.users[0].username,
    fullName: t.users[0].fullName,
    status: t.users[0].status,
  } : null;

  return {
    id: t.id,
    projectCode: t.projectCode,
    project_code: t.projectCode,
    projectName: t.projectName,
    project_name: t.projectName,
    company_name: t.projectName,   // Frontend compatibility
    companyName: t.projectName,    // Frontend compatibility
    subdomain: t.subdomain || t.projectCode,
    address_line1: t.addressLine1 || '',
    addressLine1: t.addressLine1 || '',
    address_line2: t.addressLine2 || '',
    addressLine2: t.addressLine2 || '',
    phone: t.phone || '',
    fax: t.fax || '',
    email: t.email || '',
    status: t.status || 'active',
    equipmentAssignBySupervisor: t.equipmentAssignBySupervisor ?? false,
    laborAssignBySupervisor: (t as any).laborAssignBySupervisor ?? false,
    operatorAssignBySupervisor: (t as any).operatorAssignBySupervisor ?? false,
    lunchBreakEnabled: t.lunchBreakEnabled ?? true,
    lunchStartTime: t.lunchStartTime || '12:00',
    lunchEndTime: t.lunchEndTime || '13:00',
    lunchDurationHours: t.lunchDurationHours ? Number(t.lunchDurationHours) : 1.0,
    dinnerBreakEnabled: t.dinnerBreakEnabled ?? true,
    dinnerStartTime: t.dinnerStartTime || '22:00',
    dinnerEndTime: t.dinnerEndTime || '23:00',
    dinnerDurationHours: t.dinnerDurationHours ? Number(t.dinnerDurationHours) : 1.0,
    createdAt: t.createdAt,
    userCount: t._count?.users ?? 0,
    employeeCount: t._count?.employees ?? 0,
    primaryAdmin,
  };
}


async function attachPoolModes(tenant: any, id: string) {
  try {
    const rows: any = await prisma.$queryRawUnsafe(
      'SELECT labor_assign_by_supervisor, operator_assign_by_supervisor, equipment_assign_by_supervisor FROM "MF_PROJECT" WHERE "project_id" = $1',
      id
    );
    if (rows && rows.length > 0) {
      tenant.laborAssignBySupervisor = Boolean(rows[0].labor_assign_by_supervisor);
      tenant.operatorAssignBySupervisor = Boolean(rows[0].operator_assign_by_supervisor);
      tenant.equipmentAssignBySupervisor = Boolean(rows[0].equipment_assign_by_supervisor);
    }
  } catch (err) {
    // fallback
  }
  return tenant;
}

// Common optimized projection for Project / Tenant queries
const projectSelectOptimized = {
  id: true,
  projectCode: true,
  projectName: true,
  subdomain: true,
  addressLine1: true,
  addressLine2: true,
  phone: true,
  fax: true,
  email: true,
  status: true,
  equipmentAssignBySupervisor: true,
  lunchBreakEnabled: true,
  lunchStartTime: true,
  lunchEndTime: true,
  lunchDurationHours: true,
  dinnerBreakEnabled: true,
  dinnerStartTime: true,
  dinnerEndTime: true,
  dinnerDurationHours: true,
  createdAt: true,
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
    },
  },
};

// 1. GET /api/tenants — List all projects/tenants with primary admin & counts
export const getAllTenants = async (_req: Request, res: Response): Promise<void> => {
  try {
    const projects = await prisma.mF_P_Project.findMany({
      orderBy: { createdAt: 'desc' },
      select: projectSelectOptimized,
    });

    const formatted = projects.map(formatTenant);
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching all tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
};

// 2. GET /api/tenants/:id — Fetch single project/tenant by ID
export const getTenantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const project = await prisma.mF_P_Project.findUnique({
      where: { id },
      select: projectSelectOptimized,
    });

    if (!project) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const formatted = formatTenant(project);
    await attachPoolModes(formatted, id);
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching tenant by ID:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
};

// 3. GET /api/tenants/by-subdomain/:subdomain — Fetch by subdomain or projectCode
export const getTenantBySubdomain = async (req: Request, res: Response): Promise<void> => {
  try {
    const subdomain = getParam(req.params.subdomain).toLowerCase().trim();
    const project = await prisma.mF_P_Project.findFirst({
      where: {
        OR: [
          { subdomain: { equals: subdomain, mode: 'insensitive' } },
          { projectCode: { equals: subdomain, mode: 'insensitive' } },
          { projectCode: { equals: `PRJ${subdomain}`, mode: 'insensitive' } },
        ],
      },
      select: projectSelectOptimized,
    });

    if (!project) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const formatted = formatTenant(project);
    await attachPoolModes(formatted, project.id);
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching tenant by subdomain:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
};

// 4. POST /api/tenants/register — Register new project/tenant & initial admin
export const registerTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      companyName,
      subdomain,
      addressLine1,
      addressLine2,
      phone,
      fax,
      email,
      adminFullName,
      adminUsername,
      adminPassword,
    } = req.body || {};

    if (!companyName?.trim() || !subdomain?.trim() || !adminFullName?.trim() || !adminUsername?.trim()) {
      res.status(400).json({
        error: 'Project name, project code (M-Code), admin full name, and admin username are required.',
      });
      return;
    }

    const cleanSubdomain = subdomain.trim();
    if (!cleanSubdomain) {
      res.status(400).json({ error: 'Invalid project code format.' });
      return;
    }

    // Check if project code or subdomain already exists (indexed unique check)
    const existing = await prisma.mF_P_Project.findFirst({
      where: {
        OR: [
          { subdomain: { equals: cleanSubdomain, mode: 'insensitive' } },
          { projectCode: { equals: cleanSubdomain, mode: 'insensitive' } },
        ],
      },
      select: { id: true },
    });
    if (existing) {
      res.status(409).json({ error: `Project code or subdomain "${cleanSubdomain}" is already registered.` });
      return;
    }

    const isCustomPassword = Boolean(adminPassword && adminPassword.trim().length > 0);
    const passwordToUse = isCustomPassword ? adminPassword!.trim() : generateTempPassword();
    const passwordHash = await bcrypt.hash(passwordToUse, 10);

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.mF_P_Project.create({
        data: {
          projectCode: cleanSubdomain,
          projectName: companyName.trim(),
          subdomain: cleanSubdomain.toLowerCase(),
          addressLine1: addressLine1?.trim() || null,
          addressLine2: addressLine2?.trim() || null,
          phone: phone?.trim() || null,
          fax: fax?.trim() || null,
          email: email?.trim() || null,
          status: 'active',
        },
      });

      const adminUser = await tx.mF_P_User.create({
        data: {
          projectId: project.id,
          username: adminUsername.trim().toLowerCase(),
          fullName: adminFullName.trim(),
          passwordHash,
          role: 'admin',
          status: 'active',
          mustChangePassword: !isCustomPassword,
        },
      });

      return { project, adminUser };
    });

    res.status(201).json({
      message: 'Tenant and Admin created successfully',
      tenant: {
        id: result.project.id,
        projectCode: result.project.projectCode,
        projectName: result.project.projectName,
        companyName: result.project.projectName,
        company_name: result.project.projectName,
        subdomain: result.project.subdomain,
        addressLine1: result.project.addressLine1 || '',
        address_line1: result.project.addressLine1 || '',
        addressLine2: result.project.addressLine2 || '',
        address_line2: result.project.addressLine2 || '',
        phone: result.project.phone || '',
        fax: result.project.fax || '',
        email: result.project.email || '',
        status: result.project.status,
        createdAt: result.project.createdAt,
        userCount: 1,
        employeeCount: 0,
        primaryAdmin: {
          id: result.adminUser.id,
          username: result.adminUser.username,
          fullName: result.adminUser.fullName,
          status: result.adminUser.status,
        },
      },
      tempPassword: passwordToUse,
    });
  } catch (error: any) {
    console.error('Error registering tenant:', error);
    res.status(500).json({ error: error.message || 'Failed to register tenant and admin' });
  }
};

// 5. PUT /api/tenants/:id — Update project/tenant details
export const updateTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { companyName, addressLine1, addressLine2, phone, fax, email } = req.body || {};

    if (!companyName?.trim()) {
      res.status(400).json({ error: 'Company name is required.' });
      return;
    }

    const updated = await prisma.mF_P_Project.update({
      where: { id },
      data: {
        projectName: companyName.trim(),
        addressLine1: addressLine1?.trim() || null,
        addressLine2: addressLine2?.trim() || null,
        phone: phone?.trim() || null,
        fax: fax?.trim() || null,
        email: email?.trim() || null,
      },
      select: projectSelectOptimized,
    });

    res.json(formatTenant(updated));
  } catch (error) {
    console.error('Error updating tenant:', error);
    res.status(500).json({ error: 'Failed to update tenant' });
  }
};

// 6. PATCH /api/tenants/:id/status — Toggle active / suspended status
export const updateTenantStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { status } = req.body || {};

    if (!status || !['active', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Status must be either "active" or "suspended".' });
      return;
    }

    const updated = await prisma.mF_P_Project.update({
      where: { id },
      data: { status },
      select: projectSelectOptimized,
    });

    res.json(formatTenant(updated));
  } catch (error) {
    console.error('Error updating tenant status:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
};

// 7. POST /api/tenants/:id/reset-admin-password — Reset admin password for a tenant/project
export const resetTenantAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getParam(req.params.id);
    const adminUser = await prisma.mF_P_User.findFirst({
      where: { projectId: tenantId, role: 'admin' },
      select: { id: true, fullName: true, username: true },
    });

    if (!adminUser) {
      res.status(404).json({ error: 'Admin user not found for this tenant.' });
      return;
    }

    const newTempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(newTempPassword, 10);

    await prisma.mF_P_User.update({
      where: { id: adminUser.id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
    });

    res.json({
      message: 'Admin password reset successfully',
      adminName: adminUser.fullName,
      username: adminUser.username,
      tempPassword: newTempPassword,
    });
  } catch (error) {
    console.error('Error resetting tenant admin password:', error);
    res.status(500).json({ error: 'Failed to reset admin password' });
  }
};

// 8. GET /api/tenants/corporate-projects — Get all corporate projects catalog for dropdown/picker
export const getCorporateProjectsCatalog = async (_req: Request, res: Response): Promise<void> => {
  try {
    const list = await prisma.mF_P_Project.findMany({
      orderBy: { projectCode: 'asc' },
      select: {
        id: true,
        projectCode: true,
        projectName: true,
        description: true,
        searchKey: true,
        projectManager: true,
        addressCode: true,
        enterpriseUnit: true,
        currency: true,
        status: true,
        equipmentAssignBySupervisor: true,
      },
    });
    res.json(list);
  } catch (error) {
    console.error('Error fetching corporate projects catalog:', error);
    res.status(500).json({ error: 'Failed to fetch corporate projects catalog' });
  }
};

// 9. PATCH /api/tenants/:id/equipment-mode — Toggle equipmentAssignBySupervisor mode
export const updateEquipmentAssignMode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { equipmentAssignBySupervisor } = req.body || {};
    if (typeof equipmentAssignBySupervisor !== 'boolean') {
      res.status(400).json({ error: 'equipmentAssignBySupervisor must be a boolean (true/false).' });
      return;
    }

    await prisma.$executeRawUnsafe(
      'UPDATE "MF_PROJECT" SET "equipment_assign_by_supervisor" = $1 WHERE "project_id" = $2',
      equipmentAssignBySupervisor,
      id
    );

    const updated = await prisma.mF_P_Project.findUnique({
      where: { id },
      select: projectSelectOptimized,
    });

    if (!updated) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const formatted = formatTenant(updated);
    await attachPoolModes(formatted, id);
    res.json(formatted);
  } catch (error) {
    console.error('Error updating equipment assignment mode:', error);
    res.status(500).json({ error: 'Failed to update equipment assignment mode' });
  }
};

// 10. PATCH /api/tenants/:id/pool-modes — Toggle labor, operator, equipment pool modes independently
export const updatePoolModes = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { laborAssignBySupervisor, operatorAssignBySupervisor, equipmentAssignBySupervisor } = req.body || {};

    if (
      typeof laborAssignBySupervisor !== 'boolean' &&
      typeof operatorAssignBySupervisor !== 'boolean' &&
      typeof equipmentAssignBySupervisor !== 'boolean'
    ) {
      res.status(400).json({ error: 'At least one pool mode boolean must be provided.' });
      return;
    }

    if (typeof laborAssignBySupervisor === 'boolean') {
      await prisma.$executeRawUnsafe(
        'UPDATE "MF_PROJECT" SET "labor_assign_by_supervisor" = $1 WHERE "project_id" = $2',
        laborAssignBySupervisor,
        id
      );
    }
    if (typeof operatorAssignBySupervisor === 'boolean') {
      await prisma.$executeRawUnsafe(
        'UPDATE "MF_PROJECT" SET "operator_assign_by_supervisor" = $1 WHERE "project_id" = $2',
        operatorAssignBySupervisor,
        id
      );
    }
    if (typeof equipmentAssignBySupervisor === 'boolean') {
      await prisma.$executeRawUnsafe(
        'UPDATE "MF_PROJECT" SET "equipment_assign_by_supervisor" = $1 WHERE "project_id" = $2',
        equipmentAssignBySupervisor,
        id
      );
    }

    const updated = await prisma.mF_P_Project.findUnique({
      where: { id },
      select: projectSelectOptimized,
    });

    if (!updated) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    const formatted = formatTenant(updated);
    await attachPoolModes(formatted, id);
    res.json(formatted);
  } catch (error) {
    console.error('Error updating pool modes:', error);
    res.status(500).json({ error: 'Failed to update pool modes' });
  }
};

// 11. PATCH /api/tenants/:id/meal-settings — Update site meal break policies
export const updateMealSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const {
      lunchBreakEnabled,
      lunchStartTime,
      lunchEndTime,
      lunchDurationHours,
      dinnerBreakEnabled,
      dinnerStartTime,
      dinnerEndTime,
      dinnerDurationHours,
    } = req.body || {};

    const dataToUpdate: any = {};
    if (typeof lunchBreakEnabled === 'boolean') dataToUpdate.lunchBreakEnabled = lunchBreakEnabled;
    if (typeof lunchStartTime === 'string') dataToUpdate.lunchStartTime = lunchStartTime;
    if (typeof lunchEndTime === 'string') dataToUpdate.lunchEndTime = lunchEndTime;
    if (lunchDurationHours !== undefined) dataToUpdate.lunchDurationHours = Number(lunchDurationHours);

    if (typeof dinnerBreakEnabled === 'boolean') dataToUpdate.dinnerBreakEnabled = dinnerBreakEnabled;
    if (typeof dinnerStartTime === 'string') dataToUpdate.dinnerStartTime = dinnerStartTime;
    if (typeof dinnerEndTime === 'string') dataToUpdate.dinnerEndTime = dinnerEndTime;
    if (dinnerDurationHours !== undefined) dataToUpdate.dinnerDurationHours = Number(dinnerDurationHours);

    const updated = await prisma.mF_P_Project.update({
      where: { id },
      data: dataToUpdate,
      select: projectSelectOptimized,
    });

    const formatted = formatTenant(updated);
    await attachPoolModes(formatted, id);
    res.json(formatted);
  } catch (error: any) {
    console.error('Error updating meal settings:', error);
    res.status(500).json({ error: error.message || 'Failed to update site meal settings' });
  }
};


