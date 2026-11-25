import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, ChevronDown, Check, X, Building2, Clock, HardHat } from 'lucide-react';

export interface SubcontractorOption {
  id: string;
  code: string;
  name: string;
  type?: string | null;
}

interface SearchableSubcontractorSelectProps {
  value: string | null | undefined;
  onChange: (partnerId: string | null) => void;
  options: SubcontractorOption[];
  disabled?: boolean;
  className?: string;
}

const RECENT_STORAGE_KEY = 'maga_recent_subcontractors_v1';
const MAX_RECENT = 4;

function loadRecentIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveRecentId(id: string) {
  try {
    const current = loadRecentIds().filter((x) => x !== id);
    const next = [id, ...current].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Ignore storage quota errors
  }
}

export function SearchableSubcontractorSelect({
  value,
  onChange,
  options,
  disabled = false,
  className = '',
}: SearchableSubcontractorSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedItem = useMemo(
    () => (value ? options.find((opt) => opt.id === value) || null : null),
    [options, value]
  );

  useEffect(() => {
    if (isOpen) {
      setRecentIds(loadRecentIds());
      setSearchQuery('');
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 80);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Lock body scroll when bottom sheet is open
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const recentOptions = useMemo(() => {
    if (searchQuery.trim()) return [];
    return recentIds
      .map((id) => options.find((o) => o.id === id))
      .filter((o): o is SubcontractorOption => Boolean(o));
  }, [recentIds, options, searchQuery]);

  const filteredOptions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return options;
    return options.filter(
      (opt) =>
        opt.name.toLowerCase().includes(q) ||
        opt.code.toLowerCase().includes(q) ||
        (opt.type && opt.type.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  const handleSelect = (partnerId: string | null) => {
    if (partnerId) {
      saveRecentId(partnerId);
    }
    onChange(partnerId);
    setIsOpen(false);
  };

  const isSubSelected = Boolean(value);

  return (
    <>
      {/* Trigger Button — 44px+ touch target & clear visual hierarchy */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(true)}
        className={[
          'w-full min-h-[44px] px-3 py-2 rounded-xl border text-left flex items-center justify-between gap-2 transition-all cursor-pointer select-none',
          disabled
            ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400'
            : isSubSelected
            ? 'bg-red-50/90 dark:bg-red-950/40 border-red-400 dark:border-red-700 text-red-900 dark:text-red-100 hover:bg-red-100/70 shadow-2xs'
            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600',
          className,
        ].join(' ')}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isSubSelected ? (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider flex-shrink-0">
              SUB
            </span>
          ) : (
            <Building2 size={15} className="text-slate-400 flex-shrink-0" />
          )}

          <div className="min-w-0 flex-1">
            {selectedItem ? (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs font-bold text-red-900 dark:text-red-100 truncate">
                  {selectedItem.name}
                </span>
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-200 flex-shrink-0">
                  {selectedItem.code}
                </span>
              </div>
            ) : isSubSelected ? (
              <span className="text-xs font-bold text-red-700 dark:text-red-300 truncate">
                Subcontractor Selected
              </span>
            ) : (
              <div className="flex items-center gap-1.5 truncate">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Company (Normal Work)
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:inline">
                  · Tap to charge Sub
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          {isSubSelected && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                  onChange(null);
                }
              }}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-red-500 hover:text-red-700 hover:bg-red-200/60 dark:hover:bg-red-900/50 cursor-pointer"
              title="Reset to Company (Normal Work)"
            >
              <X size={14} />
            </span>
          )}
          <ChevronDown
            size={16}
            className={isSubSelected ? 'text-red-600' : 'text-slate-400'}
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

              {/* Sheet Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                    <HardHat size={16} className="text-red-600" />
                    <span>Charge Work To</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Select Company or a Subcontractor for bill deduction
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
                <div className="flex items-center gap-2 px-3 min-h-[44px] rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus-within:ring-2 focus-within:ring-red-500 focus-within:border-red-500">
                  <Search size={16} className="text-slate-400 flex-shrink-0" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search subcontractor name or code..."
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

              {/* Scrollable Options List */}
              <div className="flex-1 overflow-y-auto p-3 space-y-4">
                {/* Pinned Default Option: Company (Normal Work) */}
                {!searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(null)}
                    className={[
                      'w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer',
                      !isSubSelected
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 shadow-2xs'
                        : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                    ].join(' ')}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={[
                          'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                          !isSubSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500',
                        ].join(' ')}
                      >
                        <Building2 size={18} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                          Company (Normal Work)
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          Standard Maga project work — no deduction
                        </div>
                      </div>
                    </div>
                    {!isSubSelected && (
                      <Check size={18} className="text-blue-600 flex-shrink-0" />
                    )}
                  </button>
                )}

                {/* Recent Selections */}
                {recentOptions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      <Clock size={12} className="text-red-500" />
                      <span>Recent Selections</span>
                    </div>
                    <div className="space-y-1.5">
                      {recentOptions.map((bp) => {
                        const isSelected = value === bp.id;
                        return (
                          <button
                            key={`recent-${bp.id}`}
                            type="button"
                            onClick={() => handleSelect(bp.id)}
                            className={[
                              'w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer',
                              isSelected
                                ? 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-700 shadow-2xs'
                                : 'bg-red-50/30 dark:bg-slate-800/50 border-red-200/70 dark:border-slate-700 hover:bg-red-50 dark:hover:bg-slate-800',
                            ].join(' ')}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {bp.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-200">
                                  {bp.code}
                                </span>
                                {bp.type && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {bp.type}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <Check size={18} className="text-red-600 flex-shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* All Subcontractors */}
                <div>
                  <div className="flex items-center justify-between px-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <span>
                      {searchQuery.trim() ? 'Matching Subcontractors' : 'All Subcontractors'}
                    </span>
                    <span className="font-mono">{filteredOptions.length}</span>
                  </div>

                  {filteredOptions.length === 0 ? (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No subcontractors found for "{searchQuery}"
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredOptions.map((bp) => {
                        const isSelected = value === bp.id;
                        return (
                          <button
                            key={bp.id}
                            type="button"
                            onClick={() => handleSelect(bp.id)}
                            className={[
                              'w-full min-h-[52px] px-3.5 py-2.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer',
                              isSelected
                                ? 'bg-red-50 dark:bg-red-950/50 border-red-400 dark:border-red-700 shadow-2xs'
                                : 'bg-white dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800',
                            ].join(' ')}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                                {bp.name}
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                  {bp.code}
                                </span>
                                {bp.type && (
                                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                    {bp.type}
                                  </span>
                                )}
                              </div>
                            </div>
                            {isSelected && (
                              <Check size={18} className="text-red-600 flex-shrink-0" />
                            )}
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
    </>
  );
}
