import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X } from 'lucide-react';
import type { ActivityCodeItem } from '../services/supervisorStorageService';
import { DEFAULT_MASTER_ACTIVITY_CODES } from '../data/defaultActivityCodes';

interface SearchableActivitySelectProps {
  value: string;
  onChange: (code: string) => void;
  options: ActivityCodeItem[];
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function SearchableActivitySelect({
  value,
  onChange,
  options: propOptions,
  disabled = false,
  className = '',
  placeholder = 'Select activity...',
}: SearchableActivitySelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // If propOptions is empty, seamlessly fall back to default corporate codes
  const options = useMemo(() => {
    return Array.isArray(propOptions) && propOptions.length > 0
      ? propOptions
      : DEFAULT_MASTER_ACTIVITY_CODES;
  }, [propOptions]);

  // Find currently selected item
  const selectedItem = useMemo(() => {
    return options.find((opt) => opt.code === value);
  }, [options, value]);

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.code.toLowerCase().includes(q) ||
        (opt.name && opt.name.toLowerCase().includes(q)) ||
        (opt.trade && opt.trade.toLowerCase().includes(q))
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

  const handleSelect = (code: string) => {
    onChange(code);
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
        <span className="truncate text-xs font-medium">
          {selectedItem ? (
            <span>
              <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold mr-1">
                {selectedItem.code}
              </strong>
              <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                - {selectedItem.name || selectedItem.code}
              </span>
            </span>
          ) : value ? (
            <span className="font-mono font-bold">{value}</span>
          ) : (
            <span className="text-slate-400 text-xs">{placeholder}</span>
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
              title="Clear activity"
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
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {/* Search Header */}
          <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/80 flex items-center gap-1.5">
            <Search size={14} className="text-slate-400 flex-shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search code or activity..."
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
          <div className="max-h-52 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60 scrollbar-thin">
            {filteredOptions.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-slate-400">
                No matching activities found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.code === value;
                return (
                  <button
                    key={opt.code}
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      handleSelect(opt.code);
                    }}
                    onClick={() => handleSelect(opt.code)}
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
                        {opt.trade && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {opt.trade}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate mt-0.5">
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
