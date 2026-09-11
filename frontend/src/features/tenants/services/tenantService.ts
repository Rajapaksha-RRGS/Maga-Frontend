/**
 * tenantService.ts
 *
 * Real API service for Multi-Tenant management connected to backend PostgreSQL,
 * with resilient mock fallback when backend is offline.
 *
 * Backend endpoints:
 *   GET    /api/tenants
 *   POST   /api/tenants/register
 *   GET    /api/tenants/:id
 *   PUT    /api/tenants/:id
 *   PATCH  /api/tenants/:id/status
 *   POST   /api/tenants/:id/reset-admin-password
 */

export interface TenantAdmin {
  id: string;
  username: string;
  fullName: string;
  status: string;
}

export interface TenantRecord {
  id: string;
  companyName: string;
  subdomain: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  fax?: string;
  email?: string;
  status: 'active' | 'suspended';
  createdAt: string;
  userCount?: number;
  employeeCount?: number;
  primaryAdmin?: TenantAdmin | null;
}

export interface TenantRegisterInput {
  companyName: string;
  subdomain: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  fax?: string;
  email?: string;
  adminFullName: string;
  adminUsername: string;
  adminPassword?: string;
}

export interface TenantUpdateInput {
  companyName: string;
  addressLine1?: string;
  addressLine2?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';

export function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digits = '23456789';
  const special = '!@#$%&*';

  let pwd = '';
  pwd += upper[Math.floor(Math.random() * upper.length)];
  pwd += lower[Math.floor(Math.random() * lower.length)];
  pwd += digits[Math.floor(Math.random() * digits.length)];
  pwd += special[Math.floor(Math.random() * special.length)];

  const all = upper + lower + digits + special;
  for (let i = 0; i < 6; i++) {
    pwd += all[Math.floor(Math.random() * all.length)];
  }
  return pwd;
}

export async function getAllTenants(): Promise<TenantRecord[]> {
  return cacheManager.fetchWithCache('tenants:list', async () => {
    try {
      const res = await apiFetch(`${API_URL}/tenants`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (err) {
      console.error('Failed to fetch tenants:', err);
    }
    return [];
  });
}

export async function registerTenant(
  input: TenantRegisterInput
): Promise<{ tenant: TenantRecord; tempPassword?: string }> {
  const res = await apiFetch(`${API_URL}/tenants/register`, {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (res.ok) {
    const data = await res.json();
    cacheManager.invalidate('tenants');
    return {
      tenant: data.tenant,
      tempPassword: data.tempPassword,
    };
  } else {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to register tenant');
  }
}

export async function updateTenant(
  id: string,
  input: TenantUpdateInput
): Promise<TenantRecord> {
  const res = await apiFetch(`${API_URL}/tenants/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
  if (res.ok) {
    cacheManager.invalidate('tenants');
    return await res.json();
  }
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || 'Failed to update tenant');
}

export async function toggleTenantStatus(
  id: string,
  newStatus: 'active' | 'suspended'
): Promise<TenantRecord> {
  const res = await apiFetch(`${API_URL}/tenants/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: newStatus }),
  });
  if (res.ok) {
    cacheManager.invalidate('tenants');
    return await res.json();
  }
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || 'Failed to update tenant status');
}

export async function resetTenantAdminPassword(
  id: string
): Promise<{ tempPassword: string; adminName: string }> {
  const res = await apiFetch(`${API_URL}/tenants/${id}/reset-admin-password`, {
    method: 'POST',
  });
  if (res.ok) {
    const data = await res.json();
    return {
      tempPassword: data.tempPassword,
      adminName: data.adminName || 'Admin',
    };
  }
  const err = await res.json().catch(() => ({}));
  throw new Error(err.error || 'Failed to reset admin password');
}
