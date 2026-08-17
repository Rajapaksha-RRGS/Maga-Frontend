/**
 * equipmentService.ts
 *
 * Mock service for equipment CRUD. Construction-domain equipment.
 *
 * TODO: Replace each function body with real API calls:
 *   getAll()     → GET    /api/equipment
 *   create(data) → POST   /api/equipment
 *   update(data) → PUT    /api/equipment/:id
 *   deactivate() → PATCH  /api/equipment/:id/status
 */

export interface Equipment {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
}

export type EquipmentFormData = Omit<Equipment, 'id' | 'status'>;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextId = 9;

const EQUIPMENT: Equipment[] = [
  { id: 'equip-001', name: 'Excavator CAT 320',    type: 'Heavy machinery',  status: 'active' },
  { id: 'equip-002', name: 'Backhoe Loader JCB 3CX', type: 'Heavy machinery', status: 'active' },
  { id: 'equip-003', name: 'Concrete Mixer 350L',  type: 'Concrete',         status: 'active' },
  { id: 'equip-004', name: 'Tower Crane TC-5010',   type: 'Crane',            status: 'active' },
  { id: 'equip-005', name: 'Compactor Roller 8T',   type: 'Compaction',       status: 'active' },
  { id: 'equip-006', name: 'Dump Truck 10T',        type: 'Transport',        status: 'active' },
  { id: 'equip-007', name: 'Welding Machine 400A',  type: 'Welding',          status: 'inactive' },
  { id: 'equip-008', name: 'Generator 50kVA',       type: 'Power',            status: 'active' },
];

export async function getAll(): Promise<Equipment[]> {
  await delay(300);
  return [...EQUIPMENT];
}

export async function create(data: EquipmentFormData): Promise<Equipment> {
  await delay(400);
  const item: Equipment = {
    id: `equip-${String(nextId++).padStart(3, '0')}`,
    ...data,
    status: 'active',
  };
  EQUIPMENT.push(item);
  return item;
}

export async function update(id: string, data: Partial<EquipmentFormData>): Promise<Equipment> {
  await delay(400);
  const idx = EQUIPMENT.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Equipment not found');
  EQUIPMENT[idx] = { ...EQUIPMENT[idx], ...data };
  return EQUIPMENT[idx];
}

export async function deactivate(id: string): Promise<Equipment> {
  await delay(300);
  const idx = EQUIPMENT.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Equipment not found');
  EQUIPMENT[idx].status = 'inactive';
  return EQUIPMENT[idx];
}
