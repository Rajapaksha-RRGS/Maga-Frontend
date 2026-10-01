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
  lastSavedAt?: string;
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
}

export type EquipmentRatingUnit = 'Days' | 'Hrs' | 'EX.hrs' | 'mth' | 'm2' | 'km';

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

    try {
      // 1. Fetch tenant/project activity codes from backend
      const queryParam = siteCode ? `?projectCode=${encodeURIComponent(siteCode)}` : '';
      const res = await apiFetch(`${API_URL}/activity-codes${queryParam}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          // Validate: only accept activity codes belonging to our own project (or unassigned/global)
          const validCodes = data.filter((d: any) => {
            if (!d.projectCode || !siteCode) return true;
            return d.projectCode.trim().toLowerCase() === siteCode.trim().toLowerCase();
          });

          if (validCodes.length > 0) {
            const mapped: ActivityCodeItem[] = validCodes.map((d: any) => ({
              id: d.id,
              code: d.code,
              name: d.description || d.code,
              trade: d.trade || '',
              category: d.category || '',
              projectCode: d.projectCode || siteCode,
            }));
            localStorage.setItem(key, JSON.stringify(mapped));
            return mapped;
          }
        }
      }

      // 2. If tenant doesn't have codes for this project yet, query Corporate ERP Catalog by projectCode
      if (siteCode) {
        const corpRes = await apiFetch(`${API_URL}/activity-codes/corporate-master?projectCode=${encodeURIComponent(siteCode)}`);
        if (corpRes.ok) {
          const corpData = await corpRes.json();
          if (Array.isArray(corpData) && corpData.length > 0) {
            // Validate: strictly ensure each code belongs to our project
            const validCorp = corpData.filter((d: any) => {
              const pCode = d.projectCode || d.currentWorkingProject;
              return !pCode || pCode.trim().toLowerCase() === siteCode.trim().toLowerCase();
            });

            if (validCorp.length > 0) {
              const mapped: ActivityCodeItem[] = validCorp.map((d: any) => ({
                id: d.id,
                code: d.code,
                name: d.description || d.code,
                trade: d.tradeGroup || '',
                category: d.activityType || 'Civil',
                projectCode: d.projectCode || siteCode,
              }));
              localStorage.setItem(key, JSON.stringify(mapped));
              return mapped;
            }
          }
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using cached activities:', err);
    }

    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Validate cached items against current site code
          const validated = parsed.filter((item: ActivityCodeItem) => {
            if (!item.projectCode || !siteCode) return true;
            return item.projectCode.trim().toLowerCase() === siteCode.trim().toLowerCase();
          });
          if (validated.length > 0) return validated;
        }
      } catch {}
    }
    return [];
  },

  async resolveActivityByCode(code: string): Promise<ActivityCodeItem | undefined> {
    const list = await this.getActivityCodes();
    return list.find((a) => a.code === code);
  },

  // ── 2. Master Equipment (Backend + Offline Cache) ──────────────────────────
  async fetchEquipment(supervisorId?: string, date?: string): Promise<EquipmentLogEntry[]> {
    const key = date ? `${STORAGE_PREFIX}equipment_${date}` : `${STORAGE_PREFIX}equipment_master`;
    try {
      if (supervisorId && date) {
        // Fetch only equipment assigned to this supervisor on this date
        const res = await apiFetch(
          `${API_URL}/assignments/equipment?date=${encodeURIComponent(date)}&supervisorId=${encodeURIComponent(supervisorId)}`
        );
        if (res.ok) {
          const assignedData = await res.json();
          const existingLocal = this.getEquipment(date);
          const localMap = new Map<string, EquipmentLogEntry>(existingLocal.map((e) => [e.id, e]));

          const mapped: EquipmentLogEntry[] = (assignedData || []).map((asgn: any) => {
            const existing = localMap.get(asgn.equipmentId) || localMap.get(asgn.id);
            // Determine the list of units this equipment supports from DB
            const ALL_UNITS: EquipmentRatingUnit[] = ['Hrs', 'Days', 'EX.hrs', 'mth', 'm2'];
            const dbPrimaryUnit: EquipmentRatingUnit = (asgn.primaryUnit as EquipmentRatingUnit) || 'mth';
            // DB `availableUnits` stores ADDITIONAL units (not including primary by convention)
            // If empty → show all 5; otherwise: primary + additional
            const dbAvailableUnits: EquipmentRatingUnit[] =
              Array.isArray(asgn.availableUnits) && asgn.availableUnits.length > 0
                ? [dbPrimaryUnit, ...asgn.availableUnits.filter((u: string) => u !== dbPrimaryUnit)] as EquipmentRatingUnit[]
                : ALL_UNITS; // empty = all units shown
            // Prefer supervisor's already-chosen unit (local draft) over DB default
            const resolvedActiveUnit: EquipmentRatingUnit = existing?.activeUnit ?? dbPrimaryUnit;
            // Backend dailyLog (returned after previous sync) used as fallback when there is no local draft
            const log = asgn.dailyLog;
            return {
              id: asgn.equipmentId,
              code: asgn.equipmentCode || asgn.equipmentName,
              name: asgn.equipmentName,
              type: asgn.equipmentType || 'Equipment',
              vehicleNo: asgn.vehicleNo || asgn.equipmentCode,
              magaNo: asgn.magaNo || asgn.equipmentCode,
              condition: existing?.condition ?? (asgn.condition as 'DRY' | 'WET' | undefined) ?? 'DRY',
              primaryUnit: dbPrimaryUnit,
              availableUnits: dbAvailableUnits,
              activeUnit: resolvedActiveUnit,
              additionalUnit: existing?.additionalUnit ?? null,
              // Local draft takes priority; fallback to backend dailyLog if no local draft
              daysValue: existing?.daysValue ?? log?.daysValue,
              hoursValue: existing?.hoursValue ?? log?.hoursValue,
              extraHoursValue: existing?.extraHoursValue,
              areaValue: existing?.areaValue,
              startMeter: existing?.startMeter ?? log?.startMeter ?? 0,
              endMeter: existing?.endMeter ?? log?.endMeter ?? 0,
              netHours: existing?.netHours ?? log?.netHours ?? 0,
              workingHours: existing?.workingHours ?? log?.workingHours ?? 0,
              idleHours: existing?.idleHours ?? log?.idleHours ?? 0,
              breakdownHours: existing?.breakdownHours ?? log?.breakdownHours ?? 0,
              fuelIssuedLiters: existing?.fuelIssuedLiters ?? log?.fuelIssuedLiters ?? 0,
              totalMileage: existing?.totalMileage ?? log?.totalMileage ?? 0,
              startMileage: existing?.startMileage ?? log?.startMileage ?? 0,
              endMileage: existing?.endMileage ?? log?.endMileage ?? 0,
              operatorId: existing?.operatorId,
              activityCode: existing?.activityCode,
              // ✅ Local draft splits first, then backend saved splits, then empty
              activitySplits: (existing?.activitySplits && existing.activitySplits.length > 0)
                ? existing.activitySplits
                : (log?.activitySplits ?? []),
              activities: existing?.activities ?? [],
              remarks: existing?.remarks ?? log?.remarks,
              status: (log?.status === 'submitted' || log?.status === 'approved')
                ? log.status
                : (existing?.status === 'submitted' ? 'draft' : (existing?.status ?? log?.status ?? 'pending')),
              lastSavedAt: existing?.lastSavedAt,
            };
          });

          localStorage.setItem(key, JSON.stringify(mapped));
          return mapped;
        }
      } else {
        const res = await apiFetch(`${API_URL}/equipment`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            const mapped: EquipmentLogEntry[] = data.map((eq: any) => ({
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
            localStorage.setItem(key, JSON.stringify(mapped));
            return mapped;
          }
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using cached equipment:', err);
    }
    return date ? this.getEquipment(date) : (localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)!) : []);
  },

  // ── 3. Laborers (Admin-Assigned to Supervisor for Date) ────────────────────
  // Instant synchronous read from localStorage cache for offline render
  getLaborers(date: string): LaborerEntry[] {
    const key = `${STORAGE_PREFIX}labor_${date}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  },

  // Real data fetch from backend with reconciliation and offline cache
  async getAssignedEmployees(supervisorId: string, date: string): Promise<LaborerEntry[]> {
    const key = `${STORAGE_PREFIX}labor_${date}`;

    try {
      // Fetch assigned workers (admin assigned) and existing recorded entries concurrently
      const [resAssigned, resEntries] = await Promise.all([
        apiFetch(`${API_URL}/time-entries/assigned?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`),
        apiFetch(`${API_URL}/time-entries?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`),
      ]);

      if (resAssigned.ok) {
        console.log("Assigned workers:", resAssigned);
        const assignedList = await resAssigned.json();
        const timeEntryList = resEntries.ok ? await resEntries.json() : [];
        console.log("Time entry list:", timeEntryList);
        // Check if entries for this day are already submitted or approved
        const isSubmitted = timeEntryList.some((t: any) => t.status === 'submitted' || t.status === 'approved');

        // Existing local drafts map for smart reconciliation
        const existingLocal = this.getLaborers(date);
        const localMap = new Map<string, LaborerEntry>(existingLocal.map((l) => [l.id, l]));

        // Map assigned workers with attendance, hours, and activity splits
        const laborList: LaborerEntry[] = (assignedList || []).map((emp: any) => {
          const myEntries = timeEntryList.filter((e: any) => e.employeeId === emp.id);
          const localDraft = localMap.get(emp.id);

          const hasBackendEntries = myEntries.length > 0 && (myEntries[0].inTime || myEntries[0].outTime || myEntries[0].hours > 0);

          // Priority rule:
          // If backend has submitted/approved records OR recorded time entries, prioritize backend.
          // If backend has no recorded entries for this worker, preserve the supervisor's local draft.
          const inTime = (isSubmitted || hasBackendEntries)
            ? (myEntries[0]?.inTime || '')
            : (localDraft?.inTime || '');

          const outTime = (isSubmitted || hasBackendEntries)
            ? (myEntries[0]?.outTime || '')
            : (localDraft?.outTime || '');

          const shiftHours = (isSubmitted || hasBackendEntries)
            ? myEntries.reduce((sum: number, e: any) => sum + (Number(e.hours) || 0), 0)
            : (localDraft?.shiftHours || 0);

          const otHours = (isSubmitted || hasBackendEntries)
            ? myEntries.reduce((sum: number, e: any) => sum + (Number(e.overtimeHours) || 0), 0)
            : (localDraft?.otHours || 0);

          let activities: ActivitySplit[] = [];
          if (isSubmitted || hasBackendEntries) {
            activities = myEntries
              .filter((e: any) => e.activity?.code || e.activityId)
              .map((e: any, idx: number) => ({
                id: e.id || `act-${idx}`,
                activityCode: e.activity?.code || '',
                hours: Number(e.hours) || 0,
              }));
          } else {
            activities = localDraft?.activities || [];
          }

          let status: 'draft' | 'pending' | 'done' = 'pending';
          if (isSubmitted) {
            status = 'done';
          } else if (inTime && outTime) {
            status = myEntries.some((e: any) => e.status === 'draft') ? 'draft' : (localDraft?.status || 'done');
          } else if (inTime || outTime) {
            status = 'draft';
          }

          return {
            id: emp.id,
            employeeCode: emp.employeeCode || '',
            callingName: emp.callingName || emp.fullName || '',
            tradeGroup: emp.tradeGroup || 'General labour',
            businessPartner: emp.businessPartner || 'Direct',
            nic: emp.nicNo || '',
            inTime,
            outTime,
            shiftHours,
            otHours,
            activities,
            status,
            lastSavedAt: localDraft?.lastSavedAt,
          };
        });

        // Cache safe reconciled data in localStorage
        localStorage.setItem(key, JSON.stringify(laborList));
        return laborList;
      }
    } catch (error) {
      console.warn('Backend unavailable, using cached laborers:', error);
    }

    // Fallback to local cache when offline or if request fails
    return this.getLaborers(date);
  },

  saveLaborers(date: string, laborers: LaborerEntry[]) {
    const key = `${STORAGE_PREFIX}labor_${date}`;
    localStorage.setItem(key, JSON.stringify(laborers));
    this.incrementPendingSync();
  },

  // ── 4. Operators ──────────────────────────────────────────────────────────
  getOperators(date: string): OperatorEntry[] {
    const key = `${STORAGE_PREFIX}operators_${date}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  },

  async fetchOperators(supervisorId: string, date: string): Promise<OperatorEntry[]> {
    const key = `${STORAGE_PREFIX}operators_${date}`;
    try {
      const res = await apiFetch(
        `${API_URL}/assignments/operator?date=${encodeURIComponent(date)}&supervisorId=${encodeURIComponent(supervisorId)}`
      );
      if (res.ok) {
        const assignedData = await res.json();
        const existingLocal = this.getOperators(date);
        const localMap = new Map<string, OperatorEntry>(existingLocal.map((o) => [o.id, o]));

        const mapped: OperatorEntry[] = (assignedData || []).map((asgn: any) => {
          const opId = asgn.operatorId || asgn.id;
          const existing = localMap.get(opId);
          const te = asgn.timeEntry;
          return {
            id: opId,
            callingName: asgn.operatorName || asgn.callingName || 'Operator',
            employeeNumber: asgn.operatorCode || asgn.employeeCode || '',
            licenseNo: asgn.licenseNo || '',
            designation: asgn.operatorTrade || 'Machine Operator',
            inTime: existing?.inTime || te?.inTime || '',
            outTime: existing?.outTime || te?.outTime || '',
            shiftHours: existing?.shiftHours !== undefined && existing?.shiftHours > 0 ? existing.shiftHours : (te?.shiftHours || 0),
            otHours: existing?.otHours !== undefined && existing?.otHours > 0 ? existing.otHours : (te?.otHours || 0),
            assignedEquipmentId: existing?.assignedEquipmentId || te?.assignedEquipmentId || '',
            equipmentSplits: existing?.equipmentSplits || (existing?.assignedEquipmentId ? [{ id: '1', equipmentId: existing.assignedEquipmentId, hours: existing.shiftHours || 0 }] : (te?.assignedEquipmentId ? [{ id: '1', equipmentId: te.assignedEquipmentId, hours: te.shiftHours || 0 }] : [])),
            status: (te?.status === 'submitted' || te?.status === 'approved')
              ? te.status
              : (existing?.status === 'submitted' ? 'draft' : (existing?.status || te?.status || 'pending')),
            notes: existing?.notes || te?.notes || '',
          };
        });
        localStorage.setItem(key, JSON.stringify(mapped));
        return mapped;
      }
    } catch (err) {
      console.warn('Backend unavailable for operators, using cache:', err);
    }
    return this.getOperators(date);
  },

  saveOperators(date: string, operators: OperatorEntry[]) {
    const key = `${STORAGE_PREFIX}operators_${date}`;
    localStorage.setItem(key, JSON.stringify(operators));
    this.incrementPendingSync();
  },

  // ── 5. Equipment Logs ─────────────────────────────────────────────────────
  getEquipment(date: string): EquipmentLogEntry[] {
    const key = `${STORAGE_PREFIX}equipment_${date}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  },

  saveEquipment(date: string, equipment: EquipmentLogEntry[]) {
    const key = `${STORAGE_PREFIX}equipment_${date}`;
    localStorage.setItem(key, JSON.stringify(equipment));
    this.incrementPendingSync();
  },

  // ── 6. Day Lock Status & Server Lifecycle ────────────────────────────────
  isDayLocked(date: string): boolean {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    const pendingKey = `${STORAGE_PREFIX}pending_submit_${date}`;
    return localStorage.getItem(key) === 'true' || localStorage.getItem(pendingKey) === 'true';
  },

  lockDay(date: string) {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    localStorage.setItem(key, 'true');
  },

  unlockDay(date: string) {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    const pendingKey = `${STORAGE_PREFIX}pending_submit_${date}`;
    localStorage.removeItem(key);
    localStorage.removeItem(pendingKey);
    localStorage.removeItem(`${STORAGE_PREFIX}status_${date}`);
  },

  getDayStatus(date: string): SupervisorDayStatus {
    const pendingKey = `${STORAGE_PREFIX}pending_submit_${date}`;
    if (localStorage.getItem(pendingKey) === 'true') {
      return {
        status: 'pending_submit',
        isLocked: true,
        submittedAt: null,
        approvedAt: null,
        remarks: null,
      };
    }

    const serverStatus = localStorage.getItem(`${STORAGE_PREFIX}status_${date}`) as any;
    const isLocked = this.isDayLocked(date);
    const remarks = localStorage.getItem(`${STORAGE_PREFIX}remarks_${date}`);

    return {
      status: serverStatus || (isLocked ? 'submitted' : 'draft'),
      isLocked,
      submittedAt: localStorage.getItem(`${STORAGE_PREFIX}submitted_at_${date}`),
      approvedAt: localStorage.getItem(`${STORAGE_PREFIX}approved_at_${date}`),
      remarks: remarks || null,
    };
  },

  async fetchDayStatus(supervisorId: string, date: string): Promise<SupervisorDayStatus> {
    const pendingKey = `${STORAGE_PREFIX}pending_submit_${date}`;
    const isPendingOffline = localStorage.getItem(pendingKey) === 'true';

    try {
      const res = await apiFetch(
        `${API_URL}/time-entries/day-status?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`
      );

      if (res.ok) {
        const data = await res.json();
        const serverStatus = data.status || 'draft';

        localStorage.setItem(`${STORAGE_PREFIX}status_${date}`, serverStatus);
        if (data.remarks) {
          localStorage.setItem(`${STORAGE_PREFIX}remarks_${date}`, data.remarks);
        } else {
          localStorage.removeItem(`${STORAGE_PREFIX}remarks_${date}`);
        }
        if (data.submittedAt) {
          localStorage.setItem(`${STORAGE_PREFIX}submitted_at_${date}`, data.submittedAt);
        }
        if (data.approvedAt) {
          localStorage.setItem(`${STORAGE_PREFIX}approved_at_${date}`, data.approvedAt);
        }

        if (serverStatus === 'submitted' || serverStatus === 'approved') {
          this.lockDay(date);
          localStorage.removeItem(pendingKey);
        } else if (serverStatus === 'draft') {
          if (!isPendingOffline) {
            localStorage.removeItem(`${STORAGE_PREFIX}locked_${date}`);
          }
        }

        return {
          status: isPendingOffline ? 'pending_submit' : serverStatus,
          isLocked: isPendingOffline || serverStatus === 'submitted' || serverStatus === 'approved',
          submittedAt: data.submittedAt || null,
          approvedAt: data.approvedAt || null,
          remarks: data.remarks || null,
        };
      }
    } catch (err) {
      console.warn('Could not fetch server day status, using cached status:', err);
    }

    return this.getDayStatus(date);
  },

  queueOfflineSubmission(date: string) {
    const pendingKey = `${STORAGE_PREFIX}pending_submit_${date}`;
    localStorage.setItem(pendingKey, 'true');
    this.lockDay(date);

    try {
      const queueKey = `${STORAGE_PREFIX}offline_submits_queue`;
      const currentQueue: string[] = JSON.parse(localStorage.getItem(queueKey) || '[]');
      if (!currentQueue.includes(date)) {
        currentQueue.push(date);
        localStorage.setItem(queueKey, JSON.stringify(currentQueue));
      }
    } catch {
      // ignore
    }
  },

  clearOfflineSubmission(date: string) {
    const pendingKey = `${STORAGE_PREFIX}pending_submit_${date}`;
    localStorage.removeItem(pendingKey);

    try {
      const queueKey = `${STORAGE_PREFIX}offline_submits_queue`;
      let currentQueue: string[] = JSON.parse(localStorage.getItem(queueKey) || '[]');
      currentQueue = currentQueue.filter((d) => d !== date);
      localStorage.setItem(queueKey, JSON.stringify(currentQueue));
    } catch {
      // ignore
    }
  },

  getQueuedSubmissions(): string[] {
    try {
      const queueKey = `${STORAGE_PREFIX}offline_submits_queue`;
      return JSON.parse(localStorage.getItem(queueKey) || '[]');
    } catch {
      return [];
    }
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

  // ── 8. Sync Pending Drafts to Backend ──────────────────────────────────────
  async syncToBackend(supervisorId: string, date: string): Promise<boolean> {
    const laborers = this.getLaborers(date);
    const operators = this.getOperators(date);
    const equipment = this.getEquipment(date);

    try {
      // Pre-fetch all real tenant activity codes once
      const allActivities = await this.getActivityCodes();
      const defaultActivityId = allActivities[0]?.id;
      const zidleAct = allActivities.find((a) => a.code === 'ZIDLE');
      const zidleId = zidleAct?.id || defaultActivityId;

      // 1. Sync Laborers attendance and activity splits with ZIDLE auto-balance
      for (const lab of laborers) {
        const totalShift = Number(lab.shiftHours) || 0;
        let sumAssigned = 0;

        if (lab.activities && lab.activities.length > 0) {
          for (const act of lab.activities) {
            const actObj = allActivities.find((a) => a.code === act.activityCode);
            const resolvedActId = actObj?.id || defaultActivityId;
            const actHours = Number(act.hours) || 0;
            sumAssigned += actHours;

            if (resolvedActId && actHours > 0) {
              await apiFetch(`${API_URL}/time-entries/upsert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  employeeId: lab.id,
                  supervisorId,
                  date,
                  activityId: resolvedActId,
                  hours: actHours,
                  inTime: lab.inTime || undefined,
                  outTime: lab.outTime || undefined,
                }),
              });
            }
          }
        }

        // Auto-balance remaining shortage to ZIDLE
        if (totalShift > sumAssigned && zidleId) {
          const idleHours = Math.max(0, Math.round((totalShift - sumAssigned) * 10) / 10);
          if (idleHours > 0) {
            await apiFetch(`${API_URL}/time-entries/upsert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: lab.id,
                supervisorId,
                date,
                activityId: zidleId,
                hours: idleHours,
                inTime: lab.inTime || undefined,
                outTime: lab.outTime || undefined,
                remarks: 'Unallocated shift hours (ZIDLE)',
              }),
            });
          }
        } else if (sumAssigned === 0 && (lab.inTime || lab.outTime)) {
          if (defaultActivityId) {
            await apiFetch(`${API_URL}/time-entries/upsert`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: lab.id,
                supervisorId,
                date,
                activityId: zidleId || defaultActivityId,
                hours: lab.shiftHours || 0,
                inTime: lab.inTime || undefined,
                outTime: lab.outTime || undefined,
              }),
            });
          }
        }
      }

      // 2. Sync Operators with Multi-Machine splits & ZXQOPRIDLE auto-balance
      if (operators.length > 0) {
        const validOps = operators.filter((o) => o.inTime || o.outTime || (o.equipmentSplits && o.equipmentSplits.length > 0) || o.assignedEquipmentId);
        if (validOps.length > 0) {
          const payloadEntries = validOps.map((op) => {
            const shiftH = Number(op.shiftHours) || 0;
            const splits = (op.equipmentSplits && op.equipmentSplits.length > 0)
              ? op.equipmentSplits.filter((s) => s.equipmentId && Number(s.hours) > 0)
              : (op.assignedEquipmentId && op.assignedEquipmentId !== 'ZXQOPRIDLE'
                  ? [{ id: '1', equipmentId: op.assignedEquipmentId, hours: shiftH, remarks: '' }]
                  : []);

            const sumOperating = splits.reduce((acc, s) => acc + (Number(s.hours) || 0), 0);
            const idleRemainder = Math.max(0, Math.round((shiftH - sumOperating) * 10) / 10);

            // Primary machine is the first real equipment split, or op.assignedEquipmentId, or 'ZXQOPRIDLE'
            const primaryMachineId = splits.length > 0 ? splits[0].equipmentId : (op.assignedEquipmentId || 'ZXQOPRIDLE');

            // Build detailed remarks/notes
            const noteParts: string[] = [];
            if (op.notes) noteParts.push(op.notes);
            if (splits.length > 1) {
              noteParts.push(`Splits: ${splits.map((s) => `${s.equipmentId}: ${s.hours}h`).join(', ')}`);
            }
            if (idleRemainder > 0 || splits.length === 0) {
              const idleH = splits.length === 0 ? shiftH : idleRemainder;
              noteParts.push(`Exter. Equipment Operator Idle (ZXQOPRIDLE: ${idleH}h)`);
            }

            return {
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
            };
          });

          await apiFetch(`${API_URL}/time-entries/operators/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supervisorId,
              date,
              entries: payloadEntries,
            }),
          });
        }
      }

      // 3. Sync Equipment with default activity code ZOTHE
      if (equipment.length > 0) {
        const validEq = equipment.filter((e: any) => (e.netHours && e.netHours > 0) || (e.daysValue && e.daysValue > 0) || (e.hoursValue && e.hoursValue > 0) || (e.totalMileage && e.totalMileage > 0) || e.startMeter > 0);
        if (validEq.length > 0) {
          await apiFetch(`${API_URL}/time-entries/equipment/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supervisorId,
              date,
              entries: validEq.map((eq: any) => ({
                id: eq.id,
                condition: eq.condition || 'DRY',
                startMeter: eq.startMeter || 0,
                endMeter: eq.endMeter || 0,
                netHours: eq.netHours || 0,
                daysValue: eq.daysValue,
                hoursValue: eq.hoursValue,
                workingHours: eq.workingHours || 0,
                idleHours: eq.idleHours || 0,
                breakdownHours: eq.breakdownHours || 0,
                fuelLiters: eq.fuelIssuedLiters || 0,
                totalMileage: eq.totalMileage || 0,
                startMileage: eq.startMileage || 0,
                endMileage: eq.endMileage || 0,
                totalUtilization: eq.totalUtilization,
                remarks: eq.remarks,
                status: eq.status,
                activityCode: eq.activityCode || 'ZOTHE',
                activitySplits: eq.activitySplits && eq.activitySplits.length > 0
                  ? eq.activitySplits.map((s: any) => ({ ...s, activityCode: s.activityCode || 'ZOTHE' }))
                  : [{ activityCode: eq.activityCode || 'ZOTHE', unit: eq.primaryUnit || 'Hrs', utilization: eq.workingHours || eq.netHours || eq.hoursValue || 0 }],
              })),
            }),
          });
        }
      }

      this.resetPendingSync();
      return true;
    } catch (err) {
      console.error('Failed to sync to backend:', err);
      throw err;
    }
  },

  // ── 9. Submit & Lock Day on Backend (Offline-First Resilient) ─────────────
  async submitDayToBackend(
    supervisorId: string,
    date: string
  ): Promise<{ success: boolean; offline: boolean; message?: string }> {
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

    if (!isOnline) {
      this.queueOfflineSubmission(date);
      return {
        success: true,
        offline: true,
        message: 'Network offline: Shift roster locked locally and queued. It will automatically submit once internet is connected.',
      };
    }

    try {
      // 1. Sync all pending drafts first
      await this.syncToBackend(supervisorId, date);

      // 2. Call submit endpoint on backend
      const res = await apiFetch(`${API_URL}/time-entries/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId, date }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to submit and lock day on backend');
      }

      // 3. Mark submitted permanently
      this.clearOfflineSubmission(date);
      this.lockDay(date);
      localStorage.setItem(`${STORAGE_PREFIX}status_${date}`, 'submitted');
      localStorage.removeItem(`${STORAGE_PREFIX}remarks_${date}`);
      this.resetPendingSync();

      return { success: true, offline: false };
    } catch (err: any) {
      const msg = err?.message || '';
      const isNetworkError =
        err?.name === 'TypeError' ||
        msg.includes('Failed to fetch') ||
        msg.includes('Network') ||
        msg.includes('aborted') ||
        !navigator.onLine;

      if (isNetworkError) {
        this.queueOfflineSubmission(date);
        return {
          success: true,
          offline: true,
          message: 'Connection dropped during submission. Roster saved safely and queued to auto-submit when reconnected.',
        };
      }

      // Validation or server error (e.g. incomplete check in/out) - throw so user sees and fixes it
      throw err;
    }
  },

  async flushQueuedSubmissions(supervisorId: string): Promise<string[]> {
    const queuedDates = this.getQueuedSubmissions();
    const successful: string[] = [];

    for (const date of queuedDates) {
      try {
        const result = await this.submitDayToBackend(supervisorId, date);
        if (!result.offline) {
          successful.push(date);
        }
      } catch (err) {
        console.warn(`Could not flush queued submit for ${date}:`, err);
      }
    }

    return successful;
  },
};
