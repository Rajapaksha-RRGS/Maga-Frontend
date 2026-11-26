import type {
  BpBillEmployeeItem,
  BpBillGroup,
  SubcontractorDeductionGroup,
} from '../services/reportService';
import magaLogo from '../../../assets/maga-logo-47321F1221-seeklogo.com.png';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtLkr(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getLogoUrl(): string {
  return magaLogo.startsWith('data:')
    ? magaLogo
    : new URL(magaLogo, window.location.origin).href;
}

function resolvePeriodText(
  dateStrings: string[],
  dateFrom?: string | null,
  dateTo?: string | null
): string {
  const sorted = [...dateStrings].sort();
  const resolvedFrom = dateFrom || sorted[0] || null;
  const resolvedTo = dateTo || sorted[sorted.length - 1] || null;
  if (resolvedFrom && resolvedTo) {
    return resolvedFrom === resolvedTo ? resolvedFrom : `${resolvedFrom} to ${resolvedTo}`;
  }
  return resolvedFrom || resolvedTo || 'All Dates';
}

interface PrintShellOptions {
  docTitle: string;
  billHeading: string;
  accentColor: string;
  summaryBg: string;
  summaryColor: string;
  projectName: string;
  projectCode: string;
  periodText: string;
  partnerLabel: string;
  partnerName: string;
  summaryLine: string;
  tableHtml: string;
  summaryRowsHtml: string;
  preparedBy?: string;
}

function openPrintDocument(opts: PrintShellOptions): void {
  const win = window.open('', '_blank', 'width=1024,height=780');
  if (!win) {
    alert('Please allow pop-ups in your browser to print or save as PDF.');
    return;
  }

  const logoUrl = getLogoUrl();
  const generatedDate = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(opts.docTitle)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 16px;
      background: #f8fafc;
      font-size: 11px;
      line-height: 1.4;
    }
    .toolbar { max-width: 900px; margin: 0 auto 12px auto; display: flex; justify-content: flex-end; gap: 8px; }
    .btn {
      padding: 8px 16px; border-radius: 6px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: 1px solid #cbd5e1; background: #fff; color: #1e293b;
    }
    .btn-primary { background: ${opts.accentColor}; border-color: ${opts.accentColor}; color: #fff; }
    .sheet { max-width: 900px; margin: 0 auto; background: #fff; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; }
    .header {
      display: flex; justify-content: space-between; align-items: flex-start;
      border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 16px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand-logo { height: 44px; width: auto; object-fit: contain; }
    .company { font-size: 18px; font-weight: 800; letter-spacing: 0.3px; color: #0f172a; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 2px; }
    .bill-title { text-align: right; }
    .bill-title h1 {
      margin: 0; font-size: 15px; font-weight: 800; color: ${opts.accentColor};
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .bill-title .meta { font-size: 10.5px; color: #475569; margin-top: 3px; }
    .info-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;
      padding: 10px 14px; margin-bottom: 16px;
    }
    .info-label { font-size: 9.5px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .info-value { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th {
      background: #f1f5f9; color: #334155; font-size: 9.5px; text-transform: uppercase;
      letter-spacing: 0.4px; padding: 7px 6px; border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1; text-align: left;
    }
    td { padding: 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
    .num { text-align: right; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .bold { font-weight: 700; }
    .emp-name { font-weight: 600; color: #0f172a; }
    .sub-text { font-size: 9.5px; color: #64748b; margin-top: 1px; }
    .hold-tag {
      display: inline-block; margin-top: 2px; font-size: 9px; font-weight: 700;
      color: #b45309; background: #fef3c7; padding: 1px 4px; border-radius: 3px;
    }
    tfoot td {
      background: #f8fafc; border-top: 2px solid #0f172a; border-bottom: 2px solid #0f172a;
      font-weight: 700; padding: 8px 6px;
    }
    .summary-box { display: flex; justify-content: flex-end; margin-bottom: 28px; }
    .summary-card { width: 300px; border: 1px solid #cbd5e1; border-radius: 6px; overflow: hidden; }
    .summary-row { display: flex; justify-content: space-between; padding: 6px 12px; border-bottom: 1px solid #e2e8f0; font-size: 11px; }
    .summary-row.total { background: ${opts.summaryBg}; color: ${opts.summaryColor}; font-weight: 800; font-size: 13px; border-bottom: none; }
    .signatures { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 36px; padding-top: 8px; break-inside: avoid; }
    .sig-box { border-top: 1px dashed #64748b; padding-top: 6px; text-align: center; font-size: 10px; color: #475569; font-weight: 600; }
    @media print {
      body { background: #fff; padding: 0; }
      .toolbar { display: none !important; }
      .sheet { border: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="btn" onclick="window.close()">Close</button>
    <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
  </div>
  <div class="sheet">
    <div class="header">
      <div class="brand">
        <img src="${escapeHtml(logoUrl)}" alt="Maga Engineering Logo" class="brand-logo" />
        <div>
          <div class="company">MAGA ENGINEERING (PVT) LTD</div>
          <div class="subtitle">${escapeHtml(opts.projectCode ? `${opts.projectCode} — ${opts.projectName}` : opts.projectName)}</div>
        </div>
      </div>
      <div class="bill-title">
        <h1>${escapeHtml(opts.billHeading)}</h1>
        <div class="meta">Billing Period: <strong>${escapeHtml(opts.periodText)}</strong></div>
        <div class="meta">Printed: ${escapeHtml(generatedDate)}</div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="info-label">${escapeHtml(opts.partnerLabel)}</div>
        <div class="info-value">${escapeHtml(opts.partnerName)}</div>
      </div>
      <div>
        <div class="info-label">Summary</div>
        <div class="info-value">${escapeHtml(opts.summaryLine)}</div>
      </div>
    </div>

    ${opts.tableHtml}

    <div class="summary-box">
      <div class="summary-card">
        ${opts.summaryRowsHtml}
      </div>
    </div>

    <div class="signatures">
      <div class="sig-box">Prepared By${opts.preparedBy ? `<br/>(${escapeHtml(opts.preparedBy)})` : ''}</div>
      <div class="sig-box">Checked By (QS / Site Eng)</div>
      <div class="sig-box">Approved By (Project Mgr)</div>
      <div class="sig-box">Contractor Signature</div>
    </div>
  </div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();
}

export interface PrintBpBillOptions {
  group: BpBillGroup;
  items: BpBillEmployeeItem[];
  dates?: string[];
  dateFrom?: string | null;
  dateTo?: string | null;
  projectName?: string;
  projectCode?: string;
  preparedBy?: string;
}

/**
 * Opens a clean A4 printable bill window for a single Business Partner
 * so the user can print directly or choose "Save as PDF".
 */
export function printBpBill({
  group,
  items,
  dates = [],
  dateFrom,
  dateTo,
  projectName = 'Maga Engineering Project',
  projectCode = '',
  preparedBy = '',
}: PrintBpBillOptions): void {
  const totalHours = items.reduce((s, i) => s + Number(i.totalHours || 0), 0);
  const totalPayment = items.reduce((s, i) => s + Number(i.totalHourlyPayment || 0), 0);
  const totalOverhead = items.reduce((s, i) => s + Number(i.overhead || 0), 0);
  const totalCost = items.reduce((s, i) => s + Number(i.totalCost || 0), 0);

  const itemDates = Array.from(
    new Set(
      items.flatMap((i) =>
        Object.entries(i.dailyHours || {})
          .filter(([, hrs]) => Number(hrs) > 0)
          .map(([d]) => d)
      )
    )
  );
  const periodText = resolvePeriodText(itemDates.length > 0 ? itemDates : dates, dateFrom, dateTo);

  const rowsHtml = items
    .map(
      (item, idx) => `
      <tr>
        <td class="num">${idx + 1}</td>
        <td class="mono">${escapeHtml(item.employeeCode || '-')}</td>
        <td>
          <div class="emp-name">${escapeHtml(item.employeeName)}</div>
          ${item.payrollStatus === 'HOLD_PENDING_HO_APPROVAL' ? '<div class="hold-tag">HOLD: Pending HO Approval</div>' : ''}
        </td>
        <td>${escapeHtml(item.tradeGroup || '-')}</td>
        <td class="num mono">${Number(item.totalHours || 0).toFixed(2)}</td>
        <td class="num mono">${fmtLkr(Number(item.dailyRate || 0))}</td>
        <td class="num mono">${fmtLkr(Number(item.hourlyRate || 0))}</td>
        <td class="num mono">${fmtLkr(Number(item.totalHourlyPayment || 0))}</td>
        <td class="num mono">${fmtLkr(Number(item.overhead || 0))}</td>
        <td class="num mono bold">${fmtLkr(Number(item.totalCost || 0))}</td>
      </tr>`
    )
    .join('');

  openPrintDocument({
    docTitle: `BP Bill - ${group.businessPartner} (${periodText})`,
    billHeading: 'Contractor / BP Payment Bill',
    accentColor: '#1d4ed8',
    summaryBg: '#eff6ff',
    summaryColor: '#1e40af',
    projectName,
    projectCode,
    periodText,
    partnerLabel: 'Business Partner / Subcontractor',
    partnerName: group.businessPartner,
    summaryLine: `${items.length} Worker(s) · ${totalHours.toFixed(2)} Total Hours`,
    preparedBy,
    tableHtml: `
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Emp Code</th>
            <th>Employee Name</th>
            <th>Trade Group</th>
            <th class="num">Hours</th>
            <th class="num">Daily Rate</th>
            <th class="num">Hourly Rate</th>
            <th class="num">Gross Pay</th>
            <th class="num">Overhead</th>
            <th class="num">Total Cost (LKR)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="4">TOTAL (${items.length} Workers)</td>
            <td class="num mono">${totalHours.toFixed(2)}</td>
            <td></td>
            <td></td>
            <td class="num mono">${fmtLkr(totalPayment)}</td>
            <td class="num mono">${fmtLkr(totalOverhead)}</td>
            <td class="num mono">${fmtLkr(totalCost)}</td>
          </tr>
        </tfoot>
      </table>`,
    summaryRowsHtml: `
      <div class="summary-row"><span>Total Worked Hours</span><span class="mono bold">${totalHours.toFixed(2)} hrs</span></div>
      <div class="summary-row"><span>Gross Labor Payment</span><span class="mono">LKR ${fmtLkr(totalPayment)}</span></div>
      <div class="summary-row"><span>Total Overhead</span><span class="mono">LKR ${fmtLkr(totalOverhead)}</span></div>
      <div class="summary-row total"><span>Net Bill Payable</span><span class="mono">LKR ${fmtLkr(totalCost)}</span></div>`,
  });
}

export interface PrintSubcontractorDeductionOptions {
  group: SubcontractorDeductionGroup;
  dateFrom?: string | null;
  dateTo?: string | null;
  projectName?: string;
  projectCode?: string;
  preparedBy?: string;
}

/**
 * Opens a clean A4 printable Subcontractor Deduction (back-charge) notice
 * for a single Subcontractor so the user can print or save as PDF.
 */
export function printSubcontractorDeductionBill({
  group,
  dateFrom,
  dateTo,
  projectName = 'Maga Engineering Project',
  projectCode = '',
  preparedBy = '',
}: PrintSubcontractorDeductionOptions): void {
  const itemDates = group.items.map((i) => i.date).filter(Boolean);
  const periodText = resolvePeriodText(itemDates, dateFrom, dateTo);

  const rowsHtml = group.items
    .map(
      (item, idx) => `
      <tr>
        <td class="num">${idx + 1}</td>
        <td class="mono">${escapeHtml(item.date)}</td>
        <td>
          <div class="emp-name">${escapeHtml(item.employeeName)}</div>
          <div class="sub-text mono">${escapeHtml(item.employeeCode)} · ${escapeHtml(item.tradeGroup)}</div>
        </td>
        <td>
          ${
            item.sourcePartnerCode
              ? `<div class="emp-name mono">${escapeHtml(item.sourcePartnerCode)}</div><div class="sub-text">${escapeHtml(item.sourcePartner)}</div>`
              : `<span>${escapeHtml(item.sourcePartner)}</span>`
          }
        </td>
        <td class="mono">${escapeHtml(item.activityCode)}</td>
        <td class="num mono">${Number(item.splitHours || 0).toFixed(2)}</td>
        <td class="num mono">${Number(item.normalHours || 0).toFixed(2)}</td>
        <td class="num mono">${Number(item.otHours || 0).toFixed(2)}</td>
        <td class="num mono">${fmtLkr(Number(item.dailyRate || 0))}</td>
        <td class="num mono bold">${fmtLkr(Number(item.deductionAmount || 0))}</td>
      </tr>`
    )
    .join('');

  openPrintDocument({
    docTitle: `Subcontractor Deduction - ${group.subcontractorCode} ${group.subcontractorName} (${periodText})`,
    billHeading: 'Subcontractor Manpower Deduction Bill',
    accentColor: '#b91c1c',
    summaryBg: '#fef2f2',
    summaryColor: '#b91c1c',
    projectName,
    projectCode,
    periodText,
    partnerLabel: 'Charged Subcontractor (Back-Charge)',
    partnerName: `${group.subcontractorCode} — ${group.subcontractorName}`,
    summaryLine: `${group.workerCount} Worker(s) · ${group.items.length} Entry Split(s) · ${group.totalSplitHours.toFixed(2)} Hrs`,
    preparedBy,
    tableHtml: `
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>Date</th>
            <th>Employee</th>
            <th>Source BP</th>
            <th>Activity</th>
            <th class="num">Split Hrs</th>
            <th class="num">Normal</th>
            <th class="num">OT</th>
            <th class="num">Daily Rate</th>
            <th class="num">Deduction (LKR)</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr>
            <td colspan="5">TOTAL (${group.items.length} Splits)</td>
            <td class="num mono">${group.totalSplitHours.toFixed(2)}</td>
            <td class="num mono">${group.totalNormalHours.toFixed(2)}</td>
            <td class="num mono">${group.totalOtHours.toFixed(2)}</td>
            <td></td>
            <td class="num mono">${fmtLkr(group.totalDeductionAmount)}</td>
          </tr>
        </tfoot>
      </table>`,
    summaryRowsHtml: `
      <div class="summary-row"><span>Total Normal Hours</span><span class="mono bold">${group.totalNormalHours.toFixed(2)} hrs</span></div>
      <div class="summary-row"><span>Total OT Hours</span><span class="mono bold">${group.totalOtHours.toFixed(2)} hrs</span></div>
      <div class="summary-row"><span>Total Charged Hours</span><span class="mono bold">${group.totalSplitHours.toFixed(2)} hrs</span></div>
      <div class="summary-row total"><span>Total Bill Deduction</span><span class="mono">LKR ${fmtLkr(group.totalDeductionAmount)}</span></div>`,
  });
}
