import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, Truck, Ban, Gauge, Sparkles } from 'lucide-react';

export interface EquipmentOptionItem {
  id: string;
  code: string;
  name: string;
  vehicleNo?: string;
  loggedHours?: number;
  type?: string;
  condition?: string;
}

interface SearchableEquipmentSelectProps {
  value: string;
  onChange: (equipmentId: string) => void;
  options: EquipmentOptionItem[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

type FilterTab = 'all' | 'logged' | 'vehicles' | 'plant';

export function SearchableEquipmentSelect({
  value,
  onChange,
  options,
  disabled = false,
  className = '',
  placeholder = '-- Choose Equipment (Site Pool) --',
}: SearchableEquipmentSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    return options.find((opt) => opt.id === value);
  }, [options, value]);

  // Count how many equipment have logged hours today
  const loggedCount = useMemo(() => {
    return options.filter((opt) => opt.loggedHours && opt.loggedHours > 0).length;
  }, [options]);

  // Filtered options based on search query and active tab
  const filteredOptions = useMemo(() => {
    let result = options;

    // Filter by tab
    if (activeTab === 'logged') {
      result = result.filter((opt) => opt.loggedHours && opt.loggedHours > 0);
    } else if (activeTab === 'vehicles') {
      result = result.filter((opt) => {
        const text = `${opt.code} ${opt.name} ${opt.type || ''}`.toLowerCase();
        return text.includes('cab') || text.includes('crew') || text.includes('truck') || text.includes('cycle') || text.includes('lorry') || text.includes('van');
      });
    } else if (activeTab === 'plant') {
      result = result.filter((opt) => {
        const text = `${opt.code} ${opt.name} ${opt.type || ''}`.toLowerCase();
        return text.includes('roller') || text.includes('rammer') || text.includes('excavator') || text.includes('compressor') || text.includes('mixer') || text.includes('loader') || text.includes('grader');
      });
    }

    // Filter by search text
    const q = searchQuery.toLowerCase().trim();
    if (!q) return result;

    return result.filter(
      (opt) =>
        opt.code.toLowerCase().includes(q) ||
        (opt.name && opt.name.toLowerCase().includes(q)) ||
        (opt.vehicleNo && opt.vehicleNo.toLowerCase().includes(q)) ||
        (opt.type && opt.type.toLowerCase().includes(q))
    );
  }, [options, searchQuery, activeTab]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
      setActiveTab('all');
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleSelect = (equipmentId: string) => {
    onChange(equipmentId);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      {/* Trigger Button inside Operator Card */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={[
          'w-full px-2.5 py-1.5 rounded-lg border text-left flex items-center justify-between gap-1.5 transition-all cursor-pointer',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            : isOpen
            ? 'ring-2 ring-blue-500 border-blue-500 bg-white dark:bg-slate-800'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-100'
        ].join(' ')}
      >
        <span className="truncate text-xs font-medium min-w-0 flex-1">
          {selectedItem ? (
            <span className="flex items-center gap-1.5 truncate">
              <strong className="font-mono text-blue-700 dark:text-blue-400 font-bold shrink-0">
                {selectedItem.code}
              </strong>
              <span className="text-slate-700 dark:text-slate-200 truncate">
                · {selectedItem.name} {selectedItem.vehicleNo && selectedItem.vehicleNo !== selectedItem.code ? `(${selectedItem.vehicleNo})` : ''}
              </span>
              {Boolean(selectedItem.loggedHours && selectedItem.loggedHours > 0) && (
                <span className="shrink-0 text-[10px] font-mono font-semibold px-1 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  {selectedItem.loggedHours}h
                </span>
              )}
            </span>
          ) : (
            <span className="text-slate-400 text-xs flex items-center gap-1.5">
              <Truck size={13} className="text-slate-400 shrink-0" />
              <span className="truncate">{placeholder}</span>
            </span>
          )}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          {value && !disabled && (
            <span
              onClick={handleClear}
              className="p-0.5 text-slate-400 hover:text-red-500 rounded hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              title="Clear equipment"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Top-up Popup Page / Bottom-Sheet Modal (Rendered outside the card directly in document.body via Portal) */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[99999] flex flex-col justify-end sm:justify-center items-center bg-slate-950/75 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            {/* Modal Sheet Container */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full h-[90vh] max-h-[92vh] sm:h-auto sm:max-h-[82vh] sm:max-w-xl bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom duration-200"
            >
              {/* Mobile Drag Indicator Pill */}
              <div className="pt-2.5 pb-1 sm:hidden flex justify-center shrink-0">
                <div className="w-12 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Modal Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span>Select Machine / Vehicle</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        {options.length} Total
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Tap any vehicle from the site pool to assign
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Bar & Quick Filter Chips */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-850/80 shrink-0 space-y-2">
                {/* Search Input Box */}
                <div className="relative flex items-center">
                  <Search size={16} className="absolute left-3 text-blue-600 dark:text-blue-400 pointer-events-none" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search machine code, vehicle number, or name..."
                    className="w-full pl-9 pr-8 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-2xs"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Quick Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-[11px]">
                  <button
                    type="button"
                    onClick={() => setActiveTab('all')}
                    className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                      activeTab === 'all'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    All ({options.length})
                  </button>

                  {loggedCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('logged')}
                      className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors flex items-center gap-1 ${
                        activeTab === 'logged'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      <Sparkles size={11} />
                      <span>Logged Today ({loggedCount})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('plant')}
                    className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                      activeTab === 'plant'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Plant / Machinery
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('vehicles')}
                    className={`px-2.5 py-1 rounded-lg font-semibold shrink-0 transition-colors ${
                      activeTab === 'vehicles'
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Vehicles / Transport
                  </button>
                </div>

                {/* Currently Assigned Banner */}
                {value && (
                  <div className="pt-1 flex items-center justify-between text-[11px] border-t border-slate-200/60 dark:border-slate-750">
                    <span className="text-slate-500 dark:text-slate-400 truncate">
                      Selected: <strong className="text-blue-700 dark:text-blue-400 font-mono">{selectedItem?.code || value}</strong>
                      {selectedItem?.name ? ` (${selectedItem.name})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="inline-flex items-center gap-1 font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer shrink-0 ml-2"
                    >
                      <Ban size={12} />
                      <span>Unassign</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Machine Cards List (Scrollable) */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-2 scrollbar-thin">
                {filteredOptions.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <Truck size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      No machines match your criteria
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                      {searchQuery
                        ? `No results for "${searchQuery}". Try searching by code (MRVI) or name.`
                        : 'No machines in this category.'}
                    </p>
                    {(searchQuery || activeTab !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setActiveTab('all');
                        }}
                        className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = opt.id === value;
                    const lh = opt.loggedHours;

                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelect(opt.id)}
                        className={[
                          'w-full p-3 text-left flex items-center justify-between gap-3 rounded-xl transition-all cursor-pointer mb-1',
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/70 border border-blue-300 dark:border-blue-700 shadow-2xs ring-1 ring-blue-400/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/80 border border-transparent'
                        ].join(' ')}
                      >
                        <div className="min-w-0 flex-1">
                          {/* Machine Code, Vehicle No & Status Badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-400">
                              {opt.code}
                            </span>

                            {opt.vehicleNo && opt.vehicleNo !== opt.code && (
                              <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {opt.vehicleNo}
                              </span>
                            )}

                            {opt.condition && (
                              <span
                                className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                  opt.condition === 'WET'
                                    ? 'bg-cyan-50 dark:bg-cyan-950/50 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800'
                                    : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                }`}
                              >
                                {opt.condition}
                              </span>
                            )}

                            {Boolean(lh && lh > 0) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <Gauge size={10} />
                                <span>{lh}h Logged</span>
                              </span>
                            )}
                          </div>

                          {/* Machine Name & Category Type */}
                          <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold mt-1 truncate">
                            {opt.name || opt.code}
                            {opt.type && opt.type !== 'Equipment' ? ` · ${opt.type}` : ''}
                          </p>
                        </div>

                        {/* Selection Checkmark Button */}
                        <div className="shrink-0 flex items-center">
                          {isSelected ? (
                            <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
                              <Check size={14} />
                            </div>
                          ) : (
                            <div className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center text-transparent hover:border-blue-400">
                              <Check size={12} />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>

              {/* Modal Footer */}
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between shrink-0">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  Showing {filteredOptions.length} of {options.length} machine{options.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
                >
                  Done / Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
