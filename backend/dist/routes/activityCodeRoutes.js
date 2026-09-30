"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const activityCodeController_1 = require("../controllers/activityCodeController");
const router = (0, express_1.Router)();
// Corporate Master Catalog Endpoints (Global ERP Data)
router.get('/corporate-master', activityCodeController_1.getCorporateActivityCodesCatalog);
router.post('/corporate-master/batch', activityCodeController_1.batchSyncCorporateActivityCodes);
router.post('/import-from-corporate', activityCodeController_1.importActivityCodesFromCorporate);
// Tenant-specific Activity Codes
router.get('/', activityCodeController_1.getAllActivityCodes);
router.get('/:id', activityCodeController_1.getActivityCodeById);
router.post('/', activityCodeController_1.createActivityCode);
router.put('/:id', activityCodeController_1.updateActivityCode);
router.delete('/:id', activityCodeController_1.deleteActivityCode);
exports.default = router;
