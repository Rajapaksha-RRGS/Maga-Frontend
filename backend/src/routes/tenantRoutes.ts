import { Router } from 'express';
import {
  getAllTenants,
  getTenantById,
  getTenantBySubdomain,
  registerTenant,
  updateTenant,
  updateTenantStatus,
  resetTenantAdminPassword,
  getCorporateProjectsCatalog,
  updateEquipmentAssignMode,
  updatePoolModes,
} from '../controllers/tenantController';
import { getSiteEquipmentPool } from '../controllers/equipmentController';
import { getSiteEmployeePool } from '../controllers/employeeController';
import { requireAdmin, requireSuperAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/corporate-projects', getCorporateProjectsCatalog);
router.get('/', requireSuperAdmin, getAllTenants);
router.post('/register', requireSuperAdmin, registerTenant);
router.get('/:id', getTenantById);
router.put('/:id', updateTenant);
router.patch('/:id/status', requireAdmin, updateTenantStatus);
router.patch('/:id/equipment-mode', updateEquipmentAssignMode);
router.patch('/:id/pool-modes', updatePoolModes);
router.post('/:id/reset-admin-password', requireAdmin, resetTenantAdminPassword);
router.get('/by-subdomain/:subdomain', getTenantBySubdomain);

// Aliases for Site Resource Pools scoped under /api/tenants/:id/
router.get('/:id/equipment-pool', (req, res) => {
  req.resolvedProjectId = req.params.id;
  req.resolvedTenantId = req.params.id;
  req.query.projectId = req.params.id;
  return getSiteEquipmentPool(req, res);
});
router.get('/:id/labor-pool', (req, res) => {
  req.resolvedProjectId = req.params.id;
  req.resolvedTenantId = req.params.id;
  req.query.projectId = req.params.id;
  req.query.type = 'labor';
  return getSiteEmployeePool(req, res);
});
router.get('/:id/operator-pool', (req, res) => {
  req.resolvedProjectId = req.params.id;
  req.resolvedTenantId = req.params.id;
  req.query.projectId = req.params.id;
  req.query.type = 'operator';
  return getSiteEmployeePool(req, res);
});

export default router;
