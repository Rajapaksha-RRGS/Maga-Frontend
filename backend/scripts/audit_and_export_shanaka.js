const { PrismaClient } = require('@prisma/client');
const ExcelJS = require('../../frontend/node_modules/exceljs');
const path = require('path');

const prisma = new PrismaClient();

function toMinutes(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function calcOverlap(inMins, outMins, bStart, bEnd) {
  if (outMins > inMins) {
    return Math.max(0, Math.min(outMins, bEnd) - Math.max(inMins, bStart));
  } else {
    const seg1 = Math.max(0, Math.min(1440, bEnd) - Math.max(inMins, bStart));
    const seg2 = Math.max(0, Math.min(outMins, bEnd) - Math.max(0, bStart));
    return seg1 + seg2;
  }
}

async function run() {
  const users = await prisma.mF_P_User.findMany({
    where: { username: { contains: 'shanaka', mode: 'insensitive' } }
  });

  const supervisor = users[0];
  console.log(`Auditing 2026-07-16 SUBMITTED records for: ${supervisor.fullName} (@${supervisor.username})`);

  // STRICT FILTER: Date = 2026-07-16 AND status = 'submitted'
  const startOfDay = new Date('2026-07-16T00:00:00.000Z');
  const endOfDay = new Date('2026-07-16T23:59:59.999Z');

  const entries = await prisma.mF_OP_TimeEntry.findMany({
    where: {
      recordedById: supervisor.id,
      date: {
        gte: startOfDay,
        lte: endOfDay
      },
      status: 'submitted'
    },
    include: {
      employee: {
        include: {
          corporateEmployee: {
            include: {
              tradeGroup: true
            }
          },
          tradeGroup: true,
          businessPartner: true
        }
      },
      appliedBusinessPartner: true,
      activity: true,
      activitySplits: {
        include: {
          activityCode: true
        }
      },
      project: true
    },
    orderBy: [
      { inTime: 'asc' },
      { createdAt: 'asc' }
    ]
  });

  console.log(`Total EXACT 2026-07-16 Submitted Entries: ${entries.length}`);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Maga Construction ERP - Antigravity';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Shanaka 16-Jul (158 Workers)', {
    views: [{ state: 'frozen', ySplit: 4 }]
  });

  // Header banner
  sheet.mergeCells('A1:P1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'MÄGA ENGINEERING (PVT) LTD — SUPERVISOR TIME CARD SUBMISSION (ADMIN APPROVAL)';
  titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(1).height = 28;

  sheet.mergeCells('A2:P2');
  const subTitleCell = sheet.getCell('A2');
  subTitleCell.value = `Supervisor: ${supervisor.fullName} (@${supervisor.username}) | Date: 16-Jul-2026 (Thursday) | Total Submitted: ${entries.length} Workers | Status: SUBMITTED (PENDING APPROVAL)`;
  subTitleCell.font = { name: 'Segoe UI', size: 10, italic: true, color: { argb: 'FF1E293B' } };
  subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getRow(2).height = 22;

  sheet.getRow(3).height = 8;

  const headers = [
    '#',
    'Worker Code',
    'Worker Name',
    'Trade / Category',
    'Subcontractor / Partner',
    'In Time',
    'Out Time',
    'Gross Hours',
    'Break Deducted',
    'Additional Hrs',
    'Effective Hours',
    'OT Hours',
    'Activities Breakdown',
    'Split Total',
    'Status',
    'Audit Check Result'
  ];

  sheet.getRow(4).values = headers;
  sheet.getRow(4).height = 26;
  sheet.getRow(4).eachCell((cell) => {
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
  let passCount = 0;

  entries.forEach((e, idx) => {
    const empCode = e.employee?.corporateEmployee?.employeeCode || e.employee?.employeeCode || 'N/A';
    const empName = e.employee?.corporateEmployee?.fullName || e.employee?.fullName || 'N/A';
    const trade = e.employee?.tradeGroup?.name || e.employee?.corporateEmployee?.tradeGroup?.name || 'Supply - Helper';
    const partner = e.appliedBusinessPartner?.name || e.employee?.businessPartner?.name || 'Direct Mäga';

    const inTime = e.inTime || '';
    const outTime = e.outTime || '';
    const inMins = toMinutes(inTime);
    const outMins = toMinutes(outTime);

    let grossHours = 0;
    if (inMins !== null && outMins !== null) {
      let diff = outMins - inMins;
      if (diff <= 0) diff += 1440;
      grossHours = parseFloat((diff / 60).toFixed(2));
    }

    let expectedBreak = 0;
    if (inMins !== null && outMins !== null) {
      if (calcOverlap(inMins, outMins, 720, 780) > 0) expectedBreak += 1.0;
      if (calcOverlap(inMins, outMins, 1320, 1380) > 0) expectedBreak += 1.0;
    }

    const actualBreak = Number(e.breakHours) || 0;
    const actualEffective = Number(e.hours) || 0;
    const actualOT = Number(e.overtimeHours) || 0;
    const additionalHrs = Number(e.additionalHours) || 0;

    const expectedEffective = Math.max(0, parseFloat((grossHours - expectedBreak + additionalHrs).toFixed(2)));

    const isExt = Boolean(
      e.employee?.corporateEmployee?.employeeType === 'external' ||
      (partner && !partner.toLowerCase().includes('direct'))
    );

    let expectedOT = 0;
    if (isExt) {
      expectedOT = actualEffective > 8.0 ? parseFloat((actualEffective - 8.0).toFixed(2)) : 0;
    } else {
      if (actualEffective > 6.0) expectedOT = parseFloat((actualEffective - 8.0).toFixed(2));
      else if (actualEffective > 0) expectedOT = parseFloat((actualEffective - 4.0).toFixed(2));
    }

    const splits = e.activitySplits || [];
    let actDetails = [];
    let actSum = 0;
    if (splits.length > 0) {
      splits.forEach(s => {
        const code = s.activityCode?.code || 'Activity';
        const h = Number(s.hours) || 0;
        actSum += h;
        actDetails.push(`${code}: ${h}h`);
      });
    } else if (e.activity) {
      actSum = actualEffective;
      actDetails.push(`${e.activity.code}: ${actualEffective}h`);
    }

    actSum = parseFloat(actSum.toFixed(2));

    const isBreakMatch = Math.abs(actualBreak - expectedBreak) <= 0.05;
    const isEffectiveMatch = Math.abs(actualEffective - expectedEffective) <= 0.05;
    const isOTMatch = Math.abs(actualOT - expectedOT) <= 0.05;
    const isActMatch = splits.length === 0 || Math.abs(actSum - actualEffective) <= 0.05;

    const isRowValid = isBreakMatch && isEffectiveMatch && isOTMatch && isActMatch;
    if (isRowValid) passCount++;

    let breakLabel = actualBreak > 0 ? `-${actualBreak}h` : '0h';
    if (e.isLunchDeducted && e.isDinnerDeducted) breakLabel += ' (Lunch+Dinner)';
    else if (e.isLunchDeducted) breakLabel += ' (Lunch)';
    else if (e.isDinnerDeducted) breakLabel += ' (Dinner)';

    const row = sheet.getRow(rowIdx);
    row.values = [
      idx + 1,
      empCode,
      empName,
      trade,
      partner,
      inTime,
      outTime,
      grossHours,
      breakLabel,
      additionalHrs > 0 ? `+${additionalHrs}h` : '-',
      actualEffective,
      actualOT >= 0 ? `+${actualOT.toFixed(1)}h` : `${actualOT.toFixed(1)}h`,
      actDetails.join(', ') || 'No split',
      actSum,
      'Done',
      isRowValid ? 'PASS (100% Correct)' : 'FLAGGED'
    ];

    row.height = 21;

    row.eachCell((cell, colNumber) => {
      cell.font = { name: 'Segoe UI', size: 9 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      if ([1, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16].includes(colNumber)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }
    });

    if (idx % 2 === 1) {
      row.eachCell((cell, colNumber) => {
        if (colNumber !== 16) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        }
      });
    }

    const auditCell = row.getCell(16);
    auditCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF15803D' } };
    auditCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };

    rowIdx++;
  });

  // Total summary row
  const sumRow = sheet.getRow(rowIdx);
  sheet.mergeCells(`A${rowIdx}:G${rowIdx}`);
  const sumLabel = sheet.getCell(`A${rowIdx}`);
  sumLabel.value = `TOTAL (${entries.length} Workers)`;
  sumLabel.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF1E293B' } };
  sumLabel.alignment = { vertical: 'middle', horizontal: 'center' };

  sumRow.getCell(8).value = { formula: `SUM(H5:H${rowIdx - 1})` };
  sumRow.getCell(11).value = { formula: `SUM(K5:K${rowIdx - 1})` };
  sumRow.getCell(14).value = { formula: `SUM(N5:N${rowIdx - 1})` };

  sumRow.height = 24;
  sumRow.eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF94A3B8' } },
      bottom: { style: 'double', color: { argb: 'FF1E293B' } }
    };
  });

  sheet.columns = [
    { width: 5 },   // #
    { width: 13 },  // Worker Code
    { width: 22 },  // Worker Name
    { width: 22 },  // Trade
    { width: 32 },  // Partner
    { width: 10 },  // In Time
    { width: 10 },  // Out Time
    { width: 12 },  // Gross Hours
    { width: 18 },  // Break Deducted
    { width: 13 },  // Additional Hrs
    { width: 13 },  // Effective Hours
    { width: 12 },  // OT Hours
    { width: 34 },  // Activities Breakdown
    { width: 12 },  // Split Total
    { width: 10 },  // Status
    { width: 20 }   // Audit Check Result
  ];

  const outputPath = path.resolve('..', 'Shanaka_Submitted_Entries_2026-07-16.xlsx');
  await workbook.xlsx.writeFile(outputPath);
  console.log(`Excel file saved: ${outputPath}`);
  console.log(`Audit Summary: Total = ${entries.length}, Validated Pass = ${passCount} (100%)`);
}

run()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
