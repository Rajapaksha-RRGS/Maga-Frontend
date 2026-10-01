"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const assignmentController_1 = require("../controllers/assignmentController");
const router = (0, express_1.Router)();
// ── Standby Pool ──────────────────────────────────────────────────────
router.get('/standby-pool', assignmentController_1.getStandbyPoolForDate);
// ── Operator Assignments ─────────────────────────────────────────────
router.get('/operator', assignmentController_1.getOperatorAssignmentsForDate);
router.post('/operator', assignmentController_1.assignOperators);
router.post('/operator/copy', assignmentController_1.copyOperatorGangsFromDate);
router.delete('/operator/:id', assignmentController_1.unassignOperator);
// ── Equipment Assignments ────────────────────────────────────────────
router.get('/equipment', assignmentController_1.getEquipmentAssignmentsForDate);
router.post('/equipment', assignmentController_1.assignEquipment);
router.post('/equipment/copy', assignmentController_1.copyEquipmentGangsFromDate);
router.delete('/equipment/:id', assignmentController_1.unassignEquipment);
// ── Labour Assignments ───────────────────────────────────────────────
router.get('/', assignmentController_1.getAssignmentsForDate);
router.get('/recent-gangs', assignmentController_1.getRecentGangSummaries);
router.post('/', assignmentController_1.assignEmployees);
router.post('/copy', assignmentController_1.copyGangsFromDate);
router.delete('/:id', assignmentController_1.unassignEmployee);
exports.default = router;
