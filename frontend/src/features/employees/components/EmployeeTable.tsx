/**
 * EmployeeTable.tsx — Desktop table rendering for employee list.
 * Visible md+ only (hidden below md via DataTable).
 */
import { useMemo } from 'react';
import DataTable, { type Column } from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import type { Employee } from '../services/employeeService';

interface EmployeeTableProps {
  data: Employee[];
  onRowClick: (emp: Employee) => void;
  onToggleStatus?: (id: string, currentStatus: 'active' | 'inactive') => void;
}

export default function EmployeeTable({ data, onRowClick, onToggleStatus }: EmployeeTableProps) {
  const columns = useMemo<Column<Employee>[]>(
    () => [
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
        render: (e) => (
          <div className="flex items-center gap-2" onClick={(evt) => evt.stopPropagation()}>
            <StatusBadge status={e.status} />
            {onToggleStatus && (
              <button
                type="button"
                onClick={() => onToggleStatus(e.id, e.status)}
                title={e.status === 'active' ? 'Deactivate employee' : 'Activate employee'}
                className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                  e.status === 'active'
                    ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200'
                    : 'text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
                }`}
              >
                {e.status === 'active' ? 'Deactivate' : 'Activate'}
              </button>
            )}
          </div>
        ),
      },
    ],
    [onToggleStatus]
  );

  return (
    <DataTable
      columns={columns}
      data={data}
      keyField="id"
      onRowClick={onRowClick}
    />
  );
}
