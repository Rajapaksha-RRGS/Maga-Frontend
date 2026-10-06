import { Request, Response, NextFunction } from 'express';
import prisma from '../config/prisma';

declare global {
  namespace Express {
    interface Request {
      resolvedTenantId?: string;
      resolvedProjectId?: string;
    }
  }
}

export const resolveTenantMiddleware = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  if (req.path.includes('/auth/')) {
    return next();
  }

  try {
    const rawId =
      (req.headers['x-tenant-id'] as string) ||
      (req.headers['x-project-id'] as string) ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (req.body && req.body.tenantId) ||
      (req.body && req.body.projectId);

    if (rawId && typeof rawId === 'string' && rawId.trim()) {
      const clean = rawId.trim();

      // Check if it matches a Tenant UUID directly 
      const project = await prisma.project.findFirst({
        where: {
          OR: [
            { id: clean },
            { projectCode: { equals: clean, mode: 'insensitive' } },
            { subdomain: { equals: clean, mode: 'insensitive' } },
          ],
        },
        select: { id: true },
      });

      if (project) {
        req.resolvedTenantId = project.id;
        req.resolvedProjectId = project.id;  
        if (req.query) req.query.tenantId = project.id;
        if (req.body && typeof req.body === 'object') req.body.tenantId = project.id;
      }
    }
    next()
  } catch (error) {
    console.error('Error in resolveTenantMiddleware:', error);
    next();
  }
};
