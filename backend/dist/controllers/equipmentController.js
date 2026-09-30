"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.batchSyncCorporateEquipment = exports.getCorporateEquipmentCatalog = exports.batchImportErpEquipment = exports.deleteEquipment = exports.toggleEquipmentStatus = exports.updateEquipment = exports.createEquipment = exports.getEquipmentById = exports.getAllEquipment = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
// 1. GET /api/equipment
const getAllEquipment = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { status, type, query } = req.query;
        const where = { tenantId };
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (type && typeof type === 'string') {
            where.type = type;
        }
        if (query && typeof query === 'string') {
            where.OR = [
                { name: { contains: query, mode: 'insensitive' } },
                { code: { contains: query, mode: 'insensitive' } },
            ];
        }
        const equipment = await prisma_1.default.equipment.findMany({
            where,
            include: {
                unitRates: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(equipment);
    }
    catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment list' });
    }
};
exports.getAllEquipment = getAllEquipment;
// 2. GET /api/equipment/:id
const getEquipmentById = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await prisma_1.default.equipment.findUnique({
            where: { id: id },
            include: {
                unitRates: true,
            },
        });
        if (!item) {
            res.status(404).json({ error: 'Equipment not found' });
            return;
        }
        res.json(item);
    }
    catch (error) {
        console.error('Error fetching equipment by id:', error);
        res.status(500).json({ error: 'Failed to fetch equipment record' });
    }
};
exports.getEquipmentById = getEquipmentById;
// 3. POST /api/equipment
const createEquipment = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { code, vehicleNo, magaNo, name, type, condition, costRate, primaryUnit, availableUnits, unitRates } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Equipment name is required' });
            return;
        }
        const assignedCode = code?.trim() || vehicleNo?.trim() || magaNo?.trim() || null;
        const numericCost = costRate !== undefined && costRate !== null && !isNaN(Number(costRate)) ? Number(costRate) : 0;
        const created = await prisma_1.default.equipment.create({
            data: {
                tenantId,
                code: assignedCode,
                vehicleNo: vehicleNo?.trim() || assignedCode,
                magaNo: magaNo?.trim() || null,
                name: name.trim(),
                type: type?.trim() || null,
                condition: condition?.trim() || 'DRY',
                costRate: numericCost,
                primaryUnit: primaryUnit || 'mth',
                availableUnits: Array.isArray(availableUnits) ? availableUnits : [],
                status: 'active',
            },
        });
        // Create unit rates if provided
        if (Array.isArray(unitRates) && unitRates.length > 0) {
            for (const ur of unitRates) {
                if (ur.unit) {
                    await prisma_1.default.equipmentUnitRate.upsert({
                        where: {
                            equipmentId_unit: { equipmentId: created.id, unit: ur.unit },
                        },
                        update: {
                            erpBillingCode: ur.erpBillingCode || null,
                            rate: ur.rate !== undefined && !isNaN(Number(ur.rate)) ? Number(ur.rate) : numericCost,
                            minUtilization: ur.minUtilization !== undefined && !isNaN(Number(ur.minUtilization)) ? Number(ur.minUtilization) : null,
                        },
                        create: {
                            equipmentId: created.id,
                            unit: ur.unit,
                            erpBillingCode: ur.erpBillingCode || null,
                            rate: ur.rate !== undefined && !isNaN(Number(ur.rate)) ? Number(ur.rate) : numericCost,
                            minUtilization: ur.minUtilization !== undefined && !isNaN(Number(ur.minUtilization)) ? Number(ur.minUtilization) : null,
                        },
                    });
                }
            }
        }
        else {
            // Default rate entry for primary unit
            await prisma_1.default.equipmentUnitRate.create({
                data: {
                    equipmentId: created.id,
                    unit: primaryUnit || 'mth',
                    rate: numericCost,
                },
            });
        }
        const result = await prisma_1.default.equipment.findUnique({
            where: { id: created.id },
            include: { unitRates: true },
        });
        res.status(201).json(result);
    }
    catch (error) {
        console.error('Error creating equipment:', error);
        res.status(500).json({ error: 'Failed to create equipment' });
    }
};
exports.createEquipment = createEquipment;
// 4. PUT /api/equipment/:id
const updateEquipment = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { code, vehicleNo, magaNo, name, type, condition, costRate, status, primaryUnit, availableUnits, unitRates } = req.body;
        const data = {};
        if (code !== undefined)
            data.code = code?.trim() || null;
        if (vehicleNo !== undefined)
            data.vehicleNo = vehicleNo?.trim() || null;
        if (magaNo !== undefined)
            data.magaNo = magaNo?.trim() || null;
        if (name !== undefined)
            data.name = name.trim();
        if (type !== undefined)
            data.type = type?.trim() || null;
        if (condition !== undefined)
            data.condition = condition?.trim() || 'DRY';
        if (costRate !== undefined) {
            data.costRate = costRate !== null && !isNaN(Number(costRate)) ? Number(costRate) : null;
        }
        if (status !== undefined)
            data.status = status;
        if (primaryUnit !== undefined)
            data.primaryUnit = primaryUnit;
        if (availableUnits !== undefined)
            data.availableUnits = Array.isArray(availableUnits) ? availableUnits : [];
        const updated = await prisma_1.default.equipment.update({
            where: { id },
            data,
        });
        if (Array.isArray(unitRates)) {
            for (const ur of unitRates) {
                if (ur.unit) {
                    await prisma_1.default.equipmentUnitRate.upsert({
                        where: {
                            equipmentId_unit: { equipmentId: id, unit: ur.unit },
                        },
                        update: {
                            erpBillingCode: ur.erpBillingCode || null,
                            rate: ur.rate !== undefined && !isNaN(Number(ur.rate)) ? Number(ur.rate) : 0,
                            minUtilization: ur.minUtilization !== undefined && !isNaN(Number(ur.minUtilization)) ? Number(ur.minUtilization) : null,
                        },
                        create: {
                            equipmentId: id,
                            unit: ur.unit,
                            erpBillingCode: ur.erpBillingCode || null,
                            rate: ur.rate !== undefined && !isNaN(Number(ur.rate)) ? Number(ur.rate) : 0,
                            minUtilization: ur.minUtilization !== undefined && !isNaN(Number(ur.minUtilization)) ? Number(ur.minUtilization) : null,
                        },
                    });
                }
            }
        }
        const result = await prisma_1.default.equipment.findUnique({
            where: { id },
            include: { unitRates: true },
        });
        res.json(result);
    }
    catch (error) {
        console.error('Error updating equipment:', error);
        res.status(500).json({ error: 'Failed to update equipment' });
    }
};
exports.updateEquipment = updateEquipment;
// 5. PATCH /api/equipment/:id/status
const toggleEquipmentStatus = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { status } = req.body;
        let targetStatus = status;
        if (!targetStatus) {
            const existing = await prisma_1.default.equipment.findUnique({ where: { id } });
            if (!existing) {
                res.status(404).json({ error: 'Equipment not found' });
                return;
            }
            targetStatus = existing.status === 'active' ? 'inactive' : 'active';
        }
        const updated = await prisma_1.default.equipment.update({
            where: { id },
            data: { status: targetStatus },
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error toggling equipment status:', error);
        res.status(500).json({ error: 'Failed to toggle equipment status' });
    }
};
exports.toggleEquipmentStatus = toggleEquipmentStatus;
// 6. DELETE /api/equipment/:id
const deleteEquipment = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        await prisma_1.default.equipment.delete({
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
// 7. POST /api/equipment/batch-erp-import
// Groups multi-line ERP rows for the same vehicle/equipment into a single Equipment with multiple unit rates
const batchImportErpEquipment = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Non-empty items array is required' });
            return;
        }
        // Grouping by vehicleNo (if present) OR standardEquipmentNumber
        const grouped = new Map();
        for (const row of items) {
            const stdEqNo = (row.standardEquipmentNumber || row.standard_equipment_number || row.magaNo || '').trim();
            const vehicleNo = (row.vehicleNo || row.vehicle_no || '').trim();
            const erpNewCode = (row.erpNewCode || row.erp_new_code || row.erpSuffixCode || row.code || '').trim();
            // Determine standard code: if stdEqNo is provided, use it; else if erpNewCode, strip letter suffix; else fallback to vehicleNo
            const baseStandardNo = stdEqNo || (erpNewCode ? erpNewCode.replace(/[A-Za-z]$/, '') : '') || vehicleNo;
            // Grouping key: vehicleNo if present, otherwise standardEquipmentNumber
            const groupKey = vehicleNo || baseStandardNo || erpNewCode;
            if (!groupKey)
                continue;
            const unit = (row.unit || row.primaryUnit || 'hrs').trim().toLowerCase();
            const rateVal = Number(row.dailyRate ?? row.costRate ?? row.rate ?? 0);
            const minUtil = (row.minimumUtilization !== undefined && row.minimumUtilization !== null)
                ? Number(row.minimumUtilization)
                : (row.minUtilization !== undefined && row.minUtilization !== null)
                    ? Number(row.minUtilization)
                    : undefined;
            const bp = (row.businessPartner || row.business_partner || '').trim();
            const eqName = (row.equipmentName || row.equipment_name || row.equipment || row.name || row.description || groupKey).trim();
            const eqCondition = (row.condition || 'DRY').trim().toUpperCase();
            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, {
                    vehicleNo: vehicleNo || (groupKey.startsWith('P') ? groupKey : ''),
                    standardEquipmentNumber: baseStandardNo || groupKey,
                    name: eqName,
                    type: (row.type || 'Equipment').trim(),
                    condition: eqCondition,
                    businessPartner: bp || undefined,
                    rates: [],
                });
            }
            grouped.get(groupKey).rates.push({
                unit,
                erpBillingCode: erpNewCode || baseStandardNo,
                rate: rateVal,
                minUtilization: minUtil,
            });
        }
        const savedRecords = [];
        for (const [key, data] of grouped.entries()) {
            // Find or link Business Partner if provided
            let ownerPartnerId = undefined;
            if (data.businessPartner) {
                let partner = await prisma_1.default.businessPartner.findFirst({
                    where: {
                        tenantId,
                        OR: [
                            { code: data.businessPartner },
                            { name: data.businessPartner },
                        ],
                    },
                });
                if (!partner) {
                    partner = await prisma_1.default.businessPartner.create({
                        data: {
                            tenantId,
                            code: data.businessPartner,
                            name: data.businessPartner,
                            type: 'Subcontractor',
                        },
                    });
                }
                ownerPartnerId = partner.id;
            }
            // Find or upsert equipment
            const existing = await prisma_1.default.equipment.findFirst({
                where: {
                    tenantId,
                    OR: [
                        { code: key },
                        ...(data.vehicleNo ? [{ vehicleNo: data.vehicleNo }] : []),
                        ...(data.standardEquipmentNumber ? [{ magaNo: data.standardEquipmentNumber }] : []),
                    ],
                },
            });
            const unitsList = Array.from(new Set(data.rates.map((r) => r.unit)));
            const primaryRate = data.rates[0]?.rate || 0;
            const primaryUnit = data.rates[0]?.unit || 'hrs';
            let equipmentId;
            if (existing) {
                equipmentId = existing.id;
                await prisma_1.default.equipment.update({
                    where: { id: existing.id },
                    data: {
                        vehicleNo: data.vehicleNo || existing.vehicleNo,
                        magaNo: data.standardEquipmentNumber || existing.magaNo,
                        name: data.name || existing.name,
                        type: data.type || existing.type,
                        condition: data.condition || existing.condition,
                        costRate: primaryRate || existing.costRate,
                        primaryUnit: existing.primaryUnit || primaryUnit,
                        availableUnits: Array.from(new Set([...(existing.availableUnits || []), ...unitsList])),
                        ...(ownerPartnerId ? { ownerPartnerId } : {}),
                    },
                });
            }
            else {
                const created = await prisma_1.default.equipment.create({
                    data: {
                        tenantId,
                        code: key,
                        vehicleNo: data.vehicleNo || null,
                        magaNo: data.standardEquipmentNumber || null,
                        name: data.name,
                        type: data.type,
                        condition: data.condition,
                        costRate: primaryRate,
                        primaryUnit,
                        availableUnits: unitsList,
                        status: 'active',
                        ...(ownerPartnerId ? { ownerPartnerId } : {}),
                    },
                });
                equipmentId = created.id;
            }
            // Upsert unit rates
            for (const r of data.rates) {
                await prisma_1.default.equipmentUnitRate.upsert({
                    where: {
                        equipmentId_unit: { equipmentId, unit: r.unit },
                    },
                    update: {
                        erpBillingCode: r.erpBillingCode || null,
                        rate: r.rate,
                        minUtilization: r.minUtilization ?? null,
                    },
                    create: {
                        equipmentId,
                        unit: r.unit,
                        erpBillingCode: r.erpBillingCode || null,
                        rate: r.rate,
                        minUtilization: r.minUtilization ?? null,
                    },
                });
            }
            const fullEq = await prisma_1.default.equipment.findUnique({
                where: { id: equipmentId },
                include: { unitRates: true, ownerPartner: true },
            });
            savedRecords.push(fullEq);
        }
        res.json({
            success: true,
            importedCount: savedRecords.length,
            equipment: savedRecords,
        });
    }
    catch (error) {
        console.error('Error batch importing ERP equipment:', error);
        res.status(500).json({ error: 'Failed to batch import ERP equipment' });
    }
};
exports.batchImportErpEquipment = batchImportErpEquipment;
// ─────────────────────────────────────────────────────────────────────────────
// CENTRAL CORPORATE ERP CATALOG CONTROLLERS
// ─────────────────────────────────────────────────────────────────────────────
const getCorporateEquipmentCatalog = async (_req, res) => {
    try {
        const list = await prisma_1.default.corporateEquipment.findMany({
            orderBy: [
                { standardEquipmentNumber: 'asc' },
                { erpNewCode: 'asc' },
            ],
        });
        const formatted = list.map((item) => ({
            ...item,
            code: item.erpNewCode || item.code || item.standardEquipmentNumber || '',
            name: item.equipmentName || item.description || item.standardEquipmentNumber || 'Equipment',
            type: item.type || 'Equipment',
            sourceProject: item.currentWorkingProject || 'Central Depot',
            costRate: Number(item.dailyRate ?? item.costRate ?? 0),
            dailyRate: Number(item.dailyRate ?? item.costRate ?? 0),
            model: item.model || '',
            registrationNo: item.registrationNo || item.vehicleNo || '',
            searchKey: item.searchKey || item.equipmentName || '',
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching corporate equipment catalog:', error);
        res.status(500).json({ error: 'Failed to fetch corporate equipment catalog' });
    }
};
exports.getCorporateEquipmentCatalog = getCorporateEquipmentCatalog;
const batchSyncCorporateEquipment = async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({ error: 'Non-empty items array is required' });
            return;
        }
        const synced = [];
        for (const row of items) {
            const stdEqNo = (row.standardEquipmentNumber || row.standard_equipment_number || row.magaNo || row.code || '').trim();
            const erpCode = (row.erpNewCode || row.erp_new_code || row.erpSuffixCode || row.code || '').trim();
            const eqName = (row.equipmentName || row.equipment_name || row.equipment || row.name || row.description || '').trim();
            if (!stdEqNo || !erpCode)
                continue;
            const record = await prisma_1.default.corporateEquipment.upsert({
                where: { erpNewCode: erpCode },
                update: {
                    standardEquipmentNumber: stdEqNo,
                    equipmentName: eqName || stdEqNo,
                    condition: (row.condition || 'DRY').trim().toUpperCase(),
                    unit: (row.unit || 'hrs').trim(),
                    minimumUtilization: (row.minimumUtilization !== undefined && row.minimumUtilization !== null)
                        ? Number(row.minimumUtilization)
                        : (row.minUtilization !== undefined ? Number(row.minUtilization) : null),
                    dailyRate: Number(row.dailyRate ?? row.costRate ?? row.rate ?? 0),
                    businessPartner: (row.businessPartner || row.business_partner || null)?.trim(),
                    vehicleNo: (row.vehicleNo || row.vehicle_no || null)?.trim(),
                    code: erpCode,
                    description: eqName,
                },
                create: {
                    standardEquipmentNumber: stdEqNo,
                    equipmentName: eqName || stdEqNo,
                    condition: (row.condition || 'DRY').trim().toUpperCase(),
                    unit: (row.unit || 'hrs').trim(),
                    minimumUtilization: (row.minimumUtilization !== undefined && row.minimumUtilization !== null)
                        ? Number(row.minimumUtilization)
                        : (row.minUtilization !== undefined ? Number(row.minUtilization) : null),
                    dailyRate: Number(row.dailyRate ?? row.costRate ?? row.rate ?? 0),
                    businessPartner: (row.businessPartner || row.business_partner || null)?.trim(),
                    erpNewCode: erpCode,
                    vehicleNo: (row.vehicleNo || row.vehicle_no || null)?.trim(),
                    code: erpCode,
                    description: eqName,
                },
            });
            synced.push(record);
        }
        res.json({
            success: true,
            syncedCount: synced.length,
            items: synced,
        });
    }
    catch (error) {
        console.error('Error batch syncing corporate equipment:', error);
        res.status(500).json({ error: 'Failed to batch sync corporate equipment' });
    }
};
exports.batchSyncCorporateEquipment = batchSyncCorporateEquipment;
