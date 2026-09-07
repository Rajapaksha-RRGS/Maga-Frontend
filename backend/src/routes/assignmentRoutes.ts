import { Router } from 'express';
import {
  getAssignmentsForDate,
  getRecentGangSummaries,
  assignEmployees,
  unassignEmployee,
  copyGangsFromDate,
} from '../controllers/assignmentController';

const router = Router();

router.get('/', getAssignmentsForDate);
router.get('/recent-gangs', getRecentGangSummaries);
router.post('/', assignEmployees);
router.post('/copy', copyGangsFromDate);
router.delete('/:id', unassignEmployee);

export default router;
