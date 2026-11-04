import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import * as assignmentService from '../../assignments/services/assignmentService';
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
  UserX,
  RotateCcw
} from 'lucide-react';
import { SearchableActivitySelect } from '../components/SearchableActivitySelect';
import { SiteLaborPoolModal } from '../components/SiteLaborPoolModal';
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
  selectedDate?: string;
  projectId?: string;
  supervisorId?: string;
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
  selectedDate = '',
  projectId,
  supervisorId: propSupervisorId,
}: LaborEntryViewProps) {
  const { user } = useAuth();
  const effectiveSupervisorId = propSupervisorId || user?.id || '';
  const [isLaborPoolModalOpen, setIsLaborPoolModalOpen] = useState(false);
  const [isPoolMode, setIsPoolMode] = useState(false);

  useEffect(() => {
    supervisorStorage.isEquipmentPoolModeEnabled(projectId)
      .then(setIsPoolMode)
      .catch(() => setIsPoolMode(false));
  }, [projectId]);

  const handleAddLaborersFromPool = async (newLaborers: LaborerEntry[]) => {
    const existingIds = new Set(laborers.map((l) => l.id));
    const toAdd = newLaborers.filter((nl) => !existingIds.has(nl.id));
    if (toAdd.length > 0) {
      const updated = [...laborers, ...toAdd];
      onSaveLaborers(updated);

      // Real-time backend assignment
      if (selectedDate && effectiveSupervisorId) {
        try {
          await assignmentService.assign(
            selectedDate,
            effectiveSupervisorId,
            toAdd.map((nl) => nl.id)
          );
        } catch (err: any) {
          console.warn('[LaborEntryView] Background assignment sync error:', err);
        }
      }
    }
  };
  // Mode: In Time or Out Time (matching hand-drawn sketch)
  const [statusFilterChip, setStatusFilterChip] = useState<'all' | 'in_site' | 'done' | 'pending_in' | 'absent'>('all');

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

  // Micro-feedback: toast banner and recently updated worker highlight
  const [toastMessage, setToastMessage] = useState<{ id: string; name: string; isDone: boolean } | null>(null);
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState<string | null>(null);

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

  // ── BATCH CONTROLS ACCORDION (COLLAPSIBLE) ──
  const [isBatchOpen, setIsBatchOpen] = useState(false);

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

      // Smart Status Filter Chips
      if (statusFilterChip === 'in_site') {
        return !l.isAbsent && !!l.inTime && !l.outTime;
      }
      if (statusFilterChip === 'done') {
        return !l.isAbsent && !!l.inTime && !!l.outTime;
      }
      if (statusFilterChip === 'pending_in') {
        return !l.isAbsent && !l.inTime;
      }
      if (statusFilterChip === 'absent') {
        return !!l.isAbsent;
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
  const inMarkedCount = laborers.filter((l) => !l.isAbsent && !!l.inTime).length;
  const outMarkedCount = laborers.filter((l) => !l.isAbsent && !!l.outTime).length;
  const completedCount = laborers.filter((l) => !l.isAbsent && !!l.inTime && !!l.outTime).length;
  const inSiteCount = laborers.filter((l) => !l.isAbsent && !!l.inTime && !l.outTime).length;
  const pendingInCount = laborers.filter((l) => !l.isAbsent && !l.inTime).length;
  const absentCount = laborers.filter((l) => !!l.isAbsent).length;

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

  // ── APPLY BATCH FULL SHIFT (IN + OUT + ACTIVITIES) ──
  const handleApplyBatchFullShift = () => {
    const targetIds = selectedFilteredWorkerIds;
    if (targetIds.length === 0) return;

    const { shift, ot } = computeHours(batchInTime, batchOutTime);

    const updated = laborers.map((l) => {
      if (!targetIds.includes(l.id)) return l;

      const newSplits: ActivitySplit[] = batchActivities
        .filter((ba) => ba.activityCode && ba.activityCode.trim() !== '')
        .map((ba) => ({
          id: `split-${Date.now()}-${l.id}-${ba.id}`,
          activityCode: ba.activityCode,
          hours: ba.hours,
        }));

      return {
        ...l,
        inTime: batchInTime,
        outTime: batchOutTime,
        shiftHours: shift,
        otHours: ot,
        activities: newSplits,
        isAbsent: false,
        status: 'done' as const,
        lastSavedAt: `Full: ${batchInTime}-${batchOutTime}`,
      };
    });

    onSaveLaborers(updated);
    setSelectedWorkerIds([]);
  };

  const handleSetPreset = (inVal: string, outVal: string) => {
    setBatchInTime(inVal);
    handleBatchOutTimeChange(outVal);
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

  // ── BATCH ACTIVITY ROW HANDLERS (SMART AUTO-BALANCING & STRICT SHIFT CAP) ──
  const handleAddBatchActivityRow = () => {
    const currentSum = sumHhmm(batchActivities.map((b) => b.hours));
    const targetMins = hhmmToMinutes(targetShiftHours);
    const currentMins = hhmmToMinutes(currentSum);
    const diffMins = Math.max(0, targetMins - currentMins);
    const fillHours = diffMins > 0 ? minutesToHhmm(diffMins) : 0;

    const nextActivity = (activityOptions[batchActivities.length % activityOptions.length] || activityOptions[0])?.code || '';
    const newRow: BatchActivityItem = {
      id: `batch-act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      activityCode: nextActivity,
      hours: fillHours,
    };
    setBatchActivities((prev) => [...prev, newRow]);
  };

  const handleUpdateBatchActivityRow = (id: string, field: 'activityCode' | 'hours', value: any) => {
    setBatchActivities((prev) => {
      if (field === 'hours') {
        const valNum = value === '' ? 0 : parseFloat(value);
        const safeHours = isNaN(valNum) ? 0 : Math.max(0, valNum);
        return prev.map((a) => (a.id === id ? { ...a, hours: safeHours } : a));
      }
      return prev.map((a) => (a.id === id ? { ...a, [field]: value } : a));
    });
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
      } else if (activities.length > 1 && shift > 0) {
        let runningMins = 0;
        const maxMins = hhmmToMinutes(shift);
        activities = activities.map((a) => {
          const actMins = hhmmToMinutes(a.hours);
          if (runningMins + actMins <= maxMins) {
            runningMins += actMins;
            return a;
          } else {
            const availMins = Math.max(0, maxMins - runningMins);
            runningMins += availMins;
            return { ...a, hours: minutesToHhmm(availMins) };
          }
        }).filter((a) => a.hours > 0);
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
    const laborer = laborers.find((l) => l.id === id);
    if (!laborer) return;
    const inTime = laborer.inTime || batchInTime || '07:00';
    const outTime = laborer.outTime || batchOutTime || '17:00';
    const { shift } = computeHours(inTime, outTime);
    const actSum = sumHhmm((laborer.activities || []).map((a) => a.hours));
    if (shift > 0 && hhmmToMinutes(actSum) > hhmmToMinutes(shift)) {
      alert(`Activity hours (${formatHhmm(actSum)}h) cannot exceed shift hours (${formatHhmm(shift)}h). Please reduce activity hours.`);
      return;
    }

    const updated = laborers.map((l) => {
      if (l.id !== id) return l;
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
    setRecentlyUpdatedId(id);
    setTimeout(() => setRecentlyUpdatedId(null), 1800);
    setToastMessage({ id, name: laborer?.callingName || 'Worker', isDone: true });
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleToggleIndividualDone = (id: string) => {
    const laborer = laborers.find((l) => l.id === id);
    if (!laborer) return;

    if (laborer.status === 'done') {
      const updated = laborers.map((l) => 
        l.id === id ? { ...l, status: 'draft' as const, lastSavedAt: 'Reverted to Draft' } : l
      );
      onSaveLaborers(updated);
      setRecentlyUpdatedId(id);
      setTimeout(() => setRecentlyUpdatedId(null), 1200);
      setToastMessage({ id, name: laborer.callingName || 'Worker', isDone: false });
      setTimeout(() => setToastMessage(null), 2500);
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
    const allocatedMins = hhmmToMinutes(allocatedSum);
    const shiftMins = hhmmToMinutes(laborer.shiftHours);
    const remainingMins = Math.max(0, shiftMins - allocatedMins);
    const fillHours = remainingMins > 0 ? minutesToHhmm(remainingMins) : 0;

    const newSplit: ActivitySplit = {
      id: `split-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      activityCode: activityOptions.find((o) => !laborer.activities.some((a) => a.activityCode === o.code))?.code || activityOptions[0]?.code || '',
      hours: fillHours,
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

      if (field === 'hours') {
        const valNum = value === '' ? 0 : parseFloat(value);
        const safeHours = isNaN(valNum) ? 0 : Math.max(0, valNum);

        const activities = l.activities.map((a) =>
          a.id === splitId ? { ...a, hours: safeHours } : a
        );
        return { ...l, activities, status: 'draft' as const };
      }

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

  const handleRemoveLaborer = (laborerId: string) => {
    const worker = laborers.find((l) => l.id === laborerId);
    if (!worker) return;
    const name = worker.callingName || worker.employeeCode || 'this worker';
    const hasData = Boolean(worker.inTime || worker.outTime || (worker.activities && worker.activities.length > 0));
    if (hasData) {
      if (!window.confirm(`Are you sure you want to remove ${name} from today's list?`)) {
        return;
      }
    }
    const updated = laborers.filter((l) => l.id !== laborerId);
    onSaveLaborers(updated);
    setSelectedWorkerIds((prev) => prev.filter((id) => id !== laborerId));
    if (expandedId === laborerId) {
      setExpandedId(null);
    }

    // Real-time backend unassign
    if (selectedDate) {
      assignmentService.unassign(selectedDate, laborerId, effectiveSupervisorId).catch((err: any) => {
        console.warn('[LaborEntryView] Background unassign error:', err);
      });
    }
  };

  const handleBatchRemoveLaborers = () => {
    if (selectedWorkerIds.length === 0) return;
    if (window.confirm(`Remove ${selectedWorkerIds.length} selected worker(s) from today's list?`)) {
      const idsToRemove = [...selectedWorkerIds];
      const removeSet = new Set(idsToRemove);
      const updated = laborers.filter((l) => !removeSet.has(l.id));
      onSaveLaborers(updated);
      setSelectedWorkerIds([]);
      if (expandedId && removeSet.has(expandedId)) {
        setExpandedId(null);
      }

      // Real-time backend unassign for each
      if (selectedDate) {
        idsToRemove.forEach((id) => {
          assignmentService.unassign(selectedDate, id, effectiveSupervisorId).catch((err: any) => {
            console.warn('[LaborEntryView] Background batch unassign error:', err);
          });
        });
      }
    }
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

      {/* ── 1. Shift Metrics & Status Filter Chips (Unified View) ────────────────── */}
      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5">
        {/* Quick Shift Counter Badges */}
        <div className="flex items-center justify-between text-xs px-1 flex-wrap gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Assigned: <strong className="font-mono text-slate-900 dark:text-white">{laborers.length}</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              In: <strong className="font-mono">{inMarkedCount}</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-400">
              Out: <strong className="font-mono">{outMarkedCount}</strong>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
              <CheckCircle2 size={11} />
              <span>{completedCount} Done</span>
            </span>
            {absentCount > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                <UserX size={11} />
                <span>{absentCount} Absent</span>
              </span>
            )}
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => setStatusFilterChip('all')}
            className={[
              'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
              statusFilterChip === 'all'
                ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 shadow-xs font-bold'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
            ].join(' ')}
          >
            All ({laborers.length})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilterChip('in_site')}
            className={[
              'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
              statusFilterChip === 'in_site'
                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800/60'
            ].join(' ')}
          >
            🟢 In-Site ({inSiteCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilterChip('done')}
            className={[
              'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
              statusFilterChip === 'done'
                ? 'bg-blue-600 text-white shadow-xs font-bold'
                : 'bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 hover:bg-blue-100 border border-blue-200 dark:border-blue-800/60'
            ].join(' ')}
          >
            ⭐ Done ({completedCount})
          </button>

          <button
            type="button"
            onClick={() => setStatusFilterChip('pending_in')}
            className={[
              'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
              statusFilterChip === 'pending_in'
                ? 'bg-amber-600 text-white shadow-xs font-bold'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 hover:bg-amber-100 border border-amber-200 dark:border-amber-800/60'
            ].join(' ')}
          >
            🕒 Pending In ({pendingInCount})
          </button>

          {absentCount > 0 && (
            <button
              type="button"
              onClick={() => setStatusFilterChip('absent')}
              className={[
                'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 cursor-pointer',
                statusFilterChip === 'absent'
                  ? 'bg-rose-600 text-white shadow-xs font-bold'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 hover:bg-rose-100 border border-rose-200 dark:border-rose-800/60'
              ].join(' ')}
            >
              Absent ({absentCount})
            </button>
          )}
        </div>
      </div>

      {/* ── 3. Search Bar & Add from Pool ───────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
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

        {isPoolMode && !isDayLocked && (
          <button
            type="button"
            onClick={() => setIsLaborPoolModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors shrink-0 cursor-pointer"
            title="Add workers from site pool"
          >
            <Plus size={15} className="stroke-[3]" />
            <span className="hidden sm:inline">Add from Pool</span>
            <span className="sm:hidden">Pool</span>
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

      {/* ── 5. Unified Batch Action Bar (IN, OUT & Activities Combined - Collapsible) ────────── */}
      <div className="rounded-2xl bg-slate-900/5 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-2xs overflow-hidden transition-all">
        {/* Header Toggle Row */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsBatchOpen((prev) => !prev)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setIsBatchOpen((prev) => !prev);
            }
          }}
          className="p-3 flex items-center justify-between gap-2 cursor-pointer select-none hover:bg-slate-500/5 transition-colors"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
              <Clock size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  Shift & Task Batch Apply
                </h3>
                {selectedFilteredCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-2xs animate-pulse">
                    {selectedFilteredCount} Selected
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    (Optional)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {isBatchOpen
                  ? 'Set In/Out times & assign tasks to selected workers in 1-tap.'
                  : `${batchInTime} - ${batchOutTime} • Tap to expand controls & apply`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1">
              {isBatchOpen ? 'Collapse' : 'Expand'}
              {isBatchOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </span>
          </div>
        </div>

        {/* Collapsible Body Content */}
        {isBatchOpen && (
          <div className="p-3.5 pt-1 space-y-3 border-t border-slate-200/80 dark:border-slate-800">
            {/* Quick 1-Tap Presets */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Quick Presets:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetPreset('07:00', '17:00')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                  title="Set Batch In to 07:00 and Out to 17:00 (Standard 9.0h shift)"
                >
                  Std Day (07-17)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset('07:00', '12:00')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Set Batch In to 07:00 and Out to 12:00 (Half Day 5.0h)"
                >
                  Half Day (07-12)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset('07:00', '19:00')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                  title="Set Batch In to 07:00 and Out to 19:00 (OT Shift 11.0h)"
                >
                  OT (07-19)
                </button>
              </div>
            </div>

            {/* Dual In & Out Pickers Side-by-Side */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center justify-between gap-1.5 bg-emerald-50/70 dark:bg-emerald-950/30 px-2.5 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
                <span className="text-[10px] font-bold text-emerald-800 dark:text-emerald-300 uppercase flex items-center gap-1">
                  <LogIn size={12} /> In:
                </span>
                <input
                  type="time"
                  value={batchInTime}
                  onChange={(e) => setBatchInTime(e.target.value)}
                  className="text-xs font-bold text-emerald-950 dark:text-emerald-100 bg-transparent focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between gap-1.5 bg-blue-50/70 dark:bg-blue-950/30 px-2.5 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800/60 shadow-2xs">
                <span className="text-[10px] font-bold text-blue-800 dark:text-blue-300 uppercase flex items-center gap-1">
                  <LogOut size={12} /> Out:
                </span>
                <input
                  type="time"
                  value={batchOutTime}
                  onChange={(e) => handleBatchOutTimeChange(e.target.value)}
                  className="text-xs font-bold text-blue-950 dark:text-blue-100 bg-transparent focus:outline-none"
                />
              </div>
            </div>

            {/* Master Activity Code Splits for Batch */}
            <div className="space-y-2 bg-white dark:bg-slate-800/90 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
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
                  <div
                    className={[
                      'flex items-center justify-between px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors',
                      isBalanced
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300'
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-1 font-mono">
                      <span>Total: {formatHhmm(currentSum)}h</span>
                      <span>/</span>
                      <span>Shift: {formatHhmm(targetShiftHours)}h</span>
                    </span>
                    <span>
                      {isBalanced ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                          <Check size={12} /> Balanced
                        </span>
                      ) : diffMinutes > 0 ? (
                        <span className="text-amber-700 dark:text-amber-400">
                          +{formatHhmm(diffHhmm)}h over target
                        </span>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">
                          {formatHhmm(diffHhmm)}h remaining
                        </span>
                      )}
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Selection Controls & Unified Actions */}
            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200 dark:border-slate-800 flex-wrap">
              <button
                type="button"
                onClick={handleToggleSelectAll}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer"
              >
                {isAllFilteredSelected ? (
                  <CheckSquare size={16} className="text-blue-600" />
                ) : (
                  <Square size={16} className="text-slate-400" />
                )}
                <span>{isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredLaborers.length})`}</span>
              </button>

              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedFilteredCount > 0 && !isDayLocked && (
                  <>
                    <button
                      type="button"
                      onClick={handleBatchResetToDraft}
                      className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                      title="Revert selected workers to Draft"
                    >
                      <RotateCcw size={12} />
                      <span>Draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBatchClearActivities}
                      className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors cursor-pointer"
                      title="Clear all tasks for selected workers"
                    >
                      <Trash2 size={12} />
                      <span>Clear Tasks</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBatchRemoveLaborers}
                      className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors cursor-pointer"
                      title={`Remove ${selectedFilteredCount} selected worker(s) from today`}
                    >
                      <Trash2 size={12} />
                      <span>Remove (${selectedFilteredCount})</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleApplyBatchIn}
                  disabled={isDayLocked || selectedFilteredCount === 0}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-2xs active:scale-[0.98] cursor-pointer"
                  title={`Set In-Time (${batchInTime}) only`}
                >
                  <LogIn size={12} />
                  <span>In Only</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyBatchOut}
                  disabled={isDayLocked || selectedFilteredCount === 0}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-2xs active:scale-[0.98] cursor-pointer"
                  title={`Set Out-Time (${batchOutTime}) & Activities only`}
                >
                  <LogOut size={12} />
                  <span>Out & Tasks</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyBatchFullShift}
                  disabled={isDayLocked || selectedFilteredCount === 0}
                  className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
                  title={`Apply both ${batchInTime} - ${batchOutTime} and Tasks to ${selectedFilteredCount} workers`}
                >
                  <Check size={13} className="stroke-[3]" />
                  <span>Apply Both (${selectedFilteredCount})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

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
            const isDone = !worker.isAbsent && worker.status === 'done';
            const isRecentlyUpdated = recentlyUpdatedId === worker.id;
            const activitySum = sumHhmm(worker.activities.map((a) => a.hours));
            void activitySum; // consumed if needed

            return (
              <div
                key={worker.id}
                className={[
                  'rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs',
                  isRecentlyUpdated
                    ? 'ring-2 ring-emerald-500 scale-[1.01] border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/40 shadow-emerald-500/10'
                    : isSelected
                    ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : worker.isAbsent
                    ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/25 dark:bg-rose-950/20'
                    : isDone
                    ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
                    : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                ].join(' ')}
              >
                {/* ── 1. Card Top Row: Checkbox, Worker Identity & Quick Done / Chevron ── */}
                <div className="p-3 pb-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80">
                  {/* Selection Checkbox (Dedicated to selecting worker) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleWorkerSelect(worker.id, e);
                    }}
                    className="p-1 -ml-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none flex-shrink-0 cursor-pointer"
                    aria-label={`Select ${worker.employeeCode}`}
                  >
                    {isSelected ? (
                      <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square size={20} className="text-slate-400" />
                    )}
                  </button>

                  {/* Worker Avatar & Identifiers - Clicking expands/collapses the card! */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : worker.id)}
                    className="flex-1 min-w-0 cursor-pointer select-none"
                    title={`Click to ${isExpanded ? 'collapse' : 'expand'} details for ${worker.callingName || worker.employeeCode}`}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
                        {worker.callingName || worker.fullName || worker.employeeCode}
                      </span>
                      {worker.callingName && worker.fullName && worker.fullName.trim() !== worker.callingName.trim() && (
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-normal truncate hidden sm:inline">
                          · {worker.fullName}
                        </span>
                      )}
                      {worker.isStandbyAssigned && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200">
                          Standby
                        </span>
                      )}
                      {isDone && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-0.5 shadow-2xs">
                          <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400" />
                          Done
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      <span className="font-mono text-slate-600 dark:text-slate-300 font-semibold">
                        {worker.employeeCode}
                      </span>
                      <span>·</span>
                      <span className="font-medium text-slate-600 dark:text-slate-300 truncate">
                        {worker.tradeGroup}
                      </span>
                    </div>

                    {worker.claimedBySupervisor && !worker.claimedByMe && (
                      <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[10px] text-amber-900 dark:text-amber-200 font-semibold">
                        <Lock size={10} className="text-amber-600 shrink-0" />
                        <span>Logged by Sup. {worker.claimedBySupervisor} ({worker.claimedInTime || '--:--'} - {worker.claimedOutTime || '--:--'})</span>
                      </div>
                    )}
                  </div>

                  {/* Top-Right Controls: Absent Badge / Done Button & Expand Chevron */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {worker.isAbsent ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-800 px-2 py-0.5 rounded-lg flex items-center gap-1 shadow-2xs">
                          <UserX size={12} className="text-rose-600" />
                          Absent
                        </span>
                        {!isDayLocked && (
                          <button
                            type="button"
                            onClick={() => handleToggleAbsent(worker.id)}
                            className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            title="Unmark Absent (Make Pending)"
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Quick Done / Revert Toggle Button */}
                        {!isDayLocked && (
                          <button
                            type="button"
                            onClick={() => handleToggleIndividualDone(worker.id)}
                            className={[
                              'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer',
                              isDone
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-700 hover:bg-emerald-200'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700'
                            ].join(' ')}
                            title={isDone ? 'Marked as Done. Click to revert back to Draft' : 'Mark card as Done'}
                          >
                            <Check size={12} className={isDone ? 'stroke-[2.5]' : 'stroke-[3]'} />
                            <span>Done</span>
                          </button>
                        )}
                      </>
                    )}

                    {/* Chevron Button - Always visible right at top corner */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : worker.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer focus:outline-none"
                      aria-label={isExpanded ? "Collapse worker details" : "Expand worker details"}
                      title={isExpanded ? "Collapse details" : "Expand details"}
                    >
                      {isExpanded ? <ChevronUp size={18} className="text-blue-600 dark:text-blue-400" /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* ── 2. Card Time & Shift Action Bar (Responsive Mobile Row) ── */}
                {!worker.isAbsent && (
                  <div className="px-3 py-2 flex items-center justify-between gap-2 flex-wrap bg-slate-50/50 dark:bg-slate-900/30">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {/* IN TIME INPUT */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase flex items-center gap-0.5">
                          <LogIn size={11} /> In:
                        </span>
                        <input
                          type="time"
                          disabled={isDayLocked}
                          value={worker.inTime || ''}
                          onChange={(e) => handleIndividualTimeChange(worker.id, e.target.value, worker.outTime)}
                          className={[
                            'w-[64px] text-xs font-bold rounded-lg px-0.5 py-0.5 border-0 transition-all text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-transparent cursor-pointer',
                            worker.inTime
                              ? 'text-emerald-800 dark:text-emerald-200 font-mono'
                              : 'text-slate-400 dark:text-slate-500'
                          ].join(' ')}
                          title={worker.inTime ? 'In-Time (click to edit)' : 'Click to choose In-Time'}
                        />
                        {!worker.inTime && !isDayLocked && (
                          <button
                            type="button"
                            onClick={() => handleIndividualTimeChange(worker.id, batchInTime, worker.outTime)}
                            className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-md cursor-pointer shadow-2xs"
                            title={`Quick set In to ${batchInTime}`}
                          >
                            In
                          </button>
                        )}
                      </div>

                      {/* OUT TIME INPUT */}
                      <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase flex items-center gap-0.5">
                          <LogOut size={11} /> Out:
                        </span>
                        <input
                          type="time"
                          disabled={isDayLocked}
                          value={worker.outTime || ''}
                          onChange={(e) => handleIndividualTimeChange(worker.id, worker.inTime, e.target.value)}
                          className={[
                            'w-[64px] text-xs font-bold rounded-lg px-0.5 py-0.5 border-0 transition-all text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent cursor-pointer',
                            worker.outTime
                              ? 'text-blue-800 dark:text-blue-200 font-mono'
                              : 'text-slate-400 dark:text-slate-500'
                          ].join(' ')}
                          title={worker.outTime ? 'Out-Time (click to edit)' : 'Click to choose Out-Time'}
                        />
                        {!worker.outTime && !isDayLocked && (
                          <button
                            type="button"
                            onClick={() => handleIndividualTimeChange(worker.id, worker.inTime || batchInTime, batchOutTime)}
                            className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-md cursor-pointer shadow-2xs"
                            title={`Quick set Out to ${batchOutTime}`}
                          >
                            Out
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {/* Net Shift & OT Hours Badge */}
                      {worker.inTime && worker.outTime && (
                        <span className="text-[11px] font-bold font-mono px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-2xs" title={`Computed shift: ${worker.shiftHours}h (OT: ${worker.otHours}h)`}>
                          {formatHhmm(worker.shiftHours)}h
                          {worker.otHours > 0 && <span className="text-[9px] text-amber-600 dark:text-amber-400 ml-0.5">+${worker.otHours}h</span>}
                        </span>
                      )}

                      {/* Quick Absent Button */}
                      {!isDayLocked && !worker.isAbsent && !worker.inTime && !worker.outTime && (
                        <button
                          type="button"
                          onClick={() => handleToggleAbsent(worker.id)}
                          className="text-[10px] font-semibold text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 bg-white dark:bg-slate-800 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-slate-200 dark:border-slate-700 hover:border-rose-300 px-2 py-1 rounded-lg transition-colors cursor-pointer shadow-2xs"
                          title="Mark as Absent"
                        >
                          <UserX size={11} className="inline mr-0.5" />
                          <span>Abs</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Compact Activity Splits / Real-Time Idle Preview (Collapsed View) */}
                {!isExpanded && !worker.isAbsent && (worker.shiftHours > 0 || worker.activities.length > 0) && (() => {
                  const currentSum = sumHhmm(worker.activities.map((a) => a.hours));
                  const idleMinutes = Math.max(0, hhmmToMinutes(worker.shiftHours) - hhmmToMinutes(currentSum));
                  const idleHours = minutesToHhmm(idleMinutes);
                  const isFullyBalanced = worker.shiftHours > 0 && Math.abs(hhmmToMinutes(worker.shiftHours) - hhmmToMinutes(currentSum)) < 1;
                  const isOverShift = hhmmToMinutes(currentSum) > hhmmToMinutes(worker.shiftHours);

                  return (
                    <div className="px-3.5 pb-2.5 pt-0.5 flex items-center justify-between gap-1.5 flex-wrap border-t border-slate-100 dark:border-slate-800/80 bg-slate-50/40 dark:bg-slate-900/20">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {worker.activities.length > 0 && (
                          <>
                            <span className="text-[10px] uppercase font-bold text-slate-400">Tasks:</span>
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
                          </>
                        )}

                        {/* Always display real-time Auto-Idle if remaining shift hours exist */}
                        {worker.shiftHours > 0 && idleMinutes > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800 shadow-2xs">
                            <PauseCircle size={11} className="text-amber-600" />
                            <span>Idle (ZIDLE): {formatHhmm(idleHours)}h</span>
                          </span>
                        )}

                        {/* 100% Productive */}
                        {isFullyBalanced && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 shadow-2xs">
                            <Check size={11} />
                            <span>100% Active (0h Idle)</span>
                          </span>
                        )}

                        {/* Over Shift Warning */}
                        {isOverShift && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 shadow-2xs">
                            <AlertTriangle size={11} />
                            <span>+{formatHhmm(minutesToHhmm(hhmmToMinutes(currentSum) - hhmmToMinutes(worker.shiftHours)))}h Over</span>
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => setExpandedId(worker.id)}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 ml-auto cursor-pointer"
                      >
                        Edit Tasks ({worker.activities.length}) →
                      </button>
                    </div>
                  );
                })()}

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
                              disabled={isDayLocked}
                              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title="Add Task"
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
                                  max={worker.shiftHours || 24}
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

                      {/* Dynamic Shift Balance & Real-time Auto-Idle Deduction */}
                      {(() => {
                        const currentSum = sumHhmm(worker.activities.map((a) => a.hours));
                        const diffMinutes = hhmmToMinutes(worker.shiftHours) - hhmmToMinutes(currentSum);
                        const idleHhmm = minutesToHhmm(Math.max(0, diffMinutes));
                        const isBalanced = worker.shiftHours > 0 && Math.abs(diffMinutes) < 1;

                        return (
                          <div className="space-y-2 pt-1">
                            {/* Live Dynamic Idle Row when remaining hours exist */}
                            {worker.shiftHours > 0 && diffMinutes > 0 && (
                              <div className="p-2.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/80 flex items-center justify-between text-xs">
                                <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
                                  <PauseCircle size={14} className="text-amber-600 shrink-0" />
                                  <span>Remaining Shift Idle (ZIDLE): <strong className="font-mono text-sm">{formatHhmm(idleHhmm)}h</strong></span>
                                </div>
                                <span className="text-[10px] text-amber-800/80 dark:text-amber-400 font-medium">
                                  Auto-decreases as tasks are added
                                </span>
                              </div>
                            )}

                            {/* Total Summary Row */}
                            <div className="flex items-center justify-between text-xs px-1">
                              <span className="text-slate-500 dark:text-slate-400">
                                Tasks: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatHhmm(currentSum)}h</strong> / Shift: {formatHhmm(worker.shiftHours)}h
                              </span>
                              {isBalanced ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 size={13} /> 100% Active (0h Idle)
                                </span>
                              ) : diffMinutes < 0 ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
                                  <AlertTriangle size={13} /> +{formatHhmm(minutesToHhmm(Math.abs(diffMinutes)))}h Excess
                                </span>
                              ) : (
                                <span className="text-amber-700 dark:text-amber-400 font-semibold text-[11px]">
                                  {formatHhmm(idleHhmm)}h Idle Remaining
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>

                    {/* ── Auto-save Status & Mark as Done button ── */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px]">
                          <Check size={13} className="text-emerald-500" />
                          <span>Auto-saved</span>
                        </span>
                        {!isDayLocked && (
                          <button
                            type="button"
                            onClick={() => handleRemoveLaborer(worker.id)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                            title="Remove this worker from today's shift"
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
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
                          {isDone ? <RotateCcw size={14} /> : <CheckCircle2 size={14} />}
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

      {/* ── 8. Floating Feedback Toast ── */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-slate-900/95 dark:bg-slate-800/95 text-white text-xs font-semibold shadow-2xl border border-slate-700 backdrop-blur-xs animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-none">
          {toastMessage.isDone ? (
            <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Check size={12} className="stroke-[3.5]" />
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <RotateCcw size={11} />
            </div>
          )}
          <span>
            {toastMessage.isDone ? `${toastMessage.name} marked as Done!` : `${toastMessage.name} reverted to Draft`}
          </span>
        </div>
      )}
      {/* ── Site Labor Pool Modal ── */}
      <SiteLaborPoolModal
        isOpen={isLaborPoolModalOpen}
        onClose={() => setIsLaborPoolModalOpen(false)}
        selectedDate={selectedDate || ''}
        currentLaborers={laborers}
        onAddLaborers={handleAddLaborersFromPool}
        projectId={projectId}
      />
    </div>
  );
}
