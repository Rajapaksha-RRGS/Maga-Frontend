import { Router } from 'express';
import {
  getAllBusinessPartners,
  getBusinessPartnerById,
  getNextBusinessPartnerCode,
  createBusinessPartner,
  updateBusinessPartner,
  deleteBusinessPartner,
  toggleBusinessPartnerStatus,
} from '../controllers/businessPartnerController';

const router = Router();

// Routes
router.get('/next-code', getNextBusinessPartnerCode);
router.get('/', getAllBusinessPartners);
router.get('/:id', getBusinessPartnerById);
router.post('/', createBusinessPartner);
router.put('/:id', updateBusinessPartner);
router.patch('/:id/status', toggleBusinessPartnerStatus);
router.delete('/:id', deleteBusinessPartner);

export default router;
