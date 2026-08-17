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
];

export default function ActivityCodeTable({ data, onRowClick }: Props) {
  return <DataTable columns={columns} data={data} keyField="id" onRowClick={onRowClick} />;
}
