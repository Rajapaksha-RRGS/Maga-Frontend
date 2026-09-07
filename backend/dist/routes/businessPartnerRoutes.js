"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const businessPartnerController_1 = require("../controllers/businessPartnerController");
const router = (0, express_1.Router)();
// Routes
router.get('/next-code', businessPartnerController_1.getNextBusinessPartnerCode);
router.get('/', businessPartnerController_1.getAllBusinessPartners);
router.get('/:id', businessPartnerController_1.getBusinessPartnerById);
router.post('/', businessPartnerController_1.createBusinessPartner);
router.put('/:id', businessPartnerController_1.updateBusinessPartner);
router.patch('/:id/status', businessPartnerController_1.toggleBusinessPartnerStatus);
router.delete('/:id', businessPartnerController_1.deleteBusinessPartner);
exports.default = router;
