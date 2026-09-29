/**
 * EquipmentImportView.tsx
 *
 * Dedicated ERP Master directory view for Equipment,
 * styled to 100% match BusinessPartnerErpMasterView (Prisma Studio UI aesthetics).
 *
 * Features:
 *   - Prisma Studio Clean Light Tab Bar with Truck icon
 *   - Studio Control Toolbar: [↻] Refresh, Filters Popover, Search, Fields, Showing X of Y, Add record / Import button
 *   - Crisp high-contrast visible borders (border-slate-300 on headers/containers, border-slate-200 on cell grid)
 *   - Prisma Studio data-type indicators (A, A?, 123?) on column headers
 *   - Multi-row selection & batch import + 1-click single "+ Add"
 *   - Clean Light Footer Bar with totals, pagination, and return link
 */
import { useState, useMemo } from 'react';
import {
  RotateCw,
  X,
  Search,
  Check,
  ArrowLeft,
  SlidersHorizontal,
  Truck,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import type { CorporateEquipment } from '../../master-import/services/corporateMasterService';

interface EquipmentImportViewProps {
  onBack: () => void;
  catalog: CorporateEquipment[];
  existingCodes: Set<string>;
  onImport: (items: CorporateEquipment[]) => Promise<void> | void;
}

export default function EquipmentImportView({
  onBack,
  catalog,
  existingCodes,
  onImport,
}: EquipmentImportViewProps) {
  // Filters & search
  const [globalSearch, setGlobalSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [filterSource, setFilterSource] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'IN_SITE'>('ALL');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sort
  const [sortField, setSortField] = useState<'code' | 'name' | 'searchKey' | 'costRate' | 'source'>('code');
  const [sortAsc, setSortAsc] = useState(true);

  // Selection
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Distinct dropdowns
  const equipmentTypes = useMemo(() =>
    Array.from(new Set(catalog.map((c) => c.type).filter(Boolean))).sort()
  , [catalog]);

  const sourceProjects = useMemo(() =>
    Array.from(new Set(catalog.map((c) => c.sourceProject).filter(Boolean))).sort()
  , [catalog]);

  // Status per item
  const getItemStatus = (item: CorporateEquipment) => {
    if (existingCodes.has(item.code.toUpperCase())) {
      return {
        type: 'IN_SITE' as const,
        label: 'in site',
        badgeClass: 'text-slate-500 bg-slate-100 border-slate-200',
      };
    }
    return {
      type: 'AVAILABLE' as const,
      label: 'available',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    };
  };

  // Filtered + sorted data
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const status = getItemStatus(item);
      if (filterStatus === 'AVAILABLE' && status.type !== 'AVAILABLE') return false;
      if (filterStatus === 'IN_SITE' && status.type !== 'IN_SITE') return false;
      if (filterType !== 'ALL' && item.type !== filterType) return false;
      if (filterSource !== 'ALL' && item.sourceProject !== filterSource) return false;

      if (globalSearch.trim()) {
        const q = globalSearch.toLowerCase();
        if (
          !item.code.toLowerCase().includes(q) &&
          !item.name.toLowerCase().includes(q) &&
          !(item.searchKey && item.searchKey.toLowerCase().includes(q)) &&
          !item.sourceProject.toLowerCase().includes(q) &&
          !item.model.toLowerCase().includes(q) &&
          !item.registrationNo.toLowerCase().includes(q) &&
          !item.type.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }).sort((a, b) => {
      let comp = 0;
      if (sortField === 'code') comp = a.code.localeCompare(b.code);
      else if (sortField === 'name') comp = a.name.localeCompare(b.name);
      else if (sortField === 'searchKey') comp = (a.searchKey || a.name).localeCompare(b.searchKey || b.name);
      else if (sortField === 'costRate') comp = (a.costRate ?? 0) - (b.costRate ?? 0);
      else if (sortField === 'source') comp = a.sourceProject.localeCompare(b.sourceProject);
      return sortAsc ? comp : -comp;
    });
  }, [catalog, existingCodes, globalSearch, filterStatus, filterType, filterSource, sortField, sortAsc]);

  // Pagination
  const totalItems = filteredCatalog.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedCatalog = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredCatalog.slice(start, start + pageSize);
  }, [filteredCatalog, safeCurrentPage, pageSize]);

  // Selectable items in current page
  const selectablePageItems = useMemo(() => {
    return paginatedCatalog.filter((item) => !existingCodes.has(item.code.toUpperCase()));
  }, [paginatedCatalog, existingCodes]);

  const allPageSelectableChecked =
    selectablePageItems.length > 0 &&
    selectablePageItems.every((item) => selectedCodes.has(item.code));

  const toggleSelectAll = () => {
    if (allPageSelectableChecked) {
      const next = new Set(selectedCodes);
      selectablePageItems.forEach((item) => next.delete(item.code));
      setSelectedCodes(next);
    } else {
      const next = new Set(selectedCodes);
      selectablePageItems.forEach((item) => next.add(item.code));
      setSelectedCodes(next);
    }
  };

  const toggleSelectRow = (code: string) => {
    if (existingCodes.has(code.toUpperCase())) return;
    const next = new Set(selectedCodes);
    if (next.has(code)) {
      next.delete(code);
    } else {
      next.add(code);
    }
    setSelectedCodes(next);
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  const handleBatchImport = async () => {
    if (selectedCodes.size === 0 || isSubmitting) return;
    const selectedItems = catalog.filter((item) => selectedCodes.has(item.code));
    setIsSubmitting(true);
    try {
      await onImport(selectedItems);
      setSelectedCodes(new Set());
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSingleImport = async (item: CorporateEquipment) => {
    if (existingCodes.has(item.code.toUpperCase()) || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onImport([item]);
      const next = new Set(selectedCodes);
      next.delete(item.code);
      setSelectedCodes(next);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const hasActiveFilters = filterType !== 'ALL' || filterSource !== 'ALL' || filterStatus !== 'ALL';

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden flex flex-col font-sans transition-colors animate-in fade-in duration-150">
      {/* ── 1. Tab Bar (Clean Light) ────────────────────────────────────────── */}
      <div className="bg-slate-50/80 border-b border-slate-300 px-2 pt-1.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            title="Back to Site Equipment"
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors mr-1 cursor-pointer"
          >
            <ArrowLeft size={14} />
          </button>

          {/* Active Tab: Equipment (ERP Master) */}
          <div className="bg-white text-slate-800 font-semibold text-xs px-3 py-1.5 border-t-2 border-t-blue-600 border-x border-slate-300 flex items-center gap-2 rounded-t-md shadow-xs">
            <Truck size={13} className="text-blue-600" />
            <span>Equipment</span>
            <button
              type="button"
              onClick={onBack}
              className="text-slate-400 hover:text-slate-700 rounded p-0.5 transition-colors cursor-pointer"
              title="Close Equipment tab"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Right Exit View Button */}
        <div className="flex items-center gap-1 text-slate-500 pb-1">
          <button
            type="button"
            onClick={onBack}
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
                {hasActiveFilters ? 'Active' : 'None'}
              </span>
            </button>

            {/* Filter Dropdown Popover */}
            {showFilterDropdown && (
              <div className="absolute left-0 mt-1 w-64 bg-white border border-slate-300 rounded-lg shadow-lg z-30 p-2.5 space-y-2">
                <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                  <span className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    Equipment Filters
                  </span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterType('ALL');
                        setFilterSource('ALL');
                        setFilterStatus('ALL');
                        setCurrentPage(1);
                      }}
                      className="text-[10px] text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Reset All
                    </button>
                  )}
                </div>

                {/* Status filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => {
                      setFilterStatus(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="AVAILABLE">Available</option>
                    <option value="IN_SITE">In Current Site</option>
                  </select>
                </div>

                {/* Type filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Equipment Type</label>
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Types ({equipmentTypes.length})</option>
                    {equipmentTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                {/* Source filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Source Project</label>
                  <select
                    value={filterSource}
                    onChange={(e) => {
                      setFilterSource(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Sources ({sourceProjects.length})</option>
                    {sourceProjects.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={globalSearch}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search equipment, model, reg no..."
              className="pl-7 pr-2.5 py-1 text-xs rounded border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-52 transition-all shadow-xs"
            />
          </div>

          {/* Fields Pill */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-medium shadow-xs">
            <span>Fields</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[11px] font-normal border border-slate-200">
              All 6
            </span>
          </div>

          {/* Showing Count Badge */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-medium shadow-xs">
            <span>Showing</span>
            <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[11px] font-normal tabular-nums border border-slate-200">
              {filteredCatalog.length} of {catalog.length}
            </span>
          </div>
        </div>

        {/* Right Action: Button ("Add record" / "Import Selected") */}
        <div className="flex items-center gap-2">
          {selectedCodes.size > 0 && (
            <span className="text-xs text-blue-700 font-semibold">
              {selectedCodes.size} selected
            </span>
          )}

          <button
            type="button"
            disabled={selectedCodes.size === 0 || isSubmitting}
            onClick={handleBatchImport}
            title={selectedCodes.size === 0 ? 'Select rows using checkboxes to import' : 'Import selected equipment to project site'}
            className={[
              'px-3.5 py-1.5 rounded font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer',
              selectedCodes.size > 0
                ? 'bg-slate-800 hover:bg-slate-900 text-white active:scale-98'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            ].join(' ')}
          >
            {isSubmitting ? (
              <>
                <RotateCw size={12} className="animate-spin" />
                <span>Importing…</span>
              </>
            ) : (
              <>
                <span>Add record</span>
                {selectedCodes.size > 0 && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                    {selectedCodes.size}
                  </span>
                )}
              </>
            )}
          </button>
        </div>
      </div>

      {/* ── 3. White Data Grid Table with Crisp Visible Borders ───────────────── */}
      <div className="overflow-x-auto scrollbar-none flex-1 max-h-[calc(100vh-190px)] min-h-[380px] bg-white">
        <table className="w-full border-collapse text-left text-xs bg-white">
          <thead>
            <tr className="bg-slate-50 text-slate-800 border-b-2 border-slate-300 select-none sticky top-0 z-10 shadow-xs">
              {/* Checkbox column */}
              <th className="w-10 px-2.5 py-2.5 border-r border-slate-300 text-center font-normal bg-slate-50">
                <input
                  type="checkbox"
                  checked={allPageSelectableChecked}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                  className="rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
              </th>

              {/* Code */}
              <th
                onClick={() => handleSort('code')}
                className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[120px] bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Equipment</span>
                  <ArrowUpDown size={11} className={sortField === 'code' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A</span>
                </div>
              </th>

              {/* Description */}
              <th
                onClick={() => handleSort('name')}
                className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[240px] bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Description</span>
                  <ArrowUpDown size={11} className={sortField === 'name' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A</span>
                </div>
              </th>

              {/* Search Key */}
              {/* <th
                onClick={() => handleSort('searchKey')}
                className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[160px] bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Search Key</span>
                  <ArrowUpDown size={11} className={sortField === 'searchKey' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A?</span>
                </div>
              </th> */}

              {/* Cost Rate */}
              <th
                onClick={() => handleSort('costRate')}
                className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[130px] bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Cost Rate</span>
                  <ArrowUpDown size={11} className={sortField === 'costRate' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-slate-400 font-mono text-[11px] font-normal">123?</span>
                </div>
              </th>

              {/* Source Project */}
              <th
                onClick={() => handleSort('source')}
                className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[180px] bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Source Project</span>
                  <ArrowUpDown size={11} className={sortField === 'source' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A?</span>
                </div>
              </th>

              {/* Status */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[100px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Status</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A</span>
                </div>
              </th>

              {/* Action */}
              <th className="px-3 py-2.5 font-semibold whitespace-nowrap min-w-[100px] text-right bg-slate-50">
                <span className="text-slate-600">Action</span>
              </th>
            </tr>
          </thead>

          {/* Table Body (Clean White with distinct cell borders) */}
          <tbody className="divide-y divide-slate-200 bg-white">
            {paginatedCatalog.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400 text-xs bg-white">
                  No equipment found matching &quot;{globalSearch}&quot;.
                </td>
              </tr>
            ) : (
              paginatedCatalog.map((item) => {
                const statusInfo = getItemStatus(item);
                const isExisting = statusInfo.type === 'IN_SITE';
                const isChecked = selectedCodes.has(item.code);

                return (
                  <tr
                    key={item.code}
                    onClick={() => {
                      if (!isExisting) toggleSelectRow(item.code);
                    }}
                    className={[
                      'transition-colors border-b border-slate-200',
                      isExisting
                        ? 'bg-slate-50 text-slate-400 cursor-default'
                        : isChecked
                        ? 'bg-blue-50/70 hover:bg-blue-100/60 cursor-pointer'
                        : 'bg-white hover:bg-blue-50/40 cursor-pointer'
                    ].join(' ')}
                  >
                    {/* Checkbox column */}
                    <td
                      className="px-2.5 py-2 text-center border-r border-slate-200"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        disabled={isExisting}
                        checked={isChecked}
                        onChange={() => toggleSelectRow(item.code)}
                        aria-label={`Select ${item.code}`}
                        className="rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                      />
                    </td>

                    {/* Code (Monospace font) */}
                    <td className="px-3.5 py-2 font-mono text-xs text-slate-900 font-semibold border-r border-slate-200 whitespace-nowrap">
                      {item.code}
                    </td>

                    {/* Description (Name) */}
                    <td className="px-3.5 py-2 border-r border-slate-200">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 leading-tight">
                          {item.type}
                        </span>
                        {/* <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-[10px] font-medium text-slate-700">
                            {item.name}
                          </span>
                          {item.model && (
                            <span className="text-[10px] text-slate-500">
                              • {item.model}
                            </span>
                          )}
                          {item.registrationNo && (
                            <span className="text-[10px] text-slate-500">
                              • Reg: {item.registrationNo}
                            </span>
                          )}
                        </div> */}
                      </div>
                    </td>

                    {/* Search Key */}
                    {/* <td className="px-3.5 py-2 text-slate-700 font-mono text-xs border-r border-slate-200 whitespace-nowrap">
                      {item.searchKey || item.name}
                    </td> */}

                    {/* Cost Rate */}
                    <td className="px-3.5 py-2 font-mono text-xs text-slate-800 border-r border-slate-200 whitespace-nowrap">
                      {typeof item.costRate === 'number'
                        ? `${item.costRate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${item.currency || 'LKR'}`
                        : '—'}
                    </td>

                    {/* Source Project */}
                    <td className="px-3.5 py-2 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {item.sourceProject || '—'}
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-2 font-mono text-xs border-r border-slate-200 whitespace-nowrap">
                      <span className={['font-medium border px-1.5 py-0.5 rounded text-[11px]', statusInfo.badgeClass].join(' ')}>
                        {statusInfo.label}
                      </span>
                    </td>

                    {/* Action column */}
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isExisting ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          <Check size={11} /> In Site
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSingleImport(item)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded border border-blue-600 text-blue-700 bg-white hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                          + Add
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 4. Clean Light Footer Bar ─────────────────────────────────────────── */}
      <div className="bg-slate-50 border-t border-slate-300 px-3 py-2 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>Total records: <strong className="text-slate-800 font-mono">{catalog.length}</strong></span>
          <span>•</span>
          <span>In Site: <strong className="text-slate-800 font-mono">{existingCodes.size}</strong></span>
          <span>•</span>
          <span>Matching: <strong className="text-slate-800 font-mono">{totalItems}</strong></span>
        </div>

        {/* Pagination controls in footer */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-slate-500">Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="text-xs bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-700 outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="p-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="First Page"
            >
              <ChevronsLeft size={13} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Previous Page"
            >
              <ChevronLeft size={13} />
            </button>

            <span className="px-2 py-0.5 text-slate-700 font-mono font-medium">
              {safeCurrentPage} / {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Next Page"
            >
              <ChevronRight size={13} />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="p-1 rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Last Page"
            >
              <ChevronsRight size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={onBack}
            className="text-xs text-slate-600 hover:text-slate-900 font-medium underline-offset-2 hover:underline cursor-pointer ml-2"
          >
            ← Return to Site Equipment
          </button>
        </div>
      </div>
    </div>
  );
}
