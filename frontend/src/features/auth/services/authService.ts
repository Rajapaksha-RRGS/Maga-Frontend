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

// ── Mock data ─────────────────────────────────────────────────────────────────

interface MockTenant {
  id: string;
  name: string;
  subdomain: string;
}

interface MockUser {
  id: string;
  tenantId: string;
  username: string;
  password: string; // plain-text — for mock only, never do this in production
  fullName: string;
  role: 'admin' | 'supervisor';
}

const MOCK_TENANTS: MockTenant[] = [
  { id: 'tenant-001', name: 'Mäga Engineering', subdomain: 'maga' },
  { id: 'tenant-002', name: 'ABC Constructions', subdomain: 'abc' },
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
export async function login(
  tenantSubdomain: string,
  username: string,
  password: string
): Promise<AuthUser> {
  // Simulate network round-trip
  await delay(500);

  // Step 1: Resolve the tenant by subdomain
  const tenant = MOCK_TENANTS.find(
    (t) => t.subdomain.toLowerCase() === tenantSubdomain.trim().toLowerCase()
  );
  if (!tenant) {
    throw new Error(
      `No company found for "${tenantSubdomain}". Check the company name and try again.`
    );
  }

  // Step 2: Authenticate username/password within that tenant's scope
  const user = MOCK_USERS.find(
    (u) =>
      u.tenantId === tenant.id &&
      u.username.toLowerCase() === username.trim().toLowerCase() &&
      u.password === password
  );
  if (!user) {
    throw new Error('Incorrect username or password.');
  }

  // Step 3: Return the AuthUser shape the rest of the app expects
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    tenantId: user.tenantId,
    tenantName: tenant.name,
  };
}
