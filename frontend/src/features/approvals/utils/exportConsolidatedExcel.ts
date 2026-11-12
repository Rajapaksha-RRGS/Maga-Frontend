import ExcelJS from 'exceljs';
import type {
  ConsolidatedWorkerItem,
  ConsolidatedOperatorItem,
  ConsolidatedEquipmentItem,
} from '../components/ConsolidatedApprovalView';

function formatHoursDisplay(num?: number | null): string {
  if (num === undefined || num === null || isNaN(Number(num))) return '0.0h';
  const val = Number(num);
  return `${val.toFixed(1)}h`;
}

function computeGrossHours(totalHours?: number, inTime?: string, outTime?: string): number {
  let grossHours = totalHours || 0;
  if (!grossHours && inTime && outTime) {
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    if (!isNaN(inH) && !isNaN(outH)) {
      let diff = outH * 60 + (outM || 0) - (inH * 60 + (inM || 0));
      if (diff <= 0) diff += 1440;
      grossHours = parseFloat((diff / 60).toFixed(2));
    }
  }
  return grossHours;
}

function formatBreakLabel(
  breakHours?: number,
  isLunchDeducted?: boolean,
  isDinnerDeducted?: boolean
): string {
  let breakLabel = (breakHours ?? 0) > 0 ? `-${breakHours}h` : '0h';
  if (isLunchDeducted && isDinnerDeducted) breakLabel += ' (Lunch+Dinner)';
  else if (isLunchDeducted) breakLabel += ' (Lunch)';
  else if (isDinnerDeducted) breakLabel += ' (Dinner)';
  return breakLabel;
}

function formatEquipmentUsage(eq: ConsolidatedEquipmentItem): string {
  const unitUpper = (eq.primaryUnit || 'hrs').toUpperCase();
  if (unitUpper === 'HRS') {
    const hrs = Number(eq.netHours || eq.workingHours || eq.loggedQuantity || 0);
    return `${hrs.toFixed(1)} Hrs`;
  }
  if (unitUpper === 'MTH') {
    const qty = Number(eq.loggedQuantity ?? 0);
    return `${qty} mth`;
  }
  if (unitUpper === 'DAYS' || unitUpper === 'DAY') {
    const days = Number(eq.loggedQuantity || 1);
    return `${days} Day${days === 1 ? '' : 's'}`;
  }
  return `${eq.loggedQuantity ?? 0} ${unitUpper}`;
}

function getColumnLetter(colNum: number): string {
  let letter = '';
  let n = colNum;
  while (n > 0) {
    const rem = (n - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    n = Math.floor((n - 1) / 26);
  }
  return letter;
}

interface SheetSetupOptions {
  sheetName: string;
  bannerTitle: string;
  selectedDate: string;
  supervisorTitle: string;
  recordCount: number;
  headers: string[];
  colWidths: number[];
}

function createStyledSheet(workbook: ExcelJS.Workbook, opts: SheetSetupOptions): ExcelJS.Worksheet {
  const sheet = workbook.addWorksheet(opts.sheetName, {
    views: [{ state: 'frozen', ySplit: 4 }],
  });

  const lastColLetter = getColumnLetter(opts.headers.length);

  // Title Banner
  sheet.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = opts.bannerTitle;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 30;

  // Subtitle Banner
  sheet.mergeCells(`A2:${lastColLetter}2`);
  const subTitleCell = sheet.getCell('A2');
  subTitleCell.value = `Date: ${opts.selectedDate} | Supervisor: ${opts.supervisorTitle} | Total Records: ${opts.recordCount} | Exported: ${new Date().toLocaleString()}`;
  subTitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF1E293B' } };
  subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 22;

  sheet.getRow(3).height = 8;

  // Header Row
  const headerRow = sheet.getRow(4);
  headerRow.values = opts.headers;
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  opts.colWidths.forEach((width, i) => {
    sheet.getColumn(i + 1).width = width;
  });

  return sheet;
}

function styleDataRow(row: ExcelJS.Row, idx: number, centeredCols: number[]): void {
  row.height = 22;
  row.eachCell((cell, colNumber) => {
    cell.font = { name: 'Segoe UI', size: 9 };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: centeredCols.includes(colNumber) ? 'center' : 'left',
    };
  });

  if (idx % 2 === 1) {
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
    });
  }
}

