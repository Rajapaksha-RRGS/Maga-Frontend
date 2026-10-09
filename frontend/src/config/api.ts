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
 * Builds HTTP headers including 'x-tenant-id' and 'Authorization' for scoped requests.
 */
export function getTenantHeaders(customHeaders: HeadersInit = {}): Headers {
  const headers = new Headers(customHeaders);
  const tenantId = getCurrentTenantId();
  if (tenantId && !headers.has('x-tenant-id')) {
    headers.set('x-tenant-id', tenantId);
  }
  const token = localStorage.getItem('token');
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

/**
 * Enhanced fetch that automatically injects tenant header, auth token, and Content-Type.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = getTenantHeaders(init?.headers);
  const isFormData = typeof FormData !== 'undefined' && init?.body instanceof FormData;
  if (isFormData) {
    headers.delete('Content-Type');
  } else if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    headers,
  });
}

export interface ApiResponse<T = any> {
  data: T;
  status: number;
  ok: boolean;
}

/**
 * Standard API client for REST requests with built-in auth, tenant scoping,
 * and JSON parsing. Provides an axios-compatible response shape ({ data, status, ok }).
 */
export const api = {
  async get<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const res = await apiFetch(url, { method: 'GET', ...options });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`);
    }
    return { data, status: res.status, ok: res.ok };
  },
  async post<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await apiFetch(url, {
      method: 'POST',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      ...options,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`);
    }
    return { data, status: res.status, ok: res.ok };
  },
  async put<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await apiFetch(url, {
      method: 'PUT',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      ...options,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`);
    }
    return { data, status: res.status, ok: res.ok };
  },
  async patch<T = any>(endpoint: string, body?: any, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const res = await apiFetch(url, {
      method: 'PATCH',
      body: isFormData ? body : (body !== undefined ? JSON.stringify(body) : undefined),
      ...options,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`);
    }
    return { data, status: res.status, ok: res.ok };
  },
  async delete<T = any>(endpoint: string, options?: RequestInit): Promise<ApiResponse<T>> {
    const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const res = await apiFetch(url, { method: 'DELETE', ...options });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.message || data?.error || `Request failed with status ${res.status}`);
    }
    return { data, status: res.status, ok: res.ok };
  },
};

export default api;
