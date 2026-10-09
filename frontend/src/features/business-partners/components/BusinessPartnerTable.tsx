/**
 * BusinessPartnerTable.tsx
 *
 * Desktop table view for Business Partners using the core DataTable component.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import type { BusinessPartner } from '../services/businessPartnerService';
import { Building2, Phone, Mail, Clock, FileText, ExternalLink } from 'lucide-react';

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
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {bp.brNumber && (
              <span className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200 font-mono">
                BR: {bp.brNumber}
              </span>
            )}
            {bp.documentUrl && (
              <a
                href={
                  bp.documentUrl.startsWith('http')
                    ? bp.documentUrl
                    : `${import.meta.env.VITE_API_URL?.replace(/\/api\/?$/, '') || 'http://localhost:5000'}${
                        bp.documentUrl.startsWith('/') ? '' : '/'
                      }${bp.documentUrl}`
                }
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.2 rounded hover:bg-rose-100"
                title="View Scanned Dossier (BR / Owner NIC)"
              >
                <FileText size={10} />
                <span>PDF</span>
                <ExternalLink size={8} />
              </a>
            )}
            {bp.address && (
              <span className="text-xs text-slate-400 truncate max-w-[200px]">
                {bp.address}
              </span>
            )}
          </div>
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
    className: 'w-[120px] text-center',
    render: (bp) => (
      bp.status === 'pending_approval' ? (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300" title="Pending HO Super Admin Approval — Payroll Locked">
          <Clock size={11} className="text-amber-600" />
          <span>Pending HO</span>
        </span>
      ) : (
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
      )
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
