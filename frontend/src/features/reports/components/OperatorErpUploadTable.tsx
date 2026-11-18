/**
 * OperatorErpUploadTable.tsx — Plant Operator ERP Upload Preview & Export
 * powered by @tanstack/react-table.
 *
 * Implements the Maga SAP/ERP batch upload specification:
 *   - Columns: Employee | Date | Equipment | Condition | Unit | Hours | Overtime Hours | Remarks
 *   - TanStack pagination (25/50/100/250), sorting, and deferred search
 *   - Dual Export (all rows): CSV (.csv) + Excel (.xlsx)
 */
import React, { useState, useMemo, useDeferredValue, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type PaginationState,
  type FilterFn,
} from '@tanstack/react-table';
import type { OperatorErpUploadResponse, OperatorErpUploadRow } from '../services/reportService';
import { exportOperatorErpToExcel, exportOperatorErpToCsv } from '../services/excelExport';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Layers,
  Clock,
  Timer,
  Search,
  X,
} from 'lucide-react';
import { ReportTablePagination, SortableHeader } from './ReportTableControls';

interface Props {
  data: OperatorErpUploadResponse;
}

const operatorErpGlobalFilterFn: FilterFn<OperatorErpUploadRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue || '').trim().toLowerCase();
  if (!q) return true;
  const r = row.original;
  return Boolean(
    r.employee?.toLowerCase().includes(q) ||
      r.employeeName?.toLowerCase().includes(q) ||
      r.equipment?.toLowerCase().includes(q) ||
      r.date?.toLowerCase().includes(q) ||
      r.condition?.toLowerCase().includes(q) ||
      r.remarks?.toLowerCase().includes(q)
  );
};

