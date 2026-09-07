import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { getDefaultTenantId } from './employeeController';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

// Get all activity codes (scoped to tenant)
export const getAllActivityCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const tenantId = (req.query.tenantId as string) || (await getDefaultTenantId());

    const where: Record<string, any> = { tenantId };
    if (search && typeof search === 'string') {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const activityCodes = await prisma.activityCode.findMany({
      where,
      orderBy: { code: 'asc' },
    });

    res.json(activityCodes);
  } catch (error) {
    console.error('Error fetching activity codes:', error);
    res.status(500).json({ error: 'Failed to fetch activity codes' });
  }
};

// Get activity code by ID
export const getActivityCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const code = await prisma.activityCode.findUnique({
      where: { id },
    });

    if (!code) {
      res.status(404).json({ error: 'Activity code not found' });
      return;
    }

    res.json(code);
  } catch (error) {
    console.error('Error fetching activity code:', error);
    res.status(500).json({ error: 'Failed to fetch activity code' });
  }
};

// Create activity code
export const createActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, description } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }

    const tenantId = req.body.tenantId || (await getDefaultTenantId());

    const newCode = await prisma.activityCode.create({
      data: {
        tenantId,
        code,
        description: description || null,
      },
    });

    res.status(201).json(newCode);
  } catch (error: any) {
    console.error('Error creating activity code:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Activity code already exists in this tenant' });
      return;
    }
    res.status(500).json({ error: 'Failed to create activity code' });
  }
};

// Update activity code
export const updateActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { code, description } = req.body;

    const updated = await prisma.activityCode.update({
      where: { id },
      data: {
        code,
        description,
      },
    });

    res.json(updated);
  } catch (error: any) {
    console.error('Error updating activity code:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Activity code not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to update activity code' });
  }
};

// Delete activity code
export const deleteActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    // Check if time entries reference this activity
    const usageCount = await prisma.timeEntry.count({
      where: { activityId: id },
    });

    if (usageCount > 0) {
      res.status(400).json({
        error: `Cannot delete: ${usageCount} time entry record(s) reference this activity code.`,
      });
      return;
    }

    await prisma.activityCode.delete({
      where: { id },
    });

    res.json({ message: 'Activity code deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting activity code:', error);
    if (error.code === 'P2025') {
      res.status(404).json({ error: 'Activity code not found' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete activity code' });
  }
};
