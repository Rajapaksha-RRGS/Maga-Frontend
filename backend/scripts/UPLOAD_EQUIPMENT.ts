/**
 * UPLOAD_EQUIPMENT.ts
 *
 * Maga Equipment Bulk Utilization Entry Script
 *
 * Dedicated Default Target: Project 527 (M00000527 - 527M -CEP-III -1R / subdomain: 527)
 * (Overrideable via --project=<code> if needed)
 *
 * Supports:
 * 1. Standard Maga SAP/ERP 6-Column Format:
 *    Equipment Code | Condition | Unit | Date | Activity | Utilization
 *
 * 2. 5-Column Format:
 *    Equipment | Total Utilization | Activity | Utilization | Date
 *
 * Capabilities & Error Detection:
 * 1. Reads CSV / TSV (comma, tab, or semicolon delimited) with RFC-style quote handling & exact CSV line numbers.
 * 2. Strict row-by-row validation:
 *    - Missing fields (Equipment, Condition, Unit, Date, Activity, Utilization)
 *    - Invalid calendar dates (rejects impossible dates like 31/02/2026)
 *    - Non-numeric, zero (0.00), negative, or out-of-range utilization
 *    - Invalid Condition (must be DRY or WET)
 *    - Unknown Unit (validated strictly against MF_G_UnitMaster to prevent FK crashes)
 *    - Unregistered Equipment (not in Project 527 or Corporate Master)
 *    - Unknown Activity Codes (exact match only; rejects typos instead of auto-creating fake codes)
 *    - Conflicting Condition/Unit across split rows on the same (Equipment, Date)
 *    - Approved-entry protection (never overwrites logs with status = 'approved')
 * 3. Pre-Upload Diagnostics Scan (duplicate activity splits, unit/condition mismatches vs DB, monthly mth cap check, bulk values).
 * 4. Groups multi-activity splits per (Equipment, Date) & consolidates duplicate (Equipment, Date, Activity) lines cleanly.
 * 5. Preserves existing operatorId on MF_OP_DailyEquipmentAssignment updates while setting null on new equipment-only entries.
 * 6. Zero-Crash Policy: row/group-level try/catch, terminal error table, error summary by category, and skipped_equipment_records.csv export.
 */

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import fs from 'fs';
import prisma from '../src/config/prisma';

// ANSI Colors for clear terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

const DEFAULT_PROJECT_QUERY = '527';

interface RawEquipmentRow {
  equipmentIdentifier: string;
  conditionRaw: string;
  unitRaw: string;
  hasConditionCol: boolean;
  hasUnitCol: boolean;
  totalUtilizationRaw: string;
  activityCode: string;
  utilizationRaw: string;
  dateStr: string;
  rawLineIndex: number;
}

interface ProcessError {
  line: number;
  category: string;
  equipment: string;
  condition?: string;
  unit?: string;
  dateStr?: string;
  activityCode?: string;
  utilization?: string | number;
  reason: string;
}

interface ActivitySplitInput {
  activityCode: string;
  utilization: number;
  rawLineIndex: number;
}

interface EquipmentDateGroup {
  equipmentIdentifier: string;
  condition: string;
  unit: string;
  unitCodeResolved: string;
  dateStr: string;
  date: Date;
  totalUtilization?: number;
  activities: ActivitySplitInput[];
  rawLineIndices: number[];
}

interface DiagnosticWarning {
  type: string;
  message: string;
}

