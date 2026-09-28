import { Router } from 'express';
import {
  getAssignmentsForDate,
  getRecentGangSummaries,
  assignEmployees,
  unassignEmployee,
  copyGangsFromDate,
  getOperatorAssignmentsForDate,
  assignOperators,
  unassignOperator,
  copyOperatorGangsFromDate,
  getEquipmentAssignmentsForDate,
  assignEquipment,
  unassignEquipment,
  copyEquipmentGangsFromDate,
} from '../controllers/assignmentController';

const router = Router();

// ── Operator Assignments ─────────────────────────────────────────────
router.get('/operator', getOperatorAssignmentsForDate);
router.post('/operator', assignOperators);
router.post('/operator/copy', copyOperatorGangsFromDate);
router.delete('/operator/:id', unassignOperator);

// ── Equipment Assignments ────────────────────────────────────────────
router.get('/equipment', getEquipmentAssignmentsForDate);
router.post('/equipment', assignEquipment);
router.post('/equipment/copy', copyEquipmentGangsFromDate);
router.delete('/equipment/:id', unassignEquipment);

// ── Labour Assignments ───────────────────────────────────────────────
router.get('/', getAssignmentsForDate);
router.get('/recent-gangs', getRecentGangSummaries);
router.post('/', assignEmployees);
router.post('/copy', copyGangsFromDate);
router.delete('/:id', unassignEmployee);

export default router;
