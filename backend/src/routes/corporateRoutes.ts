import { Router } from 'express';
import {
  getCorporateStats,
  getCorporateTransfers,
  createCorporateTransfer,
  requestCorporateTransfer,
  getPendingCorporateTransfers,
  approveCorporateTransfer,
  rejectCorporateTransfer,
  getCorporateEmployees,
  createCorporateEmployee,
  batchCreateCorporateEmployees,
  bulkImportCorporateEmployees,
  getCorporateEquipment,
  createCorporateEquipment,
  bulkImportCorporateEquipment,
  getCorporateTradeGroups,
  createCorporateTradeGroup,
  bulkImportCorporateTradeGroups,
  getCorporateBusinessPartners,
  createCorporateBusinessPartner,
  updateCorporateBusinessPartner,
  deleteCorporateBusinessPartner,
  bulkImportCorporateBusinessPartners,
  getCorporateActivityCodes,
  createCorporateActivityCode,
  updateCorporateActivityCode,
  deleteCorporateActivityCode,
  bulkImportCorporateActivityCodes,
  getCorporateProjects,
  createCorporateProject,
  updateCorporateProject,
  updateCorporateProjectStatus,
  resetCorporateProjectAdminPassword,
  getPendingCorporateEmployees,
  approveCorporateEmployee,
  rejectCorporateEmployee,
} from '../controllers/corporateController';
import {
  getPendingBusinessPartners,
  approveBusinessPartner,
  rejectBusinessPartner,
} from '../controllers/businessPartnerController';

const router = Router();

// Executive dashboard stats
router.get('/stats', getCorporateStats);

// Corporate Projects Management (Super Admin Project Master)
router.get('/projects', getCorporateProjects);
router.post('/projects', createCorporateProject);
router.put('/projects/:id', updateCorporateProject);
router.patch('/projects/:id/status', updateCorporateProjectStatus);
router.post('/projects/:id/reset-admin-password', resetCorporateProjectAdminPassword);

// Inter-Project Transfers (2-Way Handshake & Super Admin Mobilization)
router.get('/transfers', getCorporateTransfers);
router.post('/transfers', createCorporateTransfer);
router.post('/transfers/request', requestCorporateTransfer);
router.get('/transfers/pending', getPendingCorporateTransfers);
router.post('/transfers/:id/approve', approveCorporateTransfer);
router.post('/transfers/:id/reject', rejectCorporateTransfer);

// Global Employees
router.get('/employees/pending', getPendingCorporateEmployees);
router.post('/employees/:id/approve', approveCorporateEmployee);
router.post('/employees/:id/reject', rejectCorporateEmployee);
router.get('/employees', getCorporateEmployees);
router.post('/employees', createCorporateEmployee);
router.post('/employees/batch', batchCreateCorporateEmployees);
router.post('/employees/bulk-import', bulkImportCorporateEmployees);

// Global Equipment
router.get('/equipment', getCorporateEquipment);
router.post('/equipment', createCorporateEquipment);
router.post('/equipment/bulk-import', bulkImportCorporateEquipment);

// Global Trade Groups
router.get('/trade-groups', getCorporateTradeGroups);
router.post('/trade-groups', createCorporateTradeGroup);
router.post('/trade-groups/bulk-import', bulkImportCorporateTradeGroups);

// Global Business Partners
router.get('/business-partners/pending', getPendingBusinessPartners);
router.post('/business-partners/:id/approve', approveBusinessPartner);
router.post('/business-partners/:id/reject', rejectBusinessPartner);
router.get('/business-partners', getCorporateBusinessPartners);
router.post('/business-partners', createCorporateBusinessPartner);
router.post('/business-partners/bulk-import', bulkImportCorporateBusinessPartners);
router.put('/business-partners/:id', updateCorporateBusinessPartner);
router.delete('/business-partners/:id', deleteCorporateBusinessPartner);

// Global Activity Codes
router.get('/activity-codes', getCorporateActivityCodes);
router.post('/activity-codes', createCorporateActivityCode);
router.post('/activity-codes/bulk-import', bulkImportCorporateActivityCodes);
router.put('/activity-codes/:id', updateCorporateActivityCode);
router.delete('/activity-codes/:id', deleteCorporateActivityCode);

export default router;

