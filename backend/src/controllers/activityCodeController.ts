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
    const { search, projectCode } = req.query;
    const tenantId = req.resolvedTenantId || (req.query.tenantId as string) || (await getDefaultTenantId());

    const where: Record<string, any> = { tenantId };
    if (projectCode && typeof projectCode === 'string') {
      where.projectCode = projectCode;
    }
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
    const { code, description, projectCode, trade, category } = req.body;
    if (!code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }

    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());

    const newCode = await prisma.activityCode.create({
      data: {
        tenantId,
        projectCode: projectCode || null,
        code,
        description: description || null,
        trade: trade || null,
        category: category || null,
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
    const { code, description, projectCode, trade, category } = req.body;

    const data: Record<string, any> = {};
    if (code !== undefined) data.code = code;
    if (description !== undefined) data.description = description;
    if (projectCode !== undefined) data.projectCode = projectCode;
    if (trade !== undefined) data.trade = trade;
    if (category !== undefined) data.category = category;

    const updated = await prisma.activityCode.update({
      where: { id },
      data,
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

// ── CENTRAL CORPORATE ERP ACTIVITY CATALOG CONTROLLERS ───────────────────────

// GET /api/activity-codes/corporate-master
export const getCorporateActivityCodesCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectCode, search } = req.query;
    const where: Record<string, any> = {};

    if (projectCode && typeof projectCode === 'string') {
      where.projectCode = projectCode;
    }

    if (search && typeof search === 'string') {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { searchKey: { contains: search, mode: 'insensitive' } },
      ];
    }

    const list = await prisma.corporateActivityCode.findMany({
      where,
      orderBy: [{ projectCode: 'asc' }, { code: 'asc' }],
    });

    res.json(list);
  } catch (error) {
    console.error('Error fetching corporate activity codes catalog:', error);
    res.status(500).json({ error: 'Failed to fetch corporate activity codes catalog' });
  }
};

// POST /api/activity-codes/corporate-master/batch
export const batchSyncCorporateActivityCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Array of items required' });
      return;
    }

    const results = [];
    for (const item of items) {
      const pCode = item.projectCode || item.currentWorkingProject || null;
      const record = await prisma.corporateActivityCode.upsert({
        where: {
          projectCode_code: {
            projectCode: pCode,
            code: item.code,
          },
        },
        update: {
          description: item.description,
          searchKey: item.searchKey || null,
          activityType: item.activityType || 'Work Package',
          unit: item.unit || null,
          timeUnit: item.timeUnit || null,
          currentWorkingProject: item.currentWorkingProject || pCode,
        },
        create: {
          projectCode: pCode,
          code: item.code,
          description: item.description,
          searchKey: item.searchKey || null,
          activityType: item.activityType || 'Work Package',
          unit: item.unit || null,
          timeUnit: item.timeUnit || null,
          currentWorkingProject: item.currentWorkingProject || pCode,
        },
      });
      results.push(record);
    }

    res.json({ success: true, count: results.length });
  } catch (error) {
    console.error('Error batch syncing corporate activity codes:', error);
    res.status(500).json({ error: 'Failed to batch sync corporate activity codes' });
  }
};

// POST /api/activity-codes/import-from-corporate
export const importActivityCodesFromCorporate = async (req: Request, res: Response): Promise<void> => {
  try {
    const tenantId = req.resolvedTenantId || req.body.tenantId || (await getDefaultTenantId());
    const { items, projectCode } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Array of items required' });
      return;
    }

    const imported = [];
    const skipped = [];

    for (const item of items) {
      const itemProject = item.projectCode || item.currentWorkingProject || null;

      // Project code validation: If target projectCode is specified and item has a projectCode, validate match
      if (projectCode && itemProject && itemProject.toLowerCase() !== projectCode.toLowerCase()) {
        skipped.push({ code: item.code, reason: `Project code mismatch: expected ${projectCode}, got ${itemProject}` });
        continue;
      }

      const upserted = await prisma.activityCode.upsert({
        where: {
          tenantId_code: {
            tenantId,
            code: item.code,
          },
        },
        update: {
          description: item.description,
          projectCode: itemProject || projectCode || null,
          category: item.activityType || 'Civil',
        },
        create: {
          tenantId,
          code: item.code,
          description: item.description,
          projectCode: itemProject || projectCode || null,
          category: item.activityType || 'Civil',
        },
      });
      imported.push(upserted);
    }

    res.json({
      success: true,
      importedCount: imported.length,
      skippedCount: skipped.length,
      skipped,
      activities: imported,
    });
  } catch (error) {
    console.error('Error importing activity codes from corporate:', error);
    res.status(500).json({ error: 'Failed to import activity codes' });
  }
};

