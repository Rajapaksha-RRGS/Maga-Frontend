/**
 * activityCodeService.ts
 *
 * Mock service for activity code CRUD. Construction-domain codes.
 * Includes client-side uniqueness validation for code within tenant.
 *
 * TODO: Replace with real API calls:
 *   getAll()     → GET    /api/activity-codes
 *   create(data) → POST   /api/activity-codes
 *   update(data) → PUT    /api/activity-codes/:id
 *   delete(id)   → DELETE /api/activity-codes/:id
 */

export interface ActivityCode {
  id: string;
  code: string;
  description: string;
}

export type ActivityCodeFormData = Omit<ActivityCode, 'id'>;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 11;

const CODES: ActivityCode[] = [
  { id: 'ac-001', code: 'EW-01', description: 'Excavation work' },
  { id: 'ac-002', code: 'CW-01', description: 'Concrete work' },
  { id: 'ac-003', code: 'CW-02', description: 'Formwork' },
  { id: 'ac-004', code: 'CW-03', description: 'Rebar work' },
  { id: 'ac-005', code: 'MW-01', description: 'Masonry work' },
  { id: 'ac-006', code: 'PW-01', description: 'Plumbing work' },
  { id: 'ac-007', code: 'EL-01', description: 'Electrical work' },
  { id: 'ac-008', code: 'GW-01', description: 'General labour' },
  { id: 'ac-009', code: 'PT-01', description: 'Painting work' },
  { id: 'ac-010', code: 'WD-01', description: 'Welding work' },
];

export async function getAll(): Promise<ActivityCode[]> {
  await delay(300);
  return [...CODES];
}

/** Check if a code string is already in use (client-side uniqueness check) */
export function isCodeUnique(code: string, excludeId?: string): boolean {
  return !CODES.some(
    (c) => c.code.toLowerCase() === code.toLowerCase() && c.id !== excludeId
  );
}

export async function create(data: ActivityCodeFormData): Promise<ActivityCode> {
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
  await delay(300);
  const idx = CODES.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error('Activity code not found');
  CODES.splice(idx, 1);
}
