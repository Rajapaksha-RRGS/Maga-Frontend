import { useState, useMemo, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Briefcase, 
  Search, 
  X, 
  CheckSquare, 
  Square, 
  LogIn, 
  LogOut, 
  Clock,
  Lock,
  PauseCircle,
  UserX
} from 'lucide-react';
import { SearchableActivitySelect } from '../components/SearchableActivitySelect';
import { 
  supervisorStorage,
  type ActivityCodeItem,
  type LaborerEntry, 
  type ActivitySplit 
} from '../services/supervisorStorageService';
import {
  computeHours,
  formatHhmm,
  sumHhmm,
  hhmmToMinutes,
  minutesToHhmm
} from '../utils/timeUtils';

interface LaborEntryViewProps {
  laborers: LaborerEntry[];
  onSaveLaborers: (updated: LaborerEntry[]) => void;
  searchQuery?: string;
  statusFilter?: 'all' | 'pending' | 'done';
  isDayLocked?: boolean;
}

interface BatchActivityItem {
  id: string;
  activityCode: string;
  hours: number;
}

// Helper to get effective shift hours for a worker in current context
function getWorkerEffectiveShift(worker: LaborerEntry, referenceOutTime: string): { shift: number; ot: number; hasIn: boolean } {
  if (!worker.inTime) return { shift: 0, ot: 0, hasIn: false };
  const outTime = worker.outTime || referenceOutTime;
  const { shift, ot } = computeHours(worker.inTime, outTime);
  return { shift, ot, hasIn: true };
}

