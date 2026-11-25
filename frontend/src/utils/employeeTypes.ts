export type EmployeeTypeValue =
  | 'INTERNAL'
  | 'FOREIGN'
  | 'EXTERNAL_SUPPLY'
  | 'EXTERNAL_SUBCONTRACTOR';

export type SkillLevelValue = 'SKILLED' | 'UNSKILLED';

export const EMPLOYEE_TYPE_OPTIONS: { value: EmployeeTypeValue; label: string; shortLabel: string }[] = [
  { value: 'INTERNAL', label: 'Internal (Direct)', shortLabel: 'Internal' },
  { value: 'FOREIGN', label: 'Foreign Worker', shortLabel: 'Foreign' },
  { value: 'EXTERNAL_SUPPLY', label: 'External — Supply Labor', shortLabel: 'Supply' },
  { value: 'EXTERNAL_SUBCONTRACTOR', label: 'External — Subcontractor', shortLabel: 'Subcontractor' },
];

export const SKILL_LEVEL_OPTIONS: { value: SkillLevelValue; label: string }[] = [
  { value: 'SKILLED', label: 'Skilled' },
  { value: 'UNSKILLED', label: 'Unskilled' },
];

export function normalizeEmployeeTypeClient(raw?: string | null): EmployeeTypeValue {
  const val = String(raw ?? '').trim().toUpperCase();
  if (val === 'FOREIGN') return 'FOREIGN';
  if (val === 'EXTERNAL_SUPPLY' || val === 'SUPPLY' || val === 'EXTERNAL') return 'EXTERNAL_SUPPLY';
  if (val === 'EXTERNAL_SUBCONTRACTOR' || val === 'SUBCONTRACTOR') return 'EXTERNAL_SUBCONTRACTOR';
  return 'INTERNAL';
}

export function normalizeSkillLevelClient(raw?: string | null): SkillLevelValue {
  return String(raw ?? '').trim().toUpperCase() === 'UNSKILLED' ? 'UNSKILLED' : 'SKILLED';
}

export function isExternalEmployeeTypeClient(type?: string | null): boolean {
  const normalized = normalizeEmployeeTypeClient(type);
  return normalized === 'EXTERNAL_SUPPLY' || normalized === 'EXTERNAL_SUBCONTRACTOR';
}

export function formatEmployeeTypeLabel(type?: string | null): string {
  const normalized = normalizeEmployeeTypeClient(type);
  return EMPLOYEE_TYPE_OPTIONS.find((o) => o.value === normalized)?.shortLabel || 'Internal';
}

export interface ProjectTradeRateRow {
  tradeGroupId: string;
  tradeGroupCode: string;
  tradeGroupName: string;
  internalSkilledRate: number;
  internalUnskilledRate: number;
  foreignSkilledRate: number;
  foreignUnskilledRate: number;
  supplySkilledRate: number;
  supplyUnskilledRate: number;
  subcontractorSkilledRate: number;
  subcontractorUnskilledRate: number;
}

export function pickProjectTradeRateClient(
  row: ProjectTradeRateRow | undefined,
  employeeType: EmployeeTypeValue,
  skillLevel: SkillLevelValue
): number {
  if (!row) return 0;
  const skilled = skillLevel !== 'UNSKILLED';
  switch (employeeType) {
    case 'INTERNAL':
      return Number(skilled ? row.internalSkilledRate : row.internalUnskilledRate) || 0;
    case 'FOREIGN':
      return Number(skilled ? row.foreignSkilledRate : row.foreignUnskilledRate) || 0;
    case 'EXTERNAL_SUPPLY':
      return Number(skilled ? row.supplySkilledRate : row.supplyUnskilledRate) || 0;
    case 'EXTERNAL_SUBCONTRACTOR':
      return Number(skilled ? row.subcontractorSkilledRate : row.subcontractorUnskilledRate) || 0;
    default:
      return 0;
  }
}
