"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteActivityCode = exports.updateActivityCode = exports.createActivityCode = exports.getActivityCodeById = exports.getAllActivityCodes = void 0;
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
        const { search } = req.query;
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const where = { tenantId };
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
        const { code, description } = req.body;
        if (!code) {
            res.status(400).json({ error: 'Code is required' });
            return;
        }
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const newCode = await prisma_1.default.activityCode.create({
            data: {
                tenantId,
                code,
                description: description || null,
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
        const { code, description } = req.body;
        const updated = await prisma_1.default.activityCode.update({
            where: { id },
            data: {
                code,
                description,
            },
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