export function LaborEntryView({
  laborers,
  onSaveLaborers,
  searchQuery: externalSearchQuery = '',
  statusFilter: externalStatusFilter = 'all',
  isDayLocked = false,
}: LaborEntryViewProps) {
  // Mode: In Time or Out Time (matching hand-drawn sketch)
  const [tabMode, setTabMode] = useState<'in' | 'out'>('in');

  // Internal search and filters
  const [localSearch, setLocalSearch] = useState('');
  // Trade Group & Shift Filter states
  const [selectedTradeFilter, setSelectedTradeFilter] = useState<string>('all');
  const [selectedShiftFilter, setSelectedShiftFilter] = useState<string>('all');
  const [targetShiftHours, setTargetShiftHours] = useState<number>(8.0);
  const [showShiftMismatchModal, setShowShiftMismatchModal] = useState<boolean>(false);
  const [mismatchData, setMismatchData] = useState<{
    groups: Record<string, LaborerEntry[]>;
    targetSum: number;
  } | null>(null);

  // Selection state for batch actions
  const [selectedWorkerIds, setSelectedWorkerIds] = useState<string[]>([]);

  // Expanded card state for individual inspection
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Dynamic real activity codes from Backend
  const [activityOptions, setActivityOptions] = useState<ActivityCodeItem[]>([]);

  // Load real tenant activity codes on mount
  useEffect(() => {
    supervisorStorage.getActivityCodes().then((codes) => {
      if (Array.isArray(codes) && codes.length > 0) {
        setActivityOptions(codes);
        // Automatically set first real activity code for batch
        setBatchActivities((prev) => {
          if (prev.length === 0 || !prev[0].activityCode || !codes.some((c) => c.code === prev[0].activityCode)) {
            return [{ id: 'batch-act-1', activityCode: codes[0].code, hours: 8.0 }];
          }
          return prev;
        });
      }
    }).catch(() => {});
  }, []);

  // ── IN MODE BATCH STATE ──
  const [batchInTime, setBatchInTime] = useState('07:00');

  // ── OUT MODE BATCH STATE ──
  const [batchOutTime, setBatchOutTime] = useState('17:00');
  const [batchActivities, setBatchActivities] = useState<BatchActivityItem[]>([
    { id: 'batch-act-1', activityCode: '', hours: 8.0 }
  ]);

  // Derived unique shift hours for Shift Hours filter chips
  const shiftGroupStats = useMemo(() => {
    const counts: Record<string, number> = {};
    laborers.forEach((l) => {
      const info = getWorkerEffectiveShift(l, batchOutTime);
      const key = !info.hasIn ? 'pending_in' : `${formatHhmm(info.shift)}h`;
      counts[key] = (counts[key] || 0) + 1;
    });

    // Sort: highest hours first, pending_in at the end
    const keys = Object.keys(counts).sort((a, b) => {
      if (a === 'pending_in') return 1;
      if (b === 'pending_in') return -1;
      return parseFloat(b) - parseFloat(a);
    });

    return { counts, keys };
  }, [laborers, batchOutTime]);

  // Derived unique Trade Groups for Trade filter chips
  const tradeGroupStats = useMemo(() => {
    const counts: Record<string, number> = {};
    laborers.forEach((l) => {
      const trade = l.tradeGroup || 'General labour';
      counts[trade] = (counts[trade] || 0) + 1;
    });

    const keys = Object.keys(counts).sort((a, b) => a.localeCompare(b));
    return { counts, keys };
  }, [laborers]);

  // Combined search query (external + local)
  const effectiveSearch = localSearch || externalSearchQuery;
  const effectiveStatus = externalStatusFilter;

  // Filtered workers
  const filteredLaborers = useMemo(() => {
    return laborers.filter((l) => {
      const search = effectiveSearch.toLowerCase().trim();
      const matchesSearch = 
        !search ||
        (l.employeeCode && l.employeeCode.toLowerCase().includes(search)) ||
        (l.fullName && l.fullName.toLowerCase().includes(search)) ||
        l.callingName.toLowerCase().includes(search) ||
        l.tradeGroup.toLowerCase().includes(search) ||
        (l.nic && l.nic.toLowerCase().includes(search)) ||
        l.businessPartner.toLowerCase().includes(search);

      if (!matchesSearch) return false;

      // Trade Group filter
      if (selectedTradeFilter !== 'all' && (l.tradeGroup || 'General labour') !== selectedTradeFilter) {
        return false;
      }

      // Shift Hours filter
      if (selectedShiftFilter !== 'all') {
        const info = getWorkerEffectiveShift(l, batchOutTime);
        const key = !info.hasIn ? 'pending_in' : `${formatHhmm(info.shift)}h`;
        if (key !== selectedShiftFilter) {
          return false;
        }
      }

      // Status filter
      if (effectiveStatus === 'pending') {
        return !l.inTime || !l.outTime || l.activities.length === 0;
      }
      if (effectiveStatus === 'done') {
        return !!(l.inTime && l.outTime && l.activities.length > 0);
      }

      return true;
    }).sort((a, b) => {
      const nameCompare = (a.callingName || '').localeCompare(b.callingName || '', undefined, { numeric: true, sensitivity: 'base' });
      if (nameCompare !== 0) return nameCompare;
      const fullCompare = (a.fullName || '').localeCompare(b.fullName || '', undefined, { numeric: true, sensitivity: 'base' });
      if (fullCompare !== 0) return fullCompare;
      return (a.employeeCode || '').localeCompare(b.employeeCode || '', undefined, { numeric: true, sensitivity: 'base' });
    });
  }, [laborers, effectiveSearch, selectedTradeFilter, selectedShiftFilter, batchOutTime, effectiveStatus]);

  // Stats
  const inMarkedCount = laborers.filter((l) => !!l.inTime).length;
  const outMarkedCount = laborers.filter((l) => !!l.outTime).length;

  // Only the selected worker IDs that are currently visible/filtered
  const selectedFilteredWorkerIds = useMemo(() => {
    return filteredLaborers.filter((l) => selectedWorkerIds.includes(l.id)).map((l) => l.id);
  }, [filteredLaborers, selectedWorkerIds]);

  const selectedFilteredCount = selectedFilteredWorkerIds.length;

  // Selection handlers
  const handleToggleSelectAll = () => {
    const currentFilteredIds = filteredLaborers.map((l) => l.id);
    if (currentFilteredIds.length === 0) return;

    const allSelected = currentFilteredIds.every((id) => selectedWorkerIds.includes(id));

    if (allSelected) {
      // Deselect all currently filtered workers
      setSelectedWorkerIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      // Select ONLY the currently visible filtered workers!
      // This strictly isolates the selection to the active filtered chip/view.
      setSelectedWorkerIds(currentFilteredIds);
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
    const targetIds = selectedFilteredWorkerIds;
    if (targetIds.length === 0) return;

    const updated = laborers.map((l) => {
      if (!targetIds.includes(l.id)) return l;
      const inTime = batchInTime;
      const outTime = l.outTime;
      const { shift, ot } = computeHours(inTime, outTime);

      const isComplete = inTime && outTime && l.activities.length > 0;
      return {
        ...l,
        inTime,
        shiftHours: shift,
        otHours: ot,
        isAbsent: false,
        status: (isComplete ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
        lastSavedAt: `In: ${batchInTime}`,
      };
    });

    onSaveLaborers(updated);
    // Automatically clear worker selection after applying
    setSelectedWorkerIds([]);
  };

  // ── DYNAMIC OUT-TIME CHANGE HANDLER ──
  const handleBatchOutTimeChange = (newOutTime: string) => {
    setBatchOutTime(newOutTime);
    // Compute effective shift for active/sample workers with this new out-time
    const sampleWorker = laborers.find((l) => selectedWorkerIds.includes(l.id) && l.inTime) ||
      laborers.find((l) => l.inTime) ||
      { inTime: batchInTime || '07:00' };
    const inTime = sampleWorker.inTime || '07:00';
    const { shift } = computeHours(inTime, newOutTime);
    if (shift > 0) {
      setTargetShiftHours(shift);
      setBatchActivities((prev) => {
        if (prev.length <= 1) {
          return [{
            id: 'batch-act-1',
            activityCode: prev[0]?.activityCode || activityOptions[0]?.code || '',
            hours: shift,
          }];
        } else {
          const sum = prev.reduce((acc, a) => acc + (a.hours || 0), 0);
          if (sum > 0) {
            let allocated = 0;
            return prev.map((a, idx) => {
              if (idx === prev.length - 1) {
                return { ...a, hours: parseFloat(Math.max(0.5, shift - allocated).toFixed(1)) };
              }
              const share = parseFloat(((a.hours / sum) * shift).toFixed(1));
              allocated += share;
              return { ...a, hours: share };
            });
          }
          return prev;
        }
      });
    }
  };

  // ── SHIFT FILTER SELECTOR (DYNAMIC TARGET HOURS & AUTO-SELECT COHORT) ──
  const handleSelectShiftFilter = (shiftKey: string) => {
    setSelectedShiftFilter(shiftKey);

    if (shiftKey === 'all') {
      // Clear selection so supervisor can choose cleanly in All view
      setSelectedWorkerIds([]);
    } else {
      // Auto-select all workers belonging to this specific shift cohort!
      const matchingCohortIds = laborers.filter((l) => {
        const info = getWorkerEffectiveShift(l, batchOutTime);
        const key = !info.hasIn ? 'pending_in' : `${formatHhmm(info.shift)}h`;
        return key === shiftKey;
      }).map((l) => l.id);

      setSelectedWorkerIds(matchingCohortIds);
    }

    if (shiftKey !== 'all' && shiftKey !== 'pending_in') {
      const hours = parseFloat(shiftKey.replace('h', ''));
      if (!isNaN(hours) && hours > 0) {
        setTargetShiftHours(hours);
        // Automatically adjust batch activities to match target
        setBatchActivities((prev) => {
          if (prev.length <= 1) {
            return [{
              id: 'batch-act-1',
              activityCode: prev[0]?.activityCode || activityOptions[0]?.code || '',
              hours,
            }];
          } else {
            // Multiple activities: scale proportionally
            const sum = prev.reduce((acc, a) => acc + (a.hours || 0), 0);
            if (sum > 0) {
              let allocated = 0;
              return prev.map((a, idx) => {
                if (idx === prev.length - 1) {
                  return { ...a, hours: parseFloat(Math.max(0.5, hours - allocated).toFixed(1)) };
                }
                const share = parseFloat(((a.hours / sum) * hours).toFixed(1));
                allocated += share;
                return { ...a, hours: share };
              });
            }
            return prev;
          }
        });
      }
    }
  };

  // ── BATCH ACTIVITY ROW HANDLERS (SMART AUTO-BALANCING) ──
  const handleAddBatchActivityRow = () => {
    const currentSum = batchActivities.reduce((acc, a) => acc + (a.hours || 0), 0);

    // Case 1: Only 1 activity exists and its hours equal targetShiftHours (unmodified)
    // -> Split evenly! (e.g. 8.00h -> 4.00h & 4.00h, or 12.50h -> 6.25h & 6.25h)
    if (batchActivities.length === 1 && Math.abs(hhmmToMinutes(batchActivities[0].hours) - hhmmToMinutes(targetShiftHours)) < 1) {
      const halfMins = Math.round(hhmmToMinutes(targetShiftHours) / 2);
      const half = minutesToHhmm(halfMins);
      const secondHalf = minutesToHhmm(hhmmToMinutes(targetShiftHours) - halfMins);

      const updatedFirst = { ...batchActivities[0], hours: half };
      const newRow: BatchActivityItem = {
        id: `batch-act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
        activityCode: (activityOptions[1 % activityOptions.length] || activityOptions[0]).code,
        hours: secondHalf,
      };
      setBatchActivities([updatedFirst, newRow]);
      return;
    }

    // Case 2: Top activity or existing activities were edited and sum < targetShiftHours
    // -> Auto-fill the remaining hours! (e.g. 12.50 - 8.00 = 4.50h)
    let fillHours = 4.0;
    const diffMins = hhmmToMinutes(targetShiftHours) - hhmmToMinutes(currentSum);
    if (diffMins > 0) {
      fillHours = minutesToHhmm(diffMins);
    } else {
      fillHours = 1.0;
    }

    const nextActivity = (activityOptions[batchActivities.length % activityOptions.length] || activityOptions[0]).code;
    const newRow: BatchActivityItem = {
      id: `batch-act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      activityCode: nextActivity,
      hours: Math.max(0.5, fillHours),
    };
    setBatchActivities((prev) => [...prev, newRow]);
  };

  const handleUpdateBatchActivityRow = (id: string, field: 'activityCode' | 'hours', value: any) => {
    setBatchActivities((prev) => 
      prev.map((a) => (a.id === id ? { ...a, [field]: value } : a))
    );
  };

  const handleRemoveBatchActivityRow = (id: string) => {
    if (batchActivities.length <= 1) {
      setBatchActivities([{ id: 'batch-act-1', activityCode: '', hours: 0 }]);
      return;
    }
    setBatchActivities((prev) => prev.filter((a) => a.id !== id));
  };

  // Clear all activities for currently selected workers in bulk
  const handleBatchClearActivities = () => {
    const targetIds = selectedFilteredWorkerIds;
    if (targetIds.length === 0) return;

    const updated = laborers.map((l) => {
      if (!targetIds.includes(l.id)) return l;
      return {
        ...l,
        activities: [],
        status: 'draft' as const,
      };
    });
    onSaveLaborers(updated);
  };

  // ── APPLY BATCH OUT TIME & ACTIVITIES (WITH MISMATCH VALIDATION) ──
  const handleApplyBatchOut = () => {
    const targetIds = selectedFilteredWorkerIds;
    if (targetIds.length === 0) return;

    const selectedWorkers = laborers.filter((l) => targetIds.includes(l.id));

    // Group selected workers by effective shift hours
    const selectedShiftGroups: Record<string, LaborerEntry[]> = {};
    selectedWorkers.forEach((w) => {
      const info = getWorkerEffectiveShift(w, batchOutTime);
      const key = !info.hasIn ? 'pending_in' : `${formatHhmm(info.shift)}h`;
      if (!selectedShiftGroups[key]) selectedShiftGroups[key] = [];
      selectedShiftGroups[key].push(w);
    });

    const distinctShiftKeys = Object.keys(selectedShiftGroups);

    // If supervisor selected workers with DIFFERENT shift hours -> Show Error Modal!
    if (distinctShiftKeys.length > 1) {
      const currentBatchSum = sumHhmm(batchActivities.map((a) => a.hours));
      setMismatchData({
        groups: selectedShiftGroups,
        targetSum: currentBatchSum,
      });
      setShowShiftMismatchModal(true);
      return;
    }

    const updated = laborers.map((l) => {
      if (!targetIds.includes(l.id)) return l;
      const inTime = l.inTime || '07:00'; // Fallback if In wasn't marked
      const outTime = batchOutTime;
      const { shift, ot } = computeHours(inTime, outTime);

      // Map batch activities to laborer splits (only valid activity codes)
      const newSplits: ActivitySplit[] = batchActivities
        .filter((ba) => ba.activityCode && ba.activityCode.trim() !== '')
        .map((ba) => ({
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
    // Automatically clear worker selection after applying
    setSelectedWorkerIds([]);
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
        isAbsent: inTime ? false : l.isAbsent,
        status: 'draft' as const, // Always keep as draft while editing until explicitly marked Done
        lastSavedAt: `Draft: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      };
    });
    onSaveLaborers(updated);
  };

  const handleToggleAbsent = (id: string) => {
    const updated = laborers.map((l) => {
      if (l.id !== id) return l;
      const willBeAbsent = !l.isAbsent;
      return {
        ...l,
        isAbsent: willBeAbsent,
        inTime: willBeAbsent ? '' : l.inTime,
        outTime: willBeAbsent ? '' : l.outTime,
        shiftHours: willBeAbsent ? 0 : l.shiftHours,
        otHours: willBeAbsent ? 0 : l.otHours,
        activities: willBeAbsent ? [] : l.activities,
        status: (willBeAbsent ? 'draft' : l.status) as 'draft' | 'pending' | 'done',
      };
    });
    onSaveLaborers(updated);
  };

  const handleMarkIndividualDone = (id: string) => {
    const updated = laborers.map((l) => {
      if (l.id !== id) return l;
      const inTime = l.inTime || batchInTime || '07:00';
      const outTime = l.outTime || batchOutTime || '17:00';
      const { shift, ot } = computeHours(inTime, outTime);

      return {
        ...l,
        inTime,
        outTime,
        shiftHours: shift,
        otHours: ot,
        activities: l.activities || [],
        isAbsent: false,
        status: 'done' as const,
        lastSavedAt: `Done at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      };
    });
    onSaveLaborers(updated);
    setExpandedId(null);
  };

  const handleToggleIndividualDone = (id: string) => {
    const laborer = laborers.find((l) => l.id === id);
    if (!laborer) return;

    if (laborer.status === 'done') {
      const updated = laborers.map((l) => 
        l.id === id ? { ...l, status: 'draft' as const, lastSavedAt: 'Reverted to Draft' } : l
      );
      onSaveLaborers(updated);
    } else {
      handleMarkIndividualDone(id);
    }
  };

  // Reset selected workers to draft status (removes green Done border)
  const handleBatchResetToDraft = () => {
    const targetIds = selectedFilteredWorkerIds;
    if (targetIds.length === 0) return;

    const updated = laborers.map((l) => {
      if (!targetIds.includes(l.id)) return l;
      return {
        ...l,
        status: 'draft' as const,
        lastSavedAt: 'Reset to Draft',
      };
    });
    onSaveLaborers(updated);
  };

  const handleAddIndividualActivitySplit = (laborerId: string) => {
    const laborer = laborers.find((l) => l.id === laborerId);
    if (!laborer) return;

    const allocatedSum = sumHhmm(laborer.activities.map((a) => a.hours));
    const remainingMins = Math.max(0, hhmmToMinutes(laborer.shiftHours) - hhmmToMinutes(allocatedSum));
    const remaining = minutesToHhmm(remainingMins);

    const newSplit: ActivitySplit = {
      id: `split-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      activityCode: activityOptions[0]?.code || '',
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
      if (l.id !== laborerId) return l;
      const activities = l.activities.filter((a) => a.id !== splitId);
      return { 
        ...l, 
        activities, 
        status: 'draft' as const,
      };
    });
    onSaveLaborers(updated);
  };

  const handleClearAllActivities = (laborerId: string) => {
    const updated = laborers.map((l) => {
      if (l.id !== laborerId) return l;
      return {
        ...l,
        activities: [],
        status: 'draft' as const,
      };
    });
    onSaveLaborers(updated);
  };

  const isAllFilteredSelected = 
    filteredLaborers.length > 0 && 
    filteredLaborers.every((l) => selectedWorkerIds.includes(l.id));

  return (
    <div className="space-y-3 pb-16 animate-in fade-in duration-150">
      {/* ── Day Locked Alert Banner (Read-Only) ── */}
      {isDayLocked && (
        <div className="bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-3.5 shadow-xs flex items-center gap-3 animate-in fade-in">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
            <Lock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Shift Roster Locked & Submitted
              </h4>
              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-200 font-mono">
                Read-Only
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 dark:text-emerald-400 mt-0.5 leading-snug">
              Submitted for Admin Approval. Record modifications are locked unless returned by Admin.
            </p>
          </div>
        </div>
      )}

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

      {/* ── 4. Shift Hours & Status Filter Chips (Under Search Bar) ────────────── */}
       <div className="py-2 px-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
        {/* Shift Hours Chips */}
        <div>
          <div className="flex items-center justify-between mb-1 px-0.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock size={12} className="text-blue-600 dark:text-blue-400" />
              Filter by Shift Hours:
            </span>
            <span className="text-[10px] text-slate-500 font-medium">
              Target: <strong className="text-blue-700 dark:text-blue-400 font-mono">{formatHhmm(targetShiftHours)}h</strong>
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs"> 
            <button
              type="button"
              onClick={() => handleSelectShiftFilter('all')}
              className={[
                'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
                selectedShiftFilter === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
              ].join(' ')}
            >
              All Shifts ({laborers.length})
            </button>
            {shiftGroupStats.keys.map((key) => {
              const count = shiftGroupStats.counts[key];
              const isSelected = selectedShiftFilter === key;
              const label = key === 'pending_in' ? 'Pending In' : `${key} Shift`;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectShiftFilter(key)}
                  className={[
                    'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 font-mono cursor-pointer',
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                  ].join(' ')}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Trade Group Filter Chips (Replaces Shift Status) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-0.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Users size={12} className="text-blue-600 dark:text-blue-400" />
              Filter by Trade:
            </span>
            {selectedTradeFilter !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedTradeFilter('all')}
                className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold cursor-pointer"
              >
                Clear Filter
              </button>
            )}
          </div>

         <div className="flex items-center gap-2 overflow-x-auto pb-2 text-xs">
            <button
              type="button"
              onClick={() => setSelectedTradeFilter('all')}
              className={[
                'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
                selectedTradeFilter === 'all'
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs font-bold'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
              ].join(' ')}
            >
              All Trades ({laborers.length})
            </button>
            {tradeGroupStats.keys.map((trade) => {
              const count = tradeGroupStats.counts[trade];
              const isSelected = selectedTradeFilter === trade;
              return (
                <button
                  key={trade}
                  type="button"
                  onClick={() => setSelectedTradeFilter(trade)}
                  className={[
                    'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
                    isSelected
                      ? 'bg-blue-600 text-white shadow-xs font-bold'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                  ].join(' ')}
                >
                  {trade} ({count})
                </button>
              );
            })}
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
              className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:underline cursor-pointer"
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
              disabled={isDayLocked || selectedFilteredCount === 0}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
            >
              <Check size={14} />
              <span>Apply In-Time to {selectedFilteredCount} Workers</span>
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
              </div>
            </div>

            {/* Out Time Picker */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2.5 py-1.5 rounded-xl border border-blue-300 dark:border-blue-700 shadow-2xs">
              <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase">Out:</span>
              <input
                type="time"
                value={batchOutTime}
                onChange={(e) => handleBatchOutTimeChange(e.target.value)}
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
                <span className="text-[10px] text-slate-500 font-normal ml-1">
                  (Target: <strong className="text-blue-700 dark:text-blue-300 font-mono">{formatHhmm(targetShiftHours)}h</strong>)
                </span>
              </span>
              <button
                type="button"
                onClick={handleAddBatchActivityRow}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold flex items-center gap-0.5 cursor-pointer"
              >
                <Plus size={13} /> Add Activity
              </button>
            </div>

            {batchActivities.map((row) => (
              <div key={row.id} className="flex items-center gap-1.5 w-full">
                <SearchableActivitySelect
                  value={row.activityCode}
                  onChange={(code) => handleUpdateBatchActivityRow(row.id, 'activityCode', code)}
                  options={activityOptions}
                  placeholder="Search activity code..."
                />

                <div className="w-16 flex-shrink-0">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={row.hours}
                    onChange={(e) => handleUpdateBatchActivityRow(row.id, 'hours', parseFloat(e.target.value) || 0)}
                    placeholder="Hrs"
                    className="w-full px-1.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-center text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveBatchActivityRow(row.id)}
                  title={batchActivities.length > 1 ? "Remove activity row" : "Clear activity code"}
                  className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}

            {/* Live Hours Balance Indicator */}
            {(() => {
              const currentSum = sumHhmm(batchActivities.map((b) => b.hours));
              const diffMinutes = hhmmToMinutes(currentSum) - hhmmToMinutes(targetShiftHours);
              const isBalanced = Math.abs(diffMinutes) < 1;
              const diffHhmm = minutesToHhmm(Math.abs(diffMinutes));

              return (
                <div className="flex items-center justify-between text-[11px] px-1 pt-1.5 border-t border-slate-200/60 dark:border-slate-800">
                  <span className="text-slate-600 dark:text-slate-400">
                    Allocated: <strong className={isBalanced ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-amber-700 dark:text-amber-300 font-bold'}>{formatHhmm(currentSum)}h</strong> / {formatHhmm(targetShiftHours)}h Target
                  </span>
                  {isBalanced ? (
                    <span className="text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-1 text-[10px]">
                      <CheckCircle2 size={12} /> Balanced
                    </span>
                  ) : diffMinutes < 0 ? (
                    <span className="text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1 text-[10px]">
                      <PauseCircle size={12} className="text-amber-600" /> Auto-Idle (ZIDLE): {formatHhmm(diffHhmm)}h
                    </span>
                  ) : (
                    <span className="text-red-600 dark:text-red-400 font-semibold flex items-center gap-1 text-[10px]">
                      <AlertTriangle size={12} /> +{formatHhmm(diffHhmm)}h Excess
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Selection Controls & Apply Button */}
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-blue-200/60 dark:border-blue-800/60 flex-wrap">
            <button
              type="button"
              onClick={handleToggleSelectAll}
              className="flex items-center gap-1.5 text-xs font-semibold text-blue-800 dark:text-blue-300 hover:underline cursor-pointer"
            >
              {isAllFilteredSelected ? (
                <CheckSquare size={16} className="text-blue-600" />
              ) : (
                <Square size={16} className="text-blue-600" />
              )}
              <span>{isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredLaborers.length})`}</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchResetToDraft}
                disabled={isDayLocked || selectedFilteredCount === 0}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 hover:bg-slate-100 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40"
                title="Mark selected workers as Draft (removes green Done border)"
              >
                <Clock size={13} />
                <span>Mark Draft</span>
              </button>

              <button
                type="button"
                onClick={handleBatchClearActivities}
                disabled={isDayLocked || selectedFilteredCount === 0}
                className="flex items-center gap-1.5 py-2 px-3 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors cursor-pointer disabled:opacity-40"
                title="Clear all activities for selected workers"
              >
                <Trash2 size={13} />
                <span>Clear Activities</span>
              </button>

              <button
                type="button"
                onClick={handleApplyBatchOut}
                disabled={isDayLocked || selectedFilteredCount === 0}
                className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
              >
                <Check size={14} />
                <span>Apply to {selectedFilteredCount} Workers</span>
              </button>
            </div>
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
            const isExpanded = expandedId === worker.id;
            const isDone = tabMode === 'out' && 
              !worker.isAbsent && 
              Boolean(worker.inTime) && 
              Boolean(worker.outTime) && 
              worker.status === 'done';
            const activitySum = sumHhmm(worker.activities.map((a) => a.hours));
            void activitySum; // consumed if needed

            return (
              <div
                key={worker.id}
                className={[
                  'rounded-2xl border transition-all duration-150 overflow-hidden shadow-2xs',
                  isSelected
                    ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : worker.isAbsent
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/25 dark:bg-rose-950/20'
                    : isDone
                    ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/15 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                          {worker.callingName}
                        </span>
                        {worker.fullName && worker.fullName.trim() !== worker.callingName.trim() && (
                          <span className="text-xs text-slate-600 dark:text-slate-300 font-medium truncate">
                            · {worker.fullName}
                          </span>
                        )}
                        {worker.isStandbyAssigned && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">
                            Standby
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                          {worker.employeeCode}
                        </span>
                        <span>·</span>
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {worker.tradeGroup}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Times & Direct Controls */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : worker.id)}
                    className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer text-right"
                  >
                    {tabMode === 'in' ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        {worker.isAbsent ? (
                          <div className="flex items-center gap-1">
                            <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-lg flex items-center gap-1">
                              <UserX size={11} className="text-rose-600" />
                              Absent
                            </span>
                            {!isDayLocked && (
                              <button
                                type="button"
                                onClick={() => handleToggleAbsent(worker.id)}
                                className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                                title="Unmark Absent (Make Pending)"
                              >
                                <X size={13} />
                              </button>
                            )}
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <input
                                type="time"
                                disabled={isDayLocked}
                                value={worker.inTime || ''}
                                onChange={(e) => handleIndividualTimeChange(worker.id, e.target.value, worker.outTime)}
                                className={[
                                  'w-[80px] text-xs font-bold rounded-lg px-1.5 py-1 border transition-all text-center focus:outline-none focus:ring-2 cursor-pointer',
                                  worker.inTime
                                    ? 'text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 focus:ring-emerald-500'
                                    : 'text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/80 border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-400 focus:ring-blue-500'
                                ].join(' ')}
                                title={worker.inTime ? 'Edit In-Time' : 'Choose custom In-Time'}
                              />
                            </div>

                            {!worker.inTime ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isDayLocked}
                                  onClick={() => handleIndividualTimeChange(worker.id, batchInTime, worker.outTime)}
                                  className="flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-40 px-2 py-1 rounded-lg shadow-2xs transition-all cursor-pointer"
                                  title={`Quick In at ${batchInTime}`}
                                >
                                  <LogIn size={11} />
                                  <span>In</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isDayLocked}
                                  onClick={() => handleToggleAbsent(worker.id)}
                                  className="flex items-center gap-0.5 text-[10px] font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 bg-slate-100 hover:bg-rose-50 dark:bg-slate-800 dark:hover:bg-rose-950/50 border border-slate-200 dark:border-slate-700 hover:border-rose-300 px-1.5 py-1 rounded-lg transition-colors cursor-pointer"
                                  title="Mark as Absent"
                                >
                                  <UserX size={11} />
                                  <span>Abs</span>
                                </button>
                              </div>
                            ) : (
                              !isDayLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleIndividualTimeChange(worker.id, '', worker.outTime)}
                                  className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-md transition-colors cursor-pointer"
                                  title="Clear In-Time"
                                >
                                  <X size={13} />
                                </button>
                              )
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div>
                          {worker.isAbsent ? (
                            <span className="text-[10px] text-rose-600 dark:text-rose-400 font-semibold bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-800 flex items-center gap-0.5">
                              <UserX size={10} />
                              Absent
                            </span>
                          ) : isDone ? (
                            <button
                              type="button"
                              disabled={isDayLocked}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleToggleIndividualDone(worker.id);
                              }}
                              className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700 shadow-2xs transition-colors cursor-pointer"
                              title="Click to revert back to Draft"
                            >
                              <Check size={11} className="stroke-[3]" /> Done
                            </button>
                          ) : worker.inTime ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                              In: {worker.inTime}
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                              Pending In
                            </span>
                          )}

                          <div className="text-[10px] mt-0.5 text-slate-400">
                            {worker.isAbsent ? null : worker.outTime ? (
                              <span className="font-medium text-slate-700 dark:text-slate-300">Out: {worker.outTime}</span>
                            ) : (
                              <span>Pending Out</span>
                            )}
                          </div>
                        </div>

                        {/* Quick Done button in header if not already done and not absent */}
                        {!isDayLocked && !worker.isAbsent && !isDone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleMarkIndividualDone(worker.id);
                            }}
                            className="flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-2 py-1 rounded-lg shadow-2xs transition-all cursor-pointer"
                            title="Quick mark Done"
                          >
                            <Check size={11} className="stroke-[3]" />
                            <span>Done</span>
                          </button>
                        )}
                      </div>
                    )}

                    {/* Chevron Icon */}
                    <div className="text-slate-400 pl-0.5">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>
                </div>

                {/* Compact Activity Splits / Auto-Idle Preview (Only visible when on OUT mode and collapsed) */}
                {tabMode === 'out' && !isExpanded && (worker.activities.length > 0 || (worker.inTime && worker.outTime)) && (
                  <div className="px-3.5 pb-2.5 pt-0.5 flex items-center gap-1.5 flex-wrap">
                    {worker.activities.length > 0 ? (
                      <>
                        <span className="text-[10px] uppercase font-bold text-slate-400">Activities:</span>
                        {worker.activities.map((act) => (
                          <span
                            key={act.id}
                            className="group text-[10px] font-semibold pl-2 pr-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1"
                          >
                            <span>{act.activityCode}: {act.hours}h</span>
                            {!isDayLocked && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveIndividualActivitySplit(worker.id, act.id);
                                }}
                                className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50 cursor-pointer"
                                title={`Delete ${act.activityCode}`}
                              >
                                <X size={10} />
                              </button>
                            )}
                          </span>
                        ))}
                        {!isDayLocked && worker.activities.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleClearAllActivities(worker.id);
                            }}
                            className="text-[10px] text-red-500 hover:underline font-semibold ml-1 cursor-pointer"
                          >
                            Clear All
                          </button>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                        <PauseCircle size={11} className="text-amber-600" />
                        <span>Auto-Idle (ZIDLE): {formatHhmm(worker.shiftHours)}h</span>
                      </span>
                    )}
                    {worker.shiftHours > 0 && (
                      <span className="text-[10px] font-bold ml-auto text-blue-700 dark:text-blue-300">
                        {formatHhmm(worker.shiftHours)}h Shift
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
                          disabled={isDayLocked}
                          value={worker.inTime}
                          onChange={(e) => handleIndividualTimeChange(worker.id, e.target.value, worker.outTime)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                          Out Time
                        </label>
                        <input
                          type="time"
                          disabled={isDayLocked}
                          value={worker.outTime}
                          onChange={(e) => handleIndividualTimeChange(worker.id, worker.inTime, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
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
                        {!isDayLocked && (
                          <div className="flex items-center gap-2">
                            {worker.activities.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleClearAllActivities(worker.id)}
                                className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:underline font-semibold cursor-pointer"
                              >
                                Clear All
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleAddIndividualActivitySplit(worker.id)}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus size={13} /> Add Task
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        {worker.activities.length === 0 ? (
                          <div className="p-3 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-xs text-slate-400">
                            No activities assigned. Tap "+ Add Task" to allocate hours.
                          </div>
                        ) : (
                          worker.activities.map((act) => (
                            <div
                              key={act.id}
                              className="flex items-center gap-1.5 p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 w-full"
                            >
                              <SearchableActivitySelect
                                disabled={isDayLocked}
                                value={act.activityCode}
                                onChange={(code) => handleUpdateIndividualActivitySplit(worker.id, act.id, 'activityCode', code)}
                                options={activityOptions}
                                placeholder="Select activity code..."
                              />

                              <div className="w-16 flex-shrink-0">
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="24"
                                  disabled={isDayLocked}
                                  value={act.hours}
                                  onChange={(e) => handleUpdateIndividualActivitySplit(worker.id, act.id, 'hours', parseFloat(e.target.value) || 0)}
                                  className="w-full px-1.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-800 dark:text-slate-100 text-center focus:ring-2 focus:ring-blue-600"
                                />
                              </div>

                              {!isDayLocked && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveIndividualActivitySplit(worker.id, act.id)}
                                  className="w-7 h-7 flex-shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer transition-colors"
                                  title="Delete activity"
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          ))
                        )}
                      </div>

                      {/* Discrepancy Notice & ZIDLE Auto-Balance */}
                      <div className="mt-2 flex items-center justify-between text-xs px-1">
                        <span className="text-slate-500 dark:text-slate-400">
                          Total: <strong className="text-slate-800 dark:text-slate-200">{formatHhmm(activitySum)}h</strong> / {formatHhmm(worker.shiftHours)}h
                        </span>
                        {(() => {
                          const diffMinutes = hhmmToMinutes(worker.shiftHours) - hhmmToMinutes(activitySum);
                          if (diffMinutes > 0) {
                            const idleHhmm = minutesToHhmm(diffMinutes);
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                                <PauseCircle size={12} className="text-amber-600" />
                                <span>Auto-Idle (ZIDLE): {formatHhmm(idleHhmm)}h</span>
                              </span>
                            );
                          } else if (diffMinutes < 0) {
                            const excessHhmm = minutesToHhmm(Math.abs(diffMinutes));
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400">
                                <AlertTriangle size={13} /> +{formatHhmm(excessHhmm)}h Excess
                              </span>
                            );
                          } else if (worker.shiftHours > 0) {
                            return (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <CheckCircle2 size={13} /> Hours Balanced
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>
                    </div>

                    {/* ── Auto-save Status & Mark as Done button ── */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px]">
                        <Check size={13} className="text-emerald-500" />
                        <span>Auto-saved</span>
                      </span>
                      {!isDayLocked && (
                        <button
                          type="button"
                          onClick={() => handleToggleIndividualDone(worker.id)}
                          className={[
                            'flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer',
                            isDone
                              ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white active:scale-95'
                          ].join(' ')}
                          title={isDone ? 'Click to revert card back to Draft' : 'Save and mark card as completed'}
                        >
                          <CheckCircle2 size={14} />
                          <span>{isDone ? 'Revert to Draft' : 'Done'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── 7. Shift Hours Mismatch Error Modal (Popup) ── */}
      {showShiftMismatchModal && mismatchData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-amber-200 dark:border-amber-800 space-y-4 animate-in zoom-in-95 duration-150">
            {/* Header with AlertTriangle */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Shift Hours Mismatch
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                  Cannot apply uniform activity hours to workers with different shift hours.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowShiftMismatchModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                <X size={16} />
              </button>
            </div>

            {/* Shift Breakdown List */}
            <div className="bg-slate-50 dark:bg-slate-900/80 p-3 rounded-xl border border-slate-200 dark:border-slate-700/80 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Selected Workers Breakdown:
              </span>
              <div className="space-y-1.5">
                {Object.entries(mismatchData.groups).map(([shiftKey, workers]) => (
                  <div 
                    key={shiftKey} 
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200/60 dark:border-slate-700"
                  >
                    <div className="flex items-center gap-1.5 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">
                        {shiftKey === 'pending_in' ? 'Pending In' : `${shiftKey} Shift`}
                      </span>
                      <span className="text-slate-400 text-[11px]">({workers.length} workers)</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const groupIds = workers.map((w) => w.id);
                        setSelectedWorkerIds(groupIds);
                        handleSelectShiftFilter(shiftKey);
                        setShowShiftMismatchModal(false);
                      }}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors"
                    >
                      Select {workers.length} only
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              💡 Click <strong>"Select only"</strong> above or use <strong>Filter by Shift Hours</strong> to assign activities to workers with matching hours.
            </p>

            <button
              type="button"
              onClick={() => setShowShiftMismatchModal(false)}
              className="w-full py-2.5 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              Close & Adjust Selection
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
