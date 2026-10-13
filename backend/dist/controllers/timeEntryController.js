"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveBulkLaborTimeEntries = exports.saveBulkEquipmentLogs = exports.saveBulkOperatorEntries = exports.saveOperatorEntry = exports.getOperatorEntries = exports.adminAdjustWorkerTimeEntry = exports.rejectTimeEntries = exports.approveTimeEntries = exports.getApprovalOverview = exports.getDayStatus = exports.submitDay = exports.getTimeEntries = exports.upsertTimeEntry = exports.assignActivityBulk = exports.checkOutEmployee = exports.checkInEmployee = exports.getAssignedEmployees = exports.getDayTypeRulesAndId = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
require("../middleware/tenantMiddleware");
const tenantHelper_1 = require("../utils/tenantHelper");
const calendarController_1 = require("./calendarController");
Object.defineProperty(exports, "getDayTypeRulesAndId", { enumerable: true, get: function () { return calendarController_1.getDayTypeRulesAndId; } });
// Helper: parse date to UTC midnight for date column
function parseDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day));
}
// Helper: compute lunch break hours between 12:00 and 13:00
function computeBreakHours(inTime, outTime) {
    if (!inTime || !outTime)
        return 0;
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const inMins = inH * 60 + inM;
    const outMins = outH * 60 + outM;
    const lunchStart = 12 * 60;
    const lunchEnd = 13 * 60;
    if (inMins < lunchEnd && outMins > lunchStart) {
        const overlapStart = Math.max(inMins, lunchStart);
        const overlapEnd = Math.min(outMins, lunchEnd);
        return Math.round(((overlapEnd - overlapStart) / 60) * 100) / 100;
    }
    return 0;
}
// Helper: calculate gross shift hours, break hours, and overtime
function calculateShiftAndOvertime(inTime, outTime, standardHoursCap, isAllOvertime) {
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    let diff = outH * 60 + outM - (inH * 60 + inM);
    if (diff < 0)
        diff += 24 * 60;
    const grossHours = Math.round((diff / 60) * 100) / 100;
    const breakHours = computeBreakHours(inTime, outTime);
    const shiftHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);
    let otHours = 0;
    if (isAllOvertime) {
        otHours = shiftHours;
    }
    else if (shiftHours > standardHoursCap) {
        otHours = Math.round((shiftHours - standardHoursCap) * 100) / 100;
    }
    return { shiftHours, otHours, breakHours };
}
async function getOrCreateDailySheet(projectId, supervisorId, date) {
    return await prisma_1.default.mF_OP_DailySheet.upsert({
        where: {
            projectId_supervisorId_date: {
                projectId,
                supervisorId,
                date,
            },
        },
        update: {},
        create: {
            projectId,
            supervisorId,
            date,
            status: 'draft',
        },
    });
}
async function getOrCreateDefaultActivityId(projectId) {
    const existing = await prisma_1.default.mF_P_ActivityCode.findFirst({
        where: { projectId },
        orderBy: { code: 'asc' },
        select: { id: true },
    });
    if (existing)
        return existing.id;
    const created = await prisma_1.default.mF_P_ActivityCode.create({
        data: {
            projectId,
            code: 'GEN-01',
            description: 'General Site Works',
        },
        select: { id: true },
    });
    return created.id;
}
async function resolveProjectActivityId(rawActivityId, projectId, cache) {
    if (!rawActivityId || !rawActivityId.trim()) {
        return await getOrCreateDefaultActivityId(projectId);
    }
    const clean = rawActivityId.trim();
    const cacheKey = `${projectId}_${clean}`;
    if (cache && cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }
    // 1. Direct match by id in MF_P_ActivityCode for this project
    const directMatch = await prisma_1.default.mF_P_ActivityCode.findFirst({
        where: { id: clean, projectId },
        select: { id: true },
    });
    if (directMatch) {
        if (cache)
            cache.set(cacheKey, directMatch.id);
        return directMatch.id;
    }
    // 2. Check if clean matches code in MF_P_ActivityCode for this project
    const codeMatch = await prisma_1.default.mF_P_ActivityCode.findFirst({
        where: { projectId, code: clean },
        select: { id: true },
    });
    if (codeMatch) {
        if (cache)
            cache.set(cacheKey, codeMatch.id);
        return codeMatch.id;
    }
    // 3. Check if clean is a corporate activity code ID (MF_G_ActivityCode)
    const corpById = await prisma_1.default.mF_G_ActivityCode.findUnique({
        where: { id: clean },
        select: { id: true, code: true, description: true, unit: true },
    });
    if (corpById) {
        let projectAct = await prisma_1.default.mF_P_ActivityCode.findFirst({
            where: { projectId, code: corpById.code },
            select: { id: true },
        });
        if (!projectAct) {
            projectAct = await prisma_1.default.mF_P_ActivityCode.create({
                data: {
                    projectId,
                    code: corpById.code,
                    description: corpById.description,
                    unit: corpById.unit,
                    corporateActivityCodeId: corpById.id,
                },
                select: { id: true },
            });
        }
        if (cache)
            cache.set(cacheKey, projectAct.id);
        return projectAct.id;
    }
    // 4. Check if clean matches a code in corporate activity catalog (MF_G_ActivityCode)
    const corpByCode = await prisma_1.default.mF_G_ActivityCode.findUnique({
        where: { code: clean },
        select: { id: true, code: true, description: true, unit: true },
    });
    if (corpByCode) {
        let projectAct = await prisma_1.default.mF_P_ActivityCode.findFirst({
            where: { projectId, code: corpByCode.code },
            select: { id: true },
        });
        if (!projectAct) {
            projectAct = await prisma_1.default.mF_P_ActivityCode.create({
                data: {
                    projectId,
                    code: corpByCode.code,
                    description: corpByCode.description,
                    unit: corpByCode.unit,
                    corporateActivityCodeId: corpByCode.id,
                },
                select: { id: true },
            });
        }
        if (cache)
            cache.set(cacheKey, projectAct.id);
        return projectAct.id;
    }
    // 5. Check if it matches an MF_P_ActivityCode ID in another project
    const anyProjectMatch = await prisma_1.default.mF_P_ActivityCode.findUnique({
        where: { id: clean },
        select: { id: true, code: true, description: true, unit: true },
    });
    if (anyProjectMatch) {
        let localAct = await prisma_1.default.mF_P_ActivityCode.findFirst({
            where: { projectId, code: anyProjectMatch.code },
            select: { id: true },
        });
        if (!localAct) {
            localAct = await prisma_1.default.mF_P_ActivityCode.create({
                data: {
                    projectId,
                    code: anyProjectMatch.code,
                    description: anyProjectMatch.description,
                    unit: anyProjectMatch.unit,
                },
                select: { id: true },
            });
        }
        if (cache)
            cache.set(cacheKey, localAct.id);
        return localAct.id;
    }
    // 6. Fallback: default activity for this project
    const defId = await getOrCreateDefaultActivityId(projectId);
    if (cache)
        cache.set(cacheKey, defId);
    return defId;
}
// 1. GET /api/time-entries/assigned — Get assigned employees for supervisor & date
const getAssignedEmployees = async (req, res) => {
    try {
        const supervisorId = req.query.supervisorId;
        const dateStr = req.query.date;
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        if (!supervisorId || !dateStr) {
            res.json([]);
            return;
        }
        const targetDate = parseDate(dateStr);
        const assignedRecords = await prisma_1.default.mF_OP_DailyAssignment.findMany({
            where: {
                dailySheet: {
                    projectId,
                    supervisorId,
                    date: targetDate,
                },
            },
            select: {
                id: true,
                employee: {
                    select: {
                        id: true,
                        callingName: true,
                        corporateEmployee: {
                            select: { employeeCode: true, fullName: true },
                        },
                        tradeGroup: { select: { name: true } },
                        businessPartner: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
        const result = assignedRecords.map((rec) => ({
            id: rec.employee.id,
            employeeCode: rec.employee.corporateEmployee.employeeCode,
            callingName: rec.employee.callingName || rec.employee.corporateEmployee.fullName,
            fullName: rec.employee.corporateEmployee.fullName,
            tradeGroup: rec.employee.tradeGroup?.name || 'General labour',
            businessPartner: rec.employee.businessPartner?.name || 'Direct',
        }));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching assigned employees:', error);
        res.status(500).json({ error: 'Failed to fetch assigned employees' });
    }
};
exports.getAssignedEmployees = getAssignedEmployees;
// 2. POST /api/time-entries/check-in — Check-in employee
const checkInEmployee = async (req, res) => {
    try {
        const { employeeId, supervisorId, date, inTime } = req.body || {};
        if (!employeeId || !inTime || !date) {
            res.status(400).json({ error: 'employeeId, inTime, and date are required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const entryDate = parseDate(date);
        // Guard: Prevent edit if already submitted or approved
        const lockedCheck = await prisma_1.default.mF_OP_TimeEntry.findFirst({
            where: {
                projectId,
                date: entryDate,
                employeeId,
                status: { in: ['submitted', 'approved'] },
            },
        });
        if (lockedCheck) {
            res.status(403).json({ error: 'Cannot check in: Daily attendance is locked or approved.' });
            return;
        }
        // Resolve supervisor
        let effectiveSupId = supervisorId;
        if (!effectiveSupId) {
            const assignment = await prisma_1.default.mF_OP_DailyAssignment.findFirst({
                where: {
                    employeeId,
                    dailySheet: { projectId, date: entryDate },
                },
                select: { dailySheet: { select: { supervisorId: true } } },
            });
            effectiveSupId = assignment?.dailySheet.supervisorId;
        }
        if (!effectiveSupId) {
            const supUser = await prisma_1.default.mF_P_User.findFirst({
                where: { projectId, role: 'supervisor' },
                select: { id: true },
            });
            effectiveSupId = supUser?.id || '';
        }
        const dailySheet = effectiveSupId ? await getOrCreateDailySheet(projectId, effectiveSupId, entryDate) : null;
        // Check existing entries
        const existingEntries = await prisma_1.default.mF_OP_TimeEntry.findMany({
            where: { projectId, employeeId, date: entryDate },
        });
        if (existingEntries.length > 0) {
            await prisma_1.default.mF_OP_TimeEntry.updateMany({
                where: { projectId, employeeId, date: entryDate },
                data: { inTime },
            });
            res.json({ success: true, employeeId, inTime, count: existingEntries.length });
            return;
        }
        // Default activity
        let defaultActivity = await prisma_1.default.mF_P_ActivityCode.findFirst({
            where: { projectId },
            orderBy: { code: 'asc' },
        });
        if (!defaultActivity) {
            defaultActivity = await prisma_1.default.mF_P_ActivityCode.create({
                data: {
                    projectId,
                    code: 'GEN-01',
                    description: 'General Site Works',
                },
            });
        }
        const { effectiveDayTypeId } = await (0, calendarController_1.getDayTypeRulesAndId)(projectId, entryDate);
        const created = await prisma_1.default.mF_OP_TimeEntry.create({
            data: {
                projectId,
                dailySheetId: dailySheet?.id || null,
                employeeId,
                recordedById: effectiveSupId || null,
                activityId: defaultActivity.id,
                effectiveDayTypeId,
                date: entryDate,
                inTime,
                hours: 0,
                overtimeHours: 0,
                status: 'draft',
            },
        });
        res.json({ success: true, employeeId, inTime, entryId: created.id });
    }
    catch (error) {
        console.error('Error in checkInEmployee:', error);
        res.status(500).json({ error: 'Failed to record check-in' });
    }
};
exports.checkInEmployee = checkInEmployee;
// 2.1 POST /api/time-entries/check-out — Check-out employee
const checkOutEmployee = async (req, res) => {
    try {
        const { employeeId, supervisorId, date, outTime } = req.body || {};
        if (!employeeId || !outTime || !date) {
            res.status(400).json({ error: 'employeeId, outTime, and date are required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const entryDate = parseDate(date);
        const lockedCheck = await prisma_1.default.mF_OP_TimeEntry.findFirst({
            where: {
                projectId,
                date: entryDate,
                employeeId,
                status: { in: ['submitted', 'approved'] },
            },
        });
        if (lockedCheck) {
            res.status(403).json({ error: 'Cannot check out: Daily attendance is locked or approved.' });
            return;
        }
        const existingEntries = await prisma_1.default.mF_OP_TimeEntry.findMany({
            where: { projectId, employeeId, date: entryDate },
        });
        if (existingEntries.length === 0) {
            res.status(400).json({ error: 'Cannot check out: No check-in record found for this worker today.' });
            return;
        }
        const inTime = existingEntries[0].inTime || null;
        let shiftHours = 0;
        let otHours = 0;
        let breakHours = 0;
        if (inTime) {
            const { standardHoursCap, isAllOvertime } = await (0, calendarController_1.getDayTypeRulesAndId)(projectId, entryDate);
            const calc = calculateShiftAndOvertime(inTime, outTime, standardHoursCap, isAllOvertime);
            shiftHours = calc.shiftHours;
            otHours = calc.otHours;
            breakHours = calc.breakHours;
        }
        await prisma_1.default.mF_OP_TimeEntry.updateMany({
            where: { projectId, employeeId, date: entryDate },
            data: {
                outTime,
                breakHours,
                shiftHours,
                overtimeHours: otHours,
            },
        });
        res.json({ success: true, employeeId, outTime, shiftHours, otHours });
    }
    catch (error) {
        console.error('Error in checkOutEmployee:', error);
        res.status(500).json({ error: 'Failed to record check-out' });
    }
};
exports.checkOutEmployee = checkOutEmployee;
// 3. POST /api/time-entries/assign-activity — Assign activity to multiple workers
const assignActivityBulk = async (req, res) => {
    try {
        const { employeeIds, activityId, hours, date, supervisorId, equipmentId, remarks } = req.body || {};
        if (!Array.isArray(employeeIds) || employeeIds.length === 0 || !activityId || !date) {
            res.status(400).json({ error: 'employeeIds array, activityId, and date are required' });
            return;
        }
        const numHours = parseFloat(hours);
        if (isNaN(numHours) || numHours <= 0) {
            res.status(400).json({ error: 'Valid positive hours number is required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const { effectiveDayTypeId, standardHoursCap, isAllOvertime } = await (0, calendarController_1.getDayTypeRulesAndId)(projectId, targetDate);
        const resolvedActivityId = await resolveProjectActivityId(activityId, projectId);
        let validEquipmentId = null;
        if (equipmentId) {
            const eq = await prisma_1.default.mF_P_Equipment.findUnique({
                where: { id: equipmentId },
                select: { id: true },
            });
            validEquipmentId = eq ? eq.id : null;
        }
        let effectiveSupId = supervisorId;
        if (!effectiveSupId) {
            const supUser = await prisma_1.default.mF_P_User.findFirst({
                where: { projectId, role: 'supervisor' },
                select: { id: true },
            });
            effectiveSupId = supUser?.id || '';
        }
        const dailySheet = effectiveSupId ? await getOrCreateDailySheet(projectId, effectiveSupId, targetDate) : null;
        const createdEntries = [];
        for (const empId of employeeIds) {
            const existingEntries = await prisma_1.default.mF_OP_TimeEntry.findMany({
                where: { projectId, employeeId: empId, date: targetDate },
            });
            const previousHours = existingEntries.reduce((acc, curr) => acc + Number(curr.hours), 0);
            const newTotalHours = previousHours + numHours;
            const preservedInTime = existingEntries.find((e) => e.inTime)?.inTime || null;
            const preservedOutTime = existingEntries.find((e) => e.outTime)?.outTime || null;
            const breakHours = computeBreakHours(preservedInTime, preservedOutTime);
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
            const existingActivityEntry = existingEntries.find((e) => e.activityId === resolvedActivityId);
            if (existingActivityEntry) {
                const updated = await prisma_1.default.mF_OP_TimeEntry.update({
                    where: { id: existingActivityEntry.id },
                    data: {
                        hours: numHours,
                        overtimeHours,
                        breakHours,
                        inTime: existingActivityEntry.inTime || preservedInTime,
                        outTime: existingActivityEntry.outTime || preservedOutTime,
                        equipmentId: validEquipmentId || existingActivityEntry.equipmentId,
                        remarks: remarks || existingActivityEntry.remarks,
                    },
                });
                createdEntries.push(updated);
            }
            else {
                const placeholder = existingEntries.find((e) => Number(e.hours) === 0 && e.activityId !== resolvedActivityId);
                if (placeholder) {
                    const updated = await prisma_1.default.mF_OP_TimeEntry.update({
                        where: { id: placeholder.id },
                        data: {
                            activityId: resolvedActivityId,
                            hours: numHours,
                            overtimeHours,
                            breakHours,
                            inTime: placeholder.inTime || preservedInTime,
                            outTime: placeholder.outTime || preservedOutTime,
                            equipmentId: validEquipmentId || placeholder.equipmentId,
                            remarks: remarks || placeholder.remarks,
                        },
                    });
                    createdEntries.push(updated);
                }
                else {
                    const created = await prisma_1.default.mF_OP_TimeEntry.create({
                        data: {
                            projectId,
                            dailySheetId: dailySheet?.id || null,
                            employeeId: empId,
                            recordedById: effectiveSupId || null,
                            activityId: resolvedActivityId,
                            equipmentId: validEquipmentId,
                            effectiveDayTypeId,
                            date: targetDate,
                            inTime: preservedInTime,
                            outTime: preservedOutTime,
                            hours: numHours,
                            overtimeHours,
                            breakHours,
                            remarks: remarks || null,
                            status: 'draft',
                        },
                    });
                    createdEntries.push(created);
                }
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
// 4. POST /api/time-entries/upsert — Upsert single time entry
const upsertTimeEntry = async (req, res) => {
    try {
        const { employeeId, supervisorId, date, activityId, equipmentId, hours, inTime, outTime, remarks } = req.body || {};
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const { effectiveDayTypeId, standardHoursCap, isAllOvertime } = await (0, calendarController_1.getDayTypeRulesAndId)(projectId, targetDate);
        const numHours = hours !== undefined ? parseFloat(hours) : 0;
        let effectiveSupId = supervisorId;
        if (!effectiveSupId) {
            const supUser = await prisma_1.default.mF_P_User.findFirst({
                where: { projectId, role: 'supervisor' },
                select: { id: true },
            });
            effectiveSupId = supUser?.id || '';
        }
        const resolvedActivityId = await resolveProjectActivityId(activityId, projectId);
        let validEquipmentId = null;
        if (equipmentId) {
            const eq = await prisma_1.default.mF_P_Equipment.findUnique({
                where: { id: equipmentId },
                select: { id: true },
            });
            validEquipmentId = eq ? eq.id : null;
        }
        const dailySheet = effectiveSupId ? await getOrCreateDailySheet(projectId, effectiveSupId, targetDate) : null;
        const existing = await prisma_1.default.mF_OP_TimeEntry.findFirst({
            where: {
                projectId,
                employeeId,
                activityId: resolvedActivityId,
                date: targetDate,
            },
        });
        const finalInTime = inTime ?? existing?.inTime ?? null;
        const finalOutTime = outTime ?? existing?.outTime ?? null;
        let shiftHoursVal = null;
        let otHoursVal = 0;
        let breakHours = 0;
        if (finalInTime && finalOutTime) {
            const calc = calculateShiftAndOvertime(finalInTime, finalOutTime, standardHoursCap, isAllOvertime);
            shiftHoursVal = calc.shiftHours;
            otHoursVal = calc.otHours;
            breakHours = calc.breakHours;
        }
        else {
            breakHours = computeBreakHours(finalInTime, finalOutTime);
            otHoursVal = isAllOvertime ? numHours : numHours > standardHoursCap ? numHours - standardHoursCap : 0;
        }
        let record;
        if (existing) {
            record = await prisma_1.default.mF_OP_TimeEntry.update({
                where: { id: existing.id },
                data: {
                    hours: numHours,
                    shiftHours: shiftHoursVal,
                    overtimeHours: otHoursVal,
                    breakHours,
                    inTime: finalInTime,
                    outTime: finalOutTime,
                    equipmentId: validEquipmentId ?? existing.equipmentId,
                    remarks: remarks ?? existing.remarks,
                },
            });
        }
        else {
            record = await prisma_1.default.mF_OP_TimeEntry.create({
                data: {
                    projectId,
                    dailySheetId: dailySheet?.id || null,
                    employeeId,
                    recordedById: effectiveSupId || null,
                    activityId: resolvedActivityId,
                    equipmentId: validEquipmentId,
                    effectiveDayTypeId,
                    date: targetDate,
                    inTime: finalInTime,
                    outTime: finalOutTime,
                    hours: numHours,
                    shiftHours: shiftHoursVal,
                    overtimeHours: otHoursVal,
                    breakHours,
                    remarks: remarks || null,
                    status: 'draft',
                },
            });
        }
        res.status(201).json(record);
    }
    catch (error) {
        console.error('Error upserting time entry:', error);
        res.status(500).json({ error: 'Failed to save time entry' });
    }
};
exports.upsertTimeEntry = upsertTimeEntry;
// 5. GET /api/time-entries — Query time entries
const getTimeEntries = async (req, res) => {
    try {
        const { date, supervisorId, employeeId, status } = req.query;
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const where = { projectId };
        if (date && typeof date === 'string') {
            where.date = parseDate(date);
        }
        if (supervisorId && typeof supervisorId === 'string') {
            where.OR = [
                { dailySheet: { supervisorId } },
                { recordedById: supervisorId },
            ];
        }
        if (employeeId && typeof employeeId === 'string') {
            where.employeeId = employeeId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }
        const entries = await prisma_1.default.mF_OP_TimeEntry.findMany({
            where,
            select: {
                id: true,
                projectId: true,
                dailySheetId: true,
                employeeId: true,
                date: true,
                inTime: true,
                outTime: true,
                hours: true,
                overtimeHours: true,
                shiftHours: true,
                breakHours: true,
                status: true,
                remarks: true,
                employee: {
                    select: {
                        id: true,
                        callingName: true,
                        corporateEmployee: { select: { employeeCode: true, fullName: true } },
                        tradeGroup: { select: { name: true } },
                        businessPartner: { select: { name: true } },
                    },
                },
                activity: { select: { id: true, code: true, description: true } },
                equipment: {
                    select: {
                        id: true,
                        corporateEquipment: { select: { standardEquipmentNumber: true, equipmentName: true } },
                    },
                },
                recordedBy: { select: { id: true, fullName: true, username: true } },
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
// 6. POST /api/time-entries/submit — Submit day
const submitDay = async (req, res) => {
    try {
        const { supervisorId, date } = req.body || {};
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const submittedAt = new Date();
        if (!supervisorId) {
            res.status(400).json({ error: 'supervisorId is required' });
            return;
        }
        const dailySheet = await getOrCreateDailySheet(projectId, supervisorId, targetDate);
        // Lock daily sheet
        await prisma_1.default.mF_OP_DailySheet.update({
            where: { id: dailySheet.id },
            data: {
                status: 'submitted',
                isLocked: true,
                submittedAt,
            },
        });
        // Update time entries
        const updated = await prisma_1.default.mF_OP_TimeEntry.updateMany({
            where: {
                dailySheetId: dailySheet.id,
                status: 'draft',
            },
            data: {
                status: 'submitted',
                submittedAt,
            },
        });
        // Update equipment logs
        const eqAssignments = await prisma_1.default.mF_OP_DailyEquipmentAssignment.findMany({
            where: { dailySheetId: dailySheet.id },
            select: { id: true },
        });
        if (eqAssignments.length > 0) {
            await prisma_1.default.mF_OP_EquipmentDailyLog.updateMany({
                where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
                data: { status: 'submitted' },
            });
        }
        res.json({
            success: true,
            submittedCount: updated.count,
            submittedAt: submittedAt.toISOString(),
            message: 'Successfully submitted daily entries.',
        });
    }
    catch (error) {
        console.error('Error submitting day:', error);
        res.status(500).json({ error: 'Failed to submit daily entries' });
    }
};
exports.submitDay = submitDay;
// 6.1 GET /api/time-entries/day-status — Get daily status
const getDayStatus = async (req, res) => {
    try {
        const supervisorId = req.query.supervisorId;
        const dateStr = req.query.date;
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        if (!supervisorId || !dateStr) {
            res.status(400).json({ error: 'supervisorId and date query parameters are required' });
            return;
        }
        const targetDate = parseDate(dateStr);
        const dailySheet = await prisma_1.default.mF_OP_DailySheet.findUnique({
            where: {
                projectId_supervisorId_date: {
                    projectId,
                    supervisorId,
                    date: targetDate,
                },
            },
            select: {
                status: true,
                isLocked: true,
                submittedAt: true,
                approvedAt: true,
                remarks: true,
            },
        });
        if (!dailySheet) {
            res.json({
                status: 'draft',
                isLocked: false,
                submittedAt: null,
                approvedAt: null,
                remarks: null,
            });
            return;
        }
        res.json({
            status: dailySheet.status,
            isLocked: dailySheet.status === 'submitted' || dailySheet.status === 'approved' || dailySheet.isLocked,
            submittedAt: dailySheet.submittedAt,
            approvedAt: dailySheet.approvedAt,
            remarks: dailySheet.remarks,
        });
    }
    catch (error) {
        console.error('Error fetching day status:', error);
        res.status(500).json({ error: 'Failed to fetch day status' });
    }
};
exports.getDayStatus = getDayStatus;
// 7. GET /api/time-entries/approval-overview — Admin Approval Overview
const getApprovalOverview = async (req, res) => {
    try {
        const dateStr = req.query.date;
        if (!dateStr) {
            res.status(400).json({ error: 'Date query parameter (YYYY-MM-DD) is required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(dateStr);
        const dayTypeRules = await (0, calendarController_1.getDayTypeRulesAndId)(projectId, targetDate);
        const dailySheets = await prisma_1.default.mF_OP_DailySheet.findMany({
            where: { projectId, date: targetDate },
            include: {
                supervisor: { select: { id: true, fullName: true, username: true } },
                assignments: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                callingName: true,
                                corporateEmployee: { select: { employeeCode: true, fullName: true } },
                                tradeGroup: { select: { name: true } },
                                businessPartner: { select: { name: true } },
                            },
                        },
                    },
                },
                timeEntries: {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                callingName: true,
                                corporateEmployee: { select: { employeeCode: true, fullName: true } },
                                tradeGroup: { select: { name: true } },
                                businessPartner: { select: { name: true } },
                            },
                        },
                        activity: { select: { code: true, description: true } },
                        activitySplits: {
                            include: {
                                activityCode: { select: { code: true, description: true } },
                            },
                        },
                    },
                },
                equipmentAssignments: {
                    include: {
                        equipment: {
                            select: {
                                id: true,
                                condition: true,
                                meterUnitCode: true,
                                corporateEquipment: {
                                    select: {
                                        standardEquipmentNumber: true,
                                        equipmentName: true,
                                        vehicleNo: true,
                                        condition: true,
                                        unit: true,
                                    },
                                },
                            },
                        },
                        operator: {
                            select: {
                                id: true,
                                callingName: true,
                                corporateEmployee: { select: { employeeCode: true, fullName: true } },
                                tradeGroup: { select: { name: true } },
                            },
                        },
                        dailyLog: {
                            include: {
                                activities: {
                                    include: {
                                        activityCode: { select: { code: true, description: true, unit: true } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });
        const submitted = [];
        const notSubmitted = [];
        const approved = [];
        for (const sheet of dailySheets) {
            const sup = sheet.supervisor;
            // 1. Worker details
            const empMap = new Map();
            for (const a of sheet.assignments) {
                if (a.employee) {
                    empMap.set(a.employee.id, {
                        employee: a.employee,
                        timeEntries: [],
                    });
                }
            }
            for (const te of sheet.timeEntries) {
                if (te.employee) {
                    if (!empMap.has(te.employee.id)) {
                        empMap.set(te.employee.id, {
                            employee: te.employee,
                            timeEntries: [te],
                        });
                    }
                    else {
                        empMap.get(te.employee.id).timeEntries.push(te);
                    }
                }
            }
            const workerDetails = Array.from(empMap.values()).map(({ employee: emp, timeEntries: entries }) => {
                const firstWithTimes = entries.find((e) => e.inTime && e.outTime) || entries[0];
                const inTime = firstWithTimes?.inTime || '';
                const outTime = firstWithTimes?.outTime || '';
                // Calculate shift hours, overtime, and regular hours
                let shiftHours = 0;
                let otHours = 0;
                let regularHours = 0;
                if (inTime && outTime) {
                    const calc = calculateShiftAndOvertime(inTime, outTime, dayTypeRules.standardHoursCap, dayTypeRules.isAllOvertime);
                    shiftHours = calc.shiftHours;
                    otHours = calc.otHours;
                    regularHours = dayTypeRules.isAllOvertime ? 0 : Math.max(0, Math.round((shiftHours - otHours) * 100) / 100);
                }
                else if (entries.length > 0) {
                    shiftHours = entries.reduce((sum, e) => sum + Number(e.shiftHours ?? e.hours ?? 0), 0);
                    otHours = entries.reduce((sum, e) => sum + Number(e.overtimeHours || 0), 0);
                    regularHours = dayTypeRules.isAllOvertime ? 0 : Math.max(0, Math.round((shiftHours - otHours) * 100) / 100);
                }
                // Collect all activities worked across all entries
                const seenActivities = new Map();
                for (const te of entries) {
                    if (te.activitySplits && te.activitySplits.length > 0) {
                        for (const s of te.activitySplits) {
                            const code = s.activityCode?.code || 'N/A';
                            const description = s.activityCode?.description || '';
                            const h = Number(s.hours || 0);
                            if (seenActivities.has(code)) {
                                seenActivities.get(code).hours += h;
                            }
                            else {
                                seenActivities.set(code, { code, description, hours: h });
                            }
                        }
                    }
                    else if (te.activity) {
                        const code = te.activity.code || 'N/A';
                        const description = te.activity.description || '';
                        const h = Number(te.hours || 0);
                        if (seenActivities.has(code)) {
                            seenActivities.get(code).hours += h;
                        }
                        else {
                            seenActivities.set(code, { code, description, hours: h });
                        }
                    }
                }
                const activities = Array.from(seenActivities.values());
                const primaryStatus = entries.find((e) => e.status)?.status || (inTime ? 'draft' : 'pending');
                return {
                    employeeId: emp.id,
                    employeeCode: emp.corporateEmployee?.employeeCode || 'N/A',
                    callingName: emp.callingName || emp.corporateEmployee?.fullName || 'Worker',
                    fullName: emp.corporateEmployee?.fullName || emp.callingName || '',
                    tradeGroup: emp.tradeGroup?.name || 'General',
                    businessPartner: emp.businessPartner?.name || 'Direct / Maga',
                    inTime,
                    outTime,
                    hours: regularHours,
                    otHours,
                    shiftHours,
                    activities,
                    status: primaryStatus,
                };
            });
            // 2. Operator details
            const operatorDetails = sheet.equipmentAssignments
                .filter((ea) => ea.operator && ea.operatorId)
                .map((ea) => {
                const op = ea.operator;
                const opTeList = sheet.timeEntries.filter((t) => t.employeeId === op.id);
                const firstOpTe = opTeList.find((t) => t.inTime && t.outTime) || opTeList[0];
                const inTime = firstOpTe?.inTime || '';
                const outTime = firstOpTe?.outTime || '';
                let hours = 0;
                let otHours = 0;
                if (inTime && outTime) {
                    const calc = calculateShiftAndOvertime(inTime, outTime, dayTypeRules.standardHoursCap, dayTypeRules.isAllOvertime);
                    otHours = calc.otHours;
                    hours = dayTypeRules.isAllOvertime ? 0 : Math.max(0, Math.round((calc.shiftHours - calc.otHours) * 100) / 100);
                }
                else if (opTeList.length > 0) {
                    const shiftH = opTeList.reduce((sum, t) => sum + Number(t.shiftHours ?? t.hours ?? 0), 0);
                    otHours = opTeList.reduce((sum, t) => sum + Number(t.overtimeHours || 0), 0);
                    hours = dayTypeRules.isAllOvertime ? 0 : Math.max(0, Math.round((shiftH - otHours) * 100) / 100);
                }
                const eqDisplay = ea.equipment?.corporateEquipment?.standardEquipmentNumber ||
                    ea.equipment?.corporateEquipment?.vehicleNo ||
                    ea.equipment?.corporateEquipment?.equipmentName ||
                    '—';
                return {
                    operatorId: op.id,
                    operatorCode: op.corporateEmployee?.employeeCode || 'N/A',
                    callingName: op.callingName || op.corporateEmployee?.fullName || 'Operator',
                    fullName: op.corporateEmployee?.fullName || op.callingName || '',
                    tradeGroup: op.tradeGroup?.name || 'Machine Operator',
                    inTime,
                    outTime,
                    hours,
                    otHours,
                    assignedEquipmentId: ea.equipmentId || null,
                    assignedEquipmentDisplay: eqDisplay,
                    status: firstOpTe?.status || (inTime ? 'draft' : 'pending'),
                    notes: firstOpTe?.remarks || '',
                };
            });
            // 3. Equipment details
            const equipmentDetails = sheet.equipmentAssignments.map((ea) => {
                const eq = ea.equipment;
                const corp = eq?.corporateEquipment;
                const log = ea.dailyLog;
                const primaryUnit = (eq?.meterUnitCode || corp?.unit || 'hrs').toLowerCase();
                const condition = eq?.condition || corp?.condition || 'DRY';
                const initialMeter = Number(log?.initialMeter || 0);
                const finalMeter = Number(log?.finalMeter || 0);
                const netHours = Number(log?.netRunningHours || 0);
                const workingHours = Number(log?.workingHours || 0);
                const idleHours = Number(log?.idleHours || 0);
                const fuelLiters = Number(log?.fuelLiters || 0);
                const totalMileage = Number(log?.totalMileage || 0);
                const loggedQuantity = Number(log?.totalUtilization || 0);
                const splits = (log?.activities || []).map((act) => ({
                    activityCode: act.activityCode?.code || 'N/A',
                    activityDesc: act.activityCode?.description || '',
                    unit: act.activityCode?.unit || primaryUnit,
                    utilization: Number(act.utilization || 0),
                }));
                return {
                    equipmentId: ea.equipmentId,
                    equipmentCode: corp?.standardEquipmentNumber || corp?.vehicleNo || '—',
                    equipmentName: corp?.equipmentName || '',
                    vehicleNo: corp?.vehicleNo || '—',
                    magaNo: corp?.standardEquipmentNumber || '—',
                    condition,
                    primaryUnit,
                    loggedQuantity,
                    initialMeter,
                    finalMeter,
                    netHours,
                    workingHours,
                    idleHours,
                    fuelLiters,
                    totalMileage,
                    remarks: log?.remarks || '',
                    status: log?.status || (netHours > 0 || loggedQuantity > 0 ? 'draft' : 'pending'),
                    splits,
                };
            });
            const laborHours = workerDetails.reduce((sum, w) => sum + Number(w.hours || 0), 0);
            const laborOvertime = workerDetails.reduce((sum, w) => sum + Number(w.otHours || 0), 0);
            const equipmentFuel = equipmentDetails.reduce((sum, e) => sum + Number(e.fuelLiters || 0), 0);
            const equipmentDays = equipmentDetails.reduce((sum, e) => sum +
                (e.primaryUnit === 'mth' || e.primaryUnit === 'day' || e.primaryUnit === 'days'
                    ? e.loggedQuantity > 0
                        ? e.loggedQuantity
                        : 1
                    : 0), 0);
            const laborWorkedCount = workerDetails.filter((w) => w.inTime || w.hours > 0).length;
            const operatorsWorkedCount = operatorDetails.filter((o) => o.inTime || o.hours > 0).length;
            const equipmentRunningCount = equipmentDetails.filter((e) => e.netHours > 0 || e.loggedQuantity > 0).length;
            const groupData = {
                supervisorId: sup.id,
                supervisorName: sup.fullName,
                username: sup.username,
                status: sheet.status,
                submittedAt: sheet.submittedAt,
                approvedAt: sheet.approvedAt,
                assignedCount: sheet.assignments.length,
                workedCount: laborWorkedCount,
                totalHours: laborHours,
                totalOvertime: laborOvertime,
                counts: {
                    laborAssigned: sheet.assignments.length,
                    laborWorked: laborWorkedCount,
                    operatorsAssigned: operatorDetails.length,
                    operatorsWorked: operatorsWorkedCount,
                    equipmentAssigned: equipmentDetails.length,
                    equipmentRunning: equipmentRunningCount,
                },
                totals: {
                    laborHours,
                    laborOvertime,
                    equipmentFuel,
                    equipmentDays,
                },
                workers: workerDetails,
                operators: operatorDetails,
                equipment: equipmentDetails,
            };
            if (sheet.status === 'approved') {
                approved.push(groupData);
            }
            else if (sheet.status === 'submitted') {
                submitted.push(groupData);
            }
            else {
                notSubmitted.push(groupData);
            }
        }
        const allGroups = [...submitted, ...notSubmitted, ...approved];
        res.json({
            date: dateStr,
            dayType: {
                name: dayTypeRules.isAllOvertime ? 'Holiday / Sunday' : 'Normal / Working',
                standardHoursCap: dayTypeRules.standardHoursCap,
                isAllOvertime: dayTypeRules.isAllOvertime,
            },
            submitted,
            notSubmitted,
            approved,
            stats: {
                totalSupervisors: dailySheets.length,
                submittedCount: submitted.length,
                notSubmittedCount: notSubmitted.length,
                approvedCount: approved.length,
                totalWorkers: dailySheets.reduce((sum, s) => sum + s.assignments.length, 0),
                labor: {
                    totalAssigned: dailySheets.reduce((sum, s) => sum + s.assignments.length, 0),
                    attendedCount: allGroups.reduce((sum, g) => sum + (g.counts?.laborWorked || 0), 0),
                    totalNormalHours: allGroups.reduce((sum, g) => sum + (g.totals?.laborHours || 0), 0),
                    totalOtHours: allGroups.reduce((sum, g) => sum + (g.totals?.laborOvertime || 0), 0),
                },
                operators: {
                    totalAssigned: allGroups.reduce((sum, g) => sum + (g.counts?.operatorsAssigned || 0), 0),
                    deployedCount: allGroups.reduce((sum, g) => sum + (g.counts?.operatorsWorked || 0), 0),
                    mappedCount: allGroups.reduce((sum, g) => sum + (g.counts?.operatorsWorked || 0), 0),
                },
                equipment: {
                    totalAssigned: allGroups.reduce((sum, g) => sum + (g.counts?.equipmentAssigned || 0), 0),
                    runningCount: allGroups.reduce((sum, g) => sum + (g.counts?.equipmentRunning || 0), 0),
                    totalDays: allGroups.reduce((sum, g) => sum + (g.totals?.equipmentDays || 0), 0),
                    totalHours: 0,
                    totalFuelLiters: allGroups.reduce((sum, g) => sum + (g.totals?.equipmentFuel || 0), 0),
                },
            },
        });
    }
    catch (error) {
        console.error('Error fetching approval overview:', error);
        res.status(500).json({ error: 'Failed to fetch approval overview' });
    }
};
exports.getApprovalOverview = getApprovalOverview;
// 7.1 POST /api/time-entries/approve — Approve time entries
const approveTimeEntries = async (req, res) => {
    try {
        const { supervisorId, date } = req.body || {};
        if (!date) {
            res.status(400).json({ error: 'date (YYYY-MM-DD) is required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const approvedAt = new Date();
        const sheetWhere = { projectId, date: targetDate };
        if (supervisorId)
            sheetWhere.supervisorId = supervisorId;
        const sheets = await prisma_1.default.mF_OP_DailySheet.findMany({
            where: sheetWhere,
            select: { id: true },
        });
        const sheetIds = sheets.map((s) => s.id);
        await prisma_1.default.mF_OP_DailySheet.updateMany({
            where: { id: { in: sheetIds } },
            data: { status: 'approved', isLocked: true, approvedAt },
        });
        const timeResult = await prisma_1.default.mF_OP_TimeEntry.updateMany({
            where: { dailySheetId: { in: sheetIds } },
            data: { status: 'approved' },
        });
        const eqAssignments = await prisma_1.default.mF_OP_DailyEquipmentAssignment.findMany({
            where: { dailySheetId: { in: sheetIds } },
            select: { id: true },
        });
        if (eqAssignments.length > 0) {
            await prisma_1.default.mF_OP_EquipmentDailyLog.updateMany({
                where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
                data: { status: 'approved' },
            });
        }
        res.json({
            success: true,
            approvedCount: timeResult.count,
            message: `Successfully approved daily records for ${sheets.length} supervisor sheet(s).`,
        });
    }
    catch (error) {
        console.error('Error approving daily entries:', error);
        res.status(500).json({ error: 'Failed to approve daily entries' });
    }
};
exports.approveTimeEntries = approveTimeEntries;
// 7.2 POST /api/time-entries/reject — Reject time entries / return to draft
const rejectTimeEntries = async (req, res) => {
    try {
        const { supervisorId, date, reason } = req.body || {};
        if (!date || !supervisorId) {
            res.status(400).json({ error: 'supervisorId and date are required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const sheet = await prisma_1.default.mF_OP_DailySheet.findUnique({
            where: {
                projectId_supervisorId_date: {
                    projectId,
                    supervisorId,
                    date: targetDate,
                },
            },
        });
        if (sheet) {
            await prisma_1.default.mF_OP_DailySheet.update({
                where: { id: sheet.id },
                data: { status: 'draft', isLocked: false, remarks: reason ? `Returned: ${reason}` : null },
            });
            await prisma_1.default.mF_OP_TimeEntry.updateMany({
                where: { dailySheetId: sheet.id },
                data: { status: 'draft', remarks: reason ? `Returned: ${reason}` : undefined },
            });
            const eqAssignments = await prisma_1.default.mF_OP_DailyEquipmentAssignment.findMany({
                where: { dailySheetId: sheet.id },
                select: { id: true },
            });
            if (eqAssignments.length > 0) {
                await prisma_1.default.mF_OP_EquipmentDailyLog.updateMany({
                    where: { assignmentId: { in: eqAssignments.map((a) => a.id) } },
                    data: { status: 'draft' },
                });
            }
        }
        res.json({
            success: true,
            message: 'Daily records returned to draft for supervisor editing.',
        });
    }
    catch (error) {
        console.error('Error rejecting daily entries:', error);
        res.status(500).json({ error: 'Failed to return daily entries to draft' });
    }
};
exports.rejectTimeEntries = rejectTimeEntries;
// 7.3 POST /api/time-entries/admin-adjust — Admin inline adjustment
const adminAdjustWorkerTimeEntry = async (req, res) => {
    try {
        const { employeeId, date, inTime, outTime, hours, overtimeHours } = req.body || {};
        if (!employeeId || !date) {
            res.status(400).json({ error: 'employeeId and date are required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const { standardHoursCap, isAllOvertime } = await (0, calendarController_1.getDayTypeRulesAndId)(projectId, targetDate);
        let calculatedHours = hours !== undefined ? parseFloat(hours) : 0;
        let calculatedOt = overtimeHours !== undefined ? parseFloat(overtimeHours) : 0;
        let breakHours = 0;
        if (inTime && outTime) {
            const calc = calculateShiftAndOvertime(inTime, outTime, standardHoursCap, isAllOvertime);
            calculatedHours = calc.shiftHours;
            calculatedOt = calc.otHours;
            breakHours = calc.breakHours;
        }
        const entries = await prisma_1.default.mF_OP_TimeEntry.findMany({
            where: { projectId, employeeId, date: targetDate },
        });
        if (entries.length > 0) {
            await prisma_1.default.mF_OP_TimeEntry.updateMany({
                where: { projectId, employeeId, date: targetDate },
                data: {
                    inTime,
                    outTime,
                    breakHours,
                    shiftHours: calculatedHours,
                    hours: calculatedHours,
                    overtimeHours: calculatedOt,
                    remarks: 'Adjusted by Admin',
                },
            });
        }
        let regularHours = calculatedHours;
        if (inTime && outTime) {
            regularHours = isAllOvertime ? 0 : Math.max(0, Math.round((calculatedHours - calculatedOt) * 100) / 100);
        }
        res.json({
            success: true,
            employeeId,
            inTime,
            outTime,
            hours: regularHours,
            shiftHours: calculatedHours,
            overtimeHours: calculatedOt,
            message: 'Worker entry adjusted successfully by Admin.',
        });
    }
    catch (error) {
        console.error('Error in adminAdjustWorkerTimeEntry:', error);
        res.status(500).json({ error: 'Failed to adjust worker time entry' });
    }
};
exports.adminAdjustWorkerTimeEntry = adminAdjustWorkerTimeEntry;
// 8. GET /api/time-entries/operators — Get operator entries
const getOperatorEntries = async (req, res) => {
    try {
        const supervisorId = req.query.supervisorId;
        const dateStr = req.query.date;
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        if (!dateStr) {
            res.status(400).json({ error: 'Date query parameter is required' });
            return;
        }
        const targetDate = parseDate(dateStr);
        const assignments = await prisma_1.default.mF_OP_DailyEquipmentAssignment.findMany({
            where: {
                dailySheet: {
                    projectId,
                    date: targetDate,
                    ...(supervisorId ? { supervisorId } : {}),
                },
                operatorId: { not: null },
            },
            include: {
                operator: {
                    select: {
                        id: true,
                        callingName: true,
                        corporateEmployee: { select: { employeeCode: true, fullName: true, nicNo: true } },
                        tradeGroup: { select: { name: true } },
                    },
                },
                equipment: {
                    select: {
                        id: true,
                        corporateEquipment: { select: { standardEquipmentNumber: true } },
                    },
                },
                dailyLog: true,
            },
        });
        const result = assignments
            .filter((a) => Boolean(a.operator))
            .map((a) => ({
            id: a.id,
            operatorId: a.operator.id,
            callingName: a.operator.callingName || a.operator.corporateEmployee.fullName,
            employeeNumber: a.operator.corporateEmployee.employeeCode,
            licenseNo: a.operator.corporateEmployee.nicNo || 'N/A',
            designation: a.operator.tradeGroup?.name || 'Operator',
            assignedEquipmentId: a.equipmentId,
            assignedEquipmentCode: a.equipment.corporateEquipment.standardEquipmentNumber,
            status: a.dailyLog?.status || 'draft',
            notes: a.dailyLog?.remarks || '',
        }));
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching operator entries:', error);
        res.status(500).json({ error: 'Failed to fetch operator entries' });
    }
};
exports.getOperatorEntries = getOperatorEntries;
// 9. POST /api/time-entries/operators — Save single operator entry
const saveOperatorEntry = async (req, res) => {
    try {
        const { operatorId, supervisorId, date, inTime, outTime, assignedEquipmentId, notes, status } = req.body || {};
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        let effectiveSupId = supervisorId;
        if (!effectiveSupId) {
            const supUser = await prisma_1.default.mF_P_User.findFirst({
                where: { projectId, role: 'supervisor' },
                select: { id: true },
            });
            effectiveSupId = supUser?.id || '';
        }
        const dailySheet = await getOrCreateDailySheet(projectId, effectiveSupId, targetDate);
        // Resolve an equipment
        let eqId = assignedEquipmentId;
        if (!eqId) {
            const firstEq = await prisma_1.default.mF_P_Equipment.findFirst({
                where: { projectId, status: 'active' },
                select: { id: true },
            });
            eqId = firstEq?.id;
        }
        if (!eqId) {
            res.status(400).json({ error: 'Equipment ID is required for operator assignment' });
            return;
        }
        const assignment = await prisma_1.default.mF_OP_DailyEquipmentAssignment.upsert({
            where: {
                dailySheetId_equipmentId: {
                    dailySheetId: dailySheet.id,
                    equipmentId: eqId,
                },
            },
            update: {
                operatorId,
            },
            create: {
                dailySheetId: dailySheet.id,
                operatorId,
                equipmentId: eqId,
            },
        });
        if (notes || status) {
            await prisma_1.default.mF_OP_EquipmentDailyLog.upsert({
                where: { assignmentId: assignment.id },
                update: {
                    remarks: notes || undefined,
                    status: status || undefined,
                },
                create: {
                    assignmentId: assignment.id,
                    remarks: notes || null,
                    status: status || 'draft',
                },
            });
        }
        res.json({
            success: true,
            assignmentId: assignment.id,
        });
    }
    catch (error) {
        console.error('Error saving operator entry:', error);
        res.status(500).json({ error: 'Failed to save operator entry' });
    }
};
exports.saveOperatorEntry = saveOperatorEntry;
// 10. POST /api/time-entries/operators/bulk — Save bulk operator entries
const saveBulkOperatorEntries = async (req, res) => {
    try {
        const { entries, date, supervisorId } = req.body || {};
        if (!Array.isArray(entries) || !date) {
            res.status(400).json({ error: 'entries array and date are required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        let effectiveSupId = supervisorId;
        if (!effectiveSupId) {
            const supUser = await prisma_1.default.mF_P_User.findFirst({
                where: { projectId, role: 'supervisor' },
                select: { id: true },
            });
            effectiveSupId = supUser?.id || '';
        }
        const dailySheet = await getOrCreateDailySheet(projectId, effectiveSupId, targetDate);
        for (const item of entries) {
            const opId = item.operatorId || item.id;
            const eqId = item.assignedEquipmentId || item.equipmentId;
            if (!opId || !eqId)
                continue;
            const assignment = await prisma_1.default.mF_OP_DailyEquipmentAssignment.upsert({
                where: {
                    dailySheetId_equipmentId: {
                        dailySheetId: dailySheet.id,
                        equipmentId: eqId,
                    },
                },
                update: {
                    operatorId: opId,
                },
                create: {
                    dailySheetId: dailySheet.id,
                    operatorId: opId,
                    equipmentId: eqId,
                },
            });
            if (item.notes || item.status) {
                await prisma_1.default.mF_OP_EquipmentDailyLog.upsert({
                    where: { assignmentId: assignment.id },
                    update: {
                        remarks: item.notes || undefined,
                        status: item.status || undefined,
                    },
                    create: {
                        assignmentId: assignment.id,
                        remarks: item.notes || null,
                        status: item.status || 'draft',
                    },
                });
            }
        }
        res.json({ success: true, count: entries.length });
    }
    catch (error) {
        console.error('Error saving bulk operator entries:', error);
        res.status(500).json({ error: 'Failed to save bulk operator entries' });
    }
};
exports.saveBulkOperatorEntries = saveBulkOperatorEntries;
// 11. POST /api/time-entries/equipment/bulk — Save bulk equipment daily logs
const saveBulkEquipmentLogs = async (req, res) => {
    try {
        const { entries, date, supervisorId } = req.body || {};
        if (!Array.isArray(entries) || !date) {
            res.status(400).json({ error: 'entries array and date are required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        let effectiveSupId = supervisorId;
        if (!effectiveSupId) {
            const supUser = await prisma_1.default.mF_P_User.findFirst({
                where: { projectId, role: 'supervisor' },
                select: { id: true },
            });
            effectiveSupId = supUser?.id || '';
        }
        const dailySheet = await getOrCreateDailySheet(projectId, effectiveSupId, targetDate);
        for (const item of entries) {
            const eqId = item.id || item.equipmentId;
            if (!eqId)
                continue;
            let opId = item.operatorId || null;
            if (!opId) {
                const firstOp = await prisma_1.default.mF_P_Employee.findFirst({
                    where: { projectId, isOperator: true, status: 'active' },
                    select: { id: true },
                });
                opId = firstOp?.id || null;
            }
            const assignment = await prisma_1.default.mF_OP_DailyEquipmentAssignment.upsert({
                where: {
                    dailySheetId_equipmentId: {
                        dailySheetId: dailySheet.id,
                        equipmentId: eqId,
                    },
                },
                update: {
                    ...(opId ? { operatorId: opId } : {}),
                },
                create: {
                    dailySheetId: dailySheet.id,
                    operatorId: opId,
                    equipmentId: eqId,
                },
            });
            const loggedQty = item.daysValue !== undefined && item.daysValue > 0
                ? Number(item.daysValue)
                : Number(item.netHours || item.totalUtilization || 0);
            const dailyLog = await prisma_1.default.mF_OP_EquipmentDailyLog.upsert({
                where: { assignmentId: assignment.id },
                create: {
                    assignmentId: assignment.id,
                    initialMeter: item.startMeter !== undefined ? Number(item.startMeter) : 0,
                    finalMeter: item.endMeter !== undefined ? Number(item.endMeter) : 0,
                    netRunningHours: item.netHours !== undefined ? Number(item.netHours) : 0,
                    workingHours: item.workingHours !== undefined ? Number(item.workingHours) : 0,
                    idleHours: item.idleHours !== undefined ? Number(item.idleHours) : 0,
                    breakdownHours: item.breakdownHours !== undefined ? Number(item.breakdownHours) : 0,
                    fuelLiters: item.fuelIssuedLiters !== undefined ? Number(item.fuelIssuedLiters) : (item.fuelLiters ? Number(item.fuelLiters) : 0),
                    totalMileage: item.totalMileage !== undefined ? Number(item.totalMileage) : 0,
                    startMileage: item.startMileage !== undefined ? Number(item.startMileage) : 0,
                    endMileage: item.endMileage !== undefined ? Number(item.endMileage) : 0,
                    totalUtilization: loggedQty,
                    remarks: item.remarks || null,
                    status: item.status || 'draft',
                },
                update: {
                    initialMeter: item.startMeter !== undefined ? Number(item.startMeter) : undefined,
                    finalMeter: item.endMeter !== undefined ? Number(item.endMeter) : undefined,
                    netRunningHours: item.netHours !== undefined ? Number(item.netHours) : undefined,
                    workingHours: item.workingHours !== undefined ? Number(item.workingHours) : undefined,
                    idleHours: item.idleHours !== undefined ? Number(item.idleHours) : undefined,
                    breakdownHours: item.breakdownHours !== undefined ? Number(item.breakdownHours) : undefined,
                    fuelLiters: item.fuelIssuedLiters !== undefined ? Number(item.fuelIssuedLiters) : (item.fuelLiters !== undefined ? Number(item.fuelLiters) : undefined),
                    totalMileage: item.totalMileage !== undefined ? Number(item.totalMileage) : undefined,
                    startMileage: item.startMileage !== undefined ? Number(item.startMileage) : undefined,
                    endMileage: item.endMileage !== undefined ? Number(item.endMileage) : undefined,
                    totalUtilization: loggedQty,
                    remarks: item.remarks !== undefined ? item.remarks : undefined,
                    status: item.status || undefined,
                },
            });
            if (Array.isArray(item.activitySplits) && item.activitySplits.length > 0) {
                await prisma_1.default.mF_OP_EquipmentDailyLogActivity.deleteMany({
                    where: { dailyLogId: dailyLog.id },
                });
                for (const split of item.activitySplits) {
                    let actCodeId = split.activityCodeId;
                    if (!actCodeId && split.activityCode) {
                        const act = await prisma_1.default.mF_P_ActivityCode.findFirst({
                            where: { projectId, code: split.activityCode },
                            select: { id: true },
                        });
                        actCodeId = act?.id;
                    }
                    if (actCodeId) {
                        await prisma_1.default.mF_OP_EquipmentDailyLogActivity.create({
                            data: {
                                dailyLogId: dailyLog.id,
                                activityCodeId: actCodeId,
                                utilization: split.utilization ? Number(split.utilization) : 0,
                            },
                        });
                    }
                }
            }
        }
        res.json({ success: true, count: entries.length });
    }
    catch (error) {
        console.error('Error saving equipment logs:', error);
        res.status(500).json({ error: 'Failed to save equipment logs' });
    }
};
exports.saveBulkEquipmentLogs = saveBulkEquipmentLogs;
// 12. POST /api/time-entries/labor/bulk — Save bulk labor time entries
const saveBulkLaborTimeEntries = async (req, res) => {
    try {
        const { entries, date, supervisorId } = req.body || {};
        if (!Array.isArray(entries) || !date) {
            res.status(400).json({ error: 'entries array and date are required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const targetDate = parseDate(date);
        const { effectiveDayTypeId, standardHoursCap, isAllOvertime } = await (0, calendarController_1.getDayTypeRulesAndId)(projectId, targetDate);
        let effectiveSupId = supervisorId;
        if (!effectiveSupId) {
            const supUser = await prisma_1.default.mF_P_User.findFirst({
                where: { projectId, role: 'supervisor' },
                select: { id: true },
            });
            effectiveSupId = supUser?.id || '';
        }
        const dailySheet = effectiveSupId ? await getOrCreateDailySheet(projectId, effectiveSupId, targetDate) : null;
        const activityResolutionCache = new Map();
        const equipmentValidationCache = new Map();
        for (const item of entries) {
            const { employeeId, activityId, hours, inTime, outTime, remarks, equipmentId } = item;
            if (!employeeId || !activityId)
                continue;
            const resolvedActivityId = await resolveProjectActivityId(activityId, projectId, activityResolutionCache);
            let validEquipmentId = null;
            if (equipmentId) {
                if (equipmentValidationCache.has(equipmentId)) {
                    validEquipmentId = equipmentValidationCache.get(equipmentId);
                }
                else {
                    const eqExists = await prisma_1.default.mF_P_Equipment.findUnique({
                        where: { id: equipmentId },
                        select: { id: true },
                    });
                    validEquipmentId = eqExists ? eqExists.id : null;
                    equipmentValidationCache.set(equipmentId, validEquipmentId);
                }
            }
            const numHours = hours !== undefined ? parseFloat(hours) : 0;
            const finalInTime = inTime ?? null;
            const finalOutTime = outTime ?? null;
            let shiftHoursVal = null;
            let overtimeHours = 0;
            let breakHours = 0;
            if (finalInTime && finalOutTime) {
                const calc = calculateShiftAndOvertime(finalInTime, finalOutTime, standardHoursCap, isAllOvertime);
                shiftHoursVal = calc.shiftHours;
                overtimeHours = calc.otHours;
                breakHours = calc.breakHours;
            }
            else {
                breakHours = computeBreakHours(finalInTime, finalOutTime);
                overtimeHours = isAllOvertime ? numHours : numHours > standardHoursCap ? numHours - standardHoursCap : 0;
            }
            const existing = await prisma_1.default.mF_OP_TimeEntry.findFirst({
                where: {
                    projectId,
                    employeeId,
                    activityId: resolvedActivityId,
                    date: targetDate,
                },
            });
            if (existing) {
                if (existing.status !== 'submitted' && existing.status !== 'approved') {
                    await prisma_1.default.mF_OP_TimeEntry.update({
                        where: { id: existing.id },
                        data: {
                            hours: numHours,
                            shiftHours: shiftHoursVal,
                            overtimeHours,
                            breakHours,
                            inTime: finalInTime,
                            outTime: finalOutTime,
                            equipmentId: validEquipmentId ?? existing.equipmentId,
                            remarks: remarks ?? existing.remarks,
                        },
                    });
                }
            }
            else {
                await prisma_1.default.mF_OP_TimeEntry.create({
                    data: {
                        projectId,
                        dailySheetId: dailySheet?.id || null,
                        employeeId,
                        recordedById: effectiveSupId || null,
                        date: targetDate,
                        activityId: resolvedActivityId,
                        equipmentId: validEquipmentId,
                        effectiveDayTypeId,
                        inTime: finalInTime,
                        outTime: finalOutTime,
                        hours: numHours,
                        shiftHours: shiftHoursVal,
                        overtimeHours,
                        breakHours,
                        remarks: remarks || null,
                        status: 'draft',
                    },
                });
            }
        }
        res.json({ success: true, count: entries.length });
    }
    catch (error) {
        console.error('Error saving bulk labor time entries:', error);
        res.status(500).json({ error: 'Failed to save labor time entries' });
    }
};
exports.saveBulkLaborTimeEntries = saveBulkLaborTimeEntries;
