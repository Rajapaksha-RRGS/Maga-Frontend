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
  assignedEquipmentId: string; // ID of the mapped equipment
  status: 'draft' | 'pending' | 'done';
  notes?: string;
  lastSavedAt?: string;
}

export type EquipmentRatingUnit = 'Days' | 'Hrs' | 'EX.hrs' | 'mth' | 'm2';

export interface EquipmentLogEntry {
  id: string;
  code: string;
  name: string;
  type: string;
  
  // Rating Units (from Master Data)
  availableUnits?: EquipmentRatingUnit[];
  activeUnit?: EquipmentRatingUnit;
  
  // Values per unit
  startMeter: number;
  endMeter: number;
  netHours: number; // for 'mth'
  daysValue?: number; // for 'Days' (1, 0.5, 1.5, etc.)
  hoursValue?: number; // for 'Hrs'
  extraHoursValue?: number; // for 'EX.hrs'
  areaValue?: number; // for 'm2'
  
  workingHours: number;
  idleHours: number;
  breakdownHours: number;
  fuelIssuedLiters: number;
  operatorId?: string;
  activityCode?: string;
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

// ─── Master Data ─────────────────────────────────────────────────────────────

export const MASTER_SITES: SiteProject[] = [
  {
    id: 'site-port-city',
    name: 'Mäga — Colombo Port City (Marine Drive)',
    code: 'CPC-PKG-02',
    location: 'Galle Face, Colombo 01',
    projectManager: 'Eng. R. Senanayake',
  },
  {
    id: 'site-kelani-bridge',
    name: 'Kelani Bridge Flyover Phase 2',
    code: 'KBF-SEC-B',
    location: 'Peliyagoda / Colombo North',
    projectManager: 'Eng. M. Wickramasinghe',
  },
  {
    id: 'site-highway-ext',
    name: 'Central Expressway Section II (Meerigama)',
    code: 'CEP-PKG-04',
    location: 'Meerigama Interchange',
    projectManager: 'Eng. S. Alwis',
  },
];

export const MASTER_ACTIVITIES: ActivityCodeItem[] = [
  { code: 'ACT-101', name: 'Concrete Pouring (Slab & Columns)', trade: 'Masonry', category: 'Civil' },
  { code: 'ACT-102', name: 'Reinforcement & Bar-bending', trade: 'Steel Fixer', category: 'Civil' },
  { code: 'ACT-103', name: 'Bricklaying & Masonry Finishing', trade: 'Mason', category: 'Civil' },
  { code: 'ACT-104', name: 'Excavation, Trenching & Earthwork', trade: 'Earthwork', category: 'Civil' },
  { code: 'ACT-105', name: 'Plastering, Screeding & Skim Coat', trade: 'Plasterer', category: 'Finishing' },
  { code: 'ACT-106', name: 'Formwork & Scaffolding Erection', trade: 'Carpenter', category: 'Structural' },
  { code: 'ACT-107', name: 'Drainage & Pipe Laying', trade: 'Plumber', category: 'Services' },
  { code: 'ACT-108', name: 'Site Cleaning & Material Handling', trade: 'General Helper', category: 'General' },
];

export const STANDBY_WORKERS_POOL = [
  { id: 'ST-501', employeeCode: 'EMP-501', callingName: 'Jagath Kumara', tradeGroup: 'Carpenter', businessPartner: 'Mäga Direct', nic: '881290345V' },
  { id: 'ST-502', employeeCode: 'EMP-502', callingName: 'Saman Jayasuriya', tradeGroup: 'Mason', businessPartner: 'Alpha Subcontractors', nic: '912389441V' },
  { id: 'ST-503', employeeCode: 'EMP-503', callingName: 'Bandula Premalal', tradeGroup: 'Steel Fixer', businessPartner: 'Beta Engineering', nic: '853401923V' },
  { id: 'ST-504', employeeCode: 'EMP-504', callingName: 'Priyantha Dias', tradeGroup: 'General Helper', businessPartner: 'Mäga Direct', nic: '941209312V' },
  { id: 'ST-505', employeeCode: 'EMP-505', callingName: 'Gamini Dissanayake', tradeGroup: 'Plumber', businessPartner: 'Delta Services', nic: '821940129V' },
];

// ─── Initial Seed Records ───────────────────────────────────────────────────

export const INITIAL_LABORERS: LaborerEntry[] = [
  {
    id: 'L-101',
    employeeCode: 'EMP-101',
    callingName: 'Kamal Perera',
    tradeGroup: 'Mason',
    businessPartner: 'Mäga Direct',
    nic: '841029341V',
    inTime: '07:30',
    outTime: '17:00',
    shiftHours: 8.5,
    otHours: 1.0,
    activities: [
      { id: 'a1', activityCode: 'ACT-101', hours: 5.5 },
      { id: 'a2', activityCode: 'ACT-103', hours: 3.0 },
    ],
    status: 'done',
    lastSavedAt: '08:15 AM',
  },
  {
    id: 'L-102',
    employeeCode: 'EMP-102',
    callingName: 'Nimal Silva',
    tradeGroup: 'Steel Fixer',
    businessPartner: 'Alpha Contractors',
    nic: '891023942V',
    inTime: '08:00',
    outTime: '17:00',
    shiftHours: 8.0,
    otHours: 0.5,
    activities: [
      { id: 'a3', activityCode: 'ACT-102', hours: 8.0 },
    ],
    status: 'draft',
    lastSavedAt: '08:30 AM',
  },
  {
    id: 'L-103',
    employeeCode: 'EMP-103',
    callingName: 'Sunil Shantha',
    tradeGroup: 'Carpenter',
    businessPartner: 'Mäga Direct',
    nic: '792019482V',
    inTime: '08:00',
    outTime: '16:30',
    shiftHours: 7.5,
    otHours: 0,
    activities: [
      { id: 'a4', activityCode: 'ACT-106', hours: 7.5 },
    ],
    status: 'done',
    lastSavedAt: '09:00 AM',
  },
  {
    id: 'L-104',
    employeeCode: 'EMP-104',
    callingName: 'Ruwan Kumara',
    tradeGroup: 'General Helper',
    businessPartner: 'Beta Manpower',
    nic: '931029481V',
    inTime: '07:30',
    outTime: '',
    shiftHours: 0,
    otHours: 0,
    activities: [
      { id: 'a5', activityCode: 'ACT-108', hours: 0 },
    ],
    status: 'pending',
  },
  {
    id: 'L-105',
    employeeCode: 'EMP-105',
    callingName: 'Ajith Bandara',
    tradeGroup: 'Mason',
    businessPartner: 'Mäga Direct',
    nic: '883019283V',
    inTime: '',
    outTime: '',
    shiftHours: 0,
    otHours: 0,
    activities: [
      { id: 'a6', activityCode: 'ACT-101', hours: 0 },
    ],
    status: 'pending',
  },
  {
    id: 'L-106',
    employeeCode: 'EMP-106',
    callingName: 'Nuwan Pradeep',
    tradeGroup: 'Steel Fixer',
    businessPartner: 'Alpha Contractors',
    nic: '951029411V',
    inTime: '08:00',
    outTime: '17:00',
    shiftHours: 8.0,
    otHours: 0.5,
    activities: [
      { id: 'a7', activityCode: 'ACT-102', hours: 8.0 },
    ],
    status: 'draft',
    lastSavedAt: '08:45 AM',
  },
];

export const INITIAL_OPERATORS: OperatorEntry[] = [
  {
    id: 'OP-201',
    callingName: 'Anura Gunasekara',
    employeeNumber: 'R0456',
    licenseNo: 'OP-HV-9921',
    designation: 'Heavy Excavator Operator',
    inTime: '07:00',
    outTime: '17:30',
    shiftHours: 9.5,
    otHours: 1.5,
    assignedEquipmentId: 'EQ-01',
    status: 'done',
    notes: 'Hydraulic pre-inspection passed. Ready for deep trenching.',
    lastSavedAt: '07:15 AM',
  },
  {
    id: 'OP-202',
    callingName: 'Mahesh Fernando',
    employeeNumber: 'R0457',
    licenseNo: 'OP-CR-4412',
    designation: 'Tower Crane Operator',
    inTime: '07:30',
    outTime: '17:00',
    shiftHours: 8.5,
    otHours: 0.5,
    assignedEquipmentId: 'EQ-02',
    status: 'done',
    notes: 'Anemometer wind check clear under 30 knots.',
    lastSavedAt: '07:45 AM',
  },
  {
    id: 'OP-203',
    callingName: 'Chathura Rajapaksha',
    employeeNumber: 'R0458',
    licenseNo: 'OP-RL-3129',
    designation: 'Roller & Compactor Operator',
    inTime: '08:00',
    outTime: '16:30',
    shiftHours: 7.5,
    otHours: 0,
    assignedEquipmentId: 'EQ-03',
    status: 'draft',
    notes: 'Subgrade rolling at Access Ramp sector.',
    lastSavedAt: '08:10 AM',
  },
  {
    id: 'OP-204',
    callingName: 'Duminda Karunaratne',
    employeeNumber: 'R0459',
    licenseNo: 'OP-BK-7718',
    designation: 'Backhoe Loader Operator',
    inTime: '',
    outTime: '',
    shiftHours: 0,
    otHours: 0,
    assignedEquipmentId: '', // intentionally unmapped to demonstrate validation!
    status: 'pending',
  },
];

export const INITIAL_EQUIPMENT: EquipmentLogEntry[] = [
  {
    id: 'EQ-01',
    code: 'EX-04',
    name: 'CAT 320D Excavator',
    type: 'Heavy Earthmover',
    availableUnits: ['mth', 'Hrs', 'EX.hrs', 'Days'],
    activeUnit: 'mth',
    startMeter: 4820.5,
    endMeter: 4828.5,
    netHours: 8.0,
    daysValue: 1.0,
    hoursValue: 8.0,
    extraHoursValue: 1.5,
    workingHours: 7.0,
    idleHours: 1.0,
    breakdownHours: 0,
    fuelIssuedLiters: 110,
    operatorId: 'OP-201',
    activityCode: 'ACT-104',
    status: 'done',
    remarks: 'Foundation pit excavation sector B. Operating smoothly.',
    lastSavedAt: '09:20 AM',
  },
  {
    id: 'EQ-02',
    code: 'TC-01',
    name: 'Zoomlion 50T Tower Crane',
    type: 'Lifting & Hoisting',
    availableUnits: ['Days', 'Hrs', 'EX.hrs'],
    activeUnit: 'Days',
    startMeter: 1240.0,
    endMeter: 1247.5,
    netHours: 7.5,
    daysValue: 1.0,
    hoursValue: 7.5,
    extraHoursValue: 0.5,
    workingHours: 6.5,
    idleHours: 1.0,
    breakdownHours: 0,
    fuelIssuedLiters: 0, // Electric powered
    operatorId: 'OP-202',
    activityCode: 'ACT-102',
    status: 'done',
    remarks: 'Rebar bundle lifting to Level 4 casting deck.',
    lastSavedAt: '09:35 AM',
  },
  {
    id: 'EQ-03',
    code: 'RL-02',
    name: 'Dynapac CA2500D Vibratory Roller',
    type: 'Compaction Equipment',
    availableUnits: ['mth', 'm2', 'Hrs', 'Days'],
    activeUnit: 'mth',
    startMeter: 3105.0,
    endMeter: 3111.0,
    netHours: 6.0,
    daysValue: 1.0,
    hoursValue: 6.0,
    areaValue: 480,
    workingHours: 5.0,
    idleHours: 1.0,
    breakdownHours: 0,
    fuelIssuedLiters: 65,
    operatorId: 'OP-203',
    activityCode: 'ACT-104',
    status: 'draft',
    remarks: 'Sub-base layer 98% density achieved on road shoulder.',
    lastSavedAt: '10:00 AM',
  },
  {
    id: 'EQ-04',
    code: 'CP-01',
    name: 'Schwing Stetter Concrete Pump',
    type: 'Concrete Machinery',
    availableUnits: ['Days', 'm2', 'Hrs'],
    activeUnit: 'Days',
    startMeter: 2150.0,
    endMeter: 2150.0,
    netHours: 0,
    daysValue: 0,
    hoursValue: 0,
    areaValue: 0,
    workingHours: 0,
    idleHours: 0,
    breakdownHours: 0,
    fuelIssuedLiters: 0,
    operatorId: '',
    activityCode: 'ACT-101',
    status: 'pending',
    remarks: 'Scheduled for afternoon slab concrete pour at 14:00.',
  },
  {
    id: 'EQ-05',
    code: 'TP-02',
    name: 'Isuzu Giga 10-Wheeler Tipper',
    type: 'Material Haulage Truck',
    availableUnits: ['Days', 'Hrs', 'EX.hrs', 'm2'],
    activeUnit: 'Days',
    startMeter: 54100.0,
    endMeter: 54220.0,
    netHours: 8.0,
    daysValue: 1.0,
    hoursValue: 8.0,
    extraHoursValue: 2.0,
    workingHours: 8.0,
    idleHours: 0,
    breakdownHours: 0,
    fuelIssuedLiters: 85,
    operatorId: 'OP-204',
    activityCode: 'ACT-108',
    status: 'done',
    remarks: 'Aggregate transport from batching plant to sector 3.',
    lastSavedAt: '10:30 AM',
  },
];

// ─── Storage Keys & Helper Functions ─────────────────────────────────────────

const STORAGE_PREFIX = 'maga_supervisor_data_';
const SYNC_QUEUE_KEY = 'maga_supervisor_sync_queue';
const ACTIVE_SITE_KEY = 'maga_supervisor_active_site';

export const supervisorStorage = {
  // ── Site Management ───────────────────────────────────────────────────────
  getActiveSite(): SiteProject {
    try {
      const saved = localStorage.getItem(ACTIVE_SITE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return MASTER_SITES[0];
  },

  setActiveSite(site: SiteProject) {
    localStorage.setItem(ACTIVE_SITE_KEY, JSON.stringify(site));
  },

  // ── 1. Master Activity Codes (Backend with Tenant Isolation + Offline Cache) 
  async getActivityCodes(): Promise<ActivityCodeItem[]> {
    const key = `${STORAGE_PREFIX}activities_cache`;
    try {
      const res = await apiFetch(`${API_URL}/activity-codes`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          const mapped: ActivityCodeItem[] = data.map((d: any) => ({
            id: d.id,
            code: d.code,
            name: d.description || d.code,
            trade: d.trade || '',
            category: d.category || '',
          }));
          localStorage.setItem(key, JSON.stringify(mapped));
          return mapped;
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using cached activities:', err);
    }

    const cached = localStorage.getItem(key);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }
    return MASTER_ACTIVITIES;
  },

  async resolveActivityByCode(code: string): Promise<ActivityCodeItem | undefined> {
    const list = await this.getActivityCodes();
    return list.find((a) => a.code === code);
  },

  // ── 2. Master Equipment (Backend + Offline Cache) ──────────────────────────
  async fetchEquipment(): Promise<EquipmentLogEntry[]> {
    const key = `${STORAGE_PREFIX}equipment_master`;
    try {
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
    } catch (err) {
      console.warn('Backend unavailable, using cached equipment:', err);
    }
    const cached = localStorage.getItem(key);
    return cached ? JSON.parse(cached) : [];
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
        const assignedList = await resAssigned.json();
        const timeEntryList = resEntries.ok ? await resEntries.json() : [];

        // Check if entries for this day are already submitted and locked
        const isSubmitted = timeEntryList.some((t: any) => t.status === 'submitted');
        if (isSubmitted) {
          this.lockDay(date);
        }

        // Map assigned workers with attendance, hours, and activity splits
        const laborList: LaborerEntry[] = (assignedList || []).map((emp: any) => {
          const myEntries = timeEntryList.filter((e: any) => e.employeeId === emp.id);

          const inTime = myEntries.length > 0 ? (myEntries[0].inTime || '') : '';
          const outTime = myEntries.length > 0 ? (myEntries[0].outTime || '') : '';

          const shiftHours = myEntries.reduce((sum: number, e: any) => sum + (Number(e.hours) || 0), 0);
          const otHours = myEntries.reduce((sum: number, e: any) => sum + (Number(e.overtimeHours) || 0), 0);

          const activities: ActivitySplit[] = myEntries
            .filter((e: any) => e.activity?.code || e.activityId)
            .map((e: any, idx: number) => ({
              id: e.id || `act-${idx}`,
              activityCode: e.activity?.code || '',
              hours: Number(e.hours) || 0,
            }));

          let status: 'draft' | 'pending' | 'done' = 'pending';
          if (isSubmitted) {
            status = 'done';
          } else if (inTime && outTime) {
            status = myEntries.some((e: any) => e.status === 'draft') ? 'draft' : 'done';
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
          };
        });

        // Cache real data in localStorage for offline accessibility
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
      const res = await apiFetch(`${API_URL}/time-entries/operators?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const mapped: OperatorEntry[] = data.map((op: any) => ({
            id: op.operatorId || op.id,
            callingName: op.callingName || op.fullName || 'Operator',
            employeeNumber: op.employeeNumber || op.employeeCode || '',
            licenseNo: op.licenseNo || '',
            designation: op.designation || 'Machine Operator',
            inTime: op.inTime || '',
            outTime: op.outTime || '',
            shiftHours: Number(op.hours) || 0,
            otHours: Number(op.overtimeHours) || 0,
            assignedEquipmentId: op.equipmentId || '',
            status: op.status || 'pending',
            notes: op.notes || '',
          }));
          localStorage.setItem(key, JSON.stringify(mapped));
          return mapped;
        }
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

  // ── 6. Day Lock Status ────────────────────────────────────────────────────
  isDayLocked(date: string): boolean {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    return localStorage.getItem(key) === 'true';
  },

  lockDay(date: string) {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    localStorage.setItem(key, 'true');
  },

  unlockDay(date: string) {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    localStorage.removeItem(key);
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

    try {
      // 1. Sync Laborers attendance and activity splits
      for (const lab of laborers) {
        if (lab.activities.length > 0) {
          for (const act of lab.activities) {
            const actObj = await this.resolveActivityByCode(act.activityCode);
            if (actObj?.id) {
              await apiFetch(`${API_URL}/time-entries/upsert`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  employeeId: lab.id,
                  supervisorId,
                  date,
                  activityId: actObj.id,
                  hours: act.hours,
                  inTime: lab.inTime || undefined,
                  outTime: lab.outTime || undefined,
                }),
              });
            }
          }
        } else if (lab.inTime || lab.outTime) {
          if (lab.inTime) {
            await apiFetch(`${API_URL}/time-entries/check-in`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: lab.id,
                supervisorId,
                date,
                inTime: lab.inTime,
              }),
            });
          }
          if (lab.outTime) {
            await apiFetch(`${API_URL}/time-entries/check-out`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                employeeId: lab.id,
                supervisorId,
                date,
                outTime: lab.outTime,
              }),
            });
          }
        }
      }

      // 2. Sync Operators if any
      if (operators.length > 0) {
        const validOps = operators.filter((o) => o.inTime || o.assignedEquipmentId);
        if (validOps.length > 0) {
          await apiFetch(`${API_URL}/time-entries/operators/bulk`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              supervisorId,
              date,
              entries: validOps.map((op) => ({
                operatorId: op.id,
                equipmentId: op.assignedEquipmentId || undefined,
                inTime: op.inTime || undefined,
                outTime: op.outTime || undefined,
                hours: op.shiftHours || 0,
                overtimeHours: op.otHours || 0,
                notes: op.notes || undefined,
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

  // ── 9. Submit & Lock Day on Backend ───────────────────────────────────────
  async submitDayToBackend(supervisorId: string, date: string): Promise<boolean> {
    // Sync all pending drafts first
    await this.syncToBackend(supervisorId, date);

    // Call submit endpoint to validate complete check-in/out and lock
    const res = await apiFetch(`${API_URL}/time-entries/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supervisorId,
        date,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || 'Failed to submit and lock day on backend');
    }

    this.lockDay(date);
    this.resetPendingSync();
    return true;
  },
};
