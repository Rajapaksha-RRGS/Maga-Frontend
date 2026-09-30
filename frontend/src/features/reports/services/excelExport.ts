/**
 * excelExport.ts — ExcelJS spreadsheet generator for all four reports.
 *
 * Implements standard letterhead (Rows 1-7), data tables starting at Row 9,
 * two-row pivoted date headers with frozen panes, numeric number formats,
 * sensible column widths, authorized signature sign-off column, and system footer.
 */
import ExcelJS from 'exceljs';
import type { Tenant } from '../../auth/services/authService';
import type {
  ReportFilters,
  SummaryReportResponse,
  DayOtSummaryResponse,
  BpBillResponse,
  ErpUploadResponse,
  RunningChartResponse,
  EquipmentSummaryResponse,
  EquipmentErpUploadResponse,
  TimeCardResponse,
} from './reportService';

// ── Formatting Helpers ───────────────────────────────────────────────────────

/** Format date '2026-08-15' to 'Aug-2026' */
function formatReportingMonth(dateStr?: string): string {
  try {
    const d = dateStr ? new Date(dateStr) : new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]}-${d.getFullYear()}`;
  } catch {
    return 'Aug-2026';
  }
}

/** Format current timestamp: '19-Aug-2026 15:30' */
function formatGeneratedTimestamp(): string {
  const d = new Date();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year} ${hours}:${mins}`;
}

/** Format date '2026-08-01' to '01-Aug' */
function formatDayMonth(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const m = months[parseInt(parts[1], 10) - 1] || parts[1];
      return `${parts[2]}-${m}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

/**
 * Standard Letterhead Generator (Rows 1-7, row 8 blank).
 */
function applyLetterhead(
  ws: ExcelJS.Worksheet,
  title: string,
  tenant: Tenant,
  preparedBy: string,
  filters: ReportFilters,
  isBpBill: boolean = false
): void {
  // Row 1: Company Name (Col A) & Report Title (Col E:H)
  const cellA1 = ws.getCell('A1');
  cellA1.value = tenant.company_name;
  cellA1.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  cellA1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('E1:H1');
  const cellTitle = ws.getCell('E1');
  cellTitle.value = title;
  cellTitle.font = { name: 'Calibri', size: 13, bold: true, color: { argb: 'FF1D4ED8' } };
  cellTitle.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 2: Address Line 1
  const cellA2 = ws.getCell('A2');
  cellA2.value = tenant.address_line1;
  cellA2.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
  cellA2.alignment = { horizontal: 'left', vertical: 'middle' };

  // Row 3: Address Line 2
  const cellA3 = ws.getCell('A3');
  cellA3.value = tenant.address_line2;
  cellA3.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
  cellA3.alignment = { horizontal: 'left', vertical: 'middle' };

  // Row 4: Phone / Fax (Col A) & Month (Col E:F)
  const cellA4 = ws.getCell('A4');
  cellA4.value = `Tel: ${tenant.phone}   Fax: ${tenant.fax}`;
  cellA4.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
  cellA4.alignment = { horizontal: 'left', vertical: 'middle' };

  const cellE4 = ws.getCell('E4');
  cellE4.value = 'Month';
  cellE4.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF334155' } };
  cellE4.alignment = { horizontal: 'right', vertical: 'middle' };

  const cellF4 = ws.getCell('F4');
  cellF4.value = formatReportingMonth(filters.dateFrom);
  cellF4.font = { name: 'Calibri', size: 9, color: { argb: 'FF0F172A' } };
  cellF4.alignment = { horizontal: 'left', vertical: 'middle' };

  // Row 5: Email (Col A) & Prepared By (Col E:F)
  const cellA5 = ws.getCell('A5');
  cellA5.value = `Email: ${tenant.email}`;
  cellA5.font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
  cellA5.alignment = { horizontal: 'left', vertical: 'middle' };

  const cellE5 = ws.getCell('E5');
  cellE5.value = 'Prepared By';
  cellE5.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF334155' } };
  cellE5.alignment = { horizontal: 'right', vertical: 'middle' };

  const cellF5 = ws.getCell('F5');
  cellF5.value = preparedBy || 'Admin';
  cellF5.font = { name: 'Calibri', size: 9, color: { argb: 'FF0F172A' } };
  cellF5.alignment = { horizontal: 'left', vertical: 'middle' };

  // Row 6: Blank
  // Row 7: Generated timestamp (Col A) & Business Partner if BP Bill (Col E:F)
  const cellA7 = ws.getCell('A7');
  cellA7.value = `Generated: ${formatGeneratedTimestamp()}`;
  cellA7.font = { name: 'Calibri', size: 9, color: { argb: 'FF64748B' } };
  cellA7.alignment = { horizontal: 'left', vertical: 'middle' };

  if (isBpBill) {
    const cellE7 = ws.getCell('E7');
    cellE7.value = 'Business Partner:';
    cellE7.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF334155' } };
    cellE7.alignment = { horizontal: 'right', vertical: 'middle' };

    const cellF7 = ws.getCell('F7');
    cellF7.value = filters.businessPartner || 'All';
    cellF7.font = { name: 'Calibri', size: 9, color: { argb: 'FF0F172A' } };
    cellF7.alignment = { horizontal: 'left', vertical: 'middle' };
  }

  // Row 8: Blank spacer row
}

/** Apply thin cell border */
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

/**
 * Standard System Footer
 */
function applyFooter(ws: ExcelJS.Worksheet, lastDataRowIndex: number, totalColCount: number): void {
  const footerRow = lastDataRowIndex + 2;
  const startCol = 1;
  const endCol = totalColCount;

  ws.mergeCells(footerRow, startCol, footerRow, endCol);
  const cell = ws.getCell(footerRow, startCol);
  cell.value = 'Generated by Labour Entry System — not valid without authorized signature';
  cell.font = { name: 'Calibri', size: 9, italic: true, color: { argb: 'FF64748B' } };
  cell.alignment = { horizontal: 'left', vertical: 'middle' };
}

/**
 * Convert an ArrayBuffer, Uint8Array, or ExcelJS buffer to a Base64 string.
 * Safe for Browser and Capacitor mobile environments.
 * Uses 32KB chunking to prevent "Maximum call stack size exceeded" errors on large Excel files.
 */
export function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  // Check if Node Buffer is available in environment
  const maybeBuffer = (globalThis as unknown as { Buffer?: { from: (b: unknown) => { toString: (enc: string) => string } } }).Buffer;
  if (maybeBuffer && typeof maybeBuffer.from === 'function') {
    return maybeBuffer.from(buffer).toString('base64');
  }

  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/** Trigger browser file download from workbook buffer */
async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

// ── 1. Export: Summary Report ────────────────────────────────────────────────

export async function exportSummaryToExcel(
  data: SummaryReportResponse,
  tenant: Tenant,
  preparedBy: string,
  filters: ReportFilters
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Labour Entry System';
  const ws = workbook.addWorksheet('Summary');

  // Letterhead
  applyLetterhead(ws, 'LABOUR ENTRY SHEET SUMMARY', tenant, preparedBy, filters);

  // Column headers at Row 9
  const headers = [
    'Employee Code',
    'Trade Group',
    'Business Partner',
    'Number of Work Days',
    'Normal Hours',
    'Total OT',
    'Total Effective Hours',
    'Signature', // Blank signature column at the end of each row
  ];

  const headerRow = ws.getRow(9);
  headerRow.values = headers;
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
  });

  // Freeze panes below Row 9
  ws.views = [{ state: 'frozen', ySplit: 9 }];

  // Column Widths
  ws.columns = [
    { width: 22 }, // Employee Code
    { width: 18 }, // Trade Group
    { width: 24 }, // Business Partner
    { width: 20 }, // Number of Work Days
    { width: 16 }, // Normal Hours
    { width: 16 }, // Total OT
    { width: 22 }, // Total Effective Hours
    { width: 24 }, // Signature (blank)
  ];

  // Data rows start at Row 10
  let currentRow = 10;
  data.items.forEach((item) => {
    const empDisplay = item.employeeCode || item.callingName || item.employeeName || item.employeeId;
    const row = ws.getRow(currentRow);
    row.values = [
      empDisplay,
      item.tradeGroup || '—',
      item.businessPartner || 'Direct',
      item.totalDays,
      item.totalNormalHours,
      item.totalOtHours,
      item.totalHours,
      '', // Blank signature cell
    ];

    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(4).numFmt = '0';
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(5).numFmt = '0.00';
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = '0.00';
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(7).numFmt = '0.00';
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
      cell.border = THIN_BORDER;
    });

    currentRow++;
  });

  // Totals Row
  const totalRow = ws.getRow(currentRow);
  totalRow.values = [
    `TOTAL (${data.totals.employeeCount} Employees)`,
    '',
    '',
    data.totals.totalDays,
    data.totals.totalNormalHours,
    data.totals.totalOtHours,
    data.totals.totalHours,
    '',
  ];

  totalRow.height = 22;
  totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.border = THIN_BORDER;
    if (colNumber === 4) cell.numFmt = '0';
    if (colNumber === 5 || colNumber === 6) cell.numFmt = '0.00';
  });

  // Footer
  applyFooter(ws, currentRow, 7);

  const filename = `${tenant.subdomain}-summary-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, filename);
}

