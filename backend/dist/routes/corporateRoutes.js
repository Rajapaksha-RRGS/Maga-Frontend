"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const corporateController_1 = require("../controllers/corporateController");
const businessPartnerController_1 = require("../controllers/businessPartnerController");
const router = (0, express_1.Router)();
// Executive dashboard stats
router.get('/stats', corporateController_1.getCorporateStats);
// Corporate Projects Management (Super Admin Project Master)
router.get('/projects', corporateController_1.getCorporateProjects);
router.post('/projects', corporateController_1.createCorporateProject);
router.put('/projects/:id', corporateController_1.updateCorporateProject);
router.patch('/projects/:id/status', corporateController_1.updateCorporateProjectStatus);
router.post('/projects/:id/reset-admin-password', corporateController_1.resetCorporateProjectAdminPassword);
// Inter-Project Transfers (2-Way Handshake & Super Admin Mobilization)
router.get('/transfers', corporateController_1.getCorporateTransfers);
router.post('/transfers', corporateController_1.createCorporateTransfer);
router.post('/transfers/request', corporateController_1.requestCorporateTransfer);
router.get('/transfers/pending', corporateController_1.getPendingCorporateTransfers);
router.post('/transfers/:id/approve', corporateController_1.approveCorporateTransfer);
router.post('/transfers/:id/reject', corporateController_1.rejectCorporateTransfer);
// Global Employees
router.get('/employees/pending', corporateController_1.getPendingCorporateEmployees);
router.post('/employees/:id/approve', corporateController_1.approveCorporateEmployee);
router.post('/employees/:id/reject', corporateController_1.rejectCorporateEmployee);
router.get('/employees', corporateController_1.getCorporateEmployees);
router.post('/employees', corporateController_1.createCorporateEmployee);
router.put('/employees/:id', corporateController_1.updateCorporateEmployee);
router.post('/employees/batch', corporateController_1.batchCreateCorporateEmployees);
router.post('/employees/bulk-import', corporateController_1.bulkImportCorporateEmployees);
// Global Equipment
router.get('/equipment', corporateController_1.getCorporateEquipment);
router.post('/equipment', corporateController_1.createCorporateEquipment);
router.put('/equipment/:id', corporateController_1.updateCorporateEquipment);
router.post('/equipment/bulk-import', corporateController_1.bulkImportCorporateEquipment);
router.get('/equipment/transfers', corporateController_1.getCorporateEquipmentTransfers);
router.post('/equipment/transfer', corporateController_1.createCorporateEquipmentTransfer);
// Global Trade Groups
router.get('/trade-groups', corporateController_1.getCorporateTradeGroups);
router.post('/trade-groups', corporateController_1.createCorporateTradeGroup);
router.post('/trade-groups/bulk-import', corporateController_1.bulkImportCorporateTradeGroups);
// Global Business Partners
router.get('/business-partners/pending', businessPartnerController_1.getPendingBusinessPartners);
router.post('/business-partners/:id/approve', businessPartnerController_1.approveBusinessPartner);
router.post('/business-partners/:id/reject', businessPartnerController_1.rejectBusinessPartner);
router.get('/business-partners', corporateController_1.getCorporateBusinessPartners);
router.post('/business-partners', corporateController_1.createCorporateBusinessPartner);
router.post('/business-partners/bulk-import', corporateController_1.bulkImportCorporateBusinessPartners);
router.put('/business-partners/:id', corporateController_1.updateCorporateBusinessPartner);
router.delete('/business-partners/:id', corporateController_1.deleteCorporateBusinessPartner);
// Global Activity Codes
router.get('/activity-codes', corporateController_1.getCorporateActivityCodes);
router.post('/activity-codes', corporateController_1.createCorporateActivityCode);
router.post('/activity-codes/bulk-import', corporateController_1.bulkImportCorporateActivityCodes);
router.put('/activity-codes/:id', corporateController_1.updateCorporateActivityCode);
router.delete('/activity-codes/:id', corporateController_1.deleteCorporateActivityCode);
exports.default = router;
