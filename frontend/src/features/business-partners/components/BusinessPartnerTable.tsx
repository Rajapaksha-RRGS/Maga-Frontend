/**
 * BusinessPartnerTable.tsx
 *
 * Desktop table view for Business Partners using the core DataTable component.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import type { BusinessPartner } from '../services/businessPartnerService';
import { Building2, Phone, Mail } from 'lucide-react';

interface Props {
  data: BusinessPartner[];
  onRowClick: (partner: BusinessPartner) => void;
}

const columns: Column<BusinessPartner>[] = [
  {
    header: 'Code',
    accessor: 'code',
    className: 'w-[100px]',
    render: (bp) => (
      <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
        {bp.code}
      </span>
    ),
  },
  {
    header: 'Business Partner Name',
    accessor: 'name',
    render: (bp) => (
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center flex-shrink-0">
          <Building2 size={14} />
        </div>
        <div>
          <span className="font-medium text-slate-800 block text-sm">{bp.name}</span>
          {bp.address && (
            <span className="text-xs text-slate-400 truncate max-w-[220px] block">
              {bp.address}
            </span>
          )}
        </div>
      </div>
    ),
  },
  {
    header: 'Contact Person',
    accessor: 'contactPerson',
    render: (bp) => (
      <span className="text-slate-700 text-sm">
        {bp.contactPerson || '—'}
      </span>
    ),
  },
  {
    header: 'Phone / Email',
    accessor: 'phone',
    render: (bp) => (
      <div className="flex flex-col gap-0.5 text-xs">
        {bp.phone && (
          <span className="flex items-center gap-1 font-mono text-slate-600">
            <Phone size={12} className="text-slate-400" />
            {bp.phone}
          </span>
        )}
        {bp.email && (
          <span className="flex items-center gap-1 text-slate-500">
            <Mail size={12} className="text-slate-400" />
            {bp.email}
          </span>
        )}
        {!bp.phone && !bp.email && <span className="text-slate-400">—</span>}
      </div>
    ),
  },
  {
    header: 'Status',
    accessor: 'status',
    className: 'w-[110px] text-center',
    render: (bp) => (
      <span
        className={[
          'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium',
          bp.status === 'active'
            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
            : 'bg-slate-100 text-slate-600 border border-slate-200',
        ].join(' ')}
      >
        <span
          className={[
            'w-1.5 h-1.5 rounded-full',
            bp.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400',
          ].join(' ')}
        />
        {bp.status === 'active' ? 'Active' : 'Inactive'}
      </span>
    ),
  },
];

export default function BusinessPartnerTable({ data, onRowClick }: Props) {
  return (
    <DataTable
      columns={columns}
      data={data}
      keyField="id"
      onRowClick={onRowClick}
    />
  );
}
