/**
 * BusinessPartnerErpMasterView.tsx
 *
 * Dedicated ERP Master directory view for Business Partners,
 * styled to match Prisma Studio UI aesthetics.
 *
 * Implemented locally inside features/business-partners (not using shared modal components).
 * Renders directly on the page in place of the standard list view.
 *
 * Features:
 *   - Prisma Studio Tab Bar (active tab with close button, inactive tabs, gear icon)
 *   - Studio Control Toolbar: [↻] Refresh, Filters, Fields, Showing X of Y, Add record / Import button
 *   - Specific columns: Code, Business Partner Name, Contact Person, Phone / Email, Status
 *   - Prisma Studio data-type indicators (A, A?) on column headers
 *   - Grid lines with subtle cell borders and monospace data
 *   - Multi-row selection & batch import to current project
 */
import { useState, useMemo, useEffect } from 'react';
import { 
  RotateCw, 
  X, 
  Search, 
  Check, 
  ArrowLeft,
  SlidersHorizontal,
  Table as TableIcon
} from 'lucide-react';
import { CORPORATE_PARTNERS_CATALOG, type CorporateBusinessPartner, fetchCorporateBusinessPartners } from '../../master-import/services/corporateMasterService';

interface BusinessPartnerErpMasterViewProps {
  existingCodes: Set<string>;
  onImport: (items: CorporateBusinessPartner[]) => Promise<void>;
  onClose: () => void;
}

