import { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Save, 
  Check, 
  Briefcase, 
  Search, 
  X, 
  CheckSquare, 
  Square, 
  LogIn, 
  LogOut, 
  Clock, 
  Filter
} from 'lucide-react';
import { 
  MASTER_ACTIVITIES, 
  type LaborerEntry, 
  type ActivitySplit 
} from '../services/supervisorStorageService';

interface LaborEntryViewProps {
  laborers: LaborerEntry[];
  onSaveLaborers: (updated: LaborerEntry[]) => void;
  searchQuery?: string;
  statusFilter?: 'all' | 'pending' | 'done';
}

interface BatchActivityItem {
  id: string;
  activityCode: string;
  hours: number;
}

// Calculate hours between two HH:MM strings (with 1h lunch deduction if >= 5h)
function computeHours(inTime: string, outTime: string): { shift: number; ot: number } {
  if (!inTime || !outTime) return { shift: 0, ot: 0 };
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  let totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  if (totalMinutes < 0) totalMinutes += 24 * 60; // Crosses midnight
  if (totalMinutes >= 300) totalMinutes -= 60; // 1-hour lunch deduction

  const shiftHours = totalMinutes > 0 ? parseFloat((totalMinutes / 60).toFixed(1)) : 0;
  // Standard shift is 8.0 hours; anything above is OT
  const otHours = shiftHours > 8.0 ? parseFloat((shiftHours - 8.0).toFixed(1)) : 0;

  return { shift: shiftHours, ot: otHours };
}

