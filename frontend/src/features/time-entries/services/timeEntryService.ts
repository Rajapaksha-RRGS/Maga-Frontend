/**
 * timeEntryService.ts
 * Stub service for time-entry operations.
 * All mock functions must be replaced with real API calls once the
 * backend `timeEntries` module endpoints are available.
 *
 * Backend endpoints (per spec section 6 / module 5):
 *   GET  /api/time-entries/assigned?supervisorId=&date=
 *   POST /api/time-entries/check-in
 *   POST /api/time-entries/upsert
 *   POST /api/time-entries/submit
 *   GET  /api/activity-codes
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignedEmployee {
  id: string;
  callingName: string;
  fullName: string;
  tradeGroup: string;
  businessPartner: string;
}

export interface ActivityCode {
  id: string;
  code: string;
  description: string;
}

export interface TimeEntryPayload {
  employeeId: string;
  supervisorId: string;
  date: string; // ISO date "YYYY-MM-DD"
  activityId: string;
  hours: number;
  inTime?: string;  // "HH:mm"
  outTime?: string; // "HH:mm"
  remarks?: string;
}

export interface SubmitDayPayload {
  supervisorId: string;
  date: string;
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_EMPLOYEES: AssignedEmployee[] = [
  { id: 'emp-01', callingName: 'Kamal',   fullName: 'Kamal Perera',   tradeGroup: 'Mason',     businessPartner: 'SL Labour Co' },
  { id: 'emp-02', callingName: 'Suresh',  fullName: 'Suresh Fernando', tradeGroup: 'Bar Bender', businessPartner: 'SL Labour Co' },
  { id: 'emp-03', callingName: 'Nimal',   fullName: 'Nimal Silva',     tradeGroup: 'Carpenter',  businessPartner: 'BuildForce' },
  { id: 'emp-04', callingName: 'Ruwan',   fullName: 'Ruwan Bandara',   tradeGroup: 'Helper',     businessPartner: 'BuildForce' },
  { id: 'emp-05', callingName: 'Amal',    fullName: 'Amal Jayasuriya', tradeGroup: 'Mason',      businessPartner: 'SL Labour Co' },
  { id: 'emp-06', callingName: 'Saman',   fullName: 'Saman Wickrama',  tradeGroup: 'Helper',     businessPartner: 'BuildForce' },
];

const MOCK_ACTIVITY_CODES: ActivityCode[] = [
  { id: 'ac-01', code: '00-00-20-10', description: 'Dayworks - Labour' },
  { id: 'ac-02', code: '01-10-10-00', description: 'Excavation & Earthwork' },
  { id: 'ac-03', code: '01-20-10-00', description: 'Concrete Work - Substructure' },
  { id: 'ac-04', code: '02-10-10-00', description: 'Formwork - Superstructure' },
  { id: 'ac-05', code: '02-20-10-00', description: 'Rebar & Steel Reinforcement' },
  { id: 'ac-06', code: '03-10-10-00', description: 'Masonry Block & Brick Laying' },
  { id: 'ac-07', code: '03-20-10-00', description: 'Plastering Work' },
  { id: 'ac-08', code: '04-10-10-00', description: 'Plumbing & Drainage Work' },
  { id: 'ac-09', code: '04-20-10-00', description: 'Electrical Conduit & Cabling' },
  { id: 'ac-10', code: '05-10-10-00', description: 'Tile Laying & Finishes' },
  { id: 'ac-11', code: '05-20-10-00', description: 'Painting & Surface Coating' },
  { id: 'ac-12', code: '06-10-10-00', description: 'Welding & Structural Steel' },
];

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetch employees assigned to a supervisor for a given date.
 * TODO: replace with real API call →
 *   GET /api/time-entries/assigned?supervisorId=${supervisorId}&date=${date}
 */
export async function getAssignedEmployees(
  _supervisorId: string,
  _date: string
): Promise<AssignedEmployee[]> {
  // Simulate network latency
  await delay(300);
  return [...MOCK_EMPLOYEES];
}

/**
 * Fetch all activity codes for the tenant.
 * TODO: replace with real API call →
 *   GET /api/activity-codes
 */
export async function getActivityCodes(
  _tenantId: string
): Promise<ActivityCode[]> {
  await delay(200);
  return [...MOCK_ACTIVITY_CODES];
}

/**
 * Record check-in time for an employee.
 * TODO: replace with real API call →
 *   POST /api/time-entries/check-in  { employeeId, supervisorId, date, inTime }
 */
export async function checkInEmployee(
  employeeId: string,
  _supervisorId: string,
  _date: string,
  inTime: string
): Promise<{ employeeId: string; inTime: string }> {
  await delay(150);
  return { employeeId, inTime };
}

/**
 * Upsert (create or update) a time entry row.
 * An employee may have multiple rows per day (one per activity code).
 * TODO: replace with real API call →
 *   POST /api/time-entries/upsert  { ...TimeEntryPayload }
 */
export async function saveTimeEntry(
  payload: TimeEntryPayload
): Promise<{ success: boolean }> {
  await delay(200);
  console.log('[mock] saveTimeEntry', payload);
  return { success: true };
}

/**
 * Submit all of today's time entries for this supervisor and lock them.
 * Sets status = 'submitted' on every time_entry row for this supervisor+date.
 * TODO: replace with real API call →
 *   POST /api/time-entries/submit  { supervisorId, date }
 */
export async function submitDay(
  payload: SubmitDayPayload
): Promise<{ success: boolean }> {
  await delay(500);
  console.log('[mock] submitDay', payload);
  return { success: true };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
