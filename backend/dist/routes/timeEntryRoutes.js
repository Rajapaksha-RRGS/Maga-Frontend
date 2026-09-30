"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const timeEntryController_1 = require("../controllers/timeEntryController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = (0, express_1.Router)();
// Routes
router.get('/assigned', timeEntryController_1.getAssignedEmployees);
router.get('/', timeEntryController_1.getTimeEntries);
router.post('/check-in', timeEntryController_1.checkInEmployee);
router.post('/check-out', timeEntryController_1.checkOutEmployee);
router.post('/assign-activity', timeEntryController_1.assignActivityBulk);
router.post('/upsert', timeEntryController_1.upsertTimeEntry);
router.post('/submit', timeEntryController_1.submitDay);
router.get('/day-status', timeEntryController_1.getDayStatus);
// Approval & Admin Adjustment routes (protected with authorization)
router.get('/approval-overview', authMiddleware_1.requireAdmin, timeEntryController_1.getApprovalOverview);
router.post('/approve', authMiddleware_1.requireAdmin, timeEntryController_1.approveTimeEntries);
router.post('/reject', authMiddleware_1.requireAdmin, timeEntryController_1.rejectTimeEntries);
router.post('/admin-adjust', authMiddleware_1.requireAdmin, timeEntryController_1.adminAdjustWorkerTimeEntry);
// Operator routes
router.get('/operators', timeEntryController_1.getOperatorEntries);
router.post('/operators', timeEntryController_1.saveOperatorEntry);
router.post('/operators/bulk', timeEntryController_1.saveBulkOperatorEntries);
// Equipment log routes
router.post('/equipment/bulk', timeEntryController_1.saveBulkEquipmentLogs);
exports.default = router;
