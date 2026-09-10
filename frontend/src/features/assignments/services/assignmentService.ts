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
import type { Employee } from '../../employees/services/employeeService';
import type { Supervisor } from '../../supervisors/services/supervisorService';

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

import { API_URL } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 10;

// In-memory fallback
const ASSIGNMENTS: Map<string, Assignment[]> = new Map();

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Pre-populate some assignments for today and past days for demo/offline resilience
function initMockData() {
  const today = formatDate(new Date());
  ASSIGNMENTS.set(today, [
    { id: 'asgn-001', date: today, supervisorId: 'sup-001', employeeId: 'HK030' },
    { id: 'asgn-002', date: today, supervisorId: 'sup-001', employeeId: 'HK031' },
    { id: 'asgn-003', date: today, supervisorId: 'sup-002', employeeId: 'HI101' },
  ]);

  // Yesterday
  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yestStr = formatDate(yest);
  ASSIGNMENTS.set(yestStr, [
    { id: 'asgn-y1', date: yestStr, supervisorId: 'sup-001', employeeId: 'HK030' },
    { id: 'asgn-y2', date: yestStr, supervisorId: 'sup-001', employeeId: 'HK031' },
    { id: 'asgn-y3', date: yestStr, supervisorId: 'sup-002', employeeId: 'HI101' },
    { id: 'asgn-y4', date: yestStr, supervisorId: 'sup-002', employeeId: 'HI102' },
  ]);

  // 2 days ago
  const d2 = new Date();
  d2.setDate(d2.getDate() - 2);
  const d2Str = formatDate(d2);
  ASSIGNMENTS.set(d2Str, [
    { id: 'asgn-d2-1', date: d2Str, supervisorId: 'sup-001', employeeId: 'HK030' },
    { id: 'asgn-d2-2', date: d2Str, supervisorId: 'sup-002', employeeId: 'HI101' },
  ]);
}

initMockData();

export async function getForDate(date: string): Promise<Assignment[]> {
  return cacheManager.fetchWithCache(`assignments:date:${date}`, async () => {
    try {
      const res = await fetch(`${API_URL}/assignments?date=${encodeURIComponent(date)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((a: any) => ({
            id: a.id,
            date: a.date || date,
            supervisorId: a.supervisorId,
            employeeId: a.employeeId,
          }));
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using fallback assignments:', err);
    }
    await delay(200);
    return [...(ASSIGNMENTS.get(date) ?? [])];
  });
}

export async function assign(date: string, supervisorId: string, employeeIds: string[]): Promise<Assignment[]> {
  try {
    const res = await fetch(`${API_URL}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, supervisorId, employeeIds }),
    });
    if (res.ok) {
      const data = await res.json();
      cacheManager.invalidate('assignments');
      cacheManager.invalidate('dashboard');
      return data.assignments || [];
    }
  } catch (err) {
    console.warn('Backend unavailable, assigning locally:', err);
  }

  await delay(300);
  const existing = ASSIGNMENTS.get(date) ?? [];
  const created: Assignment[] = [];
  for (const empId of employeeIds) {
    if (existing.some((a) => a.employeeId === empId)) continue;
    const a: Assignment = {
      id: `asgn-${String(nextId++).padStart(3, '0')}`,
      date,
      supervisorId,
      employeeId: empId,
    };
    existing.push(a);
    created.push(a);
  }
  ASSIGNMENTS.set(date, existing);
  cacheManager.invalidate('assignments');
  cacheManager.invalidate('dashboard');
  return created;
}

export async function unassign(date: string, assignmentId: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/assignments/${encodeURIComponent(assignmentId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      cacheManager.invalidate('assignments');
      cacheManager.invalidate('dashboard');
      return;
    }
  } catch (err) {
    console.warn('Backend unavailable, unassigning locally:', err);
  }

  await delay(200);
  const existing = ASSIGNMENTS.get(date) ?? [];
  ASSIGNMENTS.set(date, existing.filter((a) => a.id !== assignmentId));
  cacheManager.invalidate('assignments');
  cacheManager.invalidate('dashboard');
}

export async function copyFromDate(sourceDate: string, destDate: string, supervisorIds?: string[]): Promise<number> {
  try {
    const res = await fetch(`${API_URL}/assignments/copy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceDate, targetDate: destDate, supervisorIds }),
    });
    if (res.ok) {
      const data = await res.json();
      cacheManager.invalidate('assignments');
      cacheManager.invalidate('dashboard');
      return data.copiedCount ?? 0;
    }
  } catch (err) {
    console.warn('Backend unavailable, copying locally:', err);
  }

  await delay(400);
  const source = ASSIGNMENTS.get(sourceDate) ?? [];
  const destExisting = ASSIGNMENTS.get(destDate) ?? [];
  let count = 0;
  for (const a of source) {
    if (supervisorIds && supervisorIds.length > 0 && !supervisorIds.includes(a.supervisorId)) {
      continue;
    }
    if (!destExisting.some((d) => d.employeeId === a.employeeId)) {
      destExisting.push({
        id: `asgn-${String(nextId++).padStart(3, '0')}`,
        date: destDate,
        supervisorId: a.supervisorId,
        employeeId: a.employeeId,
      });
      count++;
    }
  }
  ASSIGNMENTS.set(destDate, destExisting);
  cacheManager.invalidate('assignments');
  cacheManager.invalidate('dashboard');
  return count;
}

export async function getRecentGangSummaries(days: number = 5): Promise<RecentGangSummary[]> {
  try {
    const res = await fetch(`${API_URL}/assignments/recent-gangs?days=${days}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, generating local recent gang summaries:', err);
  }

  await delay(200);
  // Fallback generation from local dates
  const result: RecentGangSummary[] = [];
  const today = new Date();
  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = formatDate(d);
    const list = ASSIGNMENTS.get(dateStr) ?? [];
    if (list.length > 0) {
      result.push({
        date: dateStr,
        totalWorkers: list.length,
        supervisorsCount: new Set(list.map((a) => a.supervisorId)).size,
        gangs: [
          { supervisorId: 'sup-001', supervisorName: 'Site Supervisor', workerCount: list.length },
        ],
      });
    }
  }
  return result;
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
export async function getAssignmentContext(): Promise<{
  employees: Employee[];
  supervisors: Supervisor[];
}> {
  return cacheManager.fetchWithCache('assignments:context', async () => {
    const [employees, supervisors] = await Promise.all([empSvc.getAll(), supSvc.getAll()]);
    return {
      employees: employees.filter((e) => e.status === 'active'),
      supervisors: supervisors.filter((s) => s.status === 'active'),
    };
  });
}
