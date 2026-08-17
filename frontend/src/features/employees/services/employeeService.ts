/**
 * employeeService.ts
 *
 * Mock service for employee CRUD. In-memory data scoped to tenant-001
 * (Mäga Engineering). All functions simulate network delay.
 *
 * TODO: Replace each function body with real API calls:
 *   getAll()     → GET    /api/employees
 *   getById(id)  → GET    /api/employees/:id
 *   create(data) → POST   /api/employees
 *   update(data) → PUT    /api/employees/:id
 *   deactivate() → PATCH  /api/employees/:id/status
 */

export interface Employee {
  id: string;
  callingName: string;
  fullName: string;
  businessPartner: string;
  tradeGroup: string;
  nicNo: string;
  status: 'active' | 'inactive';
}

export type EmployeeFormData = Omit<Employee, 'id' | 'status'>;

// ── Mock data ─────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

let nextId = 16;

const EMPLOYEES: Employee[] = [
  { id: 'emp-001', callingName: 'Kamal',    fullName: 'Kamal Perera',            businessPartner: 'Maga Engineering',    tradeGroup: 'Mason',          nicNo: '881234567V', status: 'active' },
  { id: 'emp-002', callingName: 'Nimal',    fullName: 'Nimal Silva',             businessPartner: 'Maga Engineering',    tradeGroup: 'Carpenter',      nicNo: '901234568V', status: 'active' },
  { id: 'emp-003', callingName: 'Sunil',    fullName: 'Sunil Fernando',          businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician',    nicNo: '851234569V', status: 'active' },
  { id: 'emp-004', callingName: 'Chaminda', fullName: 'Chaminda Rajapakse',      businessPartner: 'Alpha Constructions', tradeGroup: 'General labour', nicNo: '921234570V', status: 'active' },
  { id: 'emp-005', callingName: 'Ruwan',    fullName: 'Ruwan Jayawardena',       businessPartner: 'Beta Projects',       tradeGroup: 'Plumber',        nicNo: '871234571V', status: 'active' },
  { id: 'emp-006', callingName: 'Pradeep',  fullName: 'Pradeep Bandara',         businessPartner: 'Maga Engineering',    tradeGroup: 'Welder',         nicNo: '931234572V', status: 'active' },
  { id: 'emp-007', callingName: 'Lakmal',   fullName: 'Lakmal Dissanayake',      businessPartner: 'Beta Projects',       tradeGroup: 'Mason',          nicNo: '891234573V', status: 'active' },
  { id: 'emp-008', callingName: 'Asanka',   fullName: 'Asanka Kumara',           businessPartner: 'Maga Engineering',    tradeGroup: 'Carpenter',      nicNo: '941234574V', status: 'active' },
  { id: 'emp-009', callingName: 'Dinesh',   fullName: 'Dinesh Wickramasinghe',   businessPartner: 'Alpha Constructions', tradeGroup: 'Electrician',    nicNo: '861234575V', status: 'active' },
  { id: 'emp-010', callingName: 'Roshan',   fullName: 'Roshan Gunawardena',      businessPartner: 'Beta Projects',       tradeGroup: 'General labour', nicNo: '951234576V', status: 'active' },
  { id: 'emp-011', callingName: 'Tharanga', fullName: 'Tharanga Abeysekara',     businessPartner: 'Maga Engineering',    tradeGroup: 'Plumber',        nicNo: '881234577V', status: 'active' },
  { id: 'emp-012', callingName: 'Nuwan',    fullName: 'Nuwan Samaraweera',       businessPartner: 'Alpha Constructions', tradeGroup: 'Welder',         nicNo: '911234578V', status: 'inactive' },
  { id: 'emp-013', callingName: 'Sampath',  fullName: 'Sampath Ranasinghe',      businessPartner: 'Beta Projects',       tradeGroup: 'Mason',          nicNo: '871234579V', status: 'active' },
  { id: 'emp-014', callingName: 'Udara',    fullName: 'Udara Liyanage',          businessPartner: 'Maga Engineering',    tradeGroup: 'General labour', nicNo: '961234580V', status: 'active' },
  { id: 'emp-015', callingName: 'Ajith',    fullName: 'Ajith Mendis',            businessPartner: 'Alpha Constructions', tradeGroup: 'Carpenter',      nicNo: '841234581V', status: 'active' },
];

// ── Service functions ─────────────────────────────────────────────────────────

export async function getAll(): Promise<Employee[]> {
  await delay(300);
  return [...EMPLOYEES];
}

export async function getById(id: string): Promise<Employee | undefined> {
  await delay(200);
  return EMPLOYEES.find((e) => e.id === id);
}

export async function create(data: EmployeeFormData): Promise<Employee> {
  await delay(400);
  const emp: Employee = {
    id: `emp-${String(nextId++).padStart(3, '0')}`,
    ...data,
    status: 'active',
  };
  EMPLOYEES.push(emp);
  return emp;
}

export async function update(id: string, data: Partial<EmployeeFormData>): Promise<Employee> {
  await delay(400);
  const idx = EMPLOYEES.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Employee not found');
  EMPLOYEES[idx] = { ...EMPLOYEES[idx], ...data };
  return EMPLOYEES[idx];
}

export async function deactivate(id: string): Promise<Employee> {
  await delay(300);
  const idx = EMPLOYEES.findIndex((e) => e.id === id);
  if (idx === -1) throw new Error('Employee not found');
  EMPLOYEES[idx].status = 'inactive';
  return EMPLOYEES[idx];
}

/** Unique business partners for filter dropdowns */
export function getBusinessPartners(): string[] {
  return [...new Set(EMPLOYEES.map((e) => e.businessPartner))].sort();
}

/** Unique trade groups for filter dropdowns */
export function getTradeGroups(): string[] {
  return [...new Set(EMPLOYEES.map((e) => e.tradeGroup))].sort();
}
