"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchSetCalendarDays = exports.setCalendarDay = exports.getCalendarMonth = exports.getDayTypes = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
// Standard 5 fixed day types used in construction
const DEFAULT_DAY_TYPES = [
    { name: 'Normal Day', code: 'normal', rateMultiplier: 1.0 },
    { name: 'Saturday', code: 'saturday', rateMultiplier: 1.0 },
    { name: 'Sunday', code: 'sunday', rateMultiplier: 1.5 },
    { name: 'Shutdown', code: 'shutdown', rateMultiplier: 1.0 },
    { name: 'Public Holiday', code: 'public_holiday', rateMultiplier: 2.0 },
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
                name: { equals: dt.name, mode: 'insensitive' },
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
function formatDate(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// 1. GET /api/calendar/day-types
const getDayTypes = async (req, res) => {
    try {
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
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
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        await ensureSeedDayTypes(tenantId);
        const year = parseInt(req.query.year, 10) || new Date().getFullYear();
        // month is 0-indexed (0..11) from frontend
        const month = parseInt(req.query.month, 10) ?? new Date().getMonth();
        const startDate = new Date(Date.UTC(year, month, 1));
        const daysInMonth = new Date(year, month + 1, 0).getDate();
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
            savedMap.set(formatDate(new Date(sd.date)), sd.dayTypeId);
        });
        // Build complete month array
        const entries = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const date = new Date(year, month, d);
            const key = formatDate(date);
            const dow = date.getDay(); // 0 = Sun, 6 = Sat
            let dayTypeId = savedMap.get(key);
            if (!dayTypeId) {
                if (dow === 0 && sunType)
                    dayTypeId = sunType.id;
                else if (dow === 6 && satType)
                    dayTypeId = satType.id;
                else
                    dayTypeId = normalType ? normalType.id : '';
            }
            entries.push({ date: key, dayTypeId });
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
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { date: dateStr, dayTypeId } = req.body;
        if (!dateStr || !dayTypeId) {
            res.status(400).json({ error: 'date and dayTypeId are required' });
            return;
        }
        const date = new Date(dateStr);
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
        res.json({
            date: formatDate(new Date(entry.date)),
            dayTypeId: entry.dayTypeId,
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
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { entries } = req.body; // Array of { date: string, dayTypeId: string }
        if (!Array.isArray(entries) || entries.length === 0) {
            res.status(400).json({ error: 'entries array is required' });
            return;
        }
        const results = await prisma_1.default.$transaction(entries.map((item) => prisma_1.default.calendarDay.upsert({
            where: {
                tenantId_date: {
                    tenantId,
                    date: new Date(item.date),
                },
            },
            update: {
                dayTypeId: item.dayTypeId,
            },
            create: {
                tenantId,
                date: new Date(item.date),
                dayTypeId: item.dayTypeId,
            },
        })));
        res.json({ updatedCount: results.length });
    }
    catch (error) {
        console.error('Error batch setting calendar days:', error);
        res.status(500).json({ error: 'Failed to batch set calendar days' });
    }
};
exports.batchSetCalendarDays = batchSetCalendarDays;
