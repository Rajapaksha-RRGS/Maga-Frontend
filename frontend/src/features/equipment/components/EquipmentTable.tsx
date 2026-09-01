/**
 * EquipmentTable.tsx — Desktop table for equipment list.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import type { Equipment } from '../services/equipmentService';

interface Props { data: Equipment[]; onRowClick: (e: Equipment) => void; }

const columns: Column<Equipment>[] = [
  { header: 'Code', accessor: 'code', render: (e) => <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{e.code}</span> },
  { header: 'Name', accessor: 'name', render: (e) => <span className="font-medium text-slate-800">{e.name}</span> },
  { header: 'Type', accessor: 'type' },
  { header: 'Status', accessor: 'status', render: (e) => <StatusBadge status={e.status} /> },
];

export default function EquipmentTable({ data, onRowClick }: Props) {
  return <DataTable columns={columns} data={data} keyField="id" onRowClick={onRowClick} />;
}
