"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEmployee = exports.updateEmployeeStatus = exports.updateEmployee = exports.createEmployee = exports.getEmployeeById = exports.getAllEmployees = exports.getDefaultTenantId = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
// Helper to get string param safely in Express 5
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
// Helper to get or ensure the default SaaS tenant (e.g. Mäga Engineering)
const getDefaultTenantId = async () => {
    const tenant = await prisma_1.default.tenant.upsert({
        where: { subdomain: 'maga' },
        update: {},
        create: {
            companyName: 'Mäga Engineering (Pvt) Ltd',
            subdomain: 'maga',
            addressLine1: '200, Nawala Road',
            addressLine2: 'Narahenpita, Colombo 05',
            phone: '+94 11 2808835',
            email: 'info@maga.lk',
            status: 'active',
        },
    });
    return tenant.id;
};
exports.getDefaultTenantId = getDefaultTenantId;
// Get all employees (scoped to tenant)
const getAllEmployees = async (req, res) => {
    try {
        const { status, tradeGroup, businessPartner } = req.query;
        const tenantId = req.query.tenantId || (await (0, exports.getDefaultTenantId)());
        const where = { tenantId };
        if (status && typeof status === 'string') {
            where.status = status;
        }
        if (tradeGroup && typeof tradeGroup === 'string') {
            where.tradeGroup = tradeGroup;
        }
        if (businessPartner && typeof businessPartner === 'string') {
            where.businessPartner = {
                name: { contains: businessPartner, mode: 'insensitive' },
            };
        }
        const employees = await prisma_1.default.employee.findMany({
            where,
            include: {
                businessPartner: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        res.json(employees);
    }
    catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
};
exports.getAllEmployees = getAllEmployees;
// Get employee by ID
const getEmployeeById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const employee = await prisma_1.default.employee.findUnique({
            where: { id },
            include: {
                businessPartner: true,
            },
        });
        if (!employee) {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }
        res.json(employee);
    }
    catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({ error: 'Failed to fetch employee' });
    }
};
exports.getEmployeeById = getEmployeeById;
// Create new employee
const createEmployee = async (req, res) => {
    try {
        const { employeeCode, callingName, fullName, businessPartnerId, tradeGroup, nicNo, dailyRate, epfNo, status, } = req.body;
        if (!callingName || !nicNo) {
            res.status(400).json({ error: 'Missing required fields' });
            return;
        }
        const tenantId = req.body.tenantId || (await (0, exports.getDefaultTenantId)());
        // Prerequisite: At least one business partner must be registered
        const bpCount = await prisma_1.default.businessPartner.count({ where: { tenantId } });
        if (bpCount === 0) {
            res.status(400).json({
                error: 'No registered business partners found. Please register a business partner before adding employees.',
            });
            return;
        }
        let resolvedBpId = businessPartnerId;
        if (!resolvedBpId && req.body.businessPartner) {
            const bpNameOrCode = String(req.body.businessPartner).trim();
            if (bpNameOrCode) {
                const partner = await prisma_1.default.businessPartner.findFirst({
                    where: {
                        tenantId,
                        OR: [
                            { id: bpNameOrCode },
                            { name: { equals: bpNameOrCode, mode: 'insensitive' } },
                            { code: { equals: bpNameOrCode, mode: 'insensitive' } },
                        ],
                    },
                });
                if (partner) {
                    resolvedBpId = partner.id;
                }
            }
        }
        if (!resolvedBpId) {
            res.status(400).json({ error: 'Please select a registered business partner for this employee.' });
            return;
        }
        const partnerExists = await prisma_1.default.businessPartner.findFirst({
            where: { id: resolvedBpId, tenantId },
        });
        if (!partnerExists) {
            res.status(400).json({ error: 'Selected business partner does not exist in this tenant.' });
            return;
        }
        const newEmployee = await prisma_1.default.employee.create({
            data: {
                tenantId,
                employeeCode: employeeCode || `EMP${Date.now().toString().slice(-4)}`,
                callingName,
                fullName: fullName || callingName,
                tradeGroup: tradeGroup || 'General labour',
                nicNo,
                dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : 1400.0,
                epfNo: epfNo || '',
                status: status || 'active',
                businessPartnerId: resolvedBpId || undefined,
            },
            include: {
                businessPartner: true,
            },
        });
        res.status(201).json(newEmployee);
    }
    catch (error) {
        console.error('Error creating employee:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Employee with this code already exists in this tenant' });
            return;
        }
        res.status(500).json({ error: 'Failed to create employee' });
    }
};
exports.createEmployee = createEmployee;
// Update employee
const updateEmployee = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const updateData = { ...req.body };
        if (updateData.dailyRate !== undefined) {
            updateData.dailyRate = parseFloat(updateData.dailyRate);
        }
        if (updateData.businessPartner !== undefined) {
            if (!updateData.businessPartnerId && updateData.businessPartner) {
                const bpNameOrCode = String(updateData.businessPartner).trim();
                if (bpNameOrCode) {
                    const emp = await prisma_1.default.employee.findUnique({ where: { id }, select: { tenantId: true } });
                    const tenantId = emp?.tenantId || (await (0, exports.getDefaultTenantId)());
                    let partner = await prisma_1.default.businessPartner.findFirst({
                        where: {
                            tenantId,
                            OR: [
                                { id: bpNameOrCode },
                                { name: { equals: bpNameOrCode, mode: 'insensitive' } },
                                { code: { equals: bpNameOrCode, mode: 'insensitive' } },
                            ],
                        },
                    });
                    if (!partner) {
                        const count = await prisma_1.default.businessPartner.count({ where: { tenantId } });
                        const code = `BP1${String(count + 1).padStart(6, '0')}`;
                        partner = await prisma_1.default.businessPartner.create({
                            data: {
                                tenantId,
                                name: bpNameOrCode,
                                code,
                            },
                        });
                    }
                    updateData.businessPartnerId = partner.id;
                }
            }
            delete updateData.businessPartner;
        }
        const updatedEmployee = await prisma_1.default.employee.update({
            where: { id },
            data: updateData,
            include: {
                businessPartner: true,
            },
        });
        res.json(updatedEmployee);
    }
    catch (error) {
        console.error('Error updating employee:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to update employee' });
    }
};
exports.updateEmployee = updateEmployee;
// Update status (e.g. active / inactive)
const updateEmployeeStatus = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            res.status(400).json({ error: 'Valid status ("active" | "inactive") is required' });
            return;
        }
        const updated = await prisma_1.default.employee.update({
            where: { id },
            data: { status },
        });
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating employee status:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to update status' });
    }
};
exports.updateEmployeeStatus = updateEmployeeStatus;
// Delete employee
const deleteEmployee = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        await prisma_1.default.employee.delete({
            where: { id },
        });
        res.json({ message: 'Employee deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting employee:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to delete employee' });
    }
};
exports.deleteEmployee = deleteEmployee;
