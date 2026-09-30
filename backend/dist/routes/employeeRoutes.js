"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employeeController_1 = require("../controllers/employeeController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
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
