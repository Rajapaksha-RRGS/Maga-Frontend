"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTenantMiddleware = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
const resolveTenantMiddleware = async (req, res, next) => {
    if (req.path.includes('/auth/')) {
        return next();
    }
    try {
        const rawId = req.headers['x-tenant-id'] ||
            req.headers['x-project-id'] ||
            req.query.projectId ||
            req.query.tenantId ||
            (req.body && req.body.tenantId) ||
            (req.body && req.body.projectId);
        if (rawId && typeof rawId === 'string' && rawId.trim()) {
            const clean = rawId.trim();
            // Check if it matches a Tenant UUID directly 
            const project = await prisma_1.default.mF_P_Project.findFirst({
                where: {
                    OR: [
                        { id: clean },
                        { projectCode: { equals: clean, mode: 'insensitive' } },
                        { subdomain: { equals: clean, mode: 'insensitive' } },
                    ],
                },
                select: { id: true },
            });
            if (project) {
                req.resolvedTenantId = project.id;
                req.resolvedProjectId = project.id;
                if (req.query)
                    req.query.tenantId = project.id;
                if (req.body && typeof req.body === 'object')
                    req.body.tenantId = project.id;
            }
        }
        next();
    }
    catch (error) {
        console.error('Error in resolveTenantMiddleware:', error);
        next();
    }
};
exports.resolveTenantMiddleware = resolveTenantMiddleware;
