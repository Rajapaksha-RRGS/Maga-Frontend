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

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';

export async function getAll(forceRefresh: boolean = false): Promise<Supervisor[]> {
  return cacheManager.fetchWithCache('supervisors:list', async () => {
    const res = await apiFetch(`${API_URL}/supervisors`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.message || `Failed to fetch supervisors (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((s: any) => ({
        id: s.id,
        fullName: s.fullName,
        username: s.username,
        status: s.status || 'active',
        linkedEmployeeId: s.linkedEmployeeId || s.employeeId || null,
        linkedEmployeeName: s.linkedEmployeeName || null,
      }));
    }
    return [];
  }, null, forceRefresh);
}

/** Returns the supervisor and the generated temporary password (shown once). */
export async function create(data: SupervisorCreateData): Promise<{ supervisor: Supervisor; tempPassword: string }> {
  const res = await apiFetch(`${API_URL}/supervisors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.message || 'Failed to create supervisor');
  }
  const result = await res.json();
  cacheManager.invalidate('supervisors');
  cacheManager.invalidate('dashboard');
  cacheManager.invalidate('assignments:context');
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

/** Returns the new temporary password (shown once). */
export async function resetPassword(id: string): Promise<string> {
  const res = await apiFetch(`${API_URL}/supervisors/${encodeURIComponent(id)}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.message || 'Failed to reset password');
  }
  const data = await res.json();
  return data.tempPassword;
}

export async function deactivate(id: string): Promise<Supervisor> {
  const res = await apiFetch(`${API_URL}/supervisors/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'inactive' }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.message || 'Failed to deactivate supervisor');
  }
  const updated = await res.json();
  cacheManager.invalidate('supervisors');
  cacheManager.invalidate('dashboard');
  cacheManager.invalidate('assignments:context');
  return {
    id: updated.id,
    fullName: updated.fullName,
    username: updated.username,
    status: 'inactive',
    linkedEmployeeId: updated.employeeId || null,
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
  cacheManager.invalidate('dashboard');
  cacheManager.invalidate('assignments:context');
}

