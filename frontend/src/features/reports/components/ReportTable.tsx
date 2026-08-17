/**
 * ReportTable.tsx — Desktop table for report results.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import type { ReportRow } from '../services/reportService';

interface Props { data: ReportRow[]; }

const columns: Column<ReportRow>[] = [
  { header: 'Employee', accessor: 'employeeName', render: (r) => <span className="font-medium">{r.employeeName}</span> },
  { header: 'Date', accessor: 'date', render: (r) => <span className="font-mono text-sm">{r.date}</span> },
  { header: 'Activity', accessor: 'activityCode', render: (r) => (
    <span>
      <span className="font-mono text-sm font-medium">{r.activityCode}</span>
      <span className="text-slate-400 ml-1 text-xs">{r.activityDescription}</span>
    </span>
  )},
  { header: 'Hours', accessor: 'hours', render: (r) => <span className="tabular-nums">{r.hours.toFixed(1)}</span> },
  { header: 'OT hours', accessor: 'overtimeHours', render: (r) => (
    <span className={r.overtimeHours > 0 ? 'text-amber-700 font-medium tabular-nums' : 'text-slate-400 tabular-nums'}>
      {r.overtimeHours.toFixed(1)}
    </span>
  )},
  { header: 'Remarks', accessor: 'remarks', render: (r) => (
    <span className="text-slate-500 text-xs">{r.remarks || '—'}</span>
  )},
];

export default function ReportTable({ data }: Props) {
  return <DataTable columns={columns} data={data} keyField="id" />;
}
