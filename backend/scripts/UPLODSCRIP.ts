/**
 * UPLODSCRIP.ts
 * 
 * Maga Labor Bulk Time Entry Script
 * 
 * Supports fast, automated database entry for 200+ employees.
 * Takes 6 primary fields:
 *   In | Out | Activity | Hours | Employee | Date
 * 
 * Capabilities:
 * 1. Reads CSV / TSV (comma or tab delimited).
 * 2. Matches employee against Local Project Table (MF_L_EMPLOYEE).
 * 3. Handles multi-activity rows for the same employee on the same date (Activity Splits).
 * 4. Ensures DailySheet & DailyAssignment exist for the active Supervisor.
 * 5. Computes shift hours, lunch break (1h), and overtime (OT).
 * 6. Sets Time Entry status directly to 'submitted'.
 * 7. Comprehensive Error Handling (Zero-Crash Policy) with row-by-row reporting.
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

interface RawRowInput {
  inTime?: string;
  outTime?: string;
  activityCode: string;
  hours: number;
  additionalHours?: number;
  employeeIdentifier: string;
  dateStr: string;
  rawLineIndex: number;
}

interface ProcessError {
  line: number;
  employee: string;
  dateStr?: string;
  inTime?: string;
  outTime?: string;
  activityCode?: string;
  hours?: number;
  reason: string;
}

// Helper: Normalize time to "HH:mm" (e.g., "7" -> "07:00", "28" -> "04:00", "7:30" -> "07:30", "12.5" -> "12:30", "22.25" -> "22:15")
function normalizeTime(val?: string | null): string | null {
  if (!val) return null;
  const clean = val.trim();
  if (!clean) return null;

  // 1. e.g. "7" -> "07:00", "24" -> "00:00", "28" -> "04:00"
  if (/^\d{1,2}$/.test(clean)) {
    let h = parseInt(clean, 10);
    if (h >= 24) h = h % 24;
    return `${String(h).padStart(2, '0')}:00`;
  }

  // 2. e.g. "7:30" or "07:30" or "28:30"
  if (/^\d{1,2}:\d{1,2}$/.test(clean)) {
    let [h, m] = clean.split(':').map(Number);
    if (h >= 24) h = h % 24;
    if (m >= 0 && m < 60) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }

  // 3. Decimal hours e.g. "12.5" -> "12:30", "22.25" -> "22:15", "6.5" -> "06:30"
  if (/^\d{1,2}\.\d+$/.test(clean)) {
    const num = parseFloat(clean);
    if (!isNaN(num)) {
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
  }

  return clean;
}

// Helper: Parse date string into UTC Date object
function parseDateInput(val: string): Date | null {
  if (!val) return null;
  const clean = val.trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const d = new Date(clean + 'T00:00:00.000Z');
    return isNaN(d.getTime()) ? null : d;
  }

  // D/M/YYYY or DD/MM/YYYY (Standard Sri Lanka / Maga format: Day/Month/Year)
  const slashParts = clean.split('/');
  if (slashParts.length === 3) {
    let [day, month, year] = slashParts.map((p) => parseInt(p, 10));
    if (year < 100) year += 2000;
    // Swap if day was mistakenly put in month position (month > 12)
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

// Helper: Compute lunch break hours
function computeBreakHours(inTime?: string | null, outTime?: string | null): number {
  if (!inTime || !outTime) return 0;
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);
  if (isNaN(inH) || isNaN(outH)) return 0;

  const inMins = inH * 60 + (inM || 0);
  const outMins = outH * 60 + (outM || 0);

  let grossMins = outMins - inMins;
  if (grossMins <= 0) grossMins += 24 * 60;

  const lunchStart = 12 * 60; // 12:00
  const lunchEnd = 13 * 60;   // 13:00
  const dinnerStart = 22 * 60;// 22:00
  const dinnerEnd = 23 * 60;  // 23:00

  const calcOverlap = (wStart: number, wEnd: number): number => {
    if (outMins > inMins) {
      return Math.max(0, Math.min(outMins, wEnd) - Math.max(inMins, wStart));
    } else {
      const s1 = Math.max(0, Math.min(1440, wEnd) - Math.max(inMins, wStart));
      const s2 = Math.max(0, Math.min(outMins, wEnd) - Math.max(0, wStart));
      return s1 + s2;
    }
  };

  let totalBreak = 0;
  if (calcOverlap(lunchStart, lunchEnd) > 0) {
    totalBreak += 1.0;
  }
  if (calcOverlap(dinnerStart, dinnerEnd) > 0) {
    totalBreak += 1.0;
  }

  return Math.min(totalBreak, grossMins / 60);
}

// Helper: Calculate Shift Hours and Overtime
function calculateShiftAndOvertime(
  inTime: string,
  outTime: string,
  standardCap = 8.0
): { shiftHours: number; otHours: number; breakHours: number; grossHours: number } {
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
  if (diff <= 0) diff += 24 * 60;

  const grossHours = Math.round((diff / 60) * 100) / 100;
  const breakHours = computeBreakHours(inTime, outTime);
  const shiftHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);

  let otHours = 0;
  if (shiftHours > standardCap) {
    otHours = Math.round((shiftHours - standardCap) * 100) / 100;
  }

  return { shiftHours, otHours, breakHours, grossHours };
}

// Helper: Parse raw text file (supports tab-delimited, comma-delimited, semicolon)
function parseRawFile(content: string): RawRowInput[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const isTab = firstLine.includes('\t');
  const delimiter = isTab ? '\t' : firstLine.includes(',') ? ',' : ';';

  // Check if first row is header
  const headerTokens = firstLine.split(delimiter).map((t) => t.trim().toLowerCase());
  const hasHeader =
    headerTokens.some((t) => t.includes('emp') || t.includes('in') || t.includes('act') || t.includes('date'));

  let colMap: Record<string, number> = {
    in: -1,
    out: -1,
    activity: -1,
    hours: -1,
    additionalHours: -1,
    employee: -1,
    date: -1,
  };

  let startIndex = 0;
  if (hasHeader) {
    startIndex = 1;
    headerTokens.forEach((tok, idx) => {
      if (tok.includes('add') || tok.includes('additional') || tok.includes('extra')) colMap.additionalHours = idx;
      else if (tok === 'in' || tok.includes('in_time') || tok.includes('intime')) colMap.in = idx;
      else if (tok === 'out' || tok.includes('out_time') || tok.includes('outtime')) colMap.out = idx;
      else if (tok.includes('act')) colMap.activity = idx;
      else if (tok.includes('hour')) colMap.hours = idx;
      else if (tok.includes('emp') || tok.includes('epf')) colMap.employee = idx;
      else if (tok.includes('date')) colMap.date = idx;
    });
  }

  // Fallback defaults if no header detected
  if (colMap.employee === -1) {
    if (firstLine.includes('03-') || headerTokens.length >= 10) {
      // ERP 14-column format:
      // Col 0: Employee, Col 6: In, Col 7: Out, Col 9: Activity, Col 10: Hours, Col 13: Date
      colMap = {
        employee: 0,
        in: 6,
        out: 7,
        activity: 9,
        hours: 10,
        date: 13,
      };
    } else {
      // Standard 6-column format: In (0), Out (1), Activity (2), Hours (3), Employee (4), Date (5)
      colMap = {
        in: 0,
        out: 1,
        activity: 2,
        hours: 3,
        employee: 4,
        date: 5,
      };
    }
  }

  const rows: RawRowInput[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const rawTokens = lines[i].split(delimiter).map((t) => t.trim());
    if (rawTokens.length < 3) continue;

    const emp = colMap.employee >= 0 ? rawTokens[colMap.employee] : '';
    const act = colMap.activity >= 0 ? rawTokens[colMap.activity] : '';
    const hrsStr = colMap.hours >= 0 ? rawTokens[colMap.hours] : '8';
    const inT = colMap.in >= 0 ? rawTokens[colMap.in] : '';
    const outT = colMap.out >= 0 ? rawTokens[colMap.out] : '';
    const dt = colMap.date >= 0 ? rawTokens[colMap.date] : '';
    const addHrsStr = colMap.additionalHours >= 0 ? rawTokens[colMap.additionalHours] : '';

    if (!emp && !act) continue;

    rows.push({
      employeeIdentifier: emp,
      activityCode: act,
      hours: parseFloat(hrsStr) || 8.0,
      additionalHours: addHrsStr && !isNaN(parseFloat(addHrsStr)) ? parseFloat(addHrsStr) : undefined,
      inTime: normalizeTime(inT) || undefined,
      outTime: normalizeTime(outT) || undefined,
      dateStr: dt,
      rawLineIndex: i + 1,
    });
  }

  return rows;
}

async function main() {
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}     MAGA LABOR BULK TIME ENTRY UPLOADER             ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}\n`);

  // 1. Parse CLI Arguments (Supports: [filePath] [projectCode] OR --file=... --project=... --dry-run)
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  if (isDryRun) {
    console.log(`${YELLOW}${BOLD}🧪 RUNNING IN DRY RUN MODE (No database writes will occur)${RESET}\n`);
  }

  // 2. Resolve Input File (Smart detection handling spaces, quotes, and defaults)
  const defaultFilePath = path.join(__dirname, 'labor_data.csv');
  const masterSheetPath = path.join(__dirname, 'Company labour Master Upload Sheet.csv');
  let explicitFilePath: string | null = null;
  let explicitProject: string | null = null;

  // Match any file argument (even if split by spaces by the shell)
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

  // Look for project argument in remaining args
  for (const a of args) {
    if (a.startsWith('--project=')) {
      explicitProject = a.split('=')[1].trim();
    } else if (!a.startsWith('-')) {
      explicitProject = a.trim();
    }
  }

  let targetFilePath = explicitFilePath;
  if (!targetFilePath) {
    // If Company labour Master Upload Sheet exists, prioritize it for upload
    if (fs.existsSync(masterSheetPath)) {
      targetFilePath = masterSheetPath;
    } else {
      targetFilePath = defaultFilePath;
    }
  }

  // 3. Resolve Target Project
  const allProjects = await prisma.mF_P_Project.findMany({
    select: { id: true, projectCode: true, projectName: true, subdomain: true },
  });

  let project: typeof allProjects[0] | null = null;

  if (explicitProject) {
    const cleanReq = explicitProject.toUpperCase().replace(/[^A-Z0-9]/g, '');
    project = allProjects.find((p) => {
      const pCode = p.projectCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const sCode = (p.subdomain || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      const pName = p.projectName.toUpperCase().replace(/[^A-Z0-9]/g, '');
      return (
        p.id.toLowerCase() === explicitProject!.toLowerCase() ||
        pCode === cleanReq ||
        sCode === cleanReq ||
        pCode.includes(cleanReq) ||
        cleanReq.includes(pCode) ||
        sCode.includes(cleanReq) ||
        pName.includes(cleanReq)
      );
    }) || null;
  }

  // Auto-detect project from CSV employees if project not explicitly supplied!
  if (!project && fs.existsSync(targetFilePath)) {
    const previewContent = fs.readFileSync(targetFilePath, 'utf-8');
    const previewRows = parseRawFile(previewContent).slice(0, 15);
    const sampleEmpCodes = previewRows.map((r) => r.employeeIdentifier.trim()).filter(Boolean);

    if (sampleEmpCodes.length > 0) {
      const match = await prisma.mF_P_Employee.findFirst({
        where: {
          corporateEmployee: {
            employeeCode: { in: sampleEmpCodes },
          },
        },
        select: { projectId: true },
      });
      if (match) {
        project = allProjects.find((p) => p.id === match.projectId) || null;
        if (project) {
          console.log(`🔍 ${GREEN}Auto-detected Project from CSV employees:${RESET} ${BOLD}${project.projectName} (${project.projectCode})${RESET}`);
        }
      }
    }
  }

  if (!project) {
    // Default fallback to first active project
    project = allProjects[0] || null;
  }

  if (!project) {
    console.error(`${RED}❌ Error: No active project found in database!${RESET}`);
    process.exit(1);
  }
  console.log(`📌 Target Project: ${BOLD}${project.projectName} (${project.projectCode})${RESET}`);

  // 4. Resolve Supervisor or Admin for DailySheet
  let supervisor = await prisma.mF_P_User.findFirst({
    where: {
      projectId: project.id,
      role: 'supervisor',
      status: 'active',
    },
    select: { id: true, username: true, fullName: true },
  });

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
    console.log(`${YELLOW}⚠️ Input file not found: ${targetFilePath}${RESET}`);
    console.log(`📝 Generating template file with sample rows at: ${defaultFilePath}`);

    // Fetch up to 3 existing sample employees for realistic template
    const sampleEmps = await prisma.mF_P_Employee.findMany({
      where: { projectId: project.id },
      take: 3,
      include: { corporateEmployee: true },
    });

    const sampleCodes = sampleEmps.map((e) => e.corporateEmployee.employeeCode);
    const code1 = sampleCodes[0] || '4004';
    const code2 = sampleCodes[1] || 'R8562';

    const sampleContent = [
      'In,Out,Activity,Hours,Employee,Date',
      `07:00,17:00,03-11-13-50,8,${code1},2026-11-03`,
      `07:00,17:00,03-20-00-00,8,${code1},2026-11-03`,
      `07:30,17:00,03-11-13-50,8.5,${code2},2026-11-03`,
    ].join('\n');

    fs.writeFileSync(defaultFilePath, sampleContent, 'utf-8');
    console.log(`${GREEN}✓ Created sample file: ${defaultFilePath}${RESET}`);
    console.log(`${CYAN}👉 You can edit this file with your 200 rows and re-run!${RESET}\n`);
  }

  console.log(`📂 Reading data from: ${BOLD}${targetFilePath}${RESET}`);
  const rawFileContent = fs.readFileSync(targetFilePath, 'utf-8');
  const parsedRows = parseRawFile(rawFileContent);

  if (parsedRows.length === 0) {
    console.log(`${YELLOW}⚠️ No data rows found in file.${RESET}`);
    return;
  }
  console.log(`📋 Total rows identified: ${BOLD}${parsedRows.length}${RESET}\n`);

  // 4. Pre-load local employees and project activities for rapid lookups
  console.log(`🔄 Pre-loading Project Employees & Activity Codes...`);
  const projectEmployees = await prisma.mF_P_Employee.findMany({
    where: { projectId: project.id },
    include: {
      corporateEmployee: {
        select: { id: true, employeeCode: true, fullName: true, epfNo: true },
      },
      tradeGroup: {
        select: { standardDailyRate: true },
      },
    },
  });

  // Map employee lookups by Code, EPF, Calling Name, and Full Name (lowercase for robust matching)
  const empMap = new Map<string, typeof projectEmployees[0]>();
  for (const pe of projectEmployees) {
    const corp = pe.corporateEmployee;
    if (corp.employeeCode) empMap.set(corp.employeeCode.trim().toLowerCase(), pe);
    if (corp.epfNo) empMap.set(corp.epfNo.trim().toLowerCase(), pe);
    if (pe.callingName) empMap.set(pe.callingName.trim().toLowerCase(), pe);
    if (corp.fullName) empMap.set(corp.fullName.trim().toLowerCase(), pe);
  }

  // Pre-load project activities
  const projectActivities = await prisma.mF_P_ActivityCode.findMany({
    where: { projectId: project.id },
  });
  const actMap = new Map<string, string>();
  for (const pa of projectActivities) {
    actMap.set(pa.code.trim().toLowerCase(), pa.id);
  }

  // Pre-load day types
  const defaultDayType =
    (await prisma.mF_G_DayType.findFirst({ where: { code: 'NORMAL' } })) ||
    (await prisma.mF_G_DayType.findFirst());
  const effectiveDayTypeId = defaultDayType?.id || '';

  // 5. Group Rows by (Employee, Date) to handle Multi-Activity Rows
  console.log(`🔗 Grouping entries by Employee and Date...`);
  const groupedEntries = new Map<
    string,
    {
      employeeIdentifier: string;
      dateStr: string;
      date: Date;
      inTime?: string;
      outTime?: string;
      additionalHours?: number;
      activities: Array<{ activityCode: string; hours: number; rawLineIndex: number }>;
    }
  >();

  const errors: ProcessError[] = [];
  let lastEmployee = '';
  let lastDateStr = '';

  for (const r of parsedRows) {
    // If employee or date is omitted on subsequent row, inherit from previous row (multi-activity row)
    const empKey = r.employeeIdentifier || lastEmployee;
    const dtStr = r.dateStr || lastDateStr;

    if (!empKey) {
      errors.push({
        line: r.rawLineIndex,
        employee: 'UNKNOWN',
        dateStr: r.dateStr,
        inTime: r.inTime,
        outTime: r.outTime,
        activityCode: r.activityCode,
        hours: r.hours,
        reason: 'Missing Employee Code/Name',
      });
      continue;
    }

    if (!dtStr) {
      errors.push({
        line: r.rawLineIndex,
        employee: empKey,
        dateStr: dtStr,
        inTime: r.inTime,
        outTime: r.outTime,
        activityCode: r.activityCode,
        hours: r.hours,
        reason: 'Missing Date',
      });
      continue;
    }

    const parsedDate = parseDateInput(dtStr);
    if (!parsedDate) {
      errors.push({
        line: r.rawLineIndex,
        employee: empKey,
        dateStr: dtStr,
        inTime: r.inTime,
        outTime: r.outTime,
        activityCode: r.activityCode,
        hours: r.hours,
        reason: `Invalid Date format: '${dtStr}'`,
      });
      continue;
    }

    lastEmployee = empKey;
    lastDateStr = dtStr;

    const groupKey = `${empKey.toLowerCase()}__${parsedDate.toISOString().slice(0, 10)}`;
    if (!groupedEntries.has(groupKey)) {
      groupedEntries.set(groupKey, {
        employeeIdentifier: empKey,
        dateStr: dtStr,
        date: parsedDate,
        inTime: r.inTime,
        outTime: r.outTime,
        additionalHours: r.additionalHours,
        activities: [],
      });
    }

    const group = groupedEntries.get(groupKey)!;
    // Retain in/out if available
    if (!group.inTime && r.inTime) group.inTime = r.inTime;
    if (!group.outTime && r.outTime) group.outTime = r.outTime;
    if (r.additionalHours !== undefined) {
      group.additionalHours = Math.max(group.additionalHours || 0, r.additionalHours);
    }

    group.activities.push({
      activityCode: r.activityCode,
      hours: r.hours,
      rawLineIndex: r.rawLineIndex,
    });
  }

  // 5.5 Pre-Upload Hours Balance & Additional Hours Detection Scan
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}  📊 PRE-UPLOAD HOURS BALANCE & ADDITIONAL HOURS SCAN ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);

  let balancedCount = 0;
  let addHoursCount = 0;
  let deficitCount = 0;
  const balanceWarnings: Array<{
    emp: string;
    date: string;
    in: string;
    out: string;
    csvHrs: number;
    baseShift: number;
    diff: number;
    type: 'ADDITIONAL' | 'DEFICIT';
  }> = [];

  for (const [groupKey, group] of groupedEntries.entries()) {
    const finalIn = group.inTime || '07:00';
    const finalOut = group.outTime || '17:00';
    const calc = calculateShiftAndOvertime(finalIn, finalOut, 8.0);
    const csvSum = Math.round(group.activities.reduce((s, a) => s + a.hours, 0) * 100) / 100;
    const diff = Math.round((csvSum - calc.shiftHours) * 100) / 100;

    if (Math.abs(diff) < 0.05) {
      balancedCount++;
    } else if (diff > 0.05) {
      addHoursCount++;
      balanceWarnings.push({
        emp: group.employeeIdentifier,
        date: group.dateStr,
        in: finalIn,
        out: finalOut,
        csvHrs: csvSum,
        baseShift: calc.shiftHours,
        diff,
        type: 'ADDITIONAL',
      });
    } else {
      deficitCount++;
      balanceWarnings.push({
        emp: group.employeeIdentifier,
        date: group.dateStr,
        in: finalIn,
        out: finalOut,
        csvHrs: csvSum,
        baseShift: calc.shiftHours,
        diff,
        type: 'DEFICIT',
      });
    }
  }

  console.log(`  • Total Shifts to Process: ${BOLD}${groupedEntries.size}${RESET}`);
  console.log(`  • ${GREEN}✓ Perfectly Balanced Shifts:${RESET} ${BOLD}${balancedCount}${RESET}`);
  console.log(`  • ${YELLOW}⭐ Shifts with Implied Additional Hours:${RESET} ${BOLD}${addHoursCount}${RESET}`);
  console.log(`  • ${CYAN}⚠️  Shifts with Deficit / Potential Idle:${RESET} ${BOLD}${deficitCount}${RESET}\n`);

  if (addHoursCount > 0) {
    console.log(`${YELLOW}${BOLD}  [Sample Shifts with Additional Hours detected]:${RESET}`);
    const sampleAdd = balanceWarnings.filter((w) => w.type === 'ADDITIONAL').slice(0, 5);
    for (const w of sampleAdd) {
      console.log(
        `    ${YELLOW}➔${RESET} [${w.emp}] ${w.date} (${w.in} - ${w.out}) | Base: ${w.baseShift}h -> CSV Total: ${w.csvHrs}h [ ${YELLOW}+${w.diff}h Additional Hours${RESET} ]`
      );
    }
    console.log('');
  }

  if (deficitCount > 0) {
    console.log(`${CYAN}${BOLD}  [Sample Shifts with Hours Deficit (Remainder Idle)]:${RESET}`);
    const sampleDef = balanceWarnings.filter((w) => w.type === 'DEFICIT').slice(0, 5);
    for (const w of sampleDef) {
      console.log(
        `    ${CYAN}➔${RESET} [${w.emp}] ${w.date} (${w.in} - ${w.out}) | Base: ${w.baseShift}h -> CSV Total: ${w.csvHrs}h [ ${CYAN}${w.diff}h Deficit${RESET} ]`
      );
    }
    console.log('');
  }

  // 6. Execute Bulk Processing with Row-by-Row Isolation
  console.log(`\n🚀 Processing ${groupedEntries.size} worker shifts...\n`);
  let successCount = 0;
  const startTime = Date.now();

  // Cache for daily sheets
  const dailySheetCache = new Map<string, any>();

  for (const [groupKey, group] of groupedEntries.entries()) {
    try {
      // Step A: Find Employee in Local Table
      const localEmp = empMap.get(group.employeeIdentifier.trim().toLowerCase());
      if (!localEmp) {
        for (const act of group.activities) {
          errors.push({
            line: act.rawLineIndex,
            employee: group.employeeIdentifier,
            dateStr: group.dateStr,
            inTime: group.inTime || '07:00',
            outTime: group.outTime || '17:00',
            activityCode: act.activityCode,
            hours: act.hours,
            reason: `Employee '${group.employeeIdentifier}' not found in local site table (MF_L_EMPLOYEE).`,
          });
        }
        continue;
      }

      // Step B: Calculate In/Out and Shift Hours
      const finalInTime = group.inTime || '07:00';
      const finalOutTime = group.outTime || '17:00';

      const calc = calculateShiftAndOvertime(finalInTime, finalOutTime, 8.0);
      const totalGrossHours = calc.grossHours; // Total hours (In-Out Gross presence duration)
      const totalCsvHours = Math.round(group.activities.reduce((s, a) => s + a.hours, 0) * 100) / 100;
      const baseShift = calc.shiftHours; // gross - breaks
      let additionalHours = group.additionalHours !== undefined && group.additionalHours > 0 ? group.additionalHours : 0;
      let finalShiftHours = baseShift;

      // Detect and assign Additional Hours (explicit from CSV column or implied by CSV activity sum)
      if (additionalHours > 0) {
        finalShiftHours = Math.round((baseShift + additionalHours) * 100) / 100;
      } else if (totalCsvHours > baseShift) {
        additionalHours = Math.round((totalCsvHours - baseShift) * 100) / 100;
        finalShiftHours = Math.round((baseShift + additionalHours) * 100) / 100;
      }

      // Auto-balance Idle / Hours Deficit: If activities are less than shift hours, allocate the remaining shortage to ZIDLE
      const deficitHours = Math.round((baseShift - totalCsvHours) * 100) / 100;
      const hasZidle = group.activities.some((a) => a.activityCode.trim().toUpperCase() === 'ZIDLE');
      if (deficitHours > 0.05 && !hasZidle) {
        group.activities.push({
          activityCode: 'ZIDLE',
          hours: deficitHours,
          rawLineIndex: group.activities[0]?.rawLineIndex || 0,
        });
      }
      const finalCsvHours = Math.round(group.activities.reduce((s, a) => s + a.hours, 0) * 100) / 100;

      if (isDryRun) {
        // Validate activities in dry-run mode
        for (const actItem of group.activities) {
          let actId = actMap.get(actItem.activityCode.trim().toLowerCase());
          if (!actId) {
            const corpAct = await prisma.mF_G_ActivityCode.findFirst({
              where: { code: actItem.activityCode.trim() },
            });
            if (corpAct) {
              actId = corpAct.id;
            } else {
              actId = projectActivities[0]?.id;
              if (!actId) {
                errors.push({
                  line: actItem.rawLineIndex,
                  employee: group.employeeIdentifier,
                  dateStr: group.dateStr,
                  inTime: finalInTime,
                  outTime: finalOutTime,
                  activityCode: actItem.activityCode,
                  hours: actItem.hours,
                  reason: `Activity code '${actItem.activityCode}' could not be resolved in project or corporate master.`,
                });
                continue;
              }
            }
          }
          successCount++;
        }
        continue;
      }

      // Step C: Get or Create DailySheet for Supervisor & Date
      const dateKey = group.date.toISOString().slice(0, 10);
      let dailySheet = dailySheetCache.get(dateKey);
      if (!dailySheet) {
        dailySheet = await prisma.mF_OP_DailySheet.upsert({
          where: {
            projectId_supervisorId_date: {
              projectId: project.id,
              supervisorId: supervisor.id,
              date: group.date,
            },
          },
          update: {},
          create: {
            projectId: project.id,
            supervisorId: supervisor.id,
            date: group.date,
            status: 'submitted',
          },
        });
        dailySheetCache.set(dateKey, dailySheet);
      }

      // Step D: Ensure DailyAssignment exists
      await prisma.mF_OP_DailyAssignment.upsert({
        where: {
          dailySheetId_employeeId: {
            dailySheetId: dailySheet.id,
            employeeId: localEmp.id,
          },
        },
        update: {},
        create: {
          dailySheetId: dailySheet.id,
          employeeId: localEmp.id,
        },
      });

      const finalOt = Math.max(0, Math.round((finalShiftHours - 8.0) * 100) / 100);

      // Step E: Save Time Entry & Activity Splits
      // Resolve all activity codes for this shift
      const resolvedActivities: Array<{ actId: string; code: string; hours: number; rawLineIndex: number }> = [];
      for (const actItem of group.activities) {
        let actId = actMap.get(actItem.activityCode.trim().toLowerCase());
        if (!actId) {
          const corpAct = await prisma.mF_G_ActivityCode.findFirst({
            where: { code: actItem.activityCode.trim() },
          });

          if (corpAct) {
            const newAct = await prisma.mF_P_ActivityCode.create({
              data: {
                projectId: project.id,
                code: corpAct.code,
                description: corpAct.description,
                unit: corpAct.unit,
                corporateActivityCodeId: corpAct.id,
              },
            });
            actId = newAct.id;
            actMap.set(actItem.activityCode.trim().toLowerCase(), actId);
          } else {
            actId = projectActivities[0]?.id;
            if (!actId) {
              errors.push({
                line: actItem.rawLineIndex,
                employee: group.employeeIdentifier,
                dateStr: group.dateStr,
                inTime: finalInTime,
                outTime: finalOutTime,
                activityCode: actItem.activityCode,
                hours: actItem.hours,
                reason: `Activity code '${actItem.activityCode}' could not be resolved in project or corporate master.`,
              });
              continue;
            }
          }
        }
        resolvedActivities.push({
          actId,
          code: actItem.activityCode,
          hours: actItem.hours,
          rawLineIndex: actItem.rawLineIndex,
        });
      }

      if (resolvedActivities.length === 0) continue;

      // Check existing entries for this employee shift
      const existingEntries = await prisma.mF_OP_TimeEntry.findMany({
        where: {
          projectId: project.id,
          employeeId: localEmp.id,
          date: group.date,
        },
        orderBy: { createdAt: 'asc' },
      });

      const approvedEntry = existingEntries.find((e) => e.status === 'approved');
      if (approvedEntry) {
        errors.push({
          line: group.activities[0].rawLineIndex,
          employee: group.employeeIdentifier,
          dateStr: group.dateStr,
          inTime: finalInTime,
          outTime: finalOutTime,
          activityCode: group.activities.map((a) => a.activityCode).join(', '),
          hours: finalCsvHours,
          reason: `Time Entry is already APPROVED by Admin/PM. Did not overwrite.`,
        });
        continue;
      }

      // Snapshot rate & business partner
      const snapRate = Number(localEmp.dailyRate) > 0
        ? Number(localEmp.dailyRate)
        : Number(localEmp.tradeGroup?.standardDailyRate || 1400.0);
      const snapBpId = localEmp.businessPartnerId || null;

      const primaryEntry = existingEntries[0];
      const redundantEntries = existingEntries.slice(1);
      let targetTimeEntryId: string;

      if (primaryEntry) {
        targetTimeEntryId = primaryEntry.id;
        await prisma.mF_OP_TimeEntry.update({
          where: { id: primaryEntry.id },
          data: {
            dailySheetId: dailySheet.id,
            recordedById: supervisor.id,
            inTime: finalInTime,
            outTime: finalOutTime,
            hours: totalGrossHours,
            shiftHours: finalShiftHours,
            additionalHours: additionalHours,
            overtimeHours: finalOt,
            breakHours: calc.breakHours,
            isLunchDeducted: calc.breakHours >= 1.0,
            isDinnerDeducted: calc.breakHours >= 2.0,
            activityId: resolvedActivities[0].actId,
            ...(primaryEntry.appliedDailyRate === null ? {
              appliedDailyRate: snapRate,
              appliedBusinessPartnerId: snapBpId,
            } : {}),
            status: 'submitted',
            submittedAt: new Date(),
          },
        });
      } else {
        const created = await prisma.mF_OP_TimeEntry.create({
          data: {
            projectId: project.id,
            dailySheetId: dailySheet.id,
            employeeId: localEmp.id,
            recordedById: supervisor.id,
            date: group.date,
            activityId: resolvedActivities[0].actId,
            effectiveDayTypeId,
            inTime: finalInTime,
            outTime: finalOutTime,
            hours: totalGrossHours,
            shiftHours: finalShiftHours,
            additionalHours: additionalHours,
            overtimeHours: finalOt,
            breakHours: calc.breakHours,
            isLunchDeducted: calc.breakHours >= 1.0,
            isDinnerDeducted: calc.breakHours >= 2.0,
            appliedDailyRate: snapRate,
            appliedBusinessPartnerId: snapBpId,
            status: 'submitted',
            submittedAt: new Date(),
          },
        });
        targetTimeEntryId = created.id;
      }

      // Remove any historical duplicate parent rows
      if (redundantEntries.length > 0) {
        const redIds = redundantEntries.map((r) => r.id);
        await prisma.mF_OP_LaborActivitySplit.deleteMany({
          where: { timeEntryId: { in: redIds } },
        });
        await prisma.mF_OP_TimeEntry.deleteMany({
          where: { id: { in: redIds } },
        });
      }

      // Sync MF_OP_LaborActivitySplit records for this shift
      await prisma.mF_OP_LaborActivitySplit.deleteMany({
        where: { timeEntryId: targetTimeEntryId },
      });

      // Consolidate splits by activityCodeId to safely prevent any duplicate key violations
      const consolidatedSplits = new Map<string, { actId: string; code: string; hours: number; rawLineIndex: number }>();
      for (const act of resolvedActivities) {
        const existing = consolidatedSplits.get(act.actId);
        if (existing) {
          existing.hours = Math.round((existing.hours + act.hours) * 100) / 100;
        } else {
          consolidatedSplits.set(act.actId, { ...act });
        }
      }

      for (const act of consolidatedSplits.values()) {
        await prisma.mF_OP_LaborActivitySplit.create({
          data: {
            timeEntryId: targetTimeEntryId,
            activityCodeId: act.actId,
            hours: act.hours,
          },
        });
        successCount++;
      }

      const addTag = additionalHours > 0 ? ` [${YELLOW}+${additionalHours}h Add${RESET}]` : '';
      const actSummary = resolvedActivities.map((a) => `${a.code} (${a.hours}h)`).join(', ');
      console.log(
        `  ${GREEN}✓${RESET} [${localEmp.corporateEmployee.employeeCode}] ${localEmp.callingName || localEmp.corporateEmployee.fullName} -> Splits: ${actSummary} | In: ${finalInTime} Out: ${finalOutTime}${addTag} [${GREEN}SUBMITTED${RESET}]`
      );
    } catch (err: any) {
      errors.push({
        line: group.activities[0]?.rawLineIndex || 0,
        employee: group.employeeIdentifier,
        reason: `DB Error: ${err.message || String(err)}`,
      });
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // 7. Final Summary Dashboard
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}                IMPORT SUMMARY REPORT                ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`🔹 Total Rows In File     : ${BOLD}${parsedRows.length}${RESET}`);
  console.log(`✅ Successfully Submitted  : ${GREEN}${BOLD}${successCount}${RESET}`);
  console.log(`⚠️ Skipped / Errors        : ${errors.length > 0 ? RED : GREEN}${BOLD}${errors.length}${RESET}`);
  console.log(`⏱️ Duration                : ${duration} seconds`);
  console.log(`${CYAN}=====================================================${RESET}`);

  if (errors.length > 0) {
    console.log(`\n${RED}${BOLD}❌ SKIPPED / REJECTED RECORDS TABLE:${RESET}`);
    console.log(`${CYAN}-------------------------------------------------------------------------------------------------------------${RESET}`);
    console.log(
      `${BOLD}${'Line'.padEnd(6)} | ${'Employee'.padEnd(12)} | ${'Date'.padEnd(12)} | ${'Activity'.padEnd(16)} | ${'In/Out'.padEnd(13)} | ${'Hours'.padEnd(6)} | Reason${RESET}`
    );
    console.log(`${CYAN}-------------------------------------------------------------------------------------------------------------${RESET}`);

    const previewLimit = 20;
    const previewList = errors.slice(0, previewLimit);

    previewList.forEach((e) => {
      const lineStr = String(e.line).padEnd(6);
      const empStr = String(e.employee).padEnd(12);
      const dtStr = String(e.dateStr || '-').padEnd(12);
      const actStr = String(e.activityCode || '-').padEnd(16);
      const timeStr = `${e.inTime || '-'}/${e.outTime || '-'}`.padEnd(13);
      const hrsStr = String(e.hours !== undefined ? e.hours : '-').padEnd(6);
      console.log(`${lineStr} | ${empStr} | ${dtStr} | ${actStr} | ${timeStr} | ${hrsStr} | ${RED}${e.reason}${RESET}`);
    });

    if (errors.length > previewLimit) {
      console.log(`${YELLOW}... and ${errors.length - previewLimit} more skipped records.${RESET}`);
    }
    console.log(`${CYAN}-------------------------------------------------------------------------------------------------------------${RESET}`);

    // Auto-export all skipped records to skipped_records.csv
    const skippedCsvPath = path.join(__dirname, 'skipped_records.csv');
    const csvHeader = 'Line,Employee,Date,In,Out,Activity,Hours,Reason';
    const csvRows = errors.map((e) => {
      const cleanReason = `"${(e.reason || '').replace(/"/g, '""')}"`;
      return `${e.line},${e.employee},${e.dateStr || ''},${e.inTime || ''},${e.outTime || ''},${e.activityCode || ''},${e.hours || ''},${cleanReason}`;
    });
    fs.writeFileSync(skippedCsvPath, [csvHeader, ...csvRows].join('\n'), 'utf-8');

    console.log(`\n${YELLOW}${BOLD}📁 Skipped Records Exported to File:${RESET} ${BOLD}${skippedCsvPath}${RESET}`);
    console.log(`${YELLOW}👉 You can open 'skipped_records.csv' in Excel to inspect and correct all skipped rows.${RESET}\n`);
  } else {
    console.log(`\n${GREEN}${BOLD}🎉 ALL RECORDS SUBMITTED SUCCESSFULLY DIRECTLY TO DATABASE!${RESET}\n`);
  }
}

main()
  .catch((e) => {
    console.error(`\n${RED}Fatal Script Error:${RESET}`, e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