export default function BusinessPartnerErpMasterView({
  existingCodes,
  onImport,
  onClose,
}: BusinessPartnerErpMasterViewProps) {
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [catalog, setCatalog] = useState<CorporateBusinessPartner[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const loadCatalog = async () => {
    setIsRefreshing(true);
    setIsLoadingCatalog(true);
    try {
      const data = await fetchCorporateBusinessPartners();
      setCatalog(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingCatalog(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  // Available partner types for filter
  const partnerTypes = useMemo(() => {
    const types = new Set(catalog.map((p) => p.type));
    return ['all', ...Array.from(types)];
  }, [catalog]);

  // Filtered catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        (item.contactPerson && item.contactPerson.toLowerCase().includes(q)) ||
        (item.phone && item.phone.toLowerCase().includes(q)) ||
        (item.email && item.email.toLowerCase().includes(q));

      const matchesType = selectedType === 'all' || item.type === selectedType;

      return matchesSearch && matchesType;
    });
  }, [catalog, search, selectedType]);

  // Selectable items (excluding already existing codes in the project)
  const selectableItems = useMemo(() => {
    return filteredCatalog.filter((item) => !existingCodes.has(item.code.toUpperCase()));
  }, [filteredCatalog, existingCodes]);

  const allSelectableChecked =
    selectableItems.length > 0 &&
    selectableItems.every((item) => selectedCodes.has(item.code));

  const toggleSelectAll = () => {
    if (allSelectableChecked) {
      // Unselect all in current view
      const next = new Set(selectedCodes);
      selectableItems.forEach((item) => next.delete(item.code));
      setSelectedCodes(next);
    } else {
      // Select all selectable in current view
      const next = new Set(selectedCodes);
      selectableItems.forEach((item) => next.add(item.code));
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
    loadCatalog();
  };

  const handleImportSelected = async () => {
    if (selectedCodes.size === 0 || isImporting) return;
    setIsImporting(true);
    try {
      const itemsToImport = catalog.filter((item) =>
        selectedCodes.has(item.code)
      );
      await onImport(itemsToImport);
      setSelectedCodes(new Set());
      onClose();
    } finally {
      setIsImporting(false);
    }
  };

  const handleSingleImport = async (item: CorporateBusinessPartner) => {
    if (existingCodes.has(item.code.toUpperCase()) || isImporting) return;
    setIsImporting(true);
    try {
      await onImport([item]);
      const next = new Set(selectedCodes);
      next.delete(item.code);
      setSelectedCodes(next);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden flex flex-col font-sans transition-colors animate-in fade-in duration-150">
      {/* ── 1. Prisma Studio Style Tab Bar (Clean Light) ────────────────────────── */}
      <div className="bg-slate-50/80 border-b border-slate-300 px-2 pt-1.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {/* Side panel toggle icon */}
          <button
            type="button"
            onClick={onClose}
            title="Back to Business Partners"
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors mr-1 cursor-pointer"
          >
            <ArrowLeft size={14} />
          </button>

          {/* Active Tab: Business Partners (ERP Master) */}
          <div className="bg-white text-slate-800 font-semibold text-xs px-3 py-1.5 border-t-2 border-t-blue-600 border-x border-slate-300 flex items-center gap-2 rounded-t-md shadow-xs">
            <TableIcon size={13} className="text-blue-600" />
            <span>Business Partner</span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 rounded p-0.5 transition-colors cursor-pointer"
              title="Close ERP Master tab"
            >
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Right Settings Cog / Exit */}
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

          {/* Filters Pill */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-medium hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
            >
              <SlidersHorizontal size={12} className="text-slate-500" />
              <span>Filters</span>
              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded text-[11px] font-normal capitalize border border-slate-200">
                {selectedType === 'all' ? 'None' : selectedType}
              </span>
            </button>

            {/* Filter Dropdown Popover */}
            {showFilterDropdown && (
              <div className="absolute left-0 mt-1 w-44 bg-white border border-slate-300 rounded-lg shadow-lg z-30 p-1 space-y-0.5">
                <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                  Partner Type
                </div>
                {partnerTypes.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setSelectedType(t);
                      setShowFilterDropdown(false);
                    }}
                    className={[
                      'w-full text-left px-2 py-1.5 rounded text-xs capitalize flex items-center justify-between cursor-pointer',
                      selectedType === t
                        ? 'bg-blue-50 text-blue-700 font-medium border border-blue-200'
                        : 'text-slate-700 hover:bg-slate-100'
                    ].join(' ')}
                  >
                    <span>{t === 'all' ? 'All Types' : t}</span>
                    {selectedType === t && <Check size={12} />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Search */}
          <div className="relative">
            <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search partner, code, contact..."
              className="pl-7 pr-2.5 py-1 text-xs rounded border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-48 transition-all shadow-xs"
            />
          </div>

          {/* Fields Pill */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-medium shadow-xs">
            <span>Fields</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[11px] font-normal border border-slate-200">
              All 5
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
            disabled={selectedCodes.size === 0 || isImporting}
            onClick={handleImportSelected}
            title={selectedCodes.size === 0 ? 'Select rows using checkboxes to import' : 'Import selected partners to project'}
            className={[
              'px-3.5 py-1.5 rounded font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all cursor-pointer',
              selectedCodes.size > 0
                ? 'bg-slate-800 hover:bg-slate-900 text-white active:scale-98'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            ].join(' ')}
          >
            {isImporting ? (
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
      <div className="overflow-x-auto scrollbar-none flex-1 max-h-[calc(100vh-280px)] min-h-[380px] bg-white">
        <table className="w-full border-collapse text-left text-xs bg-white">
          {/* Table Header with Slate-50 background and crisp bottom/right borders */}
          <thead>
            <tr className="bg-slate-50 text-slate-800 border-b-2 border-slate-300 select-none sticky top-0 z-10 shadow-xs">
              {/* Checkbox column */}
              <th className="w-10 px-2.5 py-2.5 border-r border-slate-300 text-center font-normal bg-slate-50">
                <input
                  type="checkbox"
                  checked={allSelectableChecked}
                  onChange={toggleSelectAll}
                  aria-label="Select all rows"
                  className="rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer"
                />
              </th>

              {/* Code */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[120px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Code</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">
                    A
                  </span>
                </div>
              </th>

              {/* Business Partner Name */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[240px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Business Partner Name</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">
                    A
                  </span>
                </div>
              </th>

              {/* Contact Person */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[180px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Contact Person</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">
                    A?
                  </span>
                </div>
              </th>

              {/* Phone / Email */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[200px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Phone / Email</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">
                    A?
                  </span>
                </div>
              </th>

              {/* Status */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[100px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Status</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">
                    A
                  </span>
                </div>
              </th>

              {/* Action / Quick Add */}
              <th className="px-3 py-2.5 font-semibold whitespace-nowrap min-w-[110px] text-right bg-slate-50">
                <span className="text-slate-600">Action</span>
              </th>
            </tr>
          </thead>

          {/* Table Body (Clean White with distinct cell borders) */}
          <tbody className="divide-y divide-slate-200 bg-white">
            {isLoadingCatalog ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-xs bg-white">
                  Loading ERP master directory...
                </td>
              </tr>
            ) : filteredCatalog.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-xs bg-white">
                  No ERP business partners found matching &quot;{search}&quot;.
                </td>
              </tr>
            ) : (
              filteredCatalog.map((item) => {
                const isExisting = existingCodes.has(item.code.toUpperCase());
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

                    {/* Business Partner Name */}
                    <td className="px-3.5 py-2 border-r border-slate-200">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 leading-tight">
                          {item.name}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500">
                          <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-[10px] font-medium text-slate-700">
                            {item.type}
                          </span>
                          {item.rating && (
                            <span className="text-[10px] text-slate-500 font-medium">
                              • {item.rating}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Contact Person */}
                    <td className="px-3.5 py-2 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      {item.contactPerson || '—'}
                    </td>

                    {/* Phone / Email */}
                    <td className="px-3.5 py-2 text-slate-700 font-mono text-[11px] border-r border-slate-200 whitespace-nowrap">
                      {item.phone && <div>{item.phone}</div>}
                      {item.email && <div className="text-slate-500 font-sans text-[11px]">{item.email}</div>}
                      {!item.phone && !item.email && '—'}
                    </td>

                    {/* Status */}
                    <td className="px-3.5 py-2 font-mono text-xs border-r border-slate-200 whitespace-nowrap">
                      <span className="text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded text-[11px]">
                        active
                      </span>
                    </td>

                    {/* Action column */}
                    <td className="px-3 py-2 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isExisting ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          <Check size={11} /> Added
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={isImporting}
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
      <div className="bg-slate-50 border-t border-slate-300 px-3 py-2 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>Total records: <strong className="text-slate-800 font-mono">{catalog.length}</strong></span>
          <span>•</span>
          <span>Already in Project: <strong className="text-slate-800 font-mono">{existingCodes.size}</strong></span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-600 hover:text-slate-900 font-medium underline-offset-2 hover:underline cursor-pointer"
        >
          ← Return to Project Business Partners
        </button>
      </div>
    </div>
  );
}
