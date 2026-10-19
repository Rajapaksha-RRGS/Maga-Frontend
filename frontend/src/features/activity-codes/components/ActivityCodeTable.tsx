/**
 * ActivityCodeTable.tsx — Desktop table for activity codes.
 * Features hierarchical display for Master BOQ codes and derived site sub-activities.
 */
import DataTable, { type Column } from '../../../components/DataTable';
import type { ActivityCode } from '../services/activityCodeService';
import { Split, Layers, CornerDownRight } from 'lucide-react';

interface Props {
  data: ActivityCode[];
  onRowClick: (c: ActivityCode) => void;
  onDerive?: (parent: ActivityCode) => void;
}

export default function ActivityCodeTable({ data, onRowClick, onDerive }: Props) {
  const columns: Column<ActivityCode>[] = [
    {
      header: 'Activity Code',
      accessor: 'code',
      render: (c) => (
        <div className="flex items-center gap-2">
          {c.isDerived ? (
            <div className="flex items-center gap-1.5 pl-4">
              <CornerDownRight size={14} className="text-blue-500 shrink-0" />
              <span className="font-mono text-xs font-bold text-blue-900 bg-blue-50/80 border border-blue-200 px-2 py-0.5 rounded">
                {c.code}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 border border-slate-300 px-2 py-0.5 rounded">
                {c.code}
              </span>
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Description',
      accessor: 'description',
      render: (c) => (
        <div className="flex flex-col">
          <span className={`text-xs ${c.isDerived ? 'text-slate-800 font-medium' : 'text-slate-900 font-semibold'}`}>
            {c.description}
          </span>
          {c.isDerived && c.parentActivity && (
            <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
              <span>↳ Parent BOQ:</span>
              <span className="font-mono font-medium text-slate-600">{c.parentActivity.code}</span>
              <span className="truncate max-w-[200px]">({c.parentActivity.description})</span>
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Level / Type',
      accessor: 'isDerived',
      render: (c) => (
        c.isDerived ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
            <Split size={10} />
            <span>Site Sub-Activity</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
            <Layers size={10} />
            <span>Master Code</span>
          </span>
        )
      ),
    },
    {
      header: 'Unit',
      accessor: 'unit',
      render: (c) => (
        <span className="font-mono text-xs font-medium text-slate-600">
          {c.unit || '—'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: 'actions',
      className: 'w-[180px]',
      render: (c) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {!c.isDerived && onDerive && (
            <button
              type="button"
              onClick={() => onDerive(c)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
              title={`Derive site-specific sub-activity from ${c.code}`}
            >
              <Split size={12} className="text-blue-600" />
              <span className="text-[12px]">Sub task</span>
            </button>
          )}
          {c.derivedCount != null && c.derivedCount > 0 && (
            <span className="text-[10px] font-bold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
              {c.derivedCount} Sub task{c.derivedCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      ),
    },
  ];

  return <DataTable columns={columns} data={data} keyField="id" onRowClick={onRowClick} />;
}