function addSummaryRow(
  sheet: ExcelJS.Worksheet,
  rowIdx: number,
  mergeEndColIndex: number,
  totalCols: number,
  label: string,
  sumColIndices: number[]
): void {
  const sumRow = sheet.getRow(rowIdx);
  const mergeEndLetter = getColumnLetter(mergeEndColIndex);
  sheet.mergeCells(`A${rowIdx}:${mergeEndLetter}${rowIdx}`);
  const sumLabel = sheet.getCell(`A${rowIdx}`);
  sumLabel.value = label;
  sumLabel.alignment = { vertical: 'middle', horizontal: 'center' };

  sumColIndices.forEach((colIndex) => {
    const colLetter = getColumnLetter(colIndex);
    const cell = sumRow.getCell(colIndex);
    cell.value = { formula: `SUM(${colLetter}5:${colLetter}${rowIdx - 1})` };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  sumRow.height = 24;
  for (let c = 1; c <= totalCols; c++) {
    const cell = sumRow.getCell(c);
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF1E293B' } },
    };
  }
}

async function downloadWorkbook(
  workbook: ExcelJS.Workbook,
  filePrefix: string,
  supervisorTitle: string,
  selectedDate: string
): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanTitle = supervisorTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `${filePrefix}_${cleanTitle}_${selectedDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function exportConsolidatedLaborToExcel(
  workers: ConsolidatedWorkerItem[],
  selectedDate: string,
  supervisorTitle: string = 'All Supervisors',
  isApprovedView: boolean = false
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Maga Construction ERP';
  workbook.created = new Date();

  const headers = [
    '#',
    'Supervisor',
    'Worker Code',
    'Worker Name',
    'Trade / Category',
    'Partner / Subcontractor',
    'In Time',
    'Out Time',
    'Break Deducted',
    'Additional Hrs',
    'Total Hours',
    'Effective Hours',
    'OT Hours',
    'Activities Worked',
    'Status',
  ];

  const colWidths = [5, 22, 14, 22, 22, 30, 10, 10, 18, 14, 13, 14, 12, 36, 12];

  const sheet = createStyledSheet(workbook, {
    sheetName: 'Labor Entries',
    bannerTitle: 'MÄGA ENGINEERING (PVT) LTD — CONSOLIDATED LABOR TIME CARD REPORT',
    selectedDate,
    supervisorTitle,
    recordCount: workers.length,
    headers,
    colWidths,
  });

  let rowIdx = 5;
  workers.forEach((w, idx) => {
    const grossHours = computeGrossHours(w.totalHours, w.inTime, w.outTime);
    const breakLabel = formatBreakLabel(w.breakHours, w.isLunchDeducted, w.isDinnerDeducted);
    const effectiveVal = w.effectiveHours ?? w.shiftHours ?? ((w.hours ?? 0) + (w.otHours ?? 0));
    const otVal = w.otHours ?? 0;
    const acts = (w.activities || [])
      .map((a) => `${a.code}: ${formatHoursDisplay(a.hours)}`)
      .join(', ');

    const row = sheet.getRow(rowIdx);
    row.values = [
      idx + 1,
      `${w.supervisorName || 'Supervisor'} (@${w.supervisorUsername || ''})`,
      w.employeeCode || '',
      w.callingName || w.fullName || '',
      w.tradeGroup || '',
      w.businessPartner || 'Direct Mäga',
      w.inTime || '-',
      w.outTime || '-',
      breakLabel,
      w.additionalHours ? `+${w.additionalHours}h` : '-',
      grossHours,
      effectiveVal,
      otVal >= 0 ? `+${otVal.toFixed(1)}h` : `${otVal.toFixed(1)}h`,
      acts || '-',
      isApprovedView || w.status === 'approved'
        ? 'Approved'
        : w.inTime && w.outTime
        ? 'Done'
        : 'Missing',
    ];

    styleDataRow(row, idx, [1, 7, 8, 9, 10, 11, 12, 13, 15]);
    rowIdx++;
  });

  if (workers.length > 0) {
    addSummaryRow(sheet, rowIdx, 10, headers.length, `TOTAL (${workers.length} Workers)`, [11, 12]);
  }

  await downloadWorkbook(workbook, 'Labor_Entries', supervisorTitle, selectedDate);
}

export async function exportConsolidatedOperatorsToExcel(
  operators: ConsolidatedOperatorItem[],
  selectedDate: string,
  supervisorTitle: string = 'All Supervisors',
  isApprovedView: boolean = false
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Maga Construction ERP';
  workbook.created = new Date();

  const headers = [
    '#',
    'Supervisor',
    'Operator Code',
    'Operator Name',
    'Assigned Machine',
    'In Time',
    'Out Time',
    'Break Deducted',
    'Additional Hrs',
    'Total Hours',
    'Effective Hours',
    'OT Hours',
    'Status',
  ];

  const colWidths = [5, 22, 15, 22, 28, 10, 10, 18, 14, 13, 14, 12, 12];

  const sheet = createStyledSheet(workbook, {
    sheetName: 'Machine Operators',
    bannerTitle: 'MÄGA ENGINEERING (PVT) LTD — CONSOLIDATED MACHINE OPERATORS TIME CARD REPORT',
    selectedDate,
    supervisorTitle,
    recordCount: operators.length,
    headers,
    colWidths,
  });

  let rowIdx = 5;
  operators.forEach((op, idx) => {
    const grossHours = computeGrossHours(op.totalHours, op.inTime, op.outTime);
    const breakLabel = formatBreakLabel(op.breakHours, op.isLunchDeducted, op.isDinnerDeducted);
    const effectiveVal = op.effectiveHours ?? op.shiftHours ?? ((op.hours ?? 0) + (op.otHours ?? 0));
    const otVal = op.otHours ?? 0;

    const row = sheet.getRow(rowIdx);
    row.values = [
      idx + 1,
      `${op.supervisorName || 'Supervisor'} (@${op.supervisorUsername || ''})`,
      op.operatorCode || '',
      op.callingName || op.fullName || '',
      op.assignedEquipmentDisplay && op.assignedEquipmentDisplay !== '—'
        ? op.assignedEquipmentDisplay
        : 'Unassigned Machine',
      op.inTime || '-',
      op.outTime || '-',
      breakLabel,
      op.additionalHours ? `+${op.additionalHours}h` : '-',
      grossHours,
      effectiveVal,
      otVal >= 0 ? `+${otVal.toFixed(1)}h` : `${otVal.toFixed(1)}h`,
      isApprovedView || op.status === 'approved'
        ? 'Approved'
        : op.inTime && op.outTime
        ? 'Done'
        : 'Missing',
    ];

    styleDataRow(row, idx, [1, 6, 7, 8, 9, 10, 11, 12, 13]);
    rowIdx++;
  });

  if (operators.length > 0) {
    addSummaryRow(
      sheet,
      rowIdx,
      9,
      headers.length,
      `TOTAL (${operators.length} Operators)`,
      [10, 11]
    );
  }

  await downloadWorkbook(workbook, 'Machine_Operators', supervisorTitle, selectedDate);
}

export async function exportConsolidatedEquipmentToExcel(
  equipment: ConsolidatedEquipmentItem[],
  selectedDate: string,
  supervisorTitle: string = 'All Supervisors',
  isApprovedView: boolean = false
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Maga Construction ERP';
  workbook.created = new Date();

  const headers = [
    '#',
    'Supervisor',
    'Equipment Code',
    'Maga No',
    'Equipment / Machine',
    'Condition',
    'Unit',
    'Logged Usage',
    'Working / Net Hrs',
    'Initial Meter',
    'Final Meter',
    'Fuel (L)',
    'Activities Worked',
    'Status',
  ];

  const colWidths = [5, 22, 15, 13, 26, 13, 10, 14, 16, 13, 13, 12, 36, 12];

  const sheet = createStyledSheet(workbook, {
    sheetName: 'Plant & Equipment',
    bannerTitle: 'MÄGA ENGINEERING (PVT) LTD — CONSOLIDATED PLANT & EQUIPMENT LOG REPORT',
    selectedDate,
    supervisorTitle,
    recordCount: equipment.length,
    headers,
    colWidths,
  });

  let rowIdx = 5;
  equipment.forEach((eq, idx) => {
    const unitUpper = (eq.primaryUnit || 'hrs').toUpperCase();
    const workingNetHrs = Number(eq.netHours || eq.workingHours || 0);
    const hasMeters = eq.initialMeter > 0 || eq.finalMeter > 0;
    const activities = (eq.splits || [])
      .map((act) => `${act.activityCode}: ${act.utilization} ${act.unit}`)
      .join(', ');

    const row = sheet.getRow(rowIdx);
    row.values = [
      idx + 1,
      `${eq.supervisorName || 'Supervisor'} (@${eq.supervisorUsername || ''})`,
      eq.equipmentCode || '',
      eq.magaNo || '-',
      eq.equipmentName || '',
      eq.condition || 'DRY',
      unitUpper,
      formatEquipmentUsage(eq),
      workingNetHrs,
      hasMeters ? eq.initialMeter : '-',
      hasMeters ? eq.finalMeter : '-',
      Number(eq.fuelLiters || 0),
      activities || '-',
      isApprovedView || eq.status === 'approved' ? 'Approved' : 'Logged',
    ];

    styleDataRow(row, idx, [1, 6, 7, 8, 9, 10, 11, 12, 14]);
    rowIdx++;
  });

  if (equipment.length > 0) {
    addSummaryRow(
      sheet,
      rowIdx,
      8,
      headers.length,
      `TOTAL (${equipment.length} Equipment)`,
      [9, 12]
    );
  }

  await downloadWorkbook(workbook, 'Plant_Equipment', supervisorTitle, selectedDate);
}
