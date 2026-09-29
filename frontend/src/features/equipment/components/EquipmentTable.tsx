/**
 * EquipmentTable.tsx — Desktop table for equipment list.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import StatusBadge from '../../../components/StatusBadge';
import type { Equipment } from '../services/equipmentService';

interface Props { data: Equipment[]; onRowClick: (e: Equipment) => void; }

const columns: Column<Equipment>[] = [
  { 
    header: 'Equipment / Vehicle', 
    accessor: 'code', 
    render: (e) => (
      <div className="flex flex-col">
        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded w-fit">
          {e.vehicleNo || e.code}
        </span>
        {e.magaNo && e.magaNo !== (e.vehicleNo || e.code) && (
          <span className="font-mono text-[10px] text-slate-500 mt-0.5">ERP: {e.magaNo}</span>
        )}
      </div>
    ) 
  },
  { 
    header: 'Description', 
    accessor: 'name', 
    render: (e) => (
      <div>
        <span className="font-medium text-slate-800 block">{e.name}</span>
        {e.type && <span className="text-[11px] text-slate-500">{e.type}</span>}
      </div>
    ) 
  },
  {
    header: 'Condition',
    accessor: 'condition',
    render: (e) => {
      const isWet = (e.condition || 'DRY').toUpperCase() === 'WET';
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold tracking-wider ${
          isWet ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-sky-50 text-sky-700 border border-sky-200'
        }`}>
          {isWet ? 'WET' : 'DRY'}
        </span>
      );
    }
  },
  {
    header: 'Billing Units & Rates',
    accessor: 'costRate',
    render: (e) => {
      if (Array.isArray(e.unitRates) && e.unitRates.length > 0) {
        return (
          <div className="flex flex-wrap gap-1.5 max-w-xs">
            {e.unitRates.map((ur, idx) => (
              <span key={idx} className="font-mono text-[11px] bg-slate-50 border border-slate-200 text-slate-700 px-1.5 py-0.5 rounded">
                <span className="font-semibold text-blue-700">{ur.unit}</span>: LKR {Number(ur.rate).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                {ur.erpBillingCode && <span className="text-[9px] text-slate-400 ml-1">({ur.erpBillingCode})</span>}
              </span>
            ))}
          </div>
        );
      }
      return (
        <span className="font-mono text-xs text-slate-700">
          {e.costRate !== undefined && e.costRate !== null && Number(e.costRate) > 0
            ? `LKR ${Number(e.costRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / ${e.primaryUnit || 'mth'}`
            : '—'}
        </span>
      );
    },
  },
  { header: 'Status', accessor: 'status', render: (e) => <StatusBadge status={e.status} /> },
];

export default function EquipmentTable({ data, onRowClick }: Props) {
  return <DataTable columns={columns} data={data} keyField="id" onRowClick={onRowClick} />;
}
