"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultProjectId = exports.getDefaultTenantId = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
/**
 * Returns a fallback active project/tenant ID when none is provided in headers/params.
 * Resolves to the first active Project, or auto-creates a default one if none exist.
 */
const getDefaultTenantId = async () => {
    const project = await prisma_1.default.mF_P_Project.findFirst({
        where: { status: 'active' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
    });
    if (project)
        return project.id;
    const created = await prisma_1.default.mF_P_Project.create({
        data: {
            projectCode: 'PRJ001',
            projectName: 'Mäga Engineering (Head Office)',
            subdomain: 'maga',
            addressLine1: '200, Nawala Road',
            addressLine2: 'Narahenpita, Colombo 05',
            phone: '+94 11 2808835',
            email: 'info@maga.lk',
            status: 'active',
        },
        select: { id: true },
    });
    return created.id;
};
exports.getDefaultTenantId = getDefaultTenantId;
exports.getDefaultProjectId = exports.getDefaultTenantId;
