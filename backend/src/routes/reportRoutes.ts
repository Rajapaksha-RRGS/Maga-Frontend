import { Router } from 'express';
import {
  getSummaryReport,
  getDayOtSummaryReport,
  getBpBillReport,
  getErpUploadReport,
  getRunningChartReport,
  getReportFilterOptions,
} from '../controllers/reportController';

const router = Router();

/**
 * Report Routes — all scoped to a tenant via ?tenantId= query param
 * (falls back to default 'maga' tenant if not provided).
 *
 * GET /api/reports/filter-options      → business partners + activity codes for filter dropdowns
 * GET /api/reports/summary             → employee attendance + normal/OT hours totals
 * GET /api/reports/day-ot-summary      → per-day attendance matrix (pivot table)
 * GET /api/reports/bp-bill             → business partner billing grouped by contractor
 * GET /api/reports/erp-upload          → flat rows for ERP system upload with calendar-based OT lines
 * GET /api/reports/running-chart       → daily labour running chart with supervisor, in/out, work/OT, and activity hours
 */
router.get('/filter-options', getReportFilterOptions);
router.get('/summary', getSummaryReport);
router.get('/day-ot-summary', getDayOtSummaryReport);
router.get('/bp-bill', getBpBillReport);
router.get('/erp-upload', getErpUploadReport);
router.get('/running-chart', getRunningChartReport);

export default router;
