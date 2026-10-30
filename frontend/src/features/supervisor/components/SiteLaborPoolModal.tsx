import { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  X,
  Plus,
  Check,
  CheckSquare,
  Square,
  Lock,
  Briefcase,
  Building2,
  UserCheck,
  History,
  Copy,
  Calendar,
  ChevronDown,
  Zap,
} from 'lucide-react';
import {
  supervisorStorage,
  type LaborerEntry,
} from '../services/supervisorStorageService';
import { useAuth } from '../../../context/AuthContext';

interface SiteLaborPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  currentLaborers: LaborerEntry[];
  onAddLaborers: (newLaborers: LaborerEntry[]) => void;
  projectId?: string;
}

export function SiteLaborPoolModal({
  isOpen,
  onClose,
  selectedDate,
  currentLaborers,
  onAddLaborers,
  projectId,
}: SiteLaborPoolModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [poolWorkers, setPoolWorkers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [affiliationFilter, setAffiliationFilter] = useState<'all' | 'direct' | 'subcontractor'>('all');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [pastGangs, setPastGangs] = useState<Array<{ date: string; dayName: string; workerIds: string[]; workerCount: number }>>([]);
  const [showPastDaysDropdown, setShowPastDaysDropdown] = useState(false);
  const [pastGangNotice, setPastGangNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    setCheckedIds(new Set());
    setPastGangNotice(null);
    setShowPastDaysDropdown(false);

    supervisorStorage
      .fetchSiteLaborPool(projectId, selectedDate, user?.id)
      .then((items) => setPoolWorkers(items))
      .catch((err) => console.warn('Could not load labor pool:', err))
      .finally(() => setIsLoading(false));

    supervisorStorage
      .getPastGangsForSupervisor(user?.id || '', selectedDate, 5)
      .then((gangs) => setPastGangs(gangs))
      .catch((err) => console.warn('Could not load past gangs:', err));
  }, [isOpen, selectedDate, projectId, user?.id]);

  // Set of IDs already in the current supervisor's active daily list
  const currentIds = useMemo(() => {
    return new Set(currentLaborers.map((l) => l.id));
  }, [currentLaborers]);

  // Distinct trade groups for filtering
  const distinctTrades = useMemo(() => {
    const trades = new Set<string>();
    poolWorkers.forEach((w) => {
      if (w.tradeGroup) trades.add(w.tradeGroup);
    });
    return Array.from(trades).sort();
  }, [poolWorkers]);

  // Helper to determine if worker is Subcontractor vs Direct
  const isWorkerSubcon = (worker: any) => {
    if (worker.employeeType === 'internal') return false;
    if (worker.employeeType === 'external') return true;
    const bp = (worker.businessPartner || '').trim().toLowerCase();
    return Boolean(bp && bp !== 'direct' && bp !== 'internal' && bp !== 'none' && bp !== '-');
  };

  const { directCount, subconCount } = useMemo(() => {
    let direct = 0;
    let subcon = 0;
    poolWorkers.forEach((w) => {
      if (isWorkerSubcon(w)) subcon++;
      else direct++;
    });
    return { directCount: direct, subconCount: subcon };
  }, [poolWorkers]);

  // Filtered pool workers
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return poolWorkers.filter((worker) => {
      // Affiliation filter
      const isSubcon = isWorkerSubcon(worker);
      if (affiliationFilter === 'direct' && isSubcon) return false;
      if (affiliationFilter === 'subcontractor' && !isSubcon) return false;

      // Trade filter
      if (selectedTrade !== 'all' && worker.tradeGroup !== selectedTrade) return false;

      // Search query
      if (!q) return true;
      return (
        worker.callingName?.toLowerCase().includes(q) ||
        worker.fullName?.toLowerCase().includes(q) ||
        worker.employeeCode?.toLowerCase().includes(q) ||
        worker.nicNo?.toLowerCase().includes(q) ||
        worker.tradeGroup?.toLowerCase().includes(q) ||
        worker.businessPartner?.toLowerCase().includes(q)
      );
    });
  }, [poolWorkers, search, selectedTrade, affiliationFilter]);

  // Toggle selection
  const handleToggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const mostRecentGang = pastGangs[0];
  const recentAvailableCount = useMemo(() => {
    if (!mostRecentGang) return 0;
    const idSet = new Set(mostRecentGang.workerIds);
    return poolWorkers.filter((w) => idSet.has(w.id) && !currentIds.has(w.id)).length;
  }, [mostRecentGang, poolWorkers, currentIds]);

  const handleSelectPastGang = (pg: { date: string; dayName: string; workerIds: string[]; workerCount: number }) => {
    const idSet = new Set(pg.workerIds);
    const matchingAvailable = poolWorkers
      .filter((w) => idSet.has(w.id) && !currentIds.has(w.id))
      .map((w) => w.id);

    if (matchingAvailable.length === 0) {
      setPastGangNotice(`All ${pg.workerCount} workers from ${pg.date} are already in today's gang.`);
      setTimeout(() => setPastGangNotice(null), 3000);
      return;
    }

    setCheckedIds(new Set(matchingAvailable));
    setShowPastDaysDropdown(false);
    setPastGangNotice(`Checked ${matchingAvailable.length} worker${matchingAvailable.length > 1 ? 's' : ''} from ${pg.date} (${pg.dayName}). Review and tap "Add Selected" below!`);
    setTimeout(() => setPastGangNotice(null), 4000);
  };

  const handleDirectAddPastGang = (pg: { date: string; dayName: string; workerIds: string[]; workerCount: number }) => {
    const idSet = new Set(pg.workerIds);
    const toAddWorkers = poolWorkers.filter((w) => idSet.has(w.id) && !currentIds.has(w.id));

    if (toAddWorkers.length === 0) {
      setPastGangNotice(`All workers from ${pg.date} are already in today's gang.`);
      setTimeout(() => setPastGangNotice(null), 3000);
      return;
    }

    const newEntries: LaborerEntry[] = toAddWorkers.map((w) => ({
      id: w.id,
      employeeCode: w.employeeCode || '',
      callingName: w.callingName || w.fullName || 'Worker',
      fullName: w.fullName || '',
      tradeGroup: w.tradeGroup || 'General labour',
      businessPartner: w.businessPartner || 'Direct',
      nic: w.nicNo || '',
      inTime: '',
      outTime: '',
      shiftHours: 0,
      otHours: 0,
      activities: [],
      status: 'pending',
      claimedBySupervisor: w.claimedBySupervisor,
      claimedSupervisorId: w.claimedSupervisorId,
      claimedInTime: w.claimedInTime,
      claimedOutTime: w.claimedOutTime,
      claimedHours: w.claimedHours,
      claimedByMe: w.claimedByMe,
    }));

    onAddLaborers(newEntries);
    onClose();
  };

  const handleSelectAllAvailable = () => {
    const available = filtered.filter((w) => !currentIds.has(w.id));
    if (available.every((w) => checkedIds.has(w.id))) {
      // Deselect all
      setCheckedIds(new Set());
    } else {
      // Select all available
      setCheckedIds(new Set(available.map((w) => w.id)));
    }
  };

  const handleAddSelected = () => {
    if (checkedIds.size === 0) return;
    const selectedWorkers = poolWorkers.filter((w) => checkedIds.has(w.id));
    const newEntries: LaborerEntry[] = selectedWorkers.map((w) => ({
      id: w.id,
      employeeCode: w.employeeCode || '',
      callingName: w.callingName || w.fullName || 'Worker',
      fullName: w.fullName || '',
      tradeGroup: w.tradeGroup || 'General labour',
      businessPartner: w.businessPartner || 'Direct',
      nic: w.nicNo || '',
      inTime: '',
      outTime: '',
      shiftHours: 0,
      otHours: 0,
      activities: [],
      status: 'pending',
      claimedBySupervisor: w.claimedBySupervisor,
      claimedSupervisorId: w.claimedSupervisorId,
      claimedInTime: w.claimedInTime,
      claimedOutTime: w.claimedOutTime,
      claimedHours: w.claimedHours,
      claimedByMe: w.claimedByMe,
    }));

    onAddLaborers(newEntries);
    onClose();
  };

  const handleAddSingle = (worker: any) => {
    const newEntry: LaborerEntry = {
      id: worker.id,
      employeeCode: worker.employeeCode || '',
      callingName: worker.callingName || worker.fullName || 'Worker',
      fullName: worker.fullName || '',
      tradeGroup: worker.tradeGroup || 'General labour',
      businessPartner: worker.businessPartner || 'Direct',
      nic: worker.nicNo || '',
      inTime: '',
      outTime: '',
      shiftHours: 0,
      otHours: 0,
      activities: [],
      status: 'pending',
      claimedBySupervisor: worker.claimedBySupervisor,
      claimedSupervisorId: worker.claimedSupervisorId,
      claimedInTime: worker.claimedInTime,
      claimedOutTime: worker.claimedOutTime,
      claimedHours: worker.claimedHours,
      claimedByMe: worker.claimedByMe,
    };
    onAddLaborers([newEntry]);
  };

  if (!isOpen) return null;

  const availableCount = filtered.filter((w) => !currentIds.has(w.id)).length;
  const allChecked = availableCount > 0 && filtered.filter((w) => !currentIds.has(w.id)).every((w) => checkedIds.has(w.id));

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80 flex items-center justify-center shadow-xs">
              <Users size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Site Labour Pool
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/60">
                  Self-Dispatch
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Select workers allocated to this site to add to your daily attendance gang.
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

        {/* ── Quick Copy Past Gang Banner ── */}
        {pastGangs.length > 0 && mostRecentGang && (
          <div className="p-3 sm:px-5 sm:py-3 border-b border-blue-100 dark:border-blue-900/60 bg-gradient-to-r from-blue-50/90 via-indigo-50/70 to-blue-50/90 dark:from-slate-850 dark:via-blue-950/30 dark:to-slate-850">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                  <History size={16} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      Copy Past Gang
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {mostRecentGang.workerCount} workers on {mostRecentGang.date} ({mostRecentGang.dayName})
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    1-click select your regular crew instead of picking one by one.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* 1-Click Select Button */}
                <button
                  type="button"
                  onClick={() => handleSelectPastGang(mostRecentGang)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-2xs transition-colors cursor-pointer"
                  title={`Auto-check ${recentAvailableCount} available workers from ${mostRecentGang.date}`}
                >
                  <Copy size={13} />
                  <span>Select {mostRecentGang.dayName}'s Gang ({recentAvailableCount})</span>
                </button>

                {/* Direct 1-Click Add Button */}
                <button
                  type="button"
                  onClick={() => handleDirectAddPastGang(mostRecentGang)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-2xs transition-colors cursor-pointer"
                  title="Directly add all available workers from this past gang to today without having to check and tap add"
                >
                  <Zap size={13} className="fill-current" />
                  <span className="hidden sm:inline">1-Click Add</span>
                </button>

                {/* Other Past Days Dropdown */}
                {pastGangs.length > 1 && (
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
                          Select Gang from Past Days:
                        </div>
                        {pastGangs.map((pg) => {
                          const pgAvail = poolWorkers.filter((w) => new Set(pg.workerIds).has(w.id) && !currentIds.has(w.id)).length;
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
                                {pgAvail} / {pg.workerCount} avail
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

            {pastGangNotice && (
              <div className="mt-2 text-xs font-semibold text-blue-800 dark:text-blue-300 bg-blue-100/70 dark:bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 flex items-center gap-1.5 animate-in fade-in">
                <Check size={13} className="text-blue-600" />
                <span>{pastGangNotice}</span>
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
              placeholder="Search by Employee Code, Name, Trade, or Subcontractor..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 shadow-2xs"
              autoFocus
            />
          </div>

          {/* Affiliation Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setAffiliationFilter('all')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                affiliationFilter === 'all'
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              All Workers ({poolWorkers.length})
            </button>
            <button
              type="button"
              onClick={() => setAffiliationFilter('direct')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                affiliationFilter === 'direct'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Building2 size={12} />
              <span>Direct Maga ({directCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setAffiliationFilter('subcontractor')}
              className={`px-3 py-1 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center gap-1 cursor-pointer ${
                affiliationFilter === 'subcontractor'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 hover:bg-slate-100'
              }`}
            >
              <Briefcase size={12} />
              <span>Subcontractors ({subconCount})</span>
            </button>
          </div>

          {/* Trade Chips */}
          {distinctTrades.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
              <span className="text-[10px] text-slate-400 font-semibold uppercase shrink-0">Trades:</span>
              <button
                type="button"
                onClick={() => setSelectedTrade('all')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  selectedTrade === 'all'
                    ? 'bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200 font-bold'
                    : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                }`}
              >
                All
              </button>
              {distinctTrades.map((trade) => (
                <button
                  key={trade}
                  type="button"
                  onClick={() => setSelectedTrade(trade)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    selectedTrade === trade
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold border border-emerald-300'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                  }`}
                >
                  {trade}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Selection Toolbar (Select All) ── */}
        <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-850 flex items-center justify-between text-xs">
          <button
            type="button"
            onClick={handleSelectAllAvailable}
            className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 hover:text-slate-900 font-semibold cursor-pointer"
          >
            {allChecked ? <CheckSquare size={16} className="text-emerald-600" /> : <Square size={16} />}
            <span>Select All Available ({availableCount})</span>
          </button>
          <span className="text-[11px] text-slate-400">
            {checkedIds.size} selected
          </span>
        </div>

        {/* ── Labour List ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[260px]">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
              <p>Fetching active site labour pool...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-850 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
              <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No workers matching your search
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Make sure workers are registered to this site project.
              </p>
            </div>
          ) : (
            filtered.map((worker) => {
              const isAlreadyAdded = currentIds.has(worker.id);
              const isChecked = checkedIds.has(worker.id);
              const isSubcon = worker.businessPartner && worker.businessPartner !== 'Direct';

              return (
                <div
                  key={worker.id}
                  onClick={() => !isAlreadyAdded && handleToggleCheck(worker.id)}
                  className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                    isAlreadyAdded
                      ? 'bg-slate-50/70 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 opacity-60 cursor-default'
                      : isChecked
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/30 cursor-pointer'
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
                          onClick={() => handleToggleCheck(worker.id)}
                          className="focus:outline-hidden"
                        >
                          {isChecked ? (
                            <CheckSquare size={18} className="text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square size={18} className="text-slate-400 hover:text-slate-600" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Details */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                          {worker.employeeCode}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                          {worker.callingName}
                        </span>
                        {isSubcon ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200">
                            {worker.businessPartner}
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200">
                            Direct
                          </span>
                        )}
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <span>{worker.tradeGroup}</span>
                        {worker.fullName && worker.fullName !== worker.callingName && (
                          <>
                            <span>·</span>
                            <span className="truncate">{worker.fullName}</span>
                          </>
                        )}
                      </div>

                      {/* Claimed Context Badge */}
                      {worker.claimedBySupervisor && !worker.claimedByMe && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                          <Lock size={10} className="text-amber-600" />
                          <span>Logged by Sup. {worker.claimedBySupervisor} ({worker.claimedInTime || '--:--'} - {worker.claimedOutTime || '--:--'})</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right Action */}
                  <div className="shrink-0">
                    {isAlreadyAdded ? (
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <UserCheck size={14} className="text-emerald-500" /> In Gang
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddSingle(worker);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer"
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
              <strong className="text-emerald-700 dark:text-emerald-400">{checkedIds.size} worker{checkedIds.size > 1 ? 's' : ''} selected</strong>
            ) : (
              'Select workers to batch-add'
            )}
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={checkedIds.size === 0}
              onClick={handleAddSelected}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 transition-colors cursor-pointer shadow-xs"
            >
              <Plus size={14} className="stroke-[3]" />
              <span>Add Selected ({checkedIds.size}) to My Gang</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

