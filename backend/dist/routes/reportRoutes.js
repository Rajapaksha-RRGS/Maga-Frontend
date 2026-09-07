"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportController_1 = require("../controllers/reportController");
const router = (0, express_1.Router)();
/**
 * Report Routes — all scoped to a tenant via ?tenantId= query param
 * (falls back to default 'maga' tenant if not provided).
 *
 * GET /api/reports/filter-options      → business partners + activity codes for filter dropdowns
 * GET /api/reports/summary             → employee attendance + normal/OT hours totals
 * GET /api/reports/day-ot-summary      → per-day attendance matrix (pivot table)
 * GET /api/reports/bp-bill             → business partner billing grouped by contractor
 * GET /api/reports/erp-upload          → flat rows for ERP system upload with calendar-based OT lines
 */
router.get('/filter-options', reportController_1.getReportFilterOptions);
router.get('/summary', reportController_1.getSummaryReport);
router.get('/day-ot-summary', reportController_1.getDayOtSummaryReport);
router.get('/bp-bill', reportController_1.getBpBillReport);
router.get('/erp-upload', reportController_1.getErpUploadReport);
exports.default = router;
