import ExcelJS from 'exceljs';
import type { ConsolidatedWorkerItem } from '../components/ConsolidatedApprovalView';

function formatHoursDisplay(num?: number | null): string {
  if (num === undefined || num === null || isNaN(Number(num))) return '0.0h';
  const val = Number(num);
  return `${val.toFixed(1)}h`;
}

export async function exportConsolidatedLaborToExcel(
  workers: ConsolidatedWorkerItem[],
  selectedDate: string,
  supervisorTitle: string = 'All Supervisors'
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Maga Construction ERP';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Labor Entries', {
    views: [{ state: 'frozen', ySplit: 4 }]
  });

  // Title Banner
  sheet.mergeCells('A1:O1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'MÄGA ENGINEERING (PVT) LTD — CONSOLIDATED LABOR TIME CARD REPORT';
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 30;

  sheet.mergeCells('A2:O2');
  const subTitleCell = sheet.getCell('A2');
  subTitleCell.value = `Date: ${selectedDate} | Supervisor: ${supervisorTitle} | Total Records: ${workers.length} | Exported: ${new Date().toLocaleString()}`;
  subTitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF1E293B' } };
  subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 22;

  sheet.getRow(3).height = 8;

  // Header Row
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
    'Status'
  ];

  const headerRow = sheet.getRow(4);
  headerRow.values = headers;
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'medium', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF94A3B8' } },
      right: { style: 'thin', color: { argb: 'FF94A3B8' } }
    };
  });

  let rowIdx = 5;
  workers.forEach((w, idx) => {
    let grossHours = w.totalHours || 0;
    if (!grossHours && w.inTime && w.outTime) {
      const [inH, inM] = w.inTime.split(':').map(Number);
      const [outH, outM] = w.outTime.split(':').map(Number);
      if (!isNaN(inH) && !isNaN(outH)) {
        let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
        if (diff <= 0) diff += 1440;
        grossHours = parseFloat((diff / 60).toFixed(2));
      }
    }

    let breakLabel = (w.breakHours ?? 0) > 0 ? `-${w.breakHours}h` : '0h';
    if (w.isLunchDeducted && w.isDinnerDeducted) breakLabel += ' (Lunch+Dinner)';
    else if (w.isLunchDeducted) breakLabel += ' (Lunch)';
    else if (w.isDinnerDeducted) breakLabel += ' (Dinner)';

    const effectiveVal = w.effectiveHours ?? w.shiftHours ?? ((w.hours ?? 0) + (w.otHours ?? 0));
    const otVal = w.otHours ?? 0;

    const acts = (w.activities || [])
      .map(a => `${a.code}: ${formatHoursDisplay(a.hours)}`)
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
      w.status === 'approved' ? 'Approved' : (w.inTime && w.outTime ? 'Done' : 'Missing')
    ];

    row.height = 22;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if ([1, 7, 8, 9, 10, 11, 12, 13, 15].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    if (idx % 2 === 1) {
      row.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }

    rowIdx++;
  });

  // Summary Row
  if (workers.length > 0) {
    const sumRow = sheet.getRow(rowIdx);
    sheet.mergeCells(`A${rowIdx}:J${rowIdx}`);
    const sumLabel = sheet.getCell(`A${rowIdx}`);
    sumLabel.value = `TOTAL (${workers.length} Workers)`;
    sumLabel.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    sumLabel.alignment = { vertical: 'middle', horizontal: 'center' };

    sumRow.getCell(11).value = { formula: `SUM(K5:K${rowIdx - 1})` };
    sumRow.getCell(12).value = { formula: `SUM(L5:L${rowIdx - 1})` };

    sumRow.height = 24;
    sumRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF94A3B8' } },
        bottom: { style: 'double', color: { argb: 'FF1E293B' } }
      };
    });
  }

  // Column widths
  sheet.columns = [
    { width: 5 },   // #
    { width: 22 },  // Supervisor
    { width: 14 },  // Worker Code
    { width: 22 },  // Worker Name
    { width: 22 },  // Trade
    { width: 30 },  // Partner
    { width: 10 },  // In Time
    { width: 10 },  // Out Time
    { width: 18 },  // Break
    { width: 14 },  // Add Hrs
    { width: 13 },  // Total Hours
    { width: 14 },  // Effective Hours
    { width: 12 },  // OT Hours
    { width: 36 },  // Activities
    { width: 12 }   // Status
  ];

  // Browser download trigger
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const cleanTitle = supervisorTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
  a.download = `Labor_Entries_${cleanTitle}_${selectedDate}.xlsx`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

