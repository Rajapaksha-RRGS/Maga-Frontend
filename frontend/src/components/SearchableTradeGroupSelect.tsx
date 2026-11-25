import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, HardHat } from 'lucide-react';

export interface TradeGroupOption {
  id: string;
  code: string;
  name: string;
  standardDailyRate?: number;
  currency?: string;
}

interface SearchableTradeGroupSelectProps {
  value: string; // selected tradeGroupId
  onChange: (tradeGroupId: string, matched?: TradeGroupOption) => void;
  options: TradeGroupOption[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
  placeholder?: string;
}

export default function SearchableTradeGroupSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  required = false,
  className = '',
  placeholder = '-- Choose Trade Group * --',
}: SearchableTradeGroupSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Find currently selected trade group
  const selectedItem = useMemo(() => {
    return options.find((opt) => opt.id === value);
  }, [options, value]);

  // Filter options based on search query (matches code or name)
  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.code.toLowerCase().includes(q) ||
        opt.name.toLowerCase().includes(q) ||
        (opt.currency && opt.currency.toLowerCase().includes(q))
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

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (tg: TradeGroupOption) => {
    onChange(tg.id, tg);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={[
          'w-full px-3 py-2 text-sm rounded-lg border text-left flex items-center justify-between gap-2 transition-all cursor-pointer bg-white',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
            : isOpen
            ? 'ring-2 ring-violet-500 border-violet-500 shadow-xs'
            : 'border-slate-300 hover:border-slate-400 text-slate-900',
        ].join(' ')}
      >
        <span className="truncate flex-1">
          {selectedItem ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-800 border border-violet-200 shrink-0">
                {selectedItem.code}
              </span>
              <span className="text-slate-800 font-medium truncate text-xs">
                {selectedItem.name}
              </span>
            </span>
          ) : (
            <span className="text-slate-400 text-xs">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1.5 shrink-0">
          {value && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-red-500 rounded-md hover:bg-slate-100 cursor-pointer transition-colors"
              title="Clear selection"
            >
              <X size={13} />
            </span>
          )}
          <ChevronDown
            size={15}
            className={`text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180 text-violet-600' : ''}`}
          />
        </div>
      </button>

      {/* Hidden input for HTML form validation if required */}
      {required && (
        <input
          tabIndex={-1}
          type="text"
          value={value}
          required={required}
          onChange={() => {}}
          className="sr-only"
        />
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/90 flex items-center gap-2">
            <Search size={14} className="text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code (e.g. MMS) or name (e.g. Mason)..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-1 text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="py-7 px-4 text-center">
                <HardHat size={20} className="mx-auto text-slate-300 mb-1.5" />
                <p className="text-xs text-slate-500 font-medium">No trade groups found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Try searching with a different code or trade name
                </p>
              </div>
            ) : (
              filteredOptions.map((tg) => {
                const isSelected = tg.id === value;
                return (
                  <button
                    key={tg.id}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleSelect(tg);
                    }}
                    onClick={() => handleSelect(tg)}
                    className={[
                      'w-full px-3 py-2.5 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer',
                      isSelected
                        ? 'bg-violet-50 text-violet-900 font-semibold'
                        : 'hover:bg-slate-50 text-slate-700',
                    ].join(' ')}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-violet-700 bg-violet-50 border border-violet-200/80 px-1.5 py-0.5 rounded">
                          {tg.code}
                        </span>
                        <span className="text-slate-800 font-medium truncate">
                          {tg.name}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={16} className="text-violet-600 shrink-0" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer count */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-400 flex justify-between items-center">
            <span>{filteredOptions.length} of {options.length} trade groups</span>
            <span className="text-violet-600 font-medium">Click to select Code & Description</span>
          </div>
        </div>
      )}
    </div>
  );
}
