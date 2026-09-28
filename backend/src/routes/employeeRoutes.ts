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
} from '../controllers/employeeController';

const router = Router();

// Cross-tenant & Transfer routes (must be before :id)
router.post('/cross-tenant-status', getCrossTenantEmployeeStatus);
router.post('/transfer', transferEmployee);

// Standard routes matching frontend expectations
router.get('/', getAllEmployees);
router.get('/:id', getEmployeeById);
router.post('/', createEmployee);
router.put('/:id', updateEmployee);
router.patch('/:id/status', updateEmployeeStatus);
router.delete('/:id', deleteEmployee);

export default router;
