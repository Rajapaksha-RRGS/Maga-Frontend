/**
 * ErpUploadTable.tsx — Flat preview table for ERP Upload Export.
 * Matches GET /api/reports/erp-upload.
 *
 * Columns: Employee, Date, Activity, Hours, Overtime Hours, Remarks.
 */
import type { ErpUploadResponse } from '../services/reportService';
import { FileUp, Clock, Timer, Layers } from 'lucide-react';

interface Props {
  data: ErpUploadResponse;
}

export default function ErpUploadTable({ data }: Props) {
  const { rows, totalHours, totalOtHours, rowCount } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={14} className="text-slate-400" /> Export Rows
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {rowCount}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400" /> Total Standard Hours
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {totalHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-amber-200/70 bg-amber-50/40 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
            <Timer size={14} className="text-amber-500" /> Total OT Hours
          </span>
          <span className="text-xl font-medium text-amber-800 tabular-nums">
            {totalOtHours.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Export Format Note */}
      <div className="bg-blue-50/50 border border-blue-200/60 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs text-blue-800">
        <FileUp size={15} className="text-blue-600 flex-shrink-0" />
        <span>
          ERP Import File Preview: This tabular schema directly matches the SAP / IFS / ERP CSV batch import format.
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 min-w-[180px]">Employee</th>
                <th className="px-4 py-3 min-w-[110px]">Date</th>
                <th className="px-4 py-3 min-w-[200px]">Activity</th>
                <th className="px-4 py-3 text-right min-w-[90px]">Hours</th>
                <th className="px-4 py-3 text-right min-w-[110px]">Overtime hours</th>
                <th className="px-4 py-3 min-w-[200px]">Remarks</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 font-sans">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors text-xs">
                  <td className="px-4 py-3">
                    <span className="font-medium text-slate-800">{row.employeeName}</span>
                    <span className="block text-[10px] font-mono text-slate-400">{row.employeeId}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 text-xs">
                    {row.date}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-mono text-xs font-medium text-slate-800">
                        {row.activityCode}
                      </span>
                      <span className="text-slate-500 text-xs truncate max-w-[180px]">
                        {row.activityDescription}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800 font-medium">
                    {row.hours.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.overtimeHours > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80 font-medium">
                        +{row.overtimeHours.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-slate-400">0.0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 italic">
                    {row.remarks || '—'}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr className="bg-slate-50/90 border-t-2 border-slate-200 text-xs font-medium text-slate-800">
                <td colSpan={3} className="px-4 py-3 uppercase tracking-wider font-semibold">
                  Total ({rowCount} rows)
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                  {totalHours.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">
                  {totalOtHours.toFixed(1)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
