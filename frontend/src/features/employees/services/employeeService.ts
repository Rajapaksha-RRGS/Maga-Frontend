/**
 * employeeService.ts
 *
 * Real API service for employee CRUD connected to backend PostgreSQL,
 * with fallback to in-memory mock data when backend is offline.
 *
 * Backend endpoints:
 *   GET    /api/employees          → getAll()
 *   GET    /api/employees/:id      → getById(id)
 *   POST   /api/employees          → create(data)
 *   PUT    /api/employees/:id      → update(id, data)
 *   PATCH  /api/employees/:id/status → deactivate(id)
 *   DELETE /api/employees/:id      → deleteEmployee(id)
 *
 * Field mapping note:
 *   Backend returns `businessPartner: { id, name, ... }` (Prisma include).
 *   Frontend Employee interface uses `businessPartner: string` (the name).
 *   The `mapEmployee()` helper handles this flattening.
 */

export interface Employee {
  id: string;
  employeeCode?: string;
  callingName: string;
  fullName: string;
  businessPartner: string;
  businessPartnerId?: string;
  tradeGroup: string;
  nicNo: string;
  dailyRate?: number;
  epfNo?: string;
  status: 'active' | 'inactive';
}

export interface EmployeeFormData {
  employeeCode?: string;
  callingName?: string;
  fullName?: string;
  businessPartnerId: string;
  businessPartner?: string;
  tradeGroup: string;
  nicNo: string;
  dailyRate: number;
  epfNo?: string;
  status?: 'active' | 'inactive';
}

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';


function mapEmployee(raw: any): Employee {
  return {
    id: raw.id,
    employeeCode: raw.employeeCode || raw.employee_code || raw.id,
    callingName: raw.callingName || raw.calling_name || '',
    fullName: raw.fullName || raw.full_name || '',
    businessPartnerId: raw.businessPartnerId || raw.business_partner_id || (raw.businessPartner?.id ?? undefined),
    // Backend returns nested businessPartner object OR just a string name
    businessPartner:
      typeof raw.businessPartner === 'object' && raw.businessPartner !== null
        ? raw.businessPartner.name
        : (raw.businessPartner as string) || '',
    tradeGroup: raw.tradeGroup || raw.trade_group || '',
    nicNo: raw.nicNo || raw.nic_no || '',
    dailyRate: raw.dailyRate !== undefined ? Number(raw.dailyRate) : 1400,
    epfNo: raw.epfNo || raw.epf_no || '',
    status: raw.status === 'inactive' ? 'inactive' : 'active',
  };
}

// ── Service functions (Backend Only) ──────────────────────────────────────────

export interface EmployeeQueryFilters {
  status?: string;
  tradeGroup?: string;
  businessPartner?: string;
}

/** Fetch all employees from backend with optional filters (Cached for session) */
export async function getAll(filters?: EmployeeQueryFilters, forceRefresh: boolean = false): Promise<Employee[]> {
  const cacheKey = `employees:list:${JSON.stringify(filters || {})}`;

  return cacheManager.fetchWithCache(
    cacheKey,
    async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.tradeGroup) params.append('tradeGroup', filters.tradeGroup);
      if (filters?.businessPartner) params.append('businessPartner', filters.businessPartner);

      const query = params.toString() ? `?${params.toString()}` : '';
      const res = await apiFetch(`${API_URL}/employees${query}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || `Failed to fetch employees (${res.status})`);
      }
      const data = await res.json();
      if (Array.isArray(data)) {
        return data.map(mapEmployee);
      }
      return [];
    },
    null,
    forceRefresh
  );
}

/** Fetch a single employee by ID from backend (Cached) */
export async function getById(id: string): Promise<Employee | undefined> {
  const cacheKey = `employees:id:${id}`;

  return cacheManager.fetchWithCache(cacheKey, async () => {
    const res = await apiFetch(`${API_URL}/employees/${encodeURIComponent(id)}`);
    if (res.status === 404) return undefined;
    if (!res.ok) {
      const errData = await res.json().catch(() => null);
      throw new Error(errData?.error || `Failed to fetch employee (${res.status})`);
    }
    const data = await res.json();
    return mapEmployee(data);
  });
}

/** Create employee on backend */
export async function create(data: EmployeeFormData): Promise<Employee> {
  const response = await apiFetch(`${API_URL}/employees`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const errData = await response.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to create employee');
  }
  const newEmployee = await response.json();
  cacheManager.invalidate('employees');
  cacheManager.invalidate('reports');
  cacheManager.invalidate('dashboard');
  cacheManager.invalidate('assignments:context');
  return mapEmployee(newEmployee);
}

/** Update employee on backend */
export async function update(id: string, data: Partial<EmployeeFormData>): Promise<Employee> {
  const res = await apiFetch(`${API_URL}/employees/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to update employee');
  }
  const updated = await res.json();
  cacheManager.invalidate('employees');
  cacheManager.invalidate('reports');
  cacheManager.invalidate('dashboard');
  cacheManager.invalidate('assignments:context');
  return mapEmployee(updated);
}

/** Update employee status on backend ('active' | 'inactive') */
export async function updateStatus(id: string, status: 'active' | 'inactive'): Promise<Employee> {
  const res = await apiFetch(`${API_URL}/employees/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Failed to ${status === 'active' ? 'activate' : 'deactivate'} employee`);
  }
  const updated = await res.json();
  cacheManager.invalidate('employees');
  cacheManager.invalidate('reports');
  cacheManager.invalidate('dashboard');
  cacheManager.invalidate('assignments:context');
  return mapEmployee(updated);
}

/** Activate employee on backend */
export async function activate(id: string): Promise<Employee> {
  return updateStatus(id, 'active');
}

/** Deactivate employee on backend */
export async function deactivate(id: string): Promise<Employee> {
  return updateStatus(id, 'inactive');
}

/** Delete an employee by ID on backend */
export async function deleteEmployee(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/employees/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to delete employee');
  }
  cacheManager.invalidate('employees');
  cacheManager.invalidate('reports');
  cacheManager.invalidate('dashboard');
  cacheManager.invalidate('assignments:context');
}

/** Unique business partners derived dynamically from employee data */
export function getBusinessPartners(employees?: Employee[]): string[] {
  if (!employees || employees.length === 0) return [];
  return [...new Set(employees.map((e) => e.businessPartner).filter((bp): bp is string => Boolean(bp?.trim())))].sort();
}

/** Unique trade groups derived dynamically from employee data */
export function getTradeGroups(employees?: Employee[]): string[] {
  if (!employees || employees.length === 0) return [];
  return [...new Set(employees.map((e) => e.tradeGroup).filter((tg): tg is string => Boolean(tg?.trim())))].sort();
}

