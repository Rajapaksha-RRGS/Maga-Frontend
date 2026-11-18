/**
 * BpBillTable.tsx — Business Partner Bill Report powered by @tanstack/react-table.
 * Matches GET /api/reports/bp-bill.
 *
 * Rules:
 *   - Grouped by Business Partner (distinct section/header per partner).
 *   - Each partner section uses TanStack Table for sorting & pagination (25/50/100/250)
 *     so wide date grids with hundreds of workers never freeze the browser.
 *   - Top quick-search + partner selector filter across all partners & workers.
 *   - Partner subtotals and overall Grand Totals preserved accurately.
 */
import { useState, useMemo, useDeferredValue, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  type ColumnDef,
  type SortingState,
  type PaginationState,
} from '@tanstack/react-table';
import type {
  BpBillResponse,
  BpBillGroup,
  BpBillEmployeeItem,
} from '../services/reportService';
import {
  Building2,
  DollarSign,
  Receipt,
  Percent,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ReportTablePagination, SortableHeader } from './ReportTableControls';

interface Props {
  data: BpBillResponse;
}

const GROUPS_PER_PAGE = 10;

/** Format currency numbers as LKR 123,456.78 */
function formatLKR(amount: number): string {
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Format date to short header */
function formatShortDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}`;
    }
  } catch {
    // fallback
  }
  return dateStr;
}

interface BpBillGroupCardProps {
  group: BpBillGroup;
  filteredItems: BpBillEmployeeItem[];
  dates: string[];
}

function BpBillGroupCard({ group, filteredItems, dates }: BpBillGroupCardProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  const columns = useMemo<ColumnDef<BpBillEmployeeItem>[]>(
    () => [
      { accessorKey: 'employeeName' },
      { accessorKey: 'tradeGroup' },
      { accessorKey: 'totalHours' },
      { accessorKey: 'hourlyRate' },
      { accessorKey: 'totalHourlyPayment' },
      { accessorKey: 'overhead' },
      { accessorKey: 'totalCost' },
    ],
    []
  );

  const table = useReactTable({
    data: filteredItems,
    columns,
    state: {
      sorting,
      pagination,
    },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row, idx) => row.id || `bp-emp-${idx}`,
  });

  const pageRows = table.getRowModel().rows;
  const showPagination = filteredItems.length > 25;

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden">
      {/* Business Partner Section Header */}
      <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-blue-700" />
          <h2 className="font-semibold text-slate-800 text-sm">{group.businessPartner}</h2>
          <span className="text-xs font-medium text-slate-500 bg-slate-200/70 px-2 py-0.5 rounded-full tabular-nums">
            {filteredItems.length === group.items.length
              ? `${group.items.length.toLocaleString()} workers`
              : `${filteredItems.length.toLocaleString()} / ${group.items.length.toLocaleString()} workers`}
          </span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <span className="text-slate-600">
            Subtotal:{' '}
            <span className="font-medium text-slate-900 tabular-nums">
              {group.subtotalHours.toFixed(1)} hrs
            </span>
          </span>
          <span className="text-blue-700 font-semibold">
            Cost: <span className="tabular-nums">LKR {formatLKR(group.subtotalCost)}</span>
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto max-w-full">
        <table className="w-full text-xs text-left border-collapse min-w-[900px]">
          <thead>
            <tr className="bg-slate-100/60 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-medium text-[11px]">
              <th className="sticky left-0 z-20 bg-slate-100/90 px-4 py-2.5 min-w-[160px] border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                <SortableHeader column={table.getColumn('employeeName')} label="Employee" />
              </th>
              <th className="px-3 py-2.5 min-w-[100px] border-r border-slate-200">
                <SortableHeader column={table.getColumn('tradeGroup')} label="Trade" />
              </th>

              {/* Date Grid */}
              {dates.map((d) => (
                <th
                  key={d}
                  className="px-2 py-2.5 text-center min-w-[40px] font-mono border-r border-slate-200 bg-slate-50/50"
                >
                  {formatShortDate(d)}
                </th>
              ))}

              {/* Calculation Columns */}
              <th className="px-3 py-2.5 text-right font-medium text-slate-800 bg-slate-50 border-l border-slate-200 whitespace-nowrap">
                <SortableHeader column={table.getColumn('totalHours')} label="Total Hrs" align="right" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-700 bg-slate-50 whitespace-nowrap">
                <SortableHeader column={table.getColumn('hourlyRate')} label="Rate (LKR)" align="right" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-800 bg-slate-50 whitespace-nowrap">
                <SortableHeader column={table.getColumn('totalHourlyPayment')} label="Payment (LKR)" align="right" />
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-slate-700 bg-slate-50 whitespace-nowrap">
                <SortableHeader column={table.getColumn('overhead')} label="10% O/H" align="right" />
              </th>
              <th className="px-4 py-2.5 text-right font-semibold text-slate-900 bg-blue-50/50 border-l border-slate-200 whitespace-nowrap">
                <SortableHeader column={table.getColumn('totalCost')} label="Total Cost (LKR)" align="right" />
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {pageRows.map((tableRow) => {
              const item = tableRow.original;
              return (
                <tr key={tableRow.id} className="hover:bg-slate-50/80 transition-colors">
                  {/* Sticky Employee */}
                  <td className="sticky left-0 z-10 bg-white hover:bg-slate-50 px-4 py-2.5 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                    <div className="font-medium text-slate-800">{item.employeeName}</div>
                    <div className="text-[10px] font-mono text-slate-400">{item.employeeId}</div>
                  </td>

                  <td className="px-3 py-2.5 text-slate-600 border-r border-slate-100">
                    {item.tradeGroup}
                  </td>

                  {/* Daily Hours */}
                  {dates.map((d) => {
                    const hrs = item.dailyHours[d] || 0;
                    return (
                      <td
                        key={d}
                        className="px-2 py-2 text-center tabular-nums font-mono border-r border-slate-100 text-slate-700"
                      >
                        {hrs > 0 ? hrs : <span className="text-slate-300">—</span>}
                      </td>
                    );
                  })}

                  {/* Values */}
                  <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-800 border-l border-slate-200">
                    {item.totalHours.toFixed(1)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600 font-mono">
                    {item.hourlyRate.toFixed(2)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-800 font-medium">
                    {formatLKR(item.totalHourlyPayment)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {formatLKR(item.overhead)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-slate-900 bg-blue-50/20 border-l border-slate-100">
                    {formatLKR(item.totalCost)}
                  </td>
                </tr>
              );
            })}
          </tbody>

          {/* Subtotal Row */}
          <tfoot>
            <tr className="bg-slate-50/90 border-t-2 border-slate-200 font-medium text-slate-800 text-xs">
              <td
                colSpan={2}
                className="sticky left-0 z-20 bg-slate-50 px-4 py-3 uppercase tracking-wider font-semibold border-r border-slate-200 shadow-[1px_0_0_0_#cbd5e1]"
              >
                Subtotal ({group.businessPartner})
              </td>

              {dates.map((d) => (
                <td key={d} className="px-2 py-3 border-r border-slate-200" />
              ))}

              <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900 border-l border-slate-200">
                {group.subtotalHours.toFixed(1)}
              </td>
              <td className="px-3 py-3 text-right text-slate-400">—</td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-900">
                {formatLKR(group.subtotalPayment)}
              </td>
              <td className="px-3 py-3 text-right tabular-nums font-semibold text-slate-700">
                {formatLKR(group.subtotalOverhead)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-900 bg-blue-100/40 border-l border-slate-200">
                {formatLKR(group.subtotalCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Paginate large Business Partner tables */}
      {showPagination && (
        <ReportTablePagination
          table={table}
          totalCount={group.items.length}
          filteredCount={filteredItems.length}
          itemLabel="workers"
        />
      )}
    </div>
  );
}

export default function BpBillTable({ data }: Props) {
  const {
    dates,
    groups,
    grandTotalHours,
    grandTotalPayment,
    grandTotalOverhead,
    grandTotalCost,
  } = data;

  const [searchInput, setSearchInput] = useState('');
  const deferredSearch = useDeferredValue(searchInput);
  const [selectedPartner, setSelectedPartner] = useState<string>('all');
  const [groupPageIndex, setGroupPageIndex] = useState(0);

  const handleSearchChange = useCallback((val: string) => {
    setSearchInput(val);
    setGroupPageIndex(0);
  }, []);

  const handlePartnerChange = useCallback((val: string) => {
    setSelectedPartner(val);
    setGroupPageIndex(0);
  }, []);

  // Filter partners & workers with deferred search
  const filteredGroups = useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    return groups
      .filter((g) => selectedPartner === 'all' || g.businessPartner === selectedPartner)
      .map((group) => {
        if (!q) return { group, filteredItems: group.items };
        if (group.businessPartner.toLowerCase().includes(q)) {
          return { group, filteredItems: group.items };
        }
        const matchedItems = group.items.filter(
          (item) =>
            item.employeeName.toLowerCase().includes(q) ||
            item.employeeId.toLowerCase().includes(q) ||
            item.tradeGroup.toLowerCase().includes(q)
        );
        return { group, filteredItems: matchedItems };
      })
      .filter((entry) => entry.filteredItems.length > 0);
  }, [groups, selectedPartner, deferredSearch]);

  const totalWorkers = useMemo(
    () => groups.reduce((acc, g) => acc + g.items.length, 0),
    [groups]
  );

  const totalGroupPages = Math.max(1, Math.ceil(filteredGroups.length / GROUPS_PER_PAGE));
  const safeGroupPage = Math.min(groupPageIndex, totalGroupPages - 1);
  const visibleGroups = useMemo(() => {
    const start = safeGroupPage * GROUPS_PER_PAGE;
    return filteredGroups.slice(start, start + GROUPS_PER_PAGE);
  }, [filteredGroups, safeGroupPage]);

  return (
    <div className="flex flex-col gap-5">
      {/* Grand Total Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Building2 size={14} className="text-slate-400" /> Partners
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {groups.length.toLocaleString()}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Receipt size={14} className="text-slate-400" /> Total Hours
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            {grandTotalHours.toFixed(1)}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
            <Percent size={14} className="text-slate-400" /> Base Payment
          </span>
          <span className="text-xl font-medium text-slate-800 tabular-nums">
            LKR {formatLKR(grandTotalPayment)}
          </span>
        </div>

        <div className="bg-white rounded-lg border border-blue-200/80 bg-blue-50/40 p-3.5 flex flex-col gap-1">
          <span className="text-xs font-medium text-blue-700 uppercase tracking-wide flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <DollarSign size={14} className="text-blue-600" /> Total Cost
            </span>
            <span className="text-[10px] text-blue-600/80 font-normal">
              +10% OH (LKR {formatLKR(grandTotalOverhead)})
            </span>
          </span>
          <span className="text-xl font-semibold text-blue-900 tabular-nums">
            LKR {formatLKR(grandTotalCost)}
          </span>
        </div>
      </div>

      {/* Quick Filter Bar: Search Worker/Partner + Jump to Business Partner */}
      <div className="bg-white rounded-lg border border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shadow-2xs">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search partner, employee, trade…"
              className="pl-8 pr-7 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 w-56 sm:w-64"
            />
            {searchInput && (
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

          {groups.length > 1 && (
            <select
              value={selectedPartner}
              onChange={(e) => handlePartnerChange(e.target.value)}
              className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer max-w-[240px]"
            >
              <option value="all">All Partners ({groups.length})</option>
              {groups.map((g) => (
                <option key={g.businessPartner} value={g.businessPartner}>
                  {g.businessPartner} ({g.items.length})
                </option>
              ))}
            </select>
          )}
        </div>

        <span className="text-xs text-slate-500 tabular-nums">
          Showing <strong className="text-slate-800">{filteredGroups.length}</strong> of{' '}
          <strong className="text-slate-800">{groups.length}</strong> partners ({totalWorkers.toLocaleString()} workers total)
        </span>
      </div>

      {/* Grouped Tables per Business Partner */}
      {visibleGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 py-12 text-center text-xs text-slate-400">
          <p>No business partner bills match your search.</p>
          <button
            type="button"
            onClick={() => {
              handleSearchChange('');
              handlePartnerChange('all');
            }}
            className="mt-2 text-blue-600 hover:underline font-medium cursor-pointer"
          >
            Reset search & partner filter
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {visibleGroups.map(({ group, filteredItems }) => (
            <BpBillGroupCard
              key={group.businessPartner}
              group={group}
              filteredItems={filteredItems}
              dates={dates}
            />
          ))}
        </div>
      )}

      {/* Partner Group Pagination (only shown when > 10 partner groups) */}
      {filteredGroups.length > GROUPS_PER_PAGE && (
        <div className="bg-white rounded-lg border border-slate-200 px-4 py-2.5 flex items-center justify-between text-xs text-slate-600 shadow-2xs">
          <span className="tabular-nums">
            Showing partners{' '}
            <strong className="text-slate-800">
              {safeGroupPage * GROUPS_PER_PAGE + 1}–
              {Math.min((safeGroupPage + 1) * GROUPS_PER_PAGE, filteredGroups.length)}
            </strong>{' '}
            of <strong className="text-slate-800">{filteredGroups.length}</strong>
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safeGroupPage === 0}
              onClick={() => setGroupPageIndex((p) => Math.max(0, p - 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={13} />
              Prev Partners
            </button>
            <span className="px-2 font-medium tabular-nums">
              {safeGroupPage + 1} / {totalGroupPages}
            </span>
            <button
              type="button"
              disabled={safeGroupPage >= totalGroupPages - 1}
              onClick={() => setGroupPageIndex((p) => Math.min(totalGroupPages - 1, p + 1))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Next Partners
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
