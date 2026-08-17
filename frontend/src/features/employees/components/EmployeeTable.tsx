/**
 * EmployeeTable.tsx — Desktop table rendering for employee list.
 * Visible md+ only (hidden below md via DataTable).
 */
import DataTable, { type Column } from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import type { Employee } from '../services/employeeService';

interface EmployeeTableProps {
  data: Employee[];
  onRowClick: (emp: Employee) => void;
}

const columns: Column<Employee>[] = [
  { header: 'Calling name', accessor: 'callingName', render: (e) => <span className="font-medium">{e.callingName}</span> },
  { header: 'Full name', accessor: 'fullName' },
  { header: 'Business partner', accessor: 'businessPartner' },
  { header: 'Trade group', accessor: 'tradeGroup' },
  { header: 'Status', accessor: 'status', render: (e) => <StatusBadge status={e.status} /> },
];

export default function EmployeeTable({ data, onRowClick }: EmployeeTableProps) {
  return (
    <DataTable
      columns={columns}
      data={data}
      keyField="id"
      onRowClick={onRowClick}
    />
  );
}
