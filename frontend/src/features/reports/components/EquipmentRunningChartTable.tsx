/**
 * EquipmentRunningChartTable.tsx — Modern, clean table for Equipment Running Chart.
 * Displays daily meter readings, working/idle/breakdown hours, fuel, condition, and status.
 */
import React from 'react';
import type { EquipmentRunningChartResponse } from '../services/reportService';
import { Truck, Clock, Fuel, AlertTriangle, Layers, CheckCircle } from 'lucide-react';

interface Props {
  data: EquipmentRunningChartResponse;
}

export const EquipmentRunningChartTable: React.FC<Props> = ({ data }) => {
  const { items, totals } = data;

  return (
    <div className="flex flex-col gap-4">
      {/* ── KPI Metrics Cards (Clean, Neutral Tone) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Truck size={14} className="text-slate-400" /> Plant Units Logged
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalRecords}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-blue-500" /> Net Running Hrs
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalNetHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={14} className="text-emerald-500" /> Working Hrs
          </span>
          <span className="text-xl font-semibold text-emerald-900 tabular-nums">
            {totals.totalWorkingHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/90 bg-amber-50/30 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" /> Idle Hours
          </span>
          <span className="text-xl font-semibold text-amber-900 tabular-nums">
            {totals.totalIdleHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs col-span-2 sm:col-span-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Fuel size={14} className="text-orange-500" /> Fuel Consumed
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalFuelLiters.toFixed(1)} <span className="text-xs font-normal text-slate-400">Liters</span>
          </span>
        </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-medium">
                <th className="px-3.5 py-3 text-center whitespace-nowrap">Date</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Equipment Code</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Name & Description</th>
                <th className="px-3.5 py-3 text-center whitespace-nowrap">Condition</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Supervisor</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Initial Meter</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Final Meter</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Net Running</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Working</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Idle</th>
                <th className="px-3 py-3 text-right whitespace-nowrap">Fuel (L)</th>
                <th className="px-3.5 py-3 whitespace-nowrap text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-10 text-center text-slate-400">
                    <Truck size={32} className="mx-auto text-slate-300 mb-2 stroke-1" />
                    No equipment running chart records found for this period.
                  </td>
                </tr>
              ) : (
                items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-3.5 py-2.5 text-center font-mono text-slate-600 whitespace-nowrap">
                      {item.date}
                    </td>
                    <td className="px-3.5 py-2.5 font-semibold text-slate-800 font-mono whitespace-nowrap">
                      {item.equipmentCode}
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-700 whitespace-nowrap">
                      <div className="font-medium">{item.equipmentName}</div>
                      {item.vehicleNo !== '—' && (
                        <div className="text-[11px] text-slate-400">Vehicle: {item.vehicleNo}</div>
                      )}
                    </td>
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      <span className={[
                        'px-2 py-0.5 rounded text-[11px] font-semibold',
                        item.condition.toUpperCase() === 'DRY' 
                          ? 'bg-amber-50 text-amber-800 border border-amber-200' 
                          : 'bg-blue-50 text-blue-800 border border-blue-200',
                      ].join(' ')}>
                        {item.condition}
                      </span>
                    </td>
                    <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                      {item.supervisorName}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                      {item.initialMeter.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums">
                      {item.finalMeter.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums bg-slate-50/50">
                      {item.netRunningHours.toFixed(1)} {item.primaryUnit}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-emerald-700 tabular-nums">
                      {item.workingHours.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-amber-700 tabular-nums">
                      {item.idleHours.toFixed(1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-slate-800 tabular-nums">
                      {item.fuelLiters > 0 ? `${item.fuelLiters.toFixed(1)} L` : '—'}
                    </td>
                    <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <CheckCircle size={11} className="text-emerald-600" />
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
