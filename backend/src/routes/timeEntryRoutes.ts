import { Router } from 'express';
import {
  getAssignedEmployees,
  checkInEmployee,
  assignActivityBulk,
  upsertTimeEntry,
  getTimeEntries,
  submitDay,
} from '../controllers/timeEntryController';

const router = Router();

// Routes
router.get('/assigned', getAssignedEmployees);
router.get('/', getTimeEntries);
router.post('/check-in', checkInEmployee);
router.post('/assign-activity', assignActivityBulk);
router.post('/upsert', upsertTimeEntry);
router.post('/submit', submitDay);

export default router;
