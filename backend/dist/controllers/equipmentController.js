"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSiteEquipmentPool = exports.batchSyncCorporateEquipment = exports.getCorporateEquipmentCatalog = exports.batchImportErpEquipment = exports.deleteEquipment = exports.toggleEquipmentStatus = exports.updateEquipment = exports.createEquipment = exports.getEquipmentById = exports.getAllEquipment = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
require("../middleware/tenantMiddleware");
const tenantHelper_1 = require("../utils/tenantHelper");
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
const equipmentSelectOptimized = {
    id: true,
    projectId: true,
    corporateEquipmentId: true,
    condition: true,
    costRate: true,
    status: true,
    meterUnitCode: true,
    ownerPartnerId: true,
    createdAt: true,
    corporateEquipment: {
        select: {
            id: true,
            standardEquipmentNumber: true,
            equipmentName: true,
            condition: true,
            unit: true,
            minimumUtilization: true,
            dailyRate: true,
            businesspartner: {
                select: {
                    id: true,
                    name: true,
                    code: true,
                },
            },
            vehicleNo: true,
            costRate: true,
            type: true,
        },
    },
    ownerPartner: {
        select: {
            id: true,
            code: true,
            name: true,
        },
    },
    meterUnit: {
        select: {
            code: true,
            name: true,
        },
    },
};
function formatEquipment(item) {
    const corp = item.corporateEquipment || {};
    const costRateNum = Number(item.costRate ?? corp.costRate ?? corp.dailyRate ?? 0);
    const primaryUnitStr = item.meterUnitCode || corp.unit || 'Hrs';
    return {
        id: item.id,
        projectId: item.projectId,
        tenantId: item.projectId, // Frontend backwards compatibility
        corporateEquipmentId: item.corporateEquipmentId,
        code: corp.standardEquipmentNumber || corp.vehicleNo || item.id,
        vehicleNo: corp.vehicleNo || corp.standardEquipmentNumber || '',
        vehicle_no: corp.vehicleNo || corp.standardEquipmentNumber || '',
        magaNo: corp.standardEquipmentNumber || '',
        maga_no: corp.standardEquipmentNumber || '',
        name: corp.equipmentName || '',
        type: corp.type || '',
        condition: item.condition || corp.condition || 'DRY',
        costRate: costRateNum,
        cost_rate: costRateNum,
        primaryUnit: primaryUnitStr,
        primary_unit: primaryUnitStr,
        availableUnits: [
            primaryUnitStr,
            ...['mth', 'Hrs', 'Days', 'EX.hrs', 'km', 'm2'].filter((u) => u.toLowerCase() !== primaryUnitStr.toLowerCase()),
        ],
        unitRates: [
            {
                unit: primaryUnitStr,
                rate: costRateNum,
                minUtilization: corp.minimumUtilization ? Number(corp.minimumUtilization) : undefined,
            },
        ],
        status: item.status || 'active',
        ownerPartnerId: item.ownerPartnerId || corp.businesspartner?.id || null,
        businessPartnerId: item.ownerPartnerId || corp.businesspartner?.id || null,
        businessPartner: item.ownerPartner?.name || corp.businesspartner?.name || null,
        businessPartnerCode: item.ownerPartner?.code || corp.businesspartner?.code || '',
        createdAt: item.createdAt,
    };
}
// 1. GET /api/equipment — List equipment for project
const getAllEquipment = async (req, res) => {
    try {
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const { status, type, query } = req.query;
        const where = { projectId };
        if (status && typeof status === 'string' && status !== 'all') {
            where.status = status;
        }
        if (type && typeof type === 'string') {
            where.corporateEquipment = {
                type: { equals: type, mode: 'insensitive' },
            };
        }
        if (query && typeof query === 'string' && query.trim()) {
            const q = query.trim();
            where.corporateEquipment = {
                ...(where.corporateEquipment || {}),
                OR: [
                    { equipmentName: { contains: q, mode: 'insensitive' } },
                    { standardEquipmentNumber: { contains: q, mode: 'insensitive' } },
                    { vehicleNo: { contains: q, mode: 'insensitive' } },
                ],
            };
        }
        const equipment = await prisma_1.default.mF_P_Equipment.findMany({
            where,
            select: equipmentSelectOptimized,
            orderBy: { createdAt: 'desc' },
        });
        res.json(equipment.map(formatEquipment));
    }
    catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment list' });
    }
};
exports.getAllEquipment = getAllEquipment;
// 2. GET /api/equipment/:id — Get equipment by ID
const getEquipmentById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const item = await prisma_1.default.mF_P_Equipment.findUnique({
            where: { id },
            select: equipmentSelectOptimized,
        });
        if (!item) {
            res.status(404).json({ error: 'Equipment not found' });
            return;
        }
        res.json(formatEquipment(item));
    }
    catch (error) {
        console.error('Error fetching equipment by id:', error);
        res.status(500).json({ error: 'Failed to fetch equipment record' });
    }
};
exports.getEquipmentById = getEquipmentById;
// 3. POST /api/equipment — Create new equipment
const createEquipment = async (req, res) => {
    try {
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const { code, vehicleNo, magaNo, name, type, condition, costRate, primaryUnit, businessPartnerId, } = req.body || {};
        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Equipment name is required' });
            return;
        }
        const assignedCode = (code?.trim() || magaNo?.trim() || vehicleNo?.trim() || `EQ-${Date.now().toString().slice(-4)}`).toUpperCase();
        const assignedVehicle = vehicleNo?.trim() || assignedCode;
        const numericCost = costRate !== undefined && costRate !== null && !isNaN(Number(costRate)) ? Number(costRate) : 0;
        const assignedUnit = primaryUnit || 'Hrs';
        const result = await prisma_1.default.$transaction(async (tx) => {
            // 1. Ensure Unit exists if needed
            await tx.mF_G_UnitMaster.upsert({
                where: { code: assignedUnit },
                update: {},
                create: {
                    code: assignedUnit,
                    name: assignedUnit,
                    category: 'meter',
                },
            });
            // 2. Find or create Corporate Equipment
            let corpEquip = await tx.mF_G_Equipment.findFirst({
                where: {
                    OR: [
                        { standardEquipmentNumber: assignedCode },
                        { vehicleNo: assignedVehicle },
                    ],
                },
            });
            if (!corpEquip) {
                corpEquip = await tx.mF_G_Equipment.create({
                    data: {
                        standardEquipmentNumber: assignedCode,
                        equipmentName: name.trim(),
                        vehicleNo: assignedVehicle,
                        type: type?.trim() || null,
                        condition: condition?.trim() || 'DRY',
                        costRate: numericCost,
                        unit: assignedUnit,
                        status: 'active',
                    },
                });
            }
            // 3. Enroll into Site Equipment
            const siteEquip = await tx.mF_P_Equipment.create({
                data: {
                    projectId,
                    corporateEquipmentId: corpEquip.id,
                    condition: condition?.trim() || corpEquip.condition,
                    costRate: numericCost,
                    meterUnitCode: assignedUnit,
                    ownerPartnerId: businessPartnerId || null,
                    status: 'active',
                },
                select: equipmentSelectOptimized,
            });
            return siteEquip;
        });
        res.status(201).json(formatEquipment(result));
    }
    catch (error) {
        console.error('Error creating equipment:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Equipment already enrolled in this project' });
            return;
        }
        res.status(500).json({ error: 'Failed to create equipment' });
    }
};
exports.createEquipment = createEquipment;
// 4. PUT /api/equipment/:id — Update equipment
const updateEquipment = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { name, type, condition, costRate, status, primaryUnit, businessPartnerId, } = req.body || {};
        const existing = await prisma_1.default.mF_P_Equipment.findUnique({
            where: { id },
            select: { id: true, corporateEquipmentId: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Equipment not found' });
            return;
        }
        const data = {};
        if (condition !== undefined)
            data.condition = condition?.trim() || 'DRY';
        if (costRate !== undefined)
            data.costRate = costRate !== null && !isNaN(Number(costRate)) ? Number(costRate) : null;
        if (status !== undefined)
            data.status = status;
        if (primaryUnit !== undefined)
            data.meterUnitCode = primaryUnit;
        if (businessPartnerId !== undefined)
            data.ownerPartnerId = businessPartnerId || null;
        await prisma_1.default.$transaction(async (tx) => {
            await tx.mF_P_Equipment.update({
                where: { id },
                data,
            });
            if (name || type) {
                await tx.mF_G_Equipment.update({
                    where: { id: existing.corporateEquipmentId },
                    data: {
                        equipmentName: name?.trim() || undefined,
                        type: type?.trim() || undefined,
                    },
                });
            }
        });
        const refreshed = await prisma_1.default.mF_P_Equipment.findUnique({
            where: { id },
            select: equipmentSelectOptimized,
        });
        res.json(formatEquipment(refreshed));
    }
    catch (error) {
        console.error('Error updating equipment:', error);
        res.status(500).json({ error: 'Failed to update equipment' });
    }
};
exports.updateEquipment = updateEquipment;
// 5. PATCH /api/equipment/:id/status — Toggle status
const toggleEquipmentStatus = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { status } = req.body || {};
        let targetStatus = status;
        if (!targetStatus) {
            const existing = await prisma_1.default.mF_P_Equipment.findUnique({ where: { id }, select: { status: true } });
            if (!existing) {
                res.status(404).json({ error: 'Equipment not found' });
                return;
            }
            targetStatus = existing.status === 'active' ? 'inactive' : 'active';
        }
        const updated = await prisma_1.default.mF_P_Equipment.update({
            where: { id },
            data: { status: targetStatus },
            select: equipmentSelectOptimized,
        });
        res.json(formatEquipment(updated));
    }
    catch (error) {
        console.error('Error toggling equipment status:', error);
        res.status(500).json({ error: 'Failed to toggle equipment status' });
    }
};
exports.toggleEquipmentStatus = toggleEquipmentStatus;
// 6. DELETE /api/equipment/:id — Delete or soft-deactivate
const deleteEquipment = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const [assignmentsCount, entriesCount] = await Promise.all([
            prisma_1.default.mF_OP_DailyEquipmentAssignment.count({ where: { equipmentId: id } }),
            prisma_1.default.mF_OP_TimeEntry.count({ where: { equipmentId: id } }),
        ]);
        const totalUsage = assignmentsCount + entriesCount;
        if (totalUsage > 0) {
            await prisma_1.default.mF_P_Equipment.update({
                where: { id },
                data: { status: 'inactive' },
            });
            res.json({ message: 'Equipment deactivated successfully (has operational history)' });
            return;
        }
        await prisma_1.default.mF_P_Equipment.delete({
            where: { id },
        });
        res.json({ message: 'Equipment deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting equipment:', error);
        res.status(500).json({ error: 'Failed to delete equipment' });
    }
};
exports.deleteEquipment = deleteEquipment;
// 7. POST /api/equipment/batch-erp-import — Import into project
const batchImportErpEquipment = async (req, res) => {
    try {
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Non-empty items array is required' });
            return;
        }
        const imported = [];
        for (const item of items) {
            const code = (item.standardEquipmentNumber || item.code || item.vehicleNo || '').trim().toUpperCase();
            if (!code)
                continue;
            const name = item.name || item.equipmentName || code;
            const unit = item.primaryUnit || item.unit || 'Hrs';
            const numericRate = item.costRate !== undefined ? Number(item.costRate) : 0;
            // Ensure unit exists
            await prisma_1.default.mF_G_UnitMaster.upsert({
                where: { code: unit },
                update: {},
                create: { code: unit, name: unit, category: 'meter' },
            });
            // Find or create Corporate Equipment
            let corp = await prisma_1.default.mF_G_Equipment.findFirst({
                where: {
                    OR: [
                        { standardEquipmentNumber: code },
                        { vehicleNo: item.vehicleNo || code },
                    ],
                },
            });
            if (corp) {
                corp = await prisma_1.default.mF_G_Equipment.update({
                    where: { id: corp.id },
                    data: {
                        equipmentName: name,
                        unit,
                    },
                });
            }
            else {
                corp = await prisma_1.default.mF_G_Equipment.create({
                    data: {
                        standardEquipmentNumber: code,
                        equipmentName: name,
                        vehicleNo: item.vehicleNo || code,
                        unit,
                        costRate: numericRate,
                        condition: item.condition || 'DRY',
                        type: item.type || null,
                        status: 'active',
                    },
                });
            }
            // Upsert into Site Equipment
            const site = await prisma_1.default.mF_P_Equipment.upsert({
                where: {
                    projectId_corporateEquipmentId: {
                        projectId,
                        corporateEquipmentId: corp.id,
                    },
                },
                update: {
                    condition: item.condition || corp.condition,
                    costRate: numericRate,
                    meterUnitCode: unit,
                    status: 'active',
                },
                create: {
                    projectId,
                    corporateEquipmentId: corp.id,
                    condition: item.condition || corp.condition,
                    costRate: numericRate,
                    meterUnitCode: unit,
                    status: 'active',
                },
                select: equipmentSelectOptimized,
            });
            imported.push(formatEquipment(site));
        }
        res.json({ success: true, count: imported.length, items: imported });
    }
    catch (error) {
        console.error('Error batch importing ERP equipment:', error);
        res.status(500).json({ error: 'Failed to batch import equipment' });
    }
};
exports.batchImportErpEquipment = batchImportErpEquipment;
// 8. GET /api/equipment/corporate-master — Catalog from corporate
const getCorporateEquipmentCatalog = async (_req, res) => {
    try {
        const list = await prisma_1.default.mF_G_Equipment.findMany({
            orderBy: { standardEquipmentNumber: 'asc' },
        });
        res.json(list);
    }
    catch (error) {
        console.error('Error fetching corporate equipment catalog:', error);
        res.status(500).json({ error: 'Failed to fetch corporate equipment catalog' });
    }
};
exports.getCorporateEquipmentCatalog = getCorporateEquipmentCatalog;
// 9. POST /api/equipment/corporate-master/batch — Batch sync corporate equipment
const batchSyncCorporateEquipment = async (req, res) => {
    try {
        const { items } = req.body || {};
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Array of items required' });
            return;
        }
        const results = [];
        for (const item of items) {
            const code = (item.standardEquipmentNumber || item.code || item.vehicleNo || '').trim().toUpperCase();
            if (!code)
                continue;
            let record = await prisma_1.default.mF_G_Equipment.findFirst({
                where: { standardEquipmentNumber: code },
            });
            if (record) {
                record = await prisma_1.default.mF_G_Equipment.update({
                    where: { id: record.id },
                    data: {
                        equipmentName: item.equipmentName || item.name || code,
                        vehicleNo: item.vehicleNo || null,
                        condition: item.condition || 'DRY',
                        unit: item.unit || 'Hrs',
                        dailyRate: item.dailyRate ? Number(item.dailyRate) : 0,
                        costRate: item.costRate ? Number(item.costRate) : 0,
                        type: item.type || null,
                    },
                });
            }
            else {
                record = await prisma_1.default.mF_G_Equipment.create({
                    data: {
                        standardEquipmentNumber: code,
                        equipmentName: item.equipmentName || item.name || code,
                        vehicleNo: item.vehicleNo || null,
                        condition: item.condition || 'DRY',
                        unit: item.unit || 'Hrs',
                        dailyRate: item.dailyRate ? Number(item.dailyRate) : 0,
                        costRate: item.costRate ? Number(item.costRate) : 0,
                        type: item.type || null,
                    },
                });
            }
            results.push(record);
        }
        res.json({ success: true, count: results.length });
    }
    catch (error) {
        console.error('Error batch syncing corporate equipment:', error);
        res.status(500).json({ error: 'Failed to batch sync corporate equipment' });
    }
};
exports.batchSyncCorporateEquipment = batchSyncCorporateEquipment;
function parseDate(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
}
// 12. GET /api/equipment/site-pool — List site equipment pool with live status & smart meter
const getSiteEquipmentPool = async (req, res) => {
    try {
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const dateStr = req.query.date;
        const targetDate = dateStr ? parseDate(dateStr) : new Date();
        // 1. Get all active equipment allocated to this project
        const equipmentList = await prisma_1.default.mF_P_Equipment.findMany({
            where: {
                projectId,
                status: 'active',
            },
            include: {
                corporateEquipment: {
                    select: {
                        id: true,
                        standardEquipmentNumber: true,
                        equipmentName: true,
                        condition: true,
                        unit: true,
                        vehicleNo: true,
                        type: true,
                    },
                },
                meterUnit: true,
            },
            orderBy: {
                corporateEquipment: {
                    standardEquipmentNumber: 'asc',
                },
            },
        });
        // 2. Fetch today's assignments on this targetDate to see who is using what
        const todayAssignments = await prisma_1.default.mF_OP_DailyEquipmentAssignment.findMany({
            where: {
                dailySheet: {
                    projectId,
                    date: targetDate,
                },
            },
            select: {
                equipmentId: true,
                dailySheet: {
                    select: {
                        supervisorId: true,
                        status: true,
                        supervisor: {
                            select: {
                                id: true,
                                fullName: true,
                                username: true,
                            },
                        },
                    },
                },
                dailyLog: {
                    select: {
                        unitCode: true,
                        totalUtilization: true,
                        workingHours: true,
                        idleHours: true,
                        breakdownHours: true,
                        initialMeter: true,
                        finalMeter: true,
                        startMileage: true,
                        endMileage: true,
                        totalMileage: true,
                        status: true,
                        activities: {
                            select: {
                                activityCode: {
                                    select: {
                                        code: true,
                                        description: true,
                                    },
                                },
                                hours: true,
                                utilization: true,
                            },
                        },
                    },
                },
            },
        });
        // Group today's assignments by equipmentId
        const usageByEquipment = new Map();
        for (const asgn of todayAssignments) {
            const list = usageByEquipment.get(asgn.equipmentId) || [];
            const sup = asgn.dailySheet.supervisor;
            const log = asgn.dailyLog;
            const activities = (log?.activities || []).map((a) => ({
                code: a.activityCode?.code || '',
                name: a.activityCode?.description || '',
                hours: a.hours ? Number(a.hours) : 0,
                utilization: a.utilization ? Number(a.utilization) : 0,
            }));
            // Determine real status: submitted/approved on dailySheet takes precedence over draft
            const effectiveStatus = (asgn.dailySheet?.status === 'submitted' || asgn.dailySheet?.status === 'approved')
                ? asgn.dailySheet.status
                : (log?.status || 'draft');
            list.push({
                supervisorName: sup?.fullName || sup?.username || 'Supervisor',
                supervisorId: asgn.dailySheet.supervisorId,
                unitCode: log?.unitCode || undefined,
                totalUtilization: log?.totalUtilization ? Number(log.totalUtilization) : 0,
                workingHours: log?.workingHours ? Number(log.workingHours) : 0,
                initialMeter: log?.initialMeter ? Number(log.initialMeter) : undefined,
                finalMeter: log?.finalMeter ? Number(log.finalMeter) : undefined,
                startMileage: log?.startMileage ? Number(log.startMileage) : undefined,
                endMileage: log?.endMileage ? Number(log.endMileage) : undefined,
                status: effectiveStatus,
                activities,
            });
            usageByEquipment.set(asgn.equipmentId, list);
        }
        // 3. For each equipment, find the latest recorded final meter and mileage (for smart handover)
        const latestLogs = await prisma_1.default.mF_OP_DailyEquipmentAssignment.findMany({
            where: {
                equipment: { projectId },
                dailyLog: { isNot: null },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: 200,
            select: {
                equipmentId: true,
                dailyLog: {
                    select: {
                        finalMeter: true,
                        endMileage: true,
                    },
                },
            },
        });
        const latestMeterMap = new Map();
        const latestMileageMap = new Map();
        for (const log of latestLogs) {
            if (!latestMeterMap.has(log.equipmentId) && log.dailyLog?.finalMeter) {
                latestMeterMap.set(log.equipmentId, Number(log.dailyLog.finalMeter));
            }
            if (!latestMileageMap.has(log.equipmentId) && log.dailyLog?.endMileage) {
                latestMileageMap.set(log.equipmentId, Number(log.dailyLog.endMileage));
            }
        }
        const pool = equipmentList.map((item) => {
            const corp = item.corporateEquipment || {};
            const primaryUnit = item.meterUnitCode || corp.unit || 'Hrs';
            const usages = usageByEquipment.get(item.id) || [];
            const isInUseToday = usages.length > 0;
            const currentSupervisors = Array.from(new Set(usages.map((u) => u.supervisorName)));
            // Calculate unit-specific aggregates across all supervisors on this equipment today
            let totalLoggedDays = 0;
            let totalLoggedHours = 0;
            let totalLoggedMileage = 0;
            for (const u of usages) {
                // Only count towards capacity if actual work was recorded
                const hasQuantity = (u.totalUtilization > 0) || (u.workingHours > 0);
                if (!hasQuantity)
                    continue;
                const uCode = (u.unitCode || primaryUnit || '').toLowerCase();
                if (uCode === 'days' || uCode === 'day') {
                    totalLoggedDays += u.totalUtilization || 0;
                }
                else if (uCode === 'hrs' || uCode === 'hr' || uCode === 'ex.hrs') {
                    totalLoggedHours += (u.workingHours || u.totalUtilization || 0);
                }
                else if (uCode === 'km') {
                    totalLoggedMileage += u.totalUtilization || 0;
                }
                else {
                    // If totalUtilization was logged under Days/mth
                    if (u.totalUtilization <= 1.5 && (primaryUnit.toLowerCase() === 'days' || primaryUnit.toLowerCase() === 'mth')) {
                        totalLoggedDays += u.totalUtilization;
                    }
                    else {
                        totalLoggedHours += (u.workingHours || u.totalUtilization || 0);
                    }
                }
            }
            // Best starting meter reading:
            // If someone logged today and recorded a final meter, use the latest; otherwise fallback to historical
            const todayFinalMeter = usages.slice().reverse().find((u) => u.finalMeter && u.finalMeter > 0)?.finalMeter;
            const latestMeter = todayFinalMeter ?? latestMeterMap.get(item.id) ?? 0;
            // Best starting mileage reading:
            const todayEndMileage = usages.slice().reverse().find((u) => u.endMileage && u.endMileage > 0)?.endMileage;
            const latestMileage = todayEndMileage ?? latestMileageMap.get(item.id) ?? 0;
            return {
                id: item.id,
                projectId: item.projectId,
                code: corp.standardEquipmentNumber || corp.vehicleNo || item.id,
                vehicleNo: corp.vehicleNo || corp.standardEquipmentNumber || '',
                magaNo: corp.standardEquipmentNumber || '',
                name: corp.equipmentName || '',
                type: corp.type || 'Equipment',
                condition: item.condition || corp.condition || 'DRY',
                primaryUnit,
                availableUnits: [primaryUnit, ...['Hrs', 'Days', 'EX.hrs', 'mth', 'km', 'm2'].filter((u) => u.toLowerCase() !== primaryUnit.toLowerCase())],
                status: item.status || 'active',
                isInUseToday,
                currentSupervisors,
                latestMeter,
                latestMileage,
                totalLoggedDays: Number(totalLoggedDays.toFixed(2)),
                totalLoggedHours: Number(totalLoggedHours.toFixed(1)),
                totalLoggedMileage: Number(totalLoggedMileage.toFixed(1)),
                existingUsages: usages,
            };
        });
        res.json(pool);
    }
    catch (error) {
        console.error('Error fetching site equipment pool:', error);
        res.status(500).json({ error: 'Failed to fetch site equipment pool' });
    }
};
exports.getSiteEquipmentPool = getSiteEquipmentPool;
