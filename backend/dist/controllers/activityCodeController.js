"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.importActivityCodesFromCorporate = exports.batchSyncCorporateActivityCodes = exports.getCorporateActivityCodesCatalog = exports.deleteActivityCode = exports.updateActivityCode = exports.createActivityCode = exports.getActivityCodeById = exports.getAllActivityCodes = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
// Get all activity codes (scoped to tenant)
const getAllActivityCodes = async (req, res) => {
    try {
        const { search, projectCode } = req.query;
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const where = { tenantId };
        if (projectCode && typeof projectCode === 'string') {
            where.projectCode = projectCode;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { code: { contains: search, mode: 'insensitive' } },
                { description: { contains: search, mode: 'insensitive' } },
            ];
        }
        const activityCodes = await prisma_1.default.activityCode.findMany({
            where,
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
// Get activity code by ID
const getActivityCodeById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const code = await prisma_1.default.activityCode.findUnique({
            where: { id },
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
// Create activity code
const createActivityCode = async (req, res) => {
    try {
        const { code, description, projectCode, trade, category } = req.body;
        if (!code) {
            res.status(400).json({ error: 'Code is required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const newCode = await prisma_1.default.activityCode.create({
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
    }
    catch (error) {
        console.error('Error creating activity code:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Activity code already exists in this tenant' });
            return;
        }
        res.status(500).json({ error: 'Failed to create activity code' });
    }
};
exports.createActivityCode = createActivityCode;
// Update activity code
const updateActivityCode = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { code, description, projectCode, trade, category } = req.body;
        const data = {};
        if (code !== undefined)
            data.code = code;
        if (description !== undefined)
            data.description = description;
        if (projectCode !== undefined)
            data.projectCode = projectCode;
        if (trade !== undefined)
            data.trade = trade;
        if (category !== undefined)
            data.category = category;
        const updated = await prisma_1.default.activityCode.update({
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
// Delete activity code
const deleteActivityCode = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        // Check if time entries reference this activity
        const usageCount = await prisma_1.default.timeEntry.count({
            where: { activityId: id },
        });
        if (usageCount > 0) {
            res.status(400).json({
                error: `Cannot delete: ${usageCount} time entry record(s) reference this activity code.`,
            });
            return;
        }
        await prisma_1.default.activityCode.delete({
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
// ── CENTRAL CORPORATE ERP ACTIVITY CATALOG CONTROLLERS ───────────────────────
// GET /api/activity-codes/corporate-master
const getCorporateActivityCodesCatalog = async (req, res) => {
    try {
        const { projectCode, search } = req.query;
        const where = {};
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
        const list = await prisma_1.default.corporateActivityCode.findMany({
            where,
            orderBy: [{ projectCode: 'asc' }, { code: 'asc' }],
        });
        res.json(list);
    }
    catch (error) {
        console.error('Error fetching corporate activity codes catalog:', error);
        res.status(500).json({ error: 'Failed to fetch corporate activity codes catalog' });
    }
};
exports.getCorporateActivityCodesCatalog = getCorporateActivityCodesCatalog;
// POST /api/activity-codes/corporate-master/batch
const batchSyncCorporateActivityCodes = async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Array of items required' });
            return;
        }
        const results = [];
        for (const item of items) {
            const pCode = item.projectCode || item.currentWorkingProject || null;
            const record = await prisma_1.default.corporateActivityCode.upsert({
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
    }
    catch (error) {
        console.error('Error batch syncing corporate activity codes:', error);
        res.status(500).json({ error: 'Failed to batch sync corporate activity codes' });
    }
};
exports.batchSyncCorporateActivityCodes = batchSyncCorporateActivityCodes;
// POST /api/activity-codes/import-from-corporate
const importActivityCodesFromCorporate = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
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
            const upserted = await prisma_1.default.activityCode.upsert({
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
    }
    catch (error) {
        console.error('Error importing activity codes from corporate:', error);
        res.status(500).json({ error: 'Failed to import activity codes' });
    }
};
exports.importActivityCodesFromCorporate = importActivityCodesFromCorporate;
