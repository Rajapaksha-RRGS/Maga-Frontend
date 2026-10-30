import { Router } from 'express';
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  updateEmployeeStatus,
  deleteEmployee,
  getCrossTenantEmployeeStatus,
  transferEmployee,
  getCorporateEmployeesCatalog,
  getSiteEmployeePool,
} from '../controllers/employeeController';
import {
  getPendingCorporateEmployees,
  approveCorporateEmployee,
  rejectCorporateEmployee,
} from '../controllers/corporateController';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Pending & Approvals (Admin)
router.get('/pending', requireAdmin, getPendingCorporateEmployees);
router.post('/:id/approve', requireAdmin, approveCorporateEmployee);
router.post('/:id/reject', requireAdmin, rejectCorporateEmployee);

// Cross-tenant & Transfer routes (protected with authorization)
router.get('/corporate-master', requireAdmin, getCorporateEmployeesCatalog);
router.post('/cross-tenant-status', requireAdmin, getCrossTenantEmployeeStatus);
router.post('/transfer', requireAdmin, transferEmployee);

// Standard routes matching frontend expectations
router.get('/site-pool', getSiteEmployeePool);
router.get('/', requireAuth, getAllEmployees);
router.get('/:id', requireAuth, getEmployeeById);
router.post('/', requireAdmin, createEmployee);
router.put('/:id', requireAdmin, updateEmployee);
router.patch('/:id/status', requireAdmin, updateEmployeeStatus);
router.delete('/:id', requireAdmin, deleteEmployee);

export default router;
