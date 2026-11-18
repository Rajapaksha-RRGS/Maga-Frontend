/**
 * RunningChartTable.tsx — TanStack Table view for the Daily Labour/Operator Running Chart report.
 * Matches GET /api/reports/running-chart.
 *
 * Powered by @tanstack/react-table with pagination (25/50/100/250), sorting,
 * and deferred quick search.
 */
import { useState, useMemo, useDeferredValue, useCallback } from 'react';
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
import type { RunningChartResponse, RunningChartItem } from '../services/reportService';
import { Users, Clock, Timer, Layers, UserCheck } from 'lucide-react';
import {
  ReportTableToolbar,
  ReportTablePagination,
  SortableHeader,
} from './ReportTableControls';

interface Props {
  data: RunningChartResponse;
}

const runningChartGlobalFilterFn: FilterFn<RunningChartItem> = (row, _columnId, filterValue) => {
  const q = String(filterValue || '').trim().toLowerCase();
  if (!q) return true;
  const r = row.original;
  return Boolean(
    r.date?.toLowerCase().includes(q) ||
      r.supervisorName?.toLowerCase().includes(q) ||
      r.employeeCode?.toLowerCase().includes(q) ||
      r.callingName?.toLowerCase().includes(q) ||
      r.tradeGroup?.toLowerCase().includes(q) ||
      r.businessPartner?.toLowerCase().includes(q) ||
      r.activitiesDisplay?.toLowerCase().includes(q) ||
      r.activities?.some(
        (a) => a.code.toLowerCase().includes(q) || a.description?.toLowerCase().includes(q)
      )
  );
};

