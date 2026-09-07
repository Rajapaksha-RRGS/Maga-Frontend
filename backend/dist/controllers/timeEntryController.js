"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitDay = exports.getTimeEntries = exports.upsertTimeEntry = exports.assignActivityBulk = exports.checkInEmployee = exports.getAssignedEmployees = void 0;
exports.getDayTypeRulesAndId = getDayTypeRulesAndId;
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
async function getDayTypeRulesAndId(tenantId, date) {
    // 1. Check if calendar day holiday/special day exists in CalendarDay table
    const calendarDay = await prisma_1.default.calendarDay.findUnique({
        where: {
            tenantId_date: {
                tenantId,
                date,
            },
        },
        include: { dayType: true },
    });
    if (calendarDay && calendarDay.dayType) {
        const name = calendarDay.dayType.name.toLowerCase();
        const isHoliday = name.includes('poya') ||
            name.includes('holiday') ||
            name.includes('sunday') ||
            name.includes('shutdown');
        return {
            effectiveDayTypeId: calendarDay.dayTypeId,
            standardHoursCap: isHoliday ? 0.0 : 8.0,
            isAllOvertime: isHoliday,
            dayTypeName: calendarDay.dayType.name,
        };
    }
    // 2. Determine Day Type from day of the week
    // 0 = Sunday, 6 = Saturday, 1..5 = Monday..Friday
    const dayOfWeek = date.getUTCDay();
    if (dayOfWeek === 0) {
        // Sunday: 0.0 normal hours, 100% overtime for all hours worked
        let sundayType = await prisma_1.default.dayType.findFirst({
            where: { tenantId, name: 'Sunday' },
        });
        if (!sundayType) {
            sundayType = await prisma_1.default.dayType.create({
                data: { tenantId, name: 'Sunday', rateMultiplier: 1.5 },
            });
        }
        return {
            effectiveDayTypeId: sundayType.id,
            standardHoursCap: 0.0,
            isAllOvertime: true,
            dayTypeName: 'Sunday',
        };
    }
    if (dayOfWeek === 6) {
        // Saturday: Half-day (07:00 to 13:00 = 6.0 standard hours), hours after 13:00 (>6h) are OT
        let satType = await prisma_1.default.dayType.findFirst({
            where: { tenantId, name: 'Saturday' },
        });
        if (!satType) {
            satType = await prisma_1.default.dayType.create({
                data: { tenantId, name: 'Saturday', rateMultiplier: 1.0 },
            });
        }
        return {
            effectiveDayTypeId: satType.id,
            standardHoursCap: 6.0,
            isAllOvertime: false,
            dayTypeName: 'Saturday',
        };
    }
    // Monday to Friday: Standard Normal Day (8.0 hours standard, >8h is OT)
    let normalDay = await prisma_1.default.dayType.findFirst({
        where: { tenantId, name: 'Normal Day' },
    });
    if (!normalDay) {
        normalDay = await prisma_1.default.dayType.create({
            data: { tenantId, name: 'Normal Day', rateMultiplier: 1.0 },
        });
    }
    return {
        effectiveDayTypeId: normalDay.id,
        standardHoursCap: 8.0,
        isAllOvertime: false,
        dayTypeName: 'Normal Day',
    };
}
// 1. Get assigned employees for supervisor & date
const getAssignedEmployees = async (req, res) => {
    try {
        const supervisorId = req.query.supervisorId;
        const dateStr = req.query.date;
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const parsedDate = dateStr ? new Date(dateStr) : new Date();
        // Check DailyAssignment table
        let assignedRecords = [];
        if (supervisorId) {
            assignedRecords = await prisma_1.default.dailyAssignment.findMany({
                where: {
                    tenantId,
                    supervisorId,
                    date: parsedDate,
                },
                include: {
                    employee: {
                        include: { businessPartner: true },
                    },
                },
            });
        }
        // If assignments exist, return those
        if (assignedRecords.length > 0) {
            const result = assignedRecords.map((rec) => ({
                id: rec.employee.id,
                employeeCode: rec.employee.employeeCode,
                callingName: rec.employee.callingName,
                fullName: rec.employee.fullName || rec.employee.callingName,
                tradeGroup: rec.employee.tradeGroup || 'General labour',
                businessPartner: rec.employee.businessPartner?.name || 'Direct',
            }));
            res.json(result);
            return;
        }
        // Fallback: If no daily assignments configured for today yet, return active employees
        const allEmployees = await prisma_1.default.employee.findMany({
            where: {
                tenantId,
                status: 'active',
            },
            include: {
                businessPartner: true,
            },
            orderBy: { employeeCode: 'asc' },
        });
        const formatted = allEmployees.map((emp) => ({
            id: emp.id,
            employeeCode: emp.employeeCode,
            callingName: emp.callingName,
            fullName: emp.fullName || emp.callingName,
            tradeGroup: emp.tradeGroup || 'General labour',
            businessPartner: emp.businessPartner?.name || 'Direct',
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching assigned employees:', error);
        res.status(500).json({ error: 'Failed to fetch assigned employees' });
    }
};
exports.getAssignedEmployees = getAssignedEmployees;
// 2. Check-in employee
const checkInEmployee = async (req, res) => {
    try {
        const { employeeId, supervisorId, date, inTime } = req.body;
        if (!employeeId || !inTime) {
            res.status(400).json({ error: 'employeeId and inTime are required' });
            return;
        }
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const entryDate = date ? new Date(date) : new Date();
        // Check if a time entry already exists for this employee and date
        const existing = await prisma_1.default.timeEntry.findFirst({
            where: {
                tenantId,
                employeeId,
                date: entryDate,
            },
        });
        if (existing) {
            const updated = await prisma_1.default.timeEntry.update({
                where: { id: existing.id },
                data: { inTime },
            });
            res.json({ success: true, employeeId, inTime, entryId: updated.id });
            return;
        }
        res.json({ success: true, employeeId, inTime });
    }
    catch (error) {
        console.error('Error in checkInEmployee:', error);
        res.status(500).json({ error: 'Failed to record check-in' });
    }
};
exports.checkInEmployee = checkInEmployee;
// 3. Bulk Activity Assignment (Main logic for ActivityAssignPage)
const assignActivityBulk = async (req, res) => {
    try {
        const { employeeIds, activityId, hours, date, supervisorId, equipmentId, remarks, } = req.body;
        if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
            res.status(400).json({ error: 'employeeIds array must contain at least one ID' });
            return;
        }
        if (!activityId) {
            res.status(400).json({ error: 'activityId is required' });
            return;
        }
        const numHours = parseFloat(hours);
        if (isNaN(numHours) || numHours <= 0) {
            res.status(400).json({ error: 'Valid positive hours number is required' });
            return;
        }
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const targetDate = date ? new Date(date) : new Date();
        const { effectiveDayTypeId, standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);
        // Resolve supervisor ID
        let finalSupervisorId = supervisorId;
        if (!finalSupervisorId) {
            const supUser = await prisma_1.default.user.findFirst({
                where: { tenantId, role: 'supervisor' },
            });
            finalSupervisorId = supUser?.id;
        }
        if (!finalSupervisorId) {
            // Create or fallback to default supervisor
            const sup = await prisma_1.default.user.upsert({
                where: { tenantId_username: { tenantId, username: 'supervisor1' } },
                update: {},
                create: {
                    tenantId,
                    username: 'supervisor1',
                    fullName: 'Site Supervisor',
                    role: 'supervisor',
                    passwordHash: 'dummy',
                },
            });
            finalSupervisorId = sup.id;
        }
        const createdEntries = [];
        for (const empId of employeeIds) {
            // Calculate total daily hours for this employee on this date
            const existingEntries = await prisma_1.default.timeEntry.findMany({
                where: {
                    tenantId,
                    employeeId: empId,
                    date: targetDate,
                },
            });
            const previousHours = existingEntries.reduce((acc, curr) => acc + Number(curr.hours), 0);
            const newTotalHours = previousHours + numHours;
            // Construction site OT rules:
            // - Sunday / Poya / Holiday: 100% of all hours are Overtime (standardCap = 0)
            // - Saturday: Half-day 07:00 to 13:00 (standardCap = 6.0), hours > 6.0 are Overtime
            // - Normal Day: standardCap = 8.0, hours > 8.0 are Overtime
            let overtimeHours = 0;
            if (isAllOvertime) {
                overtimeHours = numHours;
            }
            else if (newTotalHours > standardHoursCap) {
                if (previousHours >= standardHoursCap) {
                    overtimeHours = numHours;
                }
                else {
                    overtimeHours = newTotalHours - standardHoursCap;
                }
            }
            // Check if this specific activity entry already exists for this employee on this date
            const existingActivityEntry = existingEntries.find((e) => e.activityId === activityId);
            if (existingActivityEntry) {
                const updated = await prisma_1.default.timeEntry.update({
                    where: { id: existingActivityEntry.id },
                    data: {
                        hours: numHours,
                        overtimeHours,
                        equipmentId: equipmentId || existingActivityEntry.equipmentId,
                        remarks: remarks || existingActivityEntry.remarks,
                    },
                });
                createdEntries.push(updated);
            }
            else {
                const created = await prisma_1.default.timeEntry.create({
                    data: {
                        tenantId,
                        employeeId: empId,
                        supervisorId: finalSupervisorId,
                        activityId,
                        equipmentId: equipmentId || null,
                        effectiveDayTypeId,
                        date: targetDate,
                        hours: numHours,
                        overtimeHours,
                        remarks: remarks || null,
                        status: 'draft',
                    },
                });
                createdEntries.push(created);
            }
        }
        res.status(201).json({
            success: true,
            count: createdEntries.length,
            entries: createdEntries,
        });
    }
    catch (error) {
        console.error('Error in assignActivityBulk:', error);
        res.status(500).json({ error: 'Failed to assign activity in bulk' });
    }
};
exports.assignActivityBulk = assignActivityBulk;
// 4. Upsert single time entry
const upsertTimeEntry = async (req, res) => {
    try {
        const { employeeId, supervisorId, date, activityId, equipmentId, hours, inTime, outTime, remarks, } = req.body;
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const targetDate = date ? new Date(date) : new Date();
        const { effectiveDayTypeId, standardHoursCap, isAllOvertime } = await getDayTypeRulesAndId(tenantId, targetDate);
        const numHours = hours !== undefined ? parseFloat(hours) : 0;
        let overtimeHours = 0;
        if (isAllOvertime) {
            overtimeHours = numHours;
        }
        else if (numHours > standardHoursCap) {
            overtimeHours = numHours - standardHoursCap;
        }
        const existing = await prisma_1.default.timeEntry.findFirst({
            where: {
                tenantId,
                employeeId,
                activityId,
                date: targetDate,
            },
        });
        if (existing) {
            const updated = await prisma_1.default.timeEntry.update({
                where: { id: existing.id },
                data: {
                    hours: numHours,
                    overtimeHours,
                    inTime: inTime ?? existing.inTime,
                    outTime: outTime ?? existing.outTime,
                    equipmentId: equipmentId ?? existing.equipmentId,
                    remarks: remarks ?? existing.remarks,
                },
            });
            res.json(updated);
            return;
        }
        const created = await prisma_1.default.timeEntry.create({
            data: {
                tenantId,
                employeeId,
                supervisorId,
                activityId,
                equipmentId: equipmentId || null,
                effectiveDayTypeId,
                date: targetDate,
                hours: numHours,
                overtimeHours,
                inTime: inTime || null,
                outTime: outTime || null,
                remarks: remarks || null,
                status: 'draft',
            },
        });
        res.status(201).json(created);
    }
    catch (error) {
        console.error('Error upserting time entry:', error);
        res.status(500).json({ error: 'Failed to save time entry' });
    }
};
exports.upsertTimeEntry = upsertTimeEntry;
// 5. Get time entries
const getTimeEntries = async (req, res) => {
    try {
        const { date, supervisorId, employeeId, status } = req.query;
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const where = { tenantId };
        if (date && typeof date === 'string') {
            where.date = new Date(date);
        }
        if (supervisorId && typeof supervisorId === 'string') {
            where.supervisorId = supervisorId;
        }
        if (employeeId && typeof employeeId === 'string') {
            where.employeeId = employeeId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        const entries = await prisma_1.default.timeEntry.findMany({
            where,
            include: {
                employee: {
                    include: { businessPartner: true },
                },
                activity: true,
                equipment: true,
                effectiveDayType: true,
                supervisor: {
                    select: { id: true, fullName: true, username: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(entries);
    }
    catch (error) {
        console.error('Error fetching time entries:', error);
        res.status(500).json({ error: 'Failed to fetch time entries' });
    }
};
exports.getTimeEntries = getTimeEntries;
// 6. Submit day (Locks daily entries)
const submitDay = async (req, res) => {
    try {
        const { supervisorId, date } = req.body;
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const targetDate = date ? new Date(date) : new Date();
        const whereClause = {
            tenantId,
            date: targetDate,
            status: 'draft',
        };
        if (supervisorId) {
            whereClause.supervisorId = supervisorId;
        }
        const updated = await prisma_1.default.timeEntry.updateMany({
            where: whereClause,
            data: {
                status: 'submitted',
                submittedAt: new Date(),
            },
        });
        res.json({
            success: true,
            submittedCount: updated.count,
            message: `Successfully submitted ${updated.count} daily time entry record(s).`,
        });
    }
    catch (error) {
        console.error('Error submitting day:', error);
        res.status(500).json({ error: 'Failed to submit daily entries' });
    }
};
exports.submitDay = submitDay;