// ── 2. Export: Day & OT Summary ──────────────────────────────────────────────

export async function exportDayOtSummaryToExcel(
  data: DayOtSummaryResponse,
  tenant: Tenant,
  preparedBy: string,
  filters: ReportFilters
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Labour Entry System';
  const ws = workbook.addWorksheet('Day & OT Summary');

  // Letterhead
  applyLetterhead(ws, 'DAY & OVER TIME SUMMARY', tenant, preparedBy, filters);

  const dates = data.dates;
  const totalColCount = 3 + dates.length * 2 + 2;

  // Two-Row Merged Header: Rows 9 and 10
  // Row 9: Top headers
  ws.mergeCells('A9:A10');
  const cellA = ws.getCell('A9');
  cellA.value = 'Employee Name';

  ws.mergeCells('B9:B10');
  const cellB = ws.getCell('B9');
  cellB.value = 'Trade Group';

  ws.mergeCells('C9:C10');
  const cellC = ws.getCell('C9');
  cellC.value = 'Business Partner';

  let colIdx = 4;
  dates.forEach((date) => {
    const startCol = colIdx;
    const endCol = colIdx + 1;
    ws.mergeCells(9, startCol, 9, endCol);
    const dateCell = ws.getCell(9, startCol);
    dateCell.value = formatDayMonth(date);
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // Row 10 Subheaders
    const daysSub = ws.getCell(10, startCol);
    daysSub.value = 'Hrs';
    daysSub.alignment = { horizontal: 'center', vertical: 'middle' };

    const otSub = ws.getCell(10, endCol);
    otSub.value = 'O.T.';
    otSub.alignment = { horizontal: 'center', vertical: 'middle' };

    colIdx += 2;
  });

  // End Columns
  ws.mergeCells(9, colIdx, 9, colIdx + 1);
  const totTop = ws.getCell(9, colIdx);
  totTop.value = 'Total';
  totTop.alignment = { horizontal: 'center', vertical: 'middle' };

  const totDaysSub = ws.getCell(10, colIdx);
  totDaysSub.value = 'Hrs';
  totDaysSub.alignment = { horizontal: 'center', vertical: 'middle' };

  const totOtSub = ws.getCell(10, colIdx + 1);
  totOtSub.value = 'O.T.';
  totOtSub.alignment = { horizontal: 'center', vertical: 'middle' };

  // Style Header Rows (9 & 10)
  for (let r = 9; r <= 10; r++) {
    const row = ws.getRow(r);
    row.height = 20;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF1F5F9' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = THIN_BORDER;
    });
  }

  // Freeze panes below Row 10
  ws.views = [{ state: 'frozen', ySplit: 10 }];

  // Column Widths
  const colWidths: { width: number }[] = [
    { width: 24 }, // Name
    { width: 16 }, // Trade
    { width: 22 }, // Business Partner
  ];
  dates.forEach(() => {
    colWidths.push({ width: 8 }, { width: 8 });
  });
  colWidths.push({ width: 10 }, { width: 10 });
  ws.columns = colWidths;

  // Data rows start at Row 11
  let currentRow = 11;
  data.items.forEach((item) => {
    const rowValues: (string | number)[] = [
      item.employeeName,
      item.tradeGroup,
      item.businessPartner,
    ];

    dates.forEach((d) => {
      const entry = item.dailyEntries[d] || { days: 0, otHours: 0, workHours: 0 };
      rowValues.push(entry.workHours, entry.otHours);
    });

    rowValues.push(item.totalWorkHours ?? item.totalDays, item.totalOtHours);

    const row = ws.getRow(currentRow);
    row.values = rowValues;

    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

    let c = 4;
    dates.forEach(() => {
      row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(c).numFmt = '0.00'; // effective hours — decimal
      row.getCell(c + 1).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(c + 1).numFmt = '0.00';
      c += 2;
    });
    row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(c).numFmt = '0.00'; // total work hours
    row.getCell(c + 1).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(c + 1).numFmt = '0.00';

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } };
      cell.border = THIN_BORDER;
    });

    currentRow++;
  });

  // Totals Row
  const totalRow = ws.getRow(currentRow);
  const totalValues: (string | number)[] = [
    `TOTAL (${data.items.length} Workers)`,
    '',
    '',
  ];
  dates.forEach((d) => {
    const dt = data.totals.dateTotals[d] || { days: 0, otHours: 0, workHours: 0 };
    totalValues.push(dt.workHours, dt.otHours);
  });
  totalValues.push(data.totals.totalWorkHours ?? data.totals.totalDays, data.totals.totalOtHours);
  totalRow.values = totalValues;
  totalRow.height = 22;

  totalRow.eachCell({ includeEmpty: true }, (cell, idx) => {
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.border = THIN_BORDER;
    if (idx >= 4) {
      cell.numFmt = '0.00'; // both Hrs and OT columns now use decimal format
    }
  });

  // Footer
  applyFooter(ws, currentRow, totalColCount);

  const filename = `${tenant.subdomain}-day-ot-summary-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, filename);
}

// ── 3. Export: BP Bill ───────────────────────────────────────────────────────

export async function exportBpBillToExcel(
  data: BpBillResponse,
  tenant: Tenant,
  preparedBy: string,
  filters: ReportFilters
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Labour Entry System';
  const ws = workbook.addWorksheet('BP Bill');

  // Letterhead with isBpBill=true (renders Business Partner in E7:F7)
  applyLetterhead(ws, 'BP BILL', tenant, preparedBy, filters, true);

  const dates = data.dates;
  const headers = [
    'Business Partner',
    'Employee Name',
    'Trade Group',
    ...dates.map(formatDayMonth),
    'Total Hrs',
    'Hourly Rate (LKR)',
    'Payment (LKR)',
    '10% O/H (LKR)',
    'Total Cost (LKR)',
  ];

  const headerRow = ws.getRow(9);
  headerRow.values = headers;
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF1F5F9' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
  });

  // Freeze panes below Row 9
  ws.views = [{ state: 'frozen', ySplit: 9 }];

  // Column Widths
  const colWidths: { width: number }[] = [
    { width: 22 }, // Business Partner
    { width: 22 }, // Employee Name
    { width: 16 }, // Trade
  ];
  dates.forEach(() => {
    colWidths.push({ width: 8 });
  });
  colWidths.push(
    { width: 12 }, // Total Hrs
    { width: 16 }, // Rate
    { width: 16 }, // Payment
    { width: 15 }, // 10% O/H
    { width: 18 }  // Total Cost
  );
  ws.columns = colWidths;

  let currentRow = 10;

  data.groups.forEach((group) => {
    // Partner Rows
    group.items.forEach((item) => {
      const rowValues: (string | number)[] = [
        group.businessPartner,
        item.employeeName,
        item.tradeGroup,
      ];

      dates.forEach((d) => {
        rowValues.push(item.dailyHours[d] || 0);
      });

      rowValues.push(
        item.totalHours,
        item.hourlyRate,
        item.totalHourlyPayment,
        item.overhead,
        item.totalCost
      );

      const row = ws.getRow(currentRow);
      row.values = rowValues;

      row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
      row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

      let c = 4;
      dates.forEach(() => {
        row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(c).numFmt = '0.00';
        c++;
      });

      // Total Hrs
      row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(c).numFmt = '0.00';
      // Rate
      row.getCell(c + 1).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(c + 1).numFmt = '#,##0.00';
      // Payment
      row.getCell(c + 2).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(c + 2).numFmt = '#,##0.00';
      // 10% O/H
      row.getCell(c + 3).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(c + 3).numFmt = '#,##0.00';
      // Total Cost
      row.getCell(c + 4).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(c + 4).numFmt = '#,##0.00';

      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } };
        cell.border = THIN_BORDER;
      });

      currentRow++;
    });

    // Subtotal Row per BP
    const subtotalRow = ws.getRow(currentRow);
    const subtotalValues: (string | number)[] = [
      `SUBTOTAL (${group.businessPartner})`,
      '',
      '',
      ...dates.map(() => ''),
      group.subtotalHours,
      '',
      group.subtotalPayment,
      group.subtotalOverhead,
      group.subtotalCost,
    ];
    subtotalRow.values = subtotalValues;
    subtotalRow.height = 20;

    subtotalRow.eachCell({ includeEmpty: true }, (cell, idx) => {
      cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF8FAFC' },
      };
      cell.border = THIN_BORDER;
      if (idx === headers.length - 4) cell.numFmt = '0.00';
      if (idx >= headers.length - 2) cell.numFmt = '#,##0.00';
    });

    currentRow++;
  });

  // Grand Total Row
  const grandTotalRow = ws.getRow(currentRow);
  const grandTotalValues: (string | number)[] = [
    'GRAND TOTAL',
    '',
    '',
    ...dates.map(() => ''),
    data.grandTotalHours,
    '',
    data.grandTotalPayment,
    data.grandTotalOverhead,
    data.grandTotalCost,
  ];
  grandTotalRow.values = grandTotalValues;
  grandTotalRow.height = 22;

  grandTotalRow.eachCell({ includeEmpty: true }, (cell, idx) => {
    cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.border = THIN_BORDER;
    if (idx === headers.length - 4) cell.numFmt = '0.00';
    if (idx >= headers.length - 2) cell.numFmt = '#,##0.00';
  });

  // Footer
  applyFooter(ws, currentRow, headers.length);

  const filename = `${tenant.subdomain}-bp-bill-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, filename);
}

