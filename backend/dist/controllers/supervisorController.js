"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupervisor = exports.updateSupervisorStatus = exports.resetSupervisorPassword = exports.createSupervisor = exports.getAllSupervisors = exports.getSupervisorActiveSite = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../config/prisma"));
require("../middleware/tenantMiddleware");
const tenantHelper_1 = require("../utils/tenantHelper");
function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 8; i++) {
        pw += chars[Math.floor(Math.random() * chars.length)];
    }
    return pw;
}
// 1. GET /api/supervisors/active-site — Fetch supervisor active site project details
const getSupervisorActiveSite = async (req, res) => {
    try {
        const supervisorId = req.query.supervisorId || req.query.userId;
        let tenantId = req.query.tenantId;
        if (!tenantId && supervisorId) {
            const user = await prisma_1.default.mF_P_User.findUnique({
                where: { id: supervisorId },
                select: { projectId: true },
            });
            if (user) {
                tenantId = user.projectId;
            }
        }
        if (!tenantId) {
            tenantId = req.resolvedTenantId || (await (0, tenantHelper_1.getDefaultTenantId)());
        }
        // Direct indexed Project lookup — no secondary corporate catalog scans needed
        const project = await prisma_1.default.mF_P_Project.findUnique({
            where: { id: tenantId },
            select: {
                id: true,
                projectName: true,
                projectCode: true,
                subdomain: true,
                projectManager: true,
                addressCode: true,
                addressLine1: true,
                addressLine2: true,
            },
        });
        if (!project) {
            res.status(404).json({ error: 'Tenant/Site not found' });
            return;
        }
        const activeSite = {
            id: project.id,
            name: project.projectName,
            code: project.projectCode || project.subdomain,
            location: project.addressCode || project.addressLine1 || project.addressLine2 || 'Site Base Office',
            projectManager: project.projectManager ? `Eng. ${project.projectManager}` : 'Eng. Project Lead',
        };
        res.json({
            activeSite,
            availableSites: [activeSite],
        });
    }
    catch (error) {
        console.error('Error fetching supervisor active site:', error);
        res.status(500).json({ error: 'Failed to fetch supervisor active site' });
    }
};
exports.getSupervisorActiveSite = getSupervisorActiveSite;
// 2. GET /api/supervisors — List all supervisors for the project
const getAllSupervisors = async (req, res) => {
    try {
        const tenantId = req.resolvedTenantId || req.query.tenantId || (await (0, tenantHelper_1.getDefaultTenantId)());
        if (!tenantId) {
            res.status(401).json({ message: 'Unauthorized: No tenantId found' });
            return;
        }
        const supervisors = await prisma_1.default.mF_P_User.findMany({
            where: {
                projectId: tenantId,
                role: 'supervisor',
            },
            select: {
                id: true,
                fullName: true,
                username: true,
                status: true,
                employeeId: true,
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });
        // Populate linked employee names if any
        const employeeIds = supervisors
            .map((s) => s.employeeId)
            .filter(Boolean);
        const empMap = new Map();
        if (employeeIds.length > 0) {
            const employees = await prisma_1.default.mF_P_Employee.findMany({
                where: { id: { in: employeeIds } },
                select: {
                    id: true,
                    callingName: true,
                    corporateEmployee: {
                        select: { fullName: true },
                    },
                },
            });
            employees.forEach((e) => {
                empMap.set(e.id, e.callingName || e.corporateEmployee?.fullName || '');
            });
        }
        const formatted = supervisors.map((s) => ({
            id: s.id,
            fullName: s.fullName,
            username: s.username,
            status: s.status,
            linkedEmployeeId: s.employeeId || null,
            linkedEmployeeName: s.employeeId ? empMap.get(s.employeeId) || null : null,
            createdAt: s.createdAt,
        }));
        res.json(formatted);
    }
    catch (error) {
        console.error('Error fetching supervisors:', error);
        res.status(500).json({ message: 'Error fetching supervisors' });
    }
};
exports.getAllSupervisors = getAllSupervisors;
// 3. POST /api/supervisors — Create supervisor
const createSupervisor = async (req, res) => {
    try {
        const { fullName, username, linkedEmployeeId, employeeId } = req.body || {};
        if (!fullName || !username) {
            res.status(400).json({ message: 'All fields are required' });
            return;
        }
        const tenantId = req.resolvedTenantId || req.body.tenantId || (await (0, tenantHelper_1.getDefaultTenantId)());
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt_1.default.hash(tempPassword, 10);
        const resolvedEmployeeId = linkedEmployeeId || employeeId || null;
        const newSupervisor = await prisma_1.default.mF_P_User.create({
            data: {
                projectId: tenantId,
                fullName: fullName.trim(),
                username: username.trim().toLowerCase(),
                role: 'supervisor',
                passwordHash: hashedPassword,
                employeeId: resolvedEmployeeId,
                status: 'active',
                mustChangePassword: true,
            },
        });
        let linkedEmployeeName = null;
        if (resolvedEmployeeId) {
            const emp = await prisma_1.default.mF_P_Employee.findUnique({
                where: { id: resolvedEmployeeId },
                select: {
                    callingName: true,
                    corporateEmployee: {
                        select: { fullName: true },
                    },
                },
            });
            if (emp) {
                linkedEmployeeName = emp.callingName || emp.corporateEmployee?.fullName || null;
            }
        }
        res.status(201).json({
            supervisor: {
                id: newSupervisor.id,
                fullName: newSupervisor.fullName,
                username: newSupervisor.username,
                status: newSupervisor.status,
                linkedEmployeeId: newSupervisor.employeeId,
                linkedEmployeeName,
            },
            tempPassword,
            message: 'Supervisor created successfully',
        });
    }
    catch (error) {
        console.error('Error creating supervisor:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ message: 'Supervisor with this username already exists in this project' });
            return;
        }
        res.status(500).json({ message: 'Failed to create supervisor' });
    }
};
exports.createSupervisor = createSupervisor;
// 4. POST /api/supervisors/:id/reset-password — Reset password
const resetSupervisorPassword = async (req, res) => {
    try {
        const id = req.params.id || '';
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt_1.default.hash(tempPassword, 10);
        const update = await prisma_1.default.mF_P_User.update({
            where: { id },
            data: {
                passwordHash: hashedPassword,
                mustChangePassword: true,
            },
        });
        res.json({
            message: 'Password reset successfully',
            tempPassword,
            name: update.fullName,
        });
    }
    catch (error) {
        console.error('Error resetting supervisor password:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ message: 'Supervisor not found' });
            return;
        }
        res.status(500).json({ message: 'Error resetting supervisor password' });
    }
};
exports.resetSupervisorPassword = resetSupervisorPassword;
// 5. PATCH /api/supervisors/:id/status — Toggle status
const updateSupervisorStatus = async (req, res) => {
    try {
        const id = req.params.id || '';
        const { status } = req.body || {};
        const update = await prisma_1.default.mF_P_User.update({
            where: { id },
            data: { status: status || 'inactive' },
        });
        res.json(update);
    }
    catch (error) {
        console.error('Error updating supervisor status:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ message: 'Supervisor not found' });
            return;
        }
        res.status(500).json({ message: 'Error updating supervisor status' });
    }
};
exports.updateSupervisorStatus = updateSupervisorStatus;
// 6. DELETE /api/supervisors/:id — Delete or deactivate supervisor
const deleteSupervisor = async (req, res) => {
    try {
        const id = req.params.id || '';
        const supervisor = await prisma_1.default.mF_P_User.findUnique({
            where: { id },
        });
        if (!supervisor) {
            res.status(404).json({ message: 'Supervisor not found' });
            return;
        }
        // Check if supervisor has operational records (daily sheets or recorded time entries)
        const sheetsCount = await prisma_1.default.mF_OP_DailySheet.count({ where: { supervisorId: id } });
        const entriesCount = await prisma_1.default.mF_OP_TimeEntry.count({ where: { recordedById: id } });
        if (sheetsCount > 0 || entriesCount > 0) {
            // Soft-delete / deactivate to preserve audit trail and foreign key integrity
            await prisma_1.default.mF_P_User.update({
                where: { id },
                data: { status: 'inactive' },
            });
            res.json({ message: 'Supervisor deactivated successfully (retained due to existing daily sheet records)' });
            return;
        }
        await prisma_1.default.mF_P_User.delete({
            where: { id },
        });
        res.json({ message: 'Supervisor deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting supervisor:', error);
        if (error.code === 'P2025') {
            res.status(404).json({ message: 'Supervisor not found' });
            return;
        }
        res.status(500).json({ message: 'Failed to delete supervisor' });
    }
};
exports.deleteSupervisor = deleteSupervisor;
