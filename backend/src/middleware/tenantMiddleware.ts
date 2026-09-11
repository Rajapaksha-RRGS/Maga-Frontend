import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

// Extend Express Request to hold resolved tenant info
declare global {
  namespace Express {
    interface Request {
      resolvedTenantId?: string;
    }
  }
}

let defaultTenantIdCache: string | null = null;

export const getDefaultTenantId = async (): Promise<string> => {
  if (defaultTenantIdCache) return defaultTenantIdCache;
  const tenant = await prisma.tenant.upsert({
    where: { subdomain: 'maga' },
    update: {},
    create: {
      companyName: 'Mäga Engineering (Pvt) Ltd',
      subdomain: 'maga',
      addressLine1: '200, Nawala Road',
      addressLine2: 'Narahenpita, Colombo 05',
      phone: '+94 11 2808835',
      email: 'info@maga.lk',
      status: 'active',
    },
  });
  defaultTenantIdCache = tenant.id;
  return tenant.id;
};

/**
 * Resolve tenant ID from:
 * 1. x-tenant-id header (UUID or subdomain)
 * 2. req.query.tenantId
 * 3. req.body.tenantId
 * 4. Fallback to default 'maga' tenant
 */
export const resolveTenantMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  // Never intercept auth endpoints so login credentials are not mutated
  if (req.path.includes('/auth/')) {
    return next();
  }

  try {
    const rawTenantId =
      (req.headers['x-tenant-id'] as string) ||
      (req.query.tenantId as string) ||
      (req.body && req.body.tenantId);

    if (rawTenantId && typeof rawTenantId === 'string' && rawTenantId.trim()) {
      const clean = rawTenantId.trim();

      // Check if it matches a Tenant UUID directly
      const tenantById = await prisma.tenant.findUnique({
        where: { id: clean },
        select: { id: true },
      });

      if (tenantById) {
        req.resolvedTenantId = tenantById.id;
        // Also ensure req.query and req.body have the exact UUID
        if (req.query) req.query.tenantId = tenantById.id;
        if (req.body && typeof req.body === 'object') req.body.tenantId = tenantById.id;
        return next();
      }

      // Check if it's a subdomain (e.g. '521M', '531M', 'maga')
      const tenantBySubdomain = await prisma.tenant.findFirst({
        where: { subdomain: { equals: clean, mode: 'insensitive' } },
        select: { id: true },
      });

      if (tenantBySubdomain) {
        req.resolvedTenantId = tenantBySubdomain.id;
        if (req.query) req.query.tenantId = tenantBySubdomain.id;
        if (req.body && typeof req.body === 'object') req.body.tenantId = tenantBySubdomain.id;
        return next();
      }
    }

    // Fallback to default tenant (Head Office / maga)
    const fallbackId = await getDefaultTenantId();
    req.resolvedTenantId = fallbackId;
    if (req.query && !req.query.tenantId) req.query.tenantId = fallbackId;
    if (req.body && typeof req.body === 'object' && !req.body.tenantId) req.body.tenantId = fallbackId;
    next();
  } catch (error) {
    console.error('Error in resolveTenantMiddleware:', error);
    next();
  }
};
