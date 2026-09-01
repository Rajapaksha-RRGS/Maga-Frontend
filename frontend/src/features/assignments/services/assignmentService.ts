/**
 * assignmentService.ts
 *
 * Mock service for daily supervisor-employee assignments.
 *
 * TODO: Replace with real API calls:
 *   getForDate(date)         → GET    /api/assignments?date=YYYY-MM-DD
 *   assign(date, supId, empIds) → POST /api/assignments
 *   unassign(id)             → DELETE /api/assignments/:id
 *   copyFromDate(src, dest)  → POST   /api/assignments/copy
 *   bulkAssign(...)          → POST   /api/assignments/bulk
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

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 10;

// In-memory assignments keyed by date string
const ASSIGNMENTS: Map<string, Assignment[]> = new Map();

// Pre-populate some assignments for today
function initToday() {
  const today = formatDate(new Date());
  ASSIGNMENTS.set(today, [
    { id: 'asgn-001', date: today, supervisorId: 'user-002', employeeId: 'HI101' },
    { id: 'asgn-002', date: today, supervisorId: 'user-002', employeeId: 'HI201' },
    { id: 'asgn-003', date: today, supervisorId: 'user-002', employeeId: 'HI301' },
    { id: 'asgn-004', date: today, supervisorId: 'sup-002',  employeeId: 'HI501' },
    { id: 'asgn-005', date: today, supervisorId: 'sup-002',  employeeId: 'HI401' },
  ]);
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

initToday();

export async function getForDate(date: string): Promise<Assignment[]> {
  await delay(200);
  return [...(ASSIGNMENTS.get(date) ?? [])];
}

export async function assign(date: string, supervisorId: string, employeeIds: string[]): Promise<Assignment[]> {
  await delay(300);
  const existing = ASSIGNMENTS.get(date) ?? [];
  const created: Assignment[] = [];
  for (const empId of employeeIds) {
    // Skip if already assigned
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
  return created;
}

export async function unassign(date: string, assignmentId: string): Promise<void> {
  await delay(200);
  const existing = ASSIGNMENTS.get(date) ?? [];
  ASSIGNMENTS.set(date, existing.filter((a) => a.id !== assignmentId));
}

export async function copyFromDate(sourceDate: string, destDate: string): Promise<number> {
  await delay(400);
  const source = ASSIGNMENTS.get(sourceDate) ?? [];
  const destExisting = ASSIGNMENTS.get(destDate) ?? [];
  let count = 0;
  for (const a of source) {
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
  return count;
}

export async function bulkAssign(
  date: string,
  supervisorId: string,
  filter: { tradeGroup?: string; businessPartner?: string }
): Promise<number> {
  await delay(400);
  const allEmps = await empSvc.getAll();
  const existing = ASSIGNMENTS.get(date) ?? [];
  const assignedIds = new Set(existing.map((a) => a.employeeId));

  const matching = allEmps.filter((e) => {
    if (e.status !== 'active') return false;
    if (assignedIds.has(e.id)) return false;
    if (filter.tradeGroup && e.tradeGroup !== filter.tradeGroup) return false;
    if (filter.businessPartner && e.businessPartner !== filter.businessPartner) return false;
    return true;
  });

  for (const emp of matching) {
    existing.push({
      id: `asgn-${String(nextId++).padStart(3, '0')}`,
      date,
      supervisorId,
      employeeId: emp.id,
    });
  }
  ASSIGNMENTS.set(date, existing);
  return matching.length;
}

/** Helper: get all employees and supervisors for the assignment UI */
export async function getAssignmentContext(): Promise<{
  employees: Employee[];
  supervisors: Supervisor[];
}> {
  const [employees, supervisors] = await Promise.all([empSvc.getAll(), supSvc.getAll()]);
  return {
    employees: employees.filter((e) => e.status === 'active'),
    supervisors: supervisors.filter((s) => s.status === 'active'),
  };
}
