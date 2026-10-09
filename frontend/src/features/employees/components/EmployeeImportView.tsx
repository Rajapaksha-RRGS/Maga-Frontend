/**
 * EmployeeImportView.tsx
 *
 * Dedicated ERP Master directory view for Employees,
 * styled to 100% match BusinessPartnerErpMasterView (Prisma Studio UI aesthetics).
 *
 * Features:
 *   - Prisma Studio Clean Light Tab Bar with HardHat icon
 *   - Studio Control Toolbar: [↻] Refresh, Filters Popover (Trade, Partner, Status), Search, Fields, Showing X of Y, Add record / Import button
 *   - Crisp high-contrast visible borders (border-slate-300 on headers/containers, border-slate-200 on cell grid)
 *   - Prisma Studio data-type indicators (A, A?) on column headers
 *   - Multi-row selection & batch import + 1-click single "+ Add" / "Transfer"
 *   - Preserves 1-Click Cross-Tenant Transfer Confirmation Modal
 *   - Clean Light Footer Bar with totals, pagination, and return link
 */
import { useState, useMemo, useEffect } from 'react';
import {
  RotateCw,
  X,
  Search,
  Check,
  ArrowLeft,
  SlidersHorizontal,
  HardHat,
  ArrowUpDown,
  AlertTriangle,
  Building2,
  ArrowRight,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
} from 'lucide-react';
import { fetchCorporateEmployees, type CorporateEmployee } from '../../master-import/services/corporateMasterService';
import type { CrossTenantStatus } from '../services/employeeService';

interface EmployeeImportViewProps {
  onBack: () => void;
  existingCodes: Set<string>;
  onImport: (items: CorporateEmployee[]) => Promise<void> | void;
  onTransfer: (item: CorporateEmployee, targetSiteName?: string, startDate?: string, remarks?: string) => Promise<void> | void;
}

// Helper to get registered BP Code or mark as Internal / none
function getBPCode(item: CorporateEmployee): string {
  if (item.businessPartnerCode) return item.businessPartnerCode;
  if (item.employeeType === 'internal') return 'Internal';
  return '—';
}

