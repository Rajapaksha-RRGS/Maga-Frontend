/**
 * OperatorErpUploadTable.tsx — Plant Operator ERP Upload Preview & Export.
 *
 * Implements the user's uploaded Excel specification for Maga SAP/ERP batch upload:
 *   - Columns: Employee | Date | Equipment | Condition | Unit | Hours | Overtime Hours | Remarks
 *   - Dual Export:
 *       1. Comma-delimited CSV (.csv) with UTF-8 BOM (per user's direct instruction)
 *       2. Excel spreadsheet (.xlsx) with purple "Upload Details" header styling
 *   - Maintains 100% visual and layout consistency with existing Labor & Equipment tables.
 */
import React, { useState, useMemo } from 'react';
import type { OperatorErpUploadResponse } from '../services/reportService';
import { exportOperatorErpToExcel, exportOperatorErpToCsv } from '../services/excelExport';
import { 
  Download, 
  FileSpreadsheet, 
  FileText, 
  Layers, 
  Clock, 
  Timer, 
  Search,
  CheckCircle2
} from 'lucide-react';

interface Props {
  data: OperatorErpUploadResponse;
}

export const OperatorErpUploadTable: React.FC<Props> = ({ data }) => {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Handle CSV export (comma-delimited)
  const handleExportCsv = () => {
    try {
      setIsExportingCsv(true);
      exportOperatorErpToCsv(data);
    } catch (err) {
      console.error('CSV Export failed:', err);
    } finally {
      setIsExportingCsv(false);
    }
  };

  // Handle Excel export (.xlsx)
  const handleExportExcel = async () => {
    try {
      setIsExportingExcel(true);
      await exportOperatorErpToExcel(data);
    } catch (err) {
      console.error('Excel Export failed:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  // Filter rows based on search
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return data.rows;
    const q = searchTerm.toLowerCase();
    return data.rows.filter(
      (r) =>
        r.employee.toLowerCase().includes(q) ||
        r.employeeName.toLowerCase().includes(q) ||
        r.equipment.toLowerCase().includes(q) ||
        r.date.includes(q)
    );
  }, [data.rows, searchTerm]);

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* ── Metric Summary Cards (Labor/Equipment standard design) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={14} className="text-slate-400" /> Total Export Rows
          </span>
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {data.totalRows}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400" /> Regular Equipment Hours
          </span>
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {data.totalHours.toFixed(2)}
            <span className="text-xs font-normal text-slate-500 ml-1">hrs</span>
          </span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
            <Timer size={14} className="text-amber-500" /> Total Overtime (OT)
          </span>
          <span className="text-2xl font-bold text-amber-900 tabular-nums">
            {data.totalOtHours.toFixed(2)}
            <span className="text-xs font-normal text-amber-600 ml-1">hrs</span>
          </span>
        </div>
      </div>

      {/* ── Top Bar: Search & Dual Export (CSV + Excel) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-purple-50 text-purple-700 rounded-lg">
            <FileSpreadsheet size={18} />
          </span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <span>Operator ERP Batch Upload</span>
              <span className="text-xs font-normal text-slate-500 font-mono">
                ({filteredRows.length} {filteredRows.length === 1 ? 'row' : 'rows'})
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Maga SAP/ERP format with multi-machine splits and overtime batch lines
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search emp / equipment…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
            />
          </div>

          {/* Download CSV Button (Comma-delimited - Primary requirement from user) */}
          <button
            onClick={handleExportCsv}
            disabled={isExportingCsv || data.rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-colors shadow-2xs disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
            title="Download standard comma-delimited (.csv) file for ERP import"
          >
            <FileText size={14} />
            <span>{isExportingCsv ? 'Generating…' : 'Download CSV (.csv)'}</span>
          </button>

          {/* Download Excel Button */}
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || data.rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            title="Download formatted Excel (.xlsx) file"
          >
            <Download size={14} className="text-purple-700" />
            <span>{isExportingExcel ? 'Exporting…' : 'Download Excel (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {/* ── Table Container ── */}
      <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse font-sans">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold tracking-wide">
                <th className="px-4 py-2.5 border-r border-slate-300 min-w-[140px]">
                  Employee
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-28 text-center">
                  Date
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 min-w-[120px]">
                  Equipment
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-24 text-center">
                  Condition
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-20 text-center">
                  Unit
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-24 text-right">
                  Hours
                </th>
                <th className="px-4 py-2.5 border-r border-slate-300 w-28 text-right">
                  Overtime Hours
                </th>
                <th className="px-4 py-2.5 min-w-[140px]">
                  Remarks
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-400 font-sans">
                    {data.rows.length === 0
                      ? 'No operator ERP upload rows found for the selected dates.'
                      : 'No rows match your search query.'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const isOt = row.isOtRow || row.equipment.toUpperCase() === 'OT';

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors h-[32px] ${
                        isOt
                          ? 'bg-amber-50/50 hover:bg-amber-50/80 font-medium'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Employee Code & Name */}
                      <td className="px-4 py-2 border-r border-slate-200">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 font-mono">
                            {row.employee}
                          </span>
                          <span className="text-[10px] text-slate-500 leading-tight">
                            {row.employeeName}
                          </span>
                        </div>
                      </td>

                      {/* Date (DD-MM-YYYY) */}
                      <td className="px-4 py-2 border-r border-slate-200 text-center font-mono text-slate-700">
                        {row.date}
                      </td>

                      {/* Equipment */}
                      <td className="px-4 py-2 border-r border-slate-200">
                        {isOt ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 border border-amber-300 font-bold text-amber-900 font-mono text-[11px]">
                            OT
                          </span>
                        ) : (
                          <span className="font-bold text-slate-800 font-mono">
                            {row.equipment}
                          </span>
                        )}
                      </td>

                      {/* Condition */}
                      <td className="px-4 py-2 border-r border-slate-200 text-center">
                        {row.condition ? (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
                            {row.condition}
                          </span>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {/* Unit */}
                      <td className="px-4 py-2 border-r border-slate-200 text-center font-mono text-slate-600">
                        {row.unit || <span className="text-slate-300">-</span>}
                      </td>

                      {/* Hours */}
                      <td className="px-4 py-2 border-r border-slate-200 text-right font-mono font-bold tabular-nums text-slate-900">
                        {row.hours || <span className="text-slate-300 font-normal">-</span>}
                      </td>

                      {/* Overtime Hours */}
                      <td className="px-4 py-2 border-r border-slate-200 text-right font-mono tabular-nums">
                        {row.overtimeHours ? (
                          <span className="font-bold text-amber-900">
                            {row.overtimeHours}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>

                      {/* Remarks */}
                      <td className="px-4 py-2 text-slate-600 truncate max-w-[200px]">
                        {row.remarks || <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer Totals */}
            {filteredRows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-semibold text-slate-800">
                  <td colSpan={5} className="px-4 py-2.5 border-r border-slate-200 text-right">
                    Total ({filteredRows.length} rows):
                  </td>
                  <td className="px-4 py-2.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                    {data.totalHours.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 border-r border-slate-200 text-right font-mono font-bold text-amber-900">
                    {data.totalOtHours.toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-400">
                    Verified Maga SAP Batch
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
};