// Helper: Parse a single CSV/TSV line respecting quoted fields
function splitDelimitedLine(line: string, delimiter: string): string[] {
  if (delimiter !== ',') {
    return line.split(delimiter).map((t) => t.trim().replace(/^["']+|["']+$/g, ''));
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper: Strict UTC Date parser (rejects impossible calendar dates like 31/02/2026)
function parseDateInput(val: string): Date | null {
  if (!val) return null;
  const clean = val.trim();

  const buildStrictUtcDate = (year: number, month: number, day: number): Date | null => {
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31 || year < 2000 || year > 2100) return null;
    const d = new Date(Date.UTC(year, month - 1, day));
    if (
      isNaN(d.getTime()) ||
      d.getUTCFullYear() !== year ||
      d.getUTCMonth() !== month - 1 ||
      d.getUTCDate() !== day
    ) {
      return null;
    }
    return d;
  };

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map((p) => parseInt(p, 10));
    return buildStrictUtcDate(y, m, d);
  }

  // D/M/YYYY or DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(clean)) {
    let [day, month, year] = clean.split('/').map((p) => parseInt(p, 10));
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    return buildStrictUtcDate(year, month, day);
  }

  // D-M-YYYY or DD-MM-YYYY
  if (/^\d{1,2}-\d{1,2}-\d{2,4}$/.test(clean)) {
    let [day, month, year] = clean.split('-').map((p) => parseInt(p, 10));
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    return buildStrictUtcDate(year, month, day);
  }

  return null;
}

// Helper: Strict number validation (rejects strings like "12abc")
function parseStrictNumber(raw: string): number | null {
  const clean = raw.trim();
  if (!clean) return null;
  if (!/^[+-]?(\d+(\.\d+)?|\.\d+)$/.test(clean)) return null;
  const num = Number(clean);
  return Number.isFinite(num) ? num : null;
}

// Helper: Parse CSV / TSV file while preserving exact 1-based CSV file line numbers
function parseRawFile(content: string): {
  rows: RawEquipmentRow[];
  parseErrors: ProcessError[];
  delimiter: string;
} {
  const rawLines = content.split(/\r?\n/);
  const firstNonEmptyIdx = rawLines.findIndex((l) => l.trim().length > 0);
  if (firstNonEmptyIdx === -1) {
    return { rows: [], parseErrors: [], delimiter: ',' };
  }

  const firstLine = rawLines[firstNonEmptyIdx];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  const headerTokens = splitDelimitedLine(firstLine, delimiter).map((t) =>
    t.toLowerCase().replace(/["']/g, '')
  );
  const hasHeader = headerTokens.some(
    (tok) =>
      tok.includes('equip') ||
      tok.includes('util') ||
      tok.includes('act') ||
      tok.includes('date') ||
      tok.includes('cond')
  );

  let colMap = {
    equipment: -1,
    condition: -1,
    unit: -1,
    totalUtilization: -1,
    activity: -1,
    utilization: -1,
    date: -1,
  };

  let startIndex = firstNonEmptyIdx;
  if (hasHeader) {
    startIndex = firstNonEmptyIdx + 1;
    headerTokens.forEach((tok, idx) => {
      if (tok.includes('total') && (tok.includes('util') || tok.includes('hour'))) {
        colMap.totalUtilization = idx;
      } else if (tok.includes('cond')) {
        colMap.condition = idx;
      } else if (tok === 'unit' || tok.includes('unit')) {
        colMap.unit = idx;
      } else if (tok.includes('equip') || tok.includes('machine') || tok.includes('vehicle')) {
        colMap.equipment = idx;
      } else if (tok.includes('act')) {
        colMap.activity = idx;
      } else if (tok.includes('util') || tok.includes('hour') || tok.includes('qty')) {
        if (colMap.utilization === -1) colMap.utilization = idx;
      } else if (tok.includes('date')) {
        colMap.date = idx;
      }
    });
  }

  // Fallback positional defaults if header tokens were not found
  if (colMap.equipment === -1) {
    if (headerTokens.length >= 6) {
      colMap = {
        equipment: 0,
        condition: 1,
        unit: 2,
        date: 3,
        activity: 4,
        utilization: 5,
        totalUtilization: -1,
      };
    } else {
      colMap = {
        equipment: 0,
        totalUtilization: 1,
        activity: 2,
        utilization: 3,
        date: 4,
        condition: -1,
        unit: -1,
      };
    }
  }

  const requiredMinCols = colMap.condition >= 0 && colMap.unit >= 0 ? 6 : 5;
  const rows: RawEquipmentRow[] = [];
  const parseErrors: ProcessError[] = [];

  for (let i = startIndex; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    if (rawLine.trim().length === 0) continue;

    const lineNum = i + 1;
    const rawTokens = splitDelimitedLine(rawLine, delimiter);

    if (rawTokens.length < requiredMinCols) {
      parseErrors.push({
        line: lineNum,
        category: 'Malformed Row',
        equipment: rawTokens[0] || 'UNKNOWN',
        dateStr: rawTokens[colMap.date] || '',
        activityCode: rawTokens[colMap.activity] || '',
        utilization: rawTokens[colMap.utilization] || '',
        reason: `Expected at least ${requiredMinCols} columns, found ${rawTokens.length}`,
      });
      continue;
    }

    const eq = colMap.equipment >= 0 ? (rawTokens[colMap.equipment] ?? '').trim() : '';
    const cond = colMap.condition >= 0 ? (rawTokens[colMap.condition] ?? '').trim() : '';
    const un = colMap.unit >= 0 ? (rawTokens[colMap.unit] ?? '').trim() : '';
    const totUtilStr = colMap.totalUtilization >= 0 ? (rawTokens[colMap.totalUtilization] ?? '').trim() : '';
    const act = colMap.activity >= 0 ? (rawTokens[colMap.activity] ?? '').trim() : '';
    const utilStr = colMap.utilization >= 0 ? (rawTokens[colMap.utilization] ?? '').trim() : '';
    const dt = colMap.date >= 0 ? (rawTokens[colMap.date] ?? '').trim() : '';

    // Skip rows where every column is completely blank (e.g. trailing commas)
    if (!eq && !cond && !un && !act && !utilStr && !dt) continue;

    rows.push({
      equipmentIdentifier: eq,
      conditionRaw: cond,
      unitRaw: un,
      hasConditionCol: colMap.condition >= 0,
      hasUnitCol: colMap.unit >= 0,
      totalUtilizationRaw: totUtilStr,
      activityCode: act,
      utilizationRaw: utilStr,
      dateStr: dt,
      rawLineIndex: lineNum,
    });
  }

  return { rows, parseErrors, delimiter };
}

// Helper: Resolve CLI args cleanly
function parseCliArgs(rawArgs: string[]) {
  const args = [...rawArgs];
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  let explicitFilePath: string | null = null;
  let explicitProject: string | null = null;
  let explicitSupervisor: string | null = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--file=')) {
      const val = args[i].split('=').slice(1).join('=').replace(/^["'`]+|["'`]+$/g, '').trim();
      if (fs.existsSync(val)) explicitFilePath = path.resolve(val);
      else if (fs.existsSync(path.join(__dirname, val))) explicitFilePath = path.join(__dirname, val);
      args.splice(i, 1);
      break;
    }
    for (let j = args.length; j > i; j--) {
      const candidate = args
        .slice(i, j)
        .join(' ')
        .replace(/^["'`]+|["'`]+$/g, '')
        .trim();
      if (!candidate || candidate.startsWith('-')) continue;
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        explicitFilePath = path.resolve(candidate);
        args.splice(i, j - i);
        break;
      } else if (
        fs.existsSync(path.join(__dirname, candidate)) &&
        fs.statSync(path.join(__dirname, candidate)).isFile()
      ) {
        explicitFilePath = path.join(__dirname, candidate);
        args.splice(i, j - i);
        break;
      }
    }
    if (explicitFilePath) break;
  }

  for (const a of args) {
    if (a.startsWith('--project=')) {
      explicitProject = a.split('=')[1].trim();
    } else if (a.startsWith('--supervisor=')) {
      explicitSupervisor = a.split('=')[1].trim();
    } else if (!a.startsWith('-')) {
      if (!explicitProject) explicitProject = a.trim();
    }
  }

  return { isDryRun, explicitFilePath, explicitProject, explicitSupervisor };
}

// Helper: Resolve Unit Master code safely (exact -> case-insensitive -> safe aliases)
function buildUnitResolver(units: Array<{ code: string; name: string }>) {
  const exactSet = new Set(units.map((u) => u.code));
  const lowerMap = new Map<string, string>();
  for (const u of units) {
    lowerMap.set(u.code.toLowerCase(), u.code);
  }

  const aliases: Record<string, string[]> = {
    day: ['day', 'days'],
    days: ['day', 'days'],
    hr: ['hrs', 'hr'],
    hrs: ['hrs', 'hr'],
    hour: ['hrs', 'hr'],
    hours: ['hrs', 'hr'],
    exhrs: ['ex.hrs'],
    'ex.hrs': ['ex.hrs'],
    mth: ['mth'],
    month: ['mth'],
    km: ['km'],
    ton: ['ton'],
    tons: ['ton'],
  };

  return (rawUnit: string): string | null => {
    const clean = rawUnit.trim();
    if (!clean) return null;
    if (exactSet.has(clean)) return clean;
    const lower = clean.toLowerCase();
    if (lowerMap.has(lower)) return lowerMap.get(lower)!;
    const aliasTargets = aliases[lower];
    if (aliasTargets) {
      for (const candidate of aliasTargets) {
        if (lowerMap.has(candidate)) return lowerMap.get(candidate)!;
      }
    }
    return null;
  };
}

// Helper: Print formatted terminal error table & write skipped_equipment_records.csv
function reportErrors(errors: ProcessError[], skippedCsvPath: string) {
  if (errors.length === 0) {
    if (fs.existsSync(skippedCsvPath)) {
      fs.unlinkSync(skippedCsvPath);
    }
    return;
  }

  // Category breakdown
  const byCategory = new Map<string, number>();
  for (const e of errors) {
    byCategory.set(e.category, (byCategory.get(e.category) || 0) + 1);
  }

  console.log(`\n${RED}${BOLD}📊 ERROR BREAKDOWN BY CATEGORY:${RESET}`);
  for (const [cat, count] of byCategory.entries()) {
    console.log(`  • ${cat.padEnd(28)}: ${RED}${BOLD}${count}${RESET}`);
  }

  console.log(`\n${RED}${BOLD}❌ SKIPPED / REJECTED RECORDS TABLE:${RESET}`);
  console.log(`${CYAN}${'-'.repeat(118)}${RESET}`);
  console.log(
    `${BOLD}${'Line'.padEnd(6)} | ${'Equipment'.padEnd(12)} | ${'Cond'.padEnd(4)} | ${'Unit'.padEnd(6)} | ${'Date'.padEnd(11)} | ${'Activity'.padEnd(16)} | ${'Util'.padEnd(7)} | Reason${RESET}`
  );
  console.log(`${CYAN}${'-'.repeat(118)}${RESET}`);

  const previewLimit = 30;
  for (const e of errors.slice(0, previewLimit)) {
    const lineStr = String(e.line).padEnd(6);
    const eqStr = String(e.equipment || '-').slice(0, 12).padEnd(12);
    const condStr = String(e.condition || '-').slice(0, 4).padEnd(4);
    const unitStr = String(e.unit || '-').slice(0, 6).padEnd(6);
    const dtStr = String(e.dateStr || '-').slice(0, 11).padEnd(11);
    const actStr = String(e.activityCode || '-').slice(0, 16).padEnd(16);
    const utilStr = String(e.utilization !== undefined && e.utilization !== '' ? e.utilization : '-').slice(0, 7).padEnd(7);
    console.log(`${lineStr} | ${eqStr} | ${condStr} | ${unitStr} | ${dtStr} | ${actStr} | ${utilStr} | ${RED}${e.reason}${RESET}`);
  }

  if (errors.length > previewLimit) {
    console.log(`${YELLOW}... and ${errors.length - previewLimit} more skipped/error records.${RESET}`);
  }
  console.log(`${CYAN}${'-'.repeat(118)}${RESET}`);

  const csvHeader = 'Line,Category,Equipment,Condition,Unit,Date,Activity,Utilization,Reason\n';
  const csvRows = errors
    .map(
      (e) =>
        `${e.line},"${e.category.replace(/"/g, '""')}","${(e.equipment || '').replace(/"/g, '""')}","${e.condition || ''}","${e.unit || ''}","${e.dateStr || ''}","${e.activityCode || ''}","${e.utilization !== undefined ? e.utilization : ''}","${e.reason.replace(/"/g, '""')}"`
    )
    .join('\n');

  fs.writeFileSync(skippedCsvPath, csvHeader + csvRows + '\n', 'utf-8');
  console.log(`\n📄 Detailed error log written to: ${BOLD}${skippedCsvPath}${RESET}`);
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}     MAGA EQUIPMENT BULK UTILIZATION UPLOADER        ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}\n`);

  const { isDryRun, explicitFilePath, explicitProject, explicitSupervisor } = parseCliArgs(process.argv.slice(2));
  if (isDryRun) {
    console.log(`${YELLOW}${BOLD}🧪 RUNNING IN DRY RUN MODE (No database writes will occur)${RESET}\n`);
  }

  const defaultFilePath = path.join(__dirname, 'Company equipment Master Upload Sheet.csv');
  const targetFilePath = explicitFilePath || defaultFilePath;

  // 1. Resolve Target Project (Dedicated Project 527 Default Lock)
  const allProjects = await prisma.mF_P_Project.findMany({
    select: { id: true, projectCode: true, projectName: true, subdomain: true },
  });

  const targetProjectQuery = explicitProject || DEFAULT_PROJECT_QUERY;
  const cleanReq = targetProjectQuery.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const project =
    allProjects.find((p) => {
      const pCode = p.projectCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const sCode = (p.subdomain || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const pName = p.projectName.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return (
        p.id.toLowerCase() === targetProjectQuery.toLowerCase() ||
        sCode === cleanReq ||
        pCode === cleanReq ||
        pCode.endsWith(cleanReq) ||
        pName.includes(cleanReq)
      );
    }) || null;

  if (!project) {
    console.error(`${RED}❌ Error: Target project "${targetProjectQuery}" not found in database!${RESET}`);
    console.error(`   Available projects: ${allProjects.map((p) => `${p.projectCode} (${p.subdomain})`).join(', ')}`);
    process.exit(1);
  }
  console.log(`📌 Target Project: ${BOLD}${project.projectName} (${project.projectCode}) [Subdomain: ${project.subdomain}]${RESET}`);

  // 2. Resolve Active Supervisor or Admin for DailySheet
  let supervisor: { id: string; username: string; fullName: string } | null = null;

  if (explicitSupervisor) {
    supervisor = await prisma.mF_P_User.findFirst({
      where: {
        projectId: project.id,
        status: 'active',
        OR: [
          { username: { equals: explicitSupervisor, mode: 'insensitive' } },
          { username: { contains: explicitSupervisor, mode: 'insensitive' } },
          { fullName: { contains: explicitSupervisor, mode: 'insensitive' } },
          { id: explicitSupervisor },
        ],
      },
      select: { id: true, username: true, fullName: true },
    });
    if (supervisor) {
      console.log(`👤 Explicit Supervisor: ${BOLD}${supervisor.fullName} (@${supervisor.username})${RESET}`);
    } else {
      console.log(
        `${YELLOW}⚠️ Specified supervisor "${explicitSupervisor}" not found in project ${project.projectCode}. Falling back to default supervisor/admin.${RESET}`
      );
    }
  }

  if (!supervisor) {
    supervisor = await prisma.mF_P_User.findFirst({
      where: { projectId: project.id, role: 'supervisor', status: 'active' },
      select: { id: true, username: true, fullName: true },
    });
  }

  if (!supervisor) {
    supervisor = await prisma.mF_P_User.findFirst({
      where: { projectId: project.id, role: 'admin', status: 'active' },
      select: { id: true, username: true, fullName: true },
    });
  }

  if (!supervisor) {
    console.error(`${RED}❌ Error: No active supervisor or admin found for project ${project.projectCode}!${RESET}`);
    process.exit(1);
  }
  console.log(`👷 Active Sheet Owner: ${BOLD}${supervisor.fullName} (@${supervisor.username})${RESET}`);

  if (!fs.existsSync(targetFilePath)) {
    console.error(`${RED}❌ Error: Input file not found: ${targetFilePath}${RESET}`);
    process.exit(1);
  }

  console.log(`📂 Reading data from: ${BOLD}${targetFilePath}${RESET}`);
  const rawFileContent = fs.readFileSync(targetFilePath, 'utf-8');
  const { rows: parsedRows, parseErrors } = parseRawFile(rawFileContent);

  if (parsedRows.length === 0 && parseErrors.length === 0) {
    console.log(`${YELLOW}⚠️ No data rows found in file.${RESET}`);
    return;
  }
  console.log(`📋 Total data rows parsed: ${BOLD}${parsedRows.length}${RESET}${parseErrors.length > 0 ? ` (${RED}${parseErrors.length} malformed${RESET})` : ''}\n`);

  // 3. Pre-load Project Equipment, Corporate Equipment, Activities, Units & Existing Approved Logs
  console.log(`🔄 Pre-loading Project ${project.projectCode} Master Data & Unit Master...`);
  const [projectEquipmentList, corporateEquipments, projectActivities, corporateActivities, unitMasters] =
    await Promise.all([
      prisma.mF_P_Equipment.findMany({
        where: { projectId: project.id },
        include: { corporateEquipment: true, meterUnit: true },
      }),
      prisma.mF_G_Equipment.findMany(),
      prisma.mF_P_ActivityCode.findMany({ where: { projectId: project.id } }),
      prisma.mF_G_ActivityCode.findMany(),
      prisma.mF_G_UnitMaster.findMany({ select: { code: true, name: true } }),
    ]);

  const eqMap = new Map<string, typeof projectEquipmentList[0]>();
  for (const pe of projectEquipmentList) {
    const corp = pe.corporateEquipment;
    if (corp?.standardEquipmentNumber) {
      eqMap.set(corp.standardEquipmentNumber.trim().toLowerCase(), pe);
    }
    if (corp?.vehicleNo) {
      eqMap.set(corp.vehicleNo.trim().toLowerCase(), pe);
    }
    eqMap.set(pe.id.toLowerCase(), pe);
  }

  const corpEqMap = new Map<string, typeof corporateEquipments[0]>();
  for (const ce of corporateEquipments) {
    if (ce.standardEquipmentNumber) {
      corpEqMap.set(ce.standardEquipmentNumber.trim().toLowerCase(), ce);
    }
    if (ce.vehicleNo) {
      corpEqMap.set(ce.vehicleNo.trim().toLowerCase(), ce);
    }
  }

  const actMap = new Map<string, string>();
  for (const pa of projectActivities) {
    actMap.set(pa.code.trim().toLowerCase(), pa.id);
  }

  const corpActMap = new Map<string, typeof corporateActivities[0]>();
  for (const ca of corporateActivities) {
    corpActMap.set(ca.code.trim().toLowerCase(), ca);
  }

  const resolveUnitCode = buildUnitResolver(unitMasters);

  // Pre-load existing APPROVED equipment logs for this project to prevent accidental overwrites even in dry-run
  const existingApprovedLogs = await prisma.mF_OP_EquipmentDailyLog.findMany({
    where: {
      status: 'approved',
      assignment: {
        dailySheet: { projectId: project.id },
      },
    },
    select: {
      assignment: {
        select: {
          equipmentId: true,
          dailySheet: { select: { date: true } },
        },
      },
    },
  });
  const approvedEqDates = new Set<string>();
  for (const log of existingApprovedLogs) {
    const dt = log.assignment.dailySheet.date.toISOString().slice(0, 10);
    approvedEqDates.add(`${log.assignment.equipmentId}___${dt}`);
  }

  // 4. Validate Every Row & Group by (Equipment, Date)
  console.log(`🔍 Validating all rows against Project ${project.projectCode} rules & masters...`);
  const errors: ProcessError[] = [...parseErrors];
  const warnings: DiagnosticWarning[] = [];
  const groupedEntries = new Map<string, EquipmentDateGroup>();

  const autoLinkEquipmentSet = new Set<string>();
  const autoLinkActivitySet = new Set<string>();
  const unitMismatchSeen = new Set<string>();
  const condMismatchSeen = new Set<string>();
  const inactiveEqSeen = new Set<string>();
  const highUtilSeen: string[] = [];

  let lastEquipment = '';
  let lastDateStr = '';

  for (const r of parsedRows) {
    // Allow continuation rows only when both equipment and date are blank
    const isContinuationRow = !r.equipmentIdentifier && !r.dateStr;
    const eqKey = r.equipmentIdentifier || (isContinuationRow ? lastEquipment : '');
    const dtStr = r.dateStr || (isContinuationRow ? lastDateStr : '');

    if (!eqKey) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Missing Equipment',
        equipment: 'MISSING',
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: r.dateStr,
        activityCode: r.activityCode,
        utilization: r.utilizationRaw,
        reason: 'Missing Equipment Code/Number',
      });
      continue;
    }

    if (!dtStr) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Missing Date',
        equipment: eqKey,
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: '',
        activityCode: r.activityCode,
        utilization: r.utilizationRaw,
        reason: 'Missing Date',
      });
      continue;
    }

    const parsedDate = parseDateInput(dtStr);
    if (!parsedDate) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Invalid Date',
        equipment: eqKey,
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: r.utilizationRaw,
        reason: `Invalid Date format or impossible calendar date: "${dtStr}" (expected DD/MM/YYYY or YYYY-MM-DD)`,
      });
      continue;
    }

    lastEquipment = eqKey;
    lastDateStr = dtStr;

    // Validate Activity Code presence
    if (!r.activityCode) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Missing Activity',
        equipment: eqKey,
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: dtStr,
        activityCode: '',
        utilization: r.utilizationRaw,
        reason: 'Missing Activity Code',
      });
      continue;
    }

    // Validate Utilization strictly
    const parsedUtil = parseStrictNumber(r.utilizationRaw);
    if (parsedUtil === null) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Invalid Utilization',
        equipment: eqKey,
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: r.utilizationRaw,
        reason: r.utilizationRaw
          ? `Non-numeric utilization value: "${r.utilizationRaw}"`
          : 'Missing Utilization value',
      });
      continue;
    }
    if (parsedUtil === 0) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Zero Utilization',
        equipment: eqKey,
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: r.utilizationRaw,
        reason: `Zero utilization (${r.utilizationRaw}) — skipped to avoid empty daily log`,
      });
      continue;
    }
    if (parsedUtil < 0) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Negative Utilization',
        equipment: eqKey,
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: `Negative utilization (${parsedUtil}) is not allowed`,
      });
      continue;
    }
    if (parsedUtil > 999999.99) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Out-of-Range Utilization',
        equipment: eqKey,
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: `Utilization (${parsedUtil}) exceeds maximum supported decimal(8,2) capacity`,
      });
      continue;
    }

    // Validate Total Utilization if column present
    let parsedTotalUtil: number | undefined;
    if (r.totalUtilizationRaw) {
      const totVal = parseStrictNumber(r.totalUtilizationRaw);
      if (totVal === null || totVal < 0) {
        errors.push({
          line: r.rawLineIndex,
          category: 'Invalid Total Utilization',
          equipment: eqKey,
          condition: r.conditionRaw,
          unit: r.unitRaw,
          dateStr: dtStr,
          activityCode: r.activityCode,
          utilization: r.totalUtilizationRaw,
          reason: `Invalid Total Utilization value: "${r.totalUtilizationRaw}"`,
        });
        continue;
      }
      parsedTotalUtil = totVal;
    }

    // Validate Equipment Master (Project 527 or Corporate Master)
    const cleanEqLower = eqKey.toLowerCase();
    const localEq = eqMap.get(cleanEqLower);
    const corpEq = localEq?.corporateEquipment || corpEqMap.get(cleanEqLower);
    if (!localEq && !corpEq) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Unknown Equipment',
        equipment: eqKey,
        condition: r.conditionRaw,
        unit: r.unitRaw,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: `Equipment "${eqKey}" not found in Project ${project.projectCode} or Corporate Master`,
      });
      continue;
    }
    if (!localEq && corpEq) {
      autoLinkEquipmentSet.add(eqKey.toUpperCase());
    }
    if (localEq && localEq.status !== 'active' && !inactiveEqSeen.has(eqKey.toUpperCase())) {
      inactiveEqSeen.add(eqKey.toUpperCase());
      warnings.push({
        type: 'INACTIVE_EQUIPMENT',
        message: `Equipment "${eqKey}" is marked '${localEq.status}' in Project ${project.projectCode}`,
      });
    }

    // Validate Condition (DRY / WET)
    let normalizedCondition = (localEq?.condition || corpEq?.condition || 'DRY').toUpperCase();
    if (r.hasConditionCol) {
      if (!r.conditionRaw) {
        errors.push({
          line: r.rawLineIndex,
          category: 'Missing Condition',
          equipment: eqKey,
          condition: '',
          unit: r.unitRaw,
          dateStr: dtStr,
          activityCode: r.activityCode,
          utilization: parsedUtil,
          reason: 'Missing Condition (expected DRY or WET)',
        });
        continue;
      }
      const upperCond = r.conditionRaw.toUpperCase();
      if (upperCond !== 'DRY' && upperCond !== 'WET') {
        errors.push({
          line: r.rawLineIndex,
          category: 'Invalid Condition',
          equipment: eqKey,
          condition: r.conditionRaw,
          unit: r.unitRaw,
          dateStr: dtStr,
          activityCode: r.activityCode,
          utilization: parsedUtil,
          reason: `Invalid Condition "${r.conditionRaw}" (expected DRY or WET)`,
        });
        continue;
      }
      normalizedCondition = upperCond;

      if (localEq && localEq.condition && localEq.condition.toUpperCase() !== upperCond) {
        const key = `${eqKey.toUpperCase()}|${upperCond}|${localEq.condition}`;
        if (!condMismatchSeen.has(key)) {
          condMismatchSeen.add(key);
          warnings.push({
            type: 'CONDITION_MISMATCH',
            message: `Equipment ${eqKey}: CSV condition "${upperCond}" differs from DB master "${localEq.condition}"`,
          });
        }
      }
    }

    // Validate Unit strictly against MF_G_UnitMaster
    const fallbackUnit = localEq?.meterUnitCode || corpEq?.unit || 'hrs';
    const rawUnitToCheck = r.hasUnitCol ? r.unitRaw : fallbackUnit;
    if (r.hasUnitCol && !r.unitRaw) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Missing Unit',
        equipment: eqKey,
        condition: normalizedCondition,
        unit: '',
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: 'Missing Unit (expected hrs, day, mth, km, etc.)',
      });
      continue;
    }

    const resolvedUnit = resolveUnitCode(rawUnitToCheck);
    if (!resolvedUnit) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Unknown Unit',
        equipment: eqKey,
        condition: normalizedCondition,
        unit: rawUnitToCheck,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: `Unknown Unit "${rawUnitToCheck}" — not found in MF_G_UnitMaster`,
      });
      continue;
    }

    if (localEq && localEq.meterUnitCode && localEq.meterUnitCode.toLowerCase() !== resolvedUnit.toLowerCase()) {
      const key = `${eqKey.toUpperCase()}|${resolvedUnit}|${localEq.meterUnitCode}`;
      if (!unitMismatchSeen.has(key)) {
        unitMismatchSeen.add(key);
        warnings.push({
          type: 'UNIT_MISMATCH',
          message: `Equipment ${eqKey}: CSV unit "${resolvedUnit}" differs from DB master "${localEq.meterUnitCode}"`,
        });
      }
    }

    // Validate Activity Code strictly (exact match in Project 527 or Corporate Master — NO prefix matching!)
    const cleanActLower = r.activityCode.toLowerCase();
    const hasProjAct = actMap.has(cleanActLower);
    const hasCorpAct = corpActMap.has(cleanActLower);
    if (!hasProjAct && !hasCorpAct) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Unknown Activity Code',
        equipment: eqKey,
        condition: normalizedCondition,
        unit: resolvedUnit,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: `Activity code "${r.activityCode}" not found in Project ${project.projectCode} or Corporate Master`,
      });
      continue;
    }
    if (!hasProjAct && hasCorpAct) {
      autoLinkActivitySet.add(r.activityCode);
    }

    // Check Approved Protection
    const isoDate = parsedDate.toISOString().slice(0, 10);
    if (localEq && approvedEqDates.has(`${localEq.id}___${isoDate}`)) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Already Approved',
        equipment: eqKey,
        condition: normalizedCondition,
        unit: resolvedUnit,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: `Equipment log on ${isoDate} is already APPROVED by Admin/PM. Did not overwrite.`,
      });
      continue;
    }

    // Group by (Equipment, Date) & validate consistency within group
    const groupKey = `${eqKey.toUpperCase()}___${isoDate}`;
    if (!groupedEntries.has(groupKey)) {
      groupedEntries.set(groupKey, {
        equipmentIdentifier: eqKey,
        condition: normalizedCondition,
        unit: rawUnitToCheck,
        unitCodeResolved: resolvedUnit,
        dateStr: dtStr,
        date: parsedDate,
        totalUtilization: parsedTotalUtil,
        activities: [],
        rawLineIndices: [],
      });
    }

    const group = groupedEntries.get(groupKey)!;
    if (group.condition !== normalizedCondition) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Conflicting Condition',
        equipment: eqKey,
        condition: normalizedCondition,
        unit: resolvedUnit,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: `Conflicting Condition on ${dtStr} for ${eqKey}: previous row had "${group.condition}", this row has "${normalizedCondition}"`,
      });
      continue;
    }
    if (group.unitCodeResolved.toLowerCase() !== resolvedUnit.toLowerCase()) {
      errors.push({
        line: r.rawLineIndex,
        category: 'Conflicting Unit',
        equipment: eqKey,
        condition: normalizedCondition,
        unit: resolvedUnit,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: parsedUtil,
        reason: `Conflicting Unit on ${dtStr} for ${eqKey}: previous row had "${group.unitCodeResolved}", this row has "${resolvedUnit}"`,
      });
      continue;
    }

    if (parsedTotalUtil !== undefined && parsedTotalUtil > 0) {
      group.totalUtilization = Math.max(group.totalUtilization || 0, parsedTotalUtil);
    }

    group.activities.push({
      activityCode: r.activityCode,
      utilization: parsedUtil,
      rawLineIndex: r.rawLineIndex,
    });
    group.rawLineIndices.push(r.rawLineIndex);

    // Informational notice for high single-row bulk entries (e.g. end-of-month totals)
    const uLower = resolvedUnit.toLowerCase();
    if ((uLower === 'hrs' && parsedUtil > 24) || ((uLower === 'day' || uLower === 'days') && parsedUtil > 2)) {
      highUtilSeen.push(`Line ${r.rawLineIndex}: ${eqKey} on ${dtStr} = ${parsedUtil} ${resolvedUnit}`);
    }
  }

  // 5. Pre-Upload Diagnostics Scan
  const unitCounts = new Map<string, number>();
  const condCounts = new Map<string, number>();
  const mthMonthlySums = new Map<string, number>();
  const duplicateSplitsNotices: string[] = [];

  for (const group of groupedEntries.values()) {
    const uKey = group.unitCodeResolved.toLowerCase();
    unitCounts.set(group.unitCodeResolved, (unitCounts.get(group.unitCodeResolved) || 0) + 1);
    condCounts.set(group.condition, (condCounts.get(group.condition) || 0) + 1);

    const groupSum = group.activities.reduce((s, a) => s + a.utilization, 0);
    if (uKey === 'mth') {
      const mKey = `${group.equipmentIdentifier.toUpperCase()} (${group.date.toISOString().slice(0, 7)})`;
      mthMonthlySums.set(mKey, (mthMonthlySums.get(mKey) || 0) + groupSum);
    }

    // Check duplicate activity codes within the same (Equipment, Date) group
    const seenActs = new Map<string, { lines: number[]; sum: number }>();
    for (const a of group.activities) {
      const k = a.activityCode.toUpperCase();
      if (!seenActs.has(k)) seenActs.set(k, { lines: [], sum: 0 });
      const entry = seenActs.get(k)!;
      entry.lines.push(a.rawLineIndex);
      entry.sum = Math.round((entry.sum + a.utilization) * 100) / 100;
    }
    for (const [actCode, info] of seenActs.entries()) {
      if (info.lines.length > 1) {
        duplicateSplitsNotices.push(
          `${group.equipmentIdentifier} on ${group.dateStr} [${actCode}]: lines ${info.lines.join(' & ')} consolidated -> ${info.sum}`
        );
      }
    }
  }

  for (const [mKey, totalMth] of mthMonthlySums.entries()) {
    if (totalMth > 1.005) {
      warnings.push({
        type: 'MTH_EXCEEDS_1',
        message: `Monthly 'mth' sum for ${mKey} is ${totalMth.toFixed(2)} (> 1.00 mth)`,
      });
    }
  }

  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}      PRE-UPLOAD DIAGNOSTICS & VALIDATION SCAN       ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`  • Valid (Equipment, Date) Logs : ${BOLD}${groupedEntries.size}${RESET}`);
  console.log(`  • Validation Errors Caught     : ${errors.length > 0 ? RED : GREEN}${BOLD}${errors.length}${RESET}`);
  console.log(
    `  • Units Breakdown              : ${Array.from(unitCounts.entries())
      .map(([u, c]) => `${u} (${c})`)
      .join(', ') || 'None'}`
  );
  console.log(
    `  • Conditions Breakdown         : ${Array.from(condCounts.entries())
      .map(([c, n]) => `${c} (${n})`)
      .join(', ') || 'None'}`
  );

  if (autoLinkEquipmentSet.size > 0) {
    console.log(`  • ${YELLOW}Corporate Equipment to Auto-Link:${RESET} ${Array.from(autoLinkEquipmentSet).join(', ')}`);
  }
  if (autoLinkActivitySet.size > 0) {
    console.log(`  • ${YELLOW}Corporate Activities to Auto-Link:${RESET} ${Array.from(autoLinkActivitySet).join(', ')}`);
  }
  if (duplicateSplitsNotices.length > 0) {
    console.log(`  • ${CYAN}Duplicate (Eq, Date, Act) Lines Consolidated (${duplicateSplitsNotices.length}):${RESET}`);
    for (const msg of duplicateSplitsNotices.slice(0, 10)) {
      console.log(`    ${CYAN}➔${RESET} ${msg}`);
    }
  }
  if (highUtilSeen.length > 0) {
    console.log(`  • ${YELLOW}High/Bulk Utilization Rows Detected (${highUtilSeen.length}):${RESET}`);
    for (const msg of highUtilSeen.slice(0, 8)) {
      console.log(`    ${YELLOW}➔${RESET} ${msg}`);
    }
    if (highUtilSeen.length > 8) {
      console.log(`    ${YELLOW}... and ${highUtilSeen.length - 8} more bulk rows${RESET}`);
    }
  }
  if (warnings.length > 0) {
    console.log(`  • ${YELLOW}Master / Rule Warnings (${warnings.length}):${RESET}`);
    for (const w of warnings) {
      console.log(`    ${YELLOW}⚠️ [${w.type}]${RESET} ${w.message}`);
    }
  }
  console.log(`${CYAN}=====================================================${RESET}\n`);

  // Helper: Resolve or auto-link corporate activity (NEVER creates unmapped codes)
  async function resolveActivityId(actCode: string): Promise<string | null> {
    const cleanCode = actCode.trim().toLowerCase();
    if (actMap.has(cleanCode)) return actMap.get(cleanCode)!;

    const corpAct = corpActMap.get(cleanCode);
    if (!corpAct) return null;

    if (isDryRun) return 'dry-run-activity-id';

    const created = await prisma.mF_P_ActivityCode.create({
      data: {
        projectId: project!.id,
        code: corpAct.code,
        description: corpAct.description,
        corporateActivityCodeId: corpAct.id,
        unit: corpAct.unit || 'hrs',
      },
    });
    actMap.set(cleanCode, created.id);
    return created.id;
  }

  // 6. Process Valid Groups into Database (with Zero-Crash try/catch per group)
  let successGroups = 0;
  let successActivitySplits = 0;
  let failedGroups = 0;
  const processedDailySheets = new Map<string, string>(); // dateKey -> dailySheetId

  for (const [, group] of groupedEntries) {
    try {
      const cleanEqKey = group.equipmentIdentifier.toLowerCase();
      let localEq = eqMap.get(cleanEqKey);

      if (!localEq) {
        const corpEq = corpEqMap.get(cleanEqKey);
        if (corpEq) {
          if (!isDryRun) {
            const created = await prisma.mF_P_Equipment.create({
              data: {
                projectId: project.id,
                corporateEquipmentId: corpEq.id,
                condition: group.condition || corpEq.condition || 'DRY',
                costRate: corpEq.costRate || corpEq.dailyRate || 0,
                status: 'active',
                meterUnitCode: group.unitCodeResolved || resolveUnitCode(corpEq.unit || 'hrs') || 'hrs',
              },
              include: { corporateEquipment: true, meterUnit: true },
            });
            localEq = created;
            eqMap.set(cleanEqKey, created);
            if (corpEq.standardEquipmentNumber) eqMap.set(corpEq.standardEquipmentNumber.toLowerCase(), created);
            if (corpEq.vehicleNo) eqMap.set(corpEq.vehicleNo.toLowerCase(), created);
          } else {
            localEq = {
              id: 'dry-run-eq-id',
              projectId: project.id,
              corporateEquipmentId: corpEq.id,
              condition: group.condition,
              costRate: corpEq.costRate || corpEq.dailyRate || 0,
              status: 'active',
              meterUnitCode: group.unitCodeResolved,
              ownerPartnerId: null,
              createdAt: new Date(),
              corporateEquipment: corpEq,
              meterUnit: null,
            } as any;
          }
        }
      }

      if (!localEq) {
        failedGroups++;
        for (const a of group.activities) {
          errors.push({
            line: a.rawLineIndex,
            category: 'Unknown Equipment',
            equipment: group.equipmentIdentifier,
            condition: group.condition,
            unit: group.unitCodeResolved,
            dateStr: group.dateStr,
            activityCode: a.activityCode,
            utilization: a.utilization,
            reason: `Equipment "${group.equipmentIdentifier}" not found in Project ${project.projectCode} or Corporate Master`,
          });
        }
        continue;
      }

      // Resolve activity IDs and consolidate duplicates by activityCodeId
      const consolidatedSplits = new Map<string, { activityCodeId: string; utilization: number }>();
      let hasInvalidAct = false;

      for (const act of group.activities) {
        const actId = await resolveActivityId(act.activityCode);
        if (!actId) {
          hasInvalidAct = true;
          errors.push({
            line: act.rawLineIndex,
            category: 'Unknown Activity Code',
            equipment: group.equipmentIdentifier,
            condition: group.condition,
            unit: group.unitCodeResolved,
            dateStr: group.dateStr,
            activityCode: act.activityCode,
            utilization: act.utilization,
            reason: `Activity code "${act.activityCode}" not found in Project ${project.projectCode} or Corporate Master`,
          });
          continue;
        }
        // In dry-run, use activity code text as map key when actId is placeholder
        const mapKey = isDryRun ? act.activityCode.toUpperCase() : actId;
        const existing = consolidatedSplits.get(mapKey);
        if (existing) {
          existing.utilization = Math.round((existing.utilization + act.utilization) * 100) / 100;
        } else {
          consolidatedSplits.set(mapKey, {
            activityCodeId: actId,
            utilization: Math.round(act.utilization * 100) / 100,
          });
        }
      }

      if (consolidatedSplits.size === 0) {
        if (hasInvalidAct) failedGroups++;
        continue;
      }

      const validActivities = Array.from(consolidatedSplits.values());
      const sumSplits = validActivities.reduce((acc, a) => acc + a.utilization, 0);
      const finalTotalUtilization =
        group.totalUtilization && group.totalUtilization > 0
          ? Math.round(group.totalUtilization * 100) / 100
          : Math.round(sumSplits * 100) / 100;

      const unitLower = group.unitCodeResolved.toLowerCase();
      const isHoursBased = unitLower === 'hrs' || unitLower === 'ex.hrs' || unitLower === 'hour';

      if (isDryRun) {
        successGroups++;
        successActivitySplits += validActivities.length;
        continue;
      }

      // Ensure DailySheet exists for date
      const dateKey = group.date.toISOString().slice(0, 10);
      let dailySheetId = processedDailySheets.get(dateKey);

      if (!dailySheetId) {
        const targetUtcDate = new Date(dateKey + 'T00:00:00.000Z');
        const existingSheet = await prisma.mF_OP_DailySheet.findUnique({
          where: {
            projectId_supervisorId_date: {
              projectId: project.id,
              supervisorId: supervisor.id,
              date: targetUtcDate,
            },
          },
          select: { id: true, status: true },
        });

        if (existingSheet) {
          dailySheetId = existingSheet.id;
          if (existingSheet.status === 'draft') {
            await prisma.mF_OP_DailySheet.update({
              where: { id: existingSheet.id },
              data: { status: 'submitted', submittedAt: new Date() },
            });
          }
        } else {
          const createdSheet = await prisma.mF_OP_DailySheet.create({
            data: {
              projectId: project.id,
              supervisorId: supervisor.id,
              date: targetUtcDate,
              status: 'submitted',
              submittedAt: new Date(),
            },
          });
          dailySheetId = createdSheet.id;
        }
        processedDailySheets.set(dateKey, dailySheetId);
      }

      // 1. Upsert Daily Equipment Assignment (preserve existing operatorId on update!)
      const assignment = await prisma.mF_OP_DailyEquipmentAssignment.upsert({
        where: {
          dailySheetId_equipmentId: {
            dailySheetId: dailySheetId!,
            equipmentId: localEq.id,
          },
        },
        update: {},
        create: {
          dailySheetId: dailySheetId!,
          equipmentId: localEq.id,
          operatorId: null,
        },
      });

      // 2. Upsert Equipment Daily Log
      const dailyLog = await prisma.mF_OP_EquipmentDailyLog.upsert({
        where: { assignmentId: assignment.id },
        create: {
          assignmentId: assignment.id,
          unitCode: group.unitCodeResolved,
          totalUtilization: finalTotalUtilization,
          workingHours: isHoursBased ? finalTotalUtilization : 0,
          netRunningHours: isHoursBased ? finalTotalUtilization : 0,
          status: 'submitted',
        },
        update: {
          unitCode: group.unitCodeResolved,
          totalUtilization: finalTotalUtilization,
          workingHours: isHoursBased ? finalTotalUtilization : 0,
          netRunningHours: isHoursBased ? finalTotalUtilization : 0,
          status: 'submitted',
        },
      });

      // 3. Clear & recreate Equipment Daily Log Activities
      await prisma.mF_OP_EquipmentDailyLogActivity.deleteMany({
        where: { dailyLogId: dailyLog.id },
      });

      for (const act of validActivities) {
        await prisma.mF_OP_EquipmentDailyLogActivity.create({
          data: {
            dailyLogId: dailyLog.id,
            activityCodeId: act.activityCodeId,
            utilization: act.utilization,
            hours: isHoursBased ? act.utilization : null,
          },
        });
        successActivitySplits++;
      }

      successGroups++;
    } catch (err: any) {
      failedGroups++;
      for (const a of group.activities) {
        errors.push({
          line: a.rawLineIndex,
          category: 'Database Error',
          equipment: group.equipmentIdentifier,
          condition: group.condition,
          unit: group.unitCodeResolved,
          dateStr: group.dateStr,
          activityCode: a.activityCode,
          utilization: a.utilization,
          reason: `DB Error: ${err.message || String(err)}`,
        });
      }
    }
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  const skippedCsvPath = path.join(__dirname, 'skipped_equipment_records.csv');

  // 7. Output Summary and Detailed Error Report
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}                 UPLOAD SUMMARY                      ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`📌 Project                 : ${BOLD}${project.projectCode} (${project.subdomain})${RESET}`);
  console.log(
    `✅ ${isDryRun ? 'Validated (Dry-Run)' : 'Uploaded'} Logs  : ${GREEN}${BOLD}${successGroups}${RESET} equipment daily logs (${successActivitySplits} activity lines)`
  );
  if (failedGroups > 0) {
    console.log(`⚠️ Failed Equipment Groups : ${YELLOW}${BOLD}${failedGroups}${RESET}`);
  }
  console.log(
    `❌ Errors / Skipped Rows   : ${errors.length > 0 ? RED : GREEN}${BOLD}${errors.length}${RESET}`
  );
  console.log(`⏱️ Duration                : ${durationSec}s`);
  console.log(`${CYAN}=====================================================${RESET}`);

  reportErrors(errors, skippedCsvPath);

  if (errors.length === 0) {
    console.log(`\n${GREEN}${BOLD}🎉 ALL RECORDS VALIDATED/UPLOADED CLEANLY WITH ZERO ERRORS!${RESET}\n`);
  } else {
    console.log('');
  }
}

main()
  .catch((e) => {
    console.error(`\n${RED}Fatal Error during upload:${RESET}`, e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
