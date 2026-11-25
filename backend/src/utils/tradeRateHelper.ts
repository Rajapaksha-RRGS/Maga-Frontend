import { EmployeeType, SkillLevel } from '@prisma/client';
import prisma from '../config/prisma';

export function normalizeEmployeeType(
  raw?: string | null,
  hasBusinessPartner?: boolean
): EmployeeType {
  const val = String(raw ?? '').trim().toUpperCase();
  if (val === 'INTERNAL') return EmployeeType.INTERNAL;
  if (val === 'FOREIGN') return EmployeeType.FOREIGN;
  if (val === 'EXTERNAL_SUPPLY' || val === 'SUPPLY') return EmployeeType.EXTERNAL_SUPPLY;
  if (val === 'EXTERNAL_SUBCONTRACTOR' || val === 'SUBCONTRACTOR') {
    return EmployeeType.EXTERNAL_SUBCONTRACTOR;
  }
  if (val === 'EXTERNAL') {
    return EmployeeType.EXTERNAL_SUPPLY;
  }
  return hasBusinessPartner ? EmployeeType.EXTERNAL_SUPPLY : EmployeeType.INTERNAL;
}

export function normalizeSkillLevel(raw?: string | null): SkillLevel {
  const val = String(raw ?? '').trim().toUpperCase();
  if (val === 'UNSKILLED') return SkillLevel.UNSKILLED;
  return SkillLevel.SKILLED;
}

export function isExternalEmployeeType(type?: EmployeeType | string | null): boolean {
  const val = String(type ?? '').trim().toUpperCase();
  return (
    val === 'EXTERNAL_SUPPLY' ||
    val === 'EXTERNAL_SUBCONTRACTOR' ||
    val === 'EXTERNAL'
  );
}

export interface ProjectTradeRateValues {
  internalSkilledRate: unknown;
  internalUnskilledRate: unknown;
  foreignSkilledRate: unknown;
  foreignUnskilledRate: unknown;
  supplySkilledRate: unknown;
  supplyUnskilledRate: unknown;
  subcontractorSkilledRate: unknown;
  subcontractorUnskilledRate: unknown;
}

export function pickRateFromTradeRateRow(
  row: ProjectTradeRateValues | null | undefined,
  employeeType: EmployeeType,
  skillLevel: SkillLevel
): number {
  if (!row) return 0;
  const skilled = skillLevel !== SkillLevel.UNSKILLED;
  switch (employeeType) {
    case EmployeeType.INTERNAL:
      return Number(skilled ? row.internalSkilledRate : row.internalUnskilledRate) || 0;
    case EmployeeType.FOREIGN:
      return Number(skilled ? row.foreignSkilledRate : row.foreignUnskilledRate) || 0;
    case EmployeeType.EXTERNAL_SUPPLY:
      return Number(skilled ? row.supplySkilledRate : row.supplyUnskilledRate) || 0;
    case EmployeeType.EXTERNAL_SUBCONTRACTOR:
      return Number(skilled ? row.subcontractorSkilledRate : row.subcontractorUnskilledRate) || 0;
    default:
      return Number(skilled ? row.internalSkilledRate : row.internalUnskilledRate) || 0;
  }
}

export async function resolveProjectTradeRate(
  projectId: string,
  tradeGroupId: string | null | undefined,
  employeeType: EmployeeType,
  skillLevel: SkillLevel
): Promise<number | null> {
  if (!projectId || !tradeGroupId) return null;
  const row = await prisma.mF_P_TradeRate.findUnique({
    where: { projectId_tradeGroupId: { projectId, tradeGroupId } },
  });
  if (!row) return null;
  return pickRateFromTradeRateRow(row, employeeType, skillLevel);
}

export const TRADE_RATE_NUMERIC_FIELDS = [
  'internalSkilledRate',
  'internalUnskilledRate',
  'foreignSkilledRate',
  'foreignUnskilledRate',
  'supplySkilledRate',
  'supplyUnskilledRate',
  'subcontractorSkilledRate',
  'subcontractorUnskilledRate',
] as const;

export interface ValidatedTradeRateInput {
  tradeGroupId: string;
  internalSkilledRate: number;
  internalUnskilledRate: number;
  foreignSkilledRate: number;
  foreignUnskilledRate: number;
  supplySkilledRate: number;
  supplyUnskilledRate: number;
  subcontractorSkilledRate: number;
  subcontractorUnskilledRate: number;
}

export async function validateProjectTradeRatesPayload(
  projectId: string,
  rates: unknown
): Promise<{ valid: true; items: ValidatedTradeRateInput[] } | { valid: false; status: number; error: string }> {
  const project = await prisma.mF_P_Project.findUnique({
    where: { id: projectId },
    select: { id: true },
  });
  if (!project) {
    return { valid: false, status: 404, error: 'Project not found' };
  }

  if (!Array.isArray(rates) || rates.length === 0) {
    return { valid: false, status: 400, error: 'rates must be a non-empty array' };
  }

  const seenTradeGroups = new Set<string>();
  const validated: ValidatedTradeRateInput[] = [];

  for (let i = 0; i < rates.length; i++) {
    const row = rates[i] as Record<string, unknown> | null;
    if (!row || typeof row !== 'object') {
      return { valid: false, status: 400, error: `Row ${i + 1}: invalid rate entry` };
    }

    const tradeGroupId = String(row.tradeGroupId ?? '').trim();
    if (!tradeGroupId) {
      return { valid: false, status: 400, error: `Row ${i + 1}: tradeGroupId is required` };
    }
    if (seenTradeGroups.has(tradeGroupId)) {
      return { valid: false, status: 400, error: `Duplicate tradeGroupId '${tradeGroupId}' in payload` };
    }
    seenTradeGroups.add(tradeGroupId);

    const parsed: Record<string, number> = {};
    for (const field of TRADE_RATE_NUMERIC_FIELDS) {
      const raw = row[field];
      const num = raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
      if (!Number.isFinite(num) || num < 0) {
        return {
          valid: false,
          status: 400,
          error: `Row ${i + 1}: ${field} must be a valid non-negative number`,
        };
      }
      parsed[field] = Math.round(num * 100) / 100;
    }

    validated.push({
      tradeGroupId,
      internalSkilledRate: parsed.internalSkilledRate,
      internalUnskilledRate: parsed.internalUnskilledRate,
      foreignSkilledRate: parsed.foreignSkilledRate,
      foreignUnskilledRate: parsed.foreignUnskilledRate,
      supplySkilledRate: parsed.supplySkilledRate,
      supplyUnskilledRate: parsed.supplyUnskilledRate,
      subcontractorSkilledRate: parsed.subcontractorSkilledRate,
      subcontractorUnskilledRate: parsed.subcontractorUnskilledRate,
    });
  }

  const existingTgs = await prisma.mF_G_TradeGroup.findMany({
    where: { id: { in: Array.from(seenTradeGroups) } },
    select: { id: true },
  });
  const validTgSet = new Set(existingTgs.map((t) => t.id));
  const missingTg = Array.from(seenTradeGroups).find((id) => !validTgSet.has(id));
  if (missingTg) {
    return { valid: false, status: 400, error: `Invalid tradeGroupId '${missingTg}'` };
  }

  return { valid: true, items: validated };
}
