"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEquipment = exports.toggleEquipmentStatus = exports.updateEquipment = exports.createEquipment = exports.getEquipmentById = exports.getAllEquipment = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
// Initial default equipment list if database table is empty for tenant
const DEFAULT_EQUIPMENT = [
    { code: 'MACM0075', name: 'AIR COMPRESSOR INGERSOLL RAND', type: 'Air compressor', status: 'active' },
    { code: 'MACM0146', name: 'AIR COMPRESSOR FS CURTIS', type: 'Air compressor', status: 'active' },
    { code: 'MACM0158', name: 'AIR COMPRESSOR SULLAIR', type: 'Air compressor', status: 'active' },
    { code: 'MACM0163', name: 'AIR COMPRESSOR ATLAS COPCO', type: 'Air compressor', status: 'active' },
    { code: 'MACM0164', name: 'AIR COMPRESSOR DOOSAN', type: 'Air compressor', status: 'active' },
    { code: 'MACM0170', name: 'AIR COMPRESSOR KAESER', type: 'Air compressor', status: 'active' },
    { code: 'MEXC0012', name: 'EXCAVATOR CAT 320D', type: 'Heavy machinery', status: 'active' },
    { code: 'MJCB0034', name: 'BACKHOE LOADER JCB 3CX', type: 'Heavy machinery', status: 'active' },
    { code: 'MCRN0018', name: 'TOWER CRANE TC-5010', type: 'Crane', status: 'active' },
    { code: 'MTRK0056', name: 'DUMP TRUCK ISUZU 10T', type: 'Transport', status: 'active' },
    { code: 'MMIX0025', name: 'CONCRETE MIXER 350L', type: 'Concrete', status: 'active' },
    { code: 'MROL0042', name: 'COMPACTOR ROLLER BOMAG 8T', type: 'Compaction', status: 'active' },
    { code: 'MGEN0088', name: 'GENERATOR CUMMINS 50kVA', type: 'Power', status: 'active' },
    { code: 'MWEL0091', name: 'WELDING MACHINE INVERTER 400A', type: 'Welding', status: 'inactive' },
];
async function ensureSeedEquipment(tenantId) {
    const count = await prisma_1.default.equipment.count({ where: { tenantId } });
    if (count === 0) {
        for (const item of DEFAULT_EQUIPMENT) {
            await prisma_1.default.equipment.create({
                data: {
                    tenantId,
                    code: item.code,
                    name: item.name,
                    type: item.type,
                    status: item.status,
                },
            });
        }
    }
}
// 1. GET /api/equipment
const getAllEquipment = async (req, res) => {
    try {
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        await ensureSeedEquipment(tenantId);
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
            orderBy: { createdAt: 'desc' },
        });
        res.json(equipment);
    }
    catch (error) {
        console.error('Error fetching equipment:', error);
        res.status(500).json({ error: 'Failed to fetch equipment records' });
    }
};
exports.getAllEquipment = getAllEquipment;
// 2. GET /api/equipment/:id
const getEquipmentById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const item = await prisma_1.default.equipment.findUnique({
            where: { id },
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
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const { code, name, type } = req.body;
        if (!name || !name.trim()) {
            res.status(400).json({ error: 'Equipment name is required' });
            return;
        }
        const created = await prisma_1.default.equipment.create({
            data: {
                tenantId,
                code: code?.trim() || null,
                name: name.trim(),
                type: type?.trim() || null,
                status: 'active',
            },
        });
        res.status(201).json(created);
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
        const { code, name, type, status } = req.body;
        const data = {};
        if (code !== undefined)
            data.code = code?.trim() || null;
        if (name !== undefined)
            data.name = name.trim();
        if (type !== undefined)
            data.type = type?.trim() || null;
        if (status !== undefined)
            data.status = status;
        const updated = await prisma_1.default.equipment.update({
            where: { id },
            data,
        });
        res.json(updated);
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
