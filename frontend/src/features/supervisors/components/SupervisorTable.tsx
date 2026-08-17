/**
 * SupervisorTable.tsx — Desktop table for supervisor list with row actions.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import { KeyRound, UserX } from 'lucide-react';
import type { Supervisor } from '../services/supervisorService';

interface Props {
  data: Supervisor[];
  onRowClick: (s: Supervisor) => void;
  onResetPassword: (id: string) => void;
  onDeactivate: (id: string) => void;
}

export default function SupervisorTable({ data, onRowClick, onResetPassword, onDeactivate }: Props) {
  const columns: Column<Supervisor>[] = [
    { header: 'Full name', accessor: 'fullName', render: (s) => <span className="font-medium">{s.fullName}</span> },
    { header: 'Username', accessor: 'username', render: (s) => <span className="font-mono text-sm">{s.username}</span> },
    { header: 'Linked employee', accessor: 'linkedEmployeeName', render: (s) => (
      <span className="text-slate-500">{s.linkedEmployeeName ?? '—'}</span>
    )},
    { header: 'Status', accessor: 'status', render: (s) => <StatusBadge status={s.status} /> },
    { header: '', accessor: 'id', render: (s) => (
      <div className="flex items-center gap-1">
        <button
          onClick={(e) => { e.stopPropagation(); onResetPassword(s.id); }}
          title="Reset password"
          className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <KeyRound size={16} />
        </button>
        {s.status === 'active' && (
          <button
            onClick={(e) => { e.stopPropagation(); onDeactivate(s.id); }}
            title="Deactivate"
            className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <UserX size={16} />
          </button>
        )}
      </div>
    )},
  ];

  return <DataTable columns={columns} data={data} keyField="id" onRowClick={onRowClick} />;
}
