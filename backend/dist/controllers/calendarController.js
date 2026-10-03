"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSupervisorReminders = exports.setCalendarEvents = exports.getCalendarEvents = exports.batchSetCalendarDays = exports.setCalendarDay = exports.getCalendarMonth = exports.getDayTypes = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
const timeEntryController_1 = require("./timeEntryController");
// Standard 5 fixed day types used in construction
const DEFAULT_DAY_TYPES = [
    { name: 'Normal Day', code: 'normal', rateMultiplier: 1.0 },
    { name: 'Saturday', code: 'saturday', rateMultiplier: 1.0 },
    { name: 'Sunday', code: 'sunday', rateMultiplier: 1.5 },
    { name: 'Shutdown', code: 'shutdown', rateMultiplier: 1.0 },
    { name: 'Poya / Holiday', code: 'public_holiday', rateMultiplier: 2.0 },
];
function deriveCode(name) {
    const lower = name.toLowerCase();
    if (lower.includes('sunday'))
        return 'sunday';
    if (lower.includes('saturday'))
        return 'saturday';
    if (lower.includes('shutdown'))
        return 'shutdown';
    if (lower.includes('public holiday') || lower.includes('holiday') || lower.includes('poya'))
        return 'public_holiday';
    return 'normal';
}
async function ensureSeedDayTypes(tenantId) {
    for (const dt of DEFAULT_DAY_TYPES) {
        const existing = await prisma_1.default.dayType.findFirst({
            where: {
                tenantId,
                OR: [
                    { name: { equals: dt.name, mode: 'insensitive' } },
                    ...(dt.code === 'public_holiday' ? [{ name: { equals: 'Public Holiday', mode: 'insensitive' } }] : []),
                ],
            },
        });
        if (!existing) {
            await prisma_1.default.dayType.create({
                data: {
                    tenantId,
                    name: dt.name,
                    rateMultiplier: dt.rateMultiplier,
                },
            });
        }
    }
}
function parseCalendarDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}
function formatUtcDate(d) {
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
/**
 * Helper: Recalculate hours and overtime for all open (draft/submitted) time entries
 * when the calendar Day Type for a date is changed by Admin.
 */
async function recalculateUnapprovedEntriesForDate(tenantId, date) {
    const rules = await (0, timeEntryController_1.getDayTypeRulesAndId)(tenantId, date);
    const unapproved = await prisma_1.default.timeEntry.findMany({
        where: {
            tenantId,
            date,
            status: { in: ['draft', 'submitted'] },
        },
    });
    if (unapproved.length > 0) {
        for (const entry of unapproved) {
            const netHours = Number(entry.hours) || 0;
            let otHours = 0;
            if (rules.isAllOvertime) {
                otHours = netHours;
            }
            else if (netHours > rules.standardHoursCap) {
                otHours = Math.round((netHours - rules.standardHoursCap) * 100) / 100;
            }
            else {
                otHours = 0;
            }
            await prisma_1.default.timeEntry.update({
                where: { id: entry.id },
                data: {
                    effectiveDayTypeId: rules.effectiveDayTypeId,
                    overtimeHours: otHours,
                },
            });
        }
    }
    // Also adjust unapproved OperatorTimeEntry records if any exist
    const operatorAssignments = await prisma_1.default.dailyOperatorAssignment.findMany({
        where: { tenantId, date },
        include: { timeEntry: true },
    });
    for (const oa of operatorAssignments) {
        if (oa.timeEntry && oa.timeEntry.status !== 'done') {
            const shiftHours = Number(oa.timeEntry.shiftHours) || 0;
            const totalHours = shiftHours + (Number(oa.timeEntry.otHours) || 0);
            let newOt = 0;
            let newShift = shiftHours;
            if (rules.isAllOvertime) {
                newOt = totalHours;
                newShift = 0;
            }
            else if (totalHours > rules.standardHoursCap) {
                newShift = rules.standardHoursCap;
                newOt = Math.round((totalHours - rules.standardHoursCap) * 100) / 100;
            }
            else {
                newShift = totalHours;
                newOt = 0;
            }
            await prisma_1.default.operatorTimeEntry.update({
                where: { id: oa.timeEntry.id },
                data: {
                    shiftHours: newShift,
                    otHours: newOt,
                },
            });
        }
    }
    return unapproved.length;
}
// 1. GET /api/calendar/day-types
const getDayTypes = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        await ensureSeedDayTypes(tenantId);
        const types = await prisma_1.default.dayType.findMany({
            where: { tenantId },
            orderBy: { createdAt: 'asc' },
        });
        const formatted = types.map((t) => ({
            id: t.id,
            name: t.name,
            code: deriveCode(t.name),
            rateMultiplier: Number(t.rateMultiplier) || 1.0,
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching day types:', error);
        res.status(500).json({ error: 'Failed to fetch day types' });
    }
};
exports.getDayTypes = getDayTypes;
// 2. GET /api/calendar?year=&month=&tenantId=
const getCalendarMonth = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        await ensureSeedDayTypes(tenantId);
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        // month is 0-indexed (0..11) from frontend
        const month = parseInt(req.query.month, 10) ?? new Date().getMonth();
        const startDate = new Date(Date.UTC(year, month, 1, 0, 0, 0));
        const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
        const endDate = new Date(Date.UTC(year, month, daysInMonth, 23, 59, 59));
        // Get all day types for default mapping
        const allTypes = await prisma_1.default.dayType.findMany({ where: { tenantId } });
        const normalType = allTypes.find((t) => deriveCode(t.name) === 'normal') || allTypes[0];
        const satType = allTypes.find((t) => deriveCode(t.name) === 'saturday') || normalType;
        const sunType = allTypes.find((t) => deriveCode(t.name) === 'sunday') || normalType;
        // Fetch explicitly marked calendar days
        const savedDays = await prisma_1.default.calendarDay.findMany({
            where: {
                tenantId,
                date: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            include: { dayType: true },
        });
        const savedMap = new Map();
        savedDays.forEach((sd) => {
            savedMap.set(formatUtcDate(new Date(sd.date)), {
                dayTypeId: sd.dayTypeId,
                remarks: sd.remarks,
            });
        });
        // Build complete month array
        const entries = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(Date.UTC(year, month, d));
            const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dow = date.getUTCDay(); // 0 = Sun, 6 = Sat
            const savedItem = savedMap.get(key);
            let dayTypeId = savedItem?.dayTypeId;
            if (!dayTypeId) {
                if (dow === 0 && sunType)
                    dayTypeId = sunType.id;
                else if (dow === 6 && satType)
                    dayTypeId = satType.id;
                else
                    dayTypeId = normalType ? normalType.id : '';
            }
            entries.push({ date: key, dayTypeId, remarks: savedItem?.remarks || null });
        }
        res.json(entries);
    }
    catch (error) {
        console.error('Error fetching calendar month:', error);
        res.status(500).json({ error: 'Failed to fetch calendar entries' });
    }
};
exports.getCalendarMonth = getCalendarMonth;
// 3. POST /api/calendar/set-day
const setCalendarDay = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { date: dateStr, dayTypeId } = req.body;
        if (!dateStr || !dayTypeId) {
            res.status(400).json({ error: 'date and dayTypeId are required' });
            return;
        }
        const date = parseCalendarDate(dateStr);
        // Guard: Prevent day type alteration if entries are already approved by Admin
        const approvedCount = await prisma_1.default.timeEntry.count({
            where: {
                tenantId,
                date,
                status: 'approved',
            },
        });
        if (approvedCount > 0) {
            res.status(400).json({
                error: `Cannot change Day Type: ${approvedCount} time entry record(s) on ${dateStr} are already Approved by Admin. Please return records to draft in Approvals before changing calendar settings.`,
                isLocked: true,
            });
            return;
        }
        const entry = await prisma_1.default.calendarDay.upsert({
            where: {
                tenantId_date: {
                    tenantId,
                    date,
                },
            },
            update: {
                dayTypeId,
            },
            create: {
                tenantId,
                date,
                dayTypeId,
            },
        });
        // Cascade: Automatically recalculate open (draft/submitted) time entries
        const recalculatedCount = await recalculateUnapprovedEntriesForDate(tenantId, date);
        res.json({
            date: formatUtcDate(new Date(entry.date)),
            dayTypeId: entry.dayTypeId,
            recalculatedCount,
            message: recalculatedCount > 0
                ? `Day type updated and ${recalculatedCount} open time entries recalculated.`
                : 'Day type updated successfully.',
        });
    }
    catch (error) {
        console.error('Error setting calendar day:', error);
        res.status(500).json({ error: 'Failed to set calendar day' });
    }
};
exports.setCalendarDay = setCalendarDay;
// 4. POST /api/calendar/batch-set
const batchSetCalendarDays = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { entries } = req.body; // Array of { date: string, dayTypeId: string }
        if (!Array.isArray(entries) || entries.length === 0) {
            res.status(400).json({ error: 'entries array is required' });
            return;
        }
        let updatedCount = 0;
        let totalRecalculated = 0;
        for (const item of entries) {
            const date = parseCalendarDate(item.date);
            // Check if approved records exist; skip if approved
            const approvedCount = await prisma_1.default.timeEntry.count({
                where: { tenantId, date, status: 'approved' },
            });
            if (approvedCount > 0) {
                continue;
            }
            await prisma_1.default.calendarDay.upsert({
                where: {
                    tenantId_date: {
                        tenantId,
                        date,
                    },
                },
                update: {
                    dayTypeId: item.dayTypeId,
                },
                create: {
                    tenantId,
                    date,
                    dayTypeId: item.dayTypeId,
                },
            });
            const recCount = await recalculateUnapprovedEntriesForDate(tenantId, date);
            totalRecalculated += recCount;
            updatedCount++;
        }
        res.json({ updatedCount, totalRecalculated });
    }
    catch (error) {
        console.error('Error batch setting calendar days:', error);
        res.status(500).json({ error: 'Failed to batch set calendar days' });
    }
};
exports.batchSetCalendarDays = batchSetCalendarDays;
// 5. GET /api/calendar/events?date=YYYY-MM-DD
const getCalendarEvents = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const dateStr = req.query.date;
        if (!dateStr) {
            res.status(400).json({ error: 'date query parameter is required' });
            return;
        }
        const date = parseCalendarDate(dateStr);
        const day = await prisma_1.default.calendarDay.findUnique({
            where: {
                tenantId_date: {
                    tenantId,
                    date,
                },
            },
        });
        let events = [];
        if (day?.remarks) {
            try {
                events = JSON.parse(day.remarks);
                if (!Array.isArray(events))
                    events = [];
            }
            catch {
                events = [];
            }
        }
        res.json({ date: dateStr, events });
    }
    catch (error) {
        console.error('Error fetching calendar events:', error);
        res.status(500).json({ error: 'Failed to fetch calendar events' });
    }
};
exports.getCalendarEvents = getCalendarEvents;
// 6. POST /api/calendar/events
const setCalendarEvents = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { date: dateStr, events } = req.body;
        if (!dateStr || !Array.isArray(events)) {
            res.status(400).json({ error: 'date and events array are required' });
            return;
        }
        const date = parseCalendarDate(dateStr);
        const remarksJson = JSON.stringify(events);
        // If day exists, update remarks. If not, determine default day type and create.
        const allTypes = await prisma_1.default.dayType.findMany({ where: { tenantId } });
        const normalType = allTypes.find((t) => deriveCode(t.name) === 'normal') || allTypes[0];
        const satType = allTypes.find((t) => deriveCode(t.name) === 'saturday') || normalType;
        const sunType = allTypes.find((t) => deriveCode(t.name) === 'sunday') || normalType;
        const dow = date.getUTCDay();
        let defaultDayTypeId = normalType ? normalType.id : '';
        if (dow === 0 && sunType)
            defaultDayTypeId = sunType.id;
        else if (dow === 6 && satType)
            defaultDayTypeId = satType.id;
        const entry = await prisma_1.default.calendarDay.upsert({
            where: {
                tenantId_date: {
                    tenantId,
                    date,
                },
            },
            update: {
                remarks: remarksJson,
            },
            create: {
                tenantId,
                date,
                dayTypeId: defaultDayTypeId,
                remarks: remarksJson,
            },
        });
        res.json({
            success: true,
            date: formatUtcDate(new Date(entry.date)),
            events,
        });
    }
    catch (error) {
        console.error('Error saving calendar events:', error);
        res.status(500).json({ error: 'Failed to save calendar events' });
    }
};
exports.setCalendarEvents = setCalendarEvents;
// 7. GET /api/calendar/supervisor-reminders?supervisorId=...&date=...
const getSupervisorReminders = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const supervisorId = req.query.supervisorId;
        const dateStr = req.query.date;
        if (!dateStr) {
            res.status(400).json({ error: 'date query parameter is required' });
            return;
        }
        const date = parseCalendarDate(dateStr);
        const day = await prisma_1.default.calendarDay.findUnique({
            where: {
                tenantId_date: {
                    tenantId,
                    date,
                },
            },
        });
        let allEvents = [];
        if (day?.remarks) {
            try {
                allEvents = JSON.parse(day.remarks);
                if (!Array.isArray(allEvents))
                    allEvents = [];
            }
            catch {
                allEvents = [];
            }
        }
        // Filter events targeted for all supervisors or this specific supervisor
        const relevantReminders = allEvents.filter((evt) => {
            if (!evt.targetSupervisorId)
                return false;
            if (evt.targetSupervisorId === 'ADMIN_ONLY')
                return false;
            if (evt.targetSupervisorId === 'ALL')
                return true;
            if (supervisorId && evt.targetSupervisorId === supervisorId)
                return true;
            return false;
        });
        res.json({
            date: dateStr,
            reminders: relevantReminders,
            count: relevantReminders.length,
        });
    }
    catch (error) {
        console.error('Error fetching supervisor reminders:', error);
        res.status(500).json({ error: 'Failed to fetch supervisor reminders' });
    }
};
exports.getSupervisorReminders = getSupervisorReminders;
