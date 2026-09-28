/**
 * assignmentService.ts
 *
 * Real API service for daily supervisor-employee gang assignments connected to backend PostgreSQL,
 * with fallback to mock data when backend is offline.
 *
 * Backend endpoints:
 *   GET    /api/assignments?date=YYYY-MM-DD
 *   GET    /api/assignments/recent-gangs?days=5
 *   POST   /api/assignments
 *   POST   /api/assignments/copy
 *   DELETE /api/assignments/:id
 */
import * as empSvc from '../../employees/services/employeeService';
import * as supSvc from '../../supervisors/services/supervisorService';
import * as equipSvc from '../../equipment/services/equipmentService';
import type { Employee } from '../../employees/services/employeeService';
import type { Supervisor } from '../../supervisors/services/supervisorService';
import type { Equipment } from '../../equipment/services/equipmentService';

export interface Assignment {
  id: string;
  date: string;
  supervisorId: string;
  employeeId: string;
}

export interface RecentGangSummary {
  date: string;
  totalWorkers: number;
  supervisorsCount: number;
  gangs: {
    supervisorId: string;
    supervisorName: string;
    workerCount: number;
  }[];
}

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';

export async function getForDate(date: string, forceRefresh: boolean = false): Promise<Assignment[]> {
  return cacheManager.fetchWithCache(`assignments:date:${date}`, async () => {
    const res = await apiFetch(`${API_URL}/assignments?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Failed to fetch assignments (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((a: any) => ({
        id: a.id,
        date: a.date || date,
        supervisorId: a.supervisorId,
        employeeId: a.employeeId,
      }));
    }
    return [];
  }, null, forceRefresh);
}

export async function assign(date: string, supervisorId: string, employeeIds: string[]): Promise<Assignment[]> {
  const res = await apiFetch(`${API_URL}/assignments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, supervisorId, employeeIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to assign employees');
  }
  const data = await res.json();
  cacheManager.invalidate('assignments');
  cacheManager.invalidate('dashboard');
  return data.assignments || [];
}

export async function unassign(_date: string, assignmentId: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/assignments/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to remove assignment');
  }
  cacheManager.invalidate('assignments');
  cacheManager.invalidate('dashboard');
}

export async function copyFromDate(sourceDate: string, destDate: string, supervisorIds?: string[], overwrite: boolean = true): Promise<number> {
  const res = await apiFetch(`${API_URL}/assignments/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceDate, targetDate: destDate, supervisorIds, overwrite }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to copy gang assignments');
  }
  const data = await res.json();
  cacheManager.invalidate('assignments');
  cacheManager.invalidate('dashboard');
  return data.copiedCount ?? 0;
}

export async function getRecentGangSummaries(days: number = 5, beforeDate?: string): Promise<RecentGangSummary[]> {
  const params = new URLSearchParams();
  params.append('days', String(days));
  if (beforeDate) params.append('before', beforeDate);

  const res = await apiFetch(`${API_URL}/assignments/recent-gangs?${params.toString()}`);
  if (!res.ok) {
    return [];
  }
  const data = await res.json();
  if (Array.isArray(data)) {
    return beforeDate ? data.filter((d: RecentGangSummary) => d.date < beforeDate) : data;
  }
  return [];
}

export async function bulkAssign(
  date: string,
  supervisorId: string,
  filter: { tradeGroup?: string; businessPartner?: string }
): Promise<number> {
  const allEmps = await empSvc.getAll();
  const existing = await getForDate(date);
  const assignedIds = new Set(existing.map((a) => a.employeeId));

  const matching = allEmps.filter((e) => {
    if (e.status !== 'active') return false;
    if (assignedIds.has(e.id)) return false;
    if (filter.tradeGroup && e.tradeGroup !== filter.tradeGroup) return false;
    if (filter.businessPartner && e.businessPartner !== filter.businessPartner) return false;
    return true;
  });

  if (matching.length > 0) {
    await assign(date, supervisorId, matching.map((e) => e.id));
  }
  return matching.length;
}

/** Helper: get all employees and supervisors for the assignment UI */
export async function getAssignmentContext(forceRefresh: boolean = false): Promise<{
  employees: Employee[];
  supervisors: Supervisor[];
}> {
  return cacheManager.fetchWithCache('assignments:context', async () => {
    const [employees, supervisors] = await Promise.all([empSvc.getAll(undefined, forceRefresh), supSvc.getAll(forceRefresh)]);
    return {
      employees: employees.filter((e) => e.status === 'active'),
      supervisors: supervisors.filter((s) => s.status === 'active'),
    };
  }, null, forceRefresh);
}

// ─────────────────────────────────────────────────────────────────────────────
// OPERATOR ASSIGNMENT SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export interface OperatorAssignment {
  id: string;
  date: string;
  supervisorId: string;
  operatorId: string;
  supervisorName?: string;
  operatorName?: string;
  operatorCode?: string;
  operatorTrade?: string;
  licenseNo?: string | null;
  businessPartner?: string;
}

export async function getOperatorAssignments(date: string, forceRefresh: boolean = false): Promise<OperatorAssignment[]> {
  return cacheManager.fetchWithCache(`assignments:operator:date:${date}`, async () => {
    const res = await apiFetch(`${API_URL}/assignments/operator?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Failed to fetch operator assignments (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }, null, forceRefresh);
}

export async function assignOperators(date: string, supervisorId: string, operatorIds: string[]): Promise<OperatorAssignment[]> {
  const res = await apiFetch(`${API_URL}/assignments/operator`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, supervisorId, operatorIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to assign operators');
  }
  const data = await res.json();
  cacheManager.invalidate('assignments');
  return data.assignments || [];
}

export async function unassignOperator(assignmentId: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/assignments/operator/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to remove operator assignment');
  }
  cacheManager.invalidate('assignments');
}

