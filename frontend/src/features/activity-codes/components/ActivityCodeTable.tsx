/**
 * ActivityCodeTable.tsx — Desktop table for activity codes.
 * Code column uses font-mono per design-system.json.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import type { ActivityCode } from '../services/activityCodeService';

interface Props { data: ActivityCode[]; onRowClick: (c: ActivityCode) => void; }

const columns: Column<ActivityCode>[] = [
  { header: 'Code', accessor: 'code', render: (c) => <span className="font-mono text-sm font-medium">{c.code}</span> },
  { header: 'Description', accessor: 'description' },
  {
    header: 'Project Code',
    accessor: 'projectCode',
    render: (c) => (
      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 text-purple-700 border border-purple-200">
        {c.projectCode || '—'}
      </span>
    ),
  },
];

export default function ActivityCodeTable({ data, onRowClick }: Props) {
  return <DataTable columns={columns} data={data} keyField="id" onRowClick={onRowClick} />;
}
