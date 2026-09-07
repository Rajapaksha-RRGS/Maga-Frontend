"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const tenantController_1 = require("../controllers/tenantController");
const router = (0, express_1.Router)();
router.get('/:id', tenantController_1.getTenantById);
router.get('/by-subdomain/:subdomain', tenantController_1.getTenantBySubdomain);
exports.default = router;
