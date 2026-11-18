/**
 * ReportTableControls.tsx — Shared TanStack Table UI controls for heavy report tables.
 *
 * Provides:
 *   - ReportTableToolbar: Fast search bar + filtered/total row indicator + optional right actions
 *   - ReportTablePagination: Clean pagination footer (25 / 50 / 100 / 250 rows per page, First/Prev/Next/Last)
 *   - SortableHeader: Consistent column sort button with asc/desc/unsorted icons
 */
import React from 'react';
import type { Table, Column } from '@tanstack/react-table';
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export const REPORT_PAGE_SIZES = [25, 50, 100, 250] as const;

interface ReportTableToolbarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  totalCount: number;
  filteredCount: number;
  pageRowCount: number;
  pageIndex: number;
  pageSize: number;
  itemLabel?: string;
  rightSlot?: React.ReactNode;
}

export const ReportTableToolbar: React.FC<ReportTableToolbarProps> = ({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Quick search rows…',
  totalCount,
  filteredCount,
  pageRowCount,
  pageIndex,
  pageSize,
  itemLabel = 'rows',
  rightSlot,
}) => {
  const start = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const end = filteredCount === 0 ? 0 : Math.min(pageIndex * pageSize + pageRowCount, filteredCount);
  const isFiltered = searchValue.trim().length > 0;

  return (
    <div className="bg-slate-50/80 border-b border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
      {/* Left: Search Box */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <div className="relative">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8 pr-7 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 w-56 sm:w-64 transition-colors"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              title="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        <span className="text-xs text-slate-500 tabular-nums">
          Showing{' '}
          <strong className="text-slate-800 font-semibold">
            {start.toLocaleString()}–{end.toLocaleString()}
          </strong>{' '}
          of{' '}
          <strong className="text-slate-800 font-semibold">
            {filteredCount.toLocaleString()}
          </strong>{' '}
          {isFiltered ? `matching ${itemLabel}` : itemLabel}
          {isFiltered && filteredCount !== totalCount && (
            <span className="text-slate-400"> ({totalCount.toLocaleString()} total)</span>
          )}
        </span>
      </div>

      {/* Right: Optional custom slot */}
      {rightSlot && <div className="flex items-center gap-2 flex-wrap">{rightSlot}</div>}
    </div>
  );
};

interface ReportTablePaginationProps<TData> {
  table: Table<TData>;
  totalCount: number;
  filteredCount: number;
  itemLabel?: string;
  pageSizes?: readonly number[];
}

export function ReportTablePagination<TData>({
  table,
  totalCount,
  filteredCount,
  itemLabel = 'rows',
  pageSizes = REPORT_PAGE_SIZES,
}: ReportTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const currentRowsCount = table.getRowModel().rows.length;
  const start = filteredCount === 0 ? 0 : pageIndex * pageSize + 1;
  const end = filteredCount === 0 ? 0 : Math.min(pageIndex * pageSize + currentRowsCount, filteredCount);

  return (
    <div className="bg-slate-50 border-t border-slate-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 select-none">
      {/* Left: Page Size Selector & Counts */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="px-2 py-1 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer"
          >
            {pageSizes.map((sz) => (
              <option key={sz} value={sz}>
                {sz}
              </option>
            ))}
          </select>
        </div>

        <span className="text-slate-300 hidden sm:inline">|</span>

        <span className="tabular-nums text-slate-500">
          <strong className="text-slate-800 font-semibold">
            {start.toLocaleString()}–{end.toLocaleString()}
          </strong>{' '}
          of{' '}
          <strong className="text-slate-800 font-semibold">
            {filteredCount.toLocaleString()}
          </strong>{' '}
          {itemLabel}
          {filteredCount !== totalCount && (
            <span className="text-slate-400"> (filtered from {totalCount.toLocaleString()})</span>
          )}
        </span>
      </div>

      {/* Right: Page Navigation Controls */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
          title="First page"
          className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
        >
          <ChevronsLeft size={14} />
        </button>
        <button
          type="button"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          title="Previous page"
          className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        <span className="px-2 text-xs font-medium text-slate-700 tabular-nums">
          Page <strong className="font-bold">{pageIndex + 1}</strong> of{' '}
          <strong className="font-bold">{pageCount.toLocaleString()}</strong>
        </span>

        <button
          type="button"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          title="Next page"
          className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
        >
          <ChevronRight size={14} />
        </button>
        <button
          type="button"
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!table.getCanNextPage()}
          title="Last page"
          className="w-7 h-7 rounded-md border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs transition-colors"
        >
          <ChevronsRight size={14} />
        </button>
      </div>
    </div>
  );
}

interface SortableHeaderProps<TData, TValue> {
  column?: Column<TData, TValue>;
  label: React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
}

export function SortableHeader<TData, TValue>({
  column,
  label,
  align = 'left',
  className = '',
}: SortableHeaderProps<TData, TValue>) {
  if (!column || !column.getCanSort()) {
    return <span className={className}>{label}</span>;
  }

  const sorted = column.getIsSorted();
  const alignClass =
    align === 'right'
      ? 'justify-end ml-auto'
      : align === 'center'
      ? 'justify-center mx-auto'
      : 'justify-start';

  return (
    <button
      type="button"
      onClick={column.getToggleSortingHandler()}
      className={`inline-flex items-center gap-1 group cursor-pointer select-none hover:text-slate-900 transition-colors ${alignClass} ${className}`}
      title="Click to sort"
    >
      <span>{label}</span>
      {sorted === 'asc' ? (
        <ArrowUp size={12} className="text-blue-600 flex-shrink-0" />
      ) : sorted === 'desc' ? (
        <ArrowDown size={12} className="text-blue-600 flex-shrink-0" />
      ) : (
        <ArrowUpDown
          size={11}
          className="text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors"
        />
      )}
    </button>
  );
}
