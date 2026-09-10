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
