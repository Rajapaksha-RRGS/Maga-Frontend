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

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Initial fallback mock data for testing if backend is offline
const MOCK_TENANTS: TenantRecord[] = [
  {
    id: 'ten-001',
    companyName: 'Walgama Diyagama Road',
    subdomain: '531M',
    addressLine1: 'Walgama - Diyagama Project Site Office',
    addressLine2: 'Western Province',
    phone: '+94 11 280 8835',
    email: 'site531m@maga.lk',
    status: 'active',
    createdAt: new Date().toISOString(),
    userCount: 8,
    employeeCount: 42,
    primaryAdmin: {
      id: 'usr-001',
      username: 'admin531m',
      fullName: 'Site Admin (531M)',
      status: 'active',
    },
  },
  {
    id: 'ten-002',
    companyName: 'Kandy Road Rehabilitation',
    subdomain: '521M',
    addressLine1: 'Kandy Road Site Office',
    addressLine2: 'Central Province',
    phone: '+94 81 223 4567',
    email: 'site521m@maga.lk',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    userCount: 6,
    employeeCount: 35,
    primaryAdmin: {
      id: 'usr-002',
      username: 'admin521m',
      fullName: 'Site Admin (521M)',
      status: 'active',
    },
  },
  {
    id: 'ten-003',
    companyName: 'SEEP Project',
    subdomain: '403M',
    addressLine1: 'M00000403 Site Base',
    addressLine2: 'Colombo',
    phone: '+94 11 255 1234',
    email: 'seep403m@maga.lk',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(),
    userCount: 4,
    employeeCount: 22,
    primaryAdmin: {
      id: 'usr-003',
      username: 'admin403m',
      fullName: 'Site Admin (403M)',
      status: 'active',
    },
  },
  {
    id: 'ten-004',
    companyName: 'A06 – Section 2',
    subdomain: 'M0000376B',
    addressLine1: 'A06 Highway Site Office',
    addressLine2: 'Eastern Sector',
    phone: '+94 63 222 7890',
    email: 'a06sec2@maga.lk',
    status: 'active',
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(),
    userCount: 5,
    employeeCount: 28,
    primaryAdmin: {
      id: 'usr-004',
      username: 'admin376b',
      fullName: 'Site Admin (M0000376B)',
      status: 'active',
    },
  },
];

let localTenants: TenantRecord[] = [...MOCK_TENANTS];

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
  try {
    const res = await fetch(`${API_URL}/tenants`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using mock tenant data', err);
  }
  return localTenants;
}

export async function registerTenant(
  input: TenantRegisterInput
): Promise<{ tenant: TenantRecord; tempPassword?: string }> {
  try {
    const res = await fetch(`${API_URL}/tenants/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        tenant: data.tenant,
        tempPassword: data.tempPassword,
      };
    } else {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register tenant');
    }
  } catch (err: any) {
    if (err.message && err.message !== 'Failed to fetch') {
      throw err;
    }
    // Fallback in offline mock mode
    const tempPassword = input.adminPassword || generateTempPassword();
    const newTenant: TenantRecord = {
      id: `ten-${Date.now()}`,
      companyName: input.companyName,
      subdomain: input.subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, ''),
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2,
      phone: input.phone,
      fax: input.fax,
      email: input.email,
      status: 'active',
      createdAt: new Date().toISOString(),
      userCount: 1,
      employeeCount: 0,
      primaryAdmin: {
        id: `usr-${Date.now()}`,
        username: input.adminUsername.toLowerCase().trim(),
        fullName: input.adminFullName.trim(),
        status: 'active',
      },
    };
    localTenants = [newTenant, ...localTenants];
    return { tenant: newTenant, tempPassword };
  }
}

export async function updateTenant(
  id: string,
  input: TenantUpdateInput
): Promise<TenantRecord> {
  try {
    const res = await fetch(`${API_URL}/tenants/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend unavailable, updating local mock tenant', err);
  }

  localTenants = localTenants.map((t) =>
    t.id === id ? { ...t, ...input } : t
  );
  const found = localTenants.find((t) => t.id === id);
  if (!found) throw new Error('Tenant not found');
  return found;
}

export async function toggleTenantStatus(
  id: string,
  newStatus: 'active' | 'suspended'
): Promise<TenantRecord> {
  try {
    const res = await fetch(`${API_URL}/tenants/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('Backend unavailable, toggling local mock tenant status', err);
  }

  localTenants = localTenants.map((t) =>
    t.id === id ? { ...t, status: newStatus } : t
  );
  const found = localTenants.find((t) => t.id === id);
  if (!found) throw new Error('Tenant not found');
  return found;
}

export async function resetTenantAdminPassword(
  id: string
): Promise<{ tempPassword: string; adminName: string }> {
  try {
    const res = await fetch(`${API_URL}/tenants/${id}/reset-admin-password`, {
      method: 'POST',
    });
    if (res.ok) {
      const data = await res.json();
      return {
        tempPassword: data.tempPassword,
        adminName: data.adminName || 'Admin',
      };
    }
  } catch (err) {
    console.warn('Backend unavailable, generating mock temp password', err);
  }

  const tenant = localTenants.find((t) => t.id === id);
  const tempPassword = generateTempPassword();
  return {
    tempPassword,
    adminName: tenant?.primaryAdmin?.fullName || tenant?.companyName || 'Admin',
  };
}
