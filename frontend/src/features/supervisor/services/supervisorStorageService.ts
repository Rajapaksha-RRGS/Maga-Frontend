/**
 * supervisorStorageService.ts
 *
 * Dedicated offline-first data & draft storage engine for the Mäga Supervisor Mobile App.
 * Handles:
 *   - Master activity codes & project sites
 *   - Daily assigned laborers, operators, and equipment per date
 *   - LocalStorage draft persistence for in-progress entries
 *   - Offline sync queue & simulated sync with realistic feedback
 */

import { apiFetch, API_URL } from "../../../config/api";
import { DEFAULT_MASTER_ACTIVITY_CODES } from "../data/defaultActivityCodes";

export interface ActivityCodeItem {
  id?: string;
  code: string;
  name: string;
  trade: string;
  category: string;
  projectCode?: string;
}

export interface SupervisorDayStatus {
  status: 'draft' | 'pending_submit' | 'submitted' | 'approved';
  isLocked: boolean;
  submittedAt?: string | null;
  approvedAt?: string | null;
  remarks?: string | null;
}

export interface ActivitySplit {
  id: string;
  activityCode: string;
  hours: number;
}

export interface LaborerEntry {
  id: string;
  callingName: string;
  fullName?: string;
  employeeCode: string;
  tradeGroup: string;
  businessPartner: string;
  nic: string;
  inTime: string;
  outTime: string;
  shiftHours: number;
  otHours: number;
  activities: ActivitySplit[];
  status: 'draft' | 'pending' | 'done';
  isStandbyAssigned?: boolean;
  isAbsent?: boolean;
  lastSavedAt?: string;
  claimedBySupervisor?: string;
  claimedSupervisorId?: string;
  claimedInTime?: string;
  claimedOutTime?: string;
  claimedHours?: number;
  claimedByMe?: boolean;
}

export interface OperatorEquipmentSplit {
  id: string;
  equipmentId: string;
  hours: number;
  remarks?: string;
}

export interface OperatorEntry {
  id: string;
  callingName: string;
  employeeNumber: string;
  licenseNo: string;
  designation: string;
  inTime: string;
  outTime: string;
  shiftHours: number;
  otHours: number;
  assignedEquipmentId: string; // Primary ID of the mapped equipment
  equipmentSplits?: OperatorEquipmentSplit[];
  status: 'draft' | 'pending' | 'done';
  notes?: string;
  lastSavedAt?: string;
  claimedBySupervisor?: string;
  claimedSupervisorId?: string;
  claimedInTime?: string;
  claimedOutTime?: string;
  claimedHours?: number;
  claimedMachineCodes?: string[];
  claimedByMe?: boolean;
}

export type EquipmentRatingUnit = 'Days' | 'Hrs' | 'EX.hrs' | 'mth' | 'm2' | 'km';

export function normalizeRatingUnit(raw: string | undefined | null): EquipmentRatingUnit {
  if (!raw) return 'mth';
  const lower = raw.trim().toLowerCase();
  if (lower === 'day' || lower === 'days') return 'Days';
  if (lower === 'hr' || lower === 'hrs' || lower === 'hours' || lower === 'hour') return 'Hrs';
  if (lower === 'ex.hrs' || lower === 'ex.hr' || lower === 'extra hours' || lower === 'ot.hrs') return 'EX.hrs';
  if (lower === 'mth' || lower === 'month' || lower === 'months') return 'mth';
  if (lower === 'm2' || lower === 'm²' || lower === 'sqm') return 'm2';
  if (lower === 'km' || lower === 'kms' || lower === 'mileage') return 'km';
  if (lower === 'ton' || lower === 'tons') return 'Days';
  return 'Hrs';
}

export interface EquipmentActivitySplit {
  id: string;
  activityCode: string;
  unit: EquipmentRatingUnit;
  utilization: number;
  remarks?: string;
}

export interface EquipmentLogEntry {
  id: string;
  code: string;
  vehicleNo?: string;
  magaNo?: string;
  name: string;
  type: string;
  condition?: 'DRY' | 'WET';
  
  // Rating Units (from Master Data)
  primaryUnit?: EquipmentRatingUnit;
  availableUnits?: EquipmentRatingUnit[];
  activeUnit?: EquipmentRatingUnit;
  additionalUnit?: EquipmentRatingUnit | null;
  
  // Values per unit
  startMeter: number;
  endMeter: number;
  netHours: number; // for 'mth'
  daysValue?: number; // for 'Days' (1, 0.5, 1.5, etc.)
  hoursValue?: number; // for 'Hrs'
  extraHoursValue?: number; // for 'EX.hrs'
  areaValue?: number; // for 'm2'
  startMileage?: number; // for 'km'
  endMileage?: number;
  totalMileage?: number;
  totalUtilization?: number;
  
  workingHours: number;
  idleHours: number;
  breakdownHours: number;
  fuelIssuedLiters: number;
  operatorId?: string;
  activityCode?: string;
  activitySplits?: EquipmentActivitySplit[];
  activities?: Array<{
    id?: string;
    activityCode: string;
    unit?: string;
    utilization: number;
    remarks?: string;
  }>;
  status: 'draft' | 'pending' | 'done';
  remarks?: string;
  lastSavedAt?: string;

  // Multi-supervisor sharing & conflict context
  isSharedToday?: boolean;
  sharedSupervisors?: string[];
  existingLoggedDays?: number;
  existingLoggedHours?: number;
  previousFinalMeter?: number;
  previousEndMileage?: number;
  existingActivities?: string[];
}

