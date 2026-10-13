"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employeeController_1 = require("../controllers/employeeController");
const corporateController_1 = require("../controllers/corporateController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Pending & Approvals
router.get('/pending', corporateController_1.getPendingCorporateEmployees);
router.post('/:id/approve', corporateController_1.approveCorporateEmployee);
router.post('/:id/reject', corporateController_1.rejectCorporateEmployee);
// Cross-tenant & Transfer routes (protected with authorization)
router.get('/corporate-master', employeeController_1.getCorporateEmployeesCatalog);
router.post('/cross-tenant-status', authMiddleware_1.requireAdmin, employeeController_1.getCrossTenantEmployeeStatus);
router.post('/transfer', authMiddleware_1.requireAdmin, employeeController_1.transferEmployee);
// Standard routes matching frontend expectations
router.get('/', employeeController_1.getAllEmployees);
router.get('/:id', employeeController_1.getEmployeeById);
router.post('/', employeeController_1.createEmployee);
router.put('/:id', employeeController_1.updateEmployee);
router.patch('/:id/status', employeeController_1.updateEmployeeStatus);
router.delete('/:id', employeeController_1.deleteEmployee);
exports.default = router;
