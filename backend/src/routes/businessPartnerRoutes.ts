import { Router } from 'express';
import {
  getAllBusinessPartners,
  getBusinessPartnerById,
  getNextBusinessPartnerCode,
  createBusinessPartner,
  updateBusinessPartner,
  deleteBusinessPartner,
  toggleBusinessPartnerStatus,
  getCorporateBusinessPartnersCatalog,
} from '../controllers/businessPartnerController';

const router = Router();

// Routes
router.get('/corporate-master', getCorporateBusinessPartnersCatalog);
router.get('/next-code', getNextBusinessPartnerCode);
router.get('/', getAllBusinessPartners);
router.get('/:id', getBusinessPartnerById);
router.post('/', createBusinessPartner);
router.put('/:id', updateBusinessPartner);
router.patch('/:id/status', toggleBusinessPartnerStatus);
router.delete('/:id', deleteBusinessPartner);

export default router;