export interface ExistingEquipmentUsage {
  supervisorId: string;
  supervisorName: string;
  unitCode?: string;
  totalUtilization?: number;
  workingHours?: number;
  initialMeter?: number;
  finalMeter?: number;
  startMileage?: number;
  endMileage?: number;
  status?: string;
  activities?: Array<{
    code: string;
    name: string;
    hours?: number;
    utilization?: number;
  }>;
}

export interface SitePoolEquipmentItem {
  id: string;
  projectId: string;
  code: string;
  vehicleNo: string;
  magaNo: string;
  name: string;
  type: string;
  condition: 'DRY' | 'WET';
  primaryUnit: EquipmentRatingUnit;
  availableUnits: EquipmentRatingUnit[];
  status: string;
  isInUseToday: boolean;
  currentSupervisors: string[];
  latestMeter: number;
  latestMileage?: number;
  totalLoggedDays?: number;
  totalLoggedHours?: number;
  totalLoggedMileage?: number;
  existingUsages?: ExistingEquipmentUsage[];
}

export interface SiteProject {
  id: string;
  name: string;
  code: string;
  location: string;
  projectManager: string;
}

// ─── Default Fallback Site ───────────────────────────────────────────────────

export const DEFAULT_SITE: SiteProject = {
  id: '',
  name: 'Mäga Engineering',
  code: 'MAGA',
  location: 'Site Operations Base',
  projectManager: 'Eng. Project Lead',
};

// ─── Storage Keys & Helper Functions ─────────────────────────────────────────

const STORAGE_PREFIX = 'maga_supervisor_data_';
const SYNC_QUEUE_KEY = 'maga_supervisor_sync_queue';
const ACTIVE_SITE_KEY = 'maga_supervisor_active_site';
const AVAILABLE_SITES_KEY = 'maga_supervisor_available_sites';