export async function copyOperatorGangsFromDate(
  sourceDate: string,
  destDate: string,
  supervisorIds?: string[],
  overwrite: boolean = true
): Promise<number> {
  const res = await apiFetch(`${API_URL}/assignments/operator/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceDate, targetDate: destDate, supervisorIds, overwrite }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to copy operator gang assignments');
  }
  const data = await res.json();
  cacheManager.invalidate('assignments');
  return data.copiedCount ?? 0;
}

export async function getOperatorAssignmentContext(forceRefresh: boolean = false): Promise<{
  operators: Employee[];
  supervisors: Supervisor[];
}> {
  return cacheManager.fetchWithCache('assignments:operator:context', async () => {
    const [employees, supervisors] = await Promise.all([
      empSvc.getAll(undefined, forceRefresh),
      supSvc.getAll(forceRefresh),
    ]);
    const operators = employees.filter((e) => e.status === 'active' && Boolean(e.isOperator || e.tradeGroup?.toLowerCase() === 'operator'));
    return {
      operators,
      supervisors: supervisors.filter((s) => s.status === 'active'),
    };
  }, null, forceRefresh);
}

// ─────────────────────────────────────────────────────────────────────────────
// EQUIPMENT ASSIGNMENT SERVICE
// ─────────────────────────────────────────────────────────────────────────────

export interface EquipmentAssignment {
  id: string;
  date: string;
  supervisorId: string;
  equipmentId: string;
  supervisorName?: string;
  equipmentName?: string;
  equipmentCode?: string;
  equipmentType?: string;
  costRate?: number;
}

export async function getEquipmentAssignments(date: string, forceRefresh: boolean = false): Promise<EquipmentAssignment[]> {
  return cacheManager.fetchWithCache(`assignments:equipment:date:${date}`, async () => {
    const res = await apiFetch(`${API_URL}/assignments/equipment?date=${encodeURIComponent(date)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Failed to fetch equipment assignments (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data;
    }
    return [];
  }, null, forceRefresh);
}

export async function assignEquipment(date: string, supervisorId: string, equipmentIds: string[]): Promise<EquipmentAssignment[]> {
  const res = await apiFetch(`${API_URL}/assignments/equipment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date, supervisorId, equipmentIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to assign equipment');
  }
  const data = await res.json();
  cacheManager.invalidate('assignments');
  return data.assignments || [];
}

export async function unassignEquipment(assignmentId: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/assignments/equipment/${encodeURIComponent(assignmentId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to remove equipment assignment');
  }
  cacheManager.invalidate('assignments');
}

export async function copyEquipmentGangsFromDate(
  sourceDate: string,
  destDate: string,
  supervisorIds?: string[],
  overwrite: boolean = true
): Promise<number> {
  const res = await apiFetch(`${API_URL}/assignments/equipment/copy`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sourceDate, targetDate: destDate, supervisorIds, overwrite }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to copy equipment gang assignments');
  }
  const data = await res.json();
  cacheManager.invalidate('assignments');
  return data.copiedCount ?? 0;
}

export async function getEquipmentAssignmentContext(forceRefresh: boolean = false): Promise<{
  equipmentList: Equipment[];
  supervisors: Supervisor[];
}> {
  return cacheManager.fetchWithCache('assignments:equipment:context', async () => {
    const [equipmentList, supervisors] = await Promise.all([
      equipSvc.getAll(),
      supSvc.getAll(forceRefresh),
    ]);
    return {
      equipmentList: equipmentList.filter((e) => e.status === 'active'),
      supervisors: supervisors.filter((s) => s.status === 'active'),
    };
  }, null, forceRefresh);
}


