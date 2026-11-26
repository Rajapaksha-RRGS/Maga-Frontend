import { useState } from 'react';
import { ChevronDown, ChevronRight, Users, Clock, DollarSign, AlertCircle, Printer } from 'lucide-react';
import type { SubcontractorDeductionResponse } from '../services/reportService';
import { useAuth } from '../../../context/AuthContext';
import { printSubcontractorDeductionBill } from '../utils/printBpBill';

interface Props {
  data: SubcontractorDeductionResponse;
}

const fmtLkr = (n: number) =>
  n.toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SubcontractorDeductionTable({ data }: Props) {
  const { user, tenant } = useAuth();
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    data.groups.forEach((g) => {
      init[g.subcontractorId] = true;
    });
    return init;
  });

  const toggleGroup = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Grand Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Users size={14} className="text-red-600" />
            <span>Subcontractors</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1">{data.groups.length}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Clock size={14} className="text-blue-600" />
            <span>Normal Hours</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {data.grandTotalNormalHours.toFixed(2)}h
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Clock size={14} className="text-amber-600" />
            <span>OT Hours</span>
          </div>
          <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
            {data.grandTotalOtHours.toFixed(2)}h
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center gap-2 text-xs font-bold text-red-700">
            <DollarSign size={14} className="text-red-600" />
            <span>Total Bill Deduction</span>
          </div>
          <div className="text-xl font-bold text-red-700 mt-1 font-mono">
            LKR {fmtLkr(data.grandTotalDeduction)}
          </div>
        </div>
      </div>

      {/* Grouped by Subcontractor */}
      {data.groups.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-sm text-slate-500">
          <AlertCircle size={20} className="mx-auto mb-2 text-slate-400" />
          No subcontractor manpower back-charge records found for the selected filters.
        </div>
      ) : (
        data.groups.map((grp) => {
          const isOpen = expandedIds[grp.subcontractorId] ?? true;
          return (
            <div
              key={grp.subcontractorId}
              className="bg-white border border-red-200 rounded-xl shadow-2xs overflow-hidden"
            >
              {/* Group Header */}
              <button
                type="button"
                onClick={() => toggleGroup(grp.subcontractorId)}
                className="w-full flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-red-50/70 hover:bg-red-50 border-b border-red-200 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  {isOpen ? (
                    <ChevronDown size={16} className="text-red-700" />
                  ) : (
                    <ChevronRight size={16} className="text-red-700" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">{grp.subcontractorName}</span>
                      <span className="text-[11px] font-mono font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                        {grp.subcontractorCode}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {grp.workerCount} worker(s) · {grp.items.length} entry split(s)
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="text-right">
                    <div className="text-slate-500">Total Hrs (N / OT)</div>
                    <div className="font-bold text-slate-900 font-mono">
                      {grp.totalSplitHours.toFixed(2)}h ({grp.totalNormalHours.toFixed(2)} / {grp.totalOtHours.toFixed(2)})
                    </div>
                  </div>
                  <div className="text-right pl-3 border-l border-red-200">
                    <div className="text-red-700 font-semibold">Deduct from Bill</div>
                    <div className="text-sm font-bold text-red-700 font-mono">
                      LKR {fmtLkr(grp.totalDeductionAmount)}
                    </div>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      e.stopPropagation();
                      printSubcontractorDeductionBill({
                        group: grp,
                        dateFrom: data.dateFrom,
                        dateTo: data.dateTo,
                        projectName: tenant?.name,
                        projectCode: tenant?.code,
                        preparedBy: user?.fullName,
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        printSubcontractorDeductionBill({
                          group: grp,
                          dateFrom: data.dateFrom,
                          dateTo: data.dateTo,
                          projectName: tenant?.name,
                          projectCode: tenant?.code,
                          preparedBy: user?.fullName,
                        });
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white border border-red-200 hover:bg-red-100/70 text-red-700 font-semibold shadow-2xs transition-colors cursor-pointer"
                  >
                    <Printer size={13} />
                    <span>Print / PDF</span>
                  </span>
                </div>
              </button>

              {/* Group Detail Table */}
              {isOpen && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Employee</th>
                        <th className="py-2.5 px-3">Source</th>
                        <th className="py-2.5 px-3">Activity</th>
                        <th className="py-2.5 px-3">In / Out</th>
                        <th className="py-2.5 px-3 text-right">Split Hrs</th>
                        <th className="py-2.5 px-3 text-right">Normal</th>
                        <th className="py-2.5 px-3 text-right">OT</th>
                        <th className="py-2.5 px-3 text-right">Daily Rate</th>
                        <th className="py-2.5 px-3 text-right text-red-700">Deduction (LKR)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {grp.items.map((item) => (
                        <tr key={item.id} className="hover:bg-red-50/30">
                          <td className="py-2 px-3 font-mono text-slate-700 whitespace-nowrap">{item.date}</td>
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-900">{item.employeeName}</div>
                            <div className="text-[10px] text-slate-500 font-mono">
                              {item.employeeCode} · {item.tradeGroup}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            {item.sourcePartnerCode ? (
                              <>
                                <div className="font-mono font-semibold text-slate-900">{item.sourcePartnerCode}</div>
                                <div className="text-[10px] text-slate-500">{item.sourcePartner}</div>
                              </>
                            ) : (
                              <span className="text-slate-600">{item.sourcePartner}</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-mono font-semibold text-red-700 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded">
                              {item.activityCode}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-600 whitespace-nowrap">
                            {item.inTime} – {item.outTime}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold text-slate-900">
                            {item.splitHours.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-700">
                            {item.normalHours.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-amber-700">
                            {item.otHours.toFixed(2)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono text-slate-600">
                            {fmtLkr(item.dailyRate)}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-red-700">
                            {fmtLkr(item.deductionAmount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
