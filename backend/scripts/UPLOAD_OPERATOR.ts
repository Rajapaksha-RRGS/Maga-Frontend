/**
 * UPLOAD_OPERATOR.ts
 * 
 * Maga Operator Bulk Time & Machine Assignment Upload Script
 * 
 * Takes 6 primary fields:
 *   Operator | In | Out | Equipment | Hours | Date
 * 
 * Capabilities:
 * 1. Reads CSV / TSV (comma, tab, or semicolon delimited).
 * 2. Matches operator against Project / Corporate Employees (by Employee Code, EPF, or Name).
 * 3. Matches equipment against Project / Corporate Equipment (by Standard Equipment Number or Vehicle No).
 * 4. Ensures the employee is flagged as `isOperator: true` in the project.
 * 5. Links Operator to Equipment in Daily Equipment Assignment (MF_L_DAILY_EQUIPMENT_ASSIGNMENT).
 * 6. Computes shift hours, lunch break (1h), and overtime (OT).
 * 7. Records Operator shift Time Entry (MF_L_TIME_ENTRY) with equipmentId and status = 'submitted'.
 * 8. Comprehensive Error Handling (Zero-Crash Policy) with row-by-row reporting & skipped_operator_records.csv.
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
  equipmentIdentifier?: string;
  hours: number;
  dateStr: string;
  rawLineIndex: number;
}

interface ProcessError {
  line: number;
  operator: string;
  equipment?: string;
  dateStr?: string;
  inTime?: string;
  outTime?: string;
  hours?: number;
  reason: string;
}

// Helper: Normalize time to "HH:mm" (e.g., "7" -> "07:00", "21" -> "21:00", "7:30" -> "07:30")
function normalizeTime(val?: string | null): string | null {
  if (!val) return null;
  const clean = val.trim();
  if (!clean) return null;

  if (/^\d{1,2}$/.test(clean)) {
    let h = parseInt(clean, 10);
    if (h >= 24) h = h % 24;
    return `${String(h).padStart(2, '0')}:00`;
  }

  if (/^\d{1,2}:\d{2}$/.test(clean)) {
    let [h, m] = clean.split(':').map(Number);
    if (h >= 24) h = h % 24;
    if (m >= 0 && m < 60) {
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

  // D/M/YYYY or DD/MM/YYYY
  const slashParts = clean.split('/');
  if (slashParts.length === 3) {
    let [day, month, year] = slashParts.map((p) => parseInt(p, 10));
    if (year < 100) year += 2000;
    if (month > 12 && day <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    return isNaN(d.getTime()) ? null : d;
  }

  // D-M-YYYY or DD-M-YYYY
  const dashParts = clean.split('-');
  if (dashParts.length === 3 && dashParts[0].length <= 2) {
    let [day, month, year] = dashParts.map((p) => parseInt(p, 10));
    if (year < 100) year += 2000;
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

  let diff = outMins - inMins;
  if (diff < 0) diff += 24 * 60;
  if (diff <= 0) return 0;

  let breakHours = 1.0;
  const isPast11PM = outMins >= inMins ? outMins >= 23 * 60 : inMins <= 23 * 60 || outMins >= 23 * 60;
  if (isPast11PM) breakHours = 2.0;

  const grossHours = diff / 60;
  return Math.min(breakHours, grossHours);
}

// Helper: Calculate Shift Hours and Overtime
function calculateShiftAndOvertime(
  inTime: string,
  outTime: string,
  standardCap = 8.0
): { shiftHours: number; otHours: number; breakHours: number } {
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
  if (diff < 0) diff += 24 * 60;

  const grossHours = Math.round((diff / 60) * 100) / 100;
  const breakHours = computeBreakHours(inTime, outTime);
  const shiftHours = Math.max(0, Math.round((grossHours - breakHours) * 100) / 100);

  let otHours = 0;
  if (shiftHours > standardCap) {
    otHours = Math.round((shiftHours - standardCap) * 100) / 100;
  }

  return { shiftHours, otHours, breakHours };
}

// Helper: Parse CSV / TSV file
function parseRawFile(content: string): RawOperatorRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

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
    equipment: -1,
    hours: -1,
    date: -1,
  };

  if (hasHeader) {
    headerTokens.forEach((tok, idx) => {
      if (tok.includes('operat') || tok.includes('emp') || tok.includes('epf') || tok.includes('driver')) {
        colMap.operator = idx;
      } else if (tok === 'in' || tok.includes('in_time') || tok.includes('intime')) {
        colMap.in = idx;
      } else if (tok === 'out' || tok.includes('out_time') || tok.includes('outtime')) {
        colMap.out = idx;
      } else if (tok.includes('equip') || tok.includes('machine') || tok.includes('vehicle')) {
        colMap.equipment = idx;
      } else if (tok.includes('hour')) {
        colMap.hours = idx;
      } else if (tok.includes('date')) {
        colMap.date = idx;
      }
    });
  }

  // Fallback defaults if header tokens not found
  if (colMap.operator === -1) {
    // Default 6-column format: Operator (0), In (1), Out (2), Equipment (3), Hours (4), Date (5)
    colMap = {
      operator: 0,
      in: 1,
      out: 2,
      equipment: 3,
      hours: 4,
      date: 5,
    };
  }

  const startIndex = hasHeader ? 1 : 0;
  const rows: RawOperatorRow[] = [];

  for (let i = startIndex; i < lines.length; i++) {
    const rawTokens = lines[i].split(delimiter).map((t) => t.trim().replace(/^[\"']+|[\"']+$/g, ''));
    if (rawTokens.length < 3) continue;

    const op = colMap.operator >= 0 ? rawTokens[colMap.operator] : '';
    const inT = colMap.in >= 0 ? rawTokens[colMap.in] : '';
    const outT = colMap.out >= 0 ? rawTokens[colMap.out] : '';
    const eq = colMap.equipment >= 0 ? rawTokens[colMap.equipment] : '';
    const hrsStr = colMap.hours >= 0 ? rawTokens[colMap.hours] : '8';
    const dt = colMap.date >= 0 ? rawTokens[colMap.date] : '';

    if (!op && !eq) continue;

    rows.push({
      operatorIdentifier: op,
      inTime: normalizeTime(inT) || undefined,
      outTime: normalizeTime(outT) || undefined,
      equipmentIdentifier: eq || undefined,
      hours: parseFloat(hrsStr) || 8.0,
      dateStr: dt,
      rawLineIndex: i + 1,
    });
  }

  return rows;
}

async function main() {
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}    MAGA OPERATOR & MACHINE TIME ENTRY UPLOADER      ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}\n`);

  // 1. Parse CLI Arguments (Supports: [filePath] [projectCode] OR --file=... --project=... --dry-run)
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  if (isDryRun) {
    console.log(`${YELLOW}${BOLD}🧪 RUNNING IN DRY RUN MODE (No database writes will occur)${RESET}\n`);
  }

  // 2. Resolve Input File
  const defaultFilePath = path.join(__dirname, 'Company operator Master Upload Sheet.csv');
  let explicitFilePath: string | null = null;
  let explicitProject: string | null = null;
  let explicitSupervisor: string | null = null;

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

  // Auto-detect project from CSV operators if project not explicitly supplied!
  if (!project && fs.existsSync(targetFilePath)) {
    const previewContent = fs.readFileSync(targetFilePath, 'utf-8');
    const previewRows = parseRawFile(previewContent).slice(0, 15);
    const sampleOpCodes = previewRows.map((r) => r.operatorIdentifier.trim()).filter(Boolean);

    if (sampleOpCodes.length > 0) {
      const match = await prisma.mF_P_Employee.findFirst({
        where: {
          corporateEmployee: {
            employeeCode: { in: sampleOpCodes },
          },
        },
        select: { projectId: true },
      });
      if (match) {
        project = allProjects.find((p) => p.id === match.projectId) || null;
        if (project) {
          console.log(`🔍 ${GREEN}Auto-detected Project from CSV operators:${RESET} ${BOLD}${project.projectName} (${project.projectCode})${RESET}`);
        }
      }
    }
  }

  if (!project) {
    project = allProjects[0] || null;
  }

  if (!project) {
    console.error(`${RED}❌ Error: No active project found in database!${RESET}`);
    process.exit(1);
  }
  console.log(`📌 Target Project: ${BOLD}${project.projectName} (${project.projectCode})${RESET}`);

  // 4. Resolve Supervisor or Admin for DailySheet
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
    if (!supervisor) {
      console.log(`${YELLOW}⚠️ Specified supervisor "${explicitSupervisor}" not found in project ${project.projectCode}. Falling back to default active supervisor.${RESET}`);
    }
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
  const parsedRows = parseRawFile(rawFileContent);

  if (parsedRows.length === 0) {
    console.log(`${YELLOW}⚠️ No data rows found in file.${RESET}`);
    return;
  }
  console.log(`📋 Total rows identified: ${BOLD}${parsedRows.length}${RESET}\n`);

  // 5. Pre-load local employees, equipment, and default activity
  console.log(`🔄 Pre-loading Project Operators & Equipment...`);
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

  // Pre-load corporate employees in case employee exists globally but needs project assignment
  const corporateEmployees = await prisma.mF_G_Employee.findMany();
  const corpEmpMap = new Map<string, typeof corporateEmployees[0]>();
  for (const ce of corporateEmployees) {
    if (ce.employeeCode) corpEmpMap.set(ce.employeeCode.trim().toLowerCase(), ce);
    if (ce.epfNo) corpEmpMap.set(ce.epfNo.trim().toLowerCase(), ce);
  }

  // Pre-load project equipment
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
    }
    if (corp?.vehicleNo) {
      eqMap.set(corp.vehicleNo.trim().toLowerCase(), pe);
    }
    eqMap.set(pe.id.toLowerCase(), pe);
  }

  // Pre-load corporate equipment in case equipment exists globally but needs project assignment
  const corporateEquipments = await prisma.mF_G_Equipment.findMany();
  const corpEqMap = new Map<string, typeof corporateEquipments[0]>();
  for (const ce of corporateEquipments) {
    if (ce.standardEquipmentNumber) {
      corpEqMap.set(ce.standardEquipmentNumber.trim().toLowerCase(), ce);
    }
    if (ce.vehicleNo) {
      corpEqMap.set(ce.vehicleNo.trim().toLowerCase(), ce);
    }
  }

  // Resolve default activity code for operator time entry
  let defaultActivity = await prisma.mF_P_ActivityCode.findFirst({
    where: { projectId: project.id },
    orderBy: { code: 'asc' },
  });

  if (!defaultActivity) {
    defaultActivity = await prisma.mF_P_ActivityCode.create({
      data: {
        projectId: project.id,
        code: 'GEN-OPERATOR',
        description: 'General Machine Operation',
      },
    });
  }
  const defaultActivityId = defaultActivity.id;

  // Pre-load day types
  const defaultDayType =
    (await prisma.mF_G_DayType.findFirst({ where: { code: 'NORMAL' } })) ||
    (await prisma.mF_G_DayType.findFirst());
  const effectiveDayTypeId = defaultDayType?.id || '';

  // 6. Group Rows by (Operator, Date)
  console.log(`🔗 Grouping entries by Operator and Date...`);
  const groupedEntries = new Map<
    string,
    {
      operatorIdentifier: string;
      dateStr: string;
      date: Date;
      inTime?: string;
      outTime?: string;
      equipmentIdentifier?: string;
      hours: number;
      rawLineIndex: number;
    }
  >();

  const errors: ProcessError[] = [];
  let lastOperator = '';
  let lastDateStr = '';

  for (const r of parsedRows) {
    const opKey = r.operatorIdentifier || lastOperator;
    const dtStr = r.dateStr || lastDateStr;

    if (!opKey) {
      errors.push({
        line: r.rawLineIndex,
        operator: 'UNKNOWN',
        equipment: r.equipmentIdentifier,
        dateStr: r.dateStr,
        inTime: r.inTime,
        outTime: r.outTime,
        hours: r.hours,
        reason: 'Missing Operator Code/Name',
      });
      continue;
    }

    if (!dtStr) {
      errors.push({
        line: r.rawLineIndex,
        operator: opKey,
        equipment: r.equipmentIdentifier,
        dateStr: '',
        inTime: r.inTime,
        outTime: r.outTime,
        hours: r.hours,
        reason: 'Missing Date',
      });
      continue;
    }

    const parsedDate = parseDateInput(dtStr);
    if (!parsedDate) {
      errors.push({
        line: r.rawLineIndex,
        operator: opKey,
        equipment: r.equipmentIdentifier,
        dateStr: dtStr,
        inTime: r.inTime,
        outTime: r.outTime,
        hours: r.hours,
        reason: `Invalid Date format: "${dtStr}"`,
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
        equipmentIdentifier: r.equipmentIdentifier?.trim(),
        hours: r.hours,
        rawLineIndex: r.rawLineIndex,
      });
    } else {
      const existing = groupedEntries.get(groupKey)!;
      if (!existing.inTime && r.inTime) existing.inTime = r.inTime;
      if (!existing.outTime && r.outTime) existing.outTime = r.outTime;
      if (!existing.equipmentIdentifier && r.equipmentIdentifier) {
        existing.equipmentIdentifier = r.equipmentIdentifier.trim();
      }
      existing.hours = Math.max(existing.hours, r.hours);
    }
  }

  console.log(`📦 Unique (Operator, Date) sets to process: ${BOLD}${groupedEntries.size}${RESET}\n`);

  // 7. Process Groups and Insert into Database
  let successCount = 0;
  let skippedCount = 0;
  const processedDailySheets = new Map<string, string>(); // dateKey -> dailySheetId

  for (const [groupKey, group] of groupedEntries) {
    const cleanOpKey = group.operatorIdentifier.toLowerCase();
    let localEmp = empMap.get(cleanOpKey);

    // If not found in project employees, check corporate employees and auto-link
    if (!localEmp) {
      const corpEmp = corpEmpMap.get(cleanOpKey);
      if (corpEmp) {
        if (!isDryRun) {
          const created = await prisma.mF_P_Employee.create({
            data: {
              projectId: project.id,
              corporateEmployeeId: corpEmp.id,
              callingName: corpEmp.callingName || corpEmp.fullName.split(' ')[0],
              dailyRate: corpEmp.dailyRate || 1400.0,
              isOperator: true,
              status: 'active',
            },
            include: {
              corporateEmployee: true,
              tradeGroup: true,
            },
          });
          localEmp = created;
          empMap.set(cleanOpKey, created);
          if (corpEmp.employeeCode) empMap.set(corpEmp.employeeCode.toLowerCase(), created);
          if (corpEmp.epfNo) empMap.set(corpEmp.epfNo.toLowerCase(), created);
        } else {
          localEmp = {
            id: 'dry-run-op-id',
            projectId: project.id,
            corporateEmployeeId: corpEmp.id,
            callingName: corpEmp.callingName || '',
            dailyRate: corpEmp.dailyRate || 1400.0,
            isOperator: true,
            status: 'active',
            tradeGroupId: null,
            businessPartnerId: null,
            createdAt: new Date(),
            corporateEmployee: corpEmp,
            tradeGroup: null,
          } as any;
        }
      }
    }

    if (!localEmp) {
      errors.push({
        line: group.rawLineIndex,
        operator: group.operatorIdentifier,
        equipment: group.equipmentIdentifier,
        dateStr: group.dateStr,
        inTime: group.inTime,
        outTime: group.outTime,
        hours: group.hours,
        reason: `Operator '${group.operatorIdentifier}' not found in project or corporate master`,
      });
      skippedCount++;
      continue;
    }

    // Resolve Equipment if provided
    let localEq: typeof projectEquipmentList[0] | null = null;
    if (group.equipmentIdentifier) {
      const cleanEqKey = group.equipmentIdentifier.toLowerCase();
      localEq = eqMap.get(cleanEqKey) || null;

      // If not in project equipment, check corporate equipment and auto-link
      if (!localEq) {
        const corpEq = corpEqMap.get(cleanEqKey);
        if (corpEq) {
          if (!isDryRun) {
            const created = await prisma.mF_P_Equipment.create({
              data: {
                projectId: project.id,
                corporateEquipmentId: corpEq.id,
                condition: corpEq.condition || 'DRY',
                costRate: corpEq.costRate || corpEq.dailyRate || 0,
                status: 'active',
                meterUnitCode: corpEq.unit || 'Hrs',
              },
              include: {
                corporateEquipment: true,
              },
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
              condition: corpEq.condition || 'DRY',
              costRate: corpEq.costRate || corpEq.dailyRate || 0,
              status: 'active',
              meterUnitCode: corpEq.unit || 'Hrs',
              ownerPartnerId: null,
              createdAt: new Date(),
              corporateEquipment: corpEq,
            } as any;
          }
        }
      }

      if (!localEq) {
        errors.push({
          line: group.rawLineIndex,
          operator: group.operatorIdentifier,
          equipment: group.equipmentIdentifier,
          dateStr: group.dateStr,
          inTime: group.inTime,
          outTime: group.outTime,
          hours: group.hours,
          reason: `Equipment '${group.equipmentIdentifier}' not found in project or corporate master`,
        });
        skippedCount++;
        continue;
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

    // Resolve or create DailySheet for date
    const dateKey = group.date.toISOString().slice(0, 10);
    let dailySheetId = processedDailySheets.get(dateKey);

    if (!dailySheetId && !isDryRun) {
      const targetUtcDate = new Date(dateKey + 'T00:00:00.000Z');
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

    let finalInTime: string | null = group.inTime || null;
    let finalOutTime: string | null = group.outTime || null;
    let shiftHours = Number(group.hours || 0);
    let otHours = 0;
    let breakHours = 0;
    let regularHours = shiftHours;

    if (group.inTime && group.outTime) {
      const calc = calculateShiftAndOvertime(group.inTime, group.outTime, 8.0);
      shiftHours = calc.shiftHours;
      otHours = calc.otHours;
      breakHours = calc.breakHours;
      regularHours = Math.max(0, calc.shiftHours - calc.otHours);
      finalInTime = group.inTime;
      finalOutTime = group.outTime;
    }

    if (isDryRun) {
      successCount++;
      continue;
    }

    const targetUtcDate = new Date(dateKey + 'T00:00:00.000Z');

    // 1. Ensure DailyAssignment exists for the operator (links operator to this supervisor's daily sheet)
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

    // 2. Clear existing time entry for this operator and date to prevent duplicate totals
    await prisma.mF_OP_TimeEntry.deleteMany({
      where: {
        projectId: project.id,
        employeeId: localEmp.id,
        date: targetUtcDate,
      },
    });

    // 3. Create Time Entry for operator with equipmentId directly attached (matching normal system behavior)
    await prisma.mF_OP_TimeEntry.create({
      data: {
        projectId: project.id,
        dailySheetId: dailySheetId!,
        employeeId: localEmp.id,
        date: targetUtcDate,
        activityId: defaultActivityId,
        equipmentId: localEq ? localEq.id : null,
        effectiveDayTypeId,
        inTime: finalInTime,
        outTime: finalOutTime,
        shiftHours: shiftHours,
        overtimeHours: otHours,
        breakHours: breakHours,
        hours: regularHours,
        status: 'submitted',
        submittedAt: new Date(),
        appliedDailyRate: localEmp.dailyRate ? Number(localEmp.dailyRate) : 1400.0,
      },
    });

    successCount++;
  }

  // 8. Output Summary and Report
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}                 UPLOAD SUMMARY                      ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`✅ Successfully Processed: ${GREEN}${BOLD}${successCount}${RESET} operator shifts`);
  if (skippedCount > 0) {
    console.log(`⚠️ Skipped/Failed:         ${YELLOW}${BOLD}${skippedCount}${RESET}`);
  }
  if (errors.length > 0) {
    console.log(`❌ Errors Encountered:     ${RED}${BOLD}${errors.length}${RESET}`);

    const skippedCsvPath = path.join(__dirname, 'skipped_operator_records.csv');
    const csvHeader = 'Line,Operator,Equipment,Date,In,Out,Hours,Reason\n';
    const csvRows = errors
      .map(
        (e) =>
          `${e.line},"${e.operator}","${e.equipment || ''}","${e.dateStr || ''}","${e.inTime || ''}","${e.outTime || ''}",${e.hours || 0},"${e.reason.replace(/\"/g, '""')}"`
      )
      .join('\n');

    fs.writeFileSync(skippedCsvPath, csvHeader + csvRows, 'utf-8');
    console.log(`\n📄 Detailed error log written to: ${BOLD}${skippedCsvPath}${RESET}`);
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
