/**
 * UPLOAD_OPERATOR.ts
 * 
 * Maga Company Operator Master Bulk Upload Script
 * 
 * Supports both:
 * 1. Standard 9-Column Format (Latest Company Sheet):
 *    Employee | In | Out | Additional Hours | Date | Equipment | Condition | Unit | Hours
 * 
 * 2. Legacy 6-Column Format:
 *    Operator | In | Out | Equipment | Hours | Date
 * 
 * Target Project: 539 (539M-CEP-Kadawatha Interchange / subdomain: 539)
 * 
 * Supervisor Workflow Emulation:
 * 1. Target Project Lock: Dedicated to Project 539 (subdomain '539').
 * 2. Supervisor / Admin Sheet: Automatically ensures MF_OP_DailySheet exists for each date with status 'submitted'.
 * 3. Daily Attendance Roster: Automatically registers operators into MF_OP_DailyAssignment.
 * 4. Idle Equipment Handling: Automatically detects 'ZXQOPRIDLE', 'IDLE', 'NONE', '-' and records operator shift with equipmentId = null without crashing or skipping.
 * 5. Equipment Resolution: Matches against Project & Corporate Equipment master. Supports aliases (e.g. MCH12 -> MCHM0012) and auto-registers new machines with Condition & Unit.
 * 6. Daily Equipment Assignment: Links assigned machine to operator in MF_OP_DailyEquipmentAssignment.
 * 7. Meal & Shift Calculation: Computes lunch (12:00-13:00) and dinner (22:00-23:00) breaks.
 * 8. Additional Hours: Accurately applies positive/negative additional hours (shiftHours = rawShiftHours + additionalHours).
 * 9. Overtime (OT) Calculation: Calculates Sunday 100% OT, Saturday 5.5h base, and Weekday 8h base.
 * 10. Database Write: Saves directly to MF_OP_TimeEntry with status 'submitted'.
 */

import fs from 'fs';
import path from 'path';
import prisma from '../src/config/prisma';

// ANSI Colors for clear terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

interface RawOperatorRow {
  operatorIdentifier: string;
  inTime?: string;
  outTime?: string;
  additionalHours?: number;
  dateStr: string;
  equipmentIdentifier?: string;
  condition?: string;
  unit?: string;
  hours: number;
  rawLineIndex: number;
}

interface ProcessError {
  line: number;
  operator: string;
  equipment?: string;
  condition?: string;
  unit?: string;
  dateStr?: string;
  inTime?: string;
  outTime?: string;
  additionalHours?: number;
  hours?: number;
  reason: string;
}

interface OperatorParseResult {
  rows: RawOperatorRow[];
  parseErrors: ProcessError[];
  totalLines: number;
}

