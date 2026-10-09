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
  getPendingBusinessPartners,
  approveBusinessPartner,
  rejectBusinessPartner,
} from '../controllers/businessPartnerController';

const router = Router();

// Routes
router.get('/pending', getPendingBusinessPartners);
router.get('/corporate-master', getCorporateBusinessPartnersCatalog);
router.get('/next-code', getNextBusinessPartnerCode);
router.get('/', getAllBusinessPartners);
router.get('/:id', getBusinessPartnerById);
router.post('/', createBusinessPartner);
router.put('/:id', updateBusinessPartner);
router.post('/:id/approve', approveBusinessPartner);
router.post('/:id/reject', rejectBusinessPartner);
router.patch('/:id/status', toggleBusinessPartnerStatus);
router.delete('/:id', deleteBusinessPartner);

export default router;
