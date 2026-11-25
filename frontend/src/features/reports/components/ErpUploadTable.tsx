/**
 * ErpUploadTable.tsx — TanStack Table view for ERP Upload Export.
 * Matches GET /api/reports/erp-upload.
 *
 * Powered by @tanstack/react-table with pagination (25/50/100/250), sorting,
 * and deferred quick search so thousands of rows render instantaneously.
 */
import { useState, useMemo, useDeferredValue, useCallback } from 'react';
import { formatEmployeeTypeLabel, isExternalEmployeeTypeClient } from '../../../utils/employeeTypes';
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
import type { ErpUploadResponse, ErpUploadRow } from '../services/reportService';
import { FileUp, Clock, Timer, Layers } from 'lucide-react';
import {
  ReportTableToolbar,
  ReportTablePagination,
  SortableHeader,
} from './ReportTableControls';

interface Props {
  data: ErpUploadResponse;
}

const erpGlobalFilterFn: FilterFn<ErpUploadRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue || '').trim().toLowerCase();
  if (!q) return true;
  const r = row.original;
  return Boolean(
    r.employeeName?.toLowerCase().includes(q) ||
      r.employeeId?.toLowerCase().includes(q) ||
      r.date?.toLowerCase().includes(q) ||
      r.activityCode?.toLowerCase().includes(q) ||
      r.activityDescription?.toLowerCase().includes(q) ||
      r.remarks?.toLowerCase().includes(q) ||
      r.employeeType?.toLowerCase().includes(q)
  );
};

