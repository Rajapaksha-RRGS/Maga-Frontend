import { Request, Response } from 'express';
import prisma from '../config/prisma';

// Helper to get string param safely in Express 5
const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

// Helper to get or ensure the default SaaS tenant (e.g. Mäga Engineering)
export const getDefaultTenantId = async (): Promise<string> => {
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
  return tenant.id;
};

// Get all employees (scoped to tenant)
export const getAllEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, tradeGroup, businessPartner } = req.query;
    const tenantId = (req.query.tenantId as string) || (await getDefaultTenantId());

    const where: Record<string, any> = { tenantId };
    if (status && typeof status === 'string') {
      where.status = status;
    }
    if (tradeGroup && typeof tradeGroup === 'string') {
      where.tradeGroup = tradeGroup;
    }
    if (businessPartner && typeof businessPartner === 'string') {
      where.businessPartner = {
        name: { contains: businessPartner, mode: 'insensitive' },
      };
    }

    const employees = await prisma.employee.findMany({
      where,
      include: {
        businessPartner: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(employees);
  } catch (error) {
    console.error('Error fetching employees:', error);
    res.status(500).json({ error: 'Failed to fetch employees' });
  }
};

// Get employee by ID
export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        businessPartner: true,
      },
    });

    if (!employee) {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }

    res.json(employee);
  } catch (error) {
    console.error('Error fetching employee:', error);
    res.status(500).json({ error: 'Failed to fetch employee' });
  }
};

// Create new employee
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      employeeCode,
      callingName,
      fullName,
      businessPartnerId,
      tradeGroup,
      nicNo,
      dailyRate,
      epfNo,
      status,
    } = req.body;

    if (!callingName || !nicNo) {
      res.status(400).json({ error: 'Missing required fields' });
      return;
    }

    const tenantId = req.body.tenantId || (await getDefaultTenantId());

    const newEmployee = await prisma.employee.create({
      data: {
        tenantId,
        employeeCode: employeeCode || `EMP${Date.now().toString().slice(-4)}`,
        callingName,
        fullName: fullName || callingName,
        tradeGroup: tradeGroup || 'General labour',
        nicNo,
        dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : 1400.0,
        epfNo: epfNo || '',
        status: status || 'active',
        businessPartnerId: businessPartnerId || undefined,
      },
      include: {
        businessPartner: true,
      },
    });

    res.status(201).json(newEmployee);
  } catch (error: any) {
    console.error('Error creating employee:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Employee with this code already exists in this tenant' });
      return;
    }
    res.status(500).json({ error: 'Failed to create employee' });
  }
};

// Update employee
export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const updateData = { ...req.body };

    if (updateData.dailyRate !== undefined) {
      updateData.dailyRate = parseFloat(updateData.dailyRate);
    }

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        businessPartner: true,
      },
    });

    res.json(updatedEmployee);
  } catch (error: any) {
    console.error('Error updating employee:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update employee' });
  }
};

// Update status (e.g. active / inactive)
export const updateEmployeeStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { status } = req.body;

    if (!status || !['active', 'inactive'].includes(status)) {
      res.status(400).json({ error: 'Valid status ("active" | "inactive") is required' });
      return;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: { status },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating employee status:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update status' });
  }
};

// Delete employee
export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    await prisma.employee.delete({
      where: { id },
    });

    res.json({ message: 'Employee deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting employee:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Employee not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete employee' });
  }
};
