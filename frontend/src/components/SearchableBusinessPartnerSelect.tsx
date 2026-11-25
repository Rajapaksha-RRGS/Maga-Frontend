import { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Building2 } from 'lucide-react';

export interface BusinessPartnerFilterOption {
  code?: string;
  name: string;
}

interface SearchableBusinessPartnerSelectProps {
  value: string; // selected BP name (or '' for all)
  onChange: (bpName: string) => void;
  options: (BusinessPartnerFilterOption | string)[];
  placeholder?: string;
  allLabel?: string;
  className?: string;
  compact?: boolean;
}

const MAX_VISIBLE = 10;

export default function SearchableBusinessPartnerSelect({
  value,
  onChange,
  options = [],
  placeholder = 'All business partners',
  allLabel = 'All business partners',
  className = '',
  compact = false,
}: SearchableBusinessPartnerSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const normalizedOptions = useMemo<BusinessPartnerFilterOption[]>(() => {
    return options.map((opt) => (typeof opt === 'string' ? { name: opt } : opt));
  }, [options]);

  const selectedItem = useMemo(() => {
    if (!value) return null;
    return normalizedOptions.find((o) => o.name === value) || { name: value };
  }, [normalizedOptions, value]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return normalizedOptions;
    return normalizedOptions.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        (opt.code && opt.code.toLowerCase().includes(q))
    );
  }, [normalizedOptions, searchQuery]);

  const visibleOptions = useMemo(() => filteredOptions.slice(0, MAX_VISIBLE), [filteredOptions]);

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

  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const handleSelect = (bpName: string) => {
    onChange(bpName);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={[
          'w-full px-3 rounded-lg border text-left flex items-center justify-between gap-2 transition-all cursor-pointer bg-white text-xs',
          compact ? 'py-1 min-h-[28px]' : 'py-2 min-h-[40px]',
          isOpen
            ? 'ring-2 ring-blue-600 border-slate-400'
            : 'border-slate-300 hover:border-slate-400 text-slate-800',
        ].join(' ')}
      >
        <span className="truncate flex-1">
          {selectedItem ? (
            <span className="flex items-center gap-1.5 truncate">
              {selectedItem.code && (
                <span className="font-mono font-semibold text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                  {selectedItem.code}
                </span>
              )}
              <span className="text-slate-800 font-medium truncate">{selectedItem.name}</span>
            </span>
          ) : (
            <span className="text-slate-500">{placeholder}</span>
          )}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                handleSelect('');
              }}
              className="p-0.5 text-slate-400 hover:text-red-500 rounded cursor-pointer"
              title="Clear selection"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-slate-400 transition-transform duration-150 ${isOpen ? 'rotate-180 text-blue-600' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 min-w-[260px] bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden">
          <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
            <Search size={13} className="text-slate-400 shrink-0 ml-1" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search BP code or name..."
              className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 text-slate-400 hover:text-slate-600 rounded"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100">
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full px-3 py-2 text-left text-xs flex items-center justify-between cursor-pointer ${
                !value ? 'bg-blue-50 text-blue-800 font-semibold' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <span>{allLabel}</span>
              {!value && <Check size={14} className="text-blue-600 shrink-0" />}
            </button>

            {visibleOptions.length === 0 ? (
              <div className="py-5 px-3 text-center">
                <Building2 size={18} className="mx-auto text-slate-300 mb-1" />
                <p className="text-xs text-slate-500">No business partners found</p>
              </div>
            ) : (
              visibleOptions.map((bp) => {
                const isSelected = bp.name === value;
                return (
                  <button
                    key={bp.code ? `${bp.code}-${bp.name}` : bp.name}
                    type="button"
                    onClick={() => handleSelect(bp.name)}
                    className={`w-full px-3 py-2 text-left flex items-center justify-between gap-2 text-xs transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50 text-blue-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      {bp.code && (
                        <span className="font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                          {bp.code}
                        </span>
                      )}
                      <span className="truncate">{bp.name}</span>
                    </div>
                    {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>

          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between items-center">
            <span>
              Showing {visibleOptions.length} of {filteredOptions.length}
            </span>
            {filteredOptions.length > MAX_VISIBLE && (
              <span className="text-blue-600 font-medium">Type to search more</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
