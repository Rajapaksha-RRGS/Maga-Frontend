"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const employeeController_1 = require("../controllers/employeeController");
const router = (0, express_1.Router)();
// Routes matching frontend expectations
router.get('/', employeeController_1.getAllEmployees);
router.get('/:id', employeeController_1.getEmployeeById);
router.post('/', employeeController_1.createEmployee);
router.put('/:id', employeeController_1.updateEmployee);
router.patch('/:id/status', employeeController_1.updateEmployeeStatus);
router.delete('/:id', employeeController_1.deleteEmployee);
exports.default = router;
