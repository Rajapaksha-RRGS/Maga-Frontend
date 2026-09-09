"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetTenantAdminPassword = exports.updateTenantStatus = exports.updateTenant = exports.registerTenant = exports.getTenantBySubdomain = exports.getTenantById = exports.getAllTenants = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../config/prisma"));
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let pw = '';
    for (let i = 0; i < 10; i++)
        pw += chars[Math.floor(Math.random() * chars.length)];
    return pw;
}
function formatTenant(t) {
    return {
        id: t.id,
        company_name: t.companyName,
        companyName: t.companyName,
        subdomain: t.subdomain,
        address_line1: t.addressLine1 || '',
        addressLine1: t.addressLine1 || '',
        address_line2: t.addressLine2 || '',
        addressLine2: t.addressLine2 || '',
        phone: t.phone || '',
        fax: t.fax || '',
        email: t.email || '',
        status: t.status || 'active',
        createdAt: t.createdAt,
    };
}
// 1. GET /api/tenants — List all tenants with admin details
const getAllTenants = async (_req, res) => {
    try {
        const tenants = await prisma_1.default.tenant.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        role: true,
                        status: true,
                        createdAt: true,
                    },
                },
                _count: {
                    select: {
                        users: true,
                        employees: true,
                        assignments: true,
                    },
                },
            },
        });
        const formatted = tenants.map((t) => {
            const adminUsers = t.users.filter((u) => u.role === 'admin');
            const primaryAdmin = adminUsers[0] || null;
            return {
                id: t.id,
                companyName: t.companyName,
                company_name: t.companyName,
                subdomain: t.subdomain,
                addressLine1: t.addressLine1 || '',
                address_line1: t.addressLine1 || '',
                addressLine2: t.addressLine2 || '',
                address_line2: t.addressLine2 || '',
                phone: t.phone || '',
                fax: t.fax || '',
                email: t.email || '',
                status: t.status || 'active',
                createdAt: t.createdAt,
                userCount: t._count.users,
                employeeCount: t._count.employees,
                primaryAdmin: primaryAdmin
                    ? {
                        id: primaryAdmin.id,
                        username: primaryAdmin.username,
                        fullName: primaryAdmin.fullName,
                        status: primaryAdmin.status,
                    }
                    : null,
            };
        });
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching all tenants:', error);
        res.status(500).json({ error: 'Failed to fetch tenants' });
    }
};
exports.getAllTenants = getAllTenants;
// 2. GET /api/tenants/:id
const getTenantById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { id },
            include: {
                users: {
                    select: {
                        id: true,
                        username: true,
                        fullName: true,
                        role: true,
                        status: true,
                    },
                },
            },
        });
        if (!tenant) {
            res.status(404).json({ error: 'Tenant not found' });
            return;
        }
        res.json(formatTenant(tenant));
    }
    catch (error) {
        console.error('Error fetching tenant by ID:', error);
        res.status(500).json({ error: 'Failed to fetch tenant' });
    }
};
exports.getTenantById = getTenantById;
// 3. GET /api/tenants/by-subdomain/:subdomain
const getTenantBySubdomain = async (req, res) => {
    try {
        const subdomain = getParam(req.params.subdomain).toLowerCase().trim();
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { subdomain },
        });
        if (!tenant) {
            res.status(404).json({ error: 'Tenant not found' });
            return;
        }
        res.json(formatTenant(tenant));
    }
    catch (error) {
        console.error('Error fetching tenant by subdomain:', error);
        res.status(500).json({ error: 'Failed to fetch tenant' });
    }
};
exports.getTenantBySubdomain = getTenantBySubdomain;
// 4. POST /api/tenants/register — Register new tenant & initial admin
const registerTenant = async (req, res) => {
    try {
        const { companyName, subdomain, addressLine1, addressLine2, phone, fax, email, adminFullName, adminUsername, adminPassword, } = req.body;
        if (!companyName?.trim() || !subdomain?.trim() || !adminFullName?.trim() || !adminUsername?.trim()) {
            res.status(400).json({
                error: 'Company name, subdomain, admin full name, and admin username are required.',
            });
            return;
        }
        const cleanSubdomain = subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, '');
        if (!cleanSubdomain) {
            res.status(400).json({ error: 'Invalid subdomain format. Use letters, numbers, and hyphens only.' });
            return;
        }
        // Check if subdomain exists
        const existing = await prisma_1.default.tenant.findUnique({
            where: { subdomain: cleanSubdomain },
        });
        if (existing) {
            res.status(409).json({ error: `Subdomain "${cleanSubdomain}" is already in use by another organization.` });
            return;
        }
        // Password to use
        const passwordToUse = adminPassword?.trim() || generateTempPassword();
        const passwordHash = await bcrypt_1.default.hash(passwordToUse, 10);
        const result = await prisma_1.default.$transaction(async (tx) => {
            const tenant = await tx.tenant.create({
                data: {
                    companyName: companyName.trim(),
                    subdomain: cleanSubdomain,
                    addressLine1: addressLine1?.trim() || null,
                    addressLine2: addressLine2?.trim() || null,
                    phone: phone?.trim() || null,
                    fax: fax?.trim() || null,
                    email: email?.trim() || null,
                    status: 'active',
                },
            });
            const adminUser = await tx.user.create({
                data: {
                    tenantId: tenant.id,
                    username: adminUsername.trim().toLowerCase(),
                    fullName: adminFullName.trim(),
                    passwordHash,
                    role: 'admin',
                    status: 'active',
                    mustChangePassword: true,
                },
            });
            return { tenant, adminUser };
        });
        res.status(201).json({
            message: 'Tenant and Admin created successfully',
            tenant: {
                id: result.tenant.id,
                companyName: result.tenant.companyName,
                company_name: result.tenant.companyName,
                subdomain: result.tenant.subdomain,
                addressLine1: result.tenant.addressLine1 || '',
                address_line1: result.tenant.addressLine1 || '',
                addressLine2: result.tenant.addressLine2 || '',
                address_line2: result.tenant.addressLine2 || '',
                phone: result.tenant.phone || '',
                fax: result.tenant.fax || '',
                email: result.tenant.email || '',
                status: result.tenant.status,
                createdAt: result.tenant.createdAt,
                userCount: 1,
                employeeCount: 0,
                primaryAdmin: {
                    id: result.adminUser.id,
                    username: result.adminUser.username,
                    fullName: result.adminUser.fullName,
                    status: result.adminUser.status,
                },
            },
            tempPassword: passwordToUse,
        });
    }
    catch (error) {
        console.error('Error registering tenant:', error);
        res.status(500).json({ error: error.message || 'Failed to register tenant and admin' });
    }
};
exports.registerTenant = registerTenant;
// 5. PUT /api/tenants/:id — Update tenant details
const updateTenant = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { companyName, addressLine1, addressLine2, phone, fax, email } = req.body;
        if (!companyName?.trim()) {
            res.status(400).json({ error: 'Company name is required.' });
            return;
        }
        const updated = await prisma_1.default.tenant.update({
            where: { id },
            data: {
                companyName: companyName.trim(),
                addressLine1: addressLine1?.trim() || null,
                addressLine2: addressLine2?.trim() || null,
                phone: phone?.trim() || null,
                fax: fax?.trim() || null,
                email: email?.trim() || null,
            },
        });
        res.json(formatTenant(updated));
    }
    catch (error) {
        console.error('Error updating tenant:', error);
        res.status(500).json({ error: 'Failed to update tenant' });
    }
};
exports.updateTenant = updateTenant;
// 6. PATCH /api/tenants/:id/status — Toggle active / suspended status
const updateTenantStatus = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { status } = req.body;
        if (!status || !['active', 'suspended'].includes(status)) {
            res.status(400).json({ error: 'Status must be either "active" or "suspended".' });
            return;
        }
        const updated = await prisma_1.default.tenant.update({
            where: { id },
            data: { status },
        });
        res.json(formatTenant(updated));
    }
    catch (error) {
        console.error('Error updating tenant status:', error);
        res.status(500).json({ error: 'Failed to update tenant status' });
    }
};
exports.updateTenantStatus = updateTenantStatus;
// 7. POST /api/tenants/:id/reset-admin-password — Reset admin password for a tenant
const resetTenantAdminPassword = async (req, res) => {
    try {
        const tenantId = getParam(req.params.id);
        const adminUser = await prisma_1.default.user.findFirst({
            where: { tenantId, role: 'admin' },
        });
        if (!adminUser) {
            res.status(404).json({ error: 'Admin user not found for this tenant.' });
            return;
        }
        const newTempPassword = generateTempPassword();
        const passwordHash = await bcrypt_1.default.hash(newTempPassword, 10);
        await prisma_1.default.user.update({
            where: { id: adminUser.id },
            data: {
                passwordHash,
                mustChangePassword: true,
            },
        });
        res.json({
            message: 'Admin password reset successfully',
            adminName: adminUser.fullName,
            username: adminUser.username,
            tempPassword: newTempPassword,
        });
    }
    catch (error) {
        console.error('Error resetting tenant admin password:', error);
        res.status(500).json({ error: 'Failed to reset admin password' });
    }
};
exports.resetTenantAdminPassword = resetTenantAdminPassword;
