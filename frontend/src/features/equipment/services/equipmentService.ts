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
  code: string;
  name: string;
  type: string;
  status: 'active' | 'inactive';
}

export type EquipmentFormData = Omit<Equipment, 'id' | 'status'>;

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
