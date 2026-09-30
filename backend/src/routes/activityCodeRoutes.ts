import { Router } from 'express';
import {
  getAllActivityCodes,
  getActivityCodeById,
  createActivityCode,
  updateActivityCode,
  deleteActivityCode,
  getCorporateActivityCodesCatalog,
  batchSyncCorporateActivityCodes,
  importActivityCodesFromCorporate,
} from '../controllers/activityCodeController';

const router = Router();

// Corporate Master Catalog Endpoints (Global ERP Data)
router.get('/corporate-master', getCorporateActivityCodesCatalog);
router.post('/corporate-master/batch', batchSyncCorporateActivityCodes);
router.post('/import-from-corporate', importActivityCodesFromCorporate);

// Tenant-specific Activity Codes
router.get('/', getAllActivityCodes);
router.get('/:id', getActivityCodeById);
router.post('/', createActivityCode);
router.put('/:id', updateActivityCode);
router.delete('/:id', deleteActivityCode);

export default router;

