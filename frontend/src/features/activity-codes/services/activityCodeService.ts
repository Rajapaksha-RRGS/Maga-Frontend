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
  projectCode?: string;
}

export type ActivityCodeFormData = Omit<ActivityCode, 'id'>;

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';

export async function getAll(projectCode?: string): Promise<ActivityCode[]> {
  const cacheKey = projectCode ? `activity-codes:list:${projectCode}` : 'activity-codes:list';
  return cacheManager.fetchWithCache(cacheKey, async () => {
    const url = projectCode ? `${API_URL}/activity-codes?projectCode=${encodeURIComponent(projectCode)}` : `${API_URL}/activity-codes`;
    const res = await apiFetch(url);
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
        projectCode: item.projectCode || undefined,
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
  return { id: item.id, code: item.code, description: item.description || item.code, projectCode: item.projectCode };
}

export async function importFromCorporate(
  items: Array<{ code: string; description: string; projectCode?: string; activityType?: string }>,
  targetProjectCode?: string
): Promise<{ success: boolean; importedCount: number; skippedCount: number }> {
  const res = await apiFetch(`${API_URL}/activity-codes/import-from-corporate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items, projectCode: targetProjectCode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to import activity codes from corporate master');
  }
  const data = await res.json();
  cacheManager.invalidate('activity-codes');
  cacheManager.invalidate('reports');
  return data;
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

