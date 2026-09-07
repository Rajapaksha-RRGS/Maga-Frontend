"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleBusinessPartnerStatus = exports.deleteBusinessPartner = exports.updateBusinessPartner = exports.createBusinessPartner = exports.getNextBusinessPartnerCode = exports.getBusinessPartnerById = exports.getAllBusinessPartners = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
// Helper to extract string param
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
// Get all business partners
const getAllBusinessPartners = async (req, res) => {
    try {
        const { status, search } = req.query;
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const where = { tenantId };
        if (status && typeof status === 'string' && status !== 'all') {
            where.status = status;
        }
        if (search && typeof search === 'string') {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { code: { contains: search, mode: 'insensitive' } },
                { contactPerson: { contains: search, mode: 'insensitive' } },
            ];
        }
        const partners = await prisma_1.default.businessPartner.findMany({
            where,
            include: {
                _count: {
                    select: { employees: true },
                },
            },
            orderBy: { code: 'asc' },
        });
        // Format response to include employee count
        const formatted = partners.map((p) => ({
            ...p,
            employeeCount: p._count.employees,
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching business partners:', error);
        res.status(500).json({ error: 'Failed to fetch business partners' });
    }
};
exports.getAllBusinessPartners = getAllBusinessPartners;
// Get single business partner
const getBusinessPartnerById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const partner = await prisma_1.default.businessPartner.findUnique({
            where: { id },
            include: {
                employees: true,
            },
        });
        if (!partner) {
            res.status(404).json({ error: 'Business partner not found' });
            return;
        }
        res.json(partner);
    }
    catch (error) {
        console.error('Error fetching business partner:', error);
        res.status(500).json({ error: 'Failed to fetch business partner' });
    }
};
exports.getBusinessPartnerById = getBusinessPartnerById;
// Get next available BP code (BP1xxxxxx)
const getNextBusinessPartnerCode = async (req, res) => {
    try {
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const latest = await prisma_1.default.businessPartner.findFirst({
            where: {
                tenantId,
                code: { startsWith: 'BP1' },
            },
            orderBy: { code: 'desc' },
        });
        if (!latest) {
            res.json({ nextCode: 'BP1001001' });
            return;
        }
        const currentNum = parseInt(latest.code.replace('BP', ''), 10);
        if (isNaN(currentNum)) {
            res.json({ nextCode: 'BP1001001' });
            return;
        }
        const nextCode = `BP${currentNum + 1}`;
        res.json({ nextCode });
    }
    catch (error) {
        console.error('Error getting next code:', error);
        res.status(500).json({ error: 'Failed to generate next code' });
    }
};
exports.getNextBusinessPartnerCode = getNextBusinessPartnerCode;
// Create new business partner
const createBusinessPartner = async (req, res) => {
    try {
        const { code, name, contactPerson, phone, email, address, status } = req.body;
        if (!code || !name) {
            res.status(400).json({ error: 'Code and Name are required fields' });
            return;
        }
        // Validate standard BP1xxxxxx format (BP1 + 6 digits)
        const bpRegex = /^BP1\d{6}$/;
        if (!bpRegex.test(code)) {
            res.status(400).json({
                error: 'Invalid BP Code format. Must start with BP1 followed by 6 digits (e.g. BP1004093)',
            });
            return;
        }
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const partner = await prisma_1.default.businessPartner.create({
            data: {
                tenantId,
                code,
                name,
                contactPerson: contactPerson || null,
                phone: phone || null,
                email: email || null,
                address: address || null,
                status: status || 'active',
            },
        });
        res.status(201).json(partner);
    }
    catch (error) {
        console.error('Error creating business partner:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: `Business Partner with code ${req.body.code} already exists` });
            return;
        }
        res.status(500).json({ error: 'Failed to create business partner' });
    }
};
exports.createBusinessPartner = createBusinessPartner;
// Update business partner
const updateBusinessPartner = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { name, contactPerson, phone, email, address, status } = req.body;
        const partner = await prisma_1.default.businessPartner.update({
            where: { id },
            data: {
                name,
                contactPerson,
                phone,
                email,
                address,
                status,
            },
        });
        res.json(partner);
    }
    catch (error) {
        console.error('Error updating business partner:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Business partner not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to update business partner' });
    }
};
exports.updateBusinessPartner = updateBusinessPartner;
// Delete business partner
const deleteBusinessPartner = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        // Check if any employees are linked
        const linkedEmployees = await prisma_1.default.employee.count({
            where: { businessPartnerId: id },
        });
        if (linkedEmployees > 0) {
            res.status(400).json({
                error: `Cannot delete: ${linkedEmployees} employee(s) are currently assigned to this Business Partner.`,
            });
            return;
        }
        await prisma_1.default.businessPartner.delete({
            where: { id },
        });
        res.json({ message: 'Business partner deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting business partner:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Business partner not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to delete business partner' });
    }
};
exports.deleteBusinessPartner = deleteBusinessPartner;
// Toggle business partner status (active <-> inactive)
const toggleBusinessPartnerStatus = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { status } = req.body;
        if (!status || !['active', 'inactive'].includes(status)) {
            res.status(400).json({ error: 'Valid status ("active" | "inactive") is required' });
            return;
        }
        const partner = await prisma_1.default.businessPartner.update({
            where: { id },
            data: { status },
        });
        res.json(partner);
    }
    catch (error) {
        console.error('Error toggling business partner status:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ error: 'Business partner not found' });
            return;
        }
        res.status(500).json({ error: 'Failed to update status' });
    }
};
exports.toggleBusinessPartnerStatus = toggleBusinessPartnerStatus;