export function LaborEntryView({
  laborers,
  onSaveLaborers,
  searchQuery: externalSearchQuery = '',
  statusFilter: externalStatusFilter = 'all',
}: LaborEntryViewProps) {
  // Mode: In Time or Out Time (matching hand-drawn sketch)
  const [tabMode, setTabMode] = useState<'in' | 'out'>('in');

  // Internal search and filters (search bar & trade filter directly under search)
  const [localSearch, setLocalSearch] = useState('');
  const [selectedTrade, setSelectedTrade] = useState<string>('all');
  const [localStatusFilter, setLocalStatusFilter] = useState<'all' | 'pending' | 'done'>('all');

  // Selection state for batch actions
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  // Expanded card state for individual inspection
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Save feedback state
  const [individualSaveId, setIndividualSaveId] = useState<string | null>(null);

  // ── IN MODE BATCH STATE ──
  const [batchInTime, setBatchInTime] = useState('07:00');

  // ── OUT MODE BATCH STATE ──
  const [batchOutTime, setBatchOutTime] = useState('17:00');
  const [batchActivities, setBatchActivities] = useState<BatchActivityItem[]>([
    { id: 'batch-act-1', activityCode: MASTER_ACTIVITIES[0].code, hours: 8.5 }
  ]);

  // Derived unique trades for trade group filter
  const uniqueTrades = useMemo(() => {
    const trades = new Set<string>();
    laborers.forEach((l) => {
      if (l.tradeGroup) trades.add(l.tradeGroup);
    });
    return Array.from(trades);
  }, [laborers]);

  // Combined search query (external + local)
  const effectiveSearch = localSearch || externalSearchQuery;
  const effectiveStatus = localStatusFilter !== 'all' ? localStatusFilter : externalStatusFilter;

  // Filtered workers
  const filteredLaborers = useMemo(() => {
    return laborers.filter((l) => {
      const search = effectiveSearch.toLowerCase().trim();
      const matchesSearch = 
        !search ||
        (l.employeeCode && l.employeeCode.toLowerCase().includes(search)) ||
        l.callingName.toLowerCase().includes(search) ||
        l.tradeGroup.toLowerCase().includes(search) ||
        (l.nic && l.nic.toLowerCase().includes(search)) ||
        l.businessPartner.toLowerCase().includes(search);

      if (!matchesSearch) return false;

      // Trade Group filter
      if (selectedTrade !== 'all' && l.tradeGroup !== selectedTrade) {
        return false;
      }

      // Status filter
      if (effectiveStatus === 'pending') {
        return !l.inTime || !l.outTime || l.activities.length === 0;
      }
      if (effectiveStatus === 'done') {
        return !!(l.inTime && l.outTime && l.activities.length > 0);
      }

      return true;
    });
  }, [laborers, effectiveSearch, selectedTrade, effectiveStatus]);

  // Stats
  const inMarkedCount = laborers.filter((l) => !!l.inTime).length;
  const outMarkedCount = laborers.filter((l) => !!l.outTime).length;
  const completedCount = laborers.filter((l) => l.inTime && l.outTime && l.activities.length > 0).length;
  const pendingCount = laborers.length - completedCount;

  // Selection handlers
  const handleToggleSelectAll = () => {
    const currentFilteredIds = filteredLaborers.map((l) => l.id);
    const allSelected = currentFilteredIds.every((id) => selectedWorkerIds.includes(id));

    if (allSelected) {
      setSelectedWorkerIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedWorkerIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const handleToggleWorkerSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedWorkerIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ── APPLY BATCH IN TIME ──
  const handleApplyBatchIn = () => {
    if (selectedWorkerIds.length === 0) return;

    const updated = laborers.map((l) => {
      if (!selectedWorkerIds.includes(l.id)) return l;
      const inTime = batchInTime;
      const outTime = l.outTime;
      const { shift, ot } = computeHours(inTime, outTime);

      const isComplete = inTime && outTime && l.activities.length > 0;
      return {
        ...l,
        inTime,
        shiftHours: shift,
        otHours: ot,
        status: (isComplete ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
        lastSavedAt: `In: ${batchInTime}`,
      };
    });

    onSaveLaborers(updated);
  };

  // ── BATCH ACTIVITY ROW HANDLERS ──
  const handleAddBatchActivityRow = () => {
    const newRow: BatchActivityItem = {
      id: `batch-act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      activityCode: MASTER_ACTIVITIES[batchActivities.length % MASTER_ACTIVITIES.length].code,
      hours: 4.0,
    };
    setBatchActivities((prev) => [...prev, newRow]);
  };

  const handleUpdateBatchActivityRow = (id: string, field: 'activityCode' | 'hours', value: any) => {
    setBatchActivities((prev) => 
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const handleRemoveBatchActivityRow = (id: string) => {
    if (batchActivities.length <= 1) return;
    setBatchActivities((prev) => prev.filter((a) => a.id !== id));
  };



  // ── APPLY BATCH OUT TIME & ACTIVITIES ──
  const handleApplyBatchOut = () => {
    if (selectedWorkerIds.length === 0) return;

    const updated = laborers.map((l) => {
      if (!selectedWorkerIds.includes(l.id)) return l;
      const inTime = l.inTime || '07:00'; // Fallback if In wasn't marked
      const outTime = batchOutTime;
      const { shift, ot } = computeHours(inTime, outTime);

      // Map batch activities to laborer splits
      const newSplits: ActivitySplit[] = batchActivities.map((ba) => ({
        id: `split-${Date.now()}-${l.id}-${ba.id}`,
        activityCode: ba.activityCode,
        hours: ba.hours,
      }));

      return {
        ...l,
        inTime,
        outTime,
        shiftHours: shift,
        otHours: ot,
        activities: newSplits,
        status: 'done' as const,
        lastSavedAt: `Out: ${batchOutTime}`,
      };
    });

    onSaveLaborers(updated);
  };

  // ── INDIVIDUAL WORKER UPDATES ──
  const handleIndividualTimeChange = (id: string, inTime: string, outTime: string) => {
    const { shift, ot } = computeHours(inTime, outTime);
    const updated = laborers.map((l) => {
      if (l.id !== id) return l;

      let activities = [...l.activities];
      if (activities.length === 1 && shift > 0) {
        activities = [{ ...activities[0], hours: shift }];
      }

      return {
        ...l,
        inTime,
        outTime,
        shiftHours: shift,
        otHours: ot,
        activities,
        status: (inTime && outTime && activities.length > 0 ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
      };
    });
    onSaveLaborers(updated);
  };

  const handleAddIndividualActivitySplit = (laborerId: string) => {
    const laborer = laborers.find((l) => l.id === laborerId);
    if (!laborer) return;

    const allocatedSum = laborer.activities.reduce((acc, a) => acc + (a.hours || 0), 0);
    const remaining = Math.max(0, parseFloat((laborer.shiftHours - allocatedSum).toFixed(1)));

    const newSplit: ActivitySplit = {
      id: `split-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      activityCode: MASTER_ACTIVITIES[0].code,
      hours: remaining || 4.0,
    };

    const updated = laborers.map((l) => 
      l.id === laborerId 
        ? { ...l, activities: [...l.activities, newSplit], status: 'draft' as const }
        : l
    );
    onSaveLaborers(updated);
  };

  const handleUpdateIndividualActivitySplit = (laborerId: string, splitId: string, field: 'activityCode' | 'hours', value: any) => {
    const updated = laborers.map((l) => {
      if (l.id !== laborerId) return l;
      const activities = l.activities.map((a) => 
        a.id === splitId ? { ...a, [field]: value } : a
      );
      return { ...l, activities, status: 'draft' as const };
    });
    onSaveLaborers(updated);
  };

  const handleRemoveIndividualActivitySplit = (laborerId: string, splitId: string) => {
    const updated = laborers.map((l) => {
      if (l.id !== laborerId || l.activities.length <= 1) return l;
      const activities = l.activities.filter((a) => a.id !== splitId);
      return { ...l, activities, status: 'draft' as const };
    });
    onSaveLaborers(updated);
  };

  const handleSaveIndividualDraft = (laborerId: string) => {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const updated = laborers.map((l) => {
      if (l.id !== laborerId) return l;
      const isComplete = l.inTime && l.outTime && l.activities.length > 0;
      return {
        ...l,
        status: (isComplete ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
        lastSavedAt: now,
      };
    });
    onSaveLaborers(updated);
    setIndividualSaveId(laborerId);
    setTimeout(() => setIndividualSaveId(null), 2000);
  };

  const isAllFilteredSelected = 
    filteredLaborers.length > 0 && 
    filteredLaborers.every((l) => selectedWorkerIds.includes(l.id));

  return (
    <div className="space-y-3 pb-16 animate-in fade-in duration-150">
      {/* ── IN / OUT Dual Tabs (Matches Hand-Drawn Sketch) ───────────────────── */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-200/70 dark:bg-slate-900/90 rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-inner">
        <button
          type="button"
          onClick={() => setTabMode('in')}
          className={[
            'py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all',
            tabMode === 'in'
              ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          ].join(' ')}
        >
          <LogIn size={15} />
          <span>IN TIME</span>
          <span className={[
            'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
            tabMode === 'in' ? 'bg-emerald-700/80 text-emerald-100' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          ].join(' ')}>
            {inMarkedCount}/{laborers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTabMode('out')}
          className={[
            'py-2.5 px-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all',
            tabMode === 'out'
              ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-500/20'
              : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
          ].join(' ')}
        >
          <LogOut size={15} />
          <span>OUT TIME</span>
          <span className={[
            'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
            tabMode === 'out' ? 'bg-blue-700/80 text-blue-100' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          ].join(' ')}>
            {outMarkedCount}/{laborers.length}
          </span>
        </button>
      </div>

      {/* ── 3. Search Bar ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search employee code, calling name, NIC..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-600 focus:outline-none shadow-2xs transition-colors"
        />
        {localSearch && (
          <button
            type="button"
            onClick={() => setLocalSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── 4. Trade Group & Status Filter Chips (Under Search Bar) ────────────── */}
       <div className="py-2 px-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
        {/* Trade Groups Chips */}
        <div>
          <div className="flex items-center justify-between mb-1 px-0.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={12} className="text-blue-600 dark:text-blue-400" />
              Filter by Trade:
            </span>

          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs"> 
            <button
              type="button"
              onClick={() => setSelectedTrade('all')}
              className={[
                'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                selectedTrade === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
              ].join(' ')}
            >
              All Trades ({laborers.length})
            </button>
            {uniqueTrades.map((trade) => {
              const count = laborers.filter((l) => l.tradeGroup === trade).length;
              return (
                <button
                  key={trade}
                  type="button"
                  onClick={() => setSelectedTrade(trade)}
                  className={[
                    'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                    selectedTrade === trade
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                  ].join(' ')}
                >
                  {trade} ({count})
                </button>
              );
            })}
          </div>
        </div>



        {/* Status Filter Chips: Completed vs Pending */}
        <div>
          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider block mb-2 px-0.5">
            Shift Status:
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setLocalStatusFilter('all')}
              className={[
                'flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border',
                localStatusFilter === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 border-slate-900 dark:border-slate-100 text-white dark:text-slate-900 shadow-2xs font-bold'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-750'
              ].join(' ')}
            >
              <span>All</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/10 dark:bg-white/10 font-mono">
                {filteredLaborers.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocalStatusFilter('done')}
              className={[
                'flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border',
                localStatusFilter === 'done'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs font-bold'
                  : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
              ].join(' ')}
            >
              <CheckCircle2 size={13} />
              <span>Done</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-700/20 dark:bg-emerald-400/20 font-mono">
                {completedCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocalStatusFilter('pending')}
              className={[
                'flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border',
                localStatusFilter === 'pending'
                  ? 'bg-amber-600 border-amber-600 text-white shadow-2xs font-bold'
                  : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/50'
              ].join(' ')}
            >
              <Clock size={13} />
              <span>Pending</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-700/20 dark:bg-amber-400/20 font-mono">
                {pendingCount}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 5. Action Bar (Dynamic for IN mode or OUT mode) ────────────────────── */}
      {tabMode === 'in' ? (
        /* ── IN MODE ACTION BAR ── */
        <div className="p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                <LogIn size={15} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                  Morning In-Time 
                </h3>
                
              </div>
            </div>

            {/* Quick in-time input */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 shadow-2xs">
              <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase">In:</span>
              <input
                type="time"
                value={batchInTime}
                onChange={(e) => setBatchInTime(e.target.value)}
                className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Selection Controls & Action Button */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-200/60 dark:border-emerald-800/60">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:underline"
            >
              {isAllFilteredSelected ? (
                <CheckSquare size={16} className="text-emerald-600" />
              ) : (
                <Square size={16} className="text-emerald-600" />
              )}
              <span>{isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredLaborers.length})`}</span>
            </button>

            <button
              type="button"
              onClick={handleApplyBatchIn}
              disabled={selectedWorkerIds.length === 0}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-xs active:scale-[0.98]"
            >
              <Check size={14} />
              <span>Apply In-Time to {selectedWorkerIds.length} Workers</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── OUT & ACTIVITIES MODE ACTION BAR ── */
        <div className="p-3.5 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <LogOut size={15} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  Evening Out-Time & Activity Allocation
                </h3>
                {/* <p className="text-[11px] text-blue-700 dark:text-blue-400">
                  Record departure time & split hours across Master Activity codes
                </p> */}
              </div>
            </div>

            {/* Out Time Picker */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase">Out:</span>
              <input
                type="time"
                value={batchOutTime}
                onChange={(e) => setBatchOutTime(e.target.value)}
                className="text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none"
              />
            </div>
          </div>

          {/* Master Activity Code Splits for Batch */}
          <div className="space-y-2 bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-xl border border-blue-200/80 dark:border-blue-800/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 flex items-center gap-1">
                <Briefcase size={12} className="text-blue-600" />
                Activity Codes Split 
              </span>
              <button
                type="button"
                onClick={handleAddBatchActivityRow}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-0.5"
              >
                <Plus size={13} /> Add Activity
              </button>
            </div>

            {batchActivities.map((row) => (
              <div key={row.id} className="flex items-center gap-2">
                <select
                  value={row.activityCode}
                  onChange={(e) => handleUpdateBatchActivityRow(row.id, 'activityCode', e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-600"
                >
                  {MASTER_ACTIVITIES.map((act) => (
                    <option key={act.code} value={act.code}>
                      {act.code} 
                    </option>
                  ))}
                </select>

                <div className="w-20">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={row.hours}
                    onChange={(e) => handleUpdateBatchActivityRow(row.id, 'hours', parseFloat(e.target.value) || 0)}
                    placeholder="Hours"
                    className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-center text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                {batchActivities.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveBatchActivityRow(row.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Selection Controls & Apply Button */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-800/60">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 hover:underline"
            >
              {isAllFilteredSelected ? (
                <CheckSquare size={16} className="text-blue-600" />
              ) : (
                <Square size={16} className="text-blue-600" />
              )}
              <span>{isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredLaborers.length})`}</span>
            </button>

            <button
              type="button"
              onClick={handleApplyBatchOut}
              disabled={selectedWorkerIds.length === 0}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-xs active:scale-[0.98]"
            >
              <Check size={14} />
              <span>Apply to {selectedWorkerIds.length} Workers</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 6. Worker Cards List (Matches Hand-Drawn Sketch) ───────────────────── */}
      <div className="space-y-2">
        {filteredLaborers.length === 0 ? (
          <div className="py-12 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <Users className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No laborers found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {effectiveSearch ? 'Try a different search query or trade filter.' : 'Tap + Quick Assign to add standby workers.'}
            </p>
          </div>
        ) : (
          filteredLaborers.map((worker) => {
            const isSelected = selectedWorkerIds.includes(worker.id);
            const isExpanded = tabMode === 'out' && expandedId === worker.id;
            const activitySum = worker.activities.reduce((acc, a) => acc + (Number(a.hours) || 0), 0);
            const hasDiscrepancy = worker.shiftHours > 0 && Math.abs(activitySum - worker.shiftHours) >= 0.1;
            const isIndividualSaved = individualSaveId === worker.id;

            return (
              <div
                key={worker.id}
                className={[
                  'rounded-2xl border transition-all duration-150 overflow-hidden shadow-2xs',
                  isSelected
                    ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                ].join(' ')}
              >
                {/* Main Card Header */}
                <div className="p-3 flex items-center justify-between gap-2.5">
                  {/* Selection Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => handleToggleWorkerSelect(worker.id, e)}
                    className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none"
                    aria-label={`Select ${worker.employeeCode}`}
                  >
                    {isSelected ? (
                      <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square size={20} className="text-slate-400" />
                    )}
                  </button>

                  {/* Worker Avatar & Identifiers */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : worker.id)}
                    className="flex-1 min-w-0 flex items-center gap-2.5 cursor-pointer"
                  >
                    {/* <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 font-bold flex items-center justify-center text-[10px] tracking-tight flex-shrink-0 border border-blue-200 dark:border-blue-800 font-mono">
                      {worker.employeeCode || worker.callingName.charAt(0)}
                    </div> */}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {worker.employeeCode}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                          {worker.callingName}
                        </span>
                        {worker.isStandbyAssigned && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">
                            Standby
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-medium text-slate-600 dark:text-slate-300">{worker.tradeGroup}</span>
                        <span>·</span>
                        <span className="truncate">{worker.businessPartner}</span>
                      </div>
                    </div>
                  </div>

                  {/* Times & Status Badges */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : worker.id)}
                    className="flex items-center gap-2 flex-shrink-0 cursor-pointer text-right"
                  >
                    <div>
                      {worker.inTime ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          In: {worker.inTime}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          Pending In
                        </span>
                      )}

                      {/* Out Time only visible on OUT mode */}
                      {tabMode === 'out' && (
                        <div className="text-[10px] mt-0.5 text-slate-400">
                          {worker.outTime ? (
                            <span className="font-medium text-slate-700 dark:text-slate-300">Out: {worker.outTime}</span>
                          ) : (
                            <span>Pending Out</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Chevron Icon */}
                      {tabMode === 'out' && (
                      <div className="text-slate-400 pl-1">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact Activity Splits Preview (Only visible when on OUT mode and collapsed) */}
                {tabMode === 'out' && worker.activities.length > 0 && !isExpanded && (
                  <div className="px-3.5 pb-2.5 pt-0.5 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Activities:</span>
                    {worker.activities.map((act) => (
                      <span
                        key={act.id}
                        className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                      >
                        {act.activityCode}: {act.hours}h
                      </span>
                    ))}
                    {worker.shiftHours > 0 && (
                      <span className="text-[10px] font-bold ml-auto text-blue-700 dark:text-blue-300">
                        {worker.shiftHours}h Shift
                      </span>
                    )}
                  </div>
                )}

                {/* ── Accordion Expanded Content: Individual Worker Fine-Tuning ── */}
                {isExpanded && (
                  <div className="px-3.5 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
                    {/* Worker Identity Details */}
                    {/* <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block tracking-wider">
                          Full Name
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {worker.callingName}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-blue-700 dark:text-blue-400 block tracking-wider">
                          NIC · Trade
                        </span>
                        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                          {worker.nic} · {worker.tradeGroup}
                        </span>
                      </div>
                    </div> */}

                    {/* Individual In / Out Time Pickers */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                          In Time
                        </label>
                        <input
                          type="time"
                          value={worker.inTime}
                          onChange={(e) => handleIndividualTimeChange(worker.id, e.target.value, worker.outTime)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                          Out Time
                        </label>
                        <input
                          type="time"
                          value={worker.outTime}
                          onChange={(e) => handleIndividualTimeChange(worker.id, worker.inTime, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    {/* Master Activity Splits Section for single worker */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                          <Briefcase size={12} className="text-blue-600" />
                          Activity Code
                        </label>
                        <button
                          type="button"
                          onClick={() => handleAddIndividualActivitySplit(worker.id)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5"
                        >
                          <Plus size={13} /> Add Task
                        </button>
                      </div>

                      <div className="space-y-2">
                        {worker.activities.map((act) => (
                          <div
                            key={act.id}
                            className="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
                          >
                            <select
                              value={act.activityCode}
                              onChange={(e) => handleUpdateIndividualActivitySplit(worker.id, act.id, 'activityCode', e.target.value)}
                              className="flex-1 px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 font-medium focus:ring-2 focus:ring-blue-600"
                            >
                              {MASTER_ACTIVITIES.map((item) => (
                                <option key={item.code} value={item.code}>
                                  {item.code}
                                </option>
                              ))}
                            </select>

                            <div className="w-20">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="24"
                                value={act.hours}
                                onChange={(e) => handleUpdateIndividualActivitySplit(worker.id, act.id, 'hours', parseFloat(e.target.value) || 0)}
                                className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-bold text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-blue-600"
                              />
                            </div>

                            {worker.activities.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveIndividualActivitySplit(worker.id, act.id)}
                                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Discrepancy Notice */}
                      <div className="mt-2 flex items-center justify-between text-xs px-1">
                        <span className="text-slate-500 dark:text-slate-400">
                          Total: <strong className="text-slate-800 dark:text-slate-200">{activitySum.toFixed(1)}h</strong> / {worker.shiftHours.toFixed(1)}h
                        </span>
                        {hasDiscrepancy ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={13} /> Hours Discrepancy
                          </span>
                        ) : worker.shiftHours > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 size={13} /> Hours Balanced
                          </span>
                        ) : null}
                      </div>
                    </div>

                    {/* Individual Save Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => handleSaveIndividualDraft(worker.id)}
                        className={[
                          'w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs transition-colors shadow-xs',
                          isIndividualSaved
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900'
                        ].join(' ')}
                      >
                        {isIndividualSaved ? (
                          <>
                            <Check size={14} />
                            <span>Saved Successfully!</span>
                          </>
                        ) : (
                          <>
                            <Save size={14} />
                            <span>Save Worker Updates</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
