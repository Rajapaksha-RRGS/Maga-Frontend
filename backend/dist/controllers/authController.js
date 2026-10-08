"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.login = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../config/prisma"));
const SECRET_KEY = process.env.JWT_SECRET || 'supersecret';
const login = async (req, res) => {
    try {
        const { tenantId, username, password } = req.body || {};
        // Validation
        if (!tenantId || !username || !password) {
            res.status(400).json({ error: 'Please provide tenant, username and password' });
            return;
        }
        const cleanTenant = String(tenantId).trim();
        const cleanUsername = String(username).trim().toLowerCase();
        // Support SuperAdmin global login
        if (cleanTenant.toLowerCase() === 'superadmin' || cleanTenant.toLowerCase() === 'system') {
            const superAdmin = await prisma_1.default.mF_G_SuperAdmin.findFirst({
                where: {
                    OR: [
                        { username: { equals: cleanUsername, mode: 'insensitive' } },
                        { email: { equals: cleanUsername, mode: 'insensitive' } },
                    ],
                },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    passwordHash: true,
                    status: true,
                },
            });
            if (superAdmin && superAdmin.status === 'active') {
                const isMatch = await bcrypt_1.default.compare(password, superAdmin.passwordHash);
                if (isMatch) {
                    const token = jsonwebtoken_1.default.sign({
                        userId: superAdmin.id,
                        tenantId: 'GLOBAL',
                        projectId: 'GLOBAL',
                        role: 'super_admin',
                        fullName: superAdmin.fullName,
                        companyName: 'Head Office',
                    }, SECRET_KEY, { expiresIn: '8h' });
                    res.json({
                        success: true,
                        message: 'SuperAdmin Login Successful',
                        token,
                        user: {
                            id: superAdmin.id,
                            username: superAdmin.username,
                            fullName: superAdmin.fullName,
                            role: 'super_admin',
                            tenantId: 'GLOBAL',
                            projectId: 'GLOBAL',
                            companyName: 'Head Office',
                        },
                    });
                    return;
                }
            }
        }
        // 1. Optimized Project/Tenant lookup with selective projection
        const project = await prisma_1.default.mF_P_Project.findFirst({
            where: {
                OR: [
                    { id: cleanTenant },
                    { projectCode: { equals: cleanTenant, mode: 'insensitive' } },
                    { subdomain: { equals: cleanTenant, mode: 'insensitive' } },
                    { subdomain: { equals: `${cleanTenant}M`, mode: 'insensitive' } },
                    { subdomain: { equals: cleanTenant.replace(/M$/i, ''), mode: 'insensitive' } },
                    { projectName: { contains: cleanTenant, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                projectCode: true,
                projectName: true,
                subdomain: true,
                status: true,
            },
        });
        if (!project || project.status !== 'active') {
            res.status(400).json({ error: 'Invalid or inactive project/tenant' });
            return;
        }
        // 2. Optimized User lookup: leverages @@unique([projectId, username])
        const user = await prisma_1.default.mF_P_User.findFirst({
            where: {
                projectId: project.id,
                username: { equals: cleanUsername, mode: 'insensitive' },
            },
            select: {
                id: true,
                projectId: true,
                username: true,
                fullName: true,
                role: true,
                status: true,
                passwordHash: true,
                mustChangePassword: true,
                employeeId: true,
                phone: true,
            },
        });
        if (!user || user.status !== 'active') {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // 3. Password comparison
        const isMatch = await bcrypt_1.default.compare(password, user.passwordHash);
        if (!isMatch) {
            res.status(401).json({ error: 'Invalid credentials' });
            return;
        }
        // 4. JWT generation
        const token = jsonwebtoken_1.default.sign({
            userId: user.id,
            tenantId: project.id,
            projectId: project.id,
            role: user.role,
            fullName: user.fullName,
            companyName: project.projectName,
        }, SECRET_KEY, { expiresIn: '8h' });
        const { passwordHash: _hash, ...safeUser } = user;
        res.json({
            success: true,
            message: 'Login Successful',
            token,
            user: {
                ...safeUser,
                tenantId: project.id,
                projectId: project.id,
                companyName: project.projectName,
                projectName: project.projectName,
            },
        });
    }
    catch (error) {
        console.error('Login failed:', error);
        res.status(500).json({ error: 'Internal server error during login' });
    }
};
exports.login = login;
