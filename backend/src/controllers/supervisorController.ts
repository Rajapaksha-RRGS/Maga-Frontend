import { Request, Response } from "express";
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

export const getAllSupervisors = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = (req.query.tenantId as string) || (await getDefaultTenantId());

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

    const tenantId = req.body.tenantId || (await getDefaultTenantId());
    const tempPassword = generateTempPassword();
    const resolvedEmployeeId = linkedEmployeeId || employeeId || null;

    const newSupervisor = await prisma.user.create({
      data: {
        tenantId,
        fullName: fullName.trim(),
        username: username.trim().toLowerCase(),
        role: "supervisor",
        passwordHash: tempPassword,
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

    const update = await prisma.user.update({
      where: { id },
      data: {
        passwordHash: tempPassword,
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
