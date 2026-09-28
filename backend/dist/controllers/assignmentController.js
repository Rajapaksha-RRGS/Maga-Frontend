"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyEquipmentGangsFromDate = exports.unassignEquipment = exports.assignEquipment = exports.getEquipmentAssignmentsForDate = exports.copyOperatorGangsFromDate = exports.unassignOperator = exports.assignOperators = exports.getOperatorAssignmentsForDate = exports.copyGangsFromDate = exports.unassignEmployee = exports.assignEmployees = exports.getRecentGangSummaries = exports.getAssignmentsForDate = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
// Helper: parse date to UTC midnight for date column
function parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}
// 1. Get assignments for a specific date
const getAssignmentsForDate = async (req, res) => {
    try {
        const dateStr = req.query.date;
        if (!dateStr) {
            res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const targetDate = parseDate(dateStr);
        const assignments = await prisma_1.default.dailyAssignment.findMany({
            where: {
                tenantId,
                date: targetDate,
            },
            include: {
                supervisor: {
                    select: { id: true, fullName: true, username: true },
                },
                employee: {
                    select: {
                        id: true,
                        employeeCode: true,
                        callingName: true,
                        fullName: true,
                        tradeGroup: true,
                        businessPartner: { select: { id: true, name: true, code: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const formatted = assignments.map((a) => ({
            id: a.id,
            date: dateStr,
            supervisorId: a.supervisorId,
            employeeId: a.employeeId,
            supervisorName: a.supervisor.fullName,
            employeeName: a.employee.callingName,
            employeeTrade: a.employee.tradeGroup,
            businessPartner: a.employee.businessPartner?.name || 'Direct',
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
};
exports.getAssignmentsForDate = getAssignmentsForDate;
// 2. Get past days gang summary (Past 5-7 days of recorded gangs)
const getRecentGangSummaries = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const limitDays = parseInt(req.query.days, 10) || 5;
        const beforeDateStr = req.query.before || req.query.targetDate;
        const beforeDate = beforeDateStr ? parseDate(beforeDateStr) : undefined;
        // Fetch distinct assignment dates (strictly before beforeDate if provided)
        const distinctDates = await prisma_1.default.dailyAssignment.findMany({
            where: {
                tenantId,
                ...(beforeDate ? { date: { lt: beforeDate } } : {}),
            },
            select: { date: true },
            distinct: ['date'],
            orderBy: { date: 'desc' },
            take: limitDays,
        });
        const summaries = await Promise.all(distinctDates.map(async ({ date }) => {
            const dateISO = date.toISOString().split('T')[0];
            const dayAssignments = await prisma_1.default.dailyAssignment.findMany({
                where: { tenantId, date },
                include: {
                    supervisor: { select: { id: true, fullName: true } },
                },
            });
            const supervisorGangMap = {};
            dayAssignments.forEach((a) => {
                if (!supervisorGangMap[a.supervisorId]) {
                    supervisorGangMap[a.supervisorId] = {
                        supervisorId: a.supervisorId,
                        supervisorName: a.supervisor.fullName,
                        workerCount: 0,
                    };
                }
                supervisorGangMap[a.supervisorId].workerCount += 1;
            });
            return {
                date: dateISO,
                totalWorkers: dayAssignments.length,
                supervisorsCount: Object.keys(supervisorGangMap).length,
                gangs: Object.values(supervisorGangMap),
            };
        }));
        res.json(summaries);
    }
    catch (error) {
        console.error('Error fetching recent gang summaries:', error);
        res.status(500).json({ error: 'Failed to fetch recent gang summaries' });
    }
};
exports.getRecentGangSummaries = getRecentGangSummaries;
// 3. Assign employees to a supervisor for a date
const assignEmployees = async (req, res) => {
    try {
        const { date, supervisorId, employeeIds } = req.body;
        if (!date || !supervisorId || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            res.status(400).json({ error: 'date, supervisorId, and non-empty employeeIds array are required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const createdAssignments = [];
        for (const empId of employeeIds) {
            const assignment = await prisma_1.default.dailyAssignment.upsert({
                where: {
                    tenantId_date_employeeId: {
                        tenantId,
                        date: targetDate,
                        employeeId: empId,
                    },
                },
                update: {
                    supervisorId,
                },
                create: {
                    tenantId,
                    date: targetDate,
                    supervisorId,
                    employeeId: empId,
                },
            });
            createdAssignments.push(assignment);
        }
        res.status(201).json({
            success: true,
            count: createdAssignments.length,
            assignments: createdAssignments,
        });
    }
    catch (error) {
        console.error('Error assigning employees:', error);
        res.status(500).json({ error: 'Failed to assign employees' });
    }
};
exports.assignEmployees = assignEmployees;
// 4. Unassign an employee
const unassignEmployee = async (req, res) => {
    try {
        const id = req.params.id;
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const existing = await prisma_1.default.dailyAssignment.findFirst({
            where: { id, tenantId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Assignment record not found' });
            return;
        }
        await prisma_1.default.dailyAssignment.delete({
            where: { id },
        });
        res.json({ success: true, message: 'Employee unassigned successfully' });
    }
    catch (error) {
        console.error('Error unassigning employee:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Assignment record not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to unassign employee' });
    }
};
exports.unassignEmployee = unassignEmployee;
// 5. Copy gang from any selected past date to target date
const copyGangsFromDate = async (req, res) => {
    try {
        const { sourceDate, targetDate, supervisorIds, overwrite = true } = req.body;
        if (!sourceDate || !targetDate) {
            res.status(400).json({ error: 'sourceDate and targetDate are required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const srcDateParsed = parseDate(sourceDate);
        const tgtDateParsed = parseDate(targetDate);
        // Fetch assignments from source date
        const sourceWhere = {
            tenantId,
            date: srcDateParsed,
        };
        if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
            sourceWhere.supervisorId = { in: supervisorIds };
        }
        const sourceAssignments = await prisma_1.default.dailyAssignment.findMany({
            where: sourceWhere,
        });
        if (sourceAssignments.length === 0) {
            res.json({
                success: true,
                copiedCount: 0,
                message: `No gang records found on ${sourceDate} to copy.`,
            });
            return;
        }
        // Overwrite existing assignments on target date so stale old assignments don't stay attached to other supervisors
        if (overwrite !== false) {
            const deleteWhere = {
                tenantId,
                date: tgtDateParsed,
            };
            if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
                deleteWhere.supervisorId = { in: supervisorIds };
            }
            await prisma_1.default.dailyAssignment.deleteMany({
                where: deleteWhere,
            });
        }
        // Insert copied assignments into target date
        await prisma_1.default.dailyAssignment.createMany({
            data: sourceAssignments.map((src) => ({
                tenantId,
                date: tgtDateParsed,
                supervisorId: src.supervisorId,
                employeeId: src.employeeId,
            })),
            skipDuplicates: true,
        });
        res.json({
            success: true,
            copiedCount: sourceAssignments.length,
            message: `Successfully copied ${sourceAssignments.length} gang assignment(s) from ${sourceDate} to ${targetDate}.`,
        });
    }
    catch (error) {
        console.error('Error copying gangs from date:', error);
        res.status(500).json({ error: 'Failed to copy gangs from date' });
    }
};
exports.copyGangsFromDate = copyGangsFromDate;
// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR ASSIGNMENT CONTROLLER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
// 6. Get operator assignments for a specific date
const getOperatorAssignmentsForDate = async (req, res) => {
    try {
        const dateStr = req.query.date;
        if (!dateStr) {
            res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const supervisorId = req.query.supervisorId;
        const targetDate = parseDate(dateStr);
        const where = {
            tenantId,
            date: targetDate,
        };
        if (supervisorId) {
            where.supervisorId = supervisorId;
        }
        const assignments = await prisma_1.default.dailyOperatorAssignment.findMany({
            where,
            include: {
                supervisor: {
                    select: { id: true, fullName: true, username: true },
                },
                operator: {
                    select: {
                        id: true,
                        employeeCode: true,
                        callingName: true,
                        fullName: true,
                        tradeGroup: true,
                        isOperator: true,
                        licenseNo: true,
                        businessPartner: { select: { id: true, name: true, code: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const formatted = assignments.map((a) => ({
            id: a.id,
            date: dateStr,
            supervisorId: a.supervisorId,
            operatorId: a.operatorId,
            supervisorName: a.supervisor.fullName,
            operatorName: a.operator.callingName,
            operatorCode: a.operator.employeeCode,
            operatorTrade: a.operator.tradeGroup,
            licenseNo: a.operator.licenseNo || null,
            businessPartner: a.operator.businessPartner?.name || 'Direct',
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching operator assignments:', error);
        res.status(500).json({ error: 'Failed to fetch operator assignments' });
    }
};
exports.getOperatorAssignmentsForDate = getOperatorAssignmentsForDate;
// 7. Assign operators to a supervisor for a date
const assignOperators = async (req, res) => {
    try {
        const { date, supervisorId, operatorIds } = req.body;
        if (!date || !supervisorId || !Array.isArray(operatorIds) || operatorIds.length === 0) {
            res.status(400).json({ error: 'date, supervisorId, and non-empty operatorIds array are required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const createdAssignments = [];
        for (const opId of operatorIds) {
            const assignment = await prisma_1.default.dailyOperatorAssignment.upsert({
                where: {
                    tenantId_date_operatorId: {
                        tenantId,
                        date: targetDate,
                        operatorId: opId,
                    },
                },
                update: {
                    supervisorId,
                },
                create: {
                    tenantId,
                    date: targetDate,
                    supervisorId,
                    operatorId: opId,
                },
            });
            createdAssignments.push(assignment);
        }
        res.status(201).json({
            success: true,
            count: createdAssignments.length,
            assignments: createdAssignments,
        });
    }
    catch (error) {
        console.error('Error assigning operators:', error);
        res.status(500).json({ error: 'Failed to assign operators' });
    }
};
exports.assignOperators = assignOperators;
// 8. Unassign an operator
const unassignOperator = async (req, res) => {
    try {
        const id = req.params.id;
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const existing = await prisma_1.default.dailyOperatorAssignment.findFirst({
            where: { id, tenantId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Operator assignment record not found' });
            return;
        }
        await prisma_1.default.dailyOperatorAssignment.delete({
            where: { id },
        });
        res.json({ success: true, message: 'Operator unassigned successfully' });
    }
    catch (error) {
        console.error('Error unassigning operator:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Operator assignment record not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to unassign operator' });
    }
};
exports.unassignOperator = unassignOperator;
// 9. Copy operator gangs from a past date to target date
const copyOperatorGangsFromDate = async (req, res) => {
    try {
        const { sourceDate, targetDate, supervisorIds, overwrite = true } = req.body;
        if (!sourceDate || !targetDate) {
            res.status(400).json({ error: 'sourceDate and targetDate are required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const srcDateParsed = parseDate(sourceDate);
        const tgtDateParsed = parseDate(targetDate);
        const sourceWhere = {
            tenantId,
            date: srcDateParsed,
        };
        if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
            sourceWhere.supervisorId = { in: supervisorIds };
        }
        const sourceAssignments = await prisma_1.default.dailyOperatorAssignment.findMany({
            where: sourceWhere,
        });
        if (sourceAssignments.length === 0) {
            res.json({
                success: true,
                copiedCount: 0,
                message: `No operator gang records found on ${sourceDate} to copy.`,
            });
            return;
        }
        if (overwrite !== false) {
            const deleteWhere = {
                tenantId,
                date: tgtDateParsed,
            };
            if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
                deleteWhere.supervisorId = { in: supervisorIds };
            }
            await prisma_1.default.dailyOperatorAssignment.deleteMany({
                where: deleteWhere,
            });
        }
        await prisma_1.default.dailyOperatorAssignment.createMany({
            data: sourceAssignments.map((src) => ({
                tenantId,
                date: tgtDateParsed,
                supervisorId: src.supervisorId,
                operatorId: src.operatorId,
            })),
            skipDuplicates: true,
        });
        res.json({
            success: true,
            copiedCount: sourceAssignments.length,
            message: `Successfully copied ${sourceAssignments.length} operator assignment(s) from ${sourceDate} to ${targetDate}.`,
        });
    }
    catch (error) {
        console.error('Error copying operator gangs from date:', error);
        res.status(500).json({ error: 'Failed to copy operator gangs from date' });
    }
};
exports.copyOperatorGangsFromDate = copyOperatorGangsFromDate;
// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT ASSIGNMENT CONTROLLER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────
// 10. Get equipment assignments for a specific date
const getEquipmentAssignmentsForDate = async (req, res) => {
    try {
        const dateStr = req.query.date;
        if (!dateStr) {
            res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const supervisorId = req.query.supervisorId;
        const targetDate = parseDate(dateStr);
        const where = {
            tenantId,
            date: targetDate,
        };
        if (supervisorId) {
            where.supervisorId = supervisorId;
        }
        const assignments = await prisma_1.default.dailyEquipmentAssignment.findMany({
            where,
            include: {
                supervisor: {
                    select: { id: true, fullName: true, username: true },
                },
                equipment: {
                    select: {
                        id: true,
                        code: true,
                        name: true,
                        type: true,
                        costRate: true,
                        primaryUnit: true,
                        availableUnits: true,
                        status: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const formatted = assignments.map((a) => ({
            id: a.id,
            date: dateStr,
            supervisorId: a.supervisorId,
            equipmentId: a.equipmentId,
            supervisorName: a.supervisor.fullName,
            equipmentName: a.equipment.name,
            equipmentCode: a.equipment.code || '',
            equipmentType: a.equipment.type || '',
            costRate: a.equipment.costRate !== null && a.equipment.costRate !== undefined ? Number(a.equipment.costRate) : 0,
            primaryUnit: a.equipment.primaryUnit || 'mth',
            availableUnits: a.equipment.availableUnits || [],
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching equipment assignments:', error);
        res.status(500).json({ error: 'Failed to fetch equipment assignments' });
    }
};
exports.getEquipmentAssignmentsForDate = getEquipmentAssignmentsForDate;
// 11. Assign equipment items to a supervisor for a date
const assignEquipment = async (req, res) => {
    try {
        const { date, supervisorId, equipmentIds } = req.body;
        if (!date || !supervisorId || !Array.isArray(equipmentIds) || equipmentIds.length === 0) {
            res.status(400).json({ error: 'date, supervisorId, and non-empty equipmentIds array are required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const createdAssignments = [];
        for (const eqId of equipmentIds) {
            const assignment = await prisma_1.default.dailyEquipmentAssignment.upsert({
                where: {
                    tenantId_date_equipmentId: {
                        tenantId,
                        date: targetDate,
                        equipmentId: eqId,
                    },
                },
                update: {
                    supervisorId,
                },
                create: {
                    tenantId,
                    date: targetDate,
                    supervisorId,
                    equipmentId: eqId,
                },
            });
            createdAssignments.push(assignment);
        }
        res.status(201).json({
            success: true,
            count: createdAssignments.length,
            assignments: createdAssignments,
        });
    }
    catch (error) {
        console.error('Error assigning equipment:', error);
        res.status(500).json({ error: 'Failed to assign equipment' });
    }
};
exports.assignEquipment = assignEquipment;
// 12. Unassign an equipment item
const unassignEquipment = async (req, res) => {
    try {
        const id = req.params.id;
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const existing = await prisma_1.default.dailyEquipmentAssignment.findFirst({
            where: { id, tenantId },
        });
        if (!existing) {
            res.status(404).json({ error: 'Equipment assignment record not found' });
            return;
        }
        await prisma_1.default.dailyEquipmentAssignment.delete({
            where: { id },
        });
        res.json({ success: true, message: 'Equipment unassigned successfully' });
    }
    catch (error) {
        console.error('Error unassigning equipment:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Equipment assignment record not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to unassign equipment' });
    }
};
exports.unassignEquipment = unassignEquipment;
// 13. Copy equipment gangs from a past date to target date
const copyEquipmentGangsFromDate = async (req, res) => {
    try {
        const { sourceDate, targetDate, supervisorIds, overwrite = true } = req.body;
        if (!sourceDate || !targetDate) {
            res.status(400).json({ error: 'sourceDate and targetDate are required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const srcDateParsed = parseDate(sourceDate);
        const tgtDateParsed = parseDate(targetDate);
        const sourceWhere = {
            tenantId,
            date: srcDateParsed,
        };
        if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
            sourceWhere.supervisorId = { in: supervisorIds };
        }
        const sourceAssignments = await prisma_1.default.dailyEquipmentAssignment.findMany({
            where: sourceWhere,
        });
        if (sourceAssignments.length === 0) {
            res.json({
                success: true,
                copiedCount: 0,
                message: `No equipment gang records found on ${sourceDate} to copy.`,
            });
            return;
        }
        if (overwrite !== false) {
            const deleteWhere = {
                tenantId,
                date: tgtDateParsed,
            };
            if (Array.isArray(supervisorIds) && supervisorIds.length > 0) {
                deleteWhere.supervisorId = { in: supervisorIds };
            }
            await prisma_1.default.dailyEquipmentAssignment.deleteMany({
                where: deleteWhere,
            });
        }
        await prisma_1.default.dailyEquipmentAssignment.createMany({
            data: sourceAssignments.map((src) => ({
                tenantId,
                date: tgtDateParsed,
                supervisorId: src.supervisorId,
                equipmentId: src.equipmentId,
            })),
            skipDuplicates: true,
        });
        res.json({
            success: true,
            copiedCount: sourceAssignments.length,
            message: `Successfully copied ${sourceAssignments.length} equipment assignment(s) from ${sourceDate} to ${targetDate}.`,
        });
    }
    catch (error) {
        console.error('Error copying equipment gangs from date:', error);
        res.status(500).json({ error: 'Failed to copy equipment gangs from date' });
    }
};
exports.copyEquipmentGangsFromDate = copyEquipmentGangsFromDate;
