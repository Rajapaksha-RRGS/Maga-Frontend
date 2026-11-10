/**
 * BusinessPartnerErpMasterView.tsx
 *
 * Dedicated Corporate ERP Master Directory View for Business Partners,
 * powered by @tanstack/react-table.
 *
 * Features:
 *   - Matches exact design aesthetics of EmployeeImportView (/admin/employees)
 *   - Interactive Column Resizing (drag header borders to expand/shrink column widths)
 *   - Multi-column Sorting (A-Z, Z-A) with Prisma Studio type indicators (A, A?)
 *   - Fast Global Search & Category / Type Filtering Popover
 *   - Multi-row Checkbox Selection & Batch "+ Add record" to Site
 *   - 1-Click Instant Single "+ Add" Action
 *   - Clean Light Pagination Footer (Rows per page, jump to page, showing count)
 */
import { useState, useMemo, useEffect } from 'react';
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
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  RotateCw,
  X,
  Search,
  Check,
  ArrowLeft,
  SlidersHorizontal,
  Building2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  CheckCircle2,
  MoveHorizontal,
} from 'lucide-react';
import * as bpService from '../services/businessPartnerService';
import type { BusinessPartner } from '../services/businessPartnerService';

interface BusinessPartnerErpMasterViewProps {
  existingCodes: Set<string>;
  onClose: () => void;
  onImport: (items: BusinessPartner[]) => Promise<void>;
  onOpenDirectRegister?: () => void;
}

