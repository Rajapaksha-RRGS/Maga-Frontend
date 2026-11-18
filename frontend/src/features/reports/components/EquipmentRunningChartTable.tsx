/**
 * EquipmentRunningChartTable.tsx — TanStack Table view for Equipment Running Chart.
 * Displays daily meter readings, working/idle/breakdown hours, fuel, condition, and status
 * with pagination (25/50/100/250), sorting, and deferred quick search.
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
import type {
  EquipmentRunningChartResponse,
  EquipmentRunningChartItem,
} from '../services/reportService';
import { Truck, Clock, Fuel, AlertTriangle, Layers, CheckCircle } from 'lucide-react';
import {
  ReportTableToolbar,
  ReportTablePagination,
  SortableHeader,
} from './ReportTableControls';

interface Props {
  data: EquipmentRunningChartResponse;
}

const eqRunningChartGlobalFilterFn: FilterFn<EquipmentRunningChartItem> = (
  row,
  _columnId,
  filterValue
) => {
  const q = String(filterValue || '').trim().toLowerCase();
  if (!q) return true;
  const r = row.original;
  return Boolean(
    r.date?.toLowerCase().includes(q) ||
      r.equipmentCode?.toLowerCase().includes(q) ||
      r.equipmentName?.toLowerCase().includes(q) ||
      r.vehicleNo?.toLowerCase().includes(q) ||
      r.condition?.toLowerCase().includes(q) ||
      r.supervisorName?.toLowerCase().includes(q) ||
      r.status?.toLowerCase().includes(q)
  );
};

export const EquipmentRunningChartTable: React.FC<Props> = ({ data }) => {
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

  const columns = useMemo<ColumnDef<EquipmentRunningChartItem>[]>(
    () => [
      {
        accessorKey: 'date',
        header: ({ column }) => <SortableHeader column={column} label="Date" align="center" />,
        meta: {
          thClass: 'px-3.5 py-3 text-center whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 text-center font-mono text-slate-600 whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'equipmentCode',
        header: ({ column }) => <SortableHeader column={column} label="Equipment Code" />,
        meta: {
          thClass: 'px-3.5 py-3 whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 font-semibold text-slate-800 font-mono whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'equipmentName',
        header: ({ column }) => <SortableHeader column={column} label="Name & Description" />,
        meta: {
          thClass: 'px-3.5 py-3 whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 text-slate-700 whitespace-nowrap',
        },
        cell: ({ row }) => {
          const item = row.original;
          return (
            <div>
              <div className="font-medium">{item.equipmentName}</div>
              {item.vehicleNo !== '—' && (
                <div className="text-[11px] text-slate-400">Vehicle: {item.vehicleNo}</div>
              )}
            </div>
          );
        },
      },
      {
        accessorKey: 'condition',
        header: ({ column }) => <SortableHeader column={column} label="Condition" align="center" />,
        meta: {
          thClass: 'px-3.5 py-3 text-center whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 text-center whitespace-nowrap',
        },
        cell: ({ getValue }) => {
          const cond = getValue<string>();
          return (
            <span
              className={[
                'px-2 py-0.5 rounded text-[11px] font-semibold',
                cond.toUpperCase() === 'DRY'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-blue-50 text-blue-800 border border-blue-200',
              ].join(' ')}
            >
              {cond}
            </span>
          );
        },
      },
      {
        accessorKey: 'supervisorName',
        header: ({ column }) => <SortableHeader column={column} label="Supervisor" />,
        meta: {
          thClass: 'px-3.5 py-3 whitespace-nowrap',
          tdClass: 'px-3.5 py-2.5 text-slate-600 whitespace-nowrap',
        },
        cell: ({ getValue }) => getValue<string>(),
      },
      {
        accessorKey: 'initialMeter',
        header: ({ column }) => <SortableHeader column={column} label="Initial Meter" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums',
        },
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? val.toFixed(1) : '—';
        },
      },
      {
        accessorKey: 'finalMeter',
        header: ({ column }) => <SortableHeader column={column} label="Final Meter" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right font-mono text-slate-600 tabular-nums',
        },
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? val.toFixed(1) : '—';
        },
      },
      {
        accessorKey: 'netRunningHours',
        header: ({ column }) => <SortableHeader column={column} label="Net Running" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right font-mono font-bold text-slate-900 tabular-nums bg-slate-50/50',
        },
        cell: ({ row }) => {
          const item = row.original;
          const unitLower = (item.primaryUnit || 'hrs').toLowerCase();
          if (unitLower === 'mth') {
            return (
              <div className="flex flex-col items-end">
                <span>{item.netRunningHours.toFixed(1)} Day</span>
                <span className="text-[10px] text-violet-600 font-sans font-medium">
                  Monthly Contract
                </span>
              </div>
            );
          }
          if (unitLower === 'day' || unitLower === 'days') {
            return <span>{item.netRunningHours.toFixed(1)} Day</span>;
          }
          if (unitLower === 'km') {
            return <span>{item.netRunningHours.toFixed(1)} km</span>;
          }
          return <span>{item.netRunningHours.toFixed(1)} Hrs</span>;
        },
      },
      {
        accessorKey: 'workingHours',
        header: ({ column }) => <SortableHeader column={column} label="Working" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right font-mono text-emerald-700 tabular-nums',
        },
        cell: ({ row }) => {
          const item = row.original;
          const unitLower = (item.primaryUnit || 'hrs').toLowerCase();
          if (unitLower === 'mth' || unitLower === 'day' || unitLower === 'days') {
            return `${item.workingHours.toFixed(1)} Day`;
          }
          if (unitLower === 'km') {
            return `${item.workingHours.toFixed(1)} km`;
          }
          return `${item.workingHours.toFixed(1)} Hrs`;
        },
      },
      {
        accessorKey: 'idleHours',
        header: ({ column }) => <SortableHeader column={column} label="Idle" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right font-mono text-amber-700 tabular-nums',
        },
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? `${val.toFixed(1)} Hrs` : '—';
        },
      },
      {
        accessorKey: 'fuelLiters',
        header: ({ column }) => <SortableHeader column={column} label="Fuel (L)" align="right" />,
        meta: {
          thClass: 'px-3 py-3 text-right whitespace-nowrap',
          tdClass: 'px-3 py-2.5 text-right font-mono text-slate-800 tabular-nums',
        },
        cell: ({ getValue }) => {
          const val = getValue<number>();
          return val > 0 ? `${val.toFixed(1)} L` : '—';
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortableHeader column={column} label="Status" align="center" />,
        meta: {
          thClass: 'px-3.5 py-3 whitespace-nowrap text-center',
          tdClass: 'px-3.5 py-2.5 text-center whitespace-nowrap',
        },
        cell: ({ getValue }) => (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle size={11} className="text-emerald-600" />
            {getValue<string>()}
          </span>
        ),
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
    globalFilterFn: eqRunningChartGlobalFilterFn,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, idx) => row.id || `eq-rc-${idx}`,
  });

  const filteredCount = table.getFilteredRowModel().rows.length;
  const pageRows = table.getRowModel().rows;

  return (
    <div className="flex flex-col gap-4">
      {/* ── KPI Metrics Cards (Clean, Neutral Tone) ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col gap-1 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Truck size={14} className="text-slate-400" /> Plant Units Logged
          </span>
          <span className="text-xl font-semibold text-slate-800 tabular-nums">
            {totals.totalRecords.toLocaleString()}
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
            {totals.totalFuelLiters.toFixed(1)}{' '}
            <span className="text-xs font-normal text-slate-400">Liters</span>
          </span>
        </div>
      </div>

      {/* ── Main Data Table ── */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <ReportTableToolbar
          searchValue={searchInput}
          onSearchChange={handleSearchChange}
          searchPlaceholder="Search equipment, vehicle, supervisor, date…"
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
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400">
                    {items.length === 0 ? (
                      <>
                        <Truck size={32} className="mx-auto text-slate-300 mb-2 stroke-1" />
                        No equipment running chart records found for this period.
                      </>
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
                  <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
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
};