// ── 4. Export: ERP Upload Export ─────────────────────────────────────────────

export async function exportErpUploadToExcel(
  data: ErpUploadResponse,
  tenant: Tenant,
  _preparedBy: string,
  _filters: ReportFilters
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Labour Entry System';
  const ws = workbook.addWorksheet('Upload Details');

  // Dotted border style matching construction Excel sheet
  const DOTTED_BORDER: Partial<ExcelJS.Borders> = {
    top: { style: 'dotted', color: { argb: 'FF94A3B8' } },
    left: { style: 'dotted', color: { argb: 'FF94A3B8' } },
    bottom: { style: 'dotted', color: { argb: 'FF94A3B8' } },
    right: { style: 'dotted', color: { argb: 'FF94A3B8' } },
  };

  // Row 2: "Upload Details" Purple Banner (matching exact photo header)
  ws.mergeCells('A2:F2');
  const bannerCell = ws.getCell('A2');
  bannerCell.value = 'Upload Details';
  bannerCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF6B21A8' } };
  bannerCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF3E8FF' }, // Soft Purple
  };
  bannerCell.alignment = { vertical: 'middle', horizontal: 'center' };
  bannerCell.border = {
    top: { style: 'thin', color: { argb: 'FFC084FC' } },
    bottom: { style: 'thin', color: { argb: 'FFC084FC' } },
    left: { style: 'thin', color: { argb: 'FFC084FC' } },
    right: { style: 'thin', color: { argb: 'FFC084FC' } },
  };
  ws.getRow(2).height = 26;

  // Row 4: Column Headers
  const headers = [
    'Employee',
    'Date',
    'Activity',
    'Hours',
    'Overtime Hours',
    'Remarks',
  ];

  const headerRow = ws.getRow(4);
  headerRow.values = headers;
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF6B21A8' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F3FF' }, // Soft lavender
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = DOTTED_BORDER;
  });

  // Freeze panes below Row 4
  ws.views = [{ state: 'frozen', ySplit: 4 }];

  // Column Widths (6 columns matching photo)
  ws.columns = [
    { width: 16 }, // Employee (ID)
    { width: 14 }, // Date
    { width: 22 }, // Activity
    { width: 12 }, // Hours
    { width: 16 }, // Overtime Hours
    { width: 16 }, // Remarks
  ];

  // Helper to format Date to DD-MM-YYYY
  const formatDisplayDate = (d: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      const [yyyy, mm, dd] = d.split('-');
      return `${dd}-${mm}-${yyyy}`;
    }
    return d;
  };

  interface FormattedExportRow {
    employeeId: string;
    date: string;
    activityCode: string;
    hours: number | null;
    overtimeHours: number | null;
    remarks: string;
  }

  const exportRows: FormattedExportRow[] = [];
  let grandTotalHours = 0;
  let grandTotalOtHours = 0;

  // Map each row directly from report data
  data.rows.forEach((r) => {
    const isOt = r.activityCode.toUpperCase() === 'OT';
    exportRows.push({
      employeeId: r.employeeId,
      date: formatDisplayDate(r.date),
      activityCode: r.activityCode,
      hours: isOt ? null : r.hours,
      overtimeHours: isOt ? r.overtimeHours : null,
      remarks: '',
    });

    if (!isOt) grandTotalHours += r.hours || 0;
    if (isOt) grandTotalOtHours += r.overtimeHours || 0;
  });

  let currentRow = 5;
  exportRows.forEach((rowItem) => {
    const row = ws.getRow(currentRow);
    const isOt = rowItem.activityCode.toUpperCase() === 'OT';
    const isZidle = rowItem.activityCode.toUpperCase() === 'ZIDLE';

    row.values = [
      rowItem.employeeId,
      rowItem.date,
      rowItem.activityCode,
      rowItem.hours !== null ? rowItem.hours : '',
      rowItem.overtimeHours !== null ? rowItem.overtimeHours : '',
      '',
    ];

    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'right', vertical: 'middle' };
    if (rowItem.hours !== null) row.getCell(4).numFmt = '0.00;(0.00)';
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    if (rowItem.overtimeHours !== null) row.getCell(5).numFmt = '0.00';
    row.getCell(6).alignment = { horizontal: 'left', vertical: 'middle' };

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = {
        name: 'Calibri',
        size: 10,
        bold: isOt || isZidle,
        color: { argb: 'FF6B21A8' }, // Purple text matching user reference photo
      };
      cell.border = DOTTED_BORDER;
    });

    // Special styling for ZIDLE hours cell: Solid red background with white bold text matching photo
    if (isZidle) {
      const zidleHoursCell = row.getCell(4);
      zidleHoursCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFF0000' }, // Pure Red background
      };
      zidleHoursCell.font = {
        name: 'Calibri',
        size: 10,
        bold: true,
        color: { argb: 'FFFFFFFF' }, // White bold text
      };
      zidleHoursCell.numFmt = '0.00;(0.00)';
    }

    currentRow++;
  });

  // Totals Row
  const totalRow = ws.getRow(currentRow);
  totalRow.values = [
    `TOTAL (${exportRows.length} Rows)`,
    '',
    '',
    grandTotalHours,
    grandTotalOtHours,
    '',
  ];
  totalRow.height = 22;

  totalRow.eachCell({ includeEmpty: true }, (cell, idx) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.border = THIN_BORDER;
    if (idx === 4 || idx === 5) cell.numFmt = '0.00';
  });

  const filename = `${tenant.subdomain}-upload-details-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, filename);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. EXPORT RUNNING CHART TO EXCEL
// ─────────────────────────────────────────────────────────────────────────────

export async function exportRunningChartToExcel(
  data: RunningChartResponse,
  tenant: Tenant,
  preparedBy: string,
  filters: ReportFilters
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = preparedBy;
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Running Chart', {
    views: [{ state: 'frozen', ySplit: 9 }],
  });

  applyLetterhead(ws, 'DAILY LABOUR RUNNING CHART', tenant, preparedBy, filters);

  // Column Headers at Row 9
  const headers = [
    'Date',
    'Supervisor Name',
    'EMP No.',
    'Calling Name',
    'Business Partner',
    'In Time',
    'Out Time',
    'Work Hours',
    'OT Hours',
    'Total Hours',
    'Activity Breakdown (Code & Hours)',
  ];

  const headerRow = ws.getRow(9);
  headerRow.values = headers;
  headerRow.height = 24;

  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A8A' }, // Corporate navy
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = THIN_BORDER;
  });

  // Column Widths
  ws.columns = [
    { width: 13 }, // Date
    { width: 22 }, // Supervisor Name
    { width: 14 }, // EMP No
    { width: 20 }, // Calling Name
    { width: 20 }, // Business Partner
    { width: 11 }, // In Time
    { width: 11 }, // Out Time
    { width: 13 }, // Work Hours
    { width: 13 }, // OT Hours
    { width: 13 }, // Total Hours
    { width: 44 }, // Activity Breakdown
  ];

  let currentRow = 10;
  let grandWork = 0;
  let grandOt = 0;
  let grandTotal = 0;

  data.items.forEach((item) => {
    const row = ws.getRow(currentRow);
    row.height = 20;

    row.values = [
      item.date,
      item.supervisorName,
      item.employeeCode,
      item.callingName,
      item.businessPartner,
      item.inTime,
      item.outTime,
      item.workHours,
      item.otHours,
      item.totalHours,
      item.activitiesDisplay,
    ];

    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(11).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(8).numFmt = '0.00';
    row.getCell(9).numFmt = '0.00';
    row.getCell(10).numFmt = '0.00';

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Calibri', size: 9.5, color: { argb: 'FF0F172A' } };
      cell.border = THIN_BORDER;
    });

    grandWork += item.workHours;
    grandOt += item.otHours;
    grandTotal += item.totalHours;
    currentRow++;
  });

  // Totals Row
  const totalRow = ws.getRow(currentRow);
  totalRow.values = [
    `TOTAL (${data.items.length} Records)`,
    '',
    '',
    '',
    '',
    '',
    '',
    grandWork,
    grandOt,
    grandTotal,
    '',
  ];
  totalRow.height = 22;

  totalRow.eachCell({ includeEmpty: true }, (cell, idx) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF0F172A' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE2E8F0' },
    };
    cell.border = THIN_BORDER;
    if (idx >= 8 && idx <= 10) {
      cell.numFmt = '0.00';
      cell.alignment = { horizontal: 'right', vertical: 'middle' };
    }
  });

  applyFooter(ws, currentRow, 11);

  const filename = `${tenant.subdomain}-running-chart-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, filename);
}