export default function BusinessPartnerErpMasterView({
  existingCodes,
  onClose,
  onImport,
  onOpenDirectRegister,
}: BusinessPartnerErpMasterViewProps) {
  const [catalog, setCatalog] = useState<BusinessPartner[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // TanStack Table states
  const [sorting, setSorting] = useState<SortingState>([{ id: 'code', desc: false }]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 25,
  });

  // Load corporate master data
  const loadCatalog = async () => {
    setIsRefreshing(true);
    setIsLoadingCatalog(true);
    try {
      const data = await bpService.fetchCorporateCatalog();
      setCatalog(data);
    } catch (err) {
      console.error('Failed to load corporate business partners:', err);
    } finally {
      setIsLoadingCatalog(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Distinct types for category filtering
  const partnerTypes = useMemo(() => {
    const types = new Set(
      catalog
        .map((p) => p.type || 'Subcontractor')
        .filter(Boolean)
    );
    return ['all', ...Array.from(types).sort()];
  }, [catalog]);

  // Pre-filter catalog by selected type before feeding TanStack Table
  const filteredCatalog = useMemo(() => {
    if (selectedType === 'all') return catalog;
    return catalog.filter(
      (item) => (item.type || 'Subcontractor').toLowerCase() === selectedType.toLowerCase()
    );
  }, [catalog, selectedType]);

  // Custom global search matcher (code, name, contact, phone, email)
  const customGlobalFilterFn = (row: any, _columnId: string, filterValue: string): boolean => {
    const q = (filterValue || '').trim().toLowerCase();
    if (!q) return true;
    const item: BusinessPartner = row.original;
    return Boolean(
      (item.code && item.code.toLowerCase().includes(q)) ||
      (item.name && item.name.toLowerCase().includes(q)) ||
      (item.contactPerson && item.contactPerson.toLowerCase().includes(q)) ||
      (item.phone && item.phone.toLowerCase().includes(q)) ||
      (item.email && item.email.toLowerCase().includes(q)) ||
      (item.type && item.type.toLowerCase().includes(q))
    );
  };

  // Define TanStack Table Columns with Column Resizing metadata
  const columns = useMemo<ColumnDef<BusinessPartner>[]>(
    () => [
      // 1. Select Checkbox Column
      {
        id: 'select',
        size: 44,
        minSize: 44,
        maxSize: 44,
        enableResizing: false,
        enableSorting: false,
        header: ({ table }) => {
          const selectableRows = table.getRowModel().rows.filter(
            (r) => !existingCodes.has(r.original.code.toUpperCase())
          );
          const isAllSelected =
            selectableRows.length > 0 &&
            selectableRows.every((r) => r.getIsSelected());
          const isSomeSelected =
            selectableRows.some((r) => r.getIsSelected()) && !isAllSelected;

          return (
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(input) => {
                  if (input) input.indeterminate = isSomeSelected;
                }}
                disabled={selectableRows.length === 0}
                onChange={() => {
                  if (isAllSelected) {
                    table.resetRowSelection();
                  } else {
                    const next: RowSelectionState = {};
                    selectableRows.forEach((r) => {
                      next[r.id] = true;
                    });
                    setRowSelection(next);
                  }
                }}
                title="Select all available partners"
                className="rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-30"
              />
            </div>
          );
        },
        cell: ({ row }) => {
          const isExisting = existingCodes.has(row.original.code.toUpperCase());
          return (
            <div className="flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                disabled={isExisting}
                checked={row.getIsSelected()}
                onChange={row.getToggleSelectedHandler()}
                aria-label={`Select ${row.original.code}`}
                className="rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
              />
            </div>
          );
        },
      },

      // 2. Code Column
      {
        accessorKey: 'code',
        header: 'Code',
        size: 130,
        minSize: 95,
        maxSize: 220,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 whitespace-nowrap">
            {String(getValue() || '')}
          </span>
        ),
      },

      // 3. Partner Name Column
      {
        accessorKey: 'name',
        header: 'Business Partner Name',
        size: 290,
        minSize: 180,
        maxSize: 520,
        cell: ({ row }) => {
          const bp = row.original;
          return (
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-slate-800 leading-snug truncate" title={bp.name}>
                {bp.name}
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 flex-wrap">
                {bp.brNumber && (
                  <span className="text-[10px] text-slate-400 font-mono">
                    BR: {bp.brNumber}
                  </span>
                )}
                {bp.rating && (
                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 rounded font-medium">
                    ★ {bp.rating}
                  </span>
                )}
              </div>
            </div>
          );
        },
      },

      // 4. Category / Type Column
      {
        accessorKey: 'type',
        header: 'Category / Trade',
        size: 150,
        minSize: 110,
        maxSize: 260,
        cell: ({ getValue }) => {
          const val = String(getValue() || 'Subcontractor').replace(/_/g, ' ');
          return (
            <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200 capitalize whitespace-nowrap">
              {val}
            </span>
          );
        },
      },

      // 5. Contact Person Column
      {
        accessorKey: 'contactPerson',
        header: 'Contact Person',
        size: 170,
        minSize: 120,
        maxSize: 300,
        cell: ({ getValue }) => (
          <span className="text-slate-700 text-xs truncate block" title={String(getValue() || '')}>
            {String(getValue() || '—')}
          </span>
        ),
      },

      // 6. Phone / Email Column
      {
        id: 'contactDetails',
        header: 'Phone / Email',
        size: 200,
        minSize: 140,
        maxSize: 360,
        enableSorting: false,
        cell: ({ row }) => {
          const { phone, email } = row.original;
          if (!phone && !email) return <span className="text-slate-400">—</span>;
          return (
            <div className="flex flex-col gap-0.5 text-[11px]">
              {phone && (
                <span className="font-mono text-slate-700">{phone}</span>
              )}
              {email && (
                <span className="text-slate-500 truncate" title={email}>
                  {email}
                </span>
              )}
            </div>
          );
        },
      },

      // 7. Status Column
      {
        accessorKey: 'status',
        header: 'Status',
        size: 110,
        minSize: 90,
        maxSize: 180,
        cell: ({ row }) => {
          const isExisting = existingCodes.has(row.original.code.toUpperCase());
          if (isExisting) {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                In Site
              </span>
            );
          }
          return (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full whitespace-nowrap">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Corporate
            </span>
          );
        },
      },

      // 8. Action Column
      {
        id: 'actions',
        header: 'Action',
        size: 105,
        minSize: 90,
        maxSize: 150,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => {
          const bp = row.original;
          const isExisting = existingCodes.has(bp.code.toUpperCase());

          if (isExisting) {
            return (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                <Check size={11} /> Added
              </span>
            );
          }

          return (
            <button
              type="button"
              disabled={isImporting}
              onClick={(e) => {
                e.stopPropagation();
                handleSingleImport(bp);
              }}
              className="px-2.5 py-1 text-[11px] font-semibold rounded border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 active:bg-blue-100 transition-colors cursor-pointer shadow-2xs"
            >
              + Add
            </button>
          );
        },
      },
    ],
    [existingCodes, isImporting]
  );

  // Initialize TanStack Table with Column Resizing enabled
  const table = useReactTable({
    data: filteredCatalog,
    columns,
    state: {
      sorting,
      globalFilter,
      rowSelection,
      pagination,
    },
    columnResizeMode: 'onChange',
    enableColumnResizing: true,
    globalFilterFn: customGlobalFilterFn,
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.code,
  });

  // Calculate selected count and items to import
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  // Single item import
  const handleSingleImport = async (item: BusinessPartner) => {
    if (existingCodes.has(item.code.toUpperCase()) || isImporting) return;
    setIsImporting(true);
    try {
      await onImport([item]);
      setSuccessMessage(`Successfully assigned ${item.name} (${item.code}) to this site!`);
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err: any) {
      console.error('Failed to import business partner:', err);
      alert(err.message || 'Failed to import business partner');
    } finally {
      setIsImporting(false);
    }
  };

  // Batch import
  const handleBatchImport = async () => {
    if (selectedCount === 0 || isImporting) return;
    const itemsToImport = selectedRows.map((r) => r.original);
    setIsImporting(true);
    try {
      await onImport(itemsToImport);
      setSuccessMessage(
        `Successfully assigned ${itemsToImport.length} business partner${
          itemsToImport.length !== 1 ? 's' : ''
        } to this site!`
      );
      table.resetRowSelection();
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Batch import failed:', err);
      alert(err.message || 'Failed to import selected partners');
    } finally {
      setIsImporting(false);
    }
  };

  const handleRefresh = () => {
    loadCatalog();
  };

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden flex flex-col font-sans transition-colors animate-in fade-in duration-150 flex-1 min-h-[500px]">
      {/* ── 1. Tab Bar (Clean Light matching /admin/employees) ────────────────── */}
      {successMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            ×
          </button>
        </div>
      )}

      <div className="bg-slate-50/80 border-b border-slate-300 px-2 pt-1.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {/* Back button */}
          <button
            type="button"
            onClick={onClose}
            title="Back to Site Business Partners"
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors mr-1 cursor-pointer"
          >
            <ArrowLeft size={14} />
          </button>

          {/* Active Tab: Corporate Partner Directory */}
          <div className="bg-white text-slate-800 font-semibold text-xs px-3 py-1.5 border-t-2 border-t-blue-600 border-x border-slate-300 flex items-center gap-2 rounded-t-md shadow-xs">
            <Building2 size={13} className="text-blue-600" />
            <span>Corporate Partner Directory (TanStack Table)</span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 rounded p-0.5 transition-colors cursor-pointer"
              title="Close Tab"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Right Exit View Button */}
        <div className="flex items-center gap-1 text-slate-500 pb-1">
          <button
            type="button"
            onClick={onClose}
            title="Close ERP view"
            className="text-xs text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded hover:bg-slate-200/60 border border-slate-300 bg-white transition-colors mr-1 cursor-pointer font-medium"
          >
            Exit view
          </button>
        </div>
      </div>

      {/* ── 2. Control Toolbar ─────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-300 px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Refresh button */}
          <button
            type="button"
            onClick={handleRefresh}
            title="Refresh ERP Records"
            className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 active:scale-95 shadow-xs transition-all cursor-pointer"
          >
            <RotateCw size={13} className={isRefreshing ? 'animate-spin text-blue-600' : ''} />
          </button>

          {/* Filters Pill & Popover */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
            >
              <SlidersHorizontal size={12} className="text-slate-500" />
              <span>Filters</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[11px] font-normal capitalize border border-slate-200">
                {selectedType === 'all' ? 'All' : selectedType}
              </span>
            </button>

            {/* Filter Dropdown Popover */}
            {showFilterDropdown && (
              <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-300 rounded-lg shadow-lg z-30 p-1.5 space-y-1">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                  Partner Category
                </div>
                {partnerTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSelectedType(t);
                      setShowFilterDropdown(false);
                      table.setPageIndex(0);
                    }}
                    className={[
                      'w-full text-left px-2 py-1.5 rounded text-xs capitalize flex items-center justify-between cursor-pointer transition-colors',
                      selectedType === t
                        ? 'bg-blue-50 text-blue-700 font-semibold border border-blue-200'
                        : 'text-slate-700 hover:bg-slate-100',
                    ].join(' ')}
                  >
                    <span>{t === 'all' ? 'All Categories' : t}</span>
                    {selectedType === t && <Check size={12} className="text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search
              size={12}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => {
                setGlobalFilter(e.target.value);
                table.setPageIndex(0);
              }}
              placeholder="Search code, name, contact..."
              className="pl-7 pr-7 py-1 text-xs rounded border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-56 transition-all shadow-xs"
            />
            {globalFilter && (
              <button
                type="button"
                onClick={() => setGlobalFilter('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
              >
                <X size={11} />
              </button>
            )}
          </div>

          {/* Column Resizing Helper Indicator */}
          <div
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-200 bg-slate-50 text-slate-600 text-[11px] font-medium"
            title="You can drag the right border of any column header to resize its width"
          >
            <MoveHorizontal size={12} className="text-blue-600" />
            <span>Resize Columns enabled</span>
          </div>

          {/* Showing Count Badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-medium shadow-xs">
            <span>Showing</span>
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[11px] font-normal tabular-nums border border-slate-200">
              {table.getFilteredRowModel().rows.length} of {catalog.length}
            </span>
          </div>
        </div>

        {/* Right Action: Batch Add + Direct Site Register */}
        <div className="flex items-center gap-2">
          {selectedCount > 0 && (
            <span className="text-xs text-blue-700 font-semibold">
              {selectedCount} selected
            </span>
          )}

          {onOpenDirectRegister && (
            <button
              type="button"
              onClick={onOpenDirectRegister}
              title="Directly register a new site subcontractor with BR"
              className="flex items-center gap-1.5 bg-gradient-to-r from-blue-700 to-blue-800 text-white font-medium text-xs rounded px-3 py-1.5 hover:opacity-95 transition-opacity cursor-pointer shadow-xs"
            >
              <Plus size={13} />
              <span>+ Direct Site Register</span>
            </button>
          )}

          <button
            type="button"
            disabled={selectedCount === 0 || isImporting}
            onClick={handleBatchImport}
            title={
              selectedCount === 0
                ? 'Select rows using checkboxes to add to site'
                : 'Assign selected partners to current project site'
            }
            className={[
              'px-3.5 py-1.5 rounded font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer',
              selectedCount > 0
                ? 'bg-slate-800 hover:bg-slate-900 text-white active:scale-98'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed',
            ].join(' ')}
          >
            {isImporting ? (
              <>
                <Loader2 size={12} className="animate-spin text-white" />
                <span>Assigning…</span>
              </>
            ) : (
              <>
                <span>Add record</span>
                {selectedCount > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {selectedCount}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 3. TanStack Table Grid with Interactive Column Resizing ────────── */}
      <div className="overflow-x-auto scrollbar-none flex-1 max-h-[calc(100vh-280px)] min-h-[380px] bg-white">
        <table
          className="border-collapse text-left text-xs bg-white"
          style={{
            width: table.getCenterTotalSize(),
            minWidth: '100%',
          }}
        >
          {/* Header Row */}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="bg-slate-50 text-slate-800 border-b-2 border-slate-300 select-none sticky top-0 z-10 shadow-xs"
              >
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort();
                  const isSorted = header.column.getIsSorted();
                  const canResize = header.column.getCanResize();
                  const isResizing = header.column.getIsResizing();

                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      style={{
                        width: header.getSize(),
                        position: 'relative',
                      }}
                      className={[
                        'px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap bg-slate-50',
                        canSort ? 'cursor-pointer hover:bg-slate-100/90 transition-colors' : '',
                      ].join(' ')}
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      <div className="flex items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-slate-800 font-semibold truncate">
                            {flexRender(header.column.columnDef.header, header.getContext())}
                          </span>
                          {/* Prisma Studio Data Type Indicator */}
                          {canSort && (
                            <span className="text-slate-400 font-mono text-[10px] font-normal">
                              A
                            </span>
                          )}
                        </div>

                        {/* Sorting indicators */}
                        {canSort && (
                          <div className="flex items-center flex-shrink-0">
                            {isSorted === 'asc' ? (
                              <ArrowUp size={11} className="text-blue-600 font-bold" />
                            ) : isSorted === 'desc' ? (
                              <ArrowDown size={11} className="text-blue-600 font-bold" />
                            ) : (
                              <ArrowUpDown size={11} className="text-slate-400" />
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Interactive Column Resize Handle ──────────────── */}
                      {canResize && (
                        <div
                          onMouseDown={header.getResizeHandler()}
                          onTouchStart={header.getResizeHandler()}
                          onClick={(e) => e.stopPropagation()}
                          title="Drag to resize column (double-click to reset)"
                          onDoubleClick={() => header.column.resetSize()}
                          className={`absolute right-0 top-0 h-full w-2.5 cursor-col-resize select-none touch-none flex items-center justify-center group z-20 ${
                            isResizing ? 'bg-blue-600' : 'hover:bg-blue-500/20'
                          }`}
                        >
                          <div
                            className={`w-[2px] h-3.5 rounded-full transition-colors ${
                              isResizing ? 'bg-white' : 'bg-slate-300 group-hover:bg-blue-600'
                            }`}
                          />
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-slate-200 bg-white">
            {isLoadingCatalog ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 text-center text-slate-400 text-xs bg-white"
                >
                  <div className="flex flex-col items-center justify-center gap-2">
                    <Loader2 size={18} className="animate-spin text-blue-600" />
                    <span className="font-medium text-slate-600">
                      Loading corporate business partner directory…
                    </span>
                  </div>
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-16 text-center text-slate-500 text-xs bg-white"
                >
                  <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-2">
                    <p className="text-slate-600 font-medium">
                      No corporate business partners found matching your search.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setGlobalFilter('');
                        setSelectedType('all');
                      }}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                    >
                      Reset filters
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const item = row.original;
                const isExisting = existingCodes.has(item.code.toUpperCase());
                const isChecked = row.getIsSelected();

                return (
                  <tr
                    key={row.id}
                    onClick={() => {
                      if (!isExisting) row.toggleSelected();
                    }}
                    className={[
                      'transition-colors border-b border-slate-200',
                      isExisting
                        ? 'bg-slate-50 text-slate-400 cursor-default opacity-85'
                        : isChecked
                        ? 'bg-blue-50/70 hover:bg-blue-100/60 cursor-pointer'
                        : 'bg-white hover:bg-slate-50 cursor-pointer',
                    ].join(' ')}
                  >
                    {row.getVisibleCells().map((cell) => {
                      return (
                        <td
                          key={cell.id}
                          style={{
                            width: cell.column.getSize(),
                            maxWidth: cell.column.getSize(),
                          }}
                          className="px-3.5 py-2 border-r border-slate-200 text-xs truncate"
                        >
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 4. Clean Light Footer Bar with Pagination & Return Link ───────────── */}
      <div className="bg-slate-50 border-t border-slate-300 px-3 py-2 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600 select-none">
        {/* Left: Counts and Page Size Selector */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span>Rows per page:</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              className="px-2 py-0.5 rounded border border-slate-300 bg-white text-xs font-medium text-slate-700 outline-none cursor-pointer"
            >
              {[10, 25, 50, 100].map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          <span className="text-slate-300">|</span>

          <div className="flex items-center gap-2">
            <span>
              Total records: <strong className="text-slate-800 font-mono">{catalog.length}</strong>
            </span>
            <span>•</span>
            <span>
              Already in Project:{' '}
              <strong className="text-slate-800 font-mono">{existingCodes.size}</strong>
            </span>
          </div>
        </div>

        {/* Center: Page Navigation Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            title="First Page"
            className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <ChevronsLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            title="Previous Page"
            className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <ChevronLeft size={13} />
          </button>

          <span className="px-2 text-xs font-medium text-slate-700">
            Page <strong className="font-bold">{table.getState().pagination.pageIndex + 1}</strong> of{' '}
            <strong className="font-bold">{Math.max(1, table.getPageCount())}</strong>
          </span>

          <button
            type="button"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            title="Next Page"
            className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <ChevronRight size={13} />
          </button>
          <button
            type="button"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            title="Last Page"
            className="w-7 h-7 rounded border border-slate-300 bg-white text-slate-700 flex items-center justify-center hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-2xs"
          >
            <ChevronsRight size={13} />
          </button>
        </div>

        {/* Right: Return to Site view */}
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-600 hover:text-slate-900 font-medium underline-offset-2 hover:underline cursor-pointer"
        >
          ← Return to Site Business Partners
        </button>
      </div>
    </div>
  );
}
