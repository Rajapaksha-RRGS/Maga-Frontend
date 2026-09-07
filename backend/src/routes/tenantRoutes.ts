import { Router } from 'express';
import {
  getTenantById,
  getTenantBySubdomain,
} from '../controllers/tenantController';

const router = Router();

router.get('/:id', getTenantById);
router.get('/by-subdomain/:subdomain', getTenantBySubdomain);

export default router;
