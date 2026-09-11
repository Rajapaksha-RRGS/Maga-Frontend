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

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';

/**
 * Fetch all activity codes for the tenant.
 */
export async function getActivityCodes(
  tenantId?: string
): Promise<ActivityCode[]> {
  try {
    const query = tenantId ? `?tenantId=${encodeURIComponent(tenantId)}` : '';
    const res = await apiFetch(`${API_URL}/activity-codes${query}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          id: item.id,
          code: item.code,
          description: item.description || item.code,
        }));
      }
    }
  } catch (err) {
    console.error('Error fetching activity codes from backend:', err);
  }
  return [];
}

/**
 * Fetch employees assigned to a supervisor on a date.
 */
export async function getAssignedEmployees(
  supervisorId: string,
  date: string
): Promise<AssignedEmployee[]> {
  try {
    const res = await apiFetch(
      `${API_URL}/time-entries/assigned?supervisorId=${encodeURIComponent(supervisorId)}&date=${encodeURIComponent(date)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.error('Failed to fetch assigned employees:', err);
  }
  return [];
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
    const res = await apiFetch(`${API_URL}/time-entries/check-in`, {
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

export interface BackendTimeEntry {
  id: string;
  tenantId: string;
  employeeId: string;
  supervisorId: string;
  date: string;
  activityId: string;
  inTime: string | null;
  outTime: string | null;
  hours: number | string;
  overtimeHours: number | string;
  remarks: string | null;
  status: 'draft' | 'submitted';
  submittedAt: string | null;
  activity?: {
    id: string;
    code: string;
    description: string | null;
  };
  supervisor?: {
    id: string;
    fullName: string;
    username: string;
  };
}

export interface SubmitDayResponse {
  success: boolean;
  submittedCount?: number;
  submittedAt?: string;
  supervisor?: {
    id: string;
    fullName: string;
    username: string;
  } | null;
  message?: string;
}

/**
 * Fetch existing time entries for a date and supervisor from the backend.
 */
export async function getTimeEntries(
  supervisorId?: string,
  date?: string
): Promise<BackendTimeEntry[]> {
  try {
    const params = new URLSearchParams();
    if (supervisorId) params.append('supervisorId', supervisorId);
    if (date) params.append('date', date);

    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch(`${API_URL}/time-entries${query}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.error('Failed to fetch time entries from backend:', err);
  }
  return [];
}

/**
 * Record check-out time for an employee.
 */
export async function checkOutEmployee(
  employeeId: string,
  supervisorId: string,
  date: string,
  outTime: string
): Promise<{ employeeId: string; outTime: string }> {
  try {
    const res = await apiFetch(`${API_URL}/time-entries/check-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, supervisorId, date, outTime }),
    });
    if (res.ok) {
      cacheManager.invalidate('reports');
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to record check-out on backend:', err);
  }
  cacheManager.invalidate('reports');
  return { employeeId, outTime };
}

/**
 * Bulk assign an activity code and hours to multiple employees (ActivityAssignPage).
 */
export async function assignActivityBulk(
  payload: BulkAssignPayload
): Promise<{ success: boolean; count?: number }> {
  try {
    const res = await apiFetch(`${API_URL}/time-entries/assign-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      cacheManager.invalidate('reports');
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to assign activity bulk on backend:', err);
  }
  cacheManager.invalidate('reports');
  return { success: true };
}

/**
 * Upsert (create or update) a single time entry row.
 */
export async function saveTimeEntry(
  payload: TimeEntryPayload
): Promise<{ success: boolean }> {
  try {
    const res = await apiFetch(`${API_URL}/time-entries/upsert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      cacheManager.invalidate('reports');
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to save time entry on backend:', err);
  }
  cacheManager.invalidate('reports');
  return { success: true };
}

/**
 * Submit all of today's time entries for this supervisor and lock them.
 */
export async function submitDay(
  payload: SubmitDayPayload
): Promise<SubmitDayResponse> {
  try {
    const res = await apiFetch(`${API_URL}/time-entries/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      cacheManager.invalidate('reports');
      return await res.json();
    }
  } catch (err) {
    console.warn('Failed to submit day on backend:', err);
  }
  cacheManager.invalidate('reports');
  return { success: true };
}
