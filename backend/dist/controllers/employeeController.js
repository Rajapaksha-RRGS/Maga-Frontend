"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCorporateEmployeesCatalog = exports.transferEmployee = exports.getCrossTenantEmployeeStatus = exports.deleteEmployee = exports.updateEmployeeStatus = exports.updateEmployee = exports.createEmployee = exports.resolveOrCreateBusinessPartner = exports.getEmployeeById = exports.getAllEmployees = exports.getDefaultTenantId = void 0;
const prisma_1 = __importDefault(require("../config/prisma"));
require("../middleware/tenantMiddleware");
const tenantHelper_1 = require("../utils/tenantHelper");
Object.defineProperty(exports, "getDefaultTenantId", { enumerable: true, get: function () { return tenantHelper_1.getDefaultTenantId; } });
const getParam = (param) => {
    if (Array.isArray(param))
        return param[0] || '';
    return param || '';
};
const employeeSelectOptimized = {
    id: true,
    projectId: true,
    corporateEmployeeId: true,
    callingName: true,
    dailyRate: true,
    isOperator: true,
    status: true,
    createdAt: true,
    corporateEmployee: {
        select: {
            id: true,
            employeeCode: true,
            fullName: true,
            nicNo: true,
            epfNo: true,
            dailyRate: true,
            isOperator: true,
            status: true,
        },
    },
    tradeGroup: {
        select: {
            id: true,
            code: true,
            name: true,
            standardDailyRate: true,
        },
    },
    businessPartner: {
        select: {
            id: true,
            code: true,
            name: true,
            type: true,
        },
    },
};
function formatEmployee(emp) {
    const corp = emp.corporateEmployee || {};
    return {
        id: emp.id,
        projectId: emp.projectId,
        tenantId: emp.projectId, // Frontend compatibility
        corporateEmployeeId: emp.corporateEmployeeId,
        employeeCode: corp.employeeCode || emp.id,
        employee_code: corp.employeeCode || emp.id,
        callingName: emp.callingName || corp.fullName || '',
        calling_name: emp.callingName || corp.fullName || '',
        fullName: corp.fullName || emp.callingName || '',
        full_name: corp.fullName || emp.callingName || '',
        nicNo: corp.nicNo || '',
        nic_no: corp.nicNo || '',
        epfNo: corp.epfNo || '',
        epf_no: corp.epfNo || '',
        dailyRate: Number(emp.dailyRate ?? corp.dailyRate ?? 1400.0),
        isOperator: Boolean(emp.isOperator ?? corp.isOperator ?? false),
        status: emp.status || 'active',
        tradeGroupId: emp.tradeGroup?.id || null,
        tradeGroup: emp.tradeGroup?.name || 'General Labour',
        trade_group: emp.tradeGroup?.name || 'General Labour',
        businessPartnerId: emp.businessPartner?.id || null,
        businessPartner: emp.businessPartner
            ? {
                id: emp.businessPartner.id,
                code: emp.businessPartner.code,
                name: emp.businessPartner.name,
            }
            : null,
        createdAt: emp.createdAt,
    };
}
// 1. GET /api/employees — List all employees scoped to project
const getAllEmployees = async (req, res) => {
    try {
        const { status, tradeGroup, businessPartner } = req.query;
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const where = { projectId };
        if (status && typeof status === 'string' && status !== 'all') {
            where.status = status;
        }
        if (tradeGroup && typeof tradeGroup === 'string') {
            where.tradeGroup = {
                name: { contains: tradeGroup, mode: 'insensitive' },
            };
        }
        if (businessPartner && typeof businessPartner === 'string') {
            where.businessPartner = {
                name: { contains: businessPartner, mode: 'insensitive' },
            };
        }
        const employees = await prisma_1.default.mF_P_Employee.findMany({
            where,
            select: employeeSelectOptimized,
            orderBy: {
                corporateEmployee: {
                    employeeCode: 'asc',
                },
            },
        });
        res.json(employees.map(formatEmployee));
    }
    catch (error) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ error: 'Failed to fetch employees' });
    }
};
exports.getAllEmployees = getAllEmployees;
// 2. GET /api/employees/:id — Fetch single employee by ID
const getEmployeeById = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const employee = await prisma_1.default.mF_P_Employee.findUnique({
            where: { id },
            select: employeeSelectOptimized,
        });
        if (!employee) {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }
        res.json(formatEmployee(employee));
    }
    catch (error) {
        console.error('Error fetching employee:', error);
        res.status(500).json({ error: 'Failed to fetch employee' });
    }
};
exports.getEmployeeById = getEmployeeById;
// Helper: Resolve or create a Corporate Trade Group
async function resolveTradeGroup(tradeGroupName) {
    if (!tradeGroupName || !tradeGroupName.trim())
        return null;
    const cleanName = tradeGroupName.trim();
    const found = await prisma_1.default.mF_G_TradeGroup.findFirst({
        where: {
            OR: [
                { name: { equals: cleanName, mode: 'insensitive' } },
                { code: { equals: cleanName, mode: 'insensitive' } },
            ],
        },
        select: { id: true },
    });
    if (found)
        return found.id;
    const count = await prisma_1.default.mF_G_TradeGroup.count();
    const code = `TG${String(count + 1).padStart(3, '0')}`;
    const created = await prisma_1.default.mF_G_TradeGroup.create({
        data: {
            code,
            name: cleanName,
            standardDailyRate: 1400.0,
            status: 'active',
        },
        select: { id: true },
    });
    return created.id;
}
// Helper: Resolve or create a Corporate Business Partner
const resolveOrCreateBusinessPartner = async (_projectId, input) => {
    if (input?.id && input.id.length > 20) {
        const existing = await prisma_1.default.mF_G_BusinessPartner.findUnique({
            where: { id: input.id },
            select: { id: true },
        });
        if (existing)
            return existing.id;
    }
    const searchCode = input?.code?.trim();
    const searchName = input?.name?.trim();
    if (searchCode || searchName) {
        const existing = await prisma_1.default.mF_G_BusinessPartner.findFirst({
            where: {
                OR: [
                    ...(searchCode ? [{ code: { equals: searchCode, mode: 'insensitive' } }] : []),
                    ...(searchName ? [{ name: { equals: searchName, mode: 'insensitive' } }] : []),
                ],
            },
            select: { id: true },
        });
        if (existing)
            return existing.id;
        const count = await prisma_1.default.mF_G_BusinessPartner.count();
        const bpCode = searchCode || `BP1${String(count + 1).padStart(6, '0')}`;
        const created = await prisma_1.default.mF_G_BusinessPartner.create({
            data: {
                code: bpCode,
                name: searchName || searchCode || 'Mäga Engineering (Pvt) Ltd',
                type: (searchName || '').toLowerCase().includes('maga') ? 'internal' : 'subcontractor',
                status: 'active',
            },
            select: { id: true },
        });
        return created.id;
    }
    // Default partner
    let defaultPartner = await prisma_1.default.mF_G_BusinessPartner.findFirst({
        where: { code: 'BP1002885' },
        select: { id: true },
    });
    if (!defaultPartner) {
        defaultPartner = await prisma_1.default.mF_G_BusinessPartner.findFirst({
            select: { id: true },
        });
    }
    return defaultPartner?.id || null;
};
exports.resolveOrCreateBusinessPartner = resolveOrCreateBusinessPartner;
// 3. POST /api/employees — Create employee
const createEmployee = async (req, res) => {
    try {
        const { employeeCode, callingName, fullName, businessPartnerId, businessPartnerCode, businessPartnerName, businessPartner, tradeGroup, nicNo, dailyRate, epfNo, status, isOperator, } = req.body || {};
        if (!callingName || !nicNo) {
            res.status(400).json({ error: 'Calling name and NIC number are required' });
            return;
        }
        const projectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.projectId ||
            req.body.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const cleanCode = employeeCode?.trim() || `EMP${Date.now().toString().slice(-4)}`;
        const cleanNic = String(nicNo).trim();
        const resolvedBpId = await (0, exports.resolveOrCreateBusinessPartner)(projectId, {
            id: businessPartnerId,
            code: businessPartnerCode || (typeof businessPartner === 'string' && businessPartner.startsWith('BP') ? businessPartner : undefined),
            name: businessPartnerName || (typeof businessPartner === 'string' ? businessPartner : undefined),
        });
        const resolvedTradeGroupId = await resolveTradeGroup(tradeGroup);
        const isOperatorBool = Boolean(isOperator === true ||
            isOperator === 'true' ||
            (tradeGroup && ['operator', 'driver', 'heavy operator'].some((t) => tradeGroup.toLowerCase().includes(t))));
        const result = await prisma_1.default.$transaction(async (tx) => {
            // 1. Ensure Corporate Employee exists
            let corpEmp = await tx.mF_G_Employee.findFirst({
                where: {
                    OR: [{ employeeCode: cleanCode }, { nicNo: cleanNic }],
                },
            });
            if (!corpEmp) {
                corpEmp = await tx.mF_G_Employee.create({
                    data: {
                        employeeCode: cleanCode,
                        fullName: fullName?.trim() || callingName.trim(),
                        nicNo: cleanNic,
                        epfNo: epfNo?.trim() || null,
                        dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : 1400.0,
                        isOperator: isOperatorBool,
                        tradeGroupId: resolvedTradeGroupId,
                        corporateBusinessPartnerId: resolvedBpId,
                        status: 'active',
                    },
                });
            }
            // 2. Create Site Employee enrollment
            const siteEmp = await tx.mF_P_Employee.create({
                data: {
                    projectId,
                    corporateEmployeeId: corpEmp.id,
                    callingName: callingName.trim(),
                    dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : (corpEmp.dailyRate ?? 1400.0),
                    isOperator: isOperatorBool,
                    tradeGroupId: resolvedTradeGroupId,
                    businessPartnerId: resolvedBpId,
                    status: status || 'active',
                },
                select: employeeSelectOptimized,
            });
            return siteEmp;
        });
        res.status(201).json(formatEmployee(result));
    }
    catch (error) {
        console.error('Error creating employee:', error);
        if (error.code === 'P2002') {
            res.status(409).json({ error: 'Employee already exists in this project' });
            return;
        }
        res.status(500).json({ error: 'Failed to create employee' });
    }
};
exports.createEmployee = createEmployee;
// 4. PUT /api/employees/:id — Update employee
const updateEmployee = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { callingName, fullName, dailyRate, isOperator, status, tradeGroup, businessPartnerId, businessPartnerName, epfNo, nicNo, } = req.body || {};
        const existing = await prisma_1.default.mF_P_Employee.findUnique({
            where: { id },
            select: { id: true, corporateEmployeeId: true, projectId: true },
        });
        if (!existing) {
            res.status(404).json({ error: 'Employee not found' });
            return;
        }
        const tradeGroupId = tradeGroup !== undefined ? await resolveTradeGroup(tradeGroup) : undefined;
        const bpId = businessPartnerId || (businessPartnerName ? await (0, exports.resolveOrCreateBusinessPartner)(existing.projectId, { name: businessPartnerName }) : undefined);
        const updateData = {};
        if (callingName !== undefined)
            updateData.callingName = callingName.trim();
        if (dailyRate !== undefined)
            updateData.dailyRate = parseFloat(dailyRate);
        if (isOperator !== undefined)
            updateData.isOperator = Boolean(isOperator);
        if (status !== undefined)
            updateData.status = status;
        if (tradeGroupId !== undefined)
            updateData.tradeGroupId = tradeGroupId;
        if (bpId !== undefined)
            updateData.businessPartnerId = bpId;
        await prisma_1.default.$transaction(async (tx) => {
            await tx.mF_P_Employee.update({
                where: { id },
                data: updateData,
            });
            if (fullName || nicNo || epfNo) {
                await tx.mF_G_Employee.update({
                    where: { id: existing.corporateEmployeeId },
                    data: {
                        fullName: fullName?.trim() || undefined,
                        nicNo: nicNo?.trim() || undefined,
                        epfNo: epfNo?.trim() || undefined,
                    },
                });
            }
        });
        const refreshed = await prisma_1.default.mF_P_Employee.findUnique({
            where: { id },
            select: employeeSelectOptimized,
        });
        res.json(formatEmployee(refreshed));
    }
    catch (error) {
        console.error('Error updating employee:', error);
        res.status(500).json({ error: 'Failed to update employee' });
    }
};
exports.updateEmployee = updateEmployee;
// 5. PATCH /api/employees/:id/status — Toggle status
const updateEmployeeStatus = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const { status } = req.body || {};
        if (!status || !['active', 'inactive'].includes(status)) {
            res.status(400).json({ error: 'Valid status ("active" | "inactive") is required' });
            return;
        }
        const updated = await prisma_1.default.mF_P_Employee.update({
            where: { id },
            data: { status },
            select: employeeSelectOptimized,
        });
        res.json(formatEmployee(updated));
    }
    catch (error) {
        console.error('Error updating employee status:', error);
        res.status(500).json({ error: 'Failed to update employee status' });
    }
};
exports.updateEmployeeStatus = updateEmployeeStatus;
// 6. DELETE /api/employees/:id — Delete or soft-deactivate
const deleteEmployee = async (req, res) => {
    try {
        const id = getParam(req.params.id);
        const [assignmentsCount, opAssignmentsCount, entriesCount] = await Promise.all([
            prisma_1.default.mF_OP_DailyAssignment.count({ where: { employeeId: id } }),
            prisma_1.default.mF_OP_DailyEquipmentAssignment.count({ where: { operatorId: id } }),
            prisma_1.default.mF_OP_TimeEntry.count({ where: { employeeId: id } }),
        ]);
        const totalUsage = assignmentsCount + opAssignmentsCount + entriesCount;
        if (totalUsage > 0) {
            await prisma_1.default.mF_P_Employee.update({
                where: { id },
                data: { status: 'inactive' },
            });
            res.json({ message: 'Employee deactivated successfully (has operational history)' });
            return;
        }
        await prisma_1.default.mF_P_Employee.delete({
            where: { id },
        });
        res.json({ message: 'Employee deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting employee:', error);
        res.status(500).json({ error: 'Failed to delete employee' });
    }
};
exports.deleteEmployee = deleteEmployee;
// 7. POST /api/employees/cross-tenant-status — Check cross-project employee availability
const getCrossTenantEmployeeStatus = async (req, res) => {
    try {
        const currentProjectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.query.projectId ||
            req.query.tenantId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const { items } = req.body || {};
        if (!items || !Array.isArray(items) || items.length === 0) {
            res.json({});
            return;
        }
        const nics = items.map((i) => i.nicNo).filter(Boolean);
        const codes = items.map((i) => i.code).filter(Boolean);
        const existingEmployees = await prisma_1.default.mF_P_Employee.findMany({
            where: {
                OR: [
                    nics.length > 0 ? { corporateEmployee: { nicNo: { in: nics } } } : undefined,
                    codes.length > 0 ? { corporateEmployee: { employeeCode: { in: codes } } } : undefined,
                ].filter(Boolean),
            },
            select: {
                id: true,
                projectId: true,
                status: true,
                project: {
                    select: {
                        id: true,
                        projectName: true,
                        subdomain: true,
                        projectCode: true,
                    },
                },
                corporateEmployee: {
                    select: {
                        employeeCode: true,
                        nicNo: true,
                        fullName: true,
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const resultMap = {};
        for (const item of items) {
            const matches = existingEmployees.filter((emp) => (item.nicNo && emp.corporateEmployee.nicNo === item.nicNo) ||
                (item.code && emp.corporateEmployee.employeeCode === item.code));
            const inCurrent = matches.find((m) => m.projectId === currentProjectId && m.status === 'active');
            const inOther = matches.find((m) => m.projectId !== currentProjectId && m.status === 'active');
            if (inCurrent) {
                resultMap[item.code] = {
                    status: 'in_current_site',
                    currentSiteName: inCurrent.project?.projectName,
                    currentSiteCode: inCurrent.project?.projectCode || inCurrent.project?.subdomain,
                    currentTenantId: inCurrent.projectId,
                    employeeId: inCurrent.id,
                };
            }
            else if (inOther) {
                resultMap[item.code] = {
                    status: 'in_other_site',
                    currentSiteName: inOther.project?.projectName || `Site ${inOther.project?.subdomain}`,
                    currentSiteCode: inOther.project?.projectCode || inOther.project?.subdomain,
                    currentTenantId: inOther.projectId,
                    employeeId: inOther.id,
                };
            }
            else {
                resultMap[item.code] = { status: 'available' };
            }
        }
        res.json(resultMap);
    }
    catch (error) {
        console.error('Error checking cross-tenant employee status:', error);
        res.status(500).json({ error: 'Failed to check cross-tenant employee status' });
    }
};
exports.getCrossTenantEmployeeStatus = getCrossTenantEmployeeStatus;
// 8. POST /api/employees/transfer — Transfer employee between projects
const transferEmployee = async (req, res) => {
    try {
        const targetProjectId = req.resolvedProjectId ||
            req.resolvedTenantId ||
            req.body.targetTenantId ||
            req.body.targetProjectId ||
            (await (0, tenantHelper_1.getDefaultTenantId)());
        const { employeeCode, callingName, fullName, nicNo, businessPartnerName, tradeGroup, dailyRate, epfNo, remarks, } = req.body || {};
        if (!callingName || !nicNo) {
            res.status(400).json({ error: 'Calling name and NIC number are required' });
            return;
        }
        const cleanCode = employeeCode?.trim();
        const cleanNic = nicNo.trim();
        // 1. Find corporate employee
        let corpEmp = await prisma_1.default.mF_G_Employee.findFirst({
            where: {
                OR: [
                    { nicNo: cleanNic },
                    cleanCode ? { employeeCode: cleanCode } : undefined,
                ].filter(Boolean),
            },
        });
        if (!corpEmp) {
            corpEmp = await prisma_1.default.mF_G_Employee.create({
                data: {
                    employeeCode: cleanCode || `EMP${Date.now().toString().slice(-4)}`,
                    fullName: fullName?.trim() || callingName.trim(),
                    nicNo: cleanNic,
                    epfNo: epfNo?.trim() || null,
                    status: 'active',
                },
            });
        }
        // 2. Identify previous active site assignment
        const prevSiteEmp = await prisma_1.default.mF_P_Employee.findFirst({
            where: {
                corporateEmployeeId: corpEmp.id,
                status: 'active',
                projectId: { not: targetProjectId },
            },
        });
        const fromProjectId = prevSiteEmp?.projectId || null;
        // 3. Perform transfer atomically
        const result = await prisma_1.default.$transaction(async (tx) => {
            // Deactivate in previous site
            if (prevSiteEmp) {
                await tx.mF_P_Employee.update({
                    where: { id: prevSiteEmp.id },
                    data: { status: 'inactive' },
                });
            }
            // Record transfer in ledger
            await tx.mF_G_EmployeeTransfer.create({
                data: {
                    corporateEmployeeId: corpEmp.id,
                    fromProjectId,
                    toProjectId: targetProjectId,
                    startDate: new Date(),
                    status: 'active',
                    remarks: remarks || `Transferred to site ${targetProjectId}`,
                },
            });
            // Resolve business partner and trade group for target site
            const targetBpId = await (0, exports.resolveOrCreateBusinessPartner)(targetProjectId, {
                name: businessPartnerName || 'Mäga Engineering (Direct)',
            });
            const targetTradeGroupId = await resolveTradeGroup(tradeGroup);
            // Upsert into target site
            const siteEmp = await tx.mF_P_Employee.upsert({
                where: {
                    projectId_corporateEmployeeId: {
                        projectId: targetProjectId,
                        corporateEmployeeId: corpEmp.id,
                    },
                },
                update: {
                    callingName: callingName.trim(),
                    dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : (corpEmp.dailyRate ?? 1400.0),
                    tradeGroupId: targetTradeGroupId,
                    businessPartnerId: targetBpId,
                    status: 'active',
                },
                create: {
                    projectId: targetProjectId,
                    corporateEmployeeId: corpEmp.id,
                    callingName: callingName.trim(),
                    dailyRate: dailyRate !== undefined ? parseFloat(dailyRate) : (corpEmp.dailyRate ?? 1400.0),
                    tradeGroupId: targetTradeGroupId,
                    businessPartnerId: targetBpId,
                    status: 'active',
                },
                select: employeeSelectOptimized,
            });
            return siteEmp;
        });
        res.status(200).json({
            success: true,
            message: `Employee ${callingName} successfully transferred to target site`,
            employee: formatEmployee(result),
        });
    }
    catch (error) {
        console.error('Error transferring employee:', error);
        res.status(500).json({ error: 'Failed to transfer employee' });
    }
};
exports.transferEmployee = transferEmployee;
// 9. GET /api/employees/corporate-master — Catalog from corporate master
const getCorporateEmployeesCatalog = async (_req, res) => {
    try {
        const list = await prisma_1.default.mF_G_Employee.findMany({
            select: {
                id: true,
                employeeCode: true,
                fullName: true,
                nicNo: true,
                epfNo: true,
                dailyRate: true,
                isOperator: true,
                status: true,
                currentWorkingProject: true,
                tradeGroup: {
                    select: { id: true, code: true, name: true },
                },
                corporateBusinessPartner: {
                    select: { id: true, code: true, name: true },
                },
            },
            orderBy: { employeeCode: 'asc' },
        });
        res.json(list);
    }
    catch (error) {
        console.error('Error fetching corporate employees catalog:', error);
        res.status(500).json({ error: 'Failed to fetch corporate employees catalog' });
    }
};
exports.getCorporateEmployeesCatalog = getCorporateEmployeesCatalog;
