import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Truck } from 'lucide-react';

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
  const containerRef = useRef<HTMLDivElement>(null);
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
        (opt.vehicleNo && opt.vehicleNo.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  // Close on outside click / mobile touch
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (equipmentId: string) => {
    onChange(equipmentId);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative min-w-0 flex-1 ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
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
                · {selectedItem.name} {selectedItem.vehicleNo ? `(${selectedItem.vehicleNo})` : ''}
              </span>
              {Boolean(selectedItem.loggedHours && selectedItem.loggedHours > 0) && (
                <span className="shrink-0 text-[10px] font-mono font-semibold px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
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
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
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

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 min-w-[260px] sm:min-w-[320px]">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center gap-1.5">
            <Search size={14} className="text-slate-400 flex-shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code, name, or vehicle number..."
              className="w-full bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-slate-400">
                No matching equipment found in site pool
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.id === value;
                const lh = opt.loggedHours;

                return (
                  <button
                    key={opt.id}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt.id);
                    }}
                    onClick={() => handleSelect(opt.id)}
                    className={[
                      'w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-900 dark:text-blue-100 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
                    ].join(' ')}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400">
                          {opt.code}
                        </span>
                        {opt.vehicleNo && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-750 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {opt.vehicleNo}
                          </span>
                        )}
                        {Boolean(lh && lh > 0) && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-semibold">
                            {lh}h logged
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5 font-medium">
                        {opt.name || opt.code}
                      </p>
                    </div>

                    {isSelected && (
                      <Check size={14} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
