/**
 * BpBillTable.tsx — Business Partner Bill Report.
 * Matches GET /api/reports/bp-bill.
 *
 * Rules:
 *   - Grouped by Business Partner (distinct section/header per partner).
 *   - Per-employee hours-per-date grid.
 *   - Total Hrs / Hourly Rate / Total Hourly Payment / 10% O/H / Total Cost columns at the end.
 *   - Partner subtotals and overall Grand Totals.
 *   - Wrapped in overflow-x-auto container.
 */
import type { BpBillResponse } from '../services/reportService';
import { Building2, DollarSign, Receipt, Percent } from 'lucide-react';

interface Props {
  data: BpBillResponse;
}

/** Format currency numbers as LKR 123,456.78 */
function formatLKR(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format date to short header */
function formatShortDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

export default function BpBillTable({ data }: Props) {
  const { dates, groups, grandTotalHours, grandTotalPayment, grandTotalOverhead, grandTotalCost } = data;

  return (
    <div className="flex flex-col gap-5">
      {/* Grand Total Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 size={14} className="text-slate-400" /> Partners
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {groups.length}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Receipt size={14} className="text-slate-400" /> Total Hours
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {grandTotalHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Percent size={14} className="text-slate-400" /> Base Payment
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            LKR {formatLKR(grandTotalPayment)}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-blue-200/80 bg-blue-50/40 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-blue-700 uppercase tracking-wide flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-blue-600" /> Total Cost
            </span>
            <span className="text-[10px] text-blue-600/80 font-normal">
              +10% OH (LKR {formatLKR(grandTotalOverhead)})
            </span>
          </span>
          <span className="text-xl font-semibold text-blue-900 tabular-nums">
            LKR {formatLKR(grandTotalCost)}
          </span>
        </div>
      </div>

      {/* Grouped Tables per Business Partner */}
      <div className="flex flex-col gap-6">
        {groups.map((group) => (
          <div
            key={group.businessPartner}
            className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden"
          >
            {/* Business Partner Section Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="text-blue-700" />
                <h2 className="font-semibold text-slate-800 text-sm">
                  {group.businessPartner}
                </h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full">
                  {group.items.length} workers
                </span>
              </div>

              <div className="flex items-center gap-4 text-xs">
                <span className="text-slate-600">
                  Subtotal: <span className="font-medium text-slate-900 tabular-nums">{group.subtotalHours.toFixed(1)} hrs</span>
                </span>
                <span className="text-blue-700 font-semibold">
                  Cost: <span className="tabular-nums">LKR {formatLKR(group.subtotalCost)}</span>
                </span>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto max-w-full">
              <table className="w-full text-xs text-left border-collapse min-w-[900px]">
                <thead>
                  <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-medium text-[11px]">
                    <th className="sticky left-0 z-20 bg-slate-100/90 px-4 py-2.5 min-w-[160px] border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                      Employee
                    </th>
                    <th className="px-3 py-2.5 min-w-[100px] border-r border-slate-200">
                      Trade
                    </th>

                    {/* Date Grid */}
                    {dates.map((d) => (
                      <th
                        key={d}
                        className="px-2 py-2.5 text-center min-w-[40px] font-mono border-r border-slate-200 bg-slate-50/50"
                      >
                        {formatShortDate(d)}
                      </th>
                    ))}

                    {/* Calculation Columns */}
                    <th className="px-3 py-2.5 text-right font-medium text-slate-800 bg-slate-50 border-l border-slate-200">
                      Total Hrs
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-slate-700 bg-slate-50">
                      Rate (LKR)
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-slate-800 bg-slate-50">
                      Payment (LKR)
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-slate-700 bg-slate-50">
                      10% O/H
                    </th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-900 bg-blue-50/50 border-l border-slate-200">
                      Total Cost (LKR)
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {group.items.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Sticky Employee */}
                      <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 px-4 py-2.5 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                        <div className="font-medium text-slate-800">{item.employeeName}</div>
                        <div className="text-[10px] font-mono text-slate-400">{item.employeeId}</div>
                      </td>

                      <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">
                        {item.tradeGroup}
                      </td>

                      {/* Daily Hours */}
                      {dates.map((d) => {
                        const hrs = item.dailyHours[d] || 0;
                        return (
                          <td
                            key={d}
                            className="px-2 py-2 text-center tabular-nums font-mono border-r border-slate-100 text-slate-700"
                          >
                            {hrs > 0 ? hrs : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}

                      {/* Values */}
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800 border-l border-slate-200">
                        {item.totalHours.toFixed(1)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 font-mono">
                        {item.hourlyRate.toFixed(2)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-800 font-medium">
                        {formatLKR(item.totalHourlyPayment)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {formatLKR(item.overhead)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900 bg-blue-50/20 border-l border-slate-100">
                        {formatLKR(item.totalCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>

                {/* Subtotal Row */}
                <tfoot>
                  <tr className="bg-slate-50/90 border-t-2 border-slate-200 font-medium text-slate-800 text-xs">
                    <td
                      colSpan={2}
                      className="sticky left-0 z-20 bg-slate-50 px-4 py-3 uppercase tracking-wider font-semibold border-r border-slate-200 shadow-[1px_0_0_0_#cbd5e1]"
                    >
                      Subtotal ({group.businessPartner})
                    </td>

                    {dates.map((d) => (
                      <td key={d} className="px-2 py-3 border-r border-slate-200" />
                    ))}

                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900 border-l border-slate-200">
                      {group.subtotalHours.toFixed(1)}
                    </td>
                    <td className="px-3 py-3 text-right text-slate-400">—</td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">
                      {formatLKR(group.subtotalPayment)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-700">
                      {formatLKR(group.subtotalOverhead)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-900 bg-blue-100/40 border-l border-slate-200">
                      {formatLKR(group.subtotalCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
