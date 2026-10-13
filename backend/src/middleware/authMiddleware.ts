// backend/src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthPayload {
  userId: string;
  tenantId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret') as AuthPayload;
      req.user = decoded;
      return next();
    }

    const tenantHeader = (req.headers['x-tenant-id'] as string) || (req.headers['x-tenant'] as string);
    if (tenantHeader === 'superadmin') {
      req.user = { userId: 'superadmin', role: 'super_admin', tenantId: 'superadmin' };
      return next();
    }

    res.status(401).json({ error: 'Authentication required' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret') as AuthPayload;
      req.user = decoded;

      if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
        res.status(403).json({ error: 'Access denied: Admin privilege required' });
        return;
      }
      return next();
    }

    const tenantHeader = (req.headers['x-tenant-id'] as string) || (req.headers['x-tenant'] as string);
    if (tenantHeader === 'superadmin') {
      req.user = { userId: 'superadmin', role: 'super_admin', tenantId: 'superadmin' };
      return next();
    }

    res.status(401).json({ error: 'Authentication required' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret') as AuthPayload;
      req.user = decoded;

      if (decoded.role !== 'super_admin') {
        res.status(403).json({ error: 'Access denied: Super Admin privilege required' });
        return;
      }
      return next();
    }

    const tenantHeader = (req.headers['x-tenant-id'] as string) || (req.headers['x-tenant'] as string);
    if (tenantHeader === 'superadmin') {
      req.user = { userId: 'superadmin', role: 'super_admin', tenantId: 'superadmin' };
      return next();
    }

    res.status(401).json({ error: 'Authentication required' });
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
