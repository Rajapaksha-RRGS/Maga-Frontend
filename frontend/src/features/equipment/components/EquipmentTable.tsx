/**
 * EquipmentTable.tsx — Desktop table for equipment list.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import type { Equipment } from '../services/equipmentService';

interface Props { data: Equipment[]; onRowClick: (e: Equipment) => void; }

const columns: Column<Equipment>[] = [
  { header: 'Name', accessor: 'name', render: (e) => <span className="font-medium">{e.name}</span> },
  { header: 'Type', accessor: 'type' },
  { header: 'Status', accessor: 'status', render: (e) => <StatusBadge status={e.status} /> },
];

export default function EquipmentTable({ data, onRowClick }: Props) {
  return <DataTable columns={columns} data={data} keyField="id" onRowClick={onRowClick} />;
}
