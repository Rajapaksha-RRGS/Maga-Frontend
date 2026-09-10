"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteSupervisor = exports.updateSupervisorStatus = exports.resetSupervisorPassword = exports.createSupervisor = exports.getAllSupervisors = void 0;
const bcrypt_1 = __importDefault(require("bcrypt"));
const prisma_1 = __importDefault(require("../config/prisma"));
const employeeController_1 = require("./employeeController");
function generateTempPassword() {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let pw = '';
    for (let i = 0; i < 8; i++) {
        pw += chars[Math.floor(Math.random() * chars.length)];
    }
    return pw;
}
const getAllSupervisors = async (req, res) => {
    try {
        const tenantId = req.query.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        if (!tenantId) {
            res.status(401).json({ message: "Unauthorized: No tenantId found" });
            return;
        }
        const supervisors = await prisma_1.default.user.findMany({
            where: {
                tenantId,
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
        let empMap = new Map();
        if (employeeIds.length > 0) {
            const employees = await prisma_1.default.employee.findMany({
                where: { id: { in: employeeIds } },
                select: { id: true, callingName: true, fullName: true },
            });
            employees.forEach((e) => {
                empMap.set(e.id, e.callingName || e.fullName || '');
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
        console.error("Error fetching supervisors:", error);
        res.status(500).json({ message: "Error fetching supervisors" });
    }
};
exports.getAllSupervisors = getAllSupervisors;
const createSupervisor = async (req, res) => {
    try {
        const { fullName, username, linkedEmployeeId, employeeId } = req.body;
        if (!fullName || !username) {
            res.status(400).json({ message: "All fields are required" });
            return;
        }
        const tenantId = req.body.tenantId || (await (0, employeeController_1.getDefaultTenantId)());
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt_1.default.hash(tempPassword, 10);
        const resolvedEmployeeId = linkedEmployeeId || employeeId || null;
        const newSupervisor = await prisma_1.default.user.create({
            data: {
                tenantId,
                fullName: fullName.trim(),
                username: username.trim().toLowerCase(),
                role: "supervisor",
                passwordHash: hashedPassword,
                employeeId: resolvedEmployeeId,
                status: "active",
                mustChangePassword: true,
            },
        });
        let linkedEmployeeName = null;
        if (resolvedEmployeeId) {
            const emp = await prisma_1.default.employee.findUnique({
                where: { id: resolvedEmployeeId },
                select: { callingName: true, fullName: true },
            });
            if (emp) {
                linkedEmployeeName = emp.callingName || emp.fullName;
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
            message: "Supervisor created successfully",
        });
    }
    catch (error) {
        console.error('Error creating supervisor:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ message: 'Supervisor with this username already exists' });
            return;
        }
        res.status(500).json({ message: 'Failed to create supervisor' });
    }
};
exports.createSupervisor = createSupervisor;
const resetSupervisorPassword = async (req, res) => {
    try {
        const id = req.params.id || '';
        const tempPassword = generateTempPassword();
        const hashedPassword = await bcrypt_1.default.hash(tempPassword, 10);
        const update = await prisma_1.default.user.update({
            where: { id },
            data: {
                passwordHash: hashedPassword,
                mustChangePassword: true,
            },
        });
        res.json({
            message: "Password reset successfully",
            tempPassword,
            name: update.fullName,
        });
    }
    catch (error) {
        console.error("Error resetting supervisor password:", error);
        if (error.code === 'P2025') {
            res.status(404).json({ message: "Supervisor not found" });
            return;
        }
        res.status(500).json({ message: "Error resetting supervisor password" });
    }
};
exports.resetSupervisorPassword = resetSupervisorPassword;
const updateSupervisorStatus = async (req, res) => {
    try {
        const id = req.params.id || '';
        const { status } = req.body;
        const update = await prisma_1.default.user.update({
            where: { id },
            data: { status: status || 'inactive' },
        });
        res.json(update);
    }
    catch (error) {
        console.error("Error updating supervisor status:", error);
        if (error.code === 'P2025') {
            res.status(404).json({ message: "Supervisor not found" });
            return;
        }
        res.status(500).json({ message: "Error updating supervisor status" });
    }
};
exports.updateSupervisorStatus = updateSupervisorStatus;
const deleteSupervisor = async (req, res) => {
    try {
        const id = req.params.id || '';
        const supervisor = await prisma_1.default.user.findUnique({
            where: { id },
        });
        if (!supervisor) {
            res.status(404).json({ message: "Supervisor not found" });
            return;
        }
        // Clean up any assigned tasks or time entries if linked
        await prisma_1.default.dailyAssignment.deleteMany({ where: { supervisorId: id } });
        await prisma_1.default.timeEntry.deleteMany({ where: { supervisorId: id } });
        await prisma_1.default.user.delete({
            where: { id },
        });
        res.json({ message: "Supervisor deleted successfully" });
    }
    catch (error) {
        console.error("Error deleting supervisor:", error);
        if (error.code === 'P2025') {
            res.status(404).json({ message: "Supervisor not found" });
            return;
        }
        res.status(500).json({ message: "Failed to delete supervisor" });
    }
};
exports.deleteSupervisor = deleteSupervisor;
