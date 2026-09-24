/**
 * MasterImportModal.tsx
 *
 * Enterprise ERP Master Data Import Portal (IFS / SAP Data Grid Layout).
 * Sized with maximum width and height for wide enterprise screens.
 * Features a compact top header, slim search & filter bar, and dense,
 * highly readable grid lines inspired by industrial ERP master data windows.
 */
import { useState, useMemo } from 'react';
import {
  Search,
  CheckCircle2,
  Database,
  Building,
  X,
  Filter,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
} from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  width?: string;
}

interface Props<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  entityName: string; // e.g. "Equipment", "Business Partner", "Employee", "Activity Code"
  catalog: T[];
  existingCodes: Set<string>;
  getItemCode: (item: T) => string;
  getItemName: (item: T) => string;
  getItemCategory: (item: T) => string;
  getItemSourceProject: (item: T) => string;
  columns: ColumnDef<T>[];
  onImport: (selectedItems: T[]) => Promise<void>;
  onOpenManualAdd?: () => void;
}

export default function MasterImportModal<T>({
  isOpen,
  onClose,
  title,
  subtitle,
  entityName,
  catalog,
  existingCodes,
  getItemCode,
  getItemName,
  getItemCategory,
  getItemSourceProject,
  columns,
  onImport,
  onOpenManualAdd,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [hideExisting, setHideExisting] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Distinct dropdown options
  const projectOptions = useMemo(() => {
    return Array.from(new Set(catalog.map(getItemSourceProject))).filter(Boolean).sort();
  }, [catalog, getItemSourceProject]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(catalog.map(getItemCategory))).filter(Boolean).sort();
  }, [catalog, getItemCategory]);

  // Filtering
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const code = getItemCode(item).toLowerCase();
      const name = getItemName(item).toLowerCase();
      const q = search.trim().toLowerCase();

      if (q && !code.includes(q) && !name.includes(q)) {
        return false;
      }
      if (selectedProject !== 'ALL' && getItemSourceProject(item) !== selectedProject) {
        return false;
      }
      if (selectedCategory !== 'ALL' && getItemCategory(item) !== selectedCategory) {
        return false;
      }
      if (hideExisting && existingCodes.has(getItemCode(item))) {
        return false;
      }
      return true;
    });
  }, [
    catalog,
    search,
    selectedProject,
    selectedCategory,
    hideExisting,
    existingCodes,
    getItemCode,
    getItemName,
    getItemCategory,
    getItemSourceProject,
  ]);

  // Selectable items (excluding already in project)
  const availableItems = useMemo(() => {
    return filteredCatalog.filter((item) => !existingCodes.has(getItemCode(item)));
  }, [filteredCatalog, existingCodes, getItemCode]);

  const allAvailableSelected =
    availableItems.length > 0 &&
    availableItems.every((item) => selectedCodes.has(getItemCode(item)));

  const handleToggleSelectAll = () => {
    if (allAvailableSelected) {
      setSelectedCodes(new Set());
    } else {
      const next = new Set<string>();
      availableItems.forEach((item) => next.add(getItemCode(item)));
      setSelectedCodes(next);
    }
  };

  const handleToggleItem = (code: string) => {
    if (existingCodes.has(code)) return;
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  };

  const handleExecuteImport = async () => {
    if (selectedCodes.size === 0 || isImporting) return;
    const itemsToImport = catalog.filter((item) => selectedCodes.has(getItemCode(item)));
    setIsImporting(true);
    try {
      await onImport(itemsToImport);
      setSuccessMessage(
        `Successfully imported ${itemsToImport.length} ${entityName.toLowerCase()}${
          itemsToImport.length !== 1 ? 's' : ''
        } into project workspace!`
      );
      setSelectedCodes(new Set());
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 1300);
    } catch (err: any) {
      console.error('Import failed:', err);
      alert(err?.message || 'Failed to import master records');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      {/* ── Wide & Tall ERP Window Container ───────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-2xl border border-slate-300 w-[96vw] max-w-[1450px] h-[92vh] max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">

        {/* ── Reduced Slim Header (IFS ERP Window Bar) ───────────────────── */}
        <div className="h-10 px-3.5 bg-[#1E293B] text-white flex items-center justify-between flex-shrink-0 border-b border-slate-700 select-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <Database size={15} className="text-blue-400 flex-shrink-0" />
            <span className="text-xs font-semibold text-slate-100 tracking-tight truncate">
              {title}
            </span>
            <span className="hidden md:inline-block text-slate-500">•</span>
            <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              IFS / Central Corporate ERP
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 hidden sm:inline-block">
              {subtitle}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors flex items-center justify-center cursor-pointer"
              aria-label="Close window"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* ── Reduced Slim Search & Filter Toolbar ─────────────────────────── */}
        <div className="h-11 px-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2.5 flex-shrink-0 select-none text-xs">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {/* Search Input */}
            <div className="relative w-48 sm:w-64 md:w-80">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search by code or ${entityName.toLowerCase()} name…`}
                className="w-full pl-8 pr-6 py-1 h-7.5 rounded border border-slate-300 bg-white text-xs text-slate-800 placeholder-slate-400 focus:ring-1 focus:ring-blue-600 focus:border-blue-600 outline-none transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Source Project Filter */}
            <div className="hidden sm:flex items-center gap-1.5">
              <Building size={13} className="text-slate-400 flex-shrink-0" />
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="h-7.5 px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px] font-medium text-slate-700 focus:ring-1 focus:ring-blue-600 outline-none cursor-pointer max-w-[200px] truncate"
              >
                <option value="ALL">All Source Projects ({projectOptions.length})</option>
                {projectOptions.map((proj) => (
                  <option key={proj} value={proj}>
                    {proj}
                  </option>
                ))}
              </select>
            </div>

            {/* Category / Trade Filter */}
            <div className="hidden md:flex items-center gap-1.5">
              <Filter size={13} className="text-slate-400 flex-shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="h-7.5 px-2 py-0.5 rounded border border-slate-300 bg-white text-[11px] font-medium text-slate-700 focus:ring-1 focus:ring-blue-600 outline-none cursor-pointer max-w-[160px] truncate"
              >
                <option value="ALL">All Categories ({categoryOptions.length})</option>
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Available Only Checkbox */}
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 cursor-pointer select-none ml-1">
              <input
                type="checkbox"
                checked={hideExisting}
                onChange={(e) => setHideExisting(e.target.checked)}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="whitespace-nowrap">Available only</span>
            </label>
          </div>

          {/* Quick Counter Info */}
          <div className="hidden lg:flex items-center gap-2 text-[11px] text-slate-500 flex-shrink-0">
            <span>
              Total: <strong className="font-semibold text-slate-700">{filteredCatalog.length}</strong>
            </span>
            <span>•</span>
            <span className="text-emerald-700 font-medium">
              Available: <strong>{availableItems.length}</strong>
            </span>
            {selectedCodes.size > 0 && (
              <span className="font-semibold text-blue-700 bg-blue-100/80 px-2 py-0.5 rounded-full border border-blue-200">
                {selectedCodes.size} selected
              </span>
            )}
          </div>
        </div>

        {/* ── Success Banner ───────────────────────────────────────────────── */}
        {successMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center gap-2 text-emerald-800 text-xs font-medium animate-in fade-in duration-100 flex-shrink-0">
            <Check size={16} className="text-emerald-600 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* ── ERP Data Grid Table (High Density, Crisp Lines) ─────────────── */}
        <div
          className="flex-1 overflow-auto scrollbar-none bg-white select-none"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {filteredCatalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
              <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mb-2.5">
                <AlertCircle size={20} className="text-slate-400" />
              </div>
              <p className="text-xs font-medium text-slate-700">No master records match your filter criteria</p>
              <button
                type="button"
                onClick={() => {
                  setSearch('');
                  setSelectedProject('ALL');
                  setSelectedCategory('ALL');
                  setHideExisting(false);
                }}
                className="mt-2 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <table className="w-full text-left border-collapse border-b border-slate-200">
              {/* Dark Charcoal IFS ERP Header Row */}
              <thead className="bg-[#334155] text-slate-100 sticky top-0 z-10 text-[11px] font-semibold uppercase tracking-wider shadow-xs">
                <tr>
                  <th className="py-2 px-2.5 w-10 text-center border-r border-slate-600">
                    <input
                      type="checkbox"
                      checked={allAvailableSelected}
                      onChange={handleToggleSelectAll}
                      disabled={availableItems.length === 0}
                      title="Select all available"
                      className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                    />
                  </th>
                  <th className="py-2 px-3 border-r border-slate-600 whitespace-nowrap w-28">
                    Code
                  </th>
                  <th className="py-2 px-3 border-r border-slate-600 min-w-[220px]">
                    Name / Description
                  </th>
                  <th className="py-2 px-3 border-r border-slate-600 whitespace-nowrap w-36">
                    Category / Trade
                  </th>
                  <th className="py-2 px-3 border-r border-slate-600 whitespace-nowrap hidden lg:table-cell">
                    Source Project / Yard
                  </th>
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className="py-2 px-3 border-r border-slate-600 whitespace-nowrap hidden sm:table-cell"
                      style={{ width: col.width }}
                    >
                      {col.header}
                    </th>
                  ))}
                  <th className="py-2 px-3 text-right whitespace-nowrap w-28">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredCatalog.map((item, idx) => {
                  const code = getItemCode(item);
                  const isAlreadyInProject = existingCodes.has(code);
                  const isChecked = selectedCodes.has(code);

                  return (
                    <tr
                      key={code}
                      onClick={() => !isAlreadyInProject && handleToggleItem(code)}
                      className={[
                        'transition-colors font-normal',
                        idx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white',
                        isAlreadyInProject
                          ? 'text-slate-400 bg-slate-50/80 cursor-not-allowed opacity-75'
                          : isChecked
                          ? 'bg-blue-50 hover:bg-blue-100/60 cursor-pointer'
                          : 'hover:bg-slate-100/70 cursor-pointer',
                      ].join(' ')}
                    >
                      {/* Checkbox Cell */}
                      <td
                        className="py-2 px-2.5 w-10 text-center border-r border-slate-200"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleItem(code)}
                          disabled={isAlreadyInProject}
                          className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                        />
                      </td>

                      {/* Code Cell */}
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100/90 border border-slate-200 px-1.5 py-0.5 rounded">
                          {code}
                        </span>
                      </td>

                      {/* Name / Description Cell */}
                      <td className="py-2 px-3 border-r border-slate-200 text-slate-800 font-medium">
                        {getItemName(item)}
                      </td>

                      {/* Category Cell */}
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap text-slate-600">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full text-[11px] font-medium border border-slate-200/80">
                          {getItemCategory(item)}
                        </span>
                      </td>

                      {/* Source Project Cell */}
                      <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap hidden lg:table-cell text-slate-600 text-[11px]">
                        <span className="flex items-center gap-1.5">
                          <Building size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="truncate max-w-[240px]">{getItemSourceProject(item)}</span>
                        </span>
                      </td>

                      {/* Dynamic Columns */}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className="py-2 px-3 border-r border-slate-200 whitespace-nowrap hidden sm:table-cell text-slate-600 text-xs"
                        >
                          {col.render(item)}
                        </td>
                      ))}

                      {/* Status Cell */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        {isAlreadyInProject ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <CheckCircle2 size={11} className="text-emerald-600" />
                            In Project
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Available
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Compact Slim Action Footer ─────────────────────────────────── */}
        <div className="h-11 px-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0 select-none text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">
              Showing <strong className="text-slate-700 font-semibold">{filteredCatalog.length}</strong> items
              (Available: <strong className="text-emerald-700 font-semibold">{availableItems.length}</strong>)
            </span>
            {selectedCodes.size > 0 && (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-100/90 border border-blue-200 px-2 py-0.5 rounded-full">
                {selectedCodes.size} item{selectedCodes.size !== 1 ? 's' : ''} selected
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {onOpenManualAdd && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenManualAdd();
                }}
                className="text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-300 hover:bg-slate-100 rounded px-2.5 py-1 transition-colors cursor-pointer"
                title="Create a custom ad-hoc record manually"
              >
                + Manual Entry
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-[11px] font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded px-3 py-1 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={selectedCodes.size === 0 || isImporting}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-medium text-[11px] rounded px-3.5 py-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-2xs focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {isImporting ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Importing…</span>
                </>
              ) : (
                <>
                  <ArrowRight size={13} />
                  <span>
                    Import {selectedCodes.size > 0 ? `(${selectedCodes.size}) ` : ''}to Project
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
