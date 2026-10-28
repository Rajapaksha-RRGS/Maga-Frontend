import { useState, useEffect, useMemo } from 'react';
import {
  Tractor,
  Search,
  X,
  Plus,
  Check,
  Gauge,
  Users,
  Sparkles,
} from 'lucide-react';
import {
  supervisorStorage,
  type SitePoolEquipmentItem,
  type EquipmentLogEntry,
} from '../services/supervisorStorageService';
import { useAuth } from '../../../context/AuthContext';

interface SiteEquipmentPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  currentEquipment: EquipmentLogEntry[];
  onAddEquipment: (entry: EquipmentLogEntry) => void;
}

export function SiteEquipmentPoolModal({
  isOpen,
  onClose,
  selectedDate,
  currentEquipment,
  onAddEquipment,
}: SiteEquipmentPoolModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [poolItems, setPoolItems] = useState<SitePoolEquipmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    supervisorStorage
      .fetchSiteEquipmentPool(undefined, selectedDate)
      .then((items) => setPoolItems(items))
      .catch((err) => console.warn('Could not load pool items:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, selectedDate]);

  // Set of IDs already in the current supervisor's daily list
  const currentIds = useMemo(() => {
    return new Set(currentEquipment.map((e) => e.id));
  }, [currentEquipment]);

  // Distinct equipment types for filtering tabs
  const distinctTypes = useMemo(() => {
    const types = new Set<string>();
    poolItems.forEach((i) => {
      if (i.type) types.add(i.type);
    });
    return Array.from(types).sort();
  }, [poolItems]);

  // Filtered pool items
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return poolItems.filter((item) => {
      if (selectedType !== 'all' && item.type !== selectedType) return false;
      if (!q) return true;
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.vehicleNo && item.vehicleNo.toLowerCase().includes(q)) ||
        (item.magaNo && item.magaNo.toLowerCase().includes(q)) ||
        (item.type && item.type.toLowerCase().includes(q))
      );
    });
  }, [poolItems, search, selectedType]);

  if (!isOpen) return null;

  const handleSelect = (item: SitePoolEquipmentItem) => {
    const entry = supervisorStorage.createEquipmentLogEntryFromPool(item);
    onAddEquipment(entry);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full sm:max-w-2xl bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] sm:max-h-[85vh] overflow-hidden animate-in slide-in-from-bottom-6 sm:zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* ── Modal Header ── */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
              <Tractor size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                  Site Equipment Pool
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-900/60">
                  Self-Service
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Select machinery allocated to this site to record your shift logs.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Search Bar & Filter Chips ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 space-y-2.5">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Vehicle No, Maga Code, or Name (e.g. EX-01, WP LA-4521)..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500"
              autoFocus
            />
          </div>

          {distinctTypes.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setSelectedType('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedType === 'all'
                    ? 'bg-slate-800 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                }`}
              >
                All ({poolItems.length})
              </button>
              {distinctTypes.map((t) => {
                const count = poolItems.filter((i) => i.type === t).length;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedType(t)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedType === t
                        ? 'bg-amber-600 text-white'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {t} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Equipment List ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[260px]">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin mx-auto" />
              <p>Fetching active site equipment pool...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-850 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
              <Tractor className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No equipment matching your search
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Make sure the machinery is active in the project master roster.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isAlreadyAdded = currentIds.has(item.id);

              // Filter out current supervisor's own usages so they don't see themselves as "Shared with"
              const otherUsages = (item.existingUsages || []).filter((u) => {
                if (user?.id && u.supervisorId === user.id) return false;
                if (user?.fullName && u.supervisorName && u.supervisorName.trim().toLowerCase() === user.fullName.trim().toLowerCase()) return false;
                if (user?.username && u.supervisorName && u.supervisorName.trim().toLowerCase() === user.username.trim().toLowerCase()) return false;
                return true;
              });

              const isUsedByOther = otherUsages.length > 0;
              let otherLoggedDays = 0;
              let otherLoggedHours = 0;
              for (const u of otherUsages) {
                const uCode = (u.unitCode || item.primaryUnit || '').toLowerCase();
                const uUtil = u.totalUtilization ?? 0;
                if (uCode === 'days' || uCode === 'day') {
                  otherLoggedDays += uUtil;
                } else if (uCode === 'hrs' || uCode === 'hr' || uCode === 'ex.hrs') {
                  otherLoggedHours += (u.workingHours || uUtil);
                } else if (uUtil <= 1.5 && (item.primaryUnit.toLowerCase() === 'days' || item.primaryUnit.toLowerCase() === 'mth')) {
                  otherLoggedDays += uUtil;
                } else {
                  otherLoggedHours += (u.workingHours || uUtil);
                }
              }

              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isAlreadyAdded
                      ? 'bg-slate-50/70 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 opacity-70'
                      : isUsedByOther
                      ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/60 hover:border-blue-300'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  {/* Left Info */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                        {item.vehicleNo || item.code}
                      </span>
                      {item.magaNo && item.magaNo !== item.vehicleNo && (
                        <span className="text-[10px] font-mono text-slate-400">
                          ({item.magaNo})
                        </span>
                      )}
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 font-semibold">
                        Unit: {item.primaryUnit}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {item.condition}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {item.name}
                    </h4>

                    {/* Conflict & Smart Meter Status Bar */}
                    <div className="pt-0.5">
                      {isUsedByOther ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 font-semibold text-[11px] flex-wrap">
                            <Users size={12} className="text-blue-600 flex-shrink-0" />
                            <span>
                              Shared with:{' '}
                              <strong>
                                {otherUsages.map((u) => `${u.supervisorName} (${u.status === 'submitted' || u.status === 'approved' ? 'Submitted' : 'Draft'})`).join(', ')}
                              </strong>
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold border border-blue-200 dark:border-blue-800">
                              Multi-Supervisor
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-2 flex-wrap">
                            {otherLoggedDays > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-750 font-mono">
                                Used: <strong>{otherLoggedDays.toFixed(2)} Days</strong> | Rem: <strong>{Math.max(0, 1 - otherLoggedDays).toFixed(2)} Days</strong>
                              </span>
                            )}
                            {otherLoggedHours > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-750 font-mono">
                                Logged: <strong>{otherLoggedHours.toFixed(1)}h</strong>
                              </span>
                            )}
                            {(item.latestMeter ?? 0) > 0 && (
                              <span className="flex items-center gap-1 font-mono text-slate-600 dark:text-slate-300">
                                <Gauge size={11} className="text-slate-400" />
                                Handover: <strong>{item.latestMeter}</strong>
                              </span>
                            )}
                            {(item.latestMileage ?? 0) > 0 && (
                              <span className="font-mono text-slate-600 dark:text-slate-300">
                                Mileage: <strong>{item.latestMileage} km</strong>
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-medium text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>Available in site yard</span>
                          {item.latestMeter > 0 && (
                            <span className="text-slate-400 text-[10px] ml-2 flex items-center gap-1">
                              <Gauge size={11} /> Last Meter: {item.latestMeter}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Action */}
                  <div className="flex items-center self-end sm:self-center">
                    {isAlreadyAdded ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 bg-slate-100 dark:bg-slate-700 px-3 py-1.5 rounded-xl">
                        <Check size={14} /> Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleSelect(item)}
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl transition-all cursor-pointer shadow-xs ${
                          isUsedByOther
                            ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        }`}
                      >
                        <Plus size={14} />
                        <span>{isUsedByOther ? 'Share Machine (Add)' : 'Add to My Log'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles size={13} className="text-amber-500" />
            Smart Handover enabled: Meter reading automatically synchronizes.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-100 cursor-pointer text-xs"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
