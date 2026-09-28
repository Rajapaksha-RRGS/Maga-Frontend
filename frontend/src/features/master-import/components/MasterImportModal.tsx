/**
 * MasterImportModal.tsx
 *
 * Enterprise ERP Master Data Import Portal.
 * Clean, consistent table styling matching DataTable.tsx and the Maga Design System.
 * Supports cross-tenant ground-truth status verification and 1-click site transfers.
 */
import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Database,
  Building,
  X,
  Filter,
  ArrowRight,
  Check,
  AlertCircle,
  Loader2,
  ArrowLeftRight,
  AlertTriangle,
} from 'lucide-react';

export interface ColumnDef<T> {
  key: string;
  header: string;
  render: (item: T) => React.ReactNode;
  width?: string;
}

export interface CrossTenantStatusItem {
  status: 'in_current_site' | 'in_other_site' | 'available';
  currentSiteName?: string;
  currentSiteCode?: string;
  currentTenantId?: string;
  employeeId?: string;
}

interface Props<T> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  entityName: string;
  catalog: T[];
  existingCodes: Set<string>;
  getItemCode: (item: T) => string;
  getItemName: (item: T) => string;
  getItemCategory: (item: T) => string;
  getItemSourceProject: (item: T) => string;
  columns: ColumnDef<T>[];
  onImport: (selectedItems: T[]) => Promise<void>;
  crossTenantStatusMap?: Record<string, CrossTenantStatusItem>;
  onTransfer?: (item: T, status: CrossTenantStatusItem) => Promise<void>;
  isLoadingStatus?: boolean;
  inline?: boolean;
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
  crossTenantStatusMap,
  onTransfer,
  isLoadingStatus = false,
  inline = false,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [hideExisting, setHideExisting] = useState(false);
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Transfer modal state
  const [transferTarget, setTransferTarget] = useState<T | null>(null);
  const [isTransferring, setIsTransferring] = useState(false);

  // Distinct dropdown options
  const projectOptions = useMemo(() => {
    return Array.from(new Set(catalog.map(getItemSourceProject))).filter(Boolean).sort();
  }, [catalog, getItemSourceProject]);

  const categoryOptions = useMemo(() => {
    return Array.from(new Set(catalog.map(getItemCategory))).filter(Boolean).sort();
  }, [catalog, getItemCategory]);

  // Helper to determine status for an item
  const getItemStatus = (item: T) => {
    const code = getItemCode(item);
    const ct = crossTenantStatusMap?.[code];
    if (ct) {
      return {
        isAlreadyInProject: ct.status === 'in_current_site',
        isInOtherSite: ct.status === 'in_other_site',
        isAvailable: ct.status === 'available',
        ctStatus: ct,
      };
    }
    const isAlready = existingCodes.has(code);
    return {
      isAlreadyInProject: isAlready,
      isInOtherSite: false,
      isAvailable: !isAlready,
      ctStatus: undefined,
    };
  };

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
      if (hideExisting) {
        const { isAlreadyInProject } = getItemStatus(item);
        if (isAlreadyInProject) {
          return false;
        }
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
    crossTenantStatusMap,
    getItemCode,
    getItemName,
    getItemCategory,
    getItemSourceProject,
  ]);

  // Selectable items (excluding already in project and other site transfers)
  const availableItems = useMemo(() => {
    return filteredCatalog.filter((item) => {
      const { isAvailable } = getItemStatus(item);
      return isAvailable;
    });
  }, [filteredCatalog, existingCodes, crossTenantStatusMap, getItemCode]);

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
    const item = catalog.find((c) => getItemCode(c) === code);
    if (!item) return;
    const { isAlreadyInProject, isInOtherSite } = getItemStatus(item);
    if (isAlreadyInProject || isInOtherSite) return;

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

  const handleExecuteTransfer = async () => {
    if (!transferTarget || !onTransfer) return;
    const code = getItemCode(transferTarget);
    const ct = crossTenantStatusMap?.[code];
    if (!ct) return;

    setIsTransferring(true);
    try {
      await onTransfer(transferTarget, ct);
      setSuccessMessage(
        `Successfully transferred ${getItemName(transferTarget)} from ${ct.currentSiteName || 'previous site'} to this site!`
      );
      setTransferTarget(null);
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
    } catch (err: any) {
      console.error('Transfer failed:', err);
      alert(err?.message || 'Failed to transfer record');
    } finally {
      setIsTransferring(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div
      className={
        inline
          ? 'bg-white rounded-lg border border-slate-200 shadow-xs w-full flex flex-col overflow-hidden animate-in fade-in duration-150'
          : 'bg-white rounded-xl shadow-2xl border border-slate-200 w-[96vw] max-w-[1450px] h-[92vh] max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150'
      }
    >
      {/* ── Clean Light Header Bar ────────────────────────────────────────── */}
      <div className="px-5 py-4 bg-white border-b border-slate-200 flex items-center justify-between flex-shrink-0 select-none">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
            <Database size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-800 tracking-tight">
                {title}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                Central Catalog
              </span>
              {isLoadingStatus && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  <Loader2 size={10} className="animate-spin text-blue-600" />
                  Checking ground truth…
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 hidden sm:block mt-0.5">{subtitle}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer border border-transparent hover:border-slate-200"
          aria-label="Close view"
          title="Close ERP Catalog"
        >
          <X size={16} />
        </button>
      </div>

      {/* ── Clean Search & Filter Toolbar ─────────────────────────────────── */}
      <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 flex-shrink-0 select-none text-xs">
        <div className="flex items-center gap-2.5 flex-1 min-w-0 flex-wrap">
          {/* Search Input */}
          <div className="relative w-56 sm:w-72">
            
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search by code or ${entityName.toLowerCase()} name…`}
              className="w-full pl-8.5 pr-7 py-1.5 h-8.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 outline-none transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Source Project Filter */}
          <div className="hidden sm:flex items-center gap-1.5">
            <Building size={14} className="text-slate-400 flex-shrink-0" />
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="h-8.5 px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:ring-2 focus:ring-blue-600/20  outline-none cursor-pointer max-w-[210px] truncate"
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
            <Filter size={14} className="text-slate-400 flex-shrink-0" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="h-8.5 px-3 py-1 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700    outline-none cursor-pointer max-w-[170px] truncate"
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
          <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer select-none ml-1">
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
        <div className="hidden lg:flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
          <span>
            Total: <strong className="font-semibold text-slate-700">{filteredCatalog.length}</strong>
          </span>
          <span>•</span>
          <span className="text-emerald-700 font-medium">
            Available: <strong>{availableItems.length}</strong>
          </span>
          {selectedCodes.size > 0 && (
            <span className="font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
              {selectedCodes.size} selected
            </span>
          )}
        </div>
      </div>

      {/* ── Success Banner ───────────────────────────────────────────────── */}
      {successMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-2.5 flex items-center gap-2 text-emerald-800 text-xs font-medium animate-in fade-in duration-100 flex-shrink-0">
          <Check size={16} className="text-emerald-600 flex-shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ── Clean Table Structure matching DataTable.tsx (Scrollable) ─────────── */}
      <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[540px] md:max-h-[620px] bg-white select-none">
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
          <table className="w-full text-sm min-w-[850px]">
            {/* Clean Light Table Header */}
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-2xs">
                <th className="py-3 px-4 w-10 text-center sticky left-0 bg-white z-10">
                  <input
                    type="checkbox"
                    checked={allAvailableSelected}
                    onChange={handleToggleSelectAll}
                    disabled={availableItems.length === 0}
                    title="Select all available"
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                  />
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap w-32">
                  Code
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide min-w-[200px]">
                  Name / Description
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap w-36">
                  Category / Trade
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap hidden lg:table-cell">
                  Source Project / Yard
                </th>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="py-3 px-4 text-left text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap hidden sm:table-cell"
                    style={{ width: col.width }}
                  >
                    {col.header}
                  </th>
                ))}
                <th className="py-3 px-4 text-right text-xs font-medium text-slate-500 uppercase tracking-wide whitespace-nowrap w-44">
                  Status & Action
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredCatalog.map((item) => {
                const code = getItemCode(item);
                const { isAlreadyInProject, isInOtherSite, ctStatus } = getItemStatus(item);
                const isChecked = selectedCodes.has(code);

                return (
                  <tr
                    key={code}
                    onClick={() => !isAlreadyInProject && !isInOtherSite && handleToggleItem(code)}
                    className={[
                      'border-b border-slate-100 last:border-b-0 transition-colors',
                      isAlreadyInProject
                        ? 'text-slate-400 bg-slate-50/50 cursor-not-allowed opacity-75'
                        : isInOtherSite
                        ? 'bg-amber-50/20 hover:bg-amber-50/50'
                        : isChecked
                        ? 'bg-blue-50 hover:bg-blue-100/50 cursor-pointer'
                        : 'hover:bg-slate-50 cursor-pointer',
                    ].join(' ')}
                  >
                    {/* Checkbox */}
                    <td
                      className="py-3 px-4 text-center sticky left-0 bg-white z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleItem(code)}
                        disabled={isAlreadyInProject || isInOtherSite}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* Code */}
                    <td className="py-3 px-4 whitespace-nowrap font-mono text-xs font-semibold text-blue-700">
                      <span className="bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                        {code}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-3 px-4 text-slate-800 font-medium">
                      {getItemName(item)}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 text-xs">
                      <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full font-medium">
                        {getItemCategory(item)}
                      </span>
                    </td>

                    {/* Source Project */}
                    <td className="py-3 px-4 whitespace-nowrap hidden lg:table-cell text-slate-600 text-xs">
                      <span className="flex items-center gap-1.5">
                        <Building size={13} className="text-slate-400 flex-shrink-0" />
                        <span className="truncate max-w-[220px]">{getItemSourceProject(item)}</span>
                      </span>
                    </td>

                    {/* Dynamic Columns */}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className="py-3 px-4 whitespace-nowrap hidden sm:table-cell text-slate-600 text-xs"
                      >
                        {col.render(item)}
                      </td>
                    ))}

                    {/* Status & Action */}
                    <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {isAlreadyInProject ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                            <CheckCircle2 size={12} className="text-emerald-600" />
                            In This Site
                          </span>
                        </div>
                      ) : isInOtherSite ? (
                        <div className="flex items-center justify-end gap-2">
                          <span
                            className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-300 px-2.5 py-0.5 rounded-full"
                            title={`Currently registered at ${ctStatus?.currentSiteName || 'Other Site'}`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            At: {ctStatus?.currentSiteName || ctStatus?.currentSiteCode || 'Other Site'}
                          </span>
                          {onTransfer && (
                            <button
                              type="button"
                              onClick={() => setTransferTarget(item)}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-900 hover:text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                            >
                              <ArrowLeftRight size={12} />
                              Transfer
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                            Central Pool
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Action Footer ───────────────────────────────────────────────── */}
      <div className="h-14 px-5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 flex-shrink-0 select-none text-xs">
        <div className="flex items-center gap-2">
          <span className="text-slate-500 text-xs">
            Showing <strong className="text-slate-700 font-semibold">{filteredCatalog.length}</strong> items
            (Available: <strong className="text-emerald-700 font-semibold">{availableItems.length}</strong>)
          </span>
          {selectedCodes.size > 0 && (
            <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
              {selectedCodes.size} item{selectedCodes.size !== 1 ? 's' : ''} selected
            </span>
          )}
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg px-3.5 py-2 transition-colors cursor-pointer"
          >
            Close
          </button>

          <button
            type="button"
            onClick={handleExecuteImport}
            disabled={selectedCodes.size === 0 || isImporting}
            className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-medium text-xs rounded-lg px-4 py-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            {isImporting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Importing…</span>
              </>
            ) : (
              <>
                <ArrowRight size={14} />
                <span>
                  Import {selectedCodes.size > 0 ? `(${selectedCodes.size}) ` : ''}to Project
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {inline ? (
        <div className="w-full relative">{content}</div>
      ) : (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
          {content}
        </div>
      )}

      {/* ── Transfer Confirmation Dialog ────────────────────────────────────── */}
      {transferTarget && (
        <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-amber-50 border-b border-amber-200 p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0 text-amber-700">
                <ArrowLeftRight size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Confirm Site Transfer</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Transfer worker across sites and update operational ground truth.
                </p>
              </div>
            </div>

            {/* Details Content */}
            <div className="p-4 space-y-3 text-xs">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Worker:</span>
                  <span className="font-semibold text-slate-800">{getItemName(transferTarget)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Code / Identifier:</span>
                  <span className="font-mono text-slate-700">{getItemCode(transferTarget)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Current Registered Site:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    {crossTenantStatusMap?.[getItemCode(transferTarget)]?.currentSiteName || 'Other Site'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Target Destination Site:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Current Project Site
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-amber-50/70 border border-amber-200 rounded-lg p-2.5 text-amber-900 text-[11px]">
                <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <span>
                  This worker will be marked as <strong>transferred</strong> from their previous site and activated here.
                  Historical attendance and payroll logs in the former site remain safe and preserved.
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="bg-slate-50 border-t border-slate-200 p-3 flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={isTransferring}
                onClick={() => setTransferTarget(null)}
                className="text-xs font-medium text-slate-600 hover:text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 px-3 py-1.5 rounded transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isTransferring}
                onClick={handleExecuteTransfer}
                className="flex items-center gap-1.5 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 px-4 py-1.5 rounded transition-colors shadow-2xs cursor-pointer"
              >
                {isTransferring ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Transferring…</span>
                  </>
                ) : (
                  <>
                    <ArrowLeftRight size={13} />
                    <span>Confirm & Transfer</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
