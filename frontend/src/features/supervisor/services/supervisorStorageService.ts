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

export interface ActivityCodeItem {
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

const INITIAL_LABORERS: LaborerEntry[] = [
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

const INITIAL_OPERATORS: OperatorEntry[] = [
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

const INITIAL_EQUIPMENT: EquipmentLogEntry[] = [
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
  // Get active site
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

  // Load labor data for a given date
  getLaborers(date: string): LaborerEntry[] {
    const key = `${STORAGE_PREFIX}labor_${date}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((l: any, index: number) => {
            const seed = INITIAL_LABORERS.find((s) => s.id === l.id) || INITIAL_LABORERS[index % INITIAL_LABORERS.length];
            return {
              ...seed,
              ...l,
              employeeCode: l.employeeCode || seed?.employeeCode || `EMP-10${index + 1}`,
            };
          });
        }
      }
    } catch {
      // ignore
    }
    // Return seed on first load and cache
    this.saveLaborers(date, INITIAL_LABORERS);
    return INITIAL_LABORERS;
  },

  saveLaborers(date: string, laborers: LaborerEntry[]) {
    const key = `${STORAGE_PREFIX}labor_${date}`;
    localStorage.setItem(key, JSON.stringify(laborers));
    this.incrementPendingSync();
  },

  // Load operators data for a given date
  getOperators(date: string): OperatorEntry[] {
    const key = `${STORAGE_PREFIX}operators_${date}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((op: any, index: number) => {
            const seed = INITIAL_OPERATORS.find((s) => s.id === op.id) || INITIAL_OPERATORS[index % INITIAL_OPERATORS.length];
            return {
              ...seed,
              ...op,
              employeeNumber: op.employeeNumber || seed?.employeeNumber || `R045${6 + index}`,
            };
          });
        }
      }
    } catch {
      // ignore
    }
    this.saveOperators(date, INITIAL_OPERATORS);
    return INITIAL_OPERATORS;
  },

  saveOperators(date: string, operators: OperatorEntry[]) {
    const key = `${STORAGE_PREFIX}operators_${date}`;
    localStorage.setItem(key, JSON.stringify(operators));
    this.incrementPendingSync();
  },

  // Load equipment data for a given date
  getEquipment(date: string): EquipmentLogEntry[] {
    const key = `${STORAGE_PREFIX}equipment_${date}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((eq: any, index: number) => {
            const seed = INITIAL_EQUIPMENT.find((s) => s.id === eq.id) || INITIAL_EQUIPMENT[index % INITIAL_EQUIPMENT.length];
            return {
              ...seed,
              ...eq,
              availableUnits: eq.availableUnits || seed?.availableUnits || ['mth', 'Days', 'Hrs'],
              activeUnit: eq.activeUnit || seed?.activeUnit || 'mth',
              daysValue: eq.daysValue ?? seed?.daysValue ?? (eq.netHours > 0 ? 1 : 0),
              hoursValue: eq.hoursValue ?? seed?.hoursValue ?? eq.netHours,
              extraHoursValue: eq.extraHoursValue ?? seed?.extraHoursValue ?? 0,
              areaValue: eq.areaValue ?? seed?.areaValue ?? 0,
            };
          });
        }
      }
    } catch {
      // ignore
    }
    this.saveEquipment(date, INITIAL_EQUIPMENT);
    return INITIAL_EQUIPMENT;
  },

  saveEquipment(date: string, equipment: EquipmentLogEntry[]) {
    const key = `${STORAGE_PREFIX}equipment_${date}`;
    localStorage.setItem(key, JSON.stringify(equipment));
    this.incrementPendingSync();
  },

  // Day Submission Lock Status
  isDayLocked(date: string): boolean {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    return localStorage.getItem(key) === 'true';
  },

  lockDay(date: string) {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    localStorage.setItem(key, 'true');
    this.incrementPendingSync();
  },

  unlockDay(date: string) {
    const key = `${STORAGE_PREFIX}locked_${date}`;
    localStorage.removeItem(key);
  },

  // Offline Sync Management
  getPendingSyncCount(): number {
    try {
      return parseInt(localStorage.getItem(SYNC_QUEUE_KEY) || '3', 10);
    } catch {
      return 3;
    }
  },

  incrementPendingSync() {
    const count = this.getPendingSyncCount() + 1;
    localStorage.setItem(SYNC_QUEUE_KEY, count.toString());
  },

  resetPendingSync() {
    localStorage.setItem(SYNC_QUEUE_KEY, '0');
  },
};
