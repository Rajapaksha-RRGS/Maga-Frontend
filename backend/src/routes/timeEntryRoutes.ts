import { Router } from 'express';
import {
  getAssignedEmployees,
  checkInEmployee,
  checkOutEmployee,
  assignActivityBulk,
  upsertTimeEntry,
  getTimeEntries,
  submitDay,
  getApprovalOverview,
  approveTimeEntries,
  rejectTimeEntries,
  getOperatorEntries,
  saveOperatorEntry,
  saveBulkOperatorEntries,
} from '../controllers/timeEntryController';

const router = Router();

// Routes
router.get('/assigned', getAssignedEmployees);
router.get('/', getTimeEntries);
router.post('/check-in', checkInEmployee);
router.post('/check-out', checkOutEmployee);
router.post('/assign-activity', assignActivityBulk);
router.post('/upsert', upsertTimeEntry);
router.post('/submit', submitDay);

// Approval routes
router.get('/approval-overview', getApprovalOverview);
router.post('/approve', approveTimeEntries);
router.post('/reject', rejectTimeEntries);

// Operator routes
router.get('/operators', getOperatorEntries);
router.post('/operators', saveOperatorEntry);
router.post('/operators/bulk', saveBulkOperatorEntries);

export default router;

