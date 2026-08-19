/**
 * SummaryTable.tsx — Tabular view for Summary report.
 * Matches GET /api/reports/summary.
 */
import type { SummaryReportResponse } from '../services/reportService';
import { Users, Clock, Timer, CalendarCheck } from 'lucide-react';

interface Props {
  data: SummaryReportResponse;
}

export default function SummaryTable({ data }: Props) {
  const { items, totals } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users size={14} className="text-slate-400" /> Employees
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {totals.employeeCount}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <CalendarCheck size={14} className="text-slate-400" /> Total Days
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {totals.totalDays}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400" /> Normal Hours
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {totals.totalNormalHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-amber-200/70 bg-amber-50/40 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
            <Timer size={14} className="text-amber-500" /> Overtime Hours
          </span>
          <span className="text-xl font-medium text-amber-800 tabular-nums">
            {totals.totalOtHours.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 min-w-[180px]">Employee</th>
                <th className="px-4 py-3 min-w-[130px]">Trade group</th>
                <th className="px-4 py-3 min-w-[160px]">Business partner</th>
                <th className="px-4 py-3 text-right">Worked days</th>
                <th className="px-4 py-3 text-right">Normal hrs</th>
                <th className="px-4 py-3 text-right">OT hrs</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-800">Total hrs</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{row.employeeName}</div>
                    <div className="text-[11px] font-mono text-slate-400">{row.employeeId}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{row.tradeGroup}</td>
                  <td className="px-4 py-3 text-slate-600">{row.businessPartner}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-800 font-medium">
                    {row.totalDays}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-slate-600">
                    {row.totalNormalHours.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {row.totalOtHours > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                        +{row.totalOtHours.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-slate-400">0.0</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                    {row.totalHours.toFixed(1)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/90 border-t-2 border-slate-200 text-xs font-medium text-slate-800">
                <td colSpan={3} className="px-4 py-3 uppercase tracking-wider font-semibold">
                  Total ({totals.employeeCount} employees)
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                  {totals.totalDays}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                  {totals.totalNormalHours.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">
                  {totals.totalOtHours.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900 text-sm">
                  {totals.totalHours.toFixed(1)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
