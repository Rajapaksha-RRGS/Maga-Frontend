import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, Truck, Ban, Gauge } from 'lucide-react';

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
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    return options.find((opt) => opt.id === value);
  }, [options, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.code.toLowerCase().includes(q) ||
        (opt.name && opt.name.toLowerCase().includes(q)) ||
        (opt.vehicleNo && opt.vehicleNo.toLowerCase().includes(q)) ||
        (opt.type && opt.type.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

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
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
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
      {/* Trigger Button */}
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

      {/* Mobile Responsive Modal / Bottom Sheet rendered in React Portal (document.body) */}
      {isOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[9999] flex flex-col justify-end sm:justify-center items-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            {/* Modal Sheet Box */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full max-h-[88vh] sm:max-h-[80vh] sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-4 duration-200"
            >
              {/* Mobile Drag Indicator */}
              <div className="pt-2.5 pb-1 sm:hidden flex justify-center">
                <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Modal Header */}
              <div className="px-4 py-3 sm:px-5 sm:py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 flex items-center justify-center shrink-0">
                    <Truck size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                      Select Machine / Vehicle
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {options.length} machine{options.length === 1 ? '' : 's'} available in site pool
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Bar Input */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/70">
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

                {/* Quick Unassign Action if already selected */}
                {value && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      Currently assigned: <strong className="text-blue-700 dark:text-blue-400 font-mono">{selectedItem?.code || value}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleClear}
                      className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                    >
                      <Ban size={12} />
                      <span>Unassign Machine</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Options List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80 p-1 sm:p-2 scrollbar-thin">
                {filteredOptions.length === 0 ? (
                  <div className="py-12 px-4 text-center">
                    <Truck size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      No machines found matching "{searchQuery}"
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Try searching with machine code (e.g. MRVI), plate number or machine name.
                    </p>
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="mt-3 px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors"
                      >
                        Clear Search Filter
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
                          'w-full px-3.5 py-3 text-left flex items-center justify-between gap-3 rounded-xl transition-all cursor-pointer',
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 shadow-2xs'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-transparent'
                        ].join(' ')}
                      >
                        <div className="min-w-0 flex-1">
                          {/* Machine Code & Badges Row */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-sm text-blue-700 dark:text-blue-400">
                              {opt.code}
                            </span>

                            {opt.vehicleNo && opt.vehicleNo !== opt.code && (
                              <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                                {opt.vehicleNo}
                              </span>
                            )}

                            {opt.condition && (
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
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
                                <span>{lh}h Logged Today</span>
                              </span>
                            )}
                          </div>

                          {/* Machine Name & Type */}
                          <p className="text-xs text-slate-800 dark:text-slate-200 font-semibold mt-1 truncate">
                            {opt.name || opt.code}
                            {opt.type && opt.type !== 'Equipment' ? ` · ${opt.type}` : ''}
                          </p>
                        </div>

                        {/* Selected Indicator */}
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
              <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 flex items-center justify-between">
                <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {filteredOptions.length} of {options.length} machine{options.length === 1 ? '' : 's'}
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
