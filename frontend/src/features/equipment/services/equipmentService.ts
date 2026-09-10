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

import { API_URL } from '../../../config/api';
import { cacheManager } from '../../../utils/cacheManager';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 15;

const EQUIPMENT: Equipment[] = [
  { id: 'equip-001', code: 'MACM0075', name: 'AIR COMPRESSOR INGERSOLL RAND', type: 'Air compressor',   status: 'active' },
  { id: 'equip-002', code: 'MACM0146', name: 'AIR COMPRESSOR FS CURTIS',       type: 'Air compressor',   status: 'active' },
  { id: 'equip-003', code: 'MACM0158', name: 'AIR COMPRESSOR SULLAIR',         type: 'Air compressor',   status: 'active' },
  { id: 'equip-004', code: 'MACM0163', name: 'AIR COMPRESSOR ATLAS COPCO',     type: 'Air compressor',   status: 'active' },
  { id: 'equip-005', code: 'MACM0164', name: 'AIR COMPRESSOR DOOSAN',          type: 'Air compressor',   status: 'active' },
  { id: 'equip-006', code: 'MACM0170', name: 'AIR COMPRESSOR KAESER',          type: 'Air compressor',   status: 'active' },
  { id: 'equip-007', code: 'MEXC0012', name: 'EXCAVATOR CAT 320D',             type: 'Heavy machinery',  status: 'active' },
  { id: 'equip-008', code: 'MJCB0034', name: 'BACKHOE LOADER JCB 3CX',        type: 'Heavy machinery',  status: 'active' },
  { id: 'equip-009', code: 'MCRN0018', name: 'TOWER CRANE TC-5010',            type: 'Crane',            status: 'active' },
  { id: 'equip-010', code: 'MTRK0056', name: 'DUMP TRUCK ISUZU 10T',           type: 'Transport',        status: 'active' },
  { id: 'equip-011', code: 'MMIX0025', name: 'CONCRETE MIXER 350L',           type: 'Concrete',         status: 'active' },
  { id: 'equip-012', code: 'MROL0042', name: 'COMPACTOR ROLLER BOMAG 8T',     type: 'Compaction',       status: 'active' },
  { id: 'equip-013', code: 'MGEN0088', name: 'GENERATOR CUMMINS 50kVA',       type: 'Power',            status: 'active' },
  { id: 'equip-014', code: 'MWEL0091', name: 'WELDING MACHINE INVERTER 400A', type: 'Welding',          status: 'inactive' },
];

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
    try {
      const res = await fetch(`${API_URL}/equipment`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map(mapEquipment);
        }
      }
    } catch (err) {
      console.warn('Backend unavailable, using mock equipment list:', err);
    }

    await delay(300);
    return [...EQUIPMENT];
  });
}

export async function getById(id: string): Promise<Equipment> {
  return cacheManager.fetchWithCache(`equipment:id:${id}`, async () => {
    try {
      const res = await fetch(`${API_URL}/equipment/${id}`);
      if (res.ok) {
        const data = await res.json();
        return mapEquipment(data);
      }
    } catch (err) {
      console.warn('Backend unavailable, using mock equipment detail:', err);
    }

    const found = EQUIPMENT.find((e) => e.id === id);
    if (!found) throw new Error('Equipment not found');
    return found;
  });
}

export async function create(data: EquipmentFormData): Promise<Equipment> {
  try {
    const res = await fetch(`${API_URL}/equipment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const created = await res.json();
      cacheManager.invalidate('equipment');
      return mapEquipment(created);
    }
  } catch (err) {
    console.warn('Backend unavailable, saving equipment locally:', err);
  }

  await delay(400);
  const item: Equipment = {
    id: `equip-${String(nextId++).padStart(3, '0')}`,
    ...data,
    status: 'active',
  };
  EQUIPMENT.push(item);
  cacheManager.invalidate('equipment');
  return item;
}

export async function update(id: string, data: Partial<EquipmentFormData>): Promise<Equipment> {
  try {
    const res = await fetch(`${API_URL}/equipment/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const updated = await res.json();
      cacheManager.invalidate('equipment');
      return mapEquipment(updated);
    }
  } catch (err) {
    console.warn('Backend unavailable, updating equipment locally:', err);
  }

  await delay(400);
  const idx = EQUIPMENT.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Equipment not found');
  EQUIPMENT[idx] = { ...EQUIPMENT[idx], ...data };
  cacheManager.invalidate('equipment');
  return EQUIPMENT[idx];
}

export async function deactivate(id: string): Promise<Equipment> {
  try {
    const res = await fetch(`${API_URL}/equipment/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'inactive' }),
    });
    if (res.ok) {
      const updated = await res.json();
      cacheManager.invalidate('equipment');
      return mapEquipment(updated);
    }
  } catch (err) {
    console.warn('Backend unavailable, deactivating equipment locally:', err);
  }

  await delay(300);
  const idx = EQUIPMENT.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Equipment not found');
  EQUIPMENT[idx].status = 'inactive';
  cacheManager.invalidate('equipment');
  return EQUIPMENT[idx];
}

export async function deleteEquipment(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/equipment/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      cacheManager.invalidate('equipment');
      return;
    }
  } catch (err) {
    console.warn('Backend unavailable, deleting equipment locally:', err);
  }

  const idx = EQUIPMENT.findIndex((e) => e.id === id);
  if (idx !== -1) EQUIPMENT.splice(idx, 1);
  cacheManager.invalidate('equipment');
}
