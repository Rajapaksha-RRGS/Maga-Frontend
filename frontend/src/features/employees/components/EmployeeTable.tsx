/**
 * EmployeeTable.tsx — Desktop table rendering for employee list.
 * Visible md+ only (hidden below md via DataTable).
 */
import { useMemo } from 'react';
import { Lock, FileText } from 'lucide-react';
import DataTable, { type Column } from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import { getFileUrl } from '../../../config/api';
import type { Employee } from '../services/employeeService';
import {
  formatEmployeeTypeLabel,
  isExternalEmployeeTypeClient,
  normalizeSkillLevelClient,
} from '../../../utils/employeeTypes';

interface EmployeeTableProps {
  data: Employee[];
  onRowClick: (emp: Employee) => void;
  onToggleStatus?: (id: string, currentStatus: 'active' | 'inactive') => void;
}

export default function EmployeeTable({ data, onRowClick, onToggleStatus }: EmployeeTableProps) {
  const columns = useMemo<Column<Employee>[]>(
    () => [
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
        header: 'Calling Name',
        accessor: 'callingName',
        render: (e) => (
          <span className="font-bold text-xs text-slate-900 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200">
            {e.callingName || '—'}
          </span>
        ),
      },
      {
        header: 'Full Name',
        accessor: 'fullName',
        render: (e) => (
          <span className="font-medium text-xs text-slate-800" title={e.fullName}>
            {e.fullName || '—'}
          </span>
        ),
      },
       {
        header: 'NIC No.',
        accessor: 'nicNo',
        render: (e) => <span className="font-mono text-xs text-slate-700">{e.nicNo || '—'}</span>,
      },
      {
        header: 'Trade Group',
        accessor: 'tradeGroup',
        render: (e) => {
          const isUnskilled = normalizeSkillLevelClient(e.skillLevel) === 'UNSKILLED';
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-slate-900">{e.tradeGroup}</span>
              <span
                className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${
                  isUnskilled
                    ? 'text-slate-600 bg-slate-100 border-slate-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}
              >
                {isUnskilled ? 'Unskilled' : 'Skilled'}
              </span>
            </div>
          );
        },
      },
     
       {
        header: 'Daily Rate',
        accessor: 'dailyRate',
        render: (e) => (
          <span className="font-semibold text-slate-800 tabular-nums font-mono text-xs"> 
            {e.dailyRate != null
              ? Number(e.dailyRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              : '—'}
          </span>
        ),
      },
      {
        header: 'Business Partner / Type',
        accessor: 'businessPartner',
        render: (e) => {
          const isExt = isExternalEmployeeTypeClient(e.employeeType);
          const typeLabel = formatEmployeeTypeLabel(e.employeeType);
          if (!isExt || !e.businessPartnerId || !e.businessPartner || e.businessPartner.toLowerCase().includes('direct')) {
            return (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                  typeLabel === 'Foreign'
                    ? 'text-indigo-700 bg-indigo-50 border-indigo-200'
                    : 'text-blue-700 bg-blue-50 border-blue-200'
                }`}
              >
                {typeLabel}
              </span>
            );
          }
          return (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-800 font-medium text-xs leading-tight">
                {e.businessPartnerCode || e.businessPartner}
              </span>
              <span className="inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-full border text-amber-700 bg-amber-50 border-amber-200">
                {typeLabel}
              </span>
            </div>
          );
        },
      },
     
      
      {
        header: 'Status & Payroll',
        accessor: 'status',
        render: (e) => (
          <div className="flex flex-col gap-1 items-start" onClick={(evt) => evt.stopPropagation()}>
            {e.status === 'pending_approval' ? (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full"
                title={e.lockReason || 'Pending Head Office Super Admin Approval — Payout Locked'}
              >
                <Lock size={11} className="text-amber-600" />
                <span>Pending </span>
              </span>
            ) : (
              <StatusBadge status={e.status === 'active' ? 'active' : 'inactive'} />
            )}
            {e.status === 'active' && !e.isPayable && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.2 rounded" title={e.lockReason || 'Subcontractor pending approval'}>
                <Lock size={10} className="text-red-500" />
                <span>Subcontractor Pending</span>
              </span>
            )}
          </div>
        ),
      },
      {
        header: 'Actions',
        accessor: 'actions',
        render: (e) => (
          <div className="flex items-center gap-2" onClick={(evt) => evt.stopPropagation()}>
            {e.documentUrl && (
              <a
                href={getFileUrl(e.documentUrl)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(evt) => evt.stopPropagation()}
                title="View Combined PDF Dossier"
                className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-0.5 rounded transition-colors font-medium"
              >
                <FileText size={12} />
                <span>Dossier</span>
              </a>
            )}
            <button
              type="button"
              onClick={(evt) => {
                evt.stopPropagation();
                onToggleStatus?.(e.id, e.status as any);
              }}
              title={e.status === 'active' ? 'Deactivate employee' : 'Activate employee'}
              className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                e.status === 'active'
                  ? 'text-slate-500 hover:text-amber-700 hover:bg-amber-50 border border-slate-200'
                  : 'text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200'
              }`}
            >
              {e.status === 'active' ? 'Deactivate' : 'Activate'}
            </button>
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