// Helper: Normalize time to standard "HH:mm" (returns null if invalid/corrupt)
export function normalizeTime(val?: string | null): string | null {
  if (!val) return null;
  const clean = val.trim();
  if (!clean) return null;

  // 1. Integer hours: e.g. "7" -> "07:00", "22" -> "22:00", "28" -> "04:00"
  if (/^\d{1,2}$/.test(clean)) {
    let h = parseInt(clean, 10);
    if (h < 0 || h > 48) return null;
    if (h >= 24) h = h % 24;
    return `${String(h).padStart(2, '0')}:00`;
  }

  // 2. Standard colon: e.g. "7:30" -> "07:30", "17:00" -> "17:00"
  if (/^\d{1,2}:\d{1,2}$/.test(clean)) {
    let [h, m] = clean.split(':').map(Number);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 48 || m < 0 || m >= 60) return null;
    if (h >= 24) h = h % 24;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // 3. Decimal hours e.g. "12.5" -> "12:30", "22.25" -> "22:15", "6.5" -> "06:30"
  if (/^\d{1,2}\.\d+$/.test(clean)) {
    const num = parseFloat(clean);
    if (isNaN(num) || num < 0 || num > 48) return null;
    let h = Math.floor(num);
    const frac = num - h;
    let m = Math.round(frac * 60);
    if (m >= 60) {
      h += 1;
      m = 0;
    }
    if (h >= 24) h = h % 24;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  return null;
}

// Helper: Parse date string into UTC Date object with strict calendar day validation
export function parseDateInput(val: string): Date | null {
  if (!val) return null;
  const clean = val.trim();
  if (!clean) return null;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    if (isNaN(y) || isNaN(m) || isNaN(d) || y < 2000 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    const date = new Date(Date.UTC(y, m - 1, d));
    if (isNaN(date.getTime()) || date.getUTCDate() !== d || date.getUTCMonth() !== m - 1) return null;
    return date;
  }

  // D/M/YYYY or DD/MM/YYYY or D-M-YYYY or DD-M-YYYY
  const delimiter = clean.includes('/') ? '/' : clean.includes('-') ? '-' : null;
  if (delimiter) {
    const slashParts = clean.split(delimiter);
    if (slashParts.length === 3) {
      let [day, month, year] = slashParts.map((p) => parseInt(p, 10));
      if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
      if (year < 100) year += 2000;
      if (year < 2000 || year > 2100) return null;

      // Swap if day was mistakenly put in month position (month > 12)
      if (month > 12 && day <= 12) {
        const temp = day;
        day = month;
        month = temp;
      }
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;

      const d = new Date(Date.UTC(year, month - 1, day));
      if (isNaN(d.getTime()) || d.getUTCDate() !== day || d.getUTCMonth() !== month - 1) return null;
      return d;
    }
  }

  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: Check if equipment code indicates idle or unassigned machine
export function isIdleEquipment(eq?: string | null): boolean {
  if (!eq) return true;
  const trimmed = eq.trim();
  if (trimmed === '' || trimmed === '-') return true;
  const clean = trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return (
    clean === 'ZXQOPRIDLE' ||
    clean === 'IDLE' ||
    clean === 'NONE' ||
    clean === 'NOEQ' ||
    clean === 'NA' ||
    clean === 'NIL' ||
    clean === '0'
  );
}

// Helper: Normalize known equipment aliases
export function normalizeEquipmentCode(eq?: string | null): string {
  if (!eq) return '';
  const clean = eq.trim().toUpperCase();
 
  return clean;
}

// Helper: Window-based break deductions (Lunch 12:00-13:00, Dinner 22:00-23:00)
function computeBreakHoursAndSnapshots(inTime?: string | null, outTime?: string | null): {
  breakHours: number;
  isLunchDeducted: boolean;
  isDinnerDeducted: boolean;
} {
  if (!inTime || !outTime) {
    return { breakHours: 0, isLunchDeducted: false, isDinnerDeducted: false };
  }
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  if (isNaN(inH) || isNaN(outH)) return { breakHours: 0, isLunchDeducted: false, isDinnerDeducted: false };

  const inMins = inH * 60 + (inM || 0);
  const outMins = outH * 60 + (outM || 0);

  const calcOverlap = (wStart: number, wEnd: number): number => {
    if (outMins > inMins) {
      return Math.max(0, Math.min(outMins, wEnd) - Math.max(inMins, wStart));
    } else {
      const seg1 = Math.max(0, Math.min(1440, wEnd) - Math.max(inMins, wStart));
      const seg2 = Math.max(0, Math.min(outMins, wEnd) - Math.max(0, wStart));
      return seg1 + seg2;
    }
  };

  let totalBreaks = 0;
  let isLunchDeducted = false;
  let isDinnerDeducted = false;

  // Lunch window (12:00 - 13:00)
  if (calcOverlap(12 * 60, 13 * 60) > 0) {
    totalBreaks += 1.0;
    isLunchDeducted = true;
  }

  // Dinner window (22:00 - 23:00)
  if (calcOverlap(22 * 60, 23 * 60) > 0) {
    totalBreaks += 1.0;
    isDinnerDeducted = true;
  }

  return { breakHours: totalBreaks, isLunchDeducted, isDinnerDeducted };
}

// Helper: Calculate Shift Hours, Overtime, and Break based on Day of Week and Maga rules
function calculateShiftAndOvertime(
  inTime: string,
  outTime: string,
  dayRule: { isAllOvertime: boolean; isSaturday: boolean; standardCap: number },
  isExternal: boolean = false,
  additionalHours: number = 0
): {
  shiftHours: number;
  otHours: number;
  breakHours: number;
  regularHours: number;
  isLunchDeducted: boolean;
  isDinnerDeducted: boolean;
} {
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
  if (diff <= 0) diff += 24 * 60;

  const grossHours = Math.round((diff / 60) * 100) / 100;
  const { breakHours, isLunchDeducted, isDinnerDeducted } = computeBreakHoursAndSnapshots(inTime, outTime);
  const rawShiftHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);
  const shiftHours = Math.max(0, Math.round((rawShiftHours + (additionalHours || 0)) * 100) / 100);

  if (shiftHours <= 0) {
    return { shiftHours: 0, otHours: 0, breakHours, regularHours: 0, isLunchDeducted, isDinnerDeducted };
  }

  let otHours = 0;
  let regularHours = 0;

  if (dayRule.isAllOvertime) {
    // Sunday, Poya, Public Holiday: 100% Overtime
    otHours = shiftHours;
    regularHours = 0;
  } else if (isExternal) {
    // External Subcontractor Operator: No negative OT, capped at standardCap
    const cap = dayRule.isSaturday ? 5.5 : 8.0;
    regularHours = Math.min(shiftHours, cap);
    otHours = shiftHours > cap ? Math.round((shiftHours - cap) * 100) / 100 : 0;
  } else if (dayRule.isSaturday) {
    // Saturday: Standard base is 5.5h (> 5.5 => +OT, < 5.5 => -OT)
    regularHours = Math.min(shiftHours, 5.5);
    otHours = Math.round((shiftHours - 5.5) * 100) / 100;
  } else {
    // Weekday: > 6h => Full Day (8.0h base); <= 6h => Half Day (4.0h base)
    if (shiftHours > 6.0) {
      regularHours = Math.min(shiftHours, 8.0);
      otHours = Math.round((shiftHours - 8.0) * 100) / 100;
    } else {
      regularHours = Math.min(shiftHours, 4.0);
      otHours = Math.round((shiftHours - 4.0) * 100) / 100;
    }
  }

  return {
    shiftHours,
    otHours,
    breakHours,
    regularHours,
    isLunchDeducted,
    isDinnerDeducted,
  };
}

// Helper: Parse CSV / TSV file with robust delimiters and header detection
function parseRawFile(content: string): OperatorParseResult {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { rows: [], parseErrors: [], totalLines: 0 };

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  const headerTokens = firstLine.split(delimiter).map((t) => t.trim().toLowerCase().replace(/[\"']/g, ''));
  const hasHeader = headerTokens.some(
    (tok) => tok.includes('operat') || tok.includes('emp') || tok.includes('equip') || tok.includes('date')
  );

  let colMap = {
    operator: -1,
    in: -1,
    out: -1,
    additionalHours: -1,
    date: -1,
    equipment: -1,
    condition: -1,
    unit: -1,
    hours: -1,
  };

  if (hasHeader) {
    headerTokens.forEach((tok, idx) => {
      if (tok.includes('add') || tok.includes('additional') || tok.includes('extra')) {
        colMap.additionalHours = idx;
      } else if (tok === 'in' || tok.includes('in_time') || tok.includes('intime')) {
        colMap.in = idx;
      } else if (tok === 'out' || tok.includes('out_time') || tok.includes('outtime')) {
        colMap.out = idx;
      } else if (tok.includes('operat') || tok.includes('emp') || tok.includes('epf') || tok.includes('driver')) {
        colMap.operator = idx;
      } else if (tok.includes('equip') || tok.includes('machine') || tok.includes('vehicle')) {
        colMap.equipment = idx;
      } else if (tok.includes('cond')) {
        colMap.condition = idx;
      } else if (tok.includes('unit')) {
        colMap.unit = idx;
      } else if (tok.includes('hour')) {
        colMap.hours = idx;
      } else if (tok.includes('date')) {
        colMap.date = idx;
      }
    });
  }

  // Fallback defaults if header was missing or incomplete
  if (colMap.operator === -1) {
    if (headerTokens.length >= 8) {
      // 9-column format
      colMap = {
        operator: 0,
        in: 1,
        out: 2,
        additionalHours: 3,
        date: 4,
        equipment: 5,
        condition: 6,
        unit: 7,
        hours: 8,
      };
    } else {
      // Legacy 6-column format
      colMap = {
        operator: 0,
        in: 1,
        out: 2,
        additionalHours: -1,
        equipment: 3,
        hours: 4,
        date: 5,
        condition: -1,
        unit: -1,
      };
    }
  }

  const startIndex = hasHeader ? 1 : 0;
  const rows: RawOperatorRow[] = [];
  const parseErrors: ProcessError[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawTokens = lines[i].split(delimiter).map((t) => t.trim().replace(/^[\"']+|[\"']+$/g, ''));
    const lineNum = i + 1;

    // Skip empty lines
    if (rawTokens.length === 0 || (rawTokens.length === 1 && !rawTokens[0])) continue;

    if (rawTokens.length < 2) {
      parseErrors.push({
        line: lineNum,
        operator: 'UNKNOWN',
        reason: 'Malformed row: insufficient columns or corrupted row data',
      });
      continue;
    }

    const op = colMap.operator >= 0 && colMap.operator < rawTokens.length ? rawTokens[colMap.operator] : '';
    const inT = colMap.in >= 0 && colMap.in < rawTokens.length ? rawTokens[colMap.in] : '';
    const outT = colMap.out >= 0 && colMap.out < rawTokens.length ? rawTokens[colMap.out] : '';
    const addHrsStr = colMap.additionalHours >= 0 && colMap.additionalHours < rawTokens.length ? rawTokens[colMap.additionalHours] : '';
    const dt = colMap.date >= 0 && colMap.date < rawTokens.length ? rawTokens[colMap.date] : '';
    const eq = colMap.equipment >= 0 && colMap.equipment < rawTokens.length ? rawTokens[colMap.equipment] : '';
    const cond = colMap.condition >= 0 && colMap.condition < rawTokens.length ? rawTokens[colMap.condition] : '';
    const unt = colMap.unit >= 0 && colMap.unit < rawTokens.length ? rawTokens[colMap.unit] : '';
    const hrsStr = colMap.hours >= 0 && colMap.hours < rawTokens.length ? rawTokens[colMap.hours] : '';

    // Skip completely blank rows with no meaningful fields
    if (!op && !eq && !hrsStr && !inT && !outT && !dt) continue;

    let hasLineError = false;

    // Validate Operator
    if (!op) {
      parseErrors.push({
        line: lineNum,
        operator: 'UNKNOWN',
        equipment: eq,
        condition: cond,
        unit: unt,
        dateStr: dt,
        inTime: inT,
        outTime: outT,
        reason: 'Missing Operator / Employee Code',
      });
      hasLineError = true;
    }

    // Validate In Time
    let normIn: string | undefined = undefined;
    if (inT) {
      const normalized = normalizeTime(inT);
      if (!normalized) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          reason: `Invalid In Time format: '${inT}'`,
        });
        hasLineError = true;
      } else {
        normIn = normalized;
      }
    }

    // Validate Out Time
    let normOut: string | undefined = undefined;
    if (outT) {
      const normalized = normalizeTime(outT);
      if (!normalized) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          reason: `Invalid Out Time format: '${outT}'`,
        });
        hasLineError = true;
      } else {
        normOut = normalized;
      }
    }

    // Validate Hours
    let hoursVal = 8.0;
    if (hrsStr) {
      const parsed = parseFloat(hrsStr);
      if (isNaN(parsed)) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          reason: `Invalid Hours format (not a valid number): '${hrsStr}'`,
        });
        hasLineError = true;
      } else if (parsed < 0 || parsed > 48) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          hours: parsed,
          reason: `Hours must be between 0 and 48 (got: ${hrsStr})`,
        });
        hasLineError = true;
      } else {
        hoursVal = parsed;
      }
    }

    // Validate Additional Hours
    let addHoursVal: number | undefined = undefined;
    if (addHrsStr) {
      const parsedAdd = parseFloat(addHrsStr);
      if (isNaN(parsedAdd)) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          reason: `Invalid Additional Hours format: '${addHrsStr}'`,
        });
        hasLineError = true;
      } else if (parsedAdd < -12 || parsedAdd > 24) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          additionalHours: parsedAdd,
          reason: `Additional Hours out of range (-12 to 24): '${addHrsStr}'`,
        });
        hasLineError = true;
      } else {
        addHoursVal = parsedAdd;
      }
    }

    // Validate Date
    if (!dt) {
      parseErrors.push({
        line: lineNum,
        operator: op || 'UNKNOWN',
        equipment: eq,
        condition: cond,
        unit: unt,
        dateStr: '',
        inTime: inT,
        outTime: outT,
        hours: hoursVal,
        reason: 'Missing Date',
      });
      hasLineError = true;
    } else {
      const parsedDate = parseDateInput(dt);
      if (!parsedDate) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          hours: hoursVal,
          reason: `Invalid Date format or invalid calendar day: '${dt}'`,
        });
        hasLineError = true;
      }
    }

    // Validate Equipment format (if provided and not idle)
    if (eq && !isIdleEquipment(eq)) {
      const cleanEq = eq.trim();
      if (!/^[a-zA-Z0-9_\-\/]+$/.test(cleanEq)) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          hours: hoursVal,
          reason: `Invalid Equipment Code format: '${eq}'. Contains invalid special characters.`,
        });
        hasLineError = true;
      }
    }

    // Validate Condition (if provided)
    if (cond) {
      const cleanCond = cond.trim().toUpperCase();
      if (!['DRY', 'WET'].includes(cleanCond)) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          hours: hoursVal,
          reason: `Invalid Condition: '${cond}'. Expected 'DRY' or 'WET'.`,
        });
        hasLineError = true;
      }
    }

    // Validate Unit (if provided)
    if (unt) {
      const cleanUnt = unt.trim().toUpperCase();
      const validUnits = ['HRS', 'HOURS', 'DAY', 'DAYS', 'MTH', 'MONTH', 'EX.HRS', 'KM', 'M2'];
      if (!validUnits.includes(cleanUnt)) {
        parseErrors.push({
          line: lineNum,
          operator: op || 'UNKNOWN',
          equipment: eq,
          condition: cond,
          unit: unt,
          dateStr: dt,
          inTime: inT,
          outTime: outT,
          hours: hoursVal,
          reason: `Invalid Unit: '${unt}'. Expected 'hrs', 'day', 'mth', etc.`,
        });
        hasLineError = true;
      }
    }

    if (hasLineError) continue;

    rows.push({
      operatorIdentifier: op,
      inTime: normIn,
      outTime: normOut,
      additionalHours: addHoursVal,
      dateStr: dt,
      equipmentIdentifier: eq || undefined,
      condition: cond || undefined,
      unit: unt || undefined,
      hours: hoursVal,
      rawLineIndex: lineNum,
    });
  }

  return { rows, parseErrors, totalLines: lines.length - startIndex };
}

