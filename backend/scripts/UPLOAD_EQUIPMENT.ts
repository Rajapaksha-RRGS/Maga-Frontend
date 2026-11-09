/**
 * UPLOAD_EQUIPMENT.ts
 * 
 * Maga Equipment Bulk Utilization Entry Script
 * 
 * Supports both:
 * 1. Standard Maga SAP/ERP 6-Column Format:
 *    Equipment Code | Condition | Unit | Date | Activity | Utilization
 * 
 * 2. 5-Column Format:
 *    Equipment | Total Utilization | Activity | Utilization | Date
 * 
 * Capabilities:
 * 1. Reads CSV / TSV (comma, tab, or semicolon delimited).
 * 2. Matches equipment against Local Project Table (MF_P_Equipment / MF_G_Equipment).
 * 3. Handles multi-activity split rows for the same equipment on the same date.
 * 4. Ensures DailySheet & DailyEquipmentAssignment exist (with operatorId = null, 100% separate from operators).
 * 5. Automatically records Total Utilization, Unit (mth/hrs/day), Condition (DRY/WET), and Activity Splitted Utilization.
 * 6. Sets Equipment Log status directly to 'submitted'.
 * 7. Comprehensive Zero-Crash Policy with row-by-row reporting & skipped_equipment_records.csv generation.
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

interface RawEquipmentRow {
  equipmentIdentifier: string;
  condition?: string;
  unit?: string;
  totalUtilization?: number;
  activityCode: string;
  utilization: number;
  dateStr: string;
  rawLineIndex: number;
}

interface ProcessError {
  line: number;
  equipment: string;
  condition?: string;
  unit?: string;
  dateStr?: string;
  totalUtilization?: number;
  activityCode?: string;
  utilization?: number;
  reason: string;
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

  // D-M-YYYY or DD-MM-YYYY
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

// Helper: Parse CSV / TSV file
function parseRawFile(content: string): RawEquipmentRow[] {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  let delimiter = ',';
  if (firstLine.includes('\t')) delimiter = '\t';
  else if (firstLine.includes(';') && !firstLine.includes(',')) delimiter = ';';

  const headerTokens = firstLine.split(delimiter).map((t) => t.trim().toLowerCase().replace(/[\"']/g, ''));
  const hasHeader = headerTokens.some(
    (tok) => tok.includes('equip') || tok.includes('util') || tok.includes('act') || tok.includes('date') || tok.includes('cond')
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

  let startIndex = 0;
  if (hasHeader) {
    startIndex = 1;
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

  // Fallback defaults if header tokens not found
  if (colMap.equipment === -1) {
    if (headerTokens.length >= 6) {
      // Maga ERP format: Equipment (0), Condition (1), Unit (2), Date (3), Activity (4), Utilization (5)
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
      // 5-column format: Equipment (0), Total Utilization (1), Activity (2), Utilization (3), Date (4)
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

  const rows: RawEquipmentRow[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const rawTokens = lines[i].split(delimiter).map((t) => t.trim().replace(/^[\"']+|[\"']+$/g, ''));
    if (rawTokens.length < 3) continue;

    const eq = colMap.equipment >= 0 ? rawTokens[colMap.equipment] : '';
    const cond = colMap.condition >= 0 ? rawTokens[colMap.condition] : '';
    const un = colMap.unit >= 0 ? rawTokens[colMap.unit] : '';
    const totUtilStr = colMap.totalUtilization >= 0 ? rawTokens[colMap.totalUtilization] : '';
    const act = colMap.activity >= 0 ? rawTokens[colMap.activity] : '';
    const utilStr = colMap.utilization >= 0 ? rawTokens[colMap.utilization] : '';
    const dt = colMap.date >= 0 ? rawTokens[colMap.date] : '';

    if (!eq && !act) continue;

    const parsedUtil = parseFloat(utilStr) || 0;
    const parsedTotalUtil = totUtilStr ? parseFloat(totUtilStr) : undefined;

    rows.push({
      equipmentIdentifier: eq,
      condition: cond || undefined,
      unit: un || undefined,
      totalUtilization: parsedTotalUtil,
      activityCode: act,
      utilization: parsedUtil,
      dateStr: dt,
      rawLineIndex: i + 1,
    });
  }

  return rows;
}

async function main() {
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}     MAGA EQUIPMENT BULK UTILIZATION UPLOADER        ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}\n`);

  // 1. Parse CLI Arguments (Supports: [filePath] [projectCode] OR --file=... --project=... --dry-run)
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run') || args.includes('-d');
  if (isDryRun) {
    console.log(`${YELLOW}${BOLD}🧪 RUNNING IN DRY RUN MODE (No database writes will occur)${RESET}\n`);
  }

  // 2. Resolve Input File
  const defaultFilePath = path.join(__dirname, 'Company equipment Master Upload Sheet.csv');
  let explicitFilePath: string | null = null;
  let explicitProject: string | null = null;

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
    } else if (!a.startsWith('-')) {
      explicitProject = a.trim();
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

  // Auto-detect project from CSV equipment codes if project not explicitly supplied!
  if (!project && fs.existsSync(targetFilePath)) {
    const previewContent = fs.readFileSync(targetFilePath, 'utf-8');
    const previewRows = parseRawFile(previewContent).slice(0, 15);
    const sampleEqCodes = previewRows.map((r) => r.equipmentIdentifier.trim()).filter(Boolean);

    if (sampleEqCodes.length > 0) {
      const match = await prisma.mF_P_Equipment.findFirst({
        where: {
          corporateEquipment: {
            OR: [
              { standardEquipmentNumber: { in: sampleEqCodes, mode: 'insensitive' } },
              { vehicleNo: { in: sampleEqCodes, mode: 'insensitive' } },
            ],
          },
        },
        select: { projectId: true },
      });
      if (match) {
        project = allProjects.find((p) => p.id === match.projectId) || null;
        if (project) {
          console.log(`🔍 ${GREEN}Auto-detected Project from CSV equipment:${RESET} ${BOLD}${project.projectName} (${project.projectCode})${RESET}`);
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

  // 5. Pre-load local project equipment and activities for rapid lookups
  console.log(`🔄 Pre-loading Project Equipment & Activity Codes...`);
  const projectEquipmentList = await prisma.mF_P_Equipment.findMany({
    where: { projectId: project.id },
    include: {
      corporateEquipment: true,
      meterUnit: true,
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
  const corpMap = new Map<string, typeof corporateEquipments[0]>();
  for (const ce of corporateEquipments) {
    if (ce.standardEquipmentNumber) {
      corpMap.set(ce.standardEquipmentNumber.trim().toLowerCase(), ce);
    }
    if (ce.vehicleNo) {
      corpMap.set(ce.vehicleNo.trim().toLowerCase(), ce);
    }
  }

  // Pre-load project activities
  const projectActivities = await prisma.mF_P_ActivityCode.findMany({
    where: { projectId: project.id },
  });
  const actMap = new Map<string, string>();
  for (const pa of projectActivities) {
    actMap.set(pa.code.trim().toLowerCase(), pa.id);
  }

  // Pre-load corporate activities
  const corporateActivities = await prisma.mF_G_ActivityCode.findMany();
  const corpActMap = new Map<string, typeof corporateActivities[0]>();
  for (const ca of corporateActivities) {
    corpActMap.set(ca.code.trim().toLowerCase(), ca);
  }

  // Helper to resolve or auto-link activity
  async function resolveActivityId(actCode: string): Promise<string | null> {
    const cleanCode = actCode.trim().toLowerCase();
    if (actMap.has(cleanCode)) return actMap.get(cleanCode)!;

    for (const [code, id] of actMap.entries()) {
      if (code.startsWith(cleanCode) || cleanCode.startsWith(code)) {
        return id;
      }
    }

    const corpAct = corpActMap.get(cleanCode);
    if (!isDryRun) {
      const created = await prisma.mF_P_ActivityCode.create({
        data: {
          projectId: project!.id,
          code: actCode.trim(),
          description: corpAct?.description || actCode.trim(),
          corporateActivityCodeId: corpAct?.id || null,
          unit: corpAct?.unit || 'hrs',
        },
      });
      actMap.set(cleanCode, created.id);
      return created.id;
    } else {
      return 'dry-run-activity-id';
    }
  }

  // 6. Group Rows by (Equipment, Date) to handle Multi-Activity Rows
  console.log(`🔗 Grouping entries by Equipment and Date...`);
  const groupedEntries = new Map<
    string,
    {
      equipmentIdentifier: string;
      condition?: string;
      unit?: string;
      dateStr: string;
      date: Date;
      totalUtilization?: number;
      activities: Array<{ activityCode: string; utilization: number; rawLineIndex: number }>;
    }
  >();

  const errors: ProcessError[] = [];
  let lastEquipment = '';
  let lastDateStr = '';

  for (const r of parsedRows) {
    const eqKey = r.equipmentIdentifier || lastEquipment;
    const dtStr = r.dateStr || lastDateStr;

    if (!eqKey) {
      errors.push({
        line: r.rawLineIndex,
        equipment: 'UNKNOWN',
        dateStr: r.dateStr,
        activityCode: r.activityCode,
        utilization: r.utilization,
        reason: 'Missing Equipment Code/Number',
      });
      continue;
    }

    if (!dtStr) {
      errors.push({
        line: r.rawLineIndex,
        equipment: eqKey,
        dateStr: '',
        activityCode: r.activityCode,
        utilization: r.utilization,
        reason: 'Missing Date',
      });
      continue;
    }

    const parsedDate = parseDateInput(dtStr);
    if (!parsedDate) {
      errors.push({
        line: r.rawLineIndex,
        equipment: eqKey,
        dateStr: dtStr,
        activityCode: r.activityCode,
        utilization: r.utilization,
        reason: `Invalid Date format: "${dtStr}"`,
      });
      continue;
    }

    lastEquipment = eqKey;
    lastDateStr = dtStr;

    const groupKey = `${eqKey.trim().toUpperCase()}___${parsedDate.toISOString().slice(0, 10)}`;
    if (!groupedEntries.has(groupKey)) {
      groupedEntries.set(groupKey, {
        equipmentIdentifier: eqKey.trim(),
        condition: r.condition,
        unit: r.unit,
        dateStr: dtStr,
        date: parsedDate,
        totalUtilization: r.totalUtilization,
        activities: [],
      });
    }

    const group = groupedEntries.get(groupKey)!;
    if (r.condition && !group.condition) group.condition = r.condition;
    if (r.unit && !group.unit) group.unit = r.unit;

    if (r.totalUtilization !== undefined && r.totalUtilization > 0) {
      group.totalUtilization = Math.max(group.totalUtilization || 0, r.totalUtilization);
    }

    if (r.activityCode) {
      group.activities.push({
        activityCode: r.activityCode.trim(),
        utilization: r.utilization,
        rawLineIndex: r.rawLineIndex,
      });
    }
  }

  console.log(`📦 Unique (Equipment, Date) sets to process: ${BOLD}${groupedEntries.size}${RESET}\n`);

  // 7. Process Groups and Insert into Database
  let successCount = 0;
  let skippedCount = 0;
  const processedDailySheets = new Map<string, string>(); // dateKey -> dailySheetId

  for (const [groupKey, group] of groupedEntries) {
    const cleanEqKey = group.equipmentIdentifier.toLowerCase();
    let localEq = eqMap.get(cleanEqKey);

    // If not found in project equipment, check corporate equipment and auto-link
    if (!localEq) {
      const corpEq = corpMap.get(cleanEqKey);
      if (corpEq) {
        if (!isDryRun) {
          const created = await prisma.mF_P_Equipment.create({
            data: {
              projectId: project.id,
              corporateEquipmentId: corpEq.id,
              condition: group.condition || corpEq.condition || 'DRY',
              costRate: corpEq.costRate || corpEq.dailyRate || 0,
              status: 'active',
              meterUnitCode: group.unit || corpEq.unit || 'Hrs',
            },
            include: {
              corporateEquipment: true,
              meterUnit: true,
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
            condition: group.condition || corpEq.condition || 'DRY',
            costRate: corpEq.costRate || corpEq.dailyRate || 0,
            status: 'active',
            meterUnitCode: group.unit || corpEq.unit || 'Hrs',
            ownerPartnerId: null,
            createdAt: new Date(),
            corporateEquipment: corpEq,
            meterUnit: null,
          } as any;
        }
      }
    }

    if (!localEq) {
      errors.push({
        line: group.activities[0]?.rawLineIndex || 0,
        equipment: group.equipmentIdentifier,
        condition: group.condition,
        unit: group.unit,
        dateStr: group.dateStr,
        reason: `Equipment "${group.equipmentIdentifier}" not found in project or corporate master`,
      });
      skippedCount++;
      continue;
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

    // Validate Activity Codes
    const validActivities: Array<{ activityCodeId: string; utilization: number }> = [];
    for (const act of group.activities) {
      const actId = await resolveActivityId(act.activityCode);
      if (!actId) {
        errors.push({
          line: act.rawLineIndex,
          equipment: group.equipmentIdentifier,
          dateStr: group.dateStr,
          activityCode: act.activityCode,
          utilization: act.utilization,
          reason: `Activity code "${act.activityCode}" not found`,
        });
      } else {
        validActivities.push({
          activityCodeId: actId,
          utilization: act.utilization,
        });
      }
    }

    if (validActivities.length === 0 && group.activities.length > 0) {
      skippedCount++;
      continue;
    }

    // Determine Total Utilization (Sum of splits if totalUtilization not explicitly supplied)
    const sumSplits = validActivities.reduce((acc, a) => acc + (a.utilization || 0), 0);
    const finalTotalUtilization = (group.totalUtilization && group.totalUtilization > 0)
      ? group.totalUtilization
      : parseFloat(sumSplits.toFixed(4));

    const primaryUnit = (group.unit || localEq.meterUnitCode || localEq.corporateEquipment?.unit || 'hrs').toLowerCase();
    const isHoursBased = primaryUnit === 'hrs' || primaryUnit === 'ex.hrs' || primaryUnit === 'hour';

    if (isDryRun) {
      successCount++;
      continue;
    }

    // 1. Upsert Daily Equipment Assignment (operatorId is explicitly null)
    const assignment = await prisma.mF_OP_DailyEquipmentAssignment.upsert({
      where: {
        dailySheetId_equipmentId: {
          dailySheetId: dailySheetId!,
          equipmentId: localEq.id,
        },
      },
      update: {
        operatorId: null, // Separated from operator
      },
      create: {
        dailySheetId: dailySheetId!,
        equipmentId: localEq.id,
        operatorId: null, // Separated from operator
      },
    });

    // 2. Upsert Equipment Daily Log
    const dailyLog = await prisma.mF_OP_EquipmentDailyLog.upsert({
      where: { assignmentId: assignment.id },
      create: {
        assignmentId: assignment.id,
        unitCode: primaryUnit,
        totalUtilization: finalTotalUtilization,
        workingHours: isHoursBased ? finalTotalUtilization : 0,
        netRunningHours: isHoursBased ? finalTotalUtilization : 0,
        status: 'submitted',
      },
      update: {
        unitCode: primaryUnit,
        totalUtilization: finalTotalUtilization,
        workingHours: isHoursBased ? finalTotalUtilization : undefined,
        netRunningHours: isHoursBased ? finalTotalUtilization : undefined,
        status: 'submitted',
      },
    });

    // 3. Clear and recreate Equipment Daily Log Activities (Splits)
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
    }

    successCount++;
  }

  // 8. Output Summary and Report
  console.log(`\n${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`${CYAN}${BOLD}                 UPLOAD SUMMARY                      ${RESET}`);
  console.log(`${CYAN}${BOLD}=====================================================${RESET}`);
  console.log(`✅ Successfully Processed: ${GREEN}${BOLD}${successCount}${RESET} equipment logs`);
  if (skippedCount > 0) {
    console.log(`⚠️ Skipped/Failed:         ${YELLOW}${BOLD}${skippedCount}${RESET}`);
  }
  if (errors.length > 0) {
    console.log(`❌ Errors Encountered:     ${RED}${BOLD}${errors.length}${RESET}`);

    // Export errors to skipped_equipment_records.csv
    const skippedCsvPath = path.join(__dirname, 'skipped_equipment_records.csv');
    const csvHeader = 'Line,Equipment,Condition,Unit,Date,Activity,Utilization,Reason\n';
    const csvRows = errors
      .map(
        (e) =>
          `${e.line},"${e.equipment}","${e.condition || ''}","${e.unit || ''}","${e.dateStr || ''}","${e.activityCode || ''}",${e.utilization || 0},"${e.reason.replace(/\"/g, '""')}"`
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
