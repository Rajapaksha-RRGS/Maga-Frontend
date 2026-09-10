/**
 * supervisorService.ts
 *
 * Real API service for supervisor user management connected to backend PostgreSQL,
 * with fallback to mock data when backend is offline.
 *
 * Backend endpoints:
 *   GET    /api/supervisors
 *   POST   /api/supervisors
 *   POST   /api/supervisors/:id/reset-password
 *   PATCH  /api/supervisors/:id/status
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

import { API_URL } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 4;

const SUPERVISORS: Supervisor[] = [
  { id: 'sup-001', fullName: 'Ruwan Jayasinghe (Site Supervisor)', username: 'supervisor1', status: 'active', linkedEmployeeId: null, linkedEmployeeName: null },
  { id: 'sup-002', fullName: 'Chaminda Wijesekara (Site Supervisor)', username: 'supervisor2', status: 'active', linkedEmployeeId: null, linkedEmployeeName: null },
  { id: 'sup-003', fullName: 'Nimal Bandara (Site Supervisor)', username: 'supervisor3', status: 'active', linkedEmployeeId: null, linkedEmployeeName: null },
];

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pw = '';
  for (let i = 0; i < 8; i++) pw += chars[Math.floor(Math.random() * chars.length)];
  return pw;
}

export async function getAll(): Promise<Supervisor[]> {
  return cacheManager.fetchWithCache('supervisors:list', async () => {
    try {
      const res = await fetch(`${API_URL}/supervisors`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((s: any) => ({
            id: s.id,
            fullName: s.fullName,
            username: s.username,
            status: s.status || 'active',
            linkedEmployeeId: s.linkedEmployeeId || s.employeeId || null,
            linkedEmployeeName: s.linkedEmployeeName || null,
          }));
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using fallback supervisors:', err);
    }
    await delay(300);
    return [...SUPERVISORS];
  });
}

/** Returns the supervisor and the generated temporary password (shown once). */
export async function create(data: SupervisorCreateData): Promise<{ supervisor: Supervisor; tempPassword: string }> {
  try {
    const res = await fetch(`${API_URL}/supervisors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const result = await res.json();
      cacheManager.invalidate('supervisors');
      return {
        supervisor: {
          id: result.supervisor.id,
          fullName: result.supervisor.fullName,
          username: result.supervisor.username,
          status: result.supervisor.status || 'active',
          linkedEmployeeId: data.linkedEmployeeId,
          linkedEmployeeName: result.linkedEmployeeName || null,
        },
        tempPassword: result.tempPassword,
      };
    }
  } catch (err) {
    console.warn('Backend unavailable, using local supervisor creation:', err);
  }

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
  cacheManager.invalidate('supervisors');
  return { supervisor: sup, tempPassword };
}

/** Returns the new temporary password (shown once). */
export async function resetPassword(id: string): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/supervisors/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      return data.tempPassword;
    }
  } catch (err) {
    console.warn('Backend unavailable, resetting password locally:', err);
  }

  await delay(400);
  return generateTempPassword();
}

export async function deactivate(id: string): Promise<Supervisor> {
  try {
    const res = await fetch(`${API_URL}/supervisors/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    if (res.ok) {
      const updated = await res.json();
      cacheManager.invalidate('supervisors');
      return {
        id: updated.id,
        fullName: updated.fullName,
        username: updated.username,
        status: 'inactive',
        linkedEmployeeId: updated.employeeId || null,
        linkedEmployeeName: null,
      };
    }
  } catch (err) {
    console.warn('Backend unavailable, deactivating supervisor locally:', err);
  }

  await delay(300);
  cacheManager.invalidate('supervisors');
  const idx = SUPERVISORS.findIndex((s) => s.id === id);
  if (idx !== -1) {
    SUPERVISORS[idx].status = 'inactive';
    return SUPERVISORS[idx];
  }
  return {
    id,
    fullName: 'Supervisor',
    username: 'supervisor',
    status: 'inactive',
    linkedEmployeeId: null,
    linkedEmployeeName: null,
  };
}

/** Get all active employees for the "link to employee" picker */
export async function getAvailableEmployees(): Promise<Employee[]> {
  const all = await empSvc.getAll();
  return all.filter((e) => e.status === 'active');
}

/** Delete supervisor by ID */
export async function deleteSupervisor(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/supervisors/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.message || 'Failed to delete supervisor');
  }
  cacheManager.invalidate('supervisors');
}

