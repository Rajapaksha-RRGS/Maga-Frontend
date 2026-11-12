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

import { apiFetch, API_URL, getCurrentTenantId } from "../../../config/api";
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
  breakHours?: number;
  isLunchDeducted?: boolean;
  isDinnerDeducted?: boolean;
  additionalHours?: number;
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
  breakHours?: number;
  isLunchDeducted?: boolean;
  isDinnerDeducted?: boolean;
  additionalHours?: number;
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

// ─── Dynamic Initial Active Site (Pure DB & Session-backed) ───────────────────

export function getInitialActiveSite(): SiteProject {
  const tenantId = getCurrentTenantId();
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem('les_auth_user');
      if (raw) {
        const u = JSON.parse(raw);
        return {
          id: u.tenantId || tenantId || '',
          name: u.projectName || u.companyName || 'Loading Site...',
          code: u.projectCode || u.subdomain || 'SITE',
          location: '',
          projectManager: '',
        };
      }
    } catch {
      // Ignore
    }
  }
  return {
    id: tenantId || '',
    name: 'Loading Site...',
    code: 'SITE',
    location: '',
    projectManager: '',
  };
}

export const DEFAULT_SITE: SiteProject = getInitialActiveSite();

// In-memory active site and session cache (100% Database-backed - No localStorage)
let currentActiveSite: SiteProject = getInitialActiveSite();
let currentAvailableSites: SiteProject[] = [currentActiveSite];
let inMemoryActivityCodes: ActivityCodeItem[] | null = null;

