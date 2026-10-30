"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectBusinessPartner = exports.approveBusinessPartner = exports.getPendingBusinessPartners = exports.getCorporateBusinessPartnersCatalog = exports.toggleBusinessPartnerStatus = exports.deleteBusinessPartner = exports.updateBusinessPartner = exports.createBusinessPartner = exports.getNextBusinessPartnerCode = exports.getBusinessPartnerById = exports.getAllBusinessPartners = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
// Helper to extract string param safely
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
const partnerSelectOptimized = {
    id: true,
    code: true,
    name: true,
    type: true,
    contactPerson: true,
    phone: true,
    email: true,
    rating: true,
    nicNo: true,
    brNumber: true,
    documentUrl: true,
    address: true,
    city: true,
    country: true,
    status: true,
    createdAt: true,
    _count: {
        select: {
            employees: true,
            equipment: true,
        },
    },
};
// 1. GET /api/business-partners — List all business partners
const getAllBusinessPartners = async (req, res) => {
    try {
        const { status, search } = req.query;
        const where = {};
        if (status && typeof status === 'string' && status !== 'all') {
            where.status = status;
        }
        if (search && typeof search === 'string' && search.trim()) {
            const q = search.trim();
            where.OR = [
                { name: { contains: q, mode: 'insensitive' } },
                { code: { contains: q, mode: 'insensitive' } },
                { contactPerson: { contains: q, mode: 'insensitive' } },
            ];
        }
        const currentProjectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            req.headers['x-tenant-id'];
        let siteWorkerCounts = {};
        if (currentProjectId && currentProjectId !== 'superadmin' && currentProjectId !== 'GLOBAL') {
            try {
                const siteCounts = await prisma_1.default.mF_P_Employee.groupBy({
                    by: ['businessPartnerId'],
                    where: {
                        projectId: currentProjectId,
                        status: 'active',
                        businessPartnerId: { not: null },
                    },
                    _count: { id: true },
                });
                siteCounts.forEach((sc) => {
                    if (sc.businessPartnerId) {
                        siteWorkerCounts[sc.businessPartnerId] = sc._count.id;
                    }
                });
            }
            catch (err) {
                console.warn('Could not compute siteWorkerCounts:', err);
            }
        }
        const partners = await prisma_1.default.mF_G_BusinessPartner.findMany({
            where,
            select: partnerSelectOptimized,
            orderBy: { code: 'asc' },
        });
        const formatted = partners.map((p) => ({
            ...p,
            employeeCount: p._count.employees,
            equipmentCount: p._count.equipment,
            siteWorkerCount: siteWorkerCounts[p.id] || 0,
            isActiveOnSite: Boolean(siteWorkerCounts[p.id] && siteWorkerCounts[p.id] > 0),
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching business partners:', error);
        res.status(500).json({ error: 'Failed to fetch business partners' });
    }
};
exports.getAllBusinessPartners = getAllBusinessPartners;
// 2. GET /api/business-partners/:id — Get single business partner by ID
const getBusinessPartnerById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const partner = await prisma_1.default.mF_G_BusinessPartner.findUnique({
            where: { id },
            select: partnerSelectOptimized,
        });
        if (!partner) {
            res.status(404).json({ error: 'Business partner not found' });
            return;
        }
        res.json({
            ...partner,
            employeeCount: partner._count.employees,
            equipmentCount: partner._count.equipment,
        });
    }
    catch (error) {
        console.error('Error fetching business partner:', error);
        res.status(500).json({ error: 'Failed to fetch business partner' });
    }
};
exports.getBusinessPartnerById = getBusinessPartnerById;
// 3. GET /api/business-partners/next-code — Get next available BP code
const getNextBusinessPartnerCode = async (_req, res) => {
    try {
        const regularPartners = await prisma_1.default.mF_G_BusinessPartner.findMany({
            where: { code: { startsWith: 'BP1' } },
            select: { code: true },
        });
        let maxBp = 1001000;
        for (const p of regularPartners) {
            const num = parseInt(p.code.replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num > maxBp)
                maxBp = num;
        }
        const nextCode = `BP${maxBp + 1}`;
        res.json({ nextCode });
    }
    catch (error) {
        console.error('Error getting next code:', error);
        res.status(500).json({ error: 'Failed to generate next code' });
    }
};
exports.getNextBusinessPartnerCode = getNextBusinessPartnerCode;
// 4. POST /api/business-partners — Create business partner
const createBusinessPartner = async (req, res) => {
    try {
        const { code, name, contactPerson, phone, email, status, type, nicNo, businessEntityIdentifier, address, city, country, brNumber, documentUrl, } = req.body || {};
        const cleanName = String(name || '').trim();
        if (!cleanName) {
            res.status(400).json({ error: 'Company or Subcontractor name is required' });
            return;
        }
        const cleanBr = brNumber?.trim();
        // Check if partner with same BR Number already exists to prevent duplicate entries
        if (cleanBr) {
            const existingBr = await prisma_1.default.mF_G_BusinessPartner.findFirst({
                where: { brNumber: { equals: cleanBr, mode: 'insensitive' } },
                select: partnerSelectOptimized,
            });
            if (existingBr) {
                res.status(409).json({
                    error: `A Business Partner with BR Number "${cleanBr}" is already enrolled (${existingBr.name} - ${existingBr.code}).`,
                    existingPartner: {
                        ...existingBr,
                        employeeCount: existingBr._count.employees,
                        equipmentCount: existingBr._count.equipment,
                    },
                });
                return;
            }
        }
        const cleanStatus = status || 'active';
        let cleanCode = code ? String(code).trim().toUpperCase() : '';
        if (!cleanCode) {
            if (cleanStatus === 'pending_approval') {
                const tmpPartners = await prisma_1.default.mF_G_BusinessPartner.findMany({
                    where: { code: { startsWith: 'BP-TMP-' } },
                    select: { code: true },
                });
                let maxTmp = 0;
                for (const p of tmpPartners) {
                    const num = parseInt(p.code.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(num) && num > maxTmp)
                        maxTmp = num;
                }
                let nextTmpNum = maxTmp + 1;
                cleanCode = `BP-TMP-${String(nextTmpNum).padStart(4, '0')}`;
                while (await prisma_1.default.mF_G_BusinessPartner.findUnique({ where: { code: cleanCode } })) {
                    nextTmpNum++;
                    cleanCode = `BP-TMP-${String(nextTmpNum).padStart(4, '0')}`;
                }
            }
            else {
                const regularPartners = await prisma_1.default.mF_G_BusinessPartner.findMany({
                    where: { code: { startsWith: 'BP1' } },
                    select: { code: true },
                });
                let maxBp = 1001000;
                for (const p of regularPartners) {
                    const num = parseInt(p.code.replace(/[^0-9]/g, ''), 10);
                    if (!isNaN(num) && num > maxBp)
                        maxBp = num;
                }
                let nextBpNum = maxBp + 1;
                cleanCode = `BP${nextBpNum}`;
                while (await prisma_1.default.mF_G_BusinessPartner.findUnique({ where: { code: cleanCode } })) {
                    nextBpNum++;
                    cleanCode = `BP${nextBpNum}`;
                }
            }
        }
        const partner = await prisma_1.default.mF_G_BusinessPartner.create({
            data: {
                code: cleanCode,
                name: cleanName,
                type: type ? String(type).trim() : null,
                nicNo: (nicNo || businessEntityIdentifier)?.trim() || null,
                brNumber: brNumber?.trim() || null,
                documentUrl: documentUrl?.trim() || null,
                address: address?.trim() || null,
                city: city?.trim() || null,
                country: country?.trim() || 'Sri Lanka',
                contactPerson: contactPerson?.trim() || null,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
                status: cleanStatus,
            },
            select: partnerSelectOptimized,
        });
        res.status(201).json({
            ...partner,
            employeeCount: 0,
            equipmentCount: 0,
        });
    }
    catch (error) {
        console.error('Error creating business partner:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: `Business Partner with code ${req.body?.code || 'specified'} already exists` });
            return;
        }
        res.status(500).json({ error: 'Failed to create business partner' });
    }
};
exports.createBusinessPartner = createBusinessPartner;
// 5. PUT /api/business-partners/:id — Update business partner
const updateBusinessPartner = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { name, contactPerson, phone, email, status, type, nicNo, businessEntityIdentifier, address, city, country, brNumber, documentUrl, } = req.body || {};
        const partner = await prisma_1.default.mF_G_BusinessPartner.update({
            where: { id },
            data: {
                name: name?.trim(),
                type: type !== undefined ? (type ? String(type).trim() : null) : undefined,
                nicNo: (nicNo !== undefined || businessEntityIdentifier !== undefined) ? ((nicNo || businessEntityIdentifier)?.trim() || null) : undefined,
                brNumber: brNumber !== undefined ? (brNumber?.trim() || null) : undefined,
                documentUrl: documentUrl !== undefined ? (documentUrl?.trim() || null) : undefined,
                address: address !== undefined ? (address?.trim() || null) : undefined,
                city: city !== undefined ? (city?.trim() || null) : undefined,
                country: country !== undefined ? (country?.trim() || 'Sri Lanka') : undefined,
                contactPerson: contactPerson?.trim() || null,
                phone: phone?.trim() || null,
                email: email?.trim() || null,
                status: status || undefined,
            },
            select: partnerSelectOptimized,
        });
        res.json({
            ...partner,
            employeeCount: partner._count.employees,
            equipmentCount: partner._count.equipment,
        });
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
// 6. DELETE /api/business-partners/:id — Delete business partner
const deleteBusinessPartner = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        // Check if any employees or equipment are linked
        const linkedEmployees = await prisma_1.default.mF_P_Employee.count({
            where: { businessPartnerId: id },
        });
        const linkedCorpEmployees = await prisma_1.default.mF_G_Employee.count({
            where: { corporateBusinessPartnerId: id },
        });
        const linkedEquipment = await prisma_1.default.mF_P_Equipment.count({
            where: { ownerPartnerId: id },
        });
        const linkedCorpEquipment = await prisma_1.default.mF_G_Equipment.count({
            where: { businessPartnerId: id },
        });
        const totalEq = linkedEquipment + linkedCorpEquipment;
        if (linkedEmployees > 0 || linkedCorpEmployees > 0 || totalEq > 0) {
            res.status(400).json({
                error: `Cannot delete: ${linkedEmployees + linkedCorpEmployees} employee(s) and ${totalEq} equipment unit(s) are assigned to this Business Partner.`,
            });
            return;
        }
        await prisma_1.default.mF_G_BusinessPartner.delete({
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
// 7. PATCH /api/business-partners/:id/status — Toggle status
const toggleBusinessPartnerStatus = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { status } = req.body || {};
        if (!status || !['active', 'inactive'].includes(status)) {
            res.status(400).json({ error: 'Valid status ("active" | "inactive") is required' });
            return;
        }
        const partner = await prisma_1.default.mF_G_BusinessPartner.update({
            where: { id },
            data: { status },
            select: partnerSelectOptimized,
        });
        res.json({
            ...partner,
            employeeCount: partner._count.employees,
            equipmentCount: partner._count.equipment,
        });
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
// 8. GET /api/business-partners/catalog — Catalog for dropdowns/pickers
const getCorporateBusinessPartnersCatalog = async (_req, res) => {
    try {
        const list = await prisma_1.default.mF_G_BusinessPartner.findMany({
            where: { status: 'active' },
            select: {
                id: true,
                code: true,
                name: true,
                type: true,
                contactPerson: true,
                phone: true,
                rating: true,
                status: true,
            },
            orderBy: { code: 'asc' },
        });
        res.json(list);
    }
    catch (error) {
        console.error('Error fetching corporate business partners catalog:', error);
        res.status(500).json({ error: 'Failed to fetch corporate business partners catalog' });
    }
};
exports.getCorporateBusinessPartnersCatalog = getCorporateBusinessPartnersCatalog;
// 9. GET /api/business-partners/pending — List partners pending Super Admin approval
const getPendingBusinessPartners = async (_req, res) => {
    try {
        const list = await prisma_1.default.mF_G_BusinessPartner.findMany({
            where: { status: 'pending_approval' },
            select: partnerSelectOptimized,
            orderBy: { createdAt: 'desc' },
        });
        res.json({
            items: list.map((p) => ({
                ...p,
                employeeCount: p._count.employees,
                equipmentCount: p._count.equipment,
            })),
            total: list.length,
        });
    }
    catch (error) {
        console.error('Error fetching pending business partners:', error);
        res.status(500).json({ error: 'Failed to fetch pending business partners' });
    }
};
exports.getPendingBusinessPartners = getPendingBusinessPartners;
// 10. POST /api/business-partners/:id/approve — Super Admin approve partner & assign official code
const approveBusinessPartner = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { officialCode } = req.body || {};
        const existing = await prisma_1.default.mF_G_BusinessPartner.findUnique({
            where: { id },
        });
        if (!existing) {
            res.status(404).json({ error: 'Business partner not found' });
            return;
        }
        let finalCode = officialCode ? String(officialCode).trim().toUpperCase() : '';
        if (!finalCode || finalCode.startsWith('BP-TMP')) {
            const latest = await prisma_1.default.mF_G_BusinessPartner.findFirst({
                where: { code: { startsWith: 'BP1' } },
                select: { code: true },
                orderBy: { code: 'desc' },
            });
            const currentNum = latest ? parseInt(latest.code.replace(/[^0-9]/g, ''), 10) : 1001000;
            finalCode = `BP${(isNaN(currentNum) ? 1001000 : currentNum) + 1}`;
        }
        const updated = await prisma_1.default.mF_G_BusinessPartner.update({
            where: { id },
            data: {
                code: finalCode,
                status: 'active',
            },
            select: partnerSelectOptimized,
        });
        res.json({
            success: true,
            message: `Business Partner approved successfully. Official Code: ${finalCode}`,
            businessPartner: {
                ...updated,
                employeeCount: updated._count.employees,
                equipmentCount: updated._count.equipment,
            },
        });
    }
    catch (error) {
        console.error('Error approving business partner:', error);
        res.status(500).json({ error: error.message || 'Failed to approve business partner' });
    }
};
exports.approveBusinessPartner = approveBusinessPartner;
// 11. POST /api/business-partners/:id/reject — Super Admin reject business partner
const rejectBusinessPartner = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { reason } = req.body || {};
        const existing = await prisma_1.default.mF_G_BusinessPartner.findUnique({
            where: { id },
        });
        if (!existing) {
            res.status(404).json({ error: 'Business partner not found' });
            return;
        }
        const updated = await prisma_1.default.mF_G_BusinessPartner.update({
            where: { id },
            data: {
                status: 'rejected',
            },
            select: partnerSelectOptimized,
        });
        res.json({
            success: true,
            message: 'Business partner registration rejected',
            reason: reason || null,
            businessPartner: updated,
        });
    }
    catch (error) {
        console.error('Error rejecting business partner:', error);
        res.status(500).json({ error: error.message || 'Failed to reject business partner' });
    }
};
exports.rejectBusinessPartner = rejectBusinessPartner;
