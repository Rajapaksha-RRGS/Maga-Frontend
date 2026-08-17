/**
 * supervisorService.ts
 *
 * Mock service for supervisor user management.
 * Supervisors are users with role='supervisor' in the users table.
 *
 * TODO: Replace with real API calls:
 *   getAll()         → GET    /api/supervisors
 *   create(data)     → POST   /api/supervisors
 *   resetPassword()  → POST   /api/supervisors/:id/reset-password
 *   deactivate()     → PATCH  /api/supervisors/:id/status
 */
import * as empSvc from '../../employees/services/employeeService';
import type { Employee } from '../../employees/services/employeeService';

export interface Supervisor {
  id: string;
  fullName: string;
  username: string;
  status: 'active' | 'inactive';
  /** If the supervisor is also a tracked worker, linked employee ID */
  linkedEmployeeId: string | null;
  linkedEmployeeName: string | null;
}

export interface SupervisorCreateData {
  fullName: string;
  username: string;
  linkedEmployeeId: string | null;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 4;

const SUPERVISORS: Supervisor[] = [
  { id: 'user-002', fullName: 'Kamal Perera',        username: 'supervisor1',  status: 'active', linkedEmployeeId: 'emp-001', linkedEmployeeName: 'Kamal Perera' },
  { id: 'sup-002',  fullName: 'Ruwan Jayasinghe',    username: 'supervisor2',  status: 'active', linkedEmployeeId: null, linkedEmployeeName: null },
  { id: 'sup-003',  fullName: 'Chaminda Wijesekara', username: 'supervisor3',  status: 'active', linkedEmployeeId: null, linkedEmployeeName: null },
];

/** Generate a random temporary password */
function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export async function getAll(): Promise<Supervisor[]> {
  await delay(300);
  return [...SUPERVISORS];
}

/** Returns the supervisor and the generated temporary password (shown once). */
export async function create(data: SupervisorCreateData): Promise<{ supervisor: Supervisor; tempPassword: string }> {
  await delay(400);
  const tempPassword = generateTempPassword();
  let linkedName: string | null = null;
  if (data.linkedEmployeeId) {
    const emp = await empSvc.getById(data.linkedEmployeeId);
    linkedName = emp?.callingName ?? null;
  }
  const sup: Supervisor = {
    id: `sup-${String(nextId++).padStart(3, '0')}`,
    fullName: data.fullName,
    username: data.username,
    status: 'active',
    linkedEmployeeId: data.linkedEmployeeId,
    linkedEmployeeName: linkedName,
  };
  SUPERVISORS.push(sup);
  return { supervisor: sup, tempPassword };
}

/** Returns the new temporary password (shown once). */
export async function resetPassword(id: string): Promise<string> {
  await delay(400);
  const idx = SUPERVISORS.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error('Supervisor not found');
  return generateTempPassword();
}

export async function deactivate(id: string): Promise<Supervisor> {
  await delay(300);
  const idx = SUPERVISORS.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error('Supervisor not found');
  SUPERVISORS[idx].status = 'inactive';
  return SUPERVISORS[idx];
}

/** Get all active employees for the "link to employee" picker */
export async function getAvailableEmployees(): Promise<Employee[]> {
  const all = await empSvc.getAll();
  return all.filter((e) => e.status === 'active');
}
