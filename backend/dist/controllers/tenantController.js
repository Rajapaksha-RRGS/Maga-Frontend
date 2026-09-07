"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantBySubdomain = exports.getTenantById = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
function formatTenant(t) {
    return {
        id: t.id,
        company_name: t.companyName,
        subdomain: t.subdomain,
        address_line1: t.addressLine1 || '',
        address_line2: t.addressLine2 || '',
        phone: t.phone || '',
        fax: t.fax || '',
        email: t.email || '',
        status: t.status || 'active',
    };
}
// 1. GET /api/tenants/:id
const getTenantById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const tenant = await prisma_1.default.tenant.findUnique({
            where: { id },
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
// 2. GET /api/tenants/by-subdomain/:subdomain
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
