import { useState, useEffect, useMemo } from 'react';
import {
  HardHat,
  Search,
  X,
  Plus,
  Lock,
  UserCheck,
  History,
  Calendar,
  ChevronDown,
  Zap,
  Check,
  CheckSquare,
  Square,
} from 'lucide-react';
import {
  supervisorStorage,
  type OperatorEntry,
} from '../services/supervisorStorageService';
import { useAuth } from '../../../context/AuthContext';

interface SiteOperatorPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  currentOperators: OperatorEntry[];
  onAddOperator: (newOperator: OperatorEntry) => void;
  onAddOperators?: (newOperators: OperatorEntry[]) => void;
  projectId?: string;
}

export function SiteOperatorPoolModal({
  isOpen,
  onClose,
  selectedDate,
  currentOperators,
  onAddOperator,
  onAddOperators,
  projectId,
}: SiteOperatorPoolModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [poolOperators, setPoolOperators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  const [pastOperatorsGangs, setPastOperatorsGangs] = useState<
    Array<{ date: string; dayName: string; operatorIds: string[]; operatorCount: number; operators: OperatorEntry[] }>
  >([]);
  const [showPastDaysDropdown, setShowPastDaysDropdown] = useState(false);
  const [pastNotice, setPastNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setCheckedIds(new Set());
    setSelectedTrade('all');
    setPastNotice(null);
    setShowPastDaysDropdown(false);

    supervisorStorage
      .fetchSiteOperatorPool(projectId, selectedDate, user?.id)
      .then((items) => setPoolOperators(items))
      .catch((err) => console.warn('Could not load operator pool:', err))
      .finally(() => setIsLoading(false));

    supervisorStorage
      .getPastOperatorsForSupervisor(user?.id || '', selectedDate, 5)
      .then((gangs) => setPastOperatorsGangs(gangs))
      .catch((err) => console.warn('Could not load past operators:', err));
  }, [isOpen, selectedDate, projectId, user?.id]);

  // Set of IDs already in the current supervisor's active daily list
  const currentIds = useMemo(() => {
    return new Set(currentOperators.map((o) => o.id));
  }, [currentOperators]);

  // Distinct trade groups for filtering
  const distinctTrades = useMemo(() => {
    const trades = new Set<string>();
    poolOperators.forEach((op) => {
      if (op.tradeGroup) trades.add(op.tradeGroup);
    });
    return Array.from(trades).sort();
  }, [poolOperators]);

  const mostRecentGang = pastOperatorsGangs[0];
  const recentAvailableCount = useMemo(() => {
    if (!mostRecentGang) return 0;
    const pastIds = new Set(mostRecentGang.operatorIds);
    return poolOperators.filter((op) => pastIds.has(op.id) && !currentIds.has(op.id)).length;
  }, [mostRecentGang, poolOperators, currentIds]);

  const createOperatorEntry = (op: any, pastOp?: any): OperatorEntry => ({
    id: op.id,
    callingName: op.callingName || op.fullName || 'Operator',
    employeeNumber: op.employeeCode || '',
    licenseNo: op.nicNo || '',
    designation: op.tradeGroup || 'Machine Operator',
    inTime: '',
    outTime: '',
    shiftHours: 0,
    otHours: 0,
    assignedEquipmentId: pastOp?.assignedEquipmentId || '',
    equipmentSplits: pastOp?.equipmentSplits && pastOp.equipmentSplits.length > 0
      ? pastOp.equipmentSplits.map((s: any, idx: number) => ({ ...s, id: `split-${Date.now()}-${idx}` }))
      : (pastOp?.assignedEquipmentId ? [{ id: `split-${Date.now()}-0`, equipmentId: pastOp.assignedEquipmentId, hours: 0 }] : []),
    status: 'pending',
    claimedBySupervisor: op.claimedBySupervisor,
    claimedSupervisorId: op.claimedSupervisorId,
    claimedInTime: op.claimedInTime,
    claimedOutTime: op.claimedOutTime,
    claimedHours: op.claimedHours,
    claimedMachineCodes: op.claimedMachineCodes,
    claimedByMe: op.claimedByMe,
  });

  const handleDirectAddPastGang = (pg: { date: string; dayName: string; operatorIds: string[]; operatorCount: number; operators: OperatorEntry[] }) => {
    const idSet = new Set(pg.operatorIds);
    const toAddOps = poolOperators.filter((op) => idSet.has(op.id) && !currentIds.has(op.id));

    if (toAddOps.length === 0) {
      setPastNotice(`All operators from ${pg.date} are already in today's shift.`);
      setTimeout(() => setPastNotice(null), 3000);
      return;
    }

    const pastMap = new Map((pg.operators || []).map((p) => [p.id, p]));
    const newEntries: OperatorEntry[] = toAddOps.map((op) => createOperatorEntry(op, pastMap.get(op.id)));

    if (onAddOperators) {
      onAddOperators(newEntries);
    } else {
      newEntries.forEach((e) => onAddOperator(e));
    }
    onClose();
  };

  const handleSelectPastGang = (pg: { date: string; dayName: string; operatorIds: string[]; operatorCount: number; operators: OperatorEntry[] }) => {
    const idSet = new Set(pg.operatorIds);
    const matchingAvailable = poolOperators
      .filter((op) => idSet.has(op.id) && !currentIds.has(op.id))
      .map((op) => op.id);

    if (matchingAvailable.length === 0) {
      setPastNotice(`All ${pg.operatorCount} operators from ${pg.date} are already in today's shift.`);
      setTimeout(() => setPastNotice(null), 3000);
      return;
    }

    setCheckedIds(new Set(matchingAvailable));
    setShowPastDaysDropdown(false);
    setPastNotice(`Selected ${matchingAvailable.length} operator${matchingAvailable.length > 1 ? 's' : ''} from ${pg.date}. Review and click "Add Selected" below.`);
    setTimeout(() => setPastNotice(null), 4000);
  };

  // Filtered pool operators
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return poolOperators.filter((op) => {
      if (selectedTrade !== 'all' && op.tradeGroup !== selectedTrade) return false;
      if (!q) return true;
      return (
        op.callingName?.toLowerCase().includes(q) ||
        op.fullName?.toLowerCase().includes(q) ||
        op.employeeCode?.toLowerCase().includes(q) ||
        op.tradeGroup?.toLowerCase().includes(q)
      );
    });
  }, [poolOperators, search, selectedTrade]);

  // Available count in current filtered list
  const availableCount = filtered.filter((op) => !currentIds.has(op.id)).length;
  const allChecked = availableCount > 0 && filtered.filter((op) => !currentIds.has(op.id)).every((op) => checkedIds.has(op.id));

  // Toggle selection for a single operator
  const handleToggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Select all or deselect all available
  const handleSelectAllAvailable = () => {
    const available = filtered.filter((op) => !currentIds.has(op.id));
    if (available.every((op) => checkedIds.has(op.id))) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(available.map((op) => op.id)));
    }
  };

  // Batch add selected operators
  const handleAddSelected = () => {
    if (checkedIds.size === 0) return;
    const toAddOps = poolOperators.filter((op) => checkedIds.has(op.id) && !currentIds.has(op.id));
    if (toAddOps.length === 0) return;

    const newEntries: OperatorEntry[] = toAddOps.map((op) => createOperatorEntry(op));

    if (onAddOperators) {
      onAddOperators(newEntries);
    } else {
      newEntries.forEach((e) => onAddOperator(e));
    }
    setCheckedIds(new Set());
    onClose();
  };

  // Add a single operator without closing modal immediately
  const handleAddSingle = (op: any) => {
    const newEntry = createOperatorEntry(op);
    if (onAddOperators) {
      onAddOperators([newEntry]);
    } else {
      onAddOperator(newEntry);
    }
    setCheckedIds((prev) => {
      if (!prev.has(op.id)) return prev;
      const next = new Set(prev);
      next.delete(op.id);
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center shadow-xs">
              <HardHat size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Site Operator Pool
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
                  Self-Dispatch
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Select machinery operators allocated to this site for your shift.
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

        {/* ── Quick Copy Past Operators Banner ── */}
        {pastOperatorsGangs.length > 0 && mostRecentGang && (
          <div className="p-3 sm:px-5 sm:py-3 border-b border-blue-100 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 dark:from-slate-850 dark:via-blue-950/30 dark:to-slate-850">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <History size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Copy Past Operators
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {mostRecentGang.operatorCount} on {mostRecentGang.date} ({mostRecentGang.dayName})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    1-click select your regular operators instead of picking one by one.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Direct 1-Click Add Button */}
                <button
                  type="button"
                  onClick={() => handleDirectAddPastGang(mostRecentGang)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs transition-colors cursor-pointer"
                  title={`Directly add ${recentAvailableCount} available operators from ${mostRecentGang.date}`}
                >
                  <Zap size={13} className="fill-current" />
                  <span>1-Click Add ({recentAvailableCount})</span>
                </button>

                {/* Other Past Days Dropdown */}
                {pastOperatorsGangs.length > 1 && (
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowPastDaysDropdown(!showPastDaysDropdown)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-semibold text-xs border border-blue-200 dark:border-blue-800 bg-white dark:bg-slate-800 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Calendar size={13} />
                      <span className="hidden sm:inline">Other Days</span>
                      <ChevronDown size={13} />
                    </button>

                    {showPastDaysDropdown && (
                      <div className="absolute right-0 mt-1.5 w-60 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-30 space-y-1">
                        <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Select Operators from Past Days:
                        </div>
                        {pastOperatorsGangs.map((pg) => {
                          const pgAvail = poolOperators.filter((op) => new Set(pg.operatorIds).has(op.id) && !currentIds.has(op.id)).length;
                          return (
                            <button
                              key={pg.date}
                              type="button"
                              onClick={() => handleSelectPastGang(pg)}
                              className="w-full text-left px-2.5 py-1.5 rounded-xl text-xs hover:bg-blue-50 dark:hover:bg-slate-700 flex items-center justify-between cursor-pointer transition-colors"
                            >
                              <span className="font-semibold text-slate-800 dark:text-slate-200 font-mono">
                                {pg.date} ({pg.dayName})
                              </span>
                              <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">
                                {pgAvail} / {pg.operatorCount} avail
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {pastNotice && (
              <div className="mt-2 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 animate-in fade-in">
                <Check size={13} className="text-blue-600" />
                <span>{pastNotice}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Search Bar & Filter Chips ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850 space-y-2.5">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Operator Code, Name, or Machine Type..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-2xs"
              autoFocus
            />
          </div>

          {/* Trade / Machinery Group Filter Chips */}
          {distinctTrades.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
              <span className="text-[10px] text-slate-400 font-semibold uppercase shrink-0">Trades:</span>
              <button
                type="button"
                onClick={() => setSelectedTrade('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedTrade === 'all'
                    ? 'bg-blue-600 text-white font-bold'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                }`}
              >
                All ({poolOperators.length})
              </button>
              {distinctTrades.map((trade) => {
                const count = poolOperators.filter((op) => op.tradeGroup === trade).length;
                return (
                  <button
                    key={trade}
                    type="button"
                    onClick={() => setSelectedTrade(trade)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                      selectedTrade === trade
                        ? 'bg-blue-600 text-white font-bold'
                        : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-750'
                    }`}
                  >
                    {trade} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Selection Toolbar (Select All) ── */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleSelectAllAvailable}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-semibold cursor-pointer"
          >
            {allChecked ? <CheckSquare size={16} className="text-blue-600" /> : <Square size={16} />}
            <span>Select All Available ({availableCount})</span>
          </button>
          <span className="text-[11px] text-slate-400 font-medium">
            {checkedIds.size} selected
          </span>
        </div>

        {/* ── Operator List ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px]">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto" />
              <p>Fetching active site operators...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-850 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
              <HardHat className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No operators found in site pool
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Make sure operators are allocated to this site project.
              </p>
            </div>
          ) : (
            filtered.map((op) => {
              const isAlreadyAdded = currentIds.has(op.id);
              const isChecked = checkedIds.has(op.id);

              return (
                <div
                  key={op.id}
                  onClick={() => !isAlreadyAdded && handleToggleCheck(op.id)}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                    isAlreadyAdded
                      ? 'bg-slate-50/70 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 opacity-60 cursor-default'
                      : isChecked
                      ? 'bg-blue-50/50 dark:bg-blue-950/40 border-blue-500/80 ring-1 ring-blue-500/30 cursor-pointer'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 shadow-2xs cursor-pointer'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Checkbox */}
                    <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
                      {isAlreadyAdded ? (
                        <div className="w-5 h-5 rounded-md bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                          <Check size={12} className="stroke-[3]" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleCheck(op.id)}
                          className="focus:outline-hidden cursor-pointer"
                          aria-label={isChecked ? `Deselect ${op.callingName}` : `Select ${op.callingName}`}
                        >
                          {isChecked ? (
                            <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square size={18} className="text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {op.employeeCode}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {op.callingName}
                        </span>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                          {op.tradeGroup}
                        </span>
                      </div>

                      {op.fullName && op.fullName !== op.callingName && (
                        <p className="text-[11px] text-slate-400 truncate">
                          {op.fullName}
                        </p>
                      )}

                      {/* Claimed / Shared Info */}
                      {op.claimedBySupervisor && !op.claimedByMe && (
                        <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-semibold pt-0.5">
                          <Lock size={10} className="text-amber-600" />
                          <span>Logged by Sup. {op.claimedBySupervisor} ({op.claimedInTime || '--:--'} - {op.claimedOutTime || '--:--'}{op.claimedMachineCodes && op.claimedMachineCodes.length > 0 ? ` on ${op.claimedMachineCodes.join(', ')}` : ''})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Action */}
                  <div className="shrink-0">
                    {isAlreadyAdded ? (
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <UserCheck size={14} className="text-blue-500" /> Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSingle(op);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors cursor-pointer"
                        title={`Add ${op.callingName} to shift`}
                      >
                        <Plus size={13} className="stroke-[3]" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer Actions ── */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-slate-500">
            {checkedIds.size > 0 ? (
              <strong className="text-blue-700 dark:text-blue-400">
                {checkedIds.size} operator{checkedIds.size > 1 ? 's' : ''} selected
              </strong>
            ) : (
              'Select operators to batch-add'
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={checkedIds.size === 0}
              onClick={handleAddSelected}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={14} className="stroke-[3]" />
              <span>Add Selected ({checkedIds.size}) to Shift</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