export const supervisorStorage = {
  getAvailableSites(): SiteProject[] {
    try {
      const saved = localStorage.getItem(AVAILABLE_SITES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    const active = this.getActiveSite();
    return active.id ? [active] : [DEFAULT_SITE];
  },

  async fetchActiveSite(userId?: string, tenantId?: string): Promise<SiteProject> {
    try {
      const params = new URLSearchParams();
      if (userId) params.append('supervisorId', userId);
      if (tenantId) params.append('tenantId', tenantId);
      const query = params.toString() ? ('?' + params.toString()) : '';

      const res = await apiFetch(`${API_URL}/supervisors/active-site${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.activeSite) {
          this.setActiveSite(data.activeSite);
          localStorage.setItem(AVAILABLE_SITES_KEY, JSON.stringify([data.activeSite]));
          return data.activeSite;
        }
      }
    } catch (err) {
      console.warn('Could not fetch active site from backend:', err);
    }
    return this.getActiveSite();
  },

  getActiveSite(): SiteProject {
    try {
      const saved = localStorage.getItem(ACTIVE_SITE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.name) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_SITE;
  },

  setActiveSite(site: SiteProject) {
    localStorage.setItem(ACTIVE_SITE_KEY, JSON.stringify(site));
  },

  async getStandbyWorkers(_userId?: string, _tenantId?: string) {
    return [];
  },

  async fetchStandbyWorkers(_date?: string) {
    return [];
  },

  // ── 1. Master Activity Codes (Backend with Tenant Isolation + Project Code Validation + Offline Cache)
  async getActivityCodes(): Promise<ActivityCodeItem[]> {
    const activeSite = this.getActiveSite();
    const siteCode = activeSite?.code;
    const key = siteCode ? `${STORAGE_PREFIX}activities_cache_${siteCode}` : `${STORAGE_PREFIX}activities_cache`;
    const fallbackKey = `${STORAGE_PREFIX}activities_master_cache`;

    try {
      // 1. Fetch tenant/project activity codes from backend
      const queryParam = siteCode ? `?projectCode=${encodeURIComponent(siteCode)}` : '';
      let res = await apiFetch(`${API_URL}/activity-codes${queryParam}`);
      if (!res.ok && siteCode) {
        // Try tenant-wide without projectCode
        res = await apiFetch(`${API_URL}/activity-codes`);
      }

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // If projectCode matches siteCode, prioritize them; otherwise accept general tenant codes
          const projectSpecific = data.filter((d: any) => d.projectCode && siteCode && d.projectCode.trim().toLowerCase() === siteCode.trim().toLowerCase());
          const candidateList = projectSpecific.length > 0 ? projectSpecific : data;

          const mapped: ActivityCodeItem[] = candidateList.map((d: any) => ({
            id: d.id,
            code: d.code,
            name: d.description || d.code,
            trade: d.trade || '',
            category: d.category || '',
            projectCode: d.projectCode || siteCode,
          }));
          localStorage.setItem(key, JSON.stringify(mapped));
          localStorage.setItem(fallbackKey, JSON.stringify(mapped));
          return mapped;
        }
      }

      // 2. If tenant doesn't have custom codes, query Corporate ERP Catalog
      let corpRes: Response | null = null;
      if (siteCode && siteCode !== 'MAGA') {
        corpRes = await apiFetch(`${API_URL}/activity-codes/corporate-master?projectCode=${encodeURIComponent(siteCode)}`);
      }
      if (!corpRes || !corpRes.ok) {
        // Query general corporate catalog (124+ codes)
        corpRes = await apiFetch(`${API_URL}/activity-codes/corporate-master`);
      }

      if (corpRes && corpRes.ok) {
        const corpData = await corpRes.json();
        if (Array.isArray(corpData) && corpData.length > 0) {
          const mapped: ActivityCodeItem[] = corpData.map((d: any) => ({
            id: d.id,
            code: d.code,
            name: d.description || d.code,
            trade: d.tradeGroup || '',
            category: d.activityType || 'Civil',
            projectCode: d.projectCode || siteCode,
          }));
          localStorage.setItem(key, JSON.stringify(mapped));
          localStorage.setItem(fallbackKey, JSON.stringify(mapped));
          return mapped;
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, trying cached/bundled activities:', err);
    }

    // 3. Try Site-specific Cache
    const cached = localStorage.getItem(key) || localStorage.getItem(fallbackKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {}
    }

    // 4. Bundled Offline Fallback (Guaranteed to populate for Mobile APK)
    localStorage.setItem(fallbackKey, JSON.stringify(DEFAULT_MASTER_ACTIVITY_CODES));
    return DEFAULT_MASTER_ACTIVITY_CODES;
  },

  async resolveActivityByCode(code: string): Promise<ActivityCodeItem | undefined> {
    const list = await this.getActivityCodes();
    return list.find((a) => a.code === code);
  },

  // ── 2. Master Equipment (Backend + Offline Cache) ──────────────────────────
  async fetchEquipment(supervisorId?: string, date?: string): Promise<EquipmentLogEntry[]> {
    try {
      if (supervisorId && date) {
        // Fetch equipment assigned to this supervisor on this date directly from Backend (Single Source of Truth)
        const res = await apiFetch(
          `${API_URL}/assignments/equipment?date=${encodeURIComponent(date)}&supervisorId=${encodeURIComponent(supervisorId)}`
        );
        if (res.ok) {
          const assignedData = await res.json();
          const mapped: EquipmentLogEntry[] = (assignedData || []).map((asgn: any) => {
            const dbPrimaryUnit: EquipmentRatingUnit = normalizeRatingUnit(asgn.primaryUnit);
            const dbAvailableUnits: EquipmentRatingUnit[] = [dbPrimaryUnit];
            const log = asgn.dailyLog;
            const logDays = (dbPrimaryUnit === 'Days' || dbPrimaryUnit === 'mth')
              ? Number(log?.daysValue ?? log?.totalUtilization ?? 0)
              : undefined;
            const logHours = (dbPrimaryUnit === 'Hrs')
              ? Number(log?.hoursValue ?? log?.totalUtilization ?? log?.workingHours ?? 0)
              : undefined;

            const backendSplits = (Array.isArray(log?.activitySplits) && log.activitySplits.length > 0)
              ? log.activitySplits.map((s: any) => ({
                  id: s.id || `split-${Math.random()}`,
                  activityCode: s.activityCode,
                  unit: normalizeRatingUnit(s.unit || dbPrimaryUnit),
                  utilization: Number(s.utilization ?? 0),
                }))
              : [];

            return {
              id: asgn.equipmentId || asgn.id,
              code: asgn.equipmentCode || asgn.equipmentName,
              name: asgn.equipmentName,
              type: asgn.equipmentType || 'Equipment',
              vehicleNo: asgn.vehicleNo || asgn.equipmentCode,
              magaNo: asgn.magaNo || asgn.equipmentCode,
              condition: (asgn.condition as 'DRY' | 'WET' | undefined) ?? 'DRY',
              primaryUnit: dbPrimaryUnit,
              availableUnits: dbAvailableUnits,
              activeUnit: dbPrimaryUnit,
              additionalUnit: null,
              daysValue: logDays && logDays > 0 ? logDays : undefined,
              hoursValue: logHours && logHours > 0 ? logHours : undefined,
              extraHoursValue: undefined,
              areaValue: undefined,
              startMeter: Number(log?.startMeter ?? 0),
              endMeter: Number(log?.endMeter ?? 0),
              netHours: Number(log?.netHours ?? log?.workingHours ?? 0),
              workingHours: Number(log?.workingHours ?? log?.netHours ?? 0),
              idleHours: Number(log?.idleHours ?? 0),
              breakdownHours: Number(log?.breakdownHours ?? 0),
              fuelIssuedLiters: Number(log?.fuelIssuedLiters ?? 0),
              totalMileage: Number(log?.totalMileage ?? 0),
              startMileage: Number(log?.startMileage ?? 0),
              endMileage: Number(log?.endMileage ?? 0),
              operatorId: asgn.operatorId,
              activityCode: log?.activityCode || (log?.activitySplits?.[0]?.activityCode ?? ''),
              activitySplits: backendSplits,
              activities: [],
              remarks: log?.remarks || '',
              status: log?.status || 'pending',
            };
          });
          return mapped;
        }
      } else {
        const res = await apiFetch(`${API_URL}/equipment`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            return data.map((eq: any) => ({
              id: eq.id,
              code: eq.code || eq.name,
              name: eq.name,
              type: eq.type || 'Equipment',
              availableUnits: ['Hrs', 'Days', 'EX.hrs', 'mth'],
              activeUnit: 'Hrs',
              startMeter: 0,
              endMeter: 0,
              netHours: 0,
              workingHours: 0,
              idleHours: 0,
              breakdownHours: 0,
              fuelIssuedLiters: 0,
              status: 'pending',
            }));
          }
        }
      }
    } catch (err) {
      console.warn('Backend unavailable for equipment:', err);
    }
    return [];
  },

  // ── 2.01 Fetch Site Labor Pool ──────────────────────────────────────────────
  async fetchSiteLaborPool(projectId?: string, date?: string, supervisorId?: string): Promise<any[]> {
    try {
      const activeProjId = projectId || this.getActiveSite().id;
      const params = new URLSearchParams({
        projectId: activeProjId || '',
        type: 'labor',
      });
      if (date) params.append('date', date);
      if (supervisorId) params.append('supervisorId', supervisorId);

      const res = await apiFetch(`${API_URL}/employees/site-pool?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('Could not fetch site labor pool:', err);
    }
    return [];
  },

  // ── 2.02 Fetch Site Operator Pool ───────────────────────────────────────────
  async fetchSiteOperatorPool(projectId?: string, date?: string, supervisorId?: string): Promise<any[]> {
    try {
      const activeProjId = projectId || this.getActiveSite().id;
      const params = new URLSearchParams({
        projectId: activeProjId || '',
        type: 'operator',
      });
      if (date) params.append('date', date);
      if (supervisorId) params.append('supervisorId', supervisorId);

      const res = await apiFetch(`${API_URL}/employees/site-pool?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data;
      }
    } catch (err) {
      console.warn('Could not fetch site operator pool:', err);
    }
    return [];
  },

  // ── 2.1 Fetch Site Equipment Pool (Zero-Conflict Handover) ───────────────────
  async fetchSiteEquipmentPool(projectId?: string, date?: string): Promise<SitePoolEquipmentItem[]> {
    try {
      const activeProjId = projectId || this.getActiveSite().id;
      const url = `${API_URL}/equipment/site-pool?projectId=${encodeURIComponent(activeProjId || '')}${date ? `&date=${encodeURIComponent(date)}` : ''}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Could not fetch site equipment pool:', err);
    }
    return [];
  },

  // ── 2.2 Check if Equipment Pool Mode is Enabled for Project ────────────────
  async isEquipmentPoolModeEnabled(projectId?: string): Promise<boolean> {
    try {
      const activeProjId = projectId || this.getActiveSite().id;
      if (!activeProjId) return false;
      const res = await apiFetch(`${API_URL}/tenants/${activeProjId}`);
      if (res.ok) {
        const data = await res.json();
        return !!data.equipmentAssignBySupervisor;
      }
    } catch (err) {
      console.warn('Could not check equipment pool mode:', err);
    }
    return false;
  },

  createEquipmentLogEntryFromPool(
    item: SitePoolEquipmentItem,
    currentUserId?: string,
    currentUserName?: string
  ): EquipmentLogEntry {
    const primaryUnit: EquipmentRatingUnit = normalizeRatingUnit(item.primaryUnit);

    // Only consider usages by OTHER supervisors
    const otherUsages = (item.existingUsages || []).filter((u) => {
      if (currentUserId && u.supervisorId === currentUserId) return false;
      if (currentUserName && u.supervisorName && u.supervisorName.trim().toLowerCase() === currentUserName.trim().toLowerCase()) return false;
      return true;
    });

    const otherSupervisors = Array.from(new Set(otherUsages.map((u) => u.supervisorName)));
    let otherLoggedDays = 0;
    let otherLoggedHours = 0;
    for (const u of otherUsages) {
      const uCode = (u.unitCode || item.primaryUnit || '').toLowerCase();
      const uUtil = u.totalUtilization ?? 0;
      if (uCode === 'days' || uCode === 'day') {
        otherLoggedDays += uUtil;
      } else if (uCode === 'hrs' || uCode === 'hr' || uCode === 'ex.hrs') {
        otherLoggedHours += (u.workingHours || uUtil);
      } else if (uUtil <= 1.5 && (primaryUnit.toLowerCase() === 'days' || primaryUnit.toLowerCase() === 'mth')) {
        otherLoggedDays += uUtil;
      } else {
        otherLoggedHours += (u.workingHours || uUtil);
      }
    }

    return {
      id: item.id,
      code: item.code || item.name,
      name: item.name,
      type: item.type || 'Equipment',
      vehicleNo: item.vehicleNo || item.code,
      magaNo: item.magaNo || item.code,
      condition: item.condition || 'DRY',
      primaryUnit,
      availableUnits: item.availableUnits || [primaryUnit],
      activeUnit: primaryUnit,
      startMeter: item.latestMeter || 0,
      endMeter: item.latestMeter || 0,
      startMileage: item.latestMileage || 0,
      endMileage: item.latestMileage || 0,
      totalMileage: 0,
      netHours: 0,
      workingHours: 0,
      idleHours: 0,
      breakdownHours: 0,
      fuelIssuedLiters: 0,
      activitySplits: [],
      activities: [],
      status: 'draft',
      lastSavedAt: new Date().toISOString(),
      // Multi-supervisor sharing & smart handover context
      isSharedToday: otherUsages.length > 0,
      sharedSupervisors: otherSupervisors,
      existingLoggedDays: Number(otherLoggedDays.toFixed(2)),
      existingLoggedHours: Number(otherLoggedHours.toFixed(1)),
      previousFinalMeter: item.latestMeter || 0,
      previousEndMileage: item.latestMileage || 0,
      existingActivities: otherUsages
        .flatMap((u) => (u.activities || []).map((a) => a.code))
        .filter(Boolean),
    };
  },

  // ── 3. Laborers (Admin-Assigned to Supervisor for Date - Single Source of Truth) ──
  getLaborers(_date: string): LaborerEntry[] {
    return [];
  },

  // Real data fetch directly from backend (No localStorage draft overrides)
  async getAssignedEmployees(supervisorId: string, date: string): Promise<LaborerEntry[]> {
    try {
      const [resAssigned, resEntries] = await Promise.all([
        apiFetch(`${API_URL}/time-entries/assigned?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`),
        apiFetch(`${API_URL}/time-entries?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`),
      ]);

      if (resAssigned.ok) {
        const assignedList = await resAssigned.json();
        const timeEntryList = resEntries.ok ? await resEntries.json() : [];

        const laborOnlyList = (assignedList || []).filter((emp: any) => !emp.isOperator && !emp.corporateEmployee?.isOperator);
        const laborList: LaborerEntry[] = laborOnlyList.map((emp: any) => {
          const myEntries = timeEntryList.filter((e: any) => e.employeeId === emp.id);

          const backendInTime = myEntries[0]?.inTime || '';
          const backendOutTime = myEntries[0]?.outTime || '';
          const backendShift = myEntries.reduce((sum: number, e: any) => sum + (Number(e.hours) || 0), 0);
          const backendOt = myEntries.reduce((sum: number, e: any) => sum + (Number(e.overtimeHours) || 0), 0);
          const backendActivities: ActivitySplit[] = myEntries
            .filter((e: any) => e.activity?.code || e.activityId)
            .map((e: any, idx: number) => ({
              id: e.id || `act-${idx}`,
              activityCode: e.activity?.code || '',
              hours: Number(e.hours) || 0,
            }));

          const hasTimes = Boolean(backendInTime || backendOutTime || backendActivities.length > 0);
          const status: 'draft' | 'pending' | 'done' = hasTimes ? 'draft' : 'pending';

          return {
            id: emp.id,
            employeeCode: emp.employeeCode || '',
            callingName: emp.callingName || emp.fullName || '',
            fullName: emp.fullName || '',
            tradeGroup: emp.tradeGroup || 'General labour',
            businessPartner: emp.businessPartner || 'Direct',
            nic: emp.nicNo || '',
            inTime: backendInTime,
            outTime: backendOutTime,
            shiftHours: backendShift,
            otHours: backendOt,
            activities: backendActivities,
            status,
            isAbsent: false,
            claimedBySupervisor: emp.claimedBySupervisor,
            claimedSupervisorId: emp.claimedSupervisorId,
            claimedInTime: emp.claimedInTime,
            claimedOutTime: emp.claimedOutTime,
            claimedHours: emp.claimedHours,
            claimedByMe: emp.claimedByMe,
          };
        });

        return laborList;
      }
    } catch (error) {
      console.warn('Could not fetch assigned laborers from backend:', error);
    }
    return [];
  },

  saveLaborers(_date: string, _laborers: LaborerEntry[]) {
    // In-memory / live API sync is now handled by syncLaborersToBackend
  },

  // ── 4. Operators (Single Source of Truth from Backend) ─────────────────────
  getOperators(_date: string): OperatorEntry[] {
    return [];
  },

  async fetchOperators(supervisorId: string, date: string): Promise<OperatorEntry[]> {
    try {
      const res = await apiFetch(
        `${API_URL}/assignments/operator?date=${encodeURIComponent(date)}&supervisorId=${encodeURIComponent(supervisorId)}`
      );
      if (res.ok) {
        const assignedData = await res.json();
        const mapped: OperatorEntry[] = (assignedData || []).map((asgn: any) => {
          const opId = asgn.operatorId || asgn.id;
          const te = asgn.timeEntry;
          const backendInTime = te?.inTime || '';
          const backendOutTime = te?.outTime || '';
          const backendShift = Number(te?.shiftHours || 0);
          const backendOt = Number(te?.otHours || 0);
          const backendEqId = te?.assignedEquipmentId || asgn.equipmentId || '';
          const backendSplits = (te?.equipmentSplits && te.equipmentSplits.length > 0)
            ? te.equipmentSplits
            : (backendEqId ? [{ id: '1', equipmentId: backendEqId, hours: backendShift }] : []);

          const hasTimes = !!(backendInTime && backendOutTime);
          let status: 'draft' | 'pending' | 'done' = 'pending';
          if (te?.status === 'done' || hasTimes) {
            status = 'done';
          } else if (te?.status) {
            status = te.status;
          } else if (backendInTime || backendSplits.length > 0) {
            status = 'draft';
          }

          return {
            id: opId,
            callingName: asgn.operatorName || asgn.callingName || 'Operator',
            employeeNumber: asgn.operatorCode || asgn.employeeCode || '',
            licenseNo: asgn.licenseNo || '',
            designation: asgn.operatorTrade || 'Machine Operator',
            inTime: backendInTime,
            outTime: backendOutTime,
            shiftHours: backendShift,
            otHours: backendOt,
            assignedEquipmentId: backendEqId,
            equipmentSplits: backendSplits,
            status,
            notes: te?.notes || '',
            claimedBySupervisor: asgn.claimedBySupervisor,
            claimedSupervisorId: asgn.claimedSupervisorId,
            claimedInTime: asgn.claimedInTime,
            claimedOutTime: asgn.claimedOutTime,
            claimedHours: asgn.claimedHours,
            claimedMachineCodes: asgn.claimedMachineCodes,
            claimedByMe: asgn.claimedByMe,
          };
        });
        return mapped;
      }
    } catch (err) {
      console.warn('Backend unavailable for operators:', err);
    }
    return [];
  },

  saveOperators(_date: string, _operators: OperatorEntry[]) {
    // In-memory / live API sync is now handled by syncOperatorsToBackend
  },

  // ── 5. Equipment Logs (Single Source of Truth) ───────────────────────────
  getEquipment(_date: string): EquipmentLogEntry[] {
    return [];
  },

  saveEquipment(_date: string, _equipment: EquipmentLogEntry[]) {
    // In-memory / live API sync is now handled by syncEquipmentToBackend
  },

  // ── 6. Day Lock Status & Server Lifecycle ────────────────────────────────
  isDayLocked(_date: string): boolean {
    return false;
  },

  lockDay(_date: string) {},

  unlockDay(_date: string) {},

  getDayStatus(_date: string): SupervisorDayStatus {
    return {
      status: 'draft',
      isLocked: false,
      submittedAt: null,
      approvedAt: null,
      remarks: null,
    };
  },

  async fetchDayStatus(supervisorId: string, date: string): Promise<SupervisorDayStatus> {
    try {
      const res = await apiFetch(
        `${API_URL}/time-entries/day-status?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`
      );

      if (res.ok) {
        const data = await res.json();
        const serverStatus = data.status || 'draft';
        const isLocked = serverStatus === 'submitted' || serverStatus === 'approved';

        return {
          status: serverStatus,
          isLocked,
          submittedAt: data.submittedAt || null,
          approvedAt: data.approvedAt || null,
          remarks: data.remarks || null,
        };
      }
    } catch (err) {
      console.warn('Could not fetch server day status:', err);
    }

    return {
      status: 'draft',
      isLocked: false,
      submittedAt: null,
      approvedAt: null,
      remarks: null,
    };
  },

  queueOfflineSubmission(_date: string) {},

  clearOfflineSubmission(_date: string) {},

  getQueuedSubmissions(): string[] {
    return [];
  },

  // ── 7. Offline Sync Queue ─────────────────────────────────────────────────
  getPendingSyncCount(): number {
    try {
      return parseInt(localStorage.getItem(SYNC_QUEUE_KEY) || '0', 10);
    } catch {
      return 0;
    }
  },

  incrementPendingSync() {
    const count = this.getPendingSyncCount() + 1;
    localStorage.setItem(SYNC_QUEUE_KEY, count.toString());
  },

  resetPendingSync() {
    localStorage.setItem(SYNC_QUEUE_KEY, '0');
  },

  // ── 7.1 Clear Local Shift Draft Entries ──────────────────────────────────
  clearShiftTimeEntries(date?: string) {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (date) {
          if (k.startsWith(STORAGE_PREFIX) && k.endsWith(`_${date}`)) {
            keysToRemove.push(k);
          }
        } else {
          if (
            k.startsWith(STORAGE_PREFIX) &&
            (/\d{4}-\d{2}-\d{2}$/.test(k) || k === `${STORAGE_PREFIX}offline_submits_queue` || k === 'maga_supervisor_sync_queue')
          ) {
            keysToRemove.push(k);
          }
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      this.resetPendingSync();
    } catch (e) {
      console.warn('Failed to clear shift entries:', e);
    }
  },

  // ── 8. Direct Backend Sync Pipelines (Single Source of Truth) ─────────────
  async syncLaborersToBackend(supervisorId: string, date: string, laborers: LaborerEntry[]): Promise<boolean> {
    try {
      const allActivities = await this.getActivityCodes();
      const defaultActivityId = allActivities[0]?.id;
      const zidleAct = allActivities.find((a) => a.code?.toUpperCase() === 'ZIDLE');
      const zidleId = zidleAct?.id || 'ZIDLE';

      const bulkLaborEntries: Array<{
        employeeId: string;
        activityId: string;
        hours: number;
        inTime?: string;
        outTime?: string;
        remarks?: string;
      }> = [];

      for (const lab of laborers) {
        const totalShift = Number(lab.shiftHours) || 0;
        let sumAssigned = 0;

        if (lab.activities && lab.activities.length > 0) {
          for (const act of lab.activities) {
            const actObj = allActivities.find(
              (a) => a.code?.trim().toLowerCase() === act.activityCode?.trim().toLowerCase() || a.id === act.activityCode
            );
            const resolvedActId = actObj?.id || act.activityCode || defaultActivityId;
            let actHours = Number(act.hours) || 0;

            if (totalShift > 0 && sumAssigned + actHours > totalShift) {
              actHours = Math.max(0, Math.round((totalShift - sumAssigned) * 10) / 10);
            }

            if (resolvedActId && actHours > 0) {
              sumAssigned += actHours;
              bulkLaborEntries.push({
                employeeId: lab.id,
                activityId: resolvedActId,
                hours: actHours,
                inTime: lab.inTime || undefined,
                outTime: lab.outTime || undefined,
              });
            }
          }
        }

        if (totalShift > sumAssigned && zidleId) {
          const idleHours = Math.max(0, Math.round((totalShift - sumAssigned) * 10) / 10);
          if (idleHours > 0) {
            bulkLaborEntries.push({
              employeeId: lab.id,
              activityId: zidleId,
              hours: idleHours,
              inTime: lab.inTime || undefined,
              outTime: lab.outTime || undefined,
              remarks: 'Unallocated shift hours (ZIDLE)',
            });
          }
        } else if (sumAssigned === 0 && (lab.inTime || lab.outTime)) {
          bulkLaborEntries.push({
            employeeId: lab.id,
            activityId: zidleId,
            hours: lab.shiftHours || 0,
            inTime: lab.inTime || undefined,
            outTime: lab.outTime || undefined,
            remarks: 'Unallocated shift hours (ZIDLE)',
          });
        }
      }

      const res = await apiFetch(`${API_URL}/time-entries/labor/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorId,
          date,
          entries: bulkLaborEntries,
          activeEmployeeIds: laborers.map((l) => l.id),
        }),
      });

      return res.ok;
    } catch (err) {
      console.error('Failed to sync laborers to backend:', err);
      return false;
    }
  },

  async syncOperatorsToBackend(supervisorId: string, date: string, operators: OperatorEntry[]): Promise<boolean> {
    try {
      const payloadOps: any[] = [];
      const validOps = (operators || []).filter((o) => o.inTime || o.outTime || (o.equipmentSplits && o.equipmentSplits.length > 0) || o.assignedEquipmentId);

      for (const op of validOps) {
        const shiftH = Number(op.shiftHours) || 0;
        const splits = (op.equipmentSplits && op.equipmentSplits.length > 0)
          ? op.equipmentSplits.filter((s) => s.equipmentId && Number(s.hours) > 0)
          : (op.assignedEquipmentId && op.assignedEquipmentId !== 'ZXQOPRIDLE'
              ? [{ id: '1', equipmentId: op.assignedEquipmentId, hours: shiftH, remarks: '' }]
              : []);

        const sumOperating = splits.reduce((acc, s) => acc + (Number(s.hours) || 0), 0);
        const idleRemainder = Math.max(0, Math.round((shiftH - sumOperating) * 10) / 10);
        const primaryMachineId = splits.length > 0 ? splits[0].equipmentId : (op.assignedEquipmentId || 'ZXQOPRIDLE');

        const noteParts: string[] = [];
        if (op.notes) noteParts.push(op.notes);
        if (splits.length > 1) {
          noteParts.push(`Splits: ${splits.map((s) => `${s.equipmentId}: ${s.hours}h`).join(', ')}`);
        }
        if (idleRemainder > 0 || splits.length === 0) {
          const idleH = splits.length === 0 ? shiftH : idleRemainder;
          noteParts.push(`Exter. Equipment Operator Idle (ZXQOPRIDLE: ${idleH}h)`);
        }

        payloadOps.push({
          operatorId: op.id,
          equipmentId: primaryMachineId,
          assignedEquipmentId: primaryMachineId,
          inTime: op.inTime || undefined,
          outTime: op.outTime || undefined,
          shiftHours: shiftH,
          hours: shiftH,
          otHours: op.otHours || 0,
          overtimeHours: op.otHours || 0,
          notes: noteParts.length > 0 ? noteParts.join(' | ') : undefined,
          status: op.status || 'draft',
          splits,
          equipmentSplits: splits,
        });
      }

      const res = await apiFetch(`${API_URL}/time-entries/operators/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorId,
          date,
          entries: payloadOps,
        }),
      });

      return res.ok;
    } catch (err) {
      console.error('Failed to sync operators to backend:', err);
      return false;
    }
  },

  async syncEquipmentToBackend(supervisorId: string, date: string, equipment: EquipmentLogEntry[]): Promise<boolean> {
    try {
      const payloadEq = (equipment || []).map((eq: any) => {
        const normPrimary = normalizeRatingUnit(eq.primaryUnit);
        const isDayRate = normPrimary === 'Days' || normPrimary === 'mth';
        const defaultQty = isDayRate
          ? (Number(eq.daysValue) || 1)
          : (Number(eq.hoursValue) || Number(eq.workingHours) || Number(eq.netHours) || 0);

        return {
          id: eq.id,
          condition: eq.condition || 'DRY',
          startMeter: Number(eq.startMeter || 0),
          endMeter: Number(eq.endMeter || 0),
          netHours: Number(eq.netHours) || Number(eq.hoursValue) || Number(eq.workingHours) || 0,
          daysValue: eq.daysValue,
          hoursValue: eq.hoursValue,
          workingHours: Number(eq.workingHours) || Number(eq.hoursValue) || Number(eq.netHours) || 0,
          idleHours: Number(eq.idleHours || 0),
          breakdownHours: Number(eq.breakdownHours || 0),
          fuelIssuedLiters: Number(eq.fuelIssuedLiters || 0),
          totalMileage: Number(eq.totalMileage || 0),
          startMileage: Number(eq.startMileage || 0),
          endMileage: Number(eq.endMileage || 0),
          totalUtilization: defaultQty,
          remarks: eq.remarks,
          status: eq.status || 'draft',
          activityCode: eq.activityCode || 'ZOTHE',
          activitySplits: eq.activitySplits && eq.activitySplits.length > 0
            ? eq.activitySplits.map((s: any) => ({ ...s, activityCode: s.activityCode || 'ZOTHE', unit: normalizeRatingUnit(s.unit) }))
            : [{ activityCode: eq.activityCode || 'ZOTHE', unit: normPrimary, utilization: defaultQty }],
        };
      });

      const res = await apiFetch(`${API_URL}/time-entries/equipment/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supervisorId,
          date,
          entries: payloadEq,
        }),
      });

      return res.ok;
    } catch (err) {
      console.error('Failed to sync equipment to backend:', err);
      return false;
    }
  },

  async syncToBackend(
    supervisorId: string,
    date: string,
    laborers: LaborerEntry[] = [],
    operators: OperatorEntry[] = [],
    equipment: EquipmentLogEntry[] = []
  ): Promise<boolean> {
    const tasks: Promise<boolean>[] = [];
    if (laborers.length > 0) tasks.push(this.syncLaborersToBackend(supervisorId, date, laborers));
    if (operators.length > 0) tasks.push(this.syncOperatorsToBackend(supervisorId, date, operators));
    if (equipment.length > 0) tasks.push(this.syncEquipmentToBackend(supervisorId, date, equipment));
    if (tasks.length === 0) return true;
    const results = await Promise.all(tasks);
    this.resetPendingSync();
    return results.every(Boolean);
  },

  // ── 9. Submit & Lock Day on Backend ──────────────────────────────────────
  async submitDayToBackend(
    supervisorId: string,
    date: string,
    laborers: LaborerEntry[] = [],
    operators: OperatorEntry[] = [],
    equipment: EquipmentLogEntry[] = []
  ): Promise<{ success: boolean; offline: boolean; message?: string }> {
    try {
      // 1. Sync current state to backend first
      await this.syncToBackend(supervisorId, date, laborers, operators, equipment);

      // 2. Submit day on backend
      const res = await apiFetch(`${API_URL}/time-entries/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId, date }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to submit and lock day on backend');
      }

      this.resetPendingSync();
      return { success: true, offline: false };
    } catch (err: any) {
      console.error('Submit error:', err);
      throw err;
    }
  },

  async flushQueuedSubmissions(_supervisorId: string): Promise<string[]> {
    return [];
  },

  /**
   * Fetch recent past gangs for a supervisor across the past N working days before currentDate.
   * Scans local drafts first, falls back to backend /time-entries/assigned.
   */
  async getPastGangsForSupervisor(
    supervisorId: string,
    currentDate: string,
    daysCount: number = 5
  ): Promise<Array<{ date: string; dayName: string; workerIds: string[]; workerCount: number }>> {
    const results: Array<{ date: string; dayName: string; workerIds: string[]; workerCount: number }> = [];
    if (!currentDate) return results;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const shiftDateStr = (dateStr: string, days: number): string => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() + days);
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    };

    for (let i = 1; i <= daysCount; i++) {
      const pastDate = shiftDateStr(currentDate, -i);
      const [y, m, d] = pastDate.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dayName = dayNames[dt.getUTCDay()];

      // 1. Try local storage
      const localWorkers = this.getLaborers(pastDate);
      if (localWorkers && localWorkers.length > 0) {
        results.push({
          date: pastDate,
          dayName,
          workerIds: localWorkers.map((w) => w.id),
          workerCount: localWorkers.length,
        });
        continue;
      }

      // 2. Try backend
      if (supervisorId) {
        try {
          const res = await apiFetch(`${API_URL}/time-entries/assigned?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(pastDate)}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              results.push({
                date: pastDate,
                dayName,
                workerIds: data.map((emp: any) => emp.id),
                workerCount: data.length,
              });
            }
          }
        } catch {
          // ignore network hiccups
        }
      }
    }

    return results;
  },

  /**
   * Fetch recent past operators for a supervisor across the past N working days before currentDate.
   * Scans local drafts first, falls back to backend /assignments/operator.
   */
  async getPastOperatorsForSupervisor(
    supervisorId: string,
    currentDate: string,
    daysCount: number = 5
  ): Promise<Array<{ date: string; dayName: string; operatorIds: string[]; operatorCount: number; operators: OperatorEntry[] }>> {
    const results: Array<{ date: string; dayName: string; operatorIds: string[]; operatorCount: number; operators: OperatorEntry[] }> = [];
    if (!currentDate) return results;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    const shiftDateStr = (dateStr: string, days: number): string => {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      dt.setUTCDate(dt.getUTCDate() + days);
      return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
    };

    for (let i = 1; i <= daysCount; i++) {
      const pastDate = shiftDateStr(currentDate, -i);
      const [y, m, d] = pastDate.split('-').map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      const dayName = dayNames[dt.getUTCDay()];

      // 1. Try local storage
      const localOperators = this.getOperators(pastDate);
      if (localOperators && localOperators.length > 0) {
        results.push({
          date: pastDate,
          dayName,
          operatorIds: localOperators.map((o) => o.id),
          operatorCount: localOperators.length,
          operators: localOperators,
        });
        continue;
      }

      // 2. Try backend
      if (supervisorId) {
        try {
          const res = await apiFetch(`${API_URL}/assignments/operator?date=${encodeURIComponent(pastDate)}&supervisorId=${encodeURIComponent(supervisorId)}`);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              const mapped: OperatorEntry[] = data.map((asgn: any) => ({
                id: asgn.operatorId || asgn.id,
                callingName: asgn.operatorName || asgn.callingName || 'Operator',
                employeeNumber: asgn.operatorCode || asgn.employeeCode || '',
                licenseNo: asgn.licenseNo || '',
                designation: asgn.operatorTrade || 'Machine Operator',
                inTime: '',
                outTime: '',
                shiftHours: 0,
                otHours: 0,
                assignedEquipmentId: asgn.equipmentId || '',
                equipmentSplits: asgn.equipmentId ? [{ id: '1', equipmentId: asgn.equipmentId, hours: 0 }] : [],
                status: 'pending',
              }));
              results.push({
                date: pastDate,
                dayName,
                operatorIds: mapped.map((o) => o.id),
                operatorCount: mapped.length,
                operators: mapped,
              });
            }
          }
        } catch {
          // ignore network hiccups
        }
      }
    }

    return results;
  },
};
