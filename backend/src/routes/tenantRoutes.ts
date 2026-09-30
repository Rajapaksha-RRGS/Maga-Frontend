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
} from '../controllers/tenantController';
import { requireAdmin } from '../middleware/authMiddleware';

const router = Router();

router.get('/corporate-projects', getCorporateProjectsCatalog);
router.get('/', getAllTenants);
router.post('/register', requireAdmin, registerTenant);
router.get('/:id', getTenantById);
router.put('/:id', updateTenant);
router.patch('/:id/status', requireAdmin, updateTenantStatus);
router.post('/:id/reset-admin-password', requireAdmin, resetTenantAdminPassword);
router.get('/by-subdomain/:subdomain', getTenantBySubdomain);

export default router;