async function main() {
  const startTime = Date.now();
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}    MAGA OPERATOR & MACHINE TIME ENTRY UPLOADER      ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}\n`);

  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  if (isDryRun) {
    console.log(`${YELLOW}${BOLD}🧪 RUNNING IN DRY RUN MODE (No database writes will occur)${RESET}\n`);
  }

  const defaultFilePath = path.join(__dirname, 'Company operator Master Upload Sheet.csv');
  let explicitFilePath: string | null = null;
  let explicitProject: string | null = null;
  let explicitSupervisor: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--file=') || a.startsWith('-f=')) {
      const p = a.includes('=') ? a.slice(a.indexOf('=') + 1).replace(/^["']|["']$/g, '').trim() : '';
      if (p) {
        explicitFilePath = fs.existsSync(p) ? path.resolve(p) : path.join(__dirname, p);
        args.splice(i, 1);
        i--;
        continue;
      }
    }
  }

  for (let i = 0; i < args.length; i++) {
    for (let j = args.length; j > i; j--) {
      const candidate = args.slice(i, j).join(' ').replace(/^[\"'\`]+|[\"'\`]+$/g, '').trim();
      if (!candidate || candidate.startsWith('-')) continue;
      if (fs.existsSync(candidate)) {
        explicitFilePath = path.resolve(candidate);
        args.splice(i, j - i);
        break;
      } else if (fs.existsSync(path.join(__dirname, candidate))) {
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
      if (!explicitProject) {
        explicitProject = a.trim();
      }
    }
  }

  let targetFilePath = explicitFilePath || defaultFilePath;

  // 1. Resolve Target Project: Dedicated Project 539 Lock
  const allProjects = await prisma.mF_P_Project.findMany({
    select: { id: true, projectCode: true, projectName: true, subdomain: true },
  });

  const targetProjectQuery = explicitProject || '539';
  const cleanReq = targetProjectQuery.toUpperCase().replace(/[^A-Z0-9]/g, '');

  let project = explicitProject
    ? allProjects.find((p) => {
        const sCode = (p.subdomain || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const pCode = p.projectCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return sCode === cleanReq || pCode === cleanReq || pCode.includes(cleanReq);
      }) || null
    : allProjects.find((p) => p.subdomain === '539') || allProjects[0];

  if (!project) {
    console.error(`${RED}❌ Error: Project ${targetProjectQuery} not found in database!${RESET}`);
    process.exit(1);
  }
  console.log(`📌 Target Project: ${BOLD}${project.projectName} (${project.projectCode}) [Subdomain: ${project.subdomain}]${RESET}`);

  // 2. Resolve Active Supervisor / Admin for Project 539
  let supervisor: { id: string; username: string; fullName: string } | null = null;

  if (explicitSupervisor) {
    const cleanSup = explicitSupervisor.toLowerCase();
    supervisor = await prisma.mF_P_User.findFirst({
      where: {
        projectId: project.id,
        status: 'active',
        OR: [
          { username: { equals: cleanSup, mode: 'insensitive' } },
          { fullName: { contains: cleanSup, mode: 'insensitive' } },
        ],
      },
      select: { id: true, username: true, fullName: true },
    });
  }

  if (!supervisor) {
    supervisor = await prisma.mF_P_User.findFirst({
      where: {
        projectId: project.id,
        role: 'supervisor',
        status: 'active',
      },
      select: { id: true, username: true, fullName: true },
    });
  }

  if (!supervisor) {
    supervisor = await prisma.mF_P_User.findFirst({
      where: {
        projectId: project.id,
        role: 'admin',
        status: 'active',
      },
      select: { id: true, username: true, fullName: true },
    });
  }

  if (!supervisor) {
    console.error(`${RED}❌ Error: No active supervisor or admin found for project ${project.projectCode}!${RESET}`);
    process.exit(1);
  }
  console.log(`👷 Active Supervisor/Admin: ${BOLD}${supervisor.fullName} (@${supervisor.username})${RESET}`);

  if (!fs.existsSync(targetFilePath)) {
    console.error(`${RED}❌ Error: Input file not found: ${targetFilePath}${RESET}`);
    process.exit(1);
  }

  console.log(`📂 Reading data from: ${BOLD}${targetFilePath}${RESET}`);
  const rawFileContent = fs.readFileSync(targetFilePath, 'utf-8');
  const { rows: parsedRows, parseErrors, totalLines } = parseRawFile(rawFileContent);
  const errors: ProcessError[] = [...parseErrors];

  if (parsedRows.length === 0 && errors.length === 0) {
    console.log(`${YELLOW}⚠️ No data rows found in file.${RESET}`);
    return;
  }
  console.log(`📋 Total lines identified: ${BOLD}${totalLines}${RESET} (Parsed Valid Rows: ${GREEN}${parsedRows.length}${RESET}, Initial Parse Warnings: ${errors.length > 0 ? RED : GREEN}${errors.length}${RESET})\n`);

  // Pre-load local employees, corporate employees, and equipment
  console.log(`🔄 Pre-loading Project Operators & Equipment Master...`);
  const projectEmployees = await prisma.mF_P_Employee.findMany({
    where: { projectId: project.id },
    include: {
      corporateEmployee: true,
      tradeGroup: true,
    },
  });

  const empMap = new Map<string, typeof projectEmployees[0]>();
  for (const pe of projectEmployees) {
    const corp = pe.corporateEmployee;
    if (corp.employeeCode) empMap.set(corp.employeeCode.trim().toLowerCase(), pe);
    if (corp.epfNo) empMap.set(corp.epfNo.trim().toLowerCase(), pe);
    if (pe.callingName) empMap.set(pe.callingName.trim().toLowerCase(), pe);
    if (corp.fullName) empMap.set(corp.fullName.trim().toLowerCase(), pe);
  }

  const corporateEmployees = await prisma.mF_G_Employee.findMany();
  const corpEmpMap = new Map<string, typeof corporateEmployees[0]>();
  for (const ce of corporateEmployees) {
    if (ce.employeeCode) corpEmpMap.set(ce.employeeCode.trim().toLowerCase(), ce);
    if (ce.epfNo) corpEmpMap.set(ce.epfNo.trim().toLowerCase(), ce);
    if (ce.fullName) corpEmpMap.set(ce.fullName.trim().toLowerCase(), ce);
  }

  const projectEquipmentList = await prisma.mF_P_Equipment.findMany({
    where: { projectId: project.id },
    include: {
      corporateEquipment: true,
    },
  });

  const eqMap = new Map<string, typeof projectEquipmentList[0]>();
  for (const pe of projectEquipmentList) {
    const corp = pe.corporateEquipment;
    if (corp?.standardEquipmentNumber) {
      eqMap.set(corp.standardEquipmentNumber.trim().toLowerCase(), pe);
      eqMap.set(corp.standardEquipmentNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), pe);
    }
    if (corp?.vehicleNo) {
      eqMap.set(corp.vehicleNo.trim().toLowerCase(), pe);
      eqMap.set(corp.vehicleNo.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), pe);
    }
    eqMap.set(pe.id.toLowerCase(), pe);
  }

  const corporateEquipments = await prisma.mF_G_Equipment.findMany();
  const corpEqMap = new Map<string, typeof corporateEquipments[0]>();
  for (const ce of corporateEquipments) {
    if (ce.standardEquipmentNumber) {
      corpEqMap.set(ce.standardEquipmentNumber.trim().toLowerCase(), ce);
      corpEqMap.set(ce.standardEquipmentNumber.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), ce);
    }
    if (ce.vehicleNo) {
      corpEqMap.set(ce.vehicleNo.trim().toLowerCase(), ce);
      corpEqMap.set(ce.vehicleNo.trim().toLowerCase().replace(/[^a-z0-9]/g, ''), ce);
    }
  }

  console.log(`🔄 Pre-loading Day Types and Project Calendar...`);
  const allDayTypes = await prisma.mF_G_DayType.findMany();
  const dayTypeByCode = new Map<string, typeof allDayTypes[0]>();
  for (const dt of allDayTypes) {
    dayTypeByCode.set(dt.code.toUpperCase(), dt);
  }

  const normalDayType = dayTypeByCode.get('NORMAL') || allDayTypes[0];
  const sundayDayType = dayTypeByCode.get('SUNDAY') || normalDayType;
  const saturdayDayType = dayTypeByCode.get('SATURDAY') || normalDayType;

  // Pre-load project calendar overrides (Poya, Public Holiday, Shutdown, etc.)
  const projectCalendar = await prisma.mF_P_CalendarDay.findMany({
    where: { projectId: project.id },
    include: { dayType: true },
  });
  const projectCalendarMap = new Map<string, typeof projectCalendar[0]>();
  for (const cd of projectCalendar) {
    const dateKey = cd.date.toISOString().slice(0, 10);
    projectCalendarMap.set(dateKey, cd);
  }

  // Helper: Dynamic Day Type & OT Rule Resolver for any Date
  function getDayTypeRuleForDate(dateObj: Date) {
    const dateKey = dateObj.toISOString().slice(0, 10);

    // 1. Project Calendar overrides ALWAYS TAKE TOP PRIORITY!
    if (projectCalendarMap.has(dateKey)) {
      const cd = projectCalendarMap.get(dateKey)!;
      const code = (cd.dayType?.code || 'NORMAL').toUpperCase();
      const isSaturday = code === 'SATURDAY';
      const isSunday = code === 'SUNDAY';
      const isAllOvertime = isSunday || code === 'POYA' || code === 'PUBLIC_HOLIDAY' || code === 'HOLIDAY';
      return {
        dayTypeId: cd.dayTypeId,
        code,
        name: cd.dayType?.name || code,
        isAllOvertime,
        isSaturday,
        standardCap: isAllOvertime ? 0.0 : isSaturday ? 5.5 : 8.0,
      };
    }

    // 2. Fallback to Day of Week
    const dow = dateObj.getUTCDay(); // 0 = Sun, 6 = Sat
    if (dow === 0) {
      return {
        dayTypeId: sundayDayType.id,
        code: 'SUNDAY',
        name: sundayDayType.name,
        isAllOvertime: true,
        isSaturday: false,
        standardCap: 0.0,
      };
    }
    if (dow === 6) {
      return {
        dayTypeId: saturdayDayType.id,
        code: 'SATURDAY',
        name: saturdayDayType.name,
        isAllOvertime: false,
        isSaturday: true,
        standardCap: 5.5,
      };
    }
    return {
      dayTypeId: normalDayType.id,
      code: 'NORMAL',
      name: normalDayType.name,
      isAllOvertime: false,
      isSaturday: false,
      standardCap: 8.0,
    };
  }

  const defaultTradeGroup =
    (await prisma.mF_G_TradeGroup.findFirst({ where: { status: 'active' } })) ||
    (await prisma.mF_G_TradeGroup.findFirst());

  console.log(`🔄 Pre-loading Approved Time Entries for fast O(1) duplicate checks...`);
  const approvedEntries = await prisma.mF_OP_TimeEntry.findMany({
    where: {
      projectId: project.id,
      status: 'approved',
    },
    select: {
      employeeId: true,
      date: true,
    },
  });

  const approvedSet = new Set<string>();
  for (const ae of approvedEntries) {
    const dStr = ae.date.toISOString().slice(0, 10);
    approvedSet.add(`${ae.employeeId}__${dStr}`);
  }
  console.log(`   Found ${BOLD}${approvedEntries.length}${RESET} approved entries locked for project ${project.projectCode}.\n`);

  // Group Rows by (Operator, Date) to enforce 1 TimeEntry per Operator per Date
  console.log(`🔗 Validating and grouping operator shifts...`);
  interface OperatorShiftGroup {
    operatorIdentifier: string;
    dateStr: string;
    date: Date;
    inTime?: string;
    outTime?: string;
    additionalHours: number;
    equipmentIdentifier?: string;
    condition?: string;
    unit?: string;
    hours: number;
    rawLineIndex: number;
  }

  const groupedEntries = new Map<string, OperatorShiftGroup>();
  let lastOperator = '';
  let lastDateStr = '';

  for (const r of parsedRows) {
    const opKey = r.operatorIdentifier || lastOperator;
    const dtStr = r.dateStr || lastDateStr;

    // Validation 1: Missing Operator
    if (!opKey) {
      errors.push({
        line: r.rawLineIndex,
        operator: 'UNKNOWN',
        equipment: r.equipmentIdentifier,
        condition: r.condition,
        unit: r.unit,
        dateStr: r.dateStr,
        inTime: r.inTime,
        outTime: r.outTime,
        additionalHours: r.additionalHours,
        hours: r.hours,
        reason: 'Missing Operator / Employee Code',
      });
      continue;
    }

    // Validation 2: Missing Date
    if (!dtStr) {
      errors.push({
        line: r.rawLineIndex,
        operator: opKey,
        equipment: r.equipmentIdentifier,
        condition: r.condition,
        unit: r.unit,
        dateStr: '',
        inTime: r.inTime,
        outTime: r.outTime,
        additionalHours: r.additionalHours,
        hours: r.hours,
        reason: 'Missing Date',
      });
      continue;
    }

    // Validation 3: Date Parsing
    const parsedDate = parseDateInput(dtStr);
    if (!parsedDate) {
      errors.push({
        line: r.rawLineIndex,
        operator: opKey,
        equipment: r.equipmentIdentifier,
        condition: r.condition,
        unit: r.unit,
        dateStr: dtStr,
        inTime: r.inTime,
        outTime: r.outTime,
        additionalHours: r.additionalHours,
        hours: r.hours,
        reason: `Invalid Date format: "${dtStr}". Expected DD/MM/YYYY or YYYY-MM-DD.`,
      });
      continue;
    }

    lastOperator = opKey;
    lastDateStr = dtStr;

    const groupKey = `${opKey.trim().toUpperCase()}___${parsedDate.toISOString().slice(0, 10)}`;

    if (!groupedEntries.has(groupKey)) {
      groupedEntries.set(groupKey, {
        operatorIdentifier: opKey.trim(),
        dateStr: dtStr,
        date: parsedDate,
        inTime: r.inTime,
        outTime: r.outTime,
        additionalHours: r.additionalHours || 0,
        equipmentIdentifier: r.equipmentIdentifier?.trim(),
        condition: r.condition?.trim(),
        unit: r.unit?.trim(),
        hours: r.hours,
        rawLineIndex: r.rawLineIndex,
      });
    } else {
      const existing = groupedEntries.get(groupKey)!;
      if (!existing.inTime && r.inTime) existing.inTime = r.inTime;
      if (!existing.outTime && r.outTime) existing.outTime = r.outTime;
      if (r.additionalHours !== undefined) existing.additionalHours += r.additionalHours;
      if (!existing.equipmentIdentifier || isIdleEquipment(existing.equipmentIdentifier)) {
        if (r.equipmentIdentifier && !isIdleEquipment(r.equipmentIdentifier)) {
          existing.equipmentIdentifier = r.equipmentIdentifier.trim();
        }
      }
      if (r.condition && !existing.condition) existing.condition = r.condition.trim();
      if (r.unit && !existing.unit) existing.unit = r.unit.trim();
      existing.hours += r.hours;
    }
  }

  console.log(`📦 Unique Operator Shifts to process: ${BOLD}${groupedEntries.size}${RESET}\n`);

  let successCount = 0;
  let skippedCount = 0;
  const processedDailySheets = new Map<string, string>(); // dateKey -> dailySheetId

  for (const [, group] of groupedEntries) {
    try {
      const cleanOpKey = group.operatorIdentifier.toLowerCase();
      const localEmp = empMap.get(cleanOpKey);

      // Do NOT auto-link or auto-create employees in project. Report error if not assigned to project (Strict Policy).
      if (!localEmp) {
        const corpEmp = corpEmpMap.get(cleanOpKey);
        const reason = corpEmp
          ? `Operator '${group.operatorIdentifier}' exists in Corporate Master but is not assigned to Project ${project.projectCode}. Transfer or assign the operator to this project first.`
          : `Operator '${group.operatorIdentifier}' not found in site employee table (MF_L_EMPLOYEE).`;

        errors.push({
          line: group.rawLineIndex,
          operator: group.operatorIdentifier,
          equipment: group.equipmentIdentifier,
          condition: group.condition,
          unit: group.unit,
          dateStr: group.dateStr,
          inTime: group.inTime,
          outTime: group.outTime,
          additionalHours: group.additionalHours,
          hours: group.hours,
          reason,
        });
        skippedCount++;
        continue;
      }

      // Resolve Equipment (with idle equipment and auto-creation support)
      let localEq: typeof projectEquipmentList[0] | null = null;
      const isIdle = isIdleEquipment(group.equipmentIdentifier);

      if (!isIdle && group.equipmentIdentifier) {
        const normalizedCode = normalizeEquipmentCode(group.equipmentIdentifier);
        const cleanEqKey = normalizedCode.toLowerCase();
        const strippedEqKey = cleanEqKey.replace(/[^a-z0-9]/g, '');

        localEq = eqMap.get(cleanEqKey) || eqMap.get(strippedEqKey) || null;

        // Auto-link from corporate equipment master if not yet linked to Project 539
        if (!localEq) {
          let corpEq = corpEqMap.get(cleanEqKey) || corpEqMap.get(strippedEqKey);

          // If still not in corporate equipment master, auto-create to ensure zero upload failure
          if (!corpEq) {
            if (!isDryRun) {
              corpEq = await prisma.mF_G_Equipment.create({
                data: {
                  standardEquipmentNumber: normalizedCode,
                  equipmentName: `${normalizedCode} (Machine)`,
                  condition: group.condition || 'DRY',
                  unit: group.unit || 'hrs',
                  dailyRate: 2500,
                  costRate: 0,
                  status: 'active',
                  currentProjectId: project.id,
                },
              });
              corpEqMap.set(cleanEqKey, corpEq);
              corpEqMap.set(strippedEqKey, corpEq);
            } else {
              corpEq = {
                id: 'dry-run-corp-eq-id',
                standardEquipmentNumber: normalizedCode,
                equipmentName: `${normalizedCode} (Machine)`,
                condition: group.condition || 'DRY',
                unit: group.unit || 'hrs',
                dailyRate: 2500,
                costRate: 0,
                status: 'active',
              } as any;
            }
          }

          if (corpEq) {
            if (!isDryRun) {
              const created = await prisma.mF_P_Equipment.create({
                data: {
                  projectId: project.id,
                  corporateEquipmentId: corpEq.id,
                  condition: group.condition || corpEq.condition || 'DRY',
                  costRate: corpEq.costRate || corpEq.dailyRate || 0,
                  status: 'active',
                  meterUnitCode: group.unit || corpEq.unit || 'hrs',
                },
                include: {
                  corporateEquipment: true,
                },
              });
              localEq = created;
              eqMap.set(cleanEqKey, created);
              eqMap.set(strippedEqKey, created);
            } else {
              localEq = {
                id: 'dry-run-eq-id',
                projectId: project.id,
                corporateEquipmentId: corpEq.id,
                condition: group.condition || corpEq.condition || 'DRY',
                costRate: corpEq.costRate || corpEq.dailyRate || 0,
                status: 'active',
                meterUnitCode: group.unit || corpEq.unit || 'hrs',
                ownerPartnerId: null,
                createdAt: new Date(),
                corporateEquipment: corpEq,
              } as any;
            }
          }
        }

        // If localEq exists, update condition or meterUnitCode if specified in CSV
        if (localEq && !isDryRun) {
          const needCondUpdate = group.condition && group.condition !== localEq.condition;
          const needUnitUpdate = group.unit && group.unit !== localEq.meterUnitCode;
          if (needCondUpdate || needUnitUpdate) {
            await prisma.mF_P_Equipment.update({
              where: { id: localEq.id },
              data: {
                condition: group.condition || localEq.condition,
                meterUnitCode: group.unit || localEq.meterUnitCode,
              },
            });
          }
        }
      }

      // Ensure isOperator is true on local employee
      if (!localEmp.isOperator && !isDryRun) {
        await prisma.mF_P_Employee.update({
          where: { id: localEmp.id },
          data: { isOperator: true },
        });
        localEmp.isOperator = true;
      }

      // Safety check: Prevent overwriting APPROVED time entries using fast O(1) in-memory check
      const dateKey = group.date.toISOString().slice(0, 10);
      const targetUtcDate = new Date(dateKey + 'T00:00:00.000Z');
      const shiftDateKey = `${localEmp.id}__${dateKey}`;

      if (approvedSet.has(shiftDateKey)) {
        errors.push({
          line: group.rawLineIndex,
          operator: group.operatorIdentifier,
          equipment: group.equipmentIdentifier,
          condition: group.condition,
          unit: group.unit,
          dateStr: group.dateStr,
          inTime: group.inTime,
          outTime: group.outTime,
          additionalHours: group.additionalHours,
          hours: group.hours,
          reason: `Time Entry on ${dateKey} is already APPROVED by Admin/PM. Did not overwrite.`,
        });
        skippedCount++;
        continue;
      }

      // Ensure DailySheet exists for date under supervisor/admin
      let dailySheetId = processedDailySheets.get(dateKey);
      if (!dailySheetId && !isDryRun) {
        const dailySheet = await prisma.mF_OP_DailySheet.upsert({
          where: {
            projectId_supervisorId_date: {
              projectId: project.id,
              supervisorId: supervisor.id,
              date: targetUtcDate,
            },
          },
          update: {},
          create: {
            projectId: project.id,
            supervisorId: supervisor.id,
            date: targetUtcDate,
            status: 'submitted',
          },
        });
        dailySheetId = dailySheet.id;
        processedDailySheets.set(dateKey, dailySheetId);
      }

      // Calculate shift hours, overtime, and break deductions
      let finalInTime: string | null = group.inTime || null;
      let finalOutTime: string | null = group.outTime || null;
      let shiftHours = Number(group.hours || 0);
      let otHours = 0;
      let breakHours = 0;
      let regularHours = shiftHours;
      let isLunchDeducted = false;
      let isDinnerDeducted = false;

      const isExt = Boolean(localEmp.businessPartnerId || localEmp.corporateEmployee?.employeeType === 'external');
      const dayRule = getDayTypeRuleForDate(targetUtcDate);

      if (group.inTime && group.outTime) {
        const { breakHours: bHrs } = computeBreakHoursAndSnapshots(group.inTime, group.outTime);
        const [inH, inM] = group.inTime.split(':').map(Number);
        const [outH, outM] = group.outTime.split(':').map(Number);
        let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
        if (diff <= 0) diff += 24 * 60;
        const grossHrs = Math.round((diff / 60) * 100) / 100;
        const rawShift = Math.max(0, Math.round((grossHrs - bHrs) * 100) / 100);
        const addHrs = group.additionalHours || 0;
        const maxAllowed = Math.round((rawShift + addHrs) * 100) / 100;

        // Validation (Strict Option A): If Operator hours exceed shift duration and Additional Hours was not entered, reject as Error!
        if (group.hours > maxAllowed + 0.05) {
          const excess = Math.round((group.hours - rawShift) * 100) / 100;
          const reasonMsg = addHrs > 0
            ? `Hours Exceeded: Operator hours (${group.hours}h) exceed shift duration with Additional Hours (${maxAllowed}h) by +${Math.round((group.hours - maxAllowed) * 100) / 100}h.`
            : `Hours Exceeded: Operator hours (${group.hours}h) exceed shift duration (${rawShift}h) by +${excess}h, but Additional Hours was not entered.`;

          errors.push({
            line: group.rawLineIndex,
            operator: group.operatorIdentifier,
            equipment: group.equipmentIdentifier,
            condition: group.condition,
            unit: group.unit,
            dateStr: group.dateStr,
            inTime: group.inTime,
            outTime: group.outTime,
            additionalHours: group.additionalHours,
            hours: group.hours,
            reason: reasonMsg,
          });
          skippedCount++;
          continue;
        }

        const calc = calculateShiftAndOvertime(
          group.inTime,
          group.outTime,
          dayRule,
          isExt,
          group.additionalHours
        );
        shiftHours = calc.shiftHours;
        otHours = calc.otHours;
        breakHours = calc.breakHours;
        regularHours = calc.regularHours;
        isLunchDeducted = calc.isLunchDeducted;
        isDinnerDeducted = calc.isDinnerDeducted;
        finalInTime = group.inTime;
        finalOutTime = group.outTime;
      } else {
        // Fallback when flat hours provided
        shiftHours = Math.max(0, shiftHours + group.additionalHours);
        if (shiftHours <= 0) {
          otHours = 0;
          regularHours = 0;
        } else if (dayRule.isAllOvertime) {
          otHours = shiftHours;
          regularHours = 0;
        } else if (isExt) {
          const cap = dayRule.isSaturday ? 5.5 : 8.0;
          regularHours = Math.min(shiftHours, cap);
          otHours = shiftHours > cap ? Math.round((shiftHours - cap) * 100) / 100 : 0;
        } else if (dayRule.isSaturday) {
          regularHours = Math.min(shiftHours, 5.5);
          otHours = Math.round((shiftHours - 5.5) * 100) / 100;
        } else if (shiftHours > 6.0) {
          regularHours = Math.min(shiftHours, 8.0);
          otHours = Math.round((shiftHours - 8.0) * 100) / 100;
        } else {
          regularHours = Math.min(shiftHours, 4.0);
          otHours = Math.round((shiftHours - 4.0) * 100) / 100;
        }
      }

      const eqDisplay = localEq
        ? localEq.corporateEquipment?.standardEquipmentNumber || group.equipmentIdentifier
        : 'ZXQOPRIDLE (Idle)';

      if (isDryRun) {
        console.log(
          `  ${GREEN}✓ [DRY RUN]${RESET} Op: ${localEmp.corporateEmployee.employeeCode} (${localEmp.callingName || localEmp.corporateEmployee.fullName}) | Eq: ${eqDisplay} | Day: ${dayRule.code} | In: ${finalInTime || '-'} Out: ${finalOutTime || '-'} Add: ${group.additionalHours || 0}h | Shift: ${shiftHours}h (OT: ${otHours}h)`
        );
        successCount++;
        continue;
      }

      // Step 1: Ensure DailyAssignment exists for operator (Attendance gang)
      await prisma.mF_OP_DailyAssignment.upsert({
        where: {
          dailySheetId_employeeId: {
            dailySheetId: dailySheetId!,
            employeeId: localEmp.id,
          },
        },
        update: {},
        create: {
          dailySheetId: dailySheetId!,
          employeeId: localEmp.id,
        },
      });

      // Step 2: Ensure DailyEquipmentAssignment exists linking operator to machine (if not idle)
      if (localEq) {
        await prisma.mF_OP_DailyEquipmentAssignment.upsert({
          where: {
            dailySheetId_equipmentId: {
              dailySheetId: dailySheetId!,
              equipmentId: localEq.id,
            },
          },
          update: {
            operatorId: localEmp.id,
          },
          create: {
            dailySheetId: dailySheetId!,
            equipmentId: localEq.id,
            operatorId: localEmp.id,
          },
        });
      }

      // Step 3: Upsert into MF_OP_TimeEntry with unique composite key (projectId, employeeId, date)
      const upsertedTe = await prisma.mF_OP_TimeEntry.upsert({
        where: {
          projectId_employeeId_date: {
            projectId: project.id,
            employeeId: localEmp.id,
            date: targetUtcDate,
          },
        },
        update: {
          dailySheetId: dailySheetId!,
          equipmentId: localEq ? localEq.id : null,
          effectiveDayTypeId: dayRule.dayTypeId,
          inTime: finalInTime,
          outTime: finalOutTime,
          shiftHours,
          overtimeHours: otHours,
          breakHours,
          isLunchDeducted,
          isDinnerDeducted,
          additionalHours: group.additionalHours || 0.0,
          hours: regularHours,
          status: 'submitted',
          submittedAt: new Date(),
          appliedDailyRate: localEmp.dailyRate ? Number(localEmp.dailyRate) : 1400.0,
        },
        create: {
          projectId: project.id,
          dailySheetId: dailySheetId!,
          employeeId: localEmp.id,
          date: targetUtcDate,
          equipmentId: localEq ? localEq.id : null,
          effectiveDayTypeId: dayRule.dayTypeId,
          inTime: finalInTime,
          outTime: finalOutTime,
          shiftHours,
          overtimeHours: otHours,
          breakHours,
          isLunchDeducted,
          isDinnerDeducted,
          additionalHours: group.additionalHours || 0.0,
          hours: regularHours,
          status: 'submitted',
          submittedAt: new Date(),
          appliedDailyRate: localEmp.dailyRate ? Number(localEmp.dailyRate) : 1400.0,
        },
      });

      if (localEq) {
        await prisma.mF_OP_OperatorEquipmentSplit.upsert({
          where: {
            timeEntryId_equipmentId: {
              timeEntryId: upsertedTe.id,
              equipmentId: localEq.id,
            },
          },
          update: { hours: regularHours || shiftHours },
          create: {
            timeEntryId: upsertedTe.id,
            equipmentId: localEq.id,
            hours: regularHours || shiftHours,
          },
        });
      }

      console.log(
        `  ${GREEN}✓${RESET} Op: ${localEmp.corporateEmployee.employeeCode} (${localEmp.callingName || localEmp.corporateEmployee.fullName}) | Eq: ${eqDisplay} | In: ${finalInTime || '-'} Out: ${finalOutTime || '-'} Add: ${group.additionalHours || 0}h | Shift: ${shiftHours}h (OT: ${otHours}h)`
      );
      successCount++;
    } catch (err: any) {
      errors.push({
        line: group.rawLineIndex,
        operator: group.operatorIdentifier,
        equipment: group.equipmentIdentifier,
        condition: group.condition,
        unit: group.unit,
        dateStr: group.dateStr,
        inTime: group.inTime,
        outTime: group.outTime,
        additionalHours: group.additionalHours,
        hours: group.hours,
        reason: `Unexpected database error: ${err.message || String(err)}`,
      });
      skippedCount++;
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // Summary Report
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}             OPERATOR UPLOAD SUMMARY REPORT          ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`🔹 Total File Rows         : ${BOLD}${totalLines}${RESET}`);
  console.log(`✅ Successfully Processed  : ${GREEN}${BOLD}${successCount}${RESET} operator shifts`);
  console.log(`⚠️ Skipped / Errors        : ${errors.length > 0 ? RED : GREEN}${BOLD}${errors.length}${RESET}`);
  console.log(`⏱️ Duration                : ${duration} seconds`);
  console.log(`${CYAN}=====================================================${RESET}`);

  const skippedCsvPath = path.join(__dirname, 'skipped_operator_records.csv');

  if (errors.length > 0) {
    console.log(`\n${RED}${BOLD}❌ SKIPPED / REJECTED OPERATOR RECORDS TABLE:${RESET}`);
    console.log(`${CYAN}----------------------------------------------------------------------------------------------------------------------------------${RESET}`);
    console.log(
      `${BOLD}${'Line'.padEnd(6)} | ${'Operator'.padEnd(12)} | ${'Date'.padEnd(12)} | ${'Equipment'.padEnd(14)} | ${'In/Out'.padEnd(13)} | ${'Hours'.padEnd(6)} | Reason${RESET}`
    );
    console.log(`${CYAN}----------------------------------------------------------------------------------------------------------------------------------${RESET}`);

    const previewLimit = 25;
    const previewList = errors.slice(0, previewLimit);

    previewList.forEach((e) => {
      const lineStr = String(e.line).padEnd(6);
      const opStr = String(e.operator).padEnd(12);
      const dtStr = String(e.dateStr || '-').padEnd(12);
      const eqStr = String(e.equipment || '-').padEnd(14);
      const timeStr = `${e.inTime || '-'}/${e.outTime || '-'}`.padEnd(13);
      const hrsStr = String(e.hours !== undefined ? e.hours : '-').padEnd(6);
      console.log(`${lineStr} | ${opStr} | ${dtStr} | ${eqStr} | ${timeStr} | ${hrsStr} | ${RED}${e.reason}${RESET}`);
    });

    if (errors.length > previewLimit) {
      console.log(`${YELLOW}... and ${errors.length - previewLimit} more skipped records.${RESET}`);
    }
    console.log(`${CYAN}----------------------------------------------------------------------------------------------------------------------------------${RESET}`);

    const csvHeader = 'Line,Operator,Date,In,Out,AdditionalHours,Hours,Equipment,Condition,Unit,Reason\n';
    const csvRows = errors
      .map((e) => {
        const cleanReason = `"${(e.reason || '').replace(/"/g, '""')}"`;
        const cleanOp = `"${(e.operator || '').replace(/"/g, '""')}"`;
        const cleanEq = `"${(e.equipment || '').replace(/"/g, '""')}"`;
        const cleanCond = `"${(e.condition || '').replace(/"/g, '""')}"`;
        const cleanUnt = `"${(e.unit || '').replace(/"/g, '""')}"`;
        return `${e.line},${cleanOp},${e.dateStr || ''},${e.inTime || ''},${e.outTime || ''},${e.additionalHours !== undefined ? e.additionalHours : ''},${e.hours !== undefined ? e.hours : ''},${cleanEq},${cleanCond},${cleanUnt},${cleanReason}`;
      })
      .join('\n');

    fs.writeFileSync(skippedCsvPath, csvHeader + csvRows, 'utf-8');
    console.log(`\n${YELLOW}${BOLD}📁 Skipped Records Exported to File:${RESET}`);
    console.log(`   ${BOLD}${skippedCsvPath}${RESET}`);
    console.log(`${YELLOW}👉 You can open 'skipped_operator_records.csv' in Excel to inspect and correct all skipped rows.${RESET}\n`);
  } else {
    if (fs.existsSync(skippedCsvPath)) {
      fs.unlinkSync(skippedCsvPath);
    }
    console.log(`\n${GREEN}${BOLD}🎉 ALL OPERATOR SHIFTS SUBMITTED SUCCESSFULLY! (0 ERRORS)${RESET}\n`);
  }
  console.log(`${CYAN}${BOLD}=====================================================${RESET}\n`);
}

main()
  .catch((e) => {
    console.error(`\n${RED}Fatal Error during upload:${RESET}`, e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
