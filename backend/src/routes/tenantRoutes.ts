import { Router } from 'express';
import {
  getAllTenants,
  getTenantById,
  getTenantBySubdomain,
  registerTenant,
  updateTenant,
  updateTenantStatus,
  resetTenantAdminPassword,
} from '../controllers/tenantController';
import { requireSuperAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/', getAllTenants);
router.post('/register', requireSuperAdmin,registerTenant);
router.get('/:id', getTenantById);
router.put('/:id', updateTenant);
router.patch('/:id/status',requireSuperAdmin, updateTenantStatus);
router.post('/:id/reset-admin-password',requireSuperAdmin, resetTenantAdminPassword);
router.get('/by-subdomain/:subdomain', getTenantBySubdomain);

export default router;
