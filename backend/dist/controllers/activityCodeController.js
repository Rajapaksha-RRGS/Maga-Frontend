"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importActivityCodesFromCorporate = exports.batchSyncCorporateActivityCodes = exports.getCorporateActivityCodesCatalog = exports.deleteActivityCode = exports.updateActivityCode = exports.createActivityCode = exports.getActivityCodeById = exports.getAllActivityCodes = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
require("../middleware/tenantMiddleware");
const tenantHelper_1 = require("../utils/tenantHelper");
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
// 1. GET /api/activity-codes — List all activity codes scoped to project
const getAllActivityCodes = async (req, res) => {
    try {
        const { search } = req.query;
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const where = { projectId };
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            where.OR = [
                { code: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        }
        const activityCodes = await prisma_1.default.mF_P_ActivityCode.findMany({
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
    }
    catch (error) {
        console.error('Error fetching activity codes:', error);
        res.status(500).json({ error: 'Failed to fetch activity codes' });
    }
};
exports.getAllActivityCodes = getAllActivityCodes;
// 2. GET /api/activity-codes/:id — Get activity code by ID
const getActivityCodeById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const code = await prisma_1.default.mF_P_ActivityCode.findUnique({
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
    }
    catch (error) {
        console.error('Error fetching activity code:', error);
        res.status(500).json({ error: 'Failed to fetch activity code' });
    }
};
exports.getActivityCodeById = getActivityCodeById;
// 3. POST /api/activity-codes — Create activity code
const createActivityCode = async (req, res) => {
    try {
        const { code, description, unit } = req.body || {};
        if (!code) {
            res.status(400).json({ error: 'Code is required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const cleanCode = String(code).trim();
        // Check if corporate master has this code
        const corpMatch = await prisma_1.default.mF_G_ActivityCode.findUnique({
            where: { code: cleanCode },
            select: { id: true, description: true, unit: true },
        });
        const newCode = await prisma_1.default.mF_P_ActivityCode.create({
            data: {
                projectId,
                code: cleanCode,
                description: description?.trim() || corpMatch?.description || cleanCode,
                unit: unit?.trim() || corpMatch?.unit || null,
                corporateActivityCodeId: corpMatch?.id || null,
            },
        });
        res.status(201).json(newCode);
    }
    catch (error) {
        console.error('Error creating activity code:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Activity code already exists in this project' });
            return;
        }
        res.status(500).json({ error: 'Failed to create activity code' });
    }
};
exports.createActivityCode = createActivityCode;
// 4. PUT /api/activity-codes/:id — Update activity code
const updateActivityCode = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { code, description, unit } = req.body || {};
        const data = {};
        if (code !== undefined)
            data.code = String(code).trim();
        if (description !== undefined)
            data.description = description?.trim() || null;
        if (unit !== undefined)
            data.unit = unit?.trim() || null;
        const updated = await prisma_1.default.mF_P_ActivityCode.update({
            where: { id },
            data,
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating activity code:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Activity code not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to update activity code' });
    }
};
exports.updateActivityCode = updateActivityCode;
// 5. DELETE /api/activity-codes/:id — Delete activity code
const deleteActivityCode = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        // Check if time entries or logs reference this activity
        const [timeEntriesCount, splitsCount, equipLogsCount] = await Promise.all([
            prisma_1.default.mF_OP_TimeEntry.count({ where: { activityId: id } }),
            prisma_1.default.mF_OP_LaborActivitySplit.count({ where: { activityCodeId: id } }),
            prisma_1.default.mF_OP_EquipmentDailyLogActivity.count({ where: { activityCodeId: id } }),
        ]);
        const totalUsage = timeEntriesCount + splitsCount + equipLogsCount;
        if (totalUsage > 0) {
            res.status(400).json({
                error: `Cannot delete: ${totalUsage} active record(s) reference this activity code.`,
            });
            return;
        }
        await prisma_1.default.mF_P_ActivityCode.delete({
            where: { id },
        });
        res.json({ message: 'Activity code deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting activity code:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Activity code not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to delete activity code' });
    }
};
exports.deleteActivityCode = deleteActivityCode;
// ── CENTRAL CORPORATE ERP ACTIVITY CATALOG ───────────────────────────────
// 6. GET /api/activity-codes/corporate-master — Catalog from corporate
const getCorporateActivityCodesCatalog = async (req, res) => {
    try {
        const { search } = req.query;
        const where = {};
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            where.OR = [
                { code: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        }
        const list = await prisma_1.default.mF_G_ActivityCode.findMany({
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
    }
    catch (error) {
        console.error('Error fetching corporate activity codes catalog:', error);
        res.status(500).json({ error: 'Failed to fetch corporate activity codes catalog' });
    }
};
exports.getCorporateActivityCodesCatalog = getCorporateActivityCodesCatalog;
// 7. POST /api/activity-codes/corporate-master/batch — Batch sync corporate activities
const batchSyncCorporateActivityCodes = async (req, res) => {
    try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Array of items required' });
            return;
        }
        const results = [];
        for (const item of items) {
            if (!item.code)
                continue;
            const cleanCode = String(item.code).trim();
            const record = await prisma_1.default.mF_G_ActivityCode.upsert({
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
    }
    catch (error) {
        console.error('Error batch syncing corporate activity codes:', error);
        res.status(500).json({ error: 'Failed to batch sync corporate activity codes' });
    }
};
exports.batchSyncCorporateActivityCodes = batchSyncCorporateActivityCodes;
// 8. POST /api/activity-codes/import-from-corporate — Import into site project
const importActivityCodesFromCorporate = async (req, res) => {
    try {
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Array of items required' });
            return;
        }
        const imported = [];
        for (const item of items) {
            if (!item.code)
                continue;
            const cleanCode = String(item.code).trim();
            const upserted = await prisma_1.default.mF_P_ActivityCode.upsert({
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
    }
    catch (error) {
        console.error('Error importing activity codes from corporate:', error);
        res.status(500).json({ error: 'Failed to import activity codes' });
    }
};
exports.importActivityCodesFromCorporate = importActivityCodesFromCorporate;
