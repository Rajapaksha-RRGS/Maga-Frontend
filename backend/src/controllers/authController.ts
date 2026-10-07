import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

const SECRET_KEY = process.env.JWT_SECRET || 'supersecret';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { tenantId, username, password } = req.body || {};

    // Validation
    if (!tenantId || !username || !password) {
      res.status(400).json({ error: 'Please provide tenant, username and password' });
      return;
    }

    const cleanTenant = String(tenantId).trim();
    const cleanUsername = String(username).trim().toLowerCase();

    // Support SuperAdmin global login
    if (cleanTenant.toLowerCase() === 'superadmin' || cleanTenant.toLowerCase() === 'system') {
      const superAdmin = await prisma.superAdmin.findFirst({
        where: {
          OR: [
            { username: { equals: cleanUsername, mode: 'insensitive' } },
            { email: { equals: cleanUsername, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          username: true,
          fullName: true,
          passwordHash: true,
          status: true,
        },
      });

      if (superAdmin && superAdmin.status === 'active') {
        const isMatch = await bcrypt.compare(password, superAdmin.passwordHash);
        if (isMatch) {
          const token = jwt.sign(
            {
              userId: superAdmin.id,
              tenantId: 'GLOBAL',
              projectId: 'GLOBAL',
              role: 'super_admin',
              fullName: superAdmin.fullName,
              companyName: 'Head Office',
            },
            SECRET_KEY,
            { expiresIn: '8h' }
          );

          res.json({
            success: true,
            message: 'SuperAdmin Login Successful',
            token,
            user: {
              id: superAdmin.id,
              username: superAdmin.username,
              fullName: superAdmin.fullName,
              role: 'super_admin',
              tenantId: 'GLOBAL',
              projectId: 'GLOBAL',
              companyName: 'Head Office',
            },
          });
          return;
        }
      }
    }

    // 1. Optimized Project/Tenant lookup with selective projection
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { id: cleanTenant },
          { projectCode: { equals: cleanTenant, mode: 'insensitive' } },
          { subdomain: { equals: cleanTenant, mode: 'insensitive' } },
          { subdomain: { equals: `${cleanTenant}M`, mode: 'insensitive' } },
          { subdomain: { equals: cleanTenant.replace(/M$/i, ''), mode: 'insensitive' } },
          { projectName: { contains: cleanTenant, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        projectCode: true,
        projectName: true,
        subdomain: true,
        status: true,
      },
    });

    if (!project || project.status !== 'active') {
      res.status(400).json({ error: 'Invalid or inactive project/tenant' });
      return;
    }

    // 2. Optimized User lookup: leverages @@unique([projectId, username])
    const user = await prisma.user.findFirst({
      where: {
        projectId: project.id,
        username: { equals: cleanUsername, mode: 'insensitive' },
      },
      select: {
        id: true,
        projectId: true,
        username: true,
        fullName: true,
        role: true,
        status: true,
        passwordHash: true,
        mustChangePassword: true,
        employeeId: true,
        phone: true,
      },
    });

    if (!user || user.status !== 'active') {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // 3. Password comparison
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    // 4. JWT generation
    const token = jwt.sign(
      {
        userId: user.id,
        tenantId: project.id,
        projectId: project.id,
        role: user.role,
        fullName: user.fullName,
        companyName: project.projectName,
      },
      SECRET_KEY,
      { expiresIn: '8h' }
    );

    const { passwordHash: _hash, ...safeUser } = user;

    res.json({
      success: true,
      message: 'Login Successful',
      token,
      user: {
        ...safeUser,
        tenantId: project.id,
        projectId: project.id,
        companyName: project.projectName,
        projectName: project.projectName,
      },
    });
  } catch (error) {
    console.error('Login failed:', error);
    res.status(500).json({ error: 'Internal server error during login' });
  }
};