/**
 * EquipmentEntrySheetView.tsx — Official Maga Engineering Equipment Entry Sheet.
 *
 * Pixel-perfect implementation matching the user's uploaded reference:
 *   - Maga Engineering Letterhead (Address, Tel, Fax, Email)
 *   - Equipment Entry Sheet header with Date, Sheet No, Prepared By, Project / Activity Centre
 *   - Full table: Vehicle No / Maga No | Equipment | Business Partner | Condition | Unit | Min Util | Total Util | Total Mileage | Signature
 *   - A4 Print / PDF ready format with standard bordered cells
 */
import React from 'react';
import type { EquipmentSummaryResponse } from '../services/reportService';
import { Printer, Download, Truck } from 'lucide-react';

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

  return (
    <div className="flex flex-col gap-4">
      {/* ── Action Toolbar (Hidden during Print) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs print:hidden">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-orange-50 text-orange-700 rounded-lg">
            <Truck size={18} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-800">
              Official Equipment Entry Sheet
            </h3>
            <p className="text-xs text-slate-500">
              Standard Maga Engineering plant inventory & utilization report
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onExportExcel && (
            <button
              onClick={onExportExcel}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Download size={14} className="text-emerald-700" />
              <span>{isExporting ? 'Exporting…' : 'Export Excel'}</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors shadow-2xs"
          >
            <Printer size={14} className="text-slate-600" />
            <span>Print Official Sheet</span>
          </button>
        </div>
      </div>

      {/* ── Official Document Container (A4 Printable Layout) ── */}
      <div className="bg-white p-6 sm:p-8 rounded-xl border border-slate-300 shadow-xs print:shadow-none print:border-none print:p-0 text-slate-900 font-sans text-xs">
        
        {/* ── Top Header Grid (Exactly matching User Image 1) ── */}
        <div className="border border-slate-400 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-400">
          
          {/* Left Block: Company Letterhead */}
          <div className="p-3 flex flex-col gap-0.5">
            <h2 className="font-bold text-sm tracking-tight text-slate-900">
              {data.companyName}
            </h2>
            <div className="text-[11px] text-slate-800 leading-tight">
              {data.address}
            </div>
            <div className="text-[11px] text-slate-800 font-mono mt-0.5">
              Tel : {data.phone} &nbsp;&nbsp; Fax : {data.fax}
            </div>
            <div className="text-[11px] text-slate-800 font-mono">
              Email : {data.email}
            </div>
          </div>

          {/* Right Block: Sheet Details & Date */}
          <div className="flex flex-col">
            {/* Sheet Header Banner */}
            <div className="bg-slate-100 py-1 px-3 border-b border-slate-400 text-center font-bold tracking-wider text-xs uppercase text-slate-800">
              {data.sheetTitle}
            </div>

            {/* Metadata Rows */}
            <div className="divide-y divide-slate-400 flex-1">
              <div className="grid grid-cols-3 divide-x divide-slate-400 text-[11px]">
                <div className="px-2 py-1 font-semibold text-slate-800">Date</div>
                <div className="col-span-2 px-2 py-1 font-mono font-bold text-center bg-blue-50/50">
                  {data.date}
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-400 text-[11px]">
                <div className="px-2 py-1 font-semibold text-slate-800">Sheet No</div>
                <div className="col-span-2 px-2 py-1 font-mono">
                  EES-{data.date.slice(0, 7)}
                </div>
              </div>

              <div className="grid grid-cols-3 divide-x divide-slate-400 text-[11px]">
                <div className="px-2 py-1 font-semibold text-slate-800">Prepared By</div>
                <div className="col-span-2 px-2 py-1 font-medium">
                  Site Supervisor / Plant Eng.
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Project / Activity Centre Banner */}
        <div className="border-x border-b border-slate-400 grid grid-cols-6 divide-x divide-slate-400 bg-slate-50/80">
          <div className="col-span-2 px-3 py-1 font-bold text-[11px] uppercase tracking-wide text-slate-800">
            Project / Activity Centre:
          </div>
          <div className="col-span-4 px-3 py-1 font-semibold text-[11px] text-slate-800">
            Maga Central Project Operations
          </div>
        </div>

        {/* ── Table (Matching Columns of User Image 1) ── */}
        <div className="overflow-x-auto border-x border-b border-slate-400">
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-400 font-bold text-[11px] text-slate-800">
                <th className="border-r border-slate-400 py-1.5 px-2 text-left w-32">
                  Vehicle No. / Maga No.
                </th>
                <th className="border-r border-slate-400 py-1.5 px-2 text-left">
                  Equipment
                </th>
                <th className="border-r border-slate-400 py-1.5 px-2 w-28">
                  Business Partner
                </th>
                <th className="border-r border-slate-400 py-1.5 px-1 w-16">
                  Condition
                </th>
                <th className="border-r border-slate-400 py-1.5 px-1 w-14">
                  Unit
                </th>
                <th className="border-r border-slate-400 py-1.5 px-2 w-24">
                  Minimum Utilization
                </th>
                <th className="border-r border-slate-400 py-1.5 px-2 w-24">
                  Total Utilization
                </th>
                <th className="border-r border-slate-400 py-1.5 px-2 w-20">
                  Total Mileage
                </th>
                <th className="py-1.5 px-2 w-24">
                  Signature
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 font-mono text-[11px]">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-400 font-sans">
                    No equipment units found matching the selected period.
                  </td>
                </tr>
              ) : (
                data.rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors h-[23px] print:h-[20px]">
                    <td className="border-r border-slate-300 px-2 text-left font-bold font-mono">
                      {row.vehicleOrMagaNo}
                    </td>
                    <td className="border-r border-slate-300 px-2 text-left font-sans font-medium text-slate-800 truncate max-w-[200px]">
                      {row.equipmentName || '—'}
                    </td>
                    <td className="border-r border-slate-300 px-2 font-sans text-slate-600">
                      {row.businessPartner === '—' ? '-' : row.businessPartner}
                    </td>
                    <td className="border-r border-slate-300 px-1 font-bold text-center">
                      {row.condition}
                    </td>
                    <td className="border-r border-slate-300 px-1 text-center font-sans">
                      {row.unit}
                    </td>
                    <td className="border-r border-slate-300 px-2 text-right">
                      {row.minUtilization === '—' ? '-' : row.minUtilization}
                    </td>
                    <td className="border-r border-slate-300 px-2 text-right font-bold font-mono">
                      {row.totalUtilization === '—' ? '-' : row.totalUtilization}
                    </td>
                    <td className="border-r border-slate-300 px-2 text-right">
                      {row.totalMileage === '—' ? '-' : row.totalMileage}
                    </td>
                    <td className="px-2 text-center text-slate-300">
                      {/* Signature line placeholder */}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Signatures Sign-Off Footer ── */}
        <div className="grid grid-cols-3 gap-8 pt-8 pb-3 px-4 print:pt-6">
          <div className="text-center flex flex-col items-center">
            <div className="w-40 border-b border-slate-400 mb-1" />
            <span className="text-[10px] font-bold uppercase text-slate-700">Prepared By (Plant In-Charge)</span>
          </div>

          <div className="text-center flex flex-col items-center">
            <div className="w-40 border-b border-slate-400 mb-1" />
            <span className="text-[10px] font-bold uppercase text-slate-700">Checked By (Site Accountant)</span>
          </div>

          <div className="text-center flex flex-col items-center">
            <div className="w-40 border-b border-slate-400 mb-1" />
            <span className="text-[10px] font-bold uppercase text-slate-700">Approved By (Project Manager)</span>
          </div>
        </div>

      </div>
    </div>
  );
};