export default function ErpUploadTable({ data }: Props) {
  const { rows, totalHours, totalOtHours, rowCount } = data;

  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 50,
  });

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    setPagination((prev) => (prev.pageIndex === 0 ? prev : { ...prev, pageIndex: 0 }));
  }, []);

  const columns = useMemo<ColumnDef<ErpUploadRow>[]>(
    () => [
      {
        accessorKey: 'employeeName',
        header: ({ column }) => <SortableHeader column={column} label="Employee" />,
        meta: { thClass: 'px-4 py-3 min-w-[180px]' },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div>
              <span className="font-medium text-slate-800">{r.employeeName}</span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-mono text-slate-400">{r.employeeId}</span>
                {r.employeeType && (
                  <span
                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-semibold uppercase tracking-wide border ${
                      !isExternalEmployeeTypeClient(r.employeeType)
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : 'bg-violet-50 text-violet-700 border-violet-200'
                    }`}
                  >
                    {formatEmployeeTypeLabel(r.employeeType)}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },
      {
        accessorKey: 'date',
        header: ({ column }) => <SortableHeader column={column} label="Date" />,
        meta: { thClass: 'px-4 py-3 min-w-[110px]', tdClass: 'px-4 py-3 font-mono text-slate-600 text-xs whitespace-nowrap' },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'activityCode',
        header: ({ column }) => <SortableHeader column={column} label="Activity" />,
        meta: { thClass: 'px-4 py-3 min-w-[200px]', tdClass: 'px-4 py-3 font-mono text-xs' },
        cell: ({ row }) => {
          const code = row.original.activityCode;
          const upper = code.toUpperCase();
          if (upper === 'OT') {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-amber-100 border border-amber-300 font-bold text-amber-900">
                OT
              </span>
            );
          }
          if (upper === 'ZIDLE') {
            return (
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-red-100 border border-red-300 font-bold text-red-800">
                ZIDLE
              </span>
            );
          }
          return (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium text-slate-800">
              {code}
            </span>
          );
        },
      },
      {
        accessorKey: 'hours',
        header: ({ column }) => <SortableHeader column={column} label="Hours" align="right" />,
        meta: { thClass: 'px-4 py-3 text-right min-w-[90px]' },
        cell: ({ row }) => {
          const r = row.original;
          const isOtRow = r.activityCode.toUpperCase() === 'OT';
          const isZidleRow = r.activityCode.toUpperCase() === 'ZIDLE';
          if (isOtRow) return <span className="text-slate-300">—</span>;
          if (isZidleRow) {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded bg-red-600 text-white font-mono text-xs font-bold shadow-xs">
                {r.hours < 0 ? `(${Math.abs(r.hours).toFixed(2)})` : r.hours.toFixed(2)}
              </span>
            );
          }
          return r.hours.toFixed(2);
        },
      },
      {
        accessorKey: 'overtimeHours',
        header: ({ column }) => <SortableHeader column={column} label="Overtime hours" align="right" />,
        meta: { thClass: 'px-4 py-3 text-right min-w-[110px]', tdClass: 'px-4 py-3 text-right tabular-nums' },
        cell: ({ row }) => {
          const r = row.original;
          const isOtRow = r.activityCode.toUpperCase() === 'OT';
          return isOtRow && r.overtimeHours > 0 ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-bold font-mono">
              {r.overtimeHours.toFixed(1)}
            </span>
          ) : (
            <span className="text-slate-300">—</span>
          );
        },
      },
      {
        accessorKey: 'remarks',
        header: ({ column }) => <SortableHeader column={column} label="Remarks" />,
        meta: { thClass: 'px-4 py-3 min-w-[200px]', tdClass: 'px-4 py-3 text-slate-500 italic' },
        cell: ({ getValue }) => getValue<string>() || '—',
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: {
      sorting,
      globalFilter: deferredSearch,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: erpGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, idx) => row.id || `erp-${idx}`,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-4">
      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={14} className="text-slate-400" /> Export Rows
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {rowCount.toLocaleString()}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-slate-400" /> Total Standard Hours
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {totalHours.toFixed(2)}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-amber-200/70 bg-amber-50/40 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
            <Timer size={14} className="text-amber-500" /> Total OT Hours
          </span>
          <span className="text-xl font-medium text-amber-800 tabular-nums">
            {totalOtHours.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Export Format Note */}
      <div className="bg-blue-50/50 border border-blue-200/60 rounded-lg px-4 py-2.5 flex items-center gap-2 text-xs text-blue-800">
        <FileUp size={15} className="text-blue-600 flex-shrink-0" />
        <span>
          ERP Import File Preview: This tabular schema directly matches the SAP / IFS / ERP CSV batch import format.
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
        <ReportTableToolbar
          searchValue={searchInput}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search employee, date, activity…"
          totalCount={rows.length}
          filteredCount={filteredCount}
          pageRowCount={pageRows.length}
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          itemLabel="rows"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-500 uppercase tracking-wide"
                >
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as { thClass?: string } | undefined;
                    return (
                      <th key={header.id} className={meta?.thClass || 'px-4 py-3'}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>

            <tbody className="divide-y divide-slate-100 font-sans">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-xs text-slate-400">
                    {rows.length === 0 ? (
                      'No ERP upload rows found for the selected filters.'
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <span>No rows match &ldquo;{searchInput}&rdquo;.</span>
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
                  const isOtRow = orig.activityCode.toUpperCase() === 'OT';
                  const isZidleRow = orig.activityCode.toUpperCase() === 'ZIDLE';

                  return (
                    <tr
                      key={row.id}
                      className={`transition-colors text-xs ${
                        isOtRow
                          ? 'bg-amber-50/50 hover:bg-amber-50/80 font-medium'
                          : isZidleRow
                          ? 'bg-rose-50/40 hover:bg-rose-50/70 font-medium'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as { tdClass?: string } | undefined;
                        const isHoursCol = cell.column.id === 'hours';
                        const tdClass = isHoursCol
                          ? `px-4 py-3 text-right tabular-nums font-medium ${
                              isZidleRow ? 'text-red-700 font-bold' : 'text-slate-800'
                            }`
                          : meta?.tdClass || 'px-4 py-3';

                        return (
                          <td key={cell.id} className={tdClass}>
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>

            <tfoot>
              <tr className="bg-slate-50/90 border-t-2 border-slate-200 text-xs font-medium text-slate-800">
                <td colSpan={3} className="px-4 py-3 uppercase tracking-wider font-semibold">
                  Grand Total ({rowCount.toLocaleString()} rows)
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-slate-900">
                  {totalHours.toFixed(1)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-amber-700">
                  {totalOtHours.toFixed(1)}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>

        <ReportTablePagination
          table={table}
          totalCount={rows.length}
          filteredCount={filteredCount}
          itemLabel="rows"
        />
      </div>
    </div>
  );
}
