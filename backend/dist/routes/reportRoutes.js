"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const reportController_1 = require("../controllers/reportController");
const router = (0, express_1.Router)();
/**
 * Report Routes — all scoped to a tenant via ?tenantId= query param
 * (falls back to default 'maga' tenant if not provided).
 *
 * GET /api/reports/hub-stats               → aggregated stats for the 3-category Reports Hub
 * GET /api/reports/filter-options          → business partners + activity codes for filter dropdowns
 * GET /api/reports/summary                 → employee attendance + normal/OT hours totals
 * GET /api/reports/day-ot-summary          → per-day attendance matrix (pivot table)
 * GET /api/reports/bp-bill                 → business partner billing grouped by contractor
 * GET /api/reports/erp-upload              → flat rows for ERP system upload with calendar-based OT lines
 * GET /api/reports/running-chart           → daily labour running chart with supervisor, in/out, work/OT, and activity hours
 * GET /api/reports/equipment-running-chart → daily equipment log running chart (meter readings, net/idle/breakdown hrs, fuel)
 * GET /api/reports/equipment-summary       → Maga equipment entry sheet (Vehicle No, Unit, Min Util, Total Util, Mileage)
 * GET /api/reports/equipment-erp-upload    → equipment ERP upload matrix (Equipment, Condition, Unit, Date, Activity, Utilization)
 * GET /api/reports/time-card               → monthly labour/operator time card (Maga Engineering format)
 */
router.get('/hub-stats', reportController_1.getReportsHubStats);
router.get('/filter-options', reportController_1.getReportFilterOptions);
router.get('/summary', reportController_1.getSummaryReport);
router.get('/day-ot-summary', reportController_1.getDayOtSummaryReport);
router.get('/bp-bill', reportController_1.getBpBillReport);
router.get('/erp-upload', reportController_1.getErpUploadReport);
router.get('/running-chart', reportController_1.getRunningChartReport);
router.get('/equipment-running-chart', reportController_1.getEquipmentRunningChartReport);
router.get('/equipment-summary', reportController_1.getEquipmentSummaryReport);
router.get('/equipment-erp-upload', reportController_1.getEquipmentErpUploadReport);
router.get('/time-card', reportController_1.getTimeCardReport);
exports.default = router;
