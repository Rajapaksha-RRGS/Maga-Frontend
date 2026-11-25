import { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, Briefcase, Clock } from 'lucide-react';
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

const RECENT_ACTIVITY_KEY = 'maga_recent_activities_v1';
const MAX_RECENT = 5;

function loadRecentCodes(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_ACTIVITY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecentCode(code: string) {
  if (!code) return;
  try {
    const current = loadRecentCodes().filter((x) => x !== code);
    const next = [code, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_ACTIVITY_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
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
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => {
    return Array.isArray(propOptions) && propOptions.length > 0
      ? propOptions
      : DEFAULT_MASTER_ACTIVITY_CODES;
  }, [propOptions]);

  const selectedItem = useMemo(() => {
    return options.find((opt) => opt.code === value);
  }, [options, value]);

  const recentOptions = useMemo(() => {
    if (searchQuery.trim()) return [];
    return recentCodes
      .map((code) => options.find((opt) => opt.code === code))
      .filter((o): o is ActivityCodeItem => Boolean(o));
  }, [recentCodes, options, searchQuery]);

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

  useEffect(() => {
    if (isOpen) {
      setRecentCodes(loadRecentCodes());
      setSearchQuery('');
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const handleSelect = (code: string) => {
    saveRecentCode(code);
    onChange(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative min-w-0 flex-1 ${className}`}>
      {/* Trigger Button — 44px+ touch target */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={[
          'w-full min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer select-none',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            : isOpen
            ? 'ring-2 ring-blue-500 border-blue-500 bg-white dark:bg-slate-800'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-800 dark:text-slate-100',
        ].join(' ')}
      >
        <span className="truncate text-xs font-medium">
          {selectedItem ? (
            <span>
              <strong className="font-mono text-slate-900 dark:text-slate-100 font-bold mr-1.5">
                {selectedItem.code}
              </strong>
              <span className="text-slate-600 dark:text-slate-300 text-[11px]">
                {selectedItem.name || selectedItem.code}
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
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange('');
                }
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              title="Clear activity"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {/* Searchable Bottom Sheet Modal */}
      {isOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-[2px] animate-in fade-in duration-150"
            onClick={() => setIsOpen(false)}
          >
            <div
              className="w-full sm:max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Mobile Drag Handle */}
              <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
                <div className="w-10 h-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <Briefcase size={16} className="text-blue-600" />
                    <span>Select Activity Code</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Search by code, description, or trade
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  aria-label="Close"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Search Input */}
              <div className="p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60">
                <div className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                  <Search size={16} className="text-slate-400 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search code or activity..."
                    className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Scrollable List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {recentOptions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Clock size={12} className="text-blue-600" />
                      <span>Recent Activities</span>
                    </div>
                    <div className="space-y-1.5">
                      {recentOptions.map((opt) => {
                        const isSelected = opt.code === value;
                        return (
                          <button
                            key={`recent-${opt.code}`}
                            type="button"
                            onClick={() => handleSelect(opt.code)}
                            className={[
                              'w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer',
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-2xs'
                                : 'bg-blue-50/30 dark:bg-slate-800/50 border-blue-200/70 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-slate-800',
                            ].join(' ')}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400">
                                  {opt.code}
                                </span>
                                {opt.trade && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {opt.trade}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-0.5">
                                {opt.name || opt.code}
                              </p>
                            </div>
                            {isSelected && <Check size={18} className="text-blue-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between px-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>{searchQuery.trim() ? 'Matching Activities' : 'All Activities'}</span>
                    <span className="font-mono">{filteredOptions.length}</span>
                  </div>

                  {filteredOptions.length === 0 ? (
                    <div className="py-8 px-3 text-center text-xs text-slate-400">
                      No matching activities found
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredOptions.map((opt) => {
                        const isSelected = opt.code === value;
                        return (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => handleSelect(opt.code)}
                            className={[
                              'w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer',
                              isSelected
                                ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-400 dark:border-blue-700 shadow-2xs'
                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                            ].join(' ')}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-mono font-bold text-xs text-blue-700 dark:text-blue-400">
                                  {opt.code}
                                </span>
                                {opt.trade && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                    {opt.trade}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-700 dark:text-slate-300 truncate mt-0.5">
                                {opt.name || opt.code}
                              </p>
                            </div>
                            {isSelected && <Check size={18} className="text-blue-600 flex-shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