export default function RunningChartTable({ data }: Props) {
  const { items, totals } = data;

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

  const columns = useMemo<ColumnDef<RunningChartItem>[]>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => <SortableHeader column={column} label="Date" align="center" />,
        meta: {
          thClass: 'px-3.5 py-3 text-center whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 text-center text-slate-600 font-medium whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'supervisorName',
        header: ({ column }) => <SortableHeader column={column} label="Supervisor" />,
        meta: {
          thClass: 'px-3.5 py-3 whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 whitespace-nowrap',
        },
        cell: ({ getValue }) => (
          <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
            <UserCheck size={14} className="text-blue-600 flex-shrink-0" />
            <span>{getValue<string>()}</span>
          </span>
        ),
      },
      {
        accessorKey: 'employeeCode',
        header: ({ column }) => <SortableHeader column={column} label="EMP No" />,
        meta: {
          thClass: 'px-3.5 py-3 whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 whitespace-nowrap',
        },
        cell: ({ getValue }) => (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md font-mono text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
            {getValue<string>()}
          </span>
        ),
      },
      {
        accessorKey: 'callingName',
        header: ({ column }) => <SortableHeader column={column} label="Calling Name" />,
        meta: {
          thClass: 'px-3.5 py-3 whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 font-medium text-slate-900 whitespace-nowrap',
        },
        cell: ({ row }) => (
          <div>
            <div>{row.original.callingName}</div>
            {row.original.tradeGroup && (
              <div className="text-[11px] text-slate-400 font-normal">{row.original.tradeGroup}</div>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'businessPartner',
        header: ({ column }) => <SortableHeader column={column} label="Business Partner" />,
        meta: {
          thClass: 'px-3.5 py-3 whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 text-slate-500 whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'inTime',
        header: ({ column }) => <SortableHeader column={column} label="In Time" align="center" />,
        meta: {
          thClass: 'px-3 py-3 text-center whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-center text-slate-700 font-mono text-xs whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'outTime',
        header: ({ column }) => <SortableHeader column={column} label="Out Time" align="center" />,
        meta: {
          thClass: 'px-3 py-3 text-center whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-center text-slate-700 font-mono text-xs whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'workHours',
        header: ({ column }) => <SortableHeader column={column} label="Work Hrs" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right font-medium text-slate-700 tabular-nums whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<number>().toFixed(1),
      },
      {
        accessorKey: 'otHours',
        header: ({ column }) => <SortableHeader column={column} label="OT Hrs" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right tabular-nums whitespace-nowrap',
        },
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? (
            <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-1.5 py-0.5 rounded-md">
              +{val.toFixed(1)}h
            </span>
          ) : (
            <span className="text-slate-400">0.0</span>
          );
        },
      },
      {
        accessorKey: 'totalHours',
        header: ({ column }) => <SortableHeader column={column} label="Total Hrs" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums whitespace-nowrap',
        },
        cell: ({ row }) => {
          const r = row.original;
          return (
            <div
              title={
                r.totalGrossHours
                  ? `Gross: ${r.totalGrossHours.toFixed(1)}h (Break: ${(r.breakHours || 0).toFixed(1)}h)`
                  : undefined
              }
            >
              <div>{r.totalHours.toFixed(1)}</div>
              {r.breakHours && r.breakHours > 0 ? (
                <div className="text-[10px] text-slate-400 font-normal">-{r.breakHours.toFixed(1)}h brk</div>
              ) : null}
            </div>
          );
        },
      },
      {
        id: 'activities',
        accessorFn: (row) => row.activitiesDisplay || '',
        header: 'Activities & Worked Hours',
        enableSorting: false,
        meta: {
          thClass: 'px-4 py-3 min-w-[220px]',
          tdClass: 'px-4 py-2.5',
        },
        cell: ({ row }) => {
          const acts = row.original.activities;
          if (!acts || acts.length === 0) {
            return <span className="text-slate-400 text-xs">—</span>;
          }
          return (
            <div className="flex flex-wrap gap-1.5">
              {acts.map((act, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-blue-50/80 text-blue-800 border border-blue-200/60"
                  title={act.description || act.code}
                >
                  <span className="font-mono">{act.code}</span>
                  <span className="font-semibold text-blue-900 bg-blue-100/80 px-1 rounded">
                    {act.hours.toFixed(1)}h
                  </span>
                </span>
              ))}
            </div>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: items,
    columns,
    state: {
      sorting,
      globalFilter: deferredSearch,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    globalFilterFn: runningChartGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, idx) => row.id || `rc-${idx}`,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-4">
      {/* Metric Cards Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Users size={14} className="text-slate-400" /> Total Records
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalRecords.toLocaleString()}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={14} className="text-blue-500" /> Work Hours
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalWorkHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-amber-200 bg-amber-50/40 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-amber-700 uppercase tracking-wide flex items-center gap-1.5">
            <Timer size={14} className="text-amber-500" /> Overtime Hours
          </span>
          <span className="text-xl font-semibold text-amber-900 tabular-nums">
            {totals.totalOtHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-xl border border-emerald-200 bg-emerald-50/30 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
            <Layers size={14} className="text-emerald-600" /> Total Hours
          </span>
          <span className="text-xl font-semibold text-emerald-950 tabular-nums">
            {totals.totalHours.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <ReportTableToolbar
          searchValue={searchInput}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search employee, supervisor, partner, activity…"
          totalCount={items.length}
          filteredCount={filteredCount}
          pageRowCount={pageRows.length}
          pageIndex={pagination.pageIndex}
          pageSize={pagination.pageSize}
          itemLabel="records"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr
                  key={headerGroup.id}
                  className="bg-slate-50/90 border-b border-slate-200 text-slate-600 font-medium"
                >
                  {headerGroup.headers.map((header) => {
                    const meta = header.column.columnDef.meta as { thClass?: string } | undefined;
                    return (
                      <th key={header.id} className={meta?.thClass || 'px-3.5 py-3'}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center text-slate-400">
                    {items.length === 0 ? (
                      'No running chart records found for the selected criteria.'
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-xs">
                        <span>No records match &ldquo;{searchInput}&rdquo;.</span>
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
                  <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                    {row.getVisibleCells().map((cell) => {
                      const meta = cell.column.columnDef.meta as { tdClass?: string } | undefined;
                      return (
                        <td key={cell.id} className={meta?.tdClass || 'px-3.5 py-2.5'}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
            {items.length > 0 && (
              <tfoot>
                <tr className="bg-slate-100/90 border-t-2 border-slate-300 text-slate-800 font-semibold text-xs sm:text-sm">
                  <td colSpan={7} className="px-4 py-3 text-right uppercase tracking-wider text-slate-600">
                    Grand Totals ({items.length.toLocaleString()} Records):
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-slate-900">
                    {totals.totalWorkHours.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-amber-800">
                    +{totals.totalOtHours.toFixed(1)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-blue-900">
                    {totals.totalHours.toFixed(1)}
                  </td>
                  <td className="px-4 py-3"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        <ReportTablePagination
          table={table}
          totalCount={items.length}
          filteredCount={filteredCount}
          itemLabel="records"
        />
      </div>
    </div>
  );
}