/**
 * 6. Equipment ERP Upload Export (Matches User Image 2 exact Excel format)
 * Columns: Equipment | Condition | Unit | Date | Activity | Utilization
 */
export async function exportEquipmentErpToExcel(
  data: EquipmentErpUploadResponse,
  filename?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Equipment ERP Upload');

  ws.columns = [
    { header: 'Equipment', key: 'equipment', width: 16 },
    { header: 'Condition', key: 'condition', width: 14 },
    { header: 'Unit', key: 'unit', width: 10 },
    { header: 'Date', key: 'date', width: 14 },
    { header: 'Activity', key: 'activity', width: 16 },
    { header: 'Utilization', key: 'utilization', width: 14 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };
    cell.font = {
      bold: true,
      color: { argb: 'FF4C1D95' },
      size: 11,
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      left: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      bottom: { style: 'thin', color: { argb: 'FF9CA3AF' } },
      right: { style: 'thin', color: { argb: 'FF9CA3AF' } },
    };
  });

  data.rows.forEach((r) => {
    const row = ws.addRow({
      equipment: r.equipment,
      condition: r.condition,
      unit: r.unit,
      date: r.date,
      activity: r.activity,
      utilization: parseFloat(r.utilization) || 0,
    });
    row.height = 20;
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = '#,##0.00';

    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'dotted', color: { argb: 'FFD1D5DB' } },
        left: { style: 'dotted', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'dotted', color: { argb: 'FFD1D5DB' } },
        right: { style: 'dotted', color: { argb: 'FFD1D5DB' } },
      };
      cell.font = {
        color: { argb: 'FF312E81' },
      };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `Equipment_ERP_Upload_${data.date}.xlsx`;
  a.click();
  window.URL.revokeObjectURL(url);
}

