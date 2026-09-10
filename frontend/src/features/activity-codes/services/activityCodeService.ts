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

import { API_URL } from '../../../config/api';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 24;

const CODES: ActivityCode[] = [
  { id: 'ac-001', code: '00-00-10-00', description: 'Other site over head' },
  { id: 'ac-002', code: '00-00-11-13', description: 'Welfare Facilities - Meals and Tea - for Contractor' },
  { id: 'ac-003', code: '00-00-11-30', description: 'Salaries and Wages - for Contractor' },
  { id: 'ac-004', code: '00-00-20-10', description: 'Dayworks - Labour' },
  { id: 'ac-005', code: '00-00-20-20', description: 'Dayworks - Equipment' },
  { id: 'ac-006', code: '00-00-20-30', description: 'Dayworks - Materials' },
  { id: 'ac-007', code: '00-00-50-00', description: 'Head office Overhead' },
  { id: 'ac-008', code: '00-61-00-00', description: 'Bonds & Guarantees' },
  { id: 'ac-009', code: '00-61-13-13', description: 'Performance Bond' },
  { id: 'ac-010', code: '00-61-27-00', description: 'Advance Bond' },
  { id: 'ac-011', code: '00-62-16-00', description: 'Insurance' },
  { id: 'ac-012', code: '00-62-16-13', description: "Insurance - Contractor's All Risk (CAR)" },
  { id: 'ac-013', code: '01-10-10-00', description: 'Excavation & Earthwork' },
  { id: 'ac-014', code: '01-20-10-00', description: 'Concrete Work - Substructure' },
  { id: 'ac-015', code: '02-10-10-00', description: 'Formwork - Superstructure' },
  { id: 'ac-016', code: '02-20-10-00', description: 'Rebar & Steel Reinforcement' },
  { id: 'ac-017', code: '03-10-10-00', description: 'Masonry Block & Brick Laying' },
  { id: 'ac-018', code: '03-20-10-00', description: 'Plastering Work' },
  { id: 'ac-019', code: '04-10-10-00', description: 'Plumbing & Drainage Work' },
  { id: 'ac-020', code: '04-20-10-00', description: 'Electrical Conduit & Cabling' },
  { id: 'ac-021', code: '05-10-10-00', description: 'Tile Laying & Finishes' },
  { id: 'ac-022', code: '05-20-10-00', description: 'Painting & Surface Coating' },
  { id: 'ac-023', code: '06-10-10-00', description: 'Welding & Structural Steel' },
];

export async function getAll(): Promise<ActivityCode[]> {
  try {
    const res = await fetch(`${API_URL}/activity-codes`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length >= 0) {
        return data.map((item: any) => ({
          id: item.id,
          code: item.code,
          description: item.description || item.code,
        }));
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using fallback activity codes:', err);
  }
  await delay(300);
  return [...CODES];
}

/** Check if a code string is already in use (client-side uniqueness check for offline mode) */
export function isCodeUnique(code: string, excludeId?: string): boolean {
  return !CODES.some(
    (c) => c.code.toLowerCase() === code.toLowerCase() && c.id !== excludeId
  );
}

export async function create(data: ActivityCodeFormData): Promise<ActivityCode> {
  try {
    const res = await fetch(`${API_URL}/activity-codes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const item = await res.json();
      return { id: item.id, code: item.code, description: item.description || item.code };
    }
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Activity code "${data.code}" already exists.`);
  } catch (err) {
    if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) throw err;
    console.warn('Backend unavailable, creating activity code locally:', err);
  }
  await delay(400);
  if (!isCodeUnique(data.code)) {
    throw new Error(`Activity code "${data.code}" already exists.`);
  }
  const item: ActivityCode = {
    id: `ac-${String(nextId++).padStart(3, '0')}`,
    ...data,
  };
  CODES.push(item);
  return item;
}

export async function update(id: string, data: Partial<ActivityCodeFormData>): Promise<ActivityCode> {
  try {
    const res = await fetch(`${API_URL}/activity-codes/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      const item = await res.json();
      return { id: item.id, code: item.code, description: item.description || item.code };
    }
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || `Activity code "${data.code}" already exists.`);
  } catch (err) {
    if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) throw err;
    console.warn('Backend unavailable, updating activity code locally:', err);
  }
  await delay(400);
  const idx = CODES.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Activity code not found');
  if (data.code && !isCodeUnique(data.code, id)) {
    throw new Error(`Activity code "${data.code}" already exists.`);
  }
  CODES[idx] = { ...CODES[idx], ...data };
  return CODES[idx];
}

export async function remove(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/activity-codes/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) return;
    const errData = await res.json().catch(() => null);
    throw new Error(errData?.error || 'Failed to delete activity code');
  } catch (err) {
    if (err instanceof Error && !err.message.includes('fetch') && !err.message.includes('Failed to fetch')) throw err;
    console.warn('Backend unavailable, removing activity code locally:', err);
  }
  await delay(300);
  const idx = CODES.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Activity code not found');
  CODES.splice(idx, 1);
}
