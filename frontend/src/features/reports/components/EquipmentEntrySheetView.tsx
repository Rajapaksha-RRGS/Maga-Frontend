/**
 * EquipmentEntrySheetView.tsx — Unified Interactive Table View for Equipment Entry Sheet.
 *
 * Implements:
 *   - Screen Real Estate & Readability (Zero clutter, high data density)
 *   - Consistency Across All Reports (Matches BpBillTable & EquipmentRunningChartTable styling)
 *   - Interactive Table View with KPI summary metrics, condition badges, and tabular numbers
 *   - Full official Maga Letterhead & Sign-off retained specifically for Print & Excel Export
 */
import React, { useMemo } from 'react';
import type { EquipmentSummaryResponse } from '../services/reportService';
import { Truck, Clock, Gauge, Building2, Download, Printer, Calendar } from 'lucide-react';

interface Props {
  data: EquipmentSummaryResponse;
  onExportExcel?: () => void;
  isExporting?: boolean;
}

export const EquipmentEntrySheetView: React.FC<Props> = ({ 
  data, 
  onExportExcel,
  isExporting = false 
}) => {
  const handlePrint = () => {
    window.print();
  };

  const totals = useMemo(() => {
    if (data.totals) return data.totals;
    let totalUtilization = 0;
    let totalMileage = 0;
    for (const r of data.rows) {
      const u = parseFloat(r.totalUtilization);
      if (!isNaN(u)) totalUtilization += u;
      const m = parseFloat(r.totalMileage);
      if (!isNaN(m)) totalMileage += m;
    }
    return {
      totalUtilization: Number(totalUtilization.toFixed(2)),
      totalMileage: Number(totalMileage.toFixed(2)),
    };
  }, [data]);

  // Compute unique business partners count
  const uniqueBpsCount = useMemo(() => {
    const bps = new Set(data.rows.map((r) => r.businessPartner).filter((b) => b && b !== '—' && b !== '-'));
    return bps.size;
  }, [data.rows]);

  return (
    <div className="flex flex-col gap-4">
      {/* ── KPI Metric Cards (Clean, Consistent Neutral Tone matching BpBill & RunningChart) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Truck size={14} className="text-slate-400" /> Plant Units
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {data.rows.length} <span className="text-xs font-normal text-slate-400">vehicles</span>
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-blue-500" /> Total Utilization
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalUtilization.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Gauge size={14} className="text-emerald-500" /> Total Mileage
          </span>
          <span className="text-xl font-semibold text-emerald-900 tabular-nums">
            {totals.totalMileage.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}{' '}
            <span className="text-xs font-normal text-slate-400">km</span>
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 size={14} className="text-purple-500" /> Partners
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {uniqueBpsCount}{' '}
            <span className="text-xs font-normal text-slate-400">subcontractors</span>
          </span>
        </div>
      </div>

      {/* ── Official Print Header (Only visible during window.print) ── */}
      <div className="hidden print:block p-4 border border-slate-900 mb-2 font-sans text-xs">
        <div className="grid grid-cols-2 divide-x divide-slate-900">
          <div className="pr-4">
            <h2 className="font-bold text-sm text-slate-950 uppercase">{data.companyName}</h2>
            <p className="text-[10px] text-slate-700">{data.address}</p>
            <p className="text-[10px] text-slate-700 font-mono">Tel: {data.phone}  Fax: {data.fax}</p>
          </div>
          <div className="pl-4 flex flex-col justify-between">
            <div className="font-bold text-center text-xs tracking-wider uppercase bg-slate-100 py-1">
              {data.sheetTitle || 'EQUIPMENT ENTRY SHEET'}
            </div>
            <div className="text-[10px] grid grid-cols-2 mt-1">
              <span><strong>Period:</strong> {data.periodText || data.date}</span>
              <span><strong>Sheet No:</strong> {data.sheetNo}</span>
              <span><strong>Prepared By:</strong> {data.preparedBy}</span>
              <span><strong>Site:</strong> {data.projectCentre}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Data Table Card (Consistent with BpBill & RunningChart) ── */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden print:border-none print:shadow-none">
        
        {/* Table Toolbar Header */}
        <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2 print:hidden">
          <div className="flex items-center gap-2">
            <span className="p-1 bg-orange-100 text-orange-800 rounded-md">
              <Truck size={15} />
            </span>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">
                Equipment Entry & Utilization Table
              </h2>
              <p className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                <Calendar size={11} className="text-slate-400" />
                <span>Period: <strong className="text-slate-700">{data.periodText || data.date}</strong></span>
                <span className="text-slate-300">•</span>
                <span>Site: <strong className="text-slate-700">{data.projectCentre}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onExportExcel && (
              <button
                type="button"
                onClick={onExportExcel}
                disabled={isExporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors disabled:opacity-50"
              >
                <Download size={13} className="text-emerald-700" />
                <span>{isExporting ? 'Exporting…' : 'Export Excel'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs transition-colors"
            >
              <Printer size={13} className="text-slate-600" />
              <span>Print Official Sheet</span>
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto max-w-full">
          <table className="w-full text-xs text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-[11px] uppercase tracking-wider">
                <th className="px-4 py-3 whitespace-nowrap">Vehicle No. / Maga No.</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Equipment Name</th>
                <th className="px-3.5 py-3 whitespace-nowrap">Business Partner</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Condition</th>
                <th className="px-3 py-3 text-center whitespace-nowrap">Unit</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">Min. Utilization</th>
                <th className="px-3.5 py-3 text-right whitespace-nowrap">Total Utilization</th>
                <th className="px-4 py-3 text-right whitespace-nowrap">Total Mileage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400">
                    <Truck size={32} className="mx-auto text-slate-300 mb-2 stroke-1" />
                    No equipment units found matching the selected period.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Vehicle / Maga No */}
                    <td className="px-4 py-2.5 font-bold font-mono text-slate-900 whitespace-nowrap">
                      {row.vehicleOrMagaNo}
                    </td>

                    {/* Equipment Name */}
                    <td className="px-3.5 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                      {row.equipmentName || '—'}
                    </td>

                    {/* Business Partner */}
                    <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                      {row.businessPartner === '—' ? '-' : row.businessPartner}
                    </td>

                    {/* Condition */}
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">
                      <span className={[
                        'px-2 py-0.5 rounded text-[10px] font-semibold uppercase',
                        row.condition.toUpperCase() === 'DRY'
                          ? 'bg-amber-50 text-amber-800 border border-amber-200'
                          : 'bg-blue-50 text-blue-800 border border-blue-200',
                      ].join(' ')}>
                        {row.condition}
                      </span>
                    </td>

                    {/* Primary Unit */}
                    <td className="px-3 py-2.5 text-center font-mono text-slate-600 whitespace-nowrap">
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 text-[11px]">
                        {row.unit}
                      </span>
                    </td>

                    {/* Minimum Utilization */}
                    <td className="px-3.5 py-2.5 text-right font-mono text-slate-600 tabular-nums whitespace-nowrap">
                      {row.minUtilization === '—' ? '-' : row.minUtilization}
                    </td>

                    {/* Total Utilization */}
                    <td className="px-3.5 py-2.5 text-right font-mono font-bold text-blue-900 tabular-nums whitespace-nowrap bg-blue-50/20">
                      {row.totalUtilization === '—' ? '-' : (
                        row.unit.toLowerCase() === 'mth' ? (
                          <span title={`${row.totalUtilization} Days worked (Standard 26 days/mth)`}>
                            {row.totalUtilization} Days
                            <span className="text-[10px] text-emerald-700 ml-1 font-semibold">
                              ({(Number(row.totalUtilization) >= 25 ? 1.0 : (Number(row.totalUtilization) / 26)).toFixed(2)} mth)
                            </span>
                          </span>
                        ) : row.totalUtilization
                      )}
                    </td>

                    {/* Total Mileage */}
                    <td className="px-4 py-2.5 text-right font-mono text-emerald-800 tabular-nums whitespace-nowrap">
                      {row.totalMileage === '—' ? '-' : `${row.totalMileage} km`}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Grand Totals Footer Row */}
            {data.rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-bold text-xs text-slate-800">
                  <td colSpan={5} className="px-4 py-3 text-right uppercase tracking-wide text-slate-900">
                    Grand Total ({data.rows.length} Units) :
                  </td>
                  <td className="px-3.5 py-3 text-center text-slate-400">
                    —
                  </td>
                  <td className="px-3.5 py-3 text-right font-mono font-bold text-blue-900 tabular-nums bg-blue-50/50">
                    {totals.totalUtilization.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-900 tabular-nums bg-emerald-50/50">
                    {totals.totalMileage.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── Official Print Sign-off Footer (Only visible during window.print) ── */}
        <div className="hidden print:grid grid-cols-3 gap-8 pt-8 pb-3 px-4 text-center text-[10px]">
          <div>
            <div className="border-t border-slate-800 pt-1 font-semibold uppercase">Prepared By (Plant In-Charge)</div>
            <span className="text-[9px] text-slate-500">{data.preparedBy}</span>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-1 font-semibold uppercase">Checked By (Site Accountant)</div>
          </div>
          <div>
            <div className="border-t border-slate-800 pt-1 font-semibold uppercase">Approved By (Project Manager)</div>
          </div>
        </div>

      </div>
    </div>
  );
};
