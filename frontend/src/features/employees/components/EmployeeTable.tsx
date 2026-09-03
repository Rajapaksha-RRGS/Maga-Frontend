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
  {
    header: 'Trade Group',
    accessor: 'tradeGroup',
    render: (e) => <span className="font-medium text-slate-900">{e.tradeGroup}</span>,
  },
  {
    header: 'NIC No.',
    accessor: 'nicNo',
    render: (e) => <span className="font-mono text-xs text-slate-700">{e.nicNo || '—'}</span>,
  },
  {
    header: 'Daily Rate',
    accessor: 'dailyRate',
    render: (e) => (
      <span className="font-medium text-slate-800 tabular-nums">
        {e.dailyRate != null
          ? Number(e.dailyRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '—'}
      </span>
    ),
  },
  {
    header: 'Business Partner',
    accessor: 'businessPartner',
    render: (e) => <span className="text-slate-700">{e.businessPartner}</span>,
  },
  {
    header: 'Employee Code',
    accessor: 'employeeCode',
    render: (e) => (
      <span className="font-semibold font-mono text-xs text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
        {e.employeeCode || e.id}
      </span>
    ),
  },
  {
    header: 'EPF No',
    accessor: 'epfNo',
    render: (e) => (
      <span className="font-mono text-xs text-slate-600">
        {e.epfNo ? e.epfNo : <span className="text-slate-400">—</span>}
      </span>
    ),
  },
  {
    header: 'Status',
    accessor: 'status',
    render: (e) => <StatusBadge status={e.status} />,
  },
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
