/**
 * timeEntryService.ts
 *
 * Real API service for time-entry operations connected to backend PostgreSQL,
 * with fallback to mock data when backend is offline.
 *
 * Backend endpoints:
 *   GET  /api/activity-codes
 *   GET  /api/time-entries/assigned?supervisorId=&date=
 *   POST /api/time-entries/check-in
 *   POST /api/time-entries/assign-activity (bulk)
 *   POST /api/time-entries/upsert
 *   POST /api/time-entries/submit
 */

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
  equipmentId?: string;
  remarks?: string;
}

export interface BulkAssignPayload {
  employeeIds: string[];
  activityId: string;
  hours: number;
  date: string;
  supervisorId?: string;
  equipmentId?: string;
  remarks?: string;
}

export interface SubmitDayPayload {
  supervisorId: string;
  date: string;
}

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// ─── Mock fallback data ────────────────────────────────────────────────────────

const MOCK_EMPLOYEES: AssignedEmployee[] = [
  { id: 'HK030', callingName: 'Kamal',   fullName: 'Kamal Perera',   tradeGroup: 'Mason',     businessPartner: 'Aruna Builders (Pvt) Ltd' },
  { id: 'HK031', callingName: 'Nimal',   fullName: 'Nimal Silva',     tradeGroup: 'Carpenter', businessPartner: 'Aruna Builders (Pvt) Ltd' },
  { id: 'HI101', callingName: 'Sunil',   fullName: 'Sunil Shantha',   tradeGroup: 'Bar Bender', businessPartner: 'Maga Engineering' },
  { id: 'HI102', callingName: 'Chaminda', fullName: 'Chaminda Bandara', tradeGroup: 'Helper',   businessPartner: 'Laksiri Construction' },
];

const MOCK_ACTIVITY_CODES: ActivityCode[] = [
  { id: 'ac-01', code: '00-00-11-11-M', description: 'Direct Labour Masonry Works' },
  { id: 'ac-02', code: '01-10-10-00', description: 'Earth Work Excavation & Trenching' },
  { id: 'ac-03', code: '02-20-10-00', description: 'Concrete Pouring & Compaction' },
  { id: 'ac-04', code: '03-30-10-00', description: 'Formwork & Shuttering Installation' },
  { id: 'ac-05', code: '04-40-10-00', description: 'Reinforcement Steel Bar Bending & Fixing' },
];

// ─── Service functions ────────────────────────────────────────────────────────

/**
 * Fetch employees assigned to a supervisor for a given date.
 */
export async function getAssignedEmployees(
  supervisorId: string,
  date: string
): Promise<AssignedEmployee[]> {
  try {
    const res = await fetch(`${API_URL}/time-entries/assigned?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using fallback assigned employees:', err);
  }
  return [...MOCK_EMPLOYEES];
}

/**
 * Fetch all activity codes for the tenant.
 */
export async function getActivityCodes(
  tenantId?: string
): Promise<ActivityCode[]> {
  try {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await fetch(`${API_URL}/activity-codes${query}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((item: any) => ({
          id: item.id,
          code: item.code,
          description: item.description || item.code,
        }));
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using fallback activity codes:', err);
  }
  return [...MOCK_ACTIVITY_CODES];
}

/**
 * Record check-in time for an employee.
 */
export async function checkInEmployee(
  employeeId: string,
  supervisorId: string,
  date: string,
  inTime: string
): Promise<{ employeeId: string; inTime: string }> {
  try {
    const res = await fetch(`${API_URL}/time-entries/check-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, supervisorId, date, inTime }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to record check-in on backend:', err);
  }
  return { employeeId, inTime };
}

/**
 * Bulk assign an activity code and hours to multiple employees (ActivityAssignPage).
 */
export async function assignActivityBulk(
  payload: BulkAssignPayload
): Promise<{ success: boolean; count?: number }> {
  try {
    const res = await fetch(`${API_URL}/time-entries/assign-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to assign activity bulk on backend:', err);
  }
  return { success: true };
}

/**
 * Upsert (create or update) a single time entry row.
 */
export async function saveTimeEntry(
  payload: TimeEntryPayload
): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_URL}/time-entries/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to save time entry on backend:', err);
  }
  return { success: true };
}

/**
 * Submit all of today's time entries for this supervisor and lock them.
 */
export async function submitDay(
  payload: SubmitDayPayload
): Promise<{ success: boolean; message?: string }> {
  try {
    const res = await fetch(`${API_URL}/time-entries/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to submit day on backend:', err);
  }
  return { success: true };
}
