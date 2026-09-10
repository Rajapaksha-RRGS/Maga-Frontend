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

import { API_URL } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

// In-memory fallback
let nextId = 100;
const BUSINESS_PARTNERS: BusinessPartner[] = [
  { id: 'bp-001', code: 'BP1004093', name: 'Aruna Builders (Pvt) Ltd', contactPerson: 'Mr. Aruna Jayasiri', phone: '+94 11 2789456', email: 'info@arunabuilders.lk', address: '150, High Level Road, Nugegoda', status: 'active', createdAt: '2026-01-05' },
  { id: 'bp-002', code: 'BP1001001', name: 'Maga Engineering (Pvt) Ltd', contactPerson: 'Mr. P. Bandara', phone: '+94 11 2808835', email: 'info@maga.lk', address: '200, Nawala Road, Narahenpita, Colombo 05', status: 'active', createdAt: '2026-01-10' },
  { id: 'bp-003', code: 'BP1002015', name: 'Alpha Constructions (Pvt) Ltd', contactPerson: 'Mr. N. Jayasinghe', phone: '+94 11 2548811', email: 'contact@alphacon.lk', address: '45, Kandy Road, Kelaniya', status: 'active', createdAt: '2026-01-15' },
  { id: 'bp-004', code: 'BP1003042', name: 'Beta Projects & Engineering', contactPerson: 'Mr. R. Wickramasinghe', phone: '+94 11 4321900', email: 'operations@betaprojects.lk', address: '12/A, Galle Road, Colombo 03', status: 'active', createdAt: '2026-02-01' },
  { id: 'bp-005', code: 'BP1004055', name: 'SL Labour Co-operative', contactPerson: 'Mr. K. Perera', phone: '+94 11 5678123', email: 'labour@sllc.lk', address: '78, High Level Road, Maharagama', status: 'active', createdAt: '2026-02-10' },
  { id: 'bp-006', code: 'BP1005080', name: 'BuildForce Manpower Services', contactPerson: 'Mr. A. Fernando', phone: '+94 11 7890123', email: 'info@buildforce.lk', address: '105, Negombo Road, Ja-Ela', status: 'inactive', createdAt: '2026-02-20' },
];

export async function getNextPartnerCode(): Promise<string> {
  try {
    const res = await fetch(`${API_URL}/business-partners/next-code`);
    if (res.ok) {
      const data = await res.json();
      return data.nextCode as string;
    }
  } catch (err) {
    console.warn('Backend unavailable, computing next BP code locally:', err);
  }
  const nums = BUSINESS_PARTNERS
    .map((bp) => bp.code.toUpperCase())
    .filter((c) => /^BP1\d{6}$/.test(c))
    .map((c) => parseInt(c.slice(3), 10));
  const max = nums.length > 0 ? Math.max(...nums) : 4093;
  return `BP1${String(max + 1).padStart(6, '0')}`;
}

export async function getAll(): Promise<BusinessPartner[]> {
  return cacheManager.fetchWithCache('business-partners:list', async () => {
    try {
      const res = await fetch(`${API_URL}/business-partners`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) return data.map(mapPartner);
      }
    } catch (err) {
      console.warn('Backend unavailable, using fallback business partners:', err);
    }
    await delay(200);
    return [...BUSINESS_PARTNERS];
  });
}

export async function getById(id: string): Promise<BusinessPartner | undefined> {
  return cacheManager.fetchWithCache(`business-partners:id:${id}`, async () => {
    try {
      const res = await fetch(`${API_URL}/business-partners/${encodeURIComponent(id)}`);
      if (res.ok) return mapPartner(await res.json());
      if (res.status === 404) return undefined;
    } catch (err) {
      console.warn('Backend unavailable, using fallback getById:', err);
    }
    await delay(150);
    return BUSINESS_PARTNERS.find((bp) => bp.id === id);
  });
}

export async function create(data: BusinessPartnerFormData): Promise<BusinessPartner> {
  try {
    const res = await fetch(`${API_URL}/business-partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      cacheManager.invalidate('business-partners');
      cacheManager.invalidate('reports');
      return mapPartner(await res.json());
    }
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to create business partner');
  } catch (err) {
    if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) throw err;
    console.warn('Backend unavailable, creating business partner locally:', err);
  }
  await delay(250);
  const newPartner: BusinessPartner = {
    id: `bp-${nextId++}`,
    code: data.code.trim().toUpperCase(),
    name: data.name.trim(),
    contactPerson: data.contactPerson?.trim() || undefined,
    phone: data.phone?.trim() || undefined,
    email: data.email?.trim() || undefined,
    address: data.address?.trim() || undefined,
    status: data.status || 'active',
    createdAt: new Date().toISOString().slice(0, 10),
  };
  BUSINESS_PARTNERS.unshift(newPartner);
  cacheManager.invalidate('business-partners');
  cacheManager.invalidate('reports');
  return newPartner;
}

export async function update(id: string, data: Partial<BusinessPartnerFormData>): Promise<BusinessPartner> {
  try {
    const res = await fetch(`${API_URL}/business-partners/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      cacheManager.invalidate('business-partners');
      cacheManager.invalidate('reports');
      return mapPartner(await res.json());
    }
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to update business partner');
  } catch (err) {
    if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) throw err;
    console.warn('Backend unavailable, updating business partner locally:', err);
  }
  await delay(250);
  const idx = BUSINESS_PARTNERS.findIndex((bp) => bp.id === id);
  if (idx === -1) throw new Error('Business Partner not found');
  const existing = BUSINESS_PARTNERS[idx];
  BUSINESS_PARTNERS[idx] = {
    ...existing, ...data,
    code: data.code ? data.code.trim().toUpperCase() : existing.code,
    name: data.name ? data.name.trim() : existing.name,
  };
  cacheManager.invalidate('business-partners');
  cacheManager.invalidate('reports');
  return BUSINESS_PARTNERS[idx];
}

export async function remove(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/business-partners/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      cacheManager.invalidate('business-partners');
      cacheManager.invalidate('reports');
      return;
    }
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to delete business partner');
  } catch (err) {
    if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) throw err;
    console.warn('Backend unavailable, removing business partner locally:', err);
  }
  await delay(200);
  const idx = BUSINESS_PARTNERS.findIndex((bp) => bp.id === id);
  if (idx !== -1) BUSINESS_PARTNERS.splice(idx, 1);
  cacheManager.invalidate('business-partners');
  cacheManager.invalidate('reports');
}

export async function toggleStatus(id: string): Promise<BusinessPartner> {
  const local = BUSINESS_PARTNERS.find((bp) => bp.id === id);
  const currentStatus = local?.status ?? 'active';
  const newStatus: 'active' | 'inactive' = currentStatus === 'active' ? 'inactive' : 'active';
  try {
    const res = await fetch(`${API_URL}/business-partners/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      cacheManager.invalidate('business-partners');
      cacheManager.invalidate('reports');
      return mapPartner(await res.json());
    }
  } catch (err) {
    console.warn('Backend unavailable, toggling status locally:', err);
  }
  await delay(200);
  const partner = BUSINESS_PARTNERS.find((bp) => bp.id === id);
  if (!partner) throw new Error('Business Partner not found');
  partner.status = newStatus;
  cacheManager.invalidate('business-partners');
  cacheManager.invalidate('reports');
  return partner;
}
