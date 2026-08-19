/**
 * DayOtSummaryTable.tsx — Wide pivoted table for Day & OT Summary report.
 * Matches GET /api/reports/day-ot-summary.
 *
 * Rules:
 *   - One row per employee.
 *   - A Days / O.T. column pair per date in the selected range.
 *   - Wrapped in an overflow-x-auto container for horizontal scrolling.
 *   - Fixed/clean employee identity columns.
 *   - Summary row with date-by-date totals at bottom.
 */
import { Fragment } from 'react';
import type { DayOtSummaryResponse } from '../services/reportService';
import { CalendarRange } from 'lucide-react';

interface Props {
  data: DayOtSummaryResponse;
}

/** Format '2026-08-01' into short header '01 Aug' */
function formatShortDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = monthNames[parseInt(parts[1], 10) - 1] || parts[1];
      return `${parts[2]} ${month}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export default function DayOtSummaryTable({ data }: Props) {
  const { dates, items, totals } = data;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5 font-medium">
          <CalendarRange size={14} className="text-slate-400" />
          Showing {dates.length} days ({dates[0]} to {dates[dates.length - 1]})
        </span>
        <span>Scroll horizontally to view all date columns →</span>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-xs text-left border-collapse min-w-[900px]">
            <thead>
              {/* Primary Header Row */}
              <tr className="bg-slate-50 border-b border-slate-200 font-medium text-slate-500 uppercase tracking-wide">
                <th
                  rowSpan={2}
                  className="sticky left-0 z-20 bg-slate-50 px-4 py-3 min-w-[170px] border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]"
                >
                  Employee
                </th>
                <th
                  rowSpan={2}
                  className="px-3 py-3 min-w-[110px] border-r border-slate-200"
                >
                  Trade group
                </th>
                <th
                  rowSpan={2}
                  className="px-3 py-3 min-w-[140px] border-r border-slate-200"
                >
                  Business partner
                </th>

                {/* Date Group Headers */}
                {dates.map((date) => (
                  <th
                    key={date}
                    colSpan={2}
                    className="px-2 py-2 text-center border-r border-slate-200 font-mono text-[11px] text-slate-700 bg-slate-100/70"
                  >
                    {formatShortDate(date)}
                  </th>
                ))}

                {/* Total Summary Headers */}
                <th
                  colSpan={2}
                  className="px-3 py-2 text-center bg-blue-50/70 text-blue-900 border-l border-slate-200 font-semibold"
                >
                  Totals
                </th>
              </tr>

              {/* Sub-Header Row: Days & O.T. */}
              <tr className="bg-slate-50/90 border-b border-slate-200 text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                {dates.map((date) => (
                  <Fragment key={`${date}-sub`}>
                    <th className="px-2 py-1.5 text-center min-w-[44px] text-slate-600 bg-slate-50">
                      Days
                    </th>
                    <th className="px-2 py-1.5 text-center min-w-[44px] text-amber-700 bg-amber-50/30 border-r border-slate-200">
                      O.T.
                    </th>
                  </Fragment>
                ))}
                <th className="px-3 py-1.5 text-right min-w-[60px] text-slate-800 bg-blue-50/40">
                  Days
                </th>
                <th className="px-3 py-1.5 text-right min-w-[60px] text-amber-800 bg-blue-50/40 font-semibold">
                  O.T.
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Sticky Employee Name */}
                  <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 px-4 py-2.5 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                    <div className="font-medium text-slate-800 truncate max-w-[160px]">
                      {row.employeeName}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                      {row.employeeId}
                    </div>
                  </td>

                  <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 truncate max-w-[120px]">
                    {row.tradeGroup}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100 truncate max-w-[140px]">
                    {row.businessPartner}
                  </td>

                  {/* Date Entries */}
                  {dates.map((date) => {
                    const entry = row.dailyEntries[date] || { days: 0, otHours: 0 };
                    return (
                      <Fragment key={`${row.id}-${date}`}>
                        <td className="px-2 py-2 text-center tabular-nums text-slate-700 font-mono">
                          {entry.days > 0 ? entry.days : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="px-2 py-2 text-center tabular-nums font-mono border-r border-slate-100">
                          {entry.otHours > 0 ? (
                            <span className="text-amber-700 font-medium">
                              {entry.otHours.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </Fragment>
                    );
                  })}

                  {/* Row Totals */}
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900 bg-slate-50/40">
                    {row.totalDays}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-amber-700 bg-amber-50/20">
                    {row.totalOtHours > 0 ? row.totalOtHours.toFixed(1) : '0.0'}
                  </td>
                </tr>
              ))}
            </tbody>

            {/* Table Footer with Aggregates */}
            <tfoot>
              <tr className="bg-slate-100/90 border-t-2 border-slate-200 text-xs font-medium text-slate-800">
                <td
                  colSpan={3}
                  className="sticky left-0 z-20 bg-slate-100 px-4 py-3 uppercase tracking-wider font-semibold border-r border-slate-200 shadow-[1px_0_0_0_#cbd5e1]"
                >
                  Total ({items.length} workers)
                </td>

                {dates.map((date) => {
                  const dTot = totals.dateTotals[date] || { days: 0, otHours: 0 };
                  return (
                    <Fragment key={`tot-${date}`}>
                      <td className="px-2 py-2.5 text-center tabular-nums font-semibold text-slate-900 font-mono">
                        {dTot.days}
                      </td>
                      <td className="px-2 py-2.5 text-center tabular-nums font-semibold text-amber-700 font-mono border-r border-slate-200">
                        {dTot.otHours > 0 ? dTot.otHours.toFixed(1) : '0'}
                      </td>
                    </Fragment>
                  );
                })}

                <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900 text-sm bg-blue-100/50">
                  {totals.totalDays}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold text-amber-800 text-sm bg-amber-100/50">
                  {totals.totalOtHours.toFixed(1)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
