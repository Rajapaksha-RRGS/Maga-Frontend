import { Router } from 'express';
import {
  getSummaryReport,
  getDayOtSummaryReport,
  getBpBillReport,
  getErpUploadReport,
  getRunningChartReport,
  getReportFilterOptions,
  getTimeCardReport,
  getReportsHubStats,
  getEquipmentRunningChartReport,
  getEquipmentSummaryReport,
  getEquipmentErpUploadReport,
} from '../controllers/reportController';

const router = Router();

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
router.get('/hub-stats', getReportsHubStats);
router.get('/filter-options', getReportFilterOptions);
router.get('/summary', getSummaryReport);
router.get('/day-ot-summary', getDayOtSummaryReport);
router.get('/bp-bill', getBpBillReport);
router.get('/erp-upload', getErpUploadReport);
router.get('/running-chart', getRunningChartReport);
router.get('/equipment-running-chart', getEquipmentRunningChartReport);
router.get('/equipment-summary', getEquipmentSummaryReport);
router.get('/equipment-erp-upload', getEquipmentErpUploadReport);
router.get('/time-card', getTimeCardReport);

export default router;

