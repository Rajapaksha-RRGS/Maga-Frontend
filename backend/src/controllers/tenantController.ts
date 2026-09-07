import { Request, Response } from 'express';
import prisma from '../config/prisma';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

function formatTenant(t: any) {
  return {
    id: t.id,
    company_name: t.companyName,
    subdomain: t.subdomain,
    address_line1: t.addressLine1 || '',
    address_line2: t.addressLine2 || '',
    phone: t.phone || '',
    fax: t.fax || '',
    email: t.email || '',
    status: t.status || 'active',
  };
}

// 1. GET /api/tenants/:id
export const getTenantById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const tenant = await prisma.tenant.findUnique({
      where: { id },
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

// 2. GET /api/tenants/by-subdomain/:subdomain
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