export const OperatorErpUploadTable: React.FC<Props> = ({ data }) => {
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });

  const handleSearchChange = useCallback((val: string) => {
    setSearchTerm(val);
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, []);

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

  const columns = useMemo<ColumnDef<OperatorErpUploadRow>[]>(
    () => [
      {
        accessorKey: 'employee',
        header: ({ column }) => <SortableHeader column={column} label="Employee" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 min-w-[140px]',
          tdClass: 'px-4 py-2 border-r border-slate-200',
        },
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 font-mono">{row.original.employee}</span>
            <span className="text-[10px] text-slate-500 leading-tight">{row.original.employeeName}</span>
          </div>
        ),
      },
      {
        accessorKey: 'date',
        header: ({ column }) => <SortableHeader column={column} label="Date" align="center" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-28 text-center',
          tdClass: 'px-4 py-2 border-r border-slate-200 text-center font-mono text-slate-700 whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'equipment',
        header: ({ column }) => <SortableHeader column={column} label="Equipment" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 min-w-[120px]',
          tdClass: 'px-4 py-2 border-r border-slate-200',
        },
        cell: ({ row }) => {
          const r = row.original;
          const isOt = r.isOtRow || r.equipment.toUpperCase() === 'OT';
          return isOt ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 border border-amber-300 font-bold text-amber-900 font-mono text-[11px]">
              OT
            </span>
          ) : (
            <span className="font-bold text-slate-800 font-mono">{r.equipment}</span>
          );
        },
      },
      {
        accessorKey: 'condition',
        header: ({ column }) => <SortableHeader column={column} label="Condition" align="center" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-24 text-center',
          tdClass: 'px-4 py-2 border-r border-slate-200 text-center',
        },
        cell: ({ getValue }) => {
          const val = getValue<string>();
          return val ? (
            <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold text-[11px]">
              {val}
            </span>
          ) : (
            <span className="text-slate-300">-</span>
          );
        },
      },
      {
        accessorKey: 'unit',
        header: ({ column }) => <SortableHeader column={column} label="Unit" align="center" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-20 text-center',
          tdClass: 'px-4 py-2 border-r border-slate-200 text-center font-mono text-slate-600',
        },
        cell: ({ getValue }) => getValue<string>() || <span className="text-slate-300">-</span>,
      },
      {
        accessorKey: 'hours',
        header: ({ column }) => <SortableHeader column={column} label="Hours" align="right" />,
        sortingFn: (rowA, rowB) => (parseFloat(String(rowA.original.hours)) || 0) - (parseFloat(String(rowB.original.hours)) || 0),
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-24 text-right',
          tdClass: 'px-4 py-2 border-r border-slate-200 text-right font-mono font-bold tabular-nums text-slate-900',
        },
        cell: ({ getValue }) => getValue<string | number>() || <span className="text-slate-300 font-normal">-</span>,
      },
      {
        accessorKey: 'overtimeHours',
        header: ({ column }) => <SortableHeader column={column} label="Overtime Hours" align="right" />,
        sortingFn: (rowA, rowB) => (parseFloat(String(rowA.original.overtimeHours)) || 0) - (parseFloat(String(rowB.original.overtimeHours)) || 0),
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-28 text-right',
          tdClass: 'px-4 py-2 border-r border-slate-200 text-right font-mono tabular-nums',
        },
        cell: ({ getValue }) => {
          const val = getValue<string | number>();
          return val ? (
            <span className="font-bold text-amber-900">{val}</span>
          ) : (
            <span className="text-slate-300 font-normal">-</span>
          );
        },
      },
      {
        accessorKey: 'remarks',
        header: ({ column }) => <SortableHeader column={column} label="Remarks" />,
        meta: {
          thClass: 'px-4 py-2.5 min-w-[140px]',
          tdClass: 'px-4 py-2 text-slate-600 truncate max-w-[200px]',
        },
        cell: ({ getValue }) => getValue<string>() || <span className="text-slate-300">-</span>,
      },
    ],
    []
  );

  const table = useReactTable({
    data: data.rows,
    columns,
    state: {
      sorting,
      globalFilter: deferredSearch,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: operatorErpGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, idx) => row.id || `op-erp-${idx}`,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-4 font-sans">
      {/* ── Metric Summary Cards (Labor/Equipment standard design) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={14} className="text-slate-400" /> Total Export Rows
          </span>
          <span className="text-2xl font-bold text-slate-900 tabular-nums">
            {data.totalRows.toLocaleString()}
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
                ({filteredCount.toLocaleString()} {filteredCount === 1 ? 'row' : 'rows'})
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
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search emp / equipment…"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 sm:w-56"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => handleSearchChange('')}
                title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Download CSV Button */}
          <button
            onClick={handleExportCsv}
            disabled={isExportingCsv || data.rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-semibold transition-colors shadow-2xs disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
            title="Download standard comma-delimited (.csv) file for ERP import"
          >
            <FileText size={14} />
            <span>{isExportingCsv ? 'Generating…' : 'Download CSV (.csv)'}</span>
          </button>

          {/* Download Excel Button */}
          <button
            onClick={handleExportExcel}
            disabled={isExportingExcel || data.rows.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
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
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="bg-slate-100 border-b border-slate-300 text-slate-800 font-semibold tracking-wide"
                >
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as { thClass?: string } | undefined;
                    return (
                      <th key={header.id} className={meta?.thClass || 'px-4 py-2.5'}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-slate-200">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-12 text-center text-slate-400 font-sans">
                    {data.rows.length === 0 ? (
                      'No operator ERP upload rows found for the selected dates.'
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <span>No rows match &ldquo;{searchTerm}&rdquo;.</span>
                        <button
                          type="button"
                          onClick={() => handleSearchChange('')}
                          className="text-blue-600 hover:underline font-medium cursor-pointer"
                        >
                          Clear search
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  const orig = row.original;
                  const isOt = orig.isOtRow || orig.equipment.toUpperCase() === 'OT';

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors h-[32px] ${
                        isOt
                          ? 'bg-amber-50/50 hover:bg-amber-50/80 font-medium'
                          : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as { tdClass?: string } | undefined;
                        return (
                          <td key={cell.id} className={meta?.tdClass || 'px-4 py-2'}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer Totals */}
            {data.rows.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-300 font-semibold text-slate-800">
                  <td colSpan={5} className="px-4 py-2.5 border-r border-slate-200 text-right">
                    Grand Total ({data.totalRows.toLocaleString()} rows):
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

        <ReportTablePagination
          table={table}
          totalCount={data.rows.length}
          filteredCount={filteredCount}
          itemLabel="rows"
        />
      </div>
    </div>
  );
};
