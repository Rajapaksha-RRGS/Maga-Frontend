/**
 * activityCodeService.ts
 *
 * Real API service for Activity Code CRUD connected to backend PostgreSQL,
 * with fallback to in-memory mock data when backend is offline.
 *
 * Backend endpoints:
 *   GET    /api/activity-codes       -> getAll()
 *   POST   /api/activity-codes       -> create(data)
 *   PUT    /api/activity-codes/:id   -> update(id, data)
 *   DELETE /api/activity-codes/:id   -> remove(id)
 */

export interface ActivityCode {
  id: string;
  code: string;
  description: string;
}

export type ActivityCodeFormData = Omit<ActivityCode, 'id'>;

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';

export async function getAll(): Promise<ActivityCode[]> {
  return cacheManager.fetchWithCache('activity-codes:list', async () => {
    const res = await apiFetch(`${API_URL}/activity-codes`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Failed to fetch activity codes (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map((item: any) => ({
        id: item.id,
        code: item.code,
        description: item.description || item.code,
      }));
    }
    return [];
  });
}

export async function isCodeUnique(code: string, excludeId?: string): Promise<boolean> {
  const codes = await getAll();
  return !codes.some((c) => c.code.toLowerCase() === code.toLowerCase() && c.id !== excludeId);
}

export async function create(data: ActivityCodeFormData): Promise<ActivityCode> {
  const res = await apiFetch(`${API_URL}/activity-codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Failed to create activity code "${data.code}"`);
  }
  const item = await res.json();
  cacheManager.invalidate('activity-codes');
  cacheManager.invalidate('reports');
  return { id: item.id, code: item.code, description: item.description || item.code };
}

export async function update(id: string, data: Partial<ActivityCodeFormData>): Promise<ActivityCode> {
  const res = await apiFetch(`${API_URL}/activity-codes/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Failed to update activity code "${data.code}"`);
  }
  const item = await res.json();
  cacheManager.invalidate('activity-codes');
  cacheManager.invalidate('reports');
  return { id: item.id, code: item.code, description: item.description || item.code };
}

export async function remove(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/activity-codes/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to delete activity code');
  }
  cacheManager.invalidate('activity-codes');
  cacheManager.invalidate('reports');
}