/**
 * 7. Equipment Entry Sheet (Summary Report) Export (Matches User Image 1 format)
 * Includes Maga Letterhead, Document Metadata, Project Centre, Formatted Table, Totals, & Sign-off Block.
 */
export async function exportEquipmentSummaryToExcel(
  data: EquipmentSummaryResponse,
  tenant?: Tenant,
  preparedBy?: string,
  filters?: ReportFilters,
  filename?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Equipment Entry Sheet', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: {
        left: 0.3,
        right: 0.3,
        top: 0.4,
        bottom: 0.4,
        header: 0.2,
        footer: 0.2,
      },
    },
  });

  // Set Column Widths (9 columns total)
  ws.columns = [
    { width: 22 }, // Col 1 (A): Vehicle No. / Maga No.
    { width: 30 }, // Col 2 (B): Equipment
    { width: 20 }, // Col 3 (C): Business Partner
    { width: 12 }, // Col 4 (D): Condition
    { width: 10 }, // Col 5 (E): Unit
    { width: 18 }, // Col 6 (F): Minimum Utilization
    { width: 18 }, // Col 7 (G): Total Utilization
    { width: 16 }, // Col 8 (H): Total Mileage
    { width: 16 }, // Col 9 (I): Signature
  ];

  const companyName = data.companyName || tenant?.company_name || 'Mäga Engineering (Pvt) Ltd';
  const address = data.address || (tenant ? `${tenant.address_line1}, ${tenant.address_line2}` : '200, Nawala Road, Narahenpita, Colombo 05, Sri Lanka');
  const phone = data.phone || tenant?.phone || '2808835-44';
  const fax = data.fax || tenant?.fax || '2808846-48';
  const email = data.email || tenant?.email || 'maga@maga.lk';
  const periodDate = data.periodText || (filters?.dateFrom && filters?.dateTo ? `${filters.dateFrom} to ${filters.dateTo}` : data.date) || '';
  const sheetNumber = data.sheetNo || `EES-${(data.date || '').slice(0, 7)}`;
  const author = preparedBy || data.preparedBy || 'Site Supervisor / Plant Eng.';
  const projectCentre = data.projectCentre || 'Maga Central Project Operations';

  // ── Header Left: Company Letterhead (Rows 1-4, Cols A-E) ──
  ws.mergeCells('A1:E1');
  const cA1 = ws.getCell('A1');
  cA1.value = companyName;
  cA1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  cA1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A2:E2');
  const cA2 = ws.getCell('A2');
  cA2.value = address;
  cA2.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
  cA2.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A3:E3');
  const cA3 = ws.getCell('A3');
  cA3.value = `Tel : ${phone}    Fax : ${fax}`;
  cA3.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
  cA3.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A4:E4');
  const cA4 = ws.getCell('A4');
  cA4.value = `Email : ${email}`;
  cA4.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
  cA4.alignment = { horizontal: 'left', vertical: 'middle' };

  // Apply borders to Left Block (Rows 1-4, Cols 1-5)
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= 5; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: r === 1 ? { style: 'medium', color: { argb: 'FF64748B' } } : undefined,
        bottom: r === 4 ? { style: 'thin', color: { argb: 'FF94A3B8' } } : undefined,
        left: c === 1 ? { style: 'medium', color: { argb: 'FF64748B' } } : undefined,
        right: c === 5 ? { style: 'medium', color: { argb: 'FF64748B' } } : undefined,
      };
    }
  }

  // ── Header Right: Sheet Metadata (Rows 1-4, Cols F-I) ──
  // Row 1: Sheet Title Banner
  ws.mergeCells('F1:I1');
  const cTitle = ws.getCell('F1');
  cTitle.value = data.sheetTitle || 'EQUIPMENT ENTRY SHEET';
  cTitle.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  cTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  // Row 2: Date
  const cDateLbl = ws.getCell('F2');
  cDateLbl.value = 'Date';
  cDateLbl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  cDateLbl.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('G2:I2');
  const cDateVal = ws.getCell('G2');
  cDateVal.value = periodDate;
  cDateVal.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1D4ED8' } };
  cDateVal.alignment = { horizontal: 'center', vertical: 'middle' };
  cDateVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };

  // Row 3: Sheet No
  const cSheetLbl = ws.getCell('F3');
  cSheetLbl.value = 'Sheet No';
  cSheetLbl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  cSheetLbl.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('G3:I3');
  const cSheetVal = ws.getCell('G3');
  cSheetVal.value = sheetNumber;
  cSheetVal.font = { name: 'Calibri', size: 9, color: { argb: 'FF0F172A' } };
  cSheetVal.alignment = { horizontal: 'center', vertical: 'middle' };

  // Row 4: Prepared By
  const cPrepLbl = ws.getCell('F4');
  cPrepLbl.value = 'Prepared By';
  cPrepLbl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  cPrepLbl.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('G4:I4');
  const cPrepVal = ws.getCell('G4');
  cPrepVal.value = author;
  cPrepVal.font = { name: 'Calibri', size: 9, color: { argb: 'FF0F172A' } };
  cPrepVal.alignment = { horizontal: 'center', vertical: 'middle' };

  // Apply borders to Right Block (Rows 1-4, Cols 6-9)
  for (let r = 1; r <= 4; r++) {
    for (let c = 6; c <= 9; c++) {
      const cell = ws.getCell(r, c);
      cell.border = {
        top: r === 1 ? { style: 'medium', color: { argb: 'FF64748B' } } : { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: r === 4 ? { style: 'thin', color: { argb: 'FF94A3B8' } } : { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: c === 6 ? { style: 'medium', color: { argb: 'FF64748B' } } : (c === 7 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined),
        right: c === 9 ? { style: 'medium', color: { argb: 'FF64748B' } } : undefined,
      };
    }
  }

  // ── Row 5: Project / Activity Centre Banner ──
  ws.mergeCells('A5:C5');
  const cProjLbl = ws.getCell('A5');
  cProjLbl.value = 'PROJECT / ACTIVITY CENTRE:';
  cProjLbl.font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF1E293B' } };
  cProjLbl.alignment = { horizontal: 'left', vertical: 'middle' };
  cProjLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  ws.mergeCells('D5:I5');
  const cProjVal = ws.getCell('D5');
  cProjVal.value = projectCentre;
  cProjVal.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  cProjVal.alignment = { horizontal: 'left', vertical: 'middle' };
  cProjVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  for (let c = 1; c <= 9; c++) {
    const cell = ws.getCell(5, c);
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF64748B' } },
      left: c === 1 ? { style: 'medium', color: { argb: 'FF64748B' } } : (c === 4 ? { style: 'thin', color: { argb: 'FFCBD5E1' } } : undefined),
      right: c === 9 ? { style: 'medium', color: { argb: 'FF64748B' } } : undefined,
    };
  }

  ws.getRow(5).height = 22;
  ws.getRow(6).height = 8; // Spacer

  // ── Row 7: Table Header ──
  const headerTitles = [
    'Vehicle No. / Maga No.',
    'Equipment',
    'Business Partner',
    'Condition',
    'Unit',
    'Minimum Utilization',
    'Total Utilization',
    'Total Mileage',
    'Signature',
  ];

  const headerRow = ws.getRow(7);
  headerRow.height = 24;
  headerTitles.forEach((title, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = title;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF64748B' } },
      bottom: { style: 'medium', color: { argb: 'FF64748B' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  });

  // ── Rows 8+: Data Rows ──
  let currentRow = 8;
  let sumTotalUtilization = 0;
  let sumTotalMileage = 0;

  data.rows.forEach((r) => {
    const row = ws.getRow(currentRow);
    row.height = 20;

    const parsedUtil = parseFloat(r.totalUtilization);
    const parsedMileage = parseFloat(r.totalMileage);
    const parsedMin = parseFloat(r.minUtilization);

    if (!isNaN(parsedUtil)) sumTotalUtilization += parsedUtil;
    if (!isNaN(parsedMileage)) sumTotalMileage += parsedMileage;

    row.getCell(1).value = r.vehicleOrMagaNo;
    row.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(2).value = r.equipmentName || '—';
    row.getCell(2).font = { name: 'Calibri', size: 9.5, color: { argb: 'FF1E293B' } };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(3).value = r.businessPartner === '—' ? '-' : (r.businessPartner || '-');
    row.getCell(3).font = { name: 'Calibri', size: 9, color: { argb: 'FF475569' } };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(4).value = r.condition || 'DRY';
    row.getCell(4).font = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(5).value = r.unit || 'hrs';
    row.getCell(5).font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
    row.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(6).value = !isNaN(parsedMin) ? parsedMin : (r.minUtilization === '—' ? '-' : r.minUtilization);
    row.getCell(6).font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    if (!isNaN(parsedMin)) row.getCell(6).numFmt = '0.00';

    row.getCell(7).value = !isNaN(parsedUtil) ? parsedUtil : (r.totalUtilization === '—' ? '-' : r.totalUtilization);
    row.getCell(7).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
    if (!isNaN(parsedUtil)) row.getCell(7).numFmt = '0.00';

    row.getCell(8).value = !isNaN(parsedMileage) ? parsedMileage : (r.totalMileage === '—' ? '-' : r.totalMileage);
    row.getCell(8).font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
    if (!isNaN(parsedMileage)) row.getCell(8).numFmt = '0.00';

    row.getCell(9).value = ''; // Signature line placeholder
    row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };

    for (let c = 1; c <= 9; c++) {
      row.getCell(c).border = THIN_BORDER;
    }

    currentRow++;
  });

  // ── Summary Totals Row ──
  const totalRow = ws.getRow(currentRow);
  totalRow.height = 22;

  ws.mergeCells(`A${currentRow}:E${currentRow}`);
  const cTotLbl = ws.getCell(`A${currentRow}`);
  cTotLbl.value = `GRAND TOTAL (${data.rows.length} UNITS):`;
  cTotLbl.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
  cTotLbl.alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(6).value = '-';
  totalRow.getCell(6).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF64748B' } };
  totalRow.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };

  totalRow.getCell(7).value = sumTotalUtilization;
  totalRow.getCell(7).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E3A8A' } };
  totalRow.getCell(7).numFmt = '#,##0.00';
  totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(8).value = sumTotalMileage;
  totalRow.getCell(8).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };
  totalRow.getCell(8).numFmt = '#,##0.00';
  totalRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(9).value = '';

  for (let c = 1; c <= 9; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF64748B' } },
      bottom: { style: 'double', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }

  currentRow++;

  // ── Bottom Sign-off Block ──
  currentRow++; // Blank row spacer

  const signLineRow = ws.getRow(currentRow);
  signLineRow.height = 18;
  ws.mergeCells(`B${currentRow}:C${currentRow}`);
  ws.getCell(`B${currentRow}`).value = '____________________________________';
  ws.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'bottom' };

  ws.mergeCells(`E${currentRow}:F${currentRow}`);
  ws.getCell(`E${currentRow}`).value = '____________________________________';
  ws.getCell(`E${currentRow}`).alignment = { horizontal: 'center', vertical: 'bottom' };

  ws.mergeCells(`H${currentRow}:I${currentRow}`);
  ws.getCell(`H${currentRow}`).value = '____________________________________';
  ws.getCell(`H${currentRow}`).alignment = { horizontal: 'center', vertical: 'bottom' };

  currentRow++;

  const signTitleRow = ws.getRow(currentRow);
  signTitleRow.height = 18;
  ws.mergeCells(`B${currentRow}:C${currentRow}`);
  const cSign1 = ws.getCell(`B${currentRow}`);
  cSign1.value = 'PREPARED BY (PLANT IN-CHARGE)';
  cSign1.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF334155' } };
  cSign1.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`E${currentRow}:F${currentRow}`);
  const cSign2 = ws.getCell(`E${currentRow}`);
  cSign2.value = 'CHECKED BY (SITE ACCOUNTANT)';
  cSign2.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF334155' } };
  cSign2.alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`H${currentRow}:I${currentRow}`);
  const cSign3 = ws.getCell(`H${currentRow}`);
  cSign3.value = 'APPROVED BY (PROJECT MANAGER)';
  cSign3.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: 'FF334155' } };
  cSign3.alignment = { horizontal: 'center', vertical: 'middle' };

  currentRow++;

  const signDateRow = ws.getRow(currentRow);
  signDateRow.height = 16;
  ws.mergeCells(`B${currentRow}:C${currentRow}`);
  ws.getCell(`B${currentRow}`).value = 'Date: ________________________';
  ws.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 8, color: { argb: 'FF64748B' } };
  ws.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`E${currentRow}:F${currentRow}`);
  ws.getCell(`E${currentRow}`).value = 'Date: ________________________';
  ws.getCell(`E${currentRow}`).font = { name: 'Calibri', size: 8, color: { argb: 'FF64748B' } };
  ws.getCell(`E${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`H${currentRow}:I${currentRow}`);
  ws.getCell(`H${currentRow}`).value = 'Date: ________________________';
  ws.getCell(`H${currentRow}`).font = { name: 'Calibri', size: 8, color: { argb: 'FF64748B' } };
  ws.getCell(`H${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  // ── System Footer ──
  applyFooter(ws, currentRow + 1, 9);

  const cleanDateStr = (data.periodText || data.date || 'report').replace(/[^a-zA-Z0-9_-]/g, '_');
  const exportFilename = filename || `Equipment_Entry_Sheet_${cleanDateStr}.xlsx`;
  await downloadWorkbook(wb, exportFilename);
}

/**
 * 8. Monthly Time Card & Wage Summary Export
 */
export async function exportTimeCardToExcel(
  data: TimeCardResponse,
  tenant?: Tenant,
  preparedBy?: string,
  filename?: string
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Time Card Summary', {
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
    },
  });

  // Set Column Widths (11 columns)
  ws.columns = [
    { width: 14 }, // Col 1: Emp Code
    { width: 26 }, // Col 2: Full Name
    { width: 16 }, // Col 3: Calling Name
    { width: 18 }, // Col 4: Trade
    { width: 22 }, // Col 5: Business Partner
    { width: 14 }, // Col 6: Rate (LKR)
    { width: 10 }, // Col 7: Days
    { width: 12 }, // Col 8: OT Hours
    { width: 16 }, // Col 9: Gross Pay (LKR)
    { width: 16 }, // Col 10: Deductions (LKR)
    { width: 18 }, // Col 11: Net Payable (LKR)
  ];

  const companyName = tenant?.company_name || 'Mäga Engineering (Pvt) Ltd';
  const address = tenant ? `${tenant.address_line1}, ${tenant.address_line2}` : '200, Nawala Road, Narahenpita, Colombo 05, Sri Lanka';
  const phone = tenant?.phone || '+94 11 2808835';
  const fax = tenant?.fax || '+94 11 2808840';
  const email = tenant?.email || 'maga@maga.lk';
  const monthStr = data.monthLabel || data.month;
  const author = preparedBy || 'Site Accountant / Time Keeper';
  const siteStr = data.cards[0]?.siteName || 'Maga Central Project Operations';

  // ── Header Left: Company Letterhead ──
  ws.mergeCells('A1:F1');
  const cA1 = ws.getCell('A1');
  cA1.value = companyName;
  cA1.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF0F172A' } };
  cA1.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A2:F2');
  const cA2 = ws.getCell('A2');
  cA2.value = address;
  cA2.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
  cA2.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A3:F3');
  const cA3 = ws.getCell('A3');
  cA3.value = `Tel : ${phone}    Fax : ${fax}`;
  cA3.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
  cA3.alignment = { horizontal: 'left', vertical: 'middle' };

  ws.mergeCells('A4:F4');
  const cA4 = ws.getCell('A4');
  cA4.value = `Email : ${email}`;
  cA4.font = { name: 'Calibri', size: 9, color: { argb: 'FF334155' } };
  cA4.alignment = { horizontal: 'left', vertical: 'middle' };

  // ── Header Right: Metadata ──
  ws.mergeCells('G1:K1');
  const cTitle = ws.getCell('G1');
  cTitle.value = 'MONTHLY TIME CARD & WAGE SUMMARY';
  cTitle.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF0F172A' } };
  cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  cTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };

  const cDateLbl = ws.getCell('G2');
  cDateLbl.value = 'Month';
  cDateLbl.font = { name: 'Calibri', size: 9, bold: true };
  cDateLbl.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('H2:K2');
  const cDateVal = ws.getCell('H2');
  cDateVal.value = monthStr;
  cDateVal.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF1D4ED8' } };
  cDateVal.alignment = { horizontal: 'center', vertical: 'middle' };

  const cPrepLbl = ws.getCell('G3');
  cPrepLbl.value = 'Prepared By';
  cPrepLbl.font = { name: 'Calibri', size: 9, bold: true };
  cPrepLbl.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('H3:K3');
  const cPrepVal = ws.getCell('H3');
  cPrepVal.value = author;
  cPrepVal.font = { name: 'Calibri', size: 9 };
  cPrepVal.alignment = { horizontal: 'center', vertical: 'middle' };

  const cCountLbl = ws.getCell('G4');
  cCountLbl.value = 'Total Workers';
  cCountLbl.font = { name: 'Calibri', size: 9, bold: true };
  cCountLbl.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.mergeCells('H4:K4');
  const cCountVal = ws.getCell('H4');
  cCountVal.value = `${data.cards.length} Active Records`;
  cCountVal.font = { name: 'Calibri', size: 9, bold: true };
  cCountVal.alignment = { horizontal: 'center', vertical: 'middle' };

  // ── Row 5: Project / Site Banner ──
  ws.mergeCells('A5:C5');
  const cSiteLbl = ws.getCell('A5');
  cSiteLbl.value = 'PROJECT / SITE:';
  cSiteLbl.font = { name: 'Calibri', size: 9, bold: true };
  cSiteLbl.alignment = { horizontal: 'left', vertical: 'middle' };
  cSiteLbl.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  ws.mergeCells('D5:K5');
  const cSiteVal = ws.getCell('D5');
  cSiteVal.value = siteStr;
  cSiteVal.font = { name: 'Calibri', size: 9.5, bold: true };
  cSiteVal.alignment = { horizontal: 'left', vertical: 'middle' };
  cSiteVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };

  ws.getRow(5).height = 20;
  ws.getRow(6).height = 8; // Spacer

  // ── Row 7: Table Headers ──
  const headers = [
    'Emp Code',
    'Full Name',
    'Calling Name',
    'Trade / Designation',
    'Contractor / Partner',
    'Daily Rate (LKR)',
    'Days',
    'OT Hours',
    'Gross Pay (LKR)',
    'Deductions (LKR)',
    'Net Payable (LKR)',
  ];

  const headerRow = ws.getRow(7);
  headerRow.height = 24;
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = THIN_BORDER;
  });

  // ── Rows 8+: Data Rows ──
  let currentRow = 8;
  let sumDays = 0;
  let sumOt = 0;
  let sumGross = 0;
  let sumDeductions = 0;
  let sumNet = 0;

  data.cards.forEach((c) => {
    const row = ws.getRow(currentRow);
    row.height = 20;

    sumDays += c.totals.totalDays || 0;
    sumOt += c.totals.totalOtHours || 0;
    sumGross += c.totals.grossPay || 0;
    sumDeductions += c.totals.deductions?.total || 0;
    sumNet += c.totals.netPay || 0;

    row.getCell(1).value = c.employeeCode;
    row.getCell(1).font = { name: 'Calibri', size: 9.5, bold: true };
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

    row.getCell(2).value = c.fullName;
    row.getCell(2).font = { name: 'Calibri', size: 9.5 };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(3).value = c.callingName;
    row.getCell(3).font = { name: 'Calibri', size: 9 };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(4).value = c.trade;
    row.getCell(4).font = { name: 'Calibri', size: 9 };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(5).value = c.businessPartner;
    row.getCell(5).font = { name: 'Calibri', size: 9 };
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };

    row.getCell(6).value = c.dailyRate;
    row.getCell(6).numFmt = '#,##0.00';
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(7).value = c.totals.totalDays;
    row.getCell(7).numFmt = '0.0';
    row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(8).value = c.totals.totalOtHours;
    row.getCell(8).numFmt = '0.0';
    row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(9).value = c.totals.grossPay;
    row.getCell(9).numFmt = '#,##0.00';
    row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(10).value = c.totals.deductions?.total || 0;
    row.getCell(10).numFmt = '#,##0.00';
    row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };

    row.getCell(11).value = c.totals.netPay;
    row.getCell(11).numFmt = '#,##0.00';
    row.getCell(11).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FF065F46' } };
    row.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };

    for (let col = 1; col <= 11; col++) {
      row.getCell(col).border = THIN_BORDER;
    }
    currentRow++;
  });

  // ── Summary Totals Row ──
  const totalRow = ws.getRow(currentRow);
  totalRow.height = 22;

  ws.mergeCells(`A${currentRow}:F${currentRow}`);
  const cTotLbl = ws.getCell(`A${currentRow}`);
  cTotLbl.value = `GRAND TOTAL (${data.cards.length} WORKERS):`;
  cTotLbl.font = { name: 'Calibri', size: 9.5, bold: true };
  cTotLbl.alignment = { horizontal: 'right', vertical: 'middle' };

  totalRow.getCell(7).value = sumDays;
  totalRow.getCell(7).numFmt = '0.0';
  totalRow.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(7).font = { name: 'Calibri', size: 9.5, bold: true };

  totalRow.getCell(8).value = sumOt;
  totalRow.getCell(8).numFmt = '0.0';
  totalRow.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(8).font = { name: 'Calibri', size: 9.5, bold: true };

  totalRow.getCell(9).value = sumGross;
  totalRow.getCell(9).numFmt = '#,##0.00';
  totalRow.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(9).font = { name: 'Calibri', size: 9.5, bold: true };

  totalRow.getCell(10).value = sumDeductions;
  totalRow.getCell(10).numFmt = '#,##0.00';
  totalRow.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(10).font = { name: 'Calibri', size: 9.5, bold: true };

  totalRow.getCell(11).value = sumNet;
  totalRow.getCell(11).numFmt = '#,##0.00';
  totalRow.getCell(11).alignment = { horizontal: 'right', vertical: 'middle' };
  totalRow.getCell(11).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF065F46' } };

  for (let col = 1; col <= 11; col++) {
    const cell = totalRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF64748B' } },
      bottom: { style: 'double', color: { argb: 'FF475569' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } },
    };
  }

  currentRow += 2;

  // ── Sign-off Block ──
  const signLineRow = ws.getRow(currentRow);
  signLineRow.height = 18;
  ws.mergeCells(`B${currentRow}:D${currentRow}`);
  ws.getCell(`B${currentRow}`).value = '____________________________________';
  ws.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'bottom' };

  ws.mergeCells(`F${currentRow}:G${currentRow}`);
  ws.getCell(`F${currentRow}`).value = '____________________________________';
  ws.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'bottom' };

  ws.mergeCells(`I${currentRow}:K${currentRow}`);
  ws.getCell(`I${currentRow}`).value = '____________________________________';
  ws.getCell(`I${currentRow}`).alignment = { horizontal: 'center', vertical: 'bottom' };

  currentRow++;
  const signTitleRow = ws.getRow(currentRow);
  signTitleRow.height = 18;
  ws.mergeCells(`B${currentRow}:D${currentRow}`);
  ws.getCell(`B${currentRow}`).value = 'PREPARED BY (TIME KEEPER / DPA)';
  ws.getCell(`B${currentRow}`).font = { name: 'Calibri', size: 8.5, bold: true };
  ws.getCell(`B${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`F${currentRow}:G${currentRow}`);
  ws.getCell(`F${currentRow}`).value = 'CHECKED BY (SITE ACCOUNTANT)';
  ws.getCell(`F${currentRow}`).font = { name: 'Calibri', size: 8.5, bold: true };
  ws.getCell(`F${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  ws.mergeCells(`I${currentRow}:K${currentRow}`);
  ws.getCell(`I${currentRow}`).value = 'APPROVED BY (PROJECT MANAGER / AGM)';
  ws.getCell(`I${currentRow}`).font = { name: 'Calibri', size: 8.5, bold: true };
  ws.getCell(`I${currentRow}`).alignment = { horizontal: 'center', vertical: 'middle' };

  applyFooter(ws, currentRow + 1, 11);

  const exportFilename = filename || `Time_Card_Summary_${data.month || 'report'}.xlsx`;
  await downloadWorkbook(wb, exportFilename);
}