export const supervisorStorage = {
  getAvailableSites(): SiteProject[] {
    return currentAvailableSites;
  },

  async fetchActiveSite(userId?: string, tenantId?: string): Promise<SiteProject> {
    try {
      const activeTenant = tenantId || currentActiveSite.id || getCurrentTenantId();
      const params = new URLSearchParams();
      if (userId) params.append('supervisorId', userId);
      if (activeTenant) params.append('tenantId', activeTenant);
      const query = params.toString() ? ('?' + params.toString()) : '';

      const res = await apiFetch(`${API_URL}/supervisors/active-site${query}`);
      if (res.ok) {
        const data = await res.json();
        if (data.activeSite) {
          currentActiveSite = data.activeSite;
          currentAvailableSites = [data.activeSite];
          return data.activeSite;
        }
      }
    } catch (err) {
      console.warn('Could not fetch active site from backend:', err);
    }
    return currentActiveSite;
  },

  getActiveSite(): SiteProject {
    return currentActiveSite;
  },

  setActiveSite(site: SiteProject) {
    currentActiveSite = site;
  },

  async getStandbyWorkers(_userId?: string, _tenantId?: string) {
    return [];
  },

  async fetchStandbyWorkers(_date?: string) {
    return [];
  },

  // ── 1. Master Activity Codes (Direct from Backend Database) ──────────────
  async getActivityCodes(): Promise<ActivityCodeItem[]> {
    if (inMemoryActivityCodes && inMemoryActivityCodes.length > 0) {
      return inMemoryActivityCodes;
    }

    const activeSite = this.getActiveSite();
    const siteCode = activeSite?.code;

    try {
      const queryParam = siteCode ? `?projectCode=${encodeURIComponent(siteCode)}` : '';
      let res = await apiFetch(`${API_URL}/activity-codes${queryParam}`);
      if (!res.ok && siteCode) {
        res = await apiFetch(`${API_URL}/activity-codes`);
      }

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
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
          inMemoryActivityCodes = mapped;
          return mapped;
        }
      }

      let corpRes: Response | null = null;
      if (siteCode && siteCode !== 'MAGA') {
        corpRes = await apiFetch(`${API_URL}/activity-codes/corporate-master?projectCode=${encodeURIComponent(siteCode)}`);
      }
      if (!corpRes || !corpRes.ok) {
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
          inMemoryActivityCodes = mapped;
          return mapped;
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using bundled fallback activities:', err);
    }

    inMemoryActivityCodes = DEFAULT_MASTER_ACTIVITY_CODES;
    return DEFAULT_MASTER_ACTIVITY_CODES;
  },

  async resolveActivityByCode(code: string): Promise<ActivityCodeItem | undefined> {
    const list = await this.getActivityCodes();
    return list.find((a) => a.code === code);
  },

  // ── 2. Master Equipment (Direct from Database) ───────────────────────────
  async fetchEquipment(supervisorId?: string, date?: string): Promise<EquipmentLogEntry[]> {
    try {
      if (supervisorId && date) {
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
              status: (log?.status === 'approved' || log?.status === 'done') ? 'done' : (log?.status || 'pending'),
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
      console.warn('Could not fetch equipment from backend:', err);
    }
    return [];
  },

  // ── 3. Site Resource Pool Mode ───────────────────────────────────────────
  async fetchSiteLaborPool(projectId?: string, date?: string, supervisorId?: string): Promise<any[]> {
    try {
      const pId = projectId || this.getActiveSite().id || getCurrentTenantId();
      const params = new URLSearchParams();
      params.append('type', 'labor');
      if (date) params.append('date', date);
      if (supervisorId) params.append('supervisorId', supervisorId);
      if (pId) params.append('projectId', pId);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`${API_URL}/employees/site-pool${query}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (err) {
      console.warn('Could not fetch labor pool:', err);
    }
    return [];
  },

  async fetchSiteOperatorPool(projectId?: string, date?: string, supervisorId?: string): Promise<any[]> {
    try {
      const pId = projectId || this.getActiveSite().id || getCurrentTenantId();
      const params = new URLSearchParams();
      params.append('type', 'operator');
      if (date) params.append('date', date);
      if (supervisorId) params.append('supervisorId', supervisorId);
      if (pId) params.append('projectId', pId);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`${API_URL}/employees/site-pool${query}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (err) {
      console.warn('Could not fetch operator pool:', err);
    }
    return [];
  },

  async fetchSiteEquipmentPool(projectId?: string, date?: string): Promise<SitePoolEquipmentItem[]> {
    try {
      const pId = projectId || this.getActiveSite().id || getCurrentTenantId();
      const params = new URLSearchParams();
      if (date) params.append('date', date);
      if (pId) params.append('projectId', pId);
      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`${API_URL}/equipment/site-pool${query}`);
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      }
    } catch (err) {
      console.warn('Could not fetch equipment pool:', err);
    }
    return [];
  },

  async isLaborPoolModeEnabled(projectId?: string): Promise<boolean> {
    try {
      const activeProjId = projectId || this.getActiveSite().id || getCurrentTenantId();
      if (!activeProjId || activeProjId === 'site-default') return false;
      const res = await apiFetch(`${API_URL}/tenants/${activeProjId}`);
      if (res.ok) {
        const data = await res.json();
        return Boolean(data?.laborAssignBySupervisor);
      }
    } catch (err) {
      console.warn('Could not verify labor pool mode:', err);
    }
    return false;
  },

  async isOperatorPoolModeEnabled(projectId?: string): Promise<boolean> {
    try {
      const activeProjId = projectId || this.getActiveSite().id || getCurrentTenantId();
      if (!activeProjId || activeProjId === 'site-default') return false;
      const res = await apiFetch(`${API_URL}/tenants/${activeProjId}`);
      if (res.ok) {
        const data = await res.json();
        return Boolean(data?.operatorAssignBySupervisor);
      }
    } catch (err) {
      console.warn('Could not verify operator pool mode:', err);
    }
    return false;
  },

  async isEquipmentPoolModeEnabled(projectId?: string): Promise<boolean> {
    try {
      const activeProjId = projectId || this.getActiveSite().id || getCurrentTenantId();
      if (!activeProjId || activeProjId === 'site-default') return false;
      const res = await apiFetch(`${API_URL}/tenants/${activeProjId}`);
      if (res.ok) {
        const data = await res.json();
        return Boolean(data?.equipmentAssignBySupervisor);
      }
    } catch (err) {
      console.warn('Could not verify equipment pool mode:', err);
    }
    return false;
  },

  createEquipmentLogEntryFromPool(item: SitePoolEquipmentItem): EquipmentLogEntry {
    const rawUnit = item.primaryUnit || 'Hrs';
    const primaryUnit = normalizeRatingUnit(rawUnit);
    const availableUnits = (item.availableUnits && item.availableUnits.length > 0)
      ? item.availableUnits.map(normalizeRatingUnit)
      : [primaryUnit];

    const initialWorking = 0;
    const initialTotal = 0;

    let otherClaimTotalDays = 0;
    let otherClaimTotalHours = 0;
    const otherUsages = item.existingUsages;
    if (Array.isArray(otherUsages)) {
      for (const u of otherUsages) {
        const uCode = String(u.unitCode || '').trim().toLowerCase();
        const uQty = Number(u.totalUtilization ?? 0);
        if (uCode === 'days' || uCode === 'day') {
          otherClaimTotalDays += uQty;
        } else {
          otherClaimTotalHours += uQty;
        }
      }
    }

    const hasOtherDays = otherClaimTotalDays > 0;
    const remainingDayCapacity = Math.max(0, 1.0 - otherClaimTotalDays);
    const defaultDaysVal = primaryUnit === 'Days'
      ? (initialTotal > 0 ? initialTotal : (hasOtherDays ? Math.min(1.0, remainingDayCapacity) : 1.0))
      : undefined;

    return {
      id: item.id,
      code: item.code || item.vehicleNo || item.magaNo,
      name: item.name,
      type: item.type || 'Equipment',
      vehicleNo: item.vehicleNo || item.code,
      magaNo: item.magaNo || item.code,
      condition: item.condition || 'DRY',
      primaryUnit,
      availableUnits,
      activeUnit: primaryUnit,
      additionalUnit: null,
      daysValue: defaultDaysVal,
      hoursValue: primaryUnit === 'Hrs' ? (initialWorking > 0 ? initialWorking : undefined) : undefined,
      startMeter: item.latestMeter || 0,
      endMeter: item.latestMeter || 0,
      netHours: initialWorking,
      workingHours: initialWorking,
      idleHours: 0,
      breakdownHours: 0,
      fuelIssuedLiters: 0,
      totalMileage: item.totalLoggedMileage || 0,
      startMileage: item.latestMileage || 0,
      endMileage: item.latestMileage || 0,
      activitySplits: [],
      activities: [],
      remarks: item.currentSupervisors && item.currentSupervisors.length > 0 ? `Claimed under ${item.currentSupervisors.join(', ')}` : '',
      status: (initialWorking > 0 || initialTotal > 0) ? 'done' : 'pending',
    };
  },

  // ── 4. Assigned Laborers & Time Entries (Direct from Database) ───────────
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
          const backendShift = Number(myEntries[0]?.shiftHours || myEntries.reduce((sum: number, e: any) => sum + (Number(e.hours) || 0), 0));
          const backendOt = Number(myEntries[0]?.overtimeHours ?? myEntries.reduce((sum: number, e: any) => sum + (Number(e.overtimeHours) || 0), 0));
          
          const backendActivities: ActivitySplit[] = (myEntries[0]?.activitySplits || []).map((s: any, idx: number) => ({
            id: s.id || `act-${idx}`,
            activityCode: s.activityCode?.code || '',
            hours: Number(s.hours) || 0,
          }));

          const hasBothTimes = Boolean(backendInTime && backendOutTime);
          const hasAnyData = Boolean(backendInTime || backendOutTime || backendActivities.length > 0);
          const serverStatus = myEntries[0]?.status;
          let status: 'draft' | 'pending' | 'done' = 'pending';
          if (serverStatus === 'approved' || serverStatus === 'submitted' || serverStatus === 'done' || hasBothTimes) {
            status = 'done';
          } else if (hasAnyData) {
            status = 'draft';
          }

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
            breakHours: Number(myEntries[0]?.breakHours || 0),
            additionalHours: Number(myEntries[0]?.additionalHours || 0),
            isLunchDeducted: Boolean(myEntries[0]?.isLunchDeducted),
            isDinnerDeducted: Boolean(myEntries[0]?.isDinnerDeducted),
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

  // ── 5. Machine Operators (Direct from Database) ──────────────────────────
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
          if (te?.status === 'done' || te?.status === 'approved' || hasTimes) {
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
            additionalHours: Number(te?.additionalHours || 0),
            breakHours: Number(te?.breakHours || 0),
            isLunchDeducted: Boolean(te?.isLunchDeducted),
            isDinnerDeducted: Boolean(te?.isDinnerDeducted),
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

  // ── 6. Day Lock Status & Server Lifecycle ────────────────────────────────
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

  // ── 7. Direct Backend Sync Pipelines (Single Source of Truth) ─────────────
  async syncLaborersToBackend(supervisorId: string, date: string, laborers: LaborerEntry[]): Promise<boolean> {
    try {
      const validLaborers = laborers.filter((l) => !l.isAbsent);
      const masterActivities = await this.getActivityCodes();
      const codeToIdMap = new Map<string, string>();
      masterActivities.forEach((a) => {
        if (a.code) codeToIdMap.set(a.code.trim().toUpperCase(), a.id || '');
      });

      const zidleId = codeToIdMap.get('ZIDLE') || masterActivities.find((a) => a.code.toUpperCase() === 'ZIDLE')?.id;
      const defaultId = masterActivities[0]?.id;

      const entries = [];
      for (const lab of validLaborers) {
        const totalShift = Number(lab.shiftHours) || 0;
        let sumAssigned = 0;

        if (lab.activities && lab.activities.length > 0) {
          for (const act of lab.activities) {
            const rawHours = Number(act.hours) || 0;
            if (rawHours <= 0) continue;

            let actHours = rawHours;
            if (totalShift > 0 && sumAssigned + actHours > totalShift) {
              actHours = Math.max(0, totalShift - sumAssigned);
            }

            if (!act.activityCode || !act.activityCode.trim()) continue;
            const resolvedActId = codeToIdMap.get(act.activityCode.trim().toUpperCase());
            if (resolvedActId && actHours > 0) {
              entries.push({
                employeeId: lab.id,
                activityId: resolvedActId,
                hours: actHours,
                inTime: lab.inTime || undefined,
                outTime: lab.outTime || undefined,
                otHours: lab.otHours || undefined,
                additionalHours: lab.additionalHours || 0,
                status: lab.status || 'draft',
              });
              sumAssigned += actHours;
            }
          }
        }

        // Auto-balance Idle hours: if supervisor assigned fewer activity hours than total shift, remainder is Idle
        if (totalShift > sumAssigned && zidleId) {
          const idleHours = Math.round((totalShift - sumAssigned) * 100) / 100;
          if (idleHours > 0) {
            entries.push({
              employeeId: lab.id,
              activityId: zidleId,
              hours: idleHours,
              inTime: lab.inTime || undefined,
              outTime: lab.outTime || undefined,
              otHours: lab.otHours || undefined,
              additionalHours: lab.additionalHours || 0,
              status: lab.status || 'draft',
            });
          }
        } else if (entries.filter((e) => e.employeeId === lab.id).length === 0 && (lab.inTime || lab.outTime)) {
          entries.push({
            employeeId: lab.id,
            activityId: zidleId || defaultId,
            hours: totalShift > 0 ? totalShift : 0,
            inTime: lab.inTime || undefined,
            outTime: lab.outTime || undefined,
            otHours: lab.otHours || undefined,
            additionalHours: lab.additionalHours || 0,
            status: lab.status || 'draft',
          });
        }
      }

      const activeEmployeeIds = validLaborers.map((l) => l.id);
      const res = await apiFetch(`${API_URL}/time-entries/labor/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId, date, entries, activeEmployeeIds }),
      });

      return res.ok;
    } catch (err) {
      console.warn('Backend sync failed for laborers:', err);
      return false;
    }
  },

  async syncOperatorsToBackend(supervisorId: string, date: string, operators: OperatorEntry[]): Promise<boolean> {
    try {
      const validOps = operators.filter((o) => !!o.id);
      const entries = [];

      for (const op of validOps) {
        const shiftHours = Number(op.shiftHours) || 0;
        const splits = (op.equipmentSplits && op.equipmentSplits.length > 0)
          ? op.equipmentSplits
              .filter((s) => Boolean(s.equipmentId && s.equipmentId !== 'ZXQOPRIDLE'))
              .map((s) => ({
                equipmentId: s.equipmentId,
                hours: Number(s.hours) || 0,
              }))
          : (op.assignedEquipmentId && op.assignedEquipmentId !== 'ZXQOPRIDLE'
              ? [{ equipmentId: op.assignedEquipmentId, hours: shiftHours }]
              : []);

        if (splits.length > 1) {
          const totalAllocated = splits.reduce((sum, s) => sum + s.hours, 0);
          const idleRemainder = Math.max(0, Math.round((shiftHours - totalAllocated) * 100) / 100);
          if (idleRemainder > 0 || splits.length === 0) {
            splits.push({ equipmentId: 'ZXQOPRIDLE', hours: idleRemainder });
          }
        }

        entries.push({
          id: op.id,
          inTime: op.inTime || undefined,
          outTime: op.outTime || undefined,
          shiftHours,
          otHours: op.otHours || undefined,
          additionalHours: op.additionalHours || 0,
          assignedEquipmentId: op.assignedEquipmentId || (splits[0]?.equipmentId !== 'ZXQOPRIDLE' ? splits[0]?.equipmentId : undefined),
          splits: splits.length > 0 ? splits : undefined,
          notes: op.notes || undefined,
          status: op.status || 'draft',
        });
      }

      const activeEmployeeIds = validOps.map((o) => o.id);
      const res = await apiFetch(`${API_URL}/time-entries/operators/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId, date, entries, activeEmployeeIds }),
      });

      return res.ok;
    } catch (err) {
      console.warn('Backend sync failed for operators:', err);
      return false;
    }
  },

  async syncEquipmentToBackend(supervisorId: string, date: string, equipment: EquipmentLogEntry[]): Promise<boolean> {
    try {
      const entries = equipment.map((eq) => {
        const isDays = eq.primaryUnit === 'Days' || eq.primaryUnit === 'mth';
        return {
          id: eq.id,
          equipmentId: eq.id,
          operatorId: eq.operatorId || undefined,
          daysValue: isDays ? Number(eq.daysValue || eq.workingHours || 0) : undefined,
          hoursValue: !isDays ? Number(eq.hoursValue || eq.workingHours || 0) : undefined,
          startMeter: eq.startMeter !== undefined ? Number(eq.startMeter) : undefined,
          endMeter: eq.endMeter !== undefined ? Number(eq.endMeter) : undefined,
          netHours: Number(eq.netHours || eq.workingHours || 0),
          workingHours: Number(eq.workingHours || eq.netHours || 0),
          idleHours: Number(eq.idleHours || 0),
          breakdownHours: Number(eq.breakdownHours || 0),
          fuelIssuedLiters: Number(eq.fuelIssuedLiters || 0),
          totalMileage: Number(eq.totalMileage || 0),
          startMileage: eq.startMileage !== undefined ? Number(eq.startMileage) : undefined,
          endMileage: eq.endMileage !== undefined ? Number(eq.endMileage) : undefined,
          remarks: eq.remarks || undefined,
          status: eq.status || 'draft',
          splits: (eq.activitySplits && eq.activitySplits.length > 0)
            ? eq.activitySplits.map((s) => ({
                activityCode: s.activityCode,
                unit: s.unit || eq.primaryUnit || 'Hrs',
                utilization: Number(s.utilization || 0),
              }))
            : undefined,
          activitySplits: (eq.activitySplits && eq.activitySplits.length > 0)
            ? eq.activitySplits.map((s) => ({
                activityCode: s.activityCode,
                unit: s.unit || eq.primaryUnit || 'Hrs',
                utilization: Number(s.utilization || 0),
              }))
            : undefined,
        };
      });

      const res = await apiFetch(`${API_URL}/time-entries/equipment/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId, date, entries }),
      });

      return res.ok;
    } catch (err) {
      console.warn('Backend sync failed for equipment:', err);
      return false;
    }
  },

  async syncToBackend(
    supervisorId: string,
    date: string,
    laborers: LaborerEntry[],
    operators: OperatorEntry[],
    equipment: EquipmentLogEntry[]
  ): Promise<{ success: boolean; errors: string[] }> {
    const tasks: Promise<boolean>[] = [];

    if (laborers && laborers.length > 0) tasks.push(this.syncLaborersToBackend(supervisorId, date, laborers));
    if (operators && operators.length > 0) tasks.push(this.syncOperatorsToBackend(supervisorId, date, operators));
    if (equipment && equipment.length > 0) tasks.push(this.syncEquipmentToBackend(supervisorId, date, equipment));

    const results = await Promise.all(tasks);
    const allOk = results.every(Boolean);

    return {
      success: allOk,
      errors: allOk ? [] : ['Some records could not be synchronized with the database.'],
    };
  },

  async submitDayToBackend(
    supervisorId: string,
    date: string,
    laborers: LaborerEntry[],
    operators: OperatorEntry[],
    equipment: EquipmentLogEntry[]
  ): Promise<{ success: boolean; offline?: boolean; message?: string; status?: any; isLocked?: boolean; submittedAt?: string }> {
    try {
      await this.syncToBackend(supervisorId, date, laborers, operators, equipment);

      const res = await apiFetch(`${API_URL}/time-entries/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supervisorId, date }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Failed to submit and lock day on backend');
      }

      const data = await res.json().catch(() => ({}));

      return {
        success: true,
        offline: false,
        status: data.status || 'submitted',
        isLocked: true,
        submittedAt: data.submittedAt,
      };
    } catch (err: any) {
      console.error('Submit error:', err);
      throw err;
    }
  },

  /**
   * Fetch recent past gangs for a supervisor across the past N working days before currentDate directly from Backend.
   */
  async getPastGangsForSupervisor(
    supervisorId?: string,
    currentDate?: string,
    daysCount: number = 5
  ): Promise<Array<{ date: string; dayName: string; workerIds: string[]; workerCount: number }>> {
    if (!currentDate) return [];

    let effectiveSupId = supervisorId;
    if (!effectiveSupId && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('les_auth_user');
        if (raw) {
          const u = JSON.parse(raw);
          effectiveSupId = u.id || u.userId || '';
        }
      } catch {
        // ignore
      }
    }

    if (!effectiveSupId) return [];

    try {
      const activeProjId = this.getActiveSite().id || getCurrentTenantId();
      const pIdParam = activeProjId && activeProjId !== 'site-default' ? `&projectId=${encodeURIComponent(activeProjId)}` : '';
      const res = await apiFetch(
        `${API_URL}/assignments/supervisor-past-gangs?supervisorId=${encodeURIComponent(effectiveSupId)}&before=${encodeURIComponent(currentDate)}&limit=${daysCount}&type=labor${pIdParam}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Fast supervisor past gangs query failed:', err);
    }

    return [];
  },

  /**
   * Fetch recent past operators for a supervisor across the past N working days before currentDate directly from Backend.
   */
  async getPastOperatorsForSupervisor(
    supervisorId?: string,
    currentDate?: string,
    daysCount: number = 5
  ): Promise<Array<{ date: string; dayName: string; operatorIds: string[]; operatorCount: number; operators: OperatorEntry[] }>> {
    if (!currentDate) return [];

    let effectiveSupId = supervisorId;
    if (!effectiveSupId && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('les_auth_user');
        if (raw) {
          const u = JSON.parse(raw);
          effectiveSupId = u.id || u.userId || '';
        }
      } catch {
        // ignore
      }
    }

    if (!effectiveSupId) return [];

    try {
      const activeProjId = this.getActiveSite().id || getCurrentTenantId();
      const pIdParam = activeProjId && activeProjId !== 'site-default' ? `&projectId=${encodeURIComponent(activeProjId)}` : '';
      const res = await apiFetch(
        `${API_URL}/assignments/supervisor-past-gangs?supervisorId=${encodeURIComponent(effectiveSupId)}&before=${encodeURIComponent(currentDate)}&limit=${daysCount}&type=operator${pIdParam}`
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Fast supervisor past operators query failed:', err);
    }

    return [];
  },
};
