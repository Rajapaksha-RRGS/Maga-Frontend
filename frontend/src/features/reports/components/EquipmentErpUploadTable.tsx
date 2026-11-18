/**
 * EquipmentErpUploadTable.tsx — Equipment ERP Upload Matrix powered by @tanstack/react-table.
 *
 * Features:
 *   - Columns: Equipment | Condition | Unit | Date | Activity | Utilization
 *   - TanStack pagination (25/50/100/250), column sorting, and deferred quick search
 *   - Direct Excel spreadsheet export (.xlsx) of all rows with matching formatting
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
import type { EquipmentErpUploadResponse, EquipmentErpUploadRow } from '../services/reportService';
import { exportEquipmentErpToExcel } from '../services/excelExport';
import { Download, FileSpreadsheet } from 'lucide-react';
import {
  ReportTableToolbar,
  ReportTablePagination,
  SortableHeader,
} from './ReportTableControls';

interface Props {
  data: EquipmentErpUploadResponse;
}

const equipmentErpGlobalFilterFn: FilterFn<EquipmentErpUploadRow> = (row, _columnId, filterValue) => {
  const q = String(filterValue || '').trim().toLowerCase();
  if (!q) return true;
  const r = row.original;
  return Boolean(
    r.equipment?.toLowerCase().includes(q) ||
      r.condition?.toLowerCase().includes(q) ||
      r.unit?.toLowerCase().includes(q) ||
      r.date?.toLowerCase().includes(q) ||
      r.activity?.toLowerCase().includes(q) ||
      r.utilization?.toLowerCase().includes(q)
  );
};

export const EquipmentErpUploadTable: React.FC<Props> = ({ data }) => {
  const [isExporting, setIsExporting] = useState(false);
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

  const columns = useMemo<ColumnDef<EquipmentErpUploadRow>[]>(
    () => [
      {
        accessorKey: 'equipment',
        header: ({ column }) => <SortableHeader column={column} label="Equipment" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-36',
          tdClass: 'px-4 py-1.5 border-r border-slate-300 font-bold text-slate-900',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'condition',
        header: ({ column }) => <SortableHeader column={column} label="Condition" align="center" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-28 text-center',
          tdClass: 'px-4 py-1.5 border-r border-slate-300 text-center font-semibold text-slate-800',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'unit',
        header: ({ column }) => <SortableHeader column={column} label="Unit" align="center" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-24 text-center',
          tdClass: 'px-4 py-1.5 border-r border-slate-300 text-center text-slate-700',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'date',
        header: ({ column }) => <SortableHeader column={column} label="Date" align="center" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-32 text-center',
          tdClass: 'px-4 py-1.5 border-r border-slate-300 text-center text-slate-700 whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'activity',
        header: ({ column }) => <SortableHeader column={column} label="Activity" align="center" />,
        meta: {
          thClass: 'px-4 py-2.5 border-r border-slate-300 w-36 text-center',
          tdClass: 'px-4 py-1.5 border-r border-slate-300 text-center text-slate-700',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'utilization',
        header: ({ column }) => <SortableHeader column={column} label="Utilization" align="right" />,
        sortingFn: (rowA, rowB) => {
          const a = parseFloat(rowA.original.utilization) || 0;
          const b = parseFloat(rowB.original.utilization) || 0;
          return a - b;
        },
        meta: {
          thClass: 'px-4 py-2.5 text-right w-32',
          tdClass: 'px-4 py-1.5 text-right font-bold tabular-nums text-slate-900',
        },
        cell: ({ getValue }) => getValue<string>(),
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
    globalFilterFn: equipmentErpGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, idx) => `${row.equipment}-${row.date}-${row.activity}-${idx}`,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;

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
              <span className="text-[11px] font-normal text-slate-500 font-mono">
                ({data.totalRows.toLocaleString()} rows)
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              Direct Maga SAP/ERP batch upload format for plant equipment
            </p>
          </div>
        </div>

        <button
          onClick={handleExport}
          disabled={isExporting || data.rows.length === 0}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
        >
          <Download size={14} className="text-emerald-700" />
          <span>{isExporting ? 'Exporting…' : 'Download ERP Excel (.xlsx)'}</span>
        </button>
      </div>

      {/* ── Excel-Styled Data Table ── */}
      <div className="bg-white rounded-xl border border-slate-300 overflow-hidden shadow-2xs">
        <ReportTableToolbar
          searchValue={searchInput}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search equipment, date, activity…"
          totalCount={data.rows.length}
          filteredCount={filteredCount}
          pageRowCount={pageRows.length}
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          itemLabel="rows"
        />

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
            <tbody className="divide-y divide-slate-200 text-slate-800 font-mono">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400 font-sans">
                    {data.rows.length === 0 ? (
                      'No equipment ERP rows generated for the selected filters.'
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
                pageRows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors h-[28px]">
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as { tdClass?: string } | undefined;
                      return (
                        <td key={cell.id} className={meta?.tdClass || 'px-4 py-1.5'}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
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
