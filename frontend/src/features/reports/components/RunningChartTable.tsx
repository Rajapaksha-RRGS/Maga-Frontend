/**
 * RunningChartTable.tsx — Tabular view for the Daily Labour Running Chart report.
 * Matches GET /api/reports/running-chart.
 */
import type { RunningChartResponse } from '../services/reportService';
import { Users, Clock, Timer, Layers, UserCheck } from 'lucide-react';

interface Props {
  data: RunningChartResponse;
}

export default function RunningChartTable({ data }: Props) {
  const { items, totals } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users size={14} className="text-slate-400" /> Total Records
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalRecords}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-blue-500" /> Work Hours
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalWorkHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
            <Timer size={14} className="text-amber-500" /> Overtime Hours
          </span>
          <span className="text-xl font-semibold text-amber-900 tabular-nums">
            {totals.totalOtHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={14} className="text-emerald-600" /> Total Hours
          </span>
          <span className="text-xl font-semibold text-emerald-950 tabular-nums">
            {totals.totalHours.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-medium">
                <th className="px-3.5 py-3 text-center whitespace-nowrap">Date</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Supervisor</th>
                <th className="px-3.5 py-3 whitespace-nowrap">EMP No</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Calling Name</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Business Partner</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">In Time</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Out Time</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Work Hrs</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">OT Hrs</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Total Hrs</th>
                <th className="px-4 py-3 min-w-[220px]">Activities & Worked Hours</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-8 text-center text-slate-400">
                    No running chart records found for the selected criteria.
                  </td>
                </tr>
              ) : (
                items.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-3.5 py-2.5 text-center text-slate-600 font-medium whitespace-nowrap">
                      {row.date}
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                        <UserCheck size={14} className="text-blue-600 flex-shrink-0" />
                        <span>{row.supervisorName}</span>
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 whitespace-nowrap">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                        {row.employeeCode}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                      {row.callingName}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-500 whitespace-nowrap">
                      {row.businessPartner}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-700 font-mono text-xs whitespace-nowrap">
                      {row.inTime}
                    </td>
                    <td className="px-3 py-2.5 text-center text-slate-700 font-mono text-xs whitespace-nowrap">
                      {row.outTime}
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap">
                      {row.workHours.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {row.otHours > 0 ? (
                        <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md">
                          +{row.otHours.toFixed(1)}h
                        </span>
                      ) : (
                        <span className="text-slate-400">0.0</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {row.totalHours.toFixed(1)}
                    </td>
                    <td className="px-4 py-2.5">
                      {row.activities.length === 0 ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {row.activities.map((act, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50/80 text-blue-800 border border-blue-200/60"
                              title={act.description || act.code}
                            >
                              <span className="font-mono">{act.code}</span>
                              <span className="font-semibold text-blue-900 bg-blue-100/80 px-1 rounded">
                                {act.hours.toFixed(1)}h
                              </span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-slate-300 text-slate-800 font-semibold text-xs sm:text-sm">
                  <td colSpan={7} className="px-4 py-3 text-right uppercase tracking-wider text-slate-600">
                    Grand Totals ({items.length} Records):
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                    {totals.totalWorkHours.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-800">
                    +{totals.totalOtHours.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-blue-900">
                    {totals.totalHours.toFixed(1)}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
