import { Request, Response } from 'express';
import prisma from '../config/prisma';
import '../middleware/tenantMiddleware';
import { getDefaultTenantId } from '../utils/tenantHelper';

const getParam = (param: string | string[] | undefined): string => {
  if (Array.isArray(param)) return param[0] || '';
  return param || '';
};

// 1. GET /api/activity-codes — List all activity codes scoped to project
export const getAllActivityCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      (req.query.projectId as string) ||
      (req.query.tenantId as string) ||
      (await getDefaultTenantId());

    const where: Record<string, any> = { projectId };
    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const activityCodes = await prisma.activityCode.findMany({
      where,
      select: {
        id: true,
        projectId: true,
        code: true,
        description: true,
        unit: true,
        createdAt: true,
        corporateActivityCodeId: true,
        corporateActivityCode: {
          select: {
            id: true,
            code: true,
            description: true,
          },
        },
      },
      orderBy: { code: 'asc' },
    });

    res.json(activityCodes);
  } catch (error) {
    console.error('Error fetching activity codes:', error);
    res.status(500).json({ error: 'Failed to fetch activity codes' });
  }
};

// 2. GET /api/activity-codes/:id — Get activity code by ID
export const getActivityCodeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const code = await prisma.activityCode.findUnique({
      where: { id },
      select: {
        id: true,
        projectId: true,
        code: true,
        description: true,
        unit: true,
        createdAt: true,
        corporateActivityCodeId: true,
      },
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

// 3. POST /api/activity-codes — Create activity code
export const createActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, description, unit } = req.body || {};
    if (!code) {
      res.status(400).json({ error: 'Code is required' });
      return;
    }

    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const cleanCode = String(code).trim();

    // Check if corporate master has this code
    const corpMatch = await prisma.corporateActivityCode.findUnique({
      where: { code: cleanCode },
      select: { id: true, description: true, unit: true },
    });

    const newCode = await prisma.activityCode.create({
      data: {
        projectId,
        code: cleanCode,
        description: description?.trim() || corpMatch?.description || cleanCode,
        unit: unit?.trim() || corpMatch?.unit || null,
        corporateActivityCodeId: corpMatch?.id || null,
      },
    });

    res.status(201).json(newCode);
  } catch (error: any) {
    console.error('Error creating activity code:', error);
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Activity code already exists in this project' });
      return;
    }
    res.status(500).json({ error: 'Failed to create activity code' });
  }
};

// 4. PUT /api/activity-codes/:id — Update activity code
export const updateActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);
    const { code, description, unit } = req.body || {};

    const data: Record<string, any> = {};
    if (code !== undefined) data.code = String(code).trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (unit !== undefined) data.unit = unit?.trim() || null;

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

// 5. DELETE /api/activity-codes/:id — Delete activity code
export const deleteActivityCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = getParam(req.params.id);

    // Check if time entries or logs reference this activity
    const [timeEntriesCount, splitsCount, equipLogsCount] = await Promise.all([
      prisma.timeEntry.count({ where: { activityId: id } }),
      prisma.laborActivitySplit.count({ where: { activityCodeId: id } }),
      prisma.equipmentDailyLogActivity.count({ where: { activityCodeId: id } }),
    ]);

    const totalUsage = timeEntriesCount + splitsCount + equipLogsCount;
    if (totalUsage > 0) {
      res.status(400).json({
        error: `Cannot delete: ${totalUsage} active record(s) reference this activity code.`,
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

// ── CENTRAL CORPORATE ERP ACTIVITY CATALOG ───────────────────────────────

// 6. GET /api/activity-codes/corporate-master — Catalog from corporate
export const getCorporateActivityCodesCatalog = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search } = req.query;
    const where: Record<string, any> = {};

    if (search && typeof search === 'string' && search.trim()) {
      const q = search.trim();
      where.OR = [
        { code: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    const list = await prisma.corporateActivityCode.findMany({
      where,
      select: {
        id: true,
        code: true,
        description: true,
        unit: true,
        createdAt: true,
      },
      orderBy: { code: 'asc' },
    });

    res.json(list);
  } catch (error) {
    console.error('Error fetching corporate activity codes catalog:', error);
    res.status(500).json({ error: 'Failed to fetch corporate activity codes catalog' });
  }
};

// 7. POST /api/activity-codes/corporate-master/batch — Batch sync corporate activities
export const batchSyncCorporateActivityCodes = async (req: Request, res: Response): Promise<void> => {
  try {
    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Array of items required' });
      return;
    }

    const results = [];
    for (const item of items) {
      if (!item.code) continue;
      const cleanCode = String(item.code).trim();
      const record = await prisma.corporateActivityCode.upsert({
        where: { code: cleanCode },
        update: {
          description: item.description || cleanCode,
          unit: item.unit || null,
        },
        create: {
          code: cleanCode,
          description: item.description || cleanCode,
          unit: item.unit || null,
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

// 8. POST /api/activity-codes/import-from-corporate — Import into site project
export const importActivityCodesFromCorporate = async (req: Request, res: Response): Promise<void> => {
  try {
    const projectId =
      req.resolvedProjectId ||
      req.resolvedTenantId ||
      req.body.projectId ||
      req.body.tenantId ||
      (await getDefaultTenantId());

    const { items } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Array of items required' });
      return;
    }

    const imported = [];
    for (const item of items) {
      if (!item.code) continue;
      const cleanCode = String(item.code).trim();

      const upserted = await prisma.activityCode.upsert({
        where: {
          projectId_code: {
            projectId,
            code: cleanCode,
          },
        },
        update: {
          description: item.description || cleanCode,
          unit: item.unit || null,
          corporateActivityCodeId: item.id || undefined,
        },
        create: {
          projectId,
          code: cleanCode,
          description: item.description || cleanCode,
          unit: item.unit || null,
          corporateActivityCodeId: item.id || null,
        },
      });
      imported.push(upserted);
    }

    res.json({
      success: true,
      importedCount: imported.length,
      activities: imported,
    });
  } catch (error) {
    console.error('Error importing activity codes from corporate:', error);
    res.status(500).json({ error: 'Failed to import activity codes' });
  }
};
