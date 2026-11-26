/**
 * costDashboardService.ts — API client for the Cost BI Dashboard endpoint.
 *
 * GET /api/reports/cost-dashboard?tenantId=&month=&year=&dateFrom=&dateTo=&includeDrafts=
 */
import { API_URL, apiFetch, getCurrentTenantId } from '../../../config/api';

/* ── Response Types ───────────────────────────────────────────────────────── */

export interface CostDashboardPeriod {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  currency: string;
  projectName: string;
  projectCode: string;
  includeDrafts: boolean;
}

export interface CostDashboardKpis {
  totalCost: number;
  previousTotalCost: number;
  totalCostChangePct: number | null;
  laborCost: number;
  regularLaborCost: number;
  otLaborCost: number;
  previousLaborCost: number;
  laborCostChangePct: number | null;
  equipmentCost: number;
  previousEquipmentCost: number;
  equipmentCostChangePct: number | null;
  totalLaborHours: number;
  totalOtHours: number;
  totalEquipmentFuelLiters: number;
  totalIdleHours: number;
  totalBreakdownHours: number;
  estimatedIdleCost: number;
}

export interface DailyTrendItem {
  date: string;
  laborCost: number;
  regularCost: number;
  otCost: number;
  equipmentCost: number;
  totalCost: number;
}

export interface ResourceMixItem {
  key: string;
  label: string;
  cost: number;
  hours: number;
  count: number;
}

export interface ActivityCostItem {
  code: string;
  description: string;
  laborCost: number;
  equipmentCost: number;
  totalCost: number;
  laborHours: number;
  equipmentUtil: number;
}

export interface TradeGroupCostItem {
  tradeGroup: string;
  skilledCost: number;
  unskilledCost: number;
  totalCost: number;
  totalHours: number;
}

export interface BusinessPartnerSpendItem {
  partnerId: string;
  partnerName: string;
  partnerCode: string;
  laborCost: number;
  equipmentCost: number;
  totalCost: number;
  workerCount: number;
  equipmentCount: number;
}

export interface EquipmentEfficiencyItem {
  id: string;
  code: string;
  name: string;
  condition: string;
  unit: string;
  workingHours: number;
  idleHours: number;
  breakdownHours: number;
  fuelLiters: number;
  utilization: number;
  cost: number;
}

export interface CostDashboardData {
  period: CostDashboardPeriod;
  kpis: CostDashboardKpis;
  dailyTrend: DailyTrendItem[];
  resourceMix: ResourceMixItem[];
  activityCosts: ActivityCostItem[];
  tradeGroupCosts: TradeGroupCostItem[];
  businessPartnerSpend: BusinessPartnerSpendItem[];
  equipmentEfficiency: EquipmentEfficiencyItem[];
}

/* ── Fetch params ─────────────────────────────────────────────────────────── */

export interface CostDashboardFilters {
  month?: string;        // YYYY-MM
  year?: string;         // YYYY
  dateFrom?: string;     // YYYY-MM-DD
  dateTo?: string;       // YYYY-MM-DD
  includeDrafts?: boolean;
}

/* ── API Call ──────────────────────────────────────────────────────────────── */

export async function fetchCostDashboard(filters?: CostDashboardFilters): Promise<CostDashboardData> {
  const p = new URLSearchParams();
  const tenantId = getCurrentTenantId();
  if (tenantId) p.set('tenantId', tenantId);
  if (filters?.month) p.set('month', filters.month);
  if (filters?.year) p.set('year', filters.year);
  if (filters?.dateFrom) p.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) p.set('dateTo', filters.dateTo);
  if (filters?.includeDrafts) p.set('includeDrafts', 'true');

  const qs = p.toString();
  const r = await apiFetch(`${API_URL}/reports/cost-dashboard${qs ? `?${qs}` : ''}`);
  if (!r.ok) throw new Error(`Cost dashboard API error: ${r.status}`);
  return r.json();
}
