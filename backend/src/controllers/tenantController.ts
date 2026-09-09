import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
  let pw = '';
  for (let i = 0; i < 10; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

function formatTenant(t: any) {
  return {
    id: t.id,
    company_name: t.companyName,
    companyName: t.companyName,
    subdomain: t.subdomain,
    address_line1: t.addressLine1 || '',
    addressLine1: t.addressLine1 || '',
    address_line2: t.addressLine2 || '',
    addressLine2: t.addressLine2 || '',
    phone: t.phone || '',
    fax: t.fax || '',
    email: t.email || '',
    status: t.status || 'active',
    createdAt: t.createdAt,
  };
}

// 1. GET /api/tenants — List all tenants with admin details
export const getAllTenants = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tenants = await prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            users: true,
            employees: true,
            assignments: true,
          },
        },
      },
    });

    const formatted = tenants.map((t) => {
      const adminUsers = t.users.filter((u) => u.role === 'admin');
      const primaryAdmin = adminUsers[0] || null;
      return {
        id: t.id,
        companyName: t.companyName,
        company_name: t.companyName,
        subdomain: t.subdomain,
        addressLine1: t.addressLine1 || '',
        address_line1: t.addressLine1 || '',
        addressLine2: t.addressLine2 || '',
        address_line2: t.addressLine2 || '',
        phone: t.phone || '',
        fax: t.fax || '',
        email: t.email || '',
        status: t.status || 'active',
        createdAt: t.createdAt,
        userCount: t._count.users,
        employeeCount: t._count.employees,
        primaryAdmin: primaryAdmin
          ? {
              id: primaryAdmin.id,
              username: primaryAdmin.username,
              fullName: primaryAdmin.fullName,
              status: primaryAdmin.status,
            }
          : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching all tenants:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
};

// 2. GET /api/tenants/:id
export const getTenantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            status: true,
          },
        },
      },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json(formatTenant(tenant));
  } catch (error) {
    console.error('Error fetching tenant by ID:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
};

// 3. GET /api/tenants/by-subdomain/:subdomain
export const getTenantBySubdomain = async (req: Request, res: Response): Promise<void> => {
  try {
    const subdomain = getParam(req.params.subdomain).toLowerCase().trim();
    const tenant = await prisma.tenant.findUnique({
      where: { subdomain },
    });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.json(formatTenant(tenant));
  } catch (error) {
    console.error('Error fetching tenant by subdomain:', error);
    res.status(500).json({ error: 'Failed to fetch tenant' });
  }
};

// 4. POST /api/tenants/register — Register new tenant & initial admin
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
    } = req.body;

    if (!companyName?.trim() || !subdomain?.trim() || !adminFullName?.trim() || !adminUsername?.trim()) {
      res.status(400).json({
        error: 'Project name, project code (M-Code), admin full name, and admin username are required.',
      });
      return;
    }

    const cleanSubdomain = subdomain.toUpperCase().trim().replace(/[^A-Z0-9-]/g, '');
    if (!cleanSubdomain) {
      res.status(400).json({ error: 'Invalid project code format. Use letters, numbers, and hyphens only (e.g. 531M, M00000403).' });
      return;
    }

    // Check if project code exists
    const existing = await prisma.tenant.findUnique({
      where: { subdomain: cleanSubdomain },
    });
    if (existing) {
      res.status(409).json({ error: `Project code "${cleanSubdomain}" is already registered.` });
      return;
    }

    // Password to use
    const passwordToUse = adminPassword?.trim() || generateTempPassword();
    const passwordHash = await bcrypt.hash(passwordToUse, 10);

    const result = await prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          companyName: companyName.trim(),
          subdomain: cleanSubdomain,
          addressLine1: addressLine1?.trim() || null,
          addressLine2: addressLine2?.trim() || null,
          phone: phone?.trim() || null,
          fax: fax?.trim() || null,
          email: email?.trim() || null,
          status: 'active',
        },
      });

      const adminUser = await tx.user.create({
        data: {
          tenantId: tenant.id,
          username: adminUsername.trim().toLowerCase(),
          fullName: adminFullName.trim(),
          passwordHash,
          role: 'admin',
          status: 'active',
          mustChangePassword: true,
        },
      });

      return { tenant, adminUser };
    });

    res.status(201).json({
      message: 'Tenant and Admin created successfully',
      tenant: {
        id: result.tenant.id,
        companyName: result.tenant.companyName,
        company_name: result.tenant.companyName,
        subdomain: result.tenant.subdomain,
        addressLine1: result.tenant.addressLine1 || '',
        address_line1: result.tenant.addressLine1 || '',
        addressLine2: result.tenant.addressLine2 || '',
        address_line2: result.tenant.addressLine2 || '',
        phone: result.tenant.phone || '',
        fax: result.tenant.fax || '',
        email: result.tenant.email || '',
        status: result.tenant.status,
        createdAt: result.tenant.createdAt,
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

// 5. PUT /api/tenants/:id — Update tenant details
export const updateTenant = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { companyName, addressLine1, addressLine2, phone, fax, email } = req.body;

    if (!companyName?.trim()) {
      res.status(400).json({ error: 'Company name is required.' });
      return;
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        companyName: companyName.trim(),
        addressLine1: addressLine1?.trim() || null,
        addressLine2: addressLine2?.trim() || null,
        phone: phone?.trim() || null,
        fax: fax?.trim() || null,
        email: email?.trim() || null,
      },
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
    const { status } = req.body;

    if (!status || !['active', 'suspended'].includes(status)) {
      res.status(400).json({ error: 'Status must be either "active" or "suspended".' });
      return;
    }

    const updated = await prisma.tenant.update({
      where: { id },
      data: { status },
    });

    res.json(formatTenant(updated));
  } catch (error) {
    console.error('Error updating tenant status:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
};

// 7. POST /api/tenants/:id/reset-admin-password — Reset admin password for a tenant
export const resetTenantAdminPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = getParam(req.params.id);
    const adminUser = await prisma.user.findFirst({
      where: { tenantId, role: 'admin' },
    });

    if (!adminUser) {
      res.status(404).json({ error: 'Admin user not found for this tenant.' });
      return;
    }

    const newTempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(newTempPassword, 10);

    await prisma.user.update({
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
