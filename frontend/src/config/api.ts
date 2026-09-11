/**
 * Centralized API configuration for the frontend.
 * Ensures the API base URL:
 * 1. Has any trailing slashes removed (prevents double slashes like //auth/login)
 * 2. Has the /api prefix appended if omitted
 * 3. Falls back to localhost in local dev
 */
export function getApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  const raw = (envUrl && typeof envUrl === 'string' ? envUrl : 'http://localhost:5000/api').trim().replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

export const API_URL = getApiBaseUrl();

/**
 * Returns the currently active tenant ID / subdomain from localStorage.
 */
export function getCurrentTenantId(): string {
  try {
    const raw = localStorage.getItem('les_auth_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.tenantId || '';
    }
  } catch {
    // Ignore localStorage parse errors
  }
  return '';
}

/**
 * Builds HTTP headers including 'x-tenant-id' for tenant-scoped requests.
 */
export function getTenantHeaders(customHeaders: HeadersInit = {}): Headers {
  const headers = new Headers(customHeaders);
  const tenantId = getCurrentTenantId();
  if (tenantId && !headers.has('x-tenant-id')) {
    headers.set('x-tenant-id', tenantId);
  }
  return headers;
}

/**
 * Enhanced fetch that automatically injects the tenant header (x-tenant-id).
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = getTenantHeaders(init?.headers);
  return fetch(input, {
    ...init,
    headers,
  });
}
