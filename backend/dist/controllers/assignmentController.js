"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.copyGangsFromDate = exports.unassignEmployee = exports.assignEmployees = exports.getRecentGangSummaries = exports.getAssignmentsForDate = void 0;
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
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
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
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const limitDays = parseInt(req.query.days, 10) || 5;
        // Fetch distinct assignment dates
        const distinctDates = await prisma_1.default.dailyAssignment.findMany({
            where: { tenantId },
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
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
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
        const { sourceDate, targetDate, supervisorIds } = req.body;
        if (!sourceDate || !targetDate) {
            res.status(400).json({ error: 'sourceDate and targetDate are required' });
            return;
        }
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
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
        // Upsert each source assignment into the target date
        const copied = [];
        for (const src of sourceAssignments) {
            const result = await prisma_1.default.dailyAssignment.upsert({
                where: {
                    tenantId_date_employeeId: {
                        tenantId,
                        date: tgtDateParsed,
                        employeeId: src.employeeId,
                    },
                },
                update: {
                    supervisorId: src.supervisorId,
                },
                create: {
                    tenantId,
                    date: tgtDateParsed,
                    supervisorId: src.supervisorId,
                    employeeId: src.employeeId,
                },
            });
            copied.push(result);
        }
        res.json({
            success: true,
            copiedCount: copied.length,
            message: `Successfully copied ${copied.length} gang assignment(s) from ${sourceDate} to ${targetDate}.`,
        });
    }
    catch (error) {
        console.error('Error copying gangs from date:', error);
        res.status(500).json({ error: 'Failed to copy gangs from date' });
    }
};
exports.copyGangsFromDate = copyGangsFromDate;
