"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const timeEntryController_1 = require("../controllers/timeEntryController");
const router = (0, express_1.Router)();
// Routes
router.get('/assigned', timeEntryController_1.getAssignedEmployees);
router.get('/', timeEntryController_1.getTimeEntries);
router.post('/check-in', timeEntryController_1.checkInEmployee);
router.post('/check-out', timeEntryController_1.checkOutEmployee);
router.post('/assign-activity', timeEntryController_1.assignActivityBulk);
router.post('/upsert', timeEntryController_1.upsertTimeEntry);
router.post('/submit', timeEntryController_1.submitDay);
// Approval routes
router.get('/approval-overview', timeEntryController_1.getApprovalOverview);
router.post('/approve', timeEntryController_1.approveTimeEntries);
router.post('/reject', timeEntryController_1.rejectTimeEntries);
router.post('/admin-adjust', timeEntryController_1.adminAdjustWorkerTimeEntry);
// Operator routes
router.get('/operators', timeEntryController_1.getOperatorEntries);
router.post('/operators', timeEntryController_1.saveOperatorEntry);
router.post('/operators/bulk', timeEntryController_1.saveBulkOperatorEntries);
exports.default = router;
