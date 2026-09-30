/**
 * EquipmentErpUploadTable.tsx — Equipment ERP Upload Matrix.
 *
 * Pixel-perfect implementation matching the user's uploaded Excel reference:
 *   - Columns: Equipment | Condition | Unit | Date | Activity | Utilization
 *   - Direct Excel spreadsheet export (.xlsx) with matching formatting
 *   - Clean, lightweight tabular view
 */
import React from 'react';
import type { EquipmentErpUploadResponse } from '../services/reportService';
import { exportEquipmentErpToExcel } from '../services/excelExport';
import { Download, FileSpreadsheet } from 'lucide-react';

interface Props {
  data: EquipmentErpUploadResponse;
}

export const EquipmentErpUploadTable: React.FC<Props> = ({ data }) => {
  const [isExporting, setIsExporting] = React.useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await exportEquipmentErpToExcel(data);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* ── Summary & Export Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="p-1.5 bg-purple-50 text-purple-700 rounded-lg">
            <FileSpreadsheet size={18} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>Equipment ERP Upload File</span>
              <span className="text-[11px] font-normal text-slate-500 font-mono">({data.totalRows} rows)</span>
            </h3>
            <p className="text-xs text-slate-500">
              Direct Maga SAP/ERP batch upload format for plant equipment
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || data.rows.length === 0}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
        >
          <Download size={14} className="text-emerald-700" />
          <span>{isExporting ? 'Exporting…' : 'Download ERP Excel (.xlsx)'}</span>
        </button>
      </div>

      {/* ── Excel-Styled Data Table (Matching User Image 2) ── */}
      <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold tracking-wide">
                <th className="px-4 py-2.5 border-r border-slate-300 w-36">
                  Equipment
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-28 text-center">
                  Condition
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-24 text-center">
                  Unit
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-32 text-center">
                  Date
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-36 text-center">
                  Activity
                </th>
                <th className="px-4 py-2.5 text-right w-32">
                  Utilization
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 font-sans">
                    No equipment ERP rows generated for the selected filters.
                  </td>
                </tr>
              ) : (
                data.rows.map((row, idx) => (
                  <tr key={`${row.equipment}-${idx}`} className="hover:bg-slate-50/70 transition-colors h-[28px]">
                    <td className="px-4 py-1.5 border-r border-slate-300 font-bold text-slate-900">
                      {row.equipment}
                    </td>
                    <td className="px-4 py-1.5 border-r border-slate-300 text-center font-semibold text-slate-800">
                      {row.condition}
                    </td>
                    <td className="px-4 py-1.5 border-r border-slate-300 text-center text-slate-700">
                      {row.unit}
                    </td>
                    <td className="px-4 py-1.5 border-r border-slate-300 text-center text-slate-700">
                      {row.date}
                    </td>
                    <td className="px-4 py-1.5 border-r border-slate-300 text-center text-slate-700">
                      {row.activity}
                    </td>
                    <td className="px-4 py-1.5 text-right font-bold tabular-nums text-slate-900">
                      {row.utilization}
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
