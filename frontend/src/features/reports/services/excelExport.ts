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
    'Employee Name',
    'Trade Group',
    'Business Partner',
    'Total Days',
    'Normal Hours',
    'OT Hours',
    'Total Hours',
    'Signature', // Blank signature column
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
    { width: 26 }, // Employee Name
    { width: 18 }, // Trade Group
    { width: 24 }, // Business Partner
    { width: 14 }, // Total Days
    { width: 14 }, // Normal Hours
    { width: 14 }, // OT Hours
    { width: 15 }, // Total Hours
    { width: 20 }, // Signature (blank)
  ];

  // Data rows start at Row 10
  let currentRow = 10;
  data.items.forEach((item) => {
    const row = ws.getRow(currentRow);
    row.values = [
      item.employeeName,
      item.tradeGroup,
      item.businessPartner,
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
    if (colNumber >= 5 && colNumber <= 7) cell.numFmt = '0.00';
  });

  // Footer
  applyFooter(ws, currentRow, 8);

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
    daysSub.value = 'Days';
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
  totDaysSub.value = 'Days';
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
      const entry = item.dailyEntries[d] || { days: 0, otHours: 0 };
      rowValues.push(entry.days, entry.otHours);
    });

    rowValues.push(item.totalDays, item.totalOtHours);

    const row = ws.getRow(currentRow);
    row.values = rowValues;

    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle' };

    let c = 4;
    dates.forEach(() => {
      row.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      row.getCell(c).numFmt = '0';
      row.getCell(c + 1).alignment = { horizontal: 'right', vertical: 'middle' };
      row.getCell(c + 1).numFmt = '0.00';
      c += 2;
    });
    row.getCell(c).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(c).numFmt = '0';
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
    const dt = data.totals.dateTotals[d] || { days: 0, otHours: 0 };
    totalValues.push(dt.days, dt.otHours);
  });
  totalValues.push(data.totals.totalDays, data.totals.totalOtHours);
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
      cell.numFmt = idx % 2 === 0 ? '0' : '0.00';
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
  preparedBy: string,
  filters: ReportFilters
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Labour Entry System';
  const ws = workbook.addWorksheet('ERP Upload Export');

  // Letterhead
  applyLetterhead(ws, 'ERP UPLOAD EXPORT', tenant, preparedBy, filters);

  const headers = [
    'Employee Name',
    'Date',
    'Activity Code',
    'Activity Description',
    'Hours',
    'Overtime Hours',
    'Remarks',
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
    { width: 24 }, // Employee Name
    { width: 14 }, // Date
    { width: 16 }, // Activity Code
    { width: 26 }, // Activity Description
    { width: 12 }, // Hours
    { width: 16 }, // Overtime Hours
    { width: 35 }, // Remarks
  ];

  let currentRow = 10;
  data.rows.forEach((rowItem) => {
    const row = ws.getRow(currentRow);
    row.values = [
      rowItem.employeeName,
      rowItem.date,
      rowItem.activityCode,
      rowItem.activityDescription,
      rowItem.hours,
      rowItem.overtimeHours,
      rowItem.remarks,
    ];

    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(3).alignment = { horizontal: 'center', vertical: 'middle' };
    row.getCell(4).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(5).numFmt = '0.00';
    row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
    row.getCell(6).numFmt = '0.00';
    row.getCell(7).alignment = { horizontal: 'left', vertical: 'middle' };

    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.font = { name: 'Calibri', size: 9, color: { argb: 'FF1E293B' } };
      cell.border = THIN_BORDER;
    });

    currentRow++;
  });

  // Totals Row
  const totalRow = ws.getRow(currentRow);
  totalRow.values = [
    `TOTAL (${data.rowCount} Rows)`,
    '',
    '',
    '',
    data.totalHours,
    data.totalOtHours,
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
    if (idx === 5 || idx === 6) cell.numFmt = '0.00';
  });

  // Footer
  applyFooter(ws, currentRow, 7);

  const filename = `${tenant.subdomain}-erp-upload-${new Date().toISOString().slice(0, 10)}.xlsx`;
  await downloadWorkbook(workbook, filename);
}
