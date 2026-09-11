/**
 * businessPartnerService.ts
 *
 * Real API service for Business Partners (contractors & subcontractors)
 * connected to backend PostgreSQL, with fallback to in-memory mock data
 * when backend is offline.
 *
 * Backend endpoints:
 *   GET    /api/business-partners                 -> getAll()
 *   GET    /api/business-partners/:id             -> getById(id)
 *   GET    /api/business-partners/next-code       -> getNextPartnerCode()
 *   POST   /api/business-partners                 -> create(data)
 *   PUT    /api/business-partners/:id             -> update(id, data)
 *   PATCH  /api/business-partners/:id/status      -> toggleStatus(id)
 *   DELETE /api/business-partners/:id             -> remove(id)
 */

export interface BusinessPartner {
  id: string;
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status: 'active' | 'inactive';
  createdAt?: string;
  employeeCount?: number;
}

export interface BusinessPartnerFormData {
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  status?: 'active' | 'inactive';
}

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';

// Backend response mapper
function mapPartner(raw: any): BusinessPartner {
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    contactPerson: raw.contactPerson || raw.contact_person || undefined,
    phone: raw.phone || undefined,
    email: raw.email || undefined,
    address: raw.address || undefined,
    status: raw.status === 'inactive' ? 'inactive' : 'active',
    createdAt: raw.createdAt || raw.created_at || undefined,
    employeeCount: raw.employeeCount ?? raw._count?.employees ?? undefined,
  };
}

export async function getNextPartnerCode(): Promise<string> {
  const res = await apiFetch(`${API_URL}/business-partners/next-code`);
  if (res.ok) {
    const data = await res.json();
    return data.nextCode as string;
  }
  return 'BP1001001';
}

export async function getAll(): Promise<BusinessPartner[]> {
  return cacheManager.fetchWithCache('business-partners:list', async () => {
    const res = await apiFetch(`${API_URL}/business-partners`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Failed to fetch business partners (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) return data.map(mapPartner);
    return [];
  });
}

export async function getById(id: string): Promise<BusinessPartner | undefined> {
  return cacheManager.fetchWithCache(`business-partners:id:${id}`, async () => {
    const res = await apiFetch(`${API_URL}/business-partners/${encodeURIComponent(id)}`);
    if (res.status === 404) return undefined;
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Failed to fetch business partner (${res.status})`);
    }
    return mapPartner(await res.json());
  });
}

export async function create(data: BusinessPartnerFormData): Promise<BusinessPartner> {
  const res = await apiFetch(`${API_URL}/business-partners`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to create business partner');
  }
  cacheManager.invalidate('business-partners');
  cacheManager.invalidate('reports');
  return mapPartner(await res.json());
}

export async function update(id: string, data: Partial<BusinessPartnerFormData>): Promise<BusinessPartner> {
  const res = await apiFetch(`${API_URL}/business-partners/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to update business partner');
  }
  cacheManager.invalidate('business-partners');
  cacheManager.invalidate('reports');
  return mapPartner(await res.json());
}

export async function remove(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/business-partners/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to delete business partner');
  }
  cacheManager.invalidate('business-partners');
  cacheManager.invalidate('reports');
}

export async function toggleStatus(id: string, currentStatus: 'active' | 'inactive' = 'active'): Promise<BusinessPartner> {
  const newStatus: 'active' | 'inactive' = currentStatus === 'active' ? 'inactive' : 'active';
  const res = await apiFetch(`${API_URL}/business-partners/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus }),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to update business partner status');
  }
  cacheManager.invalidate('business-partners');
  cacheManager.invalidate('reports');
  return mapPartner(await res.json());
}