export default function EmployeeImportView({
  onBack,
  existingCodes,
  onImport,
  onTransfer,
}: EmployeeImportViewProps) {
  const [crossTenantStatusMap, setCrossTenantStatusMap] = useState<Record<string, CrossTenantStatus>>({});
  const [catalog, setCatalog] = useState<CorporateEmployee[]>([]);
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferSuccessMessage, setTransferSuccessMessage] = useState<string | null>(null);

  const loadCatalog = async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchCorporateEmployees();
      setCatalog(data);
      
      // Fetch cross-tenant status
      const { getCrossTenantEmployeeStatus } = await import('../services/employeeService');
      const map = await getCrossTenantEmployeeStatus(
        data.map((c) => ({ code: c.employeeCode, nicNo: c.nicNo }))
      );
      setCrossTenantStatusMap(map);
    } catch (e) {
      console.error(e);
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);
  // Global search & filters
  const [globalSearch, setGlobalSearch] = useState('');
  const [filterTrade, setFilterTrade] = useState('ALL');
  const [filterBP, setFilterBP] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'AVAILABLE' | 'AT_OTHER_SITE' | 'IN_SITE'>('ALL');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sorting
  const [sortField, setSortField] = useState<'employeeCode' | 'callingName' | 'tradeGroup'>('employeeCode');
  const [sortAsc, setSortAsc] = useState(true);

  // Selection
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 1-Click Transfer Modal state
  const [transferTarget, setTransferTarget] = useState<{
    item: CorporateEmployee;
    currentSiteName: string;
  } | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Distinct trade groups and business partners
  const tradeGroups = useMemo(() => {
    return Array.from(new Set(catalog.map((c) => c.tradeGroup).filter(Boolean))).sort();
  }, [catalog]);

  const businessPartners = useMemo(() => {
    return Array.from(
      new Set(
        catalog
          .map((c) => c.businessPartner || c.businessPartnerName || c.businessPartnerCode)
          .filter(Boolean)
      )
    ).sort() as string[];
  }, [catalog]);

  // Determine status for each employee
  const getItemStatus = (item: CorporateEmployee) => {
    const code = (item.employeeCode || '').toUpperCase();
    if (code && existingCodes.has(code)) {
      return {
        type: 'IN_SITE' as const,
        label: 'in site',
        badgeClass: 'text-slate-500 bg-slate-100 border-slate-200',
        siteName: '',
      };
    }
    const crossStatus = code ? crossTenantStatusMap[code] : undefined;
    if (crossStatus && crossStatus.status === 'in_other_site') {
      return {
        type: 'AT_OTHER_SITE' as const,
        label: 'other site',
        badgeClass: 'text-amber-800 bg-amber-50 border-amber-200',
        siteName: crossStatus.currentSiteName || 'Another Project Site',
      };
    }
    return {
      type: 'AVAILABLE' as const,
      label: 'available',
      badgeClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      siteName: '',
    };
  };

  // Filtered and sorted catalog
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const status = getItemStatus(item);
      if (filterStatus === 'AVAILABLE' && status.type !== 'AVAILABLE') return false;
      if (filterStatus === 'AT_OTHER_SITE' && status.type !== 'AT_OTHER_SITE') return false;
      if (filterStatus === 'IN_SITE' && status.type !== 'IN_SITE') return false;
      if (filterTrade === 'OPERATORS_ALL') {
        const isOp = item.isOperator || ['operator', 'driver'].some(t => (item.tradeGroup || '').toLowerCase().includes(t));
        if (!isOp) return false;
      } else if (filterTrade !== 'ALL' && item.tradeGroup !== filterTrade) {
        return false;
      }
      
      const partnerDisplay = item.businessPartner || item.businessPartnerName || item.businessPartnerCode || '';
      if (filterBP !== 'ALL' && partnerDisplay !== filterBP) return false;

      if (globalSearch.trim()) {
        const q = globalSearch.toLowerCase();
        if (
          !(item.employeeCode || '').toLowerCase().includes(q) &&
          !(item.callingName || '').toLowerCase().includes(q) &&
          !(item.fullName || '').toLowerCase().includes(q) &&
          !(item.tradeGroup || '').toLowerCase().includes(q) &&
          !(item.nicNo || '').toLowerCase().includes(q) &&
          !(partnerDisplay || '').toLowerCase().includes(q)
        ) return false;
      }
      return true;
    }).sort((a, b) => {
      let comp = 0;
      if (sortField === 'employeeCode') comp = (a.employeeCode || '').localeCompare(b.employeeCode || '');
      else if (sortField === 'callingName') comp = (a.callingName || '').localeCompare(b.callingName || '');
      else if (sortField === 'tradeGroup') comp = (a.tradeGroup || '').localeCompare(b.tradeGroup || '');
      return sortAsc ? comp : -comp;
    });
  }, [catalog, existingCodes, crossTenantStatusMap, globalSearch, filterStatus, filterTrade, filterBP, sortField, sortAsc]);

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
    return paginatedCatalog.filter((item) => !existingCodes.has((item.employeeCode || '').toUpperCase()));
  }, [paginatedCatalog, existingCodes]);

  const allPageSelectableChecked =
    selectablePageItems.length > 0 &&
    selectablePageItems.every((item) => selectedCodes.has(item.employeeCode));

  const toggleSelectAll = () => {
    if (allPageSelectableChecked) {
      const next = new Set(selectedCodes);
      selectablePageItems.forEach((item) => next.delete(item.employeeCode));
      setSelectedCodes(next);
    } else {
      const next = new Set(selectedCodes);
      selectablePageItems.forEach((item) => next.add(item.employeeCode));
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

  // Bulk import
  const handleBatchImport = async () => {
    if (selectedCodes.size === 0 || isSubmitting) return;
    const selectedItems = catalog.filter((item) => selectedCodes.has(item.employeeCode));

    // If an item is active at another site, confirm transfer first
    const itemAtOtherSite = selectedItems.find(
      (item) => getItemStatus(item).type === 'AT_OTHER_SITE'
    );
    if (itemAtOtherSite) {
      setTransferTarget({
        item: itemAtOtherSite,
        currentSiteName: getItemStatus(itemAtOtherSite).siteName,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onImport(selectedItems);
      setSelectedCodes(new Set());
    } finally {
      setIsSubmitting(false);
    }
  };

  // 1-Click single import
  const handleSingleImport = async (item: CorporateEmployee) => {
    if (existingCodes.has(item.employeeCode.toUpperCase()) || isSubmitting) return;
    const status = getItemStatus(item);
    if (status.type === 'AT_OTHER_SITE') {
      setTransferTarget({
        item,
        currentSiteName: status.siteName,
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onImport([item]);
      const next = new Set(selectedCodes);
      next.delete(item.employeeCode);
      setSelectedCodes(next);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Transfer confirmation (2-Way Handshake Request)
  const handleConfirmTransfer = async () => {
    if (!transferTarget) return;
    setIsSubmitting(true);
    try {
      await onTransfer(transferTarget.item, transferTarget.currentSiteName, transferDate, transferRemarks);
      setSelectedCodes((prev) => {
        const next = new Set(prev);
        next.delete(transferTarget.item.employeeCode);
        return next;
      });
      setTransferSuccessMessage(
        `Transfer request for ${transferTarget.item.callingName} (${transferTarget.item.employeeCode}) submitted successfully. Awaiting release approval from ${transferTarget.currentSiteName}.`
      );
      setTransferTarget(null);
      setTransferRemarks('');
      setTimeout(() => setTransferSuccessMessage(null), 7000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const hasActiveFilters = filterTrade !== 'ALL' || filterBP !== 'ALL' || filterStatus !== 'ALL';

  return (
    <div className="bg-white border border-slate-300 rounded-lg shadow-sm overflow-hidden flex flex-col font-sans transition-colors animate-in fade-in duration-150">
      {/* ── 1. Tab Bar (Clean Light) ────────────────────────────────────────── */}
      {transferSuccessMessage && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in">
          <span className="flex items-center gap-2">
            <CheckCircle2 size={14} className="text-emerald-600 flex-shrink-0" />
            <span>{transferSuccessMessage}</span>
          </span>
          <button onClick={() => setTransferSuccessMessage(null)} className="text-emerald-600 hover:text-emerald-900 font-bold ml-2">×</button>
        </div>
      )}
      <div className="bg-slate-50/80 border-b border-slate-300 px-2 pt-1.5 flex items-center justify-between select-none">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
          {/* Back button */}
          <button
            type="button"
            onClick={onBack}
            title="Back to Site Employees"
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 rounded transition-colors mr-1 cursor-pointer"
          >
            <ArrowLeft size={14} />
          </button>

          {/* Active Tab: Corporate Personnel Directory */}
          <div className="bg-white text-slate-800 font-semibold text-xs px-3 py-1.5 border-t-2 border-t-blue-600 border-x border-slate-300 flex items-center gap-2 rounded-t-md shadow-xs">
            <HardHat size={13} className="text-blue-600" />
            <span>Corporate Personnel Directory</span>
            <button
              type="button"
              onClick={onBack}
              className="text-slate-400 hover:text-slate-700 rounded p-0.5 transition-colors cursor-pointer"
              title="Close Employees tab"
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

          {/* Quick Operators Only Toggle */}
          <button
            type="button"
            onClick={() => {
              setFilterTrade(filterTrade === 'OPERATORS_ALL' ? 'ALL' : 'OPERATORS_ALL');
              setCurrentPage(1);
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-xs font-medium transition-colors cursor-pointer shadow-xs ${
              filterTrade === 'OPERATORS_ALL'
                ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-400 font-semibold'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <span>🚜 Operators ({catalog.filter(c => c.isOperator || ['operator', 'driver'].some(t => (c.tradeGroup || '').toLowerCase().includes(t))).length})</span>
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
                    Employee Filters
                  </span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        setFilterTrade('ALL');
                        setFilterBP('ALL');
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
                    <option value="AVAILABLE">Available (Central Pool)</option>
                    <option value="AT_OTHER_SITE">At Another Site</option>
                    <option value="IN_SITE">In Current Site</option>
                  </select>
                </div>

                {/* Trade Group filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Trade Group</label>
                  <select
                    value={filterTrade}
                    onChange={(e) => {
                      setFilterTrade(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Trades ({tradeGroups.length})</option>
                    <option value="OPERATORS_ALL">🚜 All Operators & Drivers (14)</option>
                    {tradeGroups.map((trade) => (
                      <option key={trade} value={trade}>{trade}</option>
                    ))}
                  </select>
                </div>

                {/* Partner filter */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-600">Business Partner</label>
                  <select
                    value={filterBP}
                    onChange={(e) => {
                      setFilterBP(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full text-xs rounded border border-slate-300 bg-white px-2 py-1 text-slate-700 outline-none focus:border-blue-500"
                  >
                    <option value="ALL">All Partners ({businessPartners.length})</option>
                    {businessPartners.map((bp) => (
                      <option key={bp} value={bp}>{bp}</option>
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
              placeholder="Search employee, trade, NIC..."
              className="pl-7 pr-2.5 py-1 text-xs rounded border border-slate-300 bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 w-52 transition-all shadow-xs"
            />
          </div>

          {/* Fields Pill */}
          <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded border border-slate-300 bg-white text-slate-700 font-medium shadow-xs">
            <span>Fields</span>
            <span className="bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded text-[11px] font-normal border border-slate-200">
              All 7
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
            title={selectedCodes.size === 0 ? 'Select rows using checkboxes to import' : 'Import selected employees to project site'}
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
      <div className="overflow-x-auto scrollbar-none flex-1 max-h-[calc(100vh-280px)] min-h-[380px] bg-white">
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
                onClick={() => handleSort('employeeCode')}
                className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[110px] bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Employee Code</span>
                  <ArrowUpDown size={11} className={sortField === 'employeeCode' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A</span>
                </div>
              </th>

              {/* Employee Name */}
              <th
                onClick={() => handleSort('callingName')}
                className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[220px] bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Calling Name</span>
                  <ArrowUpDown size={11} className={sortField === 'callingName' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A</span>
                </div>
              </th>

              {/* Trade Group */}
              <th
                onClick={() => handleSort('tradeGroup')}
                className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[150px] bg-slate-50 cursor-pointer hover:bg-slate-100/80 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Trade Group</span>
                  <ArrowUpDown size={11} className={sortField === 'tradeGroup' ? 'text-blue-600' : 'text-slate-400'} />
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A</span>
                </div>
              </th>

              {/* NIC & EPF */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[140px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">NIC & EPF</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A?</span>
                </div>
              </th>

              {/* BP Code */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[100px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">BP Code</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A</span>
                </div>
              </th>

              {/* Business Partner */}
              <th className="px-3.5 py-2.5 border-r border-slate-300 font-semibold whitespace-nowrap min-w-[190px] bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 font-semibold">Business Partner</span>
                  <span className="text-slate-400 font-mono text-[11px] font-normal">A</span>
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
              <th className="px-3 py-2.5 font-semibold whitespace-nowrap min-w-[110px] text-right bg-slate-50">
                <span className="text-slate-600">Action</span>
              </th>
            </tr>
          </thead>

          {/* Table Body (Clean White with distinct cell borders) */}
          <tbody className="divide-y divide-slate-200 bg-white">
            {paginatedCatalog.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-12 text-center text-slate-400 text-xs bg-white">
                  No employees found matching &quot;{globalSearch}&quot;.
                </td>
              </tr>
            ) : (
              paginatedCatalog.map((item) => {
                const statusInfo = getItemStatus(item);
                const isExisting = statusInfo.type === 'IN_SITE';
                const isAtOtherSite = statusInfo.type === 'AT_OTHER_SITE';
                const isChecked = selectedCodes.has(item.employeeCode);
                const bpCode = getBPCode(item);

                return (
                  <tr
                    key={item.employeeCode}
                    onClick={() => {
                      if (!isExisting) toggleSelectRow(item.employeeCode);
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
                        onChange={() => toggleSelectRow(item.employeeCode)}
                        aria-label={`Select ${item.employeeCode}`}
                        className="rounded border-slate-300 text-blue-600 focus:ring-1 focus:ring-blue-500 cursor-pointer disabled:opacity-40"
                      />
                    </td>

                    {/* Code (Monospace font) */}
                    <td className="px-3.5 py-2 font-mono text-xs text-slate-900 font-semibold border-r border-slate-200 whitespace-nowrap">
                      {item.employeeCode}
                    </td>

                    {/* Name */}
                    <td className="px-3.5 py-2 border-r border-slate-200">
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 leading-tight">
                          {item.callingName}
                        </span>
                        <span className="text-[11px] text-slate-500 leading-tight truncate max-w-[210px] mt-0.5">
                          {item.fullName}
                        </span>
                      </div>
                    </td>

                    {/* Trade Group */}
                    <td className="px-3.5 py-2 border-r border-slate-200 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-slate-100 border border-slate-200 px-1.5 py-0.2 rounded text-[11px] font-medium text-slate-700">
                          {item.tradeGroup}
                        </span>
                        {(item.isOperator || ['operator', 'driver'].some(t => (item.tradeGroup || '').toLowerCase().includes(t))) && (
                          <span className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-semibold px-1.5 py-0.2 rounded">
                            Operator
                          </span>
                        )}
                      </div>
                    </td>

                    {/* NIC & EPF */}
                    <td className="px-3.5 py-2 font-mono text-xs border-r border-slate-200 whitespace-nowrap">
                      <div className="text-slate-700 font-medium">{item.nicNo}</div>
                      {item.epfNo && <div className="text-[10px] text-slate-400 font-sans">EPF: {item.epfNo}</div>}
                    </td>

                    {/* BP Code */}
                    <td className="px-3.5 py-2 font-mono text-xs text-slate-700 font-medium border-r border-slate-200 whitespace-nowrap">
                      {bpCode}
                    </td>

                    {/* Business Partner */}
                    <td className="px-3.5 py-2 text-slate-700 border-r border-slate-200 whitespace-nowrap">
                      <span
                        className="truncate max-w-[190px] block"
                        title={item.businessPartner || item.businessPartnerName || (item.employeeType === 'internal' ? 'Mäga Engineering (Internal)' : '—')}
                      >
                        {item.businessPartner || item.businessPartnerName || (item.employeeType === 'internal' ? 'Mäga Engineering (Internal)' : '—')}
                      </span>
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
                      ) : isAtOtherSite ? (
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => handleSingleImport(item)}
                          className="px-2.5 py-1 text-[11px] font-medium rounded border border-amber-600 text-amber-700 bg-amber-50/50 hover:bg-amber-100/70 transition-colors cursor-pointer"
                        >
                          Transfer
                        </button>
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
            ← Return to Site Employees
          </button>
        </div>
      </div>

      {/* ── 2-Way Handshake Site Transfer Request Modal ── */}
      {transferTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-md w-full p-5 shadow-xl border border-slate-300 space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Request Employee Transfer</h3>
                <p className="text-[11px] text-slate-500">2-Way Inter-Site Handshake Approval</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2 text-xs">
              <p className="text-slate-800">
                Employee <span className="font-bold">{transferTarget.item.callingName}</span> (
                <span className="font-mono font-medium">{transferTarget.item.employeeCode}</span>) is currently stationed at:
              </p>
              <p className="font-semibold text-amber-900 bg-white px-2.5 py-1.5 rounded border border-amber-200 flex items-center gap-1.5">
                <Building2 size={13} className="text-amber-600 flex-shrink-0" />
                <span>{transferTarget.currentSiteName}</span>
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Required From Date (අවශ්‍ය දිනය):
                </label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Justification / Remarks (හේතුව):
                </label>
                <input
                  type="text"
                  placeholder="e.g. Needed for urgent casting works"
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  className="w-full text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 focus:outline-hidden focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Releasing project admin will review and release this employee before they are enrolled into your site active roster.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setTransferTarget(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmTransfer}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-xs transition-all cursor-pointer"
              >
                {isSubmitting ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                <span>Submit Transfer Request</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
