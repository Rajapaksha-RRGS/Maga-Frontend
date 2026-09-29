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
  adminAdjustWorkerTimeEntry,
  getOperatorEntries,
  saveOperatorEntry,
  saveBulkOperatorEntries,
} from '../controllers/timeEntryController';
import { requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Routes
router.get('/assigned', getAssignedEmployees);
router.get('/', getTimeEntries);
router.post('/check-in', checkInEmployee);
router.post('/check-out', checkOutEmployee);
router.post('/assign-activity', assignActivityBulk);
router.post('/upsert', upsertTimeEntry);
router.post('/submit', submitDay);

// Approval & Admin Adjustment routes (protected with authorization)
router.get('/approval-overview', requireAdmin, getApprovalOverview);
router.post('/approve', requireAdmin, approveTimeEntries);
router.post('/reject', requireAdmin, rejectTimeEntries);
router.post('/admin-adjust', requireAdmin, adminAdjustWorkerTimeEntry);

// Operator routes
router.get('/operators', getOperatorEntries);
router.post('/operators', saveOperatorEntry);
router.post('/operators/bulk', saveBulkOperatorEntries);

export default router;

