import type { BpBillEmployeeItem, BpBillGroup } from '../services/reportService';
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
  const win = window.open('', '_blank', 'width=1024,height=780');
  if (!win) {
    alert('Please allow pop-ups in your browser to print or save the BP Bill as PDF.');
    return;
  }

  const totalHours = items.reduce((s, i) => s + Number(i.totalHours || 0), 0);
  const totalPayment = items.reduce((s, i) => s + Number(i.totalHourlyPayment || 0), 0);
  const totalOverhead = items.reduce((s, i) => s + Number(i.overhead || 0), 0);
  const totalCost = items.reduce((s, i) => s + Number(i.totalCost || 0), 0);

  const logoUrl = magaLogo.startsWith('data:')
    ? magaLogo
    : new URL(magaLogo, window.location.origin).href;

  const itemDates = Array.from(
    new Set(
      items.flatMap((i) =>
        Object.entries(i.dailyHours || {})
          .filter(([, hrs]) => Number(hrs) > 0)
          .map(([d]) => d)
      )
    )
  ).sort();
  const effectiveDates = itemDates.length > 0 ? itemDates : [...dates].sort();
  const resolvedFrom = dateFrom || effectiveDates[0] || null;
  const resolvedTo = dateTo || effectiveDates[effectiveDates.length - 1] || null;

  const periodText =
    resolvedFrom && resolvedTo
      ? resolvedFrom === resolvedTo
        ? resolvedFrom
        : `${resolvedFrom} to ${resolvedTo}`
      : resolvedFrom || resolvedTo || 'All Dates';
  const generatedDate = new Date().toLocaleDateString('en-GB', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });

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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>BP Bill - ${escapeHtml(group.businessPartner)} (${escapeHtml(periodText)})</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }
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
    .toolbar {
      max-width: 900px;
      margin: 0 auto 12px auto;
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn {
      padding: 8px 16px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #cbd5e1;
      background: #fff;
      color: #1e293b;
    }
    .btn-primary {
      background: #1d4ed8;
      border-color: #1d4ed8;
      color: #fff;
    }
    .sheet {
      max-width: 900px;
      margin: 0 auto;
      background: #fff;
      padding: 24px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-logo {
      height: 44px;
      width: auto;
      object-fit: contain;
    }
    .company { font-size: 18px; font-weight: 800; letter-spacing: 0.3px; color: #0f172a; }
    .subtitle { font-size: 11px; color: #475569; margin-top: 2px; }
    .bill-title {
      text-align: right;
    }
    .bill-title h1 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      color: #1d4ed8;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .bill-title .meta { font-size: 10.5px; color: #475569; margin-top: 3px; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 16px;
    }
    .info-label { font-size: 9.5px; text-transform: uppercase; color: #64748b; font-weight: 700; }
    .info-value { font-size: 12px; font-weight: 700; color: #0f172a; margin-top: 2px; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 16px;
    }
    thead { display: table-header-group; }
    tr { break-inside: avoid; }
    th {
      background: #f1f5f9;
      color: #334155;
      font-size: 9.5px;
      text-transform: uppercase;
      letter-spacing: 0.4px;
      padding: 7px 6px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      text-align: left;
    }
    td {
      padding: 6px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .num { text-align: right; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .bold { font-weight: 700; }
    .emp-name { font-weight: 600; color: #0f172a; }
    .hold-tag {
      display: inline-block;
      margin-top: 2px;
      font-size: 9px;
      font-weight: 700;
      color: #b45309;
      background: #fef3c7;
      padding: 1px 4px;
      border-radius: 3px;
    }
    tfoot td {
      background: #f8fafc;
      border-top: 2px solid #0f172a;
      border-bottom: 2px solid #0f172a;
      font-weight: 700;
      padding: 8px 6px;
    }
    .summary-box {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 28px;
    }
    .summary-card {
      width: 300px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      overflow: hidden;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 12px;
      border-bottom: 1px solid #e2e8f0;
      font-size: 11px;
    }
    .summary-row.total {
      background: #eff6ff;
      color: #1e40af;
      font-weight: 800;
      font-size: 13px;
      border-bottom: none;
    }
    .signatures {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 36px;
      padding-top: 8px;
      break-inside: avoid;
    }
    .sig-box {
      border-top: 1px dashed #64748b;
      padding-top: 6px;
      text-align: center;
      font-size: 10px;
      color: #475569;
      font-weight: 600;
    }
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
          <div class="subtitle">${escapeHtml(projectCode ? `${projectCode} — ${projectName}` : projectName)}</div>
        </div>
      </div>
      <div class="bill-title">
        <h1>Contractor / BP Payment Bill</h1>
        <div class="meta">Billing Period: <strong>${escapeHtml(periodText)}</strong></div>
        <div class="meta">Printed: ${escapeHtml(generatedDate)}</div>
      </div>
    </div>

    <div class="info-grid">
      <div>
        <div class="info-label">Business Partner / Subcontractor</div>
        <div class="info-value">${escapeHtml(group.businessPartner)}</div>
      </div>
      <div>
        <div class="info-label">Summary</div>
        <div class="info-value">${items.length} Worker(s) &middot; ${totalHours.toFixed(2)} Total Hours</div>
      </div>
    </div>

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
      <tbody>
        ${rowsHtml}
      </tbody>
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
    </table>

    <div class="summary-box">
      <div class="summary-card">
        <div class="summary-row">
          <span>Total Worked Hours</span>
          <span class="mono bold">${totalHours.toFixed(2)} hrs</span>
        </div>
        <div class="summary-row">
          <span>Gross Labor Payment</span>
          <span class="mono">LKR ${fmtLkr(totalPayment)}</span>
        </div>
        <div class="summary-row">
          <span>Total Overhead</span>
          <span class="mono">LKR ${fmtLkr(totalOverhead)}</span>
        </div>
        <div class="summary-row total">
          <span>Net Bill Payable</span>
          <span class="mono">LKR ${fmtLkr(totalCost)}</span>
        </div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-box">Prepared By${preparedBy ? `<br/>(${escapeHtml(preparedBy)})` : ''}</div>
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
