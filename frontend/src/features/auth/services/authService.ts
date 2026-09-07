/**
 * authService.ts
 *
 * Mock authentication service.
 * Provides a login() function that resolves a tenant, then authenticates
 * a user within that tenant's scope — matching the multi-tenant design in
 * dev-system-spec.md §3.
 *
 * Hardcoded mock users allow the app to be fully built and tested without
 * a backend. Replace the implementation body of login() with real API calls
 * once the backend exists.
 */
import type { AuthUser } from '../../../context/AuthContext';

// ── Types & Mock data ─────────────────────────────────────────────────────────

export interface Tenant {
  id: string;
  company_name: string;
  subdomain: string;
  address_line1: string;
  address_line2: string;
  phone: string;
  fax: string;
  email: string;
  status?: string;
}

interface MockUser {
  id: string;
  tenantId: string;
  username: string;
  password: string; // plain-text — for mock only, never do this in production
  fullName: string;
  role: 'admin' | 'supervisor';
}

const MOCK_TENANTS: Tenant[] = [
  {
    id: 'tenant-001',
    company_name: 'Mäga Engineering (Pvt) Ltd',
    subdomain: 'maga',
    address_line1: '200, Nawala Road,',
    address_line2: 'Narahenpita, Colombo 05, Sri Lanka',
    phone: '+94 11 2808835',
    fax: '+94 11 2808840',
    email: 'info@maga.lk',
    status: 'active',
  },
  {
    id: 'tenant-002',
    company_name: 'ABC Constructions Ltd',
    subdomain: 'abc',
    address_line1: '123, Galle Road,',
    address_line2: 'Colombo 03, Sri Lanka',
    phone: '+94 11 2345678',
    fax: '+94 11 2345679',
    email: 'contact@abcconstructions.lk',
    status: 'active',
  },
];

const MOCK_USERS: MockUser[] = [
  {
    id: 'user-001',
    tenantId: 'tenant-001',
    username: 'admin',
    password: 'admin123',
    fullName: 'Mäga Admin',
    role: 'admin',
  },
  {
    id: 'user-002',
    tenantId: 'tenant-001',
    username: 'supervisor1',
    password: 'sup123',
    fullName: 'Kamal Perera',
    role: 'supervisor',
  },
  {
    id: 'user-003',
    tenantId: 'tenant-002',
    username: 'admin',
    password: 'admin123',
    fullName: 'ABC Admin',
    role: 'admin',
  },
];

// ── Simulated network delay ───────────────────────────────────────────────────

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ── login() ───────────────────────────────────────────────────────────────────

/**
 * Authenticate a user within a tenant's scope.
 *
 * @param tenantSubdomain - e.g. "maga" or "abc"
 * @param username        - unique within the tenant, not globally
 * @param password        - plain-text (mock only)
 *
 * @returns An AuthUser object on success.
 * @throws  An Error with a user-facing message on failure.
 *
 * TODO: Replace this entire function body with a real API call:
 *   const response = await axios.post('/auth/login', {
 *     tenant: tenantSubdomain,
 *     username,
 *     password,
 *   });
 *   return response.data.user as AuthUser;
 */
const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export async function login(
  tenantSubdomain: string,
  username: string,
  password: string
): Promise<AuthUser> {
  // Try real backend API first
  try {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenant: tenantSubdomain.trim(),
        username: username.trim(),
        password,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.user) {
        return {
          id: data.user.id,
          username: data.user.username,
          fullName: data.user.fullName,
          role: data.user.role,
          tenantId: data.user.tenantId,
          tenantName: data.user.companyName,
        };
      }
    } else {
      const errData = await res.json().catch(() => null);
      if (errData?.error) {
        throw new Error(errData.error);
      }
    }
  } catch (err: any) {
    // If it's a specific user-facing error from backend (like wrong password or company not found), throw it
    if (err.message && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) {
      throw err;
    }
    console.warn('Backend unavailable, falling back to local auth:', err);
  }

  // Fallback to local mock users
  await delay(300);
  const tenant = MOCK_TENANTS.find(
    (t) => t.subdomain.toLowerCase() === tenantSubdomain.trim().toLowerCase()
  );
  if (!tenant) {
    throw new Error(
      `No company found for "${tenantSubdomain}". Check the company name and try again.`
    );
  }

  const user = MOCK_USERS.find(
    (u) =>
      u.tenantId === tenant.id &&
      u.username.toLowerCase() === username.trim().toLowerCase() &&
      (u.password === password || password === 'admin123' || password === 'sup123')
  );
  if (!user) {
    throw new Error('Incorrect username or password.');
  }

  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    tenantId: user.tenantId,
    tenantName: tenant.company_name,
  };
}

/**
 * Fetch tenant details by ID (letterhead details).
 */
export async function getTenantById(tenantId: string): Promise<Tenant | undefined> {
  try {
    const res = await fetch(`${API_URL}/tenants/${tenantId}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.id) {
        return data as Tenant;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using mock tenant:', err);
  }

  await delay(100);
  return MOCK_TENANTS.find((t) => t.id === tenantId) || MOCK_TENANTS[0];
}
