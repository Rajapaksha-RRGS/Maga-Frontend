import { Request, Response } from "express";
import bcrypt from "bcrypt";
import prisma from "../config/prisma";
import { getDefaultTenantId } from "./employeeController";

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) {
    pw += chars[Math.floor(Math.random() * chars.length)];
  }
  return pw;
}

export const getSupervisorActiveSite = async (req: Request, res: Response): Promise<void> => {
  try {
    const supervisorId = (req.query.supervisorId as string) || (req.query.userId as string);
    let tenantId = (req.query.tenantId as string);

    if (!tenantId && supervisorId) {
      const user = await prisma.user.findUnique({
        where: { id: supervisorId },
        select: { tenantId: true },
      });
      if (user) {
        tenantId = user.tenantId;
      }
    }

    if (!tenantId) {
      tenantId = req.resolvedTenantId || (await getDefaultTenantId());
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      res.status(404).json({ error: "Tenant/Site not found" });
      return;
    }

    const corporateProjects = await prisma.corporateProject.findMany({
      where: { status: 'Active' },
      orderBy: { projectCode: 'asc' },
    });

    const cleanSubdomain = tenant.subdomain.trim().toLowerCase();
    const cleanSubdomainNum = cleanSubdomain.replace(/[^0-9]/g, '');

    let matchedCorp = corporateProjects.find((cp) => {
      const pCodeLower = cp.projectCode.toLowerCase();
      return (
        pCodeLower === cleanSubdomain ||
        pCodeLower.includes(cleanSubdomain) ||
        cleanSubdomain.includes(pCodeLower) ||
        (cleanSubdomainNum && cleanSubdomainNum.length > 0 && pCodeLower.includes(cleanSubdomainNum))
      );
    });

    if (!matchedCorp) {
      matchedCorp = corporateProjects.find((cp) => {
        const pNameLower = (cp.projectName || cp.description).toLowerCase();
        const cNameLower = tenant.companyName.toLowerCase();
        return pNameLower.includes(cNameLower) || cNameLower.includes(pNameLower);
      });
    }

    const activeSite = {
      id: tenant.id,
      name: matchedCorp?.projectName || matchedCorp?.description || tenant.companyName,
      code: matchedCorp?.projectCode || (tenant.subdomain.toUpperCase().startsWith('M') ? tenant.subdomain.toUpperCase() : `M00000${tenant.subdomain.toUpperCase()}`),
      location: matchedCorp?.addressCode || tenant.addressLine1 || tenant.addressLine2 || 'Site Base Office',
      projectManager: matchedCorp?.projectManager ? `Eng. ${matchedCorp.projectManager}` : 'Eng. Project Lead',
    };

    const availableSites = corporateProjects.map((cp) => ({
      id: cp.id,
      name: cp.projectName || cp.description,
      code: cp.projectCode,
      location: cp.addressCode || 'Sri Lanka',
      projectManager: cp.projectManager ? `Eng. ${cp.projectManager}` : 'Eng. Project Lead',
    }));

    res.json({
      activeSite,
      availableSites: availableSites.length > 0 ? availableSites : [activeSite],
    });
  } catch (error) {
    console.error("Error fetching supervisor active site:", error);
    res.status(500).json({ error: "Failed to fetch supervisor active site" });
  }
};

export const getAllSupervisors = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());

    if (!tenantId) {
      res.status(401).json({ message: "Unauthorized: No tenantId found" });
      return;
    }

    const supervisors = await prisma.user.findMany({
      where: {
        tenantId,
        role: 'supervisor',
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        status: true,
        employeeId: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Populate linked employee names if any
    const employeeIds = supervisors
      .map((s) => s.employeeId)
      .filter(Boolean) as string[];

    let empMap = new Map<string, string>();
    if (employeeIds.length > 0) {
      const employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, callingName: true, fullName: true },
      });
      employees.forEach((e) => {
        empMap.set(e.id, e.callingName || e.fullName || '');
      });
    }

    const formatted = supervisors.map((s) => ({
      id: s.id,
      fullName: s.fullName,
      username: s.username,
      status: s.status,
      linkedEmployeeId: s.employeeId || null,
      linkedEmployeeName: s.employeeId ? empMap.get(s.employeeId) || null : null,
      createdAt: s.createdAt,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Error fetching supervisors:", error);
    res.status(500).json({ message: "Error fetching supervisors" });
  }
};

export const createSupervisor = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, username, linkedEmployeeId, employeeId } = req.body;
    if (!fullName || !username) {
      res.status(400).json({ message: "All fields are required" });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    const resolvedEmployeeId = linkedEmployeeId || employeeId || null;

    const newSupervisor = await prisma.user.create({
      data: {
        tenantId,
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        role: "supervisor",
        passwordHash: hashedPassword,
        employeeId: resolvedEmployeeId,
        status: "active",
        mustChangePassword: true,
      },
    });

    let linkedEmployeeName: string | null = null;
    if (resolvedEmployeeId) {
      const emp = await prisma.employee.findUnique({
        where: { id: resolvedEmployeeId },
        select: { callingName: true, fullName: true },
      });
      if (emp) {
        linkedEmployeeName = emp.callingName || emp.fullName;
      }
    }

    res.status(201).json({
      supervisor: {
        id: newSupervisor.id,
        fullName: newSupervisor.fullName,
        username: newSupervisor.username,
        status: newSupervisor.status,
        linkedEmployeeId: newSupervisor.employeeId,
        linkedEmployeeName,
      },
      tempPassword,
      message: "Supervisor created successfully",
    });
  } catch (error: any) {
    console.error('Error creating supervisor:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ message: 'Supervisor with this username already exists' });
      return;
    }
    res.status(500).json({ message: 'Failed to create supervisor' });
  }
};

export const resetSupervisorPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = (req.params.id as string) || '';
    const tempPassword = generateTempPassword();
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const update = await prisma.user.update({
      where: { id },
      data: {
        passwordHash: hashedPassword,
        mustChangePassword: true,
      },
    });

    res.json({
      message: "Password reset successfully",
      tempPassword,
      name: update.fullName,
    });
  } catch (error: any) {
    console.error("Error resetting supervisor password:", error);
    if (error.code === 'P2025') {
      res.status(404).json({ message: "Supervisor not found" });
      return;
    }
    res.status(500).json({ message: "Error resetting supervisor password" });
  }
};

export const updateSupervisorStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = (req.params.id as string) || '';
    const { status } = req.body;

    const update = await prisma.user.update({
      where: { id },
      data: { status: status || 'inactive' },
    });

    res.json(update);
  } catch (error: any) {
    console.error("Error updating supervisor status:", error);
    if (error.code === 'P2025') {
      res.status(404).json({ message: "Supervisor not found" });
      return;
    }
    res.status(500).json({ message: "Error updating supervisor status" });
  }
};

export const deleteSupervisor = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = (req.params.id as string) || '';

    const supervisor = await prisma.user.findUnique({
      where: { id },
    });

    if (!supervisor) {
      res.status(404).json({ message: "Supervisor not found" });
      return;
    }

    // Clean up any assigned tasks or time entries if linked
    await prisma.dailyAssignment.deleteMany({ where: { supervisorId: id } });
    await prisma.timeEntry.deleteMany({ where: { supervisorId: id } });

    await prisma.user.delete({
      where: { id },
    });

    res.json({ message: "Supervisor deleted successfully" });
  } catch (error: any) {
    console.error("Error deleting supervisor:", error);
    if (error.code === 'P2025') {
      res.status(404).json({ message: "Supervisor not found" });
      return;
    }
    res.status(500).json({ message: "Failed to delete supervisor" });
  }
};

