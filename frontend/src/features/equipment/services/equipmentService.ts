/**
 * equipmentService.ts
 *
 * Real API service for equipment CRUD connected to backend PostgreSQL,
 * with fallback to mock data when backend is offline.
 *
 * Backend endpoints:
 *   GET    /api/equipment
 *   GET    /api/equipment/:id
 *   POST   /api/equipment
 *   PUT    /api/equipment/:id
 *   PATCH  /api/equipment/:id/status
 *   DELETE /api/equipment/:id
 */

export interface Equipment {
  id: string;
  code: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
}

export type EquipmentFormData = Omit<Equipment, 'id' | 'status'>;

import { API_URL, apiFetch } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';

function mapEquipment(item: any): Equipment {
  return {
    id: item.id,
    code: item.code || '',
    name: item.name,
    type: item.type || '',
    status: item.status === 'inactive' ? 'inactive' : 'active',
  };
}

export async function getAll(): Promise<Equipment[]> {
  return cacheManager.fetchWithCache('equipment:list', async () => {
    const res = await apiFetch(`${API_URL}/equipment`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Failed to fetch equipment (${res.status})`);
    }
    const data = await res.json();
    if (Array.isArray(data)) {
      return data.map(mapEquipment);
    }
    return [];
  });
}

export async function getById(id: string): Promise<Equipment> {
  return cacheManager.fetchWithCache(`equipment:id:${id}`, async () => {
    const res = await apiFetch(`${API_URL}/equipment/${id}`);
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || `Failed to fetch equipment details (${res.status})`);
    }
    const data = await res.json();
    return mapEquipment(data);
  });
}

export async function create(data: EquipmentFormData): Promise<Equipment> {
  const res = await apiFetch(`${API_URL}/equipment`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to create equipment');
  }
  const created = await res.json();
  cacheManager.invalidate('equipment');
  return mapEquipment(created);
}

export async function update(id: string, data: Partial<EquipmentFormData>): Promise<Equipment> {
  const res = await apiFetch(`${API_URL}/equipment/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to update equipment');
  }
  const updated = await res.json();
  cacheManager.invalidate('equipment');
  return mapEquipment(updated);
}

export async function deactivate(id: string): Promise<Equipment> {
  const res = await apiFetch(`${API_URL}/equipment/${id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'inactive' }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to deactivate equipment');
  }
  const updated = await res.json();
  cacheManager.invalidate('equipment');
  return mapEquipment(updated);
}

export async function deleteEquipment(id: string): Promise<void> {
  const res = await apiFetch(`${API_URL}/equipment/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Failed to delete equipment');
  }
  cacheManager.invalidate('equipment');
}

