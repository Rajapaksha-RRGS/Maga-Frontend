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

const router = Router();

router.get('/', getAllTenants);
router.post('/register', registerTenant);
router.get('/:id', getTenantById);
router.put('/:id', updateTenant);
router.patch('/:id/status', updateTenantStatus);
router.post('/:id/reset-admin-password', resetTenantAdminPassword);
router.get('/by-subdomain/:subdomain', getTenantBySubdomain);

export default router;
