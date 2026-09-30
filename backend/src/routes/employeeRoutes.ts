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
} from '../controllers/employeeController';
import { requireAdmin } from '../middleware/authMiddleware';

const router = Router();

// Cross-tenant & Transfer routes (protected with authorization)
router.get('/corporate-master', getCorporateEmployeesCatalog);
router.post('/cross-tenant-status', requireAdmin, getCrossTenantEmployeeStatus);
router.post('/transfer', requireAdmin, transferEmployee);

// Standard routes matching frontend expectations
router.get('/', getAllEmployees);
router.get('/:id', getEmployeeById);
router.post('/', createEmployee);
router.put('/:id', updateEmployee);
router.patch('/:id/status', updateEmployeeStatus);
router.delete('/:id', deleteEmployee);

export default router;
