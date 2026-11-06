import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import * as assignmentService from '../../assignments/services/assignmentService';
import { SiteOperatorPoolModal } from '../components/SiteOperatorPoolModal';
import { SearchableEquipmentSelect, type EquipmentOptionItem } from '../components/SearchableEquipmentSelect';
import { supervisorStorage } from '../services/supervisorStorageService';
import { 
  HardHat, 
  Tractor, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Search,
  X,
  CheckSquare,
  Square,
  LogIn,
  LogOut,
  Clock,
  Filter,
  CheckCircle2,
  Lock,
  Plus,
  Trash2,
  PauseCircle,
  Sparkles,
  History,
  Info
} from 'lucide-react';
import type { 
  OperatorEntry, 
  EquipmentLogEntry,
  OperatorEquipmentSplit,
  SitePoolEquipmentItem
} from '../services/supervisorStorageService';
import {
  computeHours,
  formatHhmm,
  sumHhmm,
  hhmmToMinutes,
  minutesToHhmm
} from '../utils/timeUtils';

interface OperatorEntryViewProps {
  operators: OperatorEntry[];
  equipment: EquipmentLogEntry[];
  onSaveOperators: (updated: OperatorEntry[]) => void;
  onSaveEquipment?: (updated: EquipmentLogEntry[]) => void;
  searchQuery?: string;
  statusFilter?: 'all' | 'pending' | 'done';
  isDayLocked?: boolean;
  selectedDate?: string;
  projectId?: string;
  supervisorId?: string;
}

export function OperatorEntryView({
  operators,
  equipment,
  onSaveOperators,
  onSaveEquipment: _onSaveEquipment,
  searchQuery: externalSearchQuery = '',
  statusFilter: externalStatusFilter = 'all',
  isDayLocked = false,
  selectedDate = '',
  projectId,
  supervisorId,
}: OperatorEntryViewProps) {
  const { user } = useAuth();
  const effectiveSupervisorId = supervisorId || user?.id || '';
  const [isOperatorPoolModalOpen, setIsOperatorPoolModalOpen] = useState(false);
  const [isPoolMode, setIsPoolMode] = useState(false);
  const [sitePoolEquipment, setSitePoolEquipment] = useState<SitePoolEquipmentItem[]>([]);

  useEffect(() => {
    supervisorStorage.fetchSiteEquipmentPool(projectId, selectedDate)
      .then((pool) => {
        if (Array.isArray(pool) && pool.length > 0) {
          setSitePoolEquipment(pool);
        }
      })
      .catch((err) => console.warn('Could not load site pool equipment for operators:', err));
  }, [projectId, selectedDate]);

  // Available equipment options from Site Equipment Pool (Standalone, decoupled from equipment logs)
  const allEquipmentOptions = useMemo<EquipmentOptionItem[]>(() => {
    const map = new Map<string, EquipmentOptionItem>();

    sitePoolEquipment.forEach((p) => {
      map.set(p.id, {
        id: p.id,
        code: p.code,
        name: p.name,
        vehicleNo: p.vehicleNo,
        type: (p as any).type || (p as any).equipmentType,
        condition: (p as any).condition,
      });
    });

    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [sitePoolEquipment]);

  useEffect(() => {
    supervisorStorage.isOperatorPoolModeEnabled(projectId)
      .then(setIsPoolMode)
      .catch(() => setIsPoolMode(false));
  }, [projectId]);

  const [recentPastGang, setRecentPastGang] = useState<{ date: string; dayName: string; operatorCount: number } | null>(null);

  useEffect(() => {
    supervisorStorage.getPastOperatorsForSupervisor(effectiveSupervisorId, selectedDate, 1)
      .then((gangs) => {
        if (gangs && gangs.length > 0) {
          setRecentPastGang(gangs[0]);
        } else {
          setRecentPastGang(null);
        }
      })
      .catch(() => setRecentPastGang(null));
  }, [selectedDate, effectiveSupervisorId]);

  const handleAddOperatorFromPool = (newOp: OperatorEntry) => {
    handleAddMultipleOperatorsFromPool([newOp]);
  };

  const handleAddMultipleOperatorsFromPool = async (newOps: OperatorEntry[]) => {
    const existingIds = new Set(operators.map((o) => o.id));
    const toAdd = newOps.filter((o) => !existingIds.has(o.id));
    if (toAdd.length > 0) {
      const updated = [...operators, ...toAdd];
      onSaveOperators(updated);

      // Real-time backend operator assignment
      if (selectedDate && (supervisorId || user?.id)) {
        try {
          await assignmentService.assignOperators(
            selectedDate,
            supervisorId || user?.id || '',
            toAdd.map((o) => o.id)
          );
        } catch (err: any) {
          console.warn('[OperatorEntryView] Background assignment sync error:', err);
        }
      }
    }
  };
  // Mode: In Time or Out Time (matching Labor view layout)
  const [statusFilterChip, setStatusFilterChip] = useState<'all' | 'in_site' | 'done' | 'pending_in'>('all');

  // Internal search and filters
  const [localSearch, setLocalSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [localStatusFilter, setLocalStatusFilter] = useState<'all' | 'pending' | 'done'>('all');

  // Selection state for batch actions
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<string[]>([]);

  // Expanded card state
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // ── BATCH CONTROLS ACCORDION (COLLAPSIBLE) ──
  const [isBatchOpen, setIsBatchOpen] = useState(false);

  // ── IN MODE BATCH STATE ──
  const [batchInTime, setBatchInTime] = useState('07:00');

  // ── OUT MODE BATCH STATE ──
  const [batchOutTime, setBatchOutTime] = useState('17:00');

  // Unique designations / roles
  const uniqueRoles = useMemo(() => {
    const roles = new Set<string>();
    operators.forEach((o) => {
      if (o.designation) roles.add(o.designation);
    });
    return Array.from(roles);
  }, [operators]);

  // Combined search query
  const effectiveSearch = localSearch || externalSearchQuery;
  const effectiveStatus = localStatusFilter !== 'all' ? localStatusFilter : externalStatusFilter;

  // Filtered operators
  const filteredOperators = useMemo(() => {
    return operators.filter((o) => {
      const search = effectiveSearch.toLowerCase().trim();
      const splits = o.equipmentSplits || [];
      const hasMatchingEquip = splits.some((s) => {
        const eq = allEquipmentOptions.find((e) => e.id === s.equipmentId) || equipment.find((e) => e.id === s.equipmentId);
        return eq && (eq.code.toLowerCase().includes(search) || eq.name.toLowerCase().includes(search));
      });

      const matchesSearch = 
        !search ||
        (o.employeeNumber && o.employeeNumber.toLowerCase().includes(search)) ||
        o.callingName.toLowerCase().includes(search) ||
        o.designation.toLowerCase().includes(search) ||
        (o.licenseNo && o.licenseNo.toLowerCase().includes(search)) ||
        hasMatchingEquip;

      if (!matchesSearch) return false;

      // Role filter
      if (selectedRole !== 'all' && o.designation !== selectedRole) {
        return false;
      }

      // Status filter
      const isComplete = Boolean(o.inTime && o.outTime);
      if (effectiveStatus === 'pending') {
        return !isComplete;
      }
      if (effectiveStatus === 'done') {
        return isComplete;
      }

      // Smart Status Filter Chips
      if (statusFilterChip === 'in_site') {
        return Boolean(o.inTime && !o.outTime);
      }
      if (statusFilterChip === 'done') {
        return Boolean(o.inTime && o.outTime);
      }
      if (statusFilterChip === 'pending_in') {
        return !o.inTime;
      }

      return true;
    });
  }, [operators, equipment, effectiveSearch, selectedRole, effectiveStatus]);

  // Helper to get total operating hours and idle hours for an operator
  const getOperatorHourBreakdown = (operator: OperatorEntry) => {
    const shift = Number(operator.shiftHours) || 0;
    const splits = operator.equipmentSplits || [];
    const operatingHours = sumHhmm(splits.map((s) => s.hours));
    const idleMinutes = Math.max(0, hhmmToMinutes(shift) - hhmmToMinutes(operatingHours));
    const idleHours = minutesToHhmm(idleMinutes);
    return { shift, operatingHours, idleHours };
  };

  // Find shared operators on the same equipment (Informational, NOT an error)
  const getSharedEquipmentOperators = (equipmentId: string, currentOperatorId: string): string[] => {
    if (!equipmentId || equipmentId === 'ZXQOPRIDLE') return [];
    return operators
      .filter((o) => o.id !== currentOperatorId && (o.equipmentSplits || []).some((s) => s.equipmentId === equipmentId))
      .map((o) => o.callingName || o.employeeNumber);
  };

  // Stats
  const inMarkedCount = operators.filter((o) => !!o.inTime).length;
  const outMarkedCount = operators.filter((o) => !!o.outTime).length;
  const completedCount = operators.filter((o) => o.inTime && o.outTime).length;
  const inSiteCount = operators.filter((o) => o.inTime && !o.outTime).length;
  const pendingInCount = operators.filter((o) => !o.inTime).length;
  const pendingCount = operators.length - completedCount;

  void [setLocalStatusFilter, inMarkedCount, outMarkedCount, pendingCount];

  // Selection handlers
  const handleToggleSelectAll = () => {
    const currentFilteredIds = filteredOperators.map((o) => o.id);
    const allSelected = currentFilteredIds.every((id) => selectedOperatorIds.includes(id));

    if (allSelected) {
      setSelectedOperatorIds((prev) => prev.filter((id) => !currentFilteredIds.includes(id)));
    } else {
      setSelectedOperatorIds((prev) => Array.from(new Set([...prev, ...currentFilteredIds])));
    }
  };

  const handleToggleOperatorSelect = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedOperatorIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // ── APPLY BATCH IN TIME ──
  const handleApplyBatchIn = () => {
    if (selectedOperatorIds.length === 0) return;

    const updated = operators.map((o) => {
      if (!selectedOperatorIds.includes(o.id)) return o;
      const inTime = batchInTime;
      const outTime = o.outTime;
      const { shift, ot } = computeHours(inTime, outTime);

      const splits = (o.equipmentSplits && o.equipmentSplits.length === 1)
        ? [{ ...o.equipmentSplits[0], hours: shift || 8.0 }]
        : (o.equipmentSplits ? [...o.equipmentSplits] : []);

      return {
        ...o,
        inTime,
        shiftHours: shift,
        otHours: ot,
        equipmentSplits: splits,
        status: (inTime && outTime ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
        lastSavedAt: `In: ${batchInTime}`,
      };
    });

    onSaveOperators(updated);
    setSelectedOperatorIds([]);
  };

  // ── APPLY BATCH OUT TIME ──
  const handleApplyBatchOut = () => {
    if (selectedOperatorIds.length === 0) return;

    const updated = operators.map((o) => {
      if (!selectedOperatorIds.includes(o.id)) return o;
      const inTime = o.inTime || '07:00';
      const outTime = batchOutTime;
      const { shift, ot } = computeHours(inTime, outTime);

      const splits = (o.equipmentSplits && o.equipmentSplits.length === 1)
        ? [{ ...o.equipmentSplits[0], hours: shift || 8.0 }]
        : (o.equipmentSplits ? [...o.equipmentSplits] : []);

      return {
        ...o,
        inTime,
        outTime,
        shiftHours: shift,
        otHours: ot,
        assignedEquipmentId: splits[0]?.equipmentId || o.assignedEquipmentId || '',
        equipmentSplits: splits,
        status: (inTime && outTime ? 'done' : 'draft') as 'done' | 'draft',
        lastSavedAt: `Out: ${batchOutTime}`,
      };
    });

    onSaveOperators(updated);
    setSelectedOperatorIds([]);
  };

  // ── APPLY BATCH FULL SHIFT (IN + OUT) ──
  const handleApplyBatchFullShift = () => {
    if (selectedOperatorIds.length === 0) return;

    const { shift, ot } = computeHours(batchInTime, batchOutTime);

    const updated = operators.map((o) => {
      if (!selectedOperatorIds.includes(o.id)) return o;

      const splits = (o.equipmentSplits && o.equipmentSplits.length === 1)
        ? [{ ...o.equipmentSplits[0], hours: shift || 8.0 }]
        : (o.equipmentSplits ? [...o.equipmentSplits] : []);

      return {
        ...o,
        inTime: batchInTime,
        outTime: batchOutTime,
        shiftHours: shift,
        otHours: ot,
        assignedEquipmentId: splits[0]?.equipmentId || o.assignedEquipmentId || '',
        equipmentSplits: splits,
        status: 'done' as const,
        lastSavedAt: `Full: ${batchInTime}-${batchOutTime}`,
      };
    });

    onSaveOperators(updated);
    setSelectedOperatorIds([]);
  };

  const handleSetPreset = (inVal: string, outVal: string) => {
    setBatchInTime(inVal);
    setBatchOutTime(outVal);
  };

  const handleBatchResetToDraft = () => {
    if (selectedOperatorIds.length === 0) return;
    const updated = operators.map((o) => {
      if (!selectedOperatorIds.includes(o.id)) return o;
      return {
        ...o,
        status: 'draft' as const,
        lastSavedAt: 'Reset to Draft',
      };
    });
    onSaveOperators(updated);
    setSelectedOperatorIds([]);
  };

  // ── INDIVIDUAL TIME CHANGES ──
  const handleIndividualTimeChange = (id: string, inTime: string, outTime: string) => {
    const { shift, ot } = computeHours(inTime, outTime);
    const updated = operators.map((o) => {
      if (o.id !== id) return o;
      let splits = o.equipmentSplits;
      if (splits && splits.length === 1) {
        splits = [{ ...splits[0], hours: shift || 8.0 }];
      }
      return {
        ...o,
        inTime,
        outTime,
        shiftHours: shift,
        otHours: ot,
        equipmentSplits: splits,
        status: 'draft' as const, // Editing keeps/sets it as draft
        lastSavedAt: `Draft: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      };
    });
    onSaveOperators(updated);
  };

  const handleMarkOperatorDone = (id: string) => {
    const updated = operators.map((o) => {
      if (o.id !== id) return o;
      const inTime = o.inTime || '07:00';
      const outTime = o.outTime || batchOutTime || '17:00';
      const { shift, ot } = computeHours(inTime, outTime);
      let splits = o.equipmentSplits || [];
      if (splits.length === 1 && shift > 0) {
        splits = [{ ...splits[0], hours: shift }];
      }
      return {
        ...o,
        inTime,
        outTime,
        shiftHours: shift,
        otHours: ot,
        equipmentSplits: splits,
        status: 'done' as const,
        lastSavedAt: `Done at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      };
    });
    onSaveOperators(updated);
    setExpandedId(null);
  };

  const handleToggleOperatorDone = (id: string) => {
    const op = operators.find((o) => o.id === id);
    if (!op) return;

    if (op.status === 'done') {
      const updated = operators.map((o) => 
        o.id === id ? { ...o, status: 'draft' as const, lastSavedAt: 'Reverted to Draft' } : o
      );
      onSaveOperators(updated);
    } else {
      handleMarkOperatorDone(id);
    }
  };

  // ── MULTI-VEHICLE SPLIT HANDLERS ──
  const handleAddEquipmentSplit = (operatorId: string) => {
    const updated = operators.map((o) => {
      if (o.id !== operatorId) return o;
      const targetShift = Number(o.shiftHours) || 8.0;
      const currentSplits = o.equipmentSplits || [];
      
      const defaultEq = allEquipmentOptions.find((eq) => !currentSplits.some((s) => s.equipmentId === eq.id)) || allEquipmentOptions[0];
      const defaultEqId = defaultEq?.id || '';

      let newSplits: OperatorEquipmentSplit[] = [];

      if (currentSplits.length === 0) {
        // Palaweni equipment ekata full shift ekama watenna
        const newSplit: OperatorEquipmentSplit = {
          id: `split-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          equipmentId: defaultEqId,
          hours: targetShift,
        };
        newSplits = [newSplit];
      } else {
        // 2nd, 3rd or more vehicle: assign remaining hours if any, or default to 0
        const currentSum = sumHhmm(currentSplits.map((s) => s.hours));
        const remMins = Math.max(0, hhmmToMinutes(targetShift) - hhmmToMinutes(currentSum));
        const remainingHours = remMins > 0 ? minutesToHhmm(remMins) : 0;
        const newSplit: OperatorEquipmentSplit = {
          id: `split-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          equipmentId: defaultEqId,
          hours: remainingHours,
        };
        newSplits = [...currentSplits, newSplit];
      }

      return {
        ...o,
        assignedEquipmentId: newSplits[0]?.equipmentId || '',
        equipmentSplits: newSplits,
      };
    });

    onSaveOperators(updated);
  };

  const handleUpdateEquipmentSplit = (operatorId: string, splitId: string, field: 'equipmentId' | 'hours', value: any) => {
    const updated = operators.map((o) => {
      if (o.id !== operatorId) return o;
      const currentSplits = o.equipmentSplits || [];

      if (field === 'equipmentId') {
        const splits = currentSplits.map((s) => {
          if (s.id !== splitId) return s;
          return {
            ...s,
            equipmentId: value,
          };
        });
        return {
          ...o,
          assignedEquipmentId: splits[0]?.equipmentId || '',
          equipmentSplits: splits,
        };
      }

      // field === 'hours' (Supervisor has full freedom to type hours without auto-mutating other vehicles!)
      const valNum = value === '' ? 0 : parseFloat(value);
      const newHours = isNaN(valNum) ? 0 : Math.max(0, valNum);

      const splits = currentSplits.map((s) => {
        if (s.id !== splitId) return s;
        return { ...s, hours: newHours };
      });

      return {
        ...o,
        assignedEquipmentId: splits[0]?.equipmentId || '',
        equipmentSplits: splits,
      };
    });

    onSaveOperators(updated);
  };

  const handleRemoveEquipmentSplit = (operatorId: string, splitId: string) => {
    const updated = operators.map((o) => {
      if (o.id !== operatorId) return o;
      const targetShift = Number(o.shiftHours) || 8.0;
      let splits = (o.equipmentSplits || []).filter((s) => s.id !== splitId);

      // If only 1 equipment remains, assign full shift hours
      if (splits.length === 1) {
        splits = [{ ...splits[0], hours: targetShift }];
      }

      return {
        ...o,
        assignedEquipmentId: splits[0]?.equipmentId || '',
        equipmentSplits: splits,
      };
    });
    onSaveOperators(updated);
  };

  const handleRemoveOperator = (operatorId: string) => {
    const op = operators.find((o) => o.id === operatorId);
    if (!op) return;
    const name = op.callingName || op.employeeNumber || 'this operator';
    const hasData = Boolean(op.inTime || op.outTime || (op.equipmentSplits && op.equipmentSplits.length > 0));
    if (hasData) {
      if (!window.confirm(`Are you sure you want to remove ${name} from today's list?`)) {
        return;
      }
    }
    const updated = operators.filter((o) => o.id !== operatorId);
    onSaveOperators(updated);
    setSelectedOperatorIds((prev) => prev.filter((id) => id !== operatorId));
    if (expandedId === operatorId) {
      setExpandedId(null);
    }

    // Real-time backend unassign
    assignmentService.unassignOperator(operatorId, selectedDate, supervisorId || user?.id).catch((err: any) => {
      console.warn('[OperatorEntryView] Background unassign error:', err);
    });
  };

  const handleBatchRemoveOperators = () => {
    if (selectedOperatorIds.length === 0) return;
    if (window.confirm(`Remove ${selectedOperatorIds.length} selected operator(s) from today's list?`)) {
      const idsToRemove = [...selectedOperatorIds];
      const removeSet = new Set(idsToRemove);
      const updated = operators.filter((o) => !removeSet.has(o.id));
      onSaveOperators(updated);
      setSelectedOperatorIds([]);
      if (expandedId && removeSet.has(expandedId)) {
        setExpandedId(null);
      }

      // Real-time backend unassign for each operator
      idsToRemove.forEach((id) => {
        assignmentService.unassignOperator(id, selectedDate, supervisorId || user?.id).catch((err: any) => {
          console.warn('[OperatorEntryView] Background batch unassign error:', err);
        });
      });
    }
  };

  const isAllFilteredSelected = 
    filteredOperators.length > 0 && 
    filteredOperators.every((o) => selectedOperatorIds.includes(o.id));

  return (
    <div className="space-y-3 pb-16 animate-in fade-in duration-150 w-full max-w-full overflow-x-hidden">
      {/* ── 0. Locked State Banner ────────────────────────────────────────── */}
      {isDayLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 text-amber-800 text-xs font-medium">
          <Lock size={16} className="text-amber-600 shrink-0" />
          <span>Daily records have been submitted and locked. Operator entries are view-only.</span>
        </div>
      )}

      {/* ── 1. Shift Metrics & Status Filter Chips (Unified View) ────────────────── */}
      <div className="p-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/90 dark:border-slate-800 shadow-2xs space-y-2.5">
       

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
            All ({operators.length})
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
        </div>
      </div>

      {/* ── 2. Search Bar & Add from Pool ───────────────────────────────────── */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            placeholder="Search operator, machine code, license..."
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
            onClick={() => setIsOperatorPoolModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors shrink-0 cursor-pointer"
            title="Add operator from site pool"
          >
            <Plus size={15} className="stroke-[3]" />
            <span className="hidden sm:inline">Add from Pool</span>
            <span className="sm:hidden">Pool</span>
          </button>
        )}
      </div>

      {/* ── 3. Role & Status Filter Chips ─────────────────────────────────── */}
      <div className="py-2 px-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-3.5">
        <div>
          <div className="flex items-center justify-between mb-1 px-0.5">
            <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Filter size={12} className="text-blue-600 dark:text-blue-400" />
              Filter by Role:
            </span>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              type="button"
              onClick={() => setSelectedRole('all')}
              className={[
                'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                selectedRole === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
              ].join(' ')}
            >
              All Operators ({operators.length})
            </button>
            {uniqueRoles.map((role) => {
              const count = operators.filter((o) => o.designation === role).length;
              return (
                <button
                  key={role}
                  type="button"
                  onClick={() => setSelectedRole(role)}
                  className={[
                    'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
                    selectedRole === role
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
                  ].join(' ')}
                >
                  {role} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Chips */}
        {/* <div>
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
                {filteredOperators.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocalStatusFilter('done')}
              className={[
                'flex-1 py-1.5 px-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 border',
                localStatusFilter === 'done'
                  ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs font-bold'
                  : 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100'
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
                  : 'bg-amber-50/70 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-300 hover:bg-amber-100'
              ].join(' ')}
            >
              <Clock size={13} />
              <span>Pending</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-700/20 dark:bg-amber-400/20 font-mono">
                {pendingCount}
              </span>
            </button>
          </div>
        </div> */}
      </div>

      {/* ── 4. Unified Batch Action Bar (Collapsible) ───────────────────────────────────── */}
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
                  Operator Shift Batch Apply
                </h3>
                {selectedOperatorIds.length > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white shadow-2xs animate-pulse">
                    {selectedOperatorIds.length} Selected
                  </span>
                ) : (
                  <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                    (Optional)
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                {isBatchOpen
                  ? 'Set shift times for selected operators in 1-tap.'
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

        {/* Collapsible Body */}
        {isBatchOpen && (
          <div className="p-3.5 pt-1 space-y-3 border-t border-slate-200/80 dark:border-slate-800">
            {/* Header & Presets */}
            <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
              <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                Quick Presets:
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSetPreset('07:00', '17:00')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition-colors cursor-pointer"
                >
                  Std Day (07-17)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset('07:00', '12:00')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Half Day (07-12)
                </button>
                <button
                  type="button"
                  onClick={() => handleSetPreset('07:00', '19:00')}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 transition-colors cursor-pointer"
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
                  onChange={(e) => setBatchOutTime(e.target.value)}
                  className="text-xs font-bold text-blue-950 dark:text-blue-100 bg-transparent focus:outline-none"
                />
              </div>
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
                <span>{isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredOperators.length})`}</span>
              </button>

              <div className="flex items-center gap-1.5 flex-wrap">
                {selectedOperatorIds.length > 0 && !isDayLocked && (
                  <>
                    <button
                      type="button"
                      onClick={handleBatchResetToDraft}
                      className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors cursor-pointer"
                      title="Revert selected operators to Draft"
                    >
                      <Clock size={12} />
                      <span>Draft</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleBatchRemoveOperators}
                      className="flex items-center gap-1 py-1.5 px-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 text-red-600 dark:text-red-400 font-semibold text-xs transition-colors cursor-pointer"
                      title={`Remove ${selectedOperatorIds.length} selected operator(s) from today`}
                    >
                      <Trash2 size={12} />
                      <span>Remove (${selectedOperatorIds.length})</span>
                    </button>
                  </>
                )}

                <button
                  type="button"
                  onClick={handleApplyBatchIn}
                  disabled={selectedOperatorIds.length === 0}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-2xs active:scale-[0.98] cursor-pointer"
                  title={`Set In-Time (${batchInTime}) only`}
                >
                  <LogIn size={12} />
                  <span>In Only</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyBatchOut}
                  disabled={selectedOperatorIds.length === 0}
                  className="flex items-center gap-1 py-1.5 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-2xs active:scale-[0.98] cursor-pointer"
                  title={`Set Out-Time (${batchOutTime}) only`}
                >
                  <LogOut size={12} />
                  <span>Out Only</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyBatchFullShift}
                  disabled={selectedOperatorIds.length === 0}
                  className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-xs active:scale-[0.98] cursor-pointer"
                  title={`Apply both ${batchInTime} - ${batchOutTime} to ${selectedOperatorIds.length} operators`}
                >
                  <Check size={13} className="stroke-[3]" />
                  <span>Apply Both (${selectedOperatorIds.length})</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Operator Cards List ────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {filteredOperators.length === 0 ? (
          <div className="py-12 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 space-y-3">
            <HardHat className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-1" />
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {operators.length === 0
                  ? isPoolMode
                    ? 'No operators added yet'
                    : 'No operators assigned'
                  : 'No operators found'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                {operators.length === 0
                  ? isPoolMode
                    ? 'Add operators from the site pool or copy from your previous shift.'
                    : 'No operators have been assigned to you for today. Please contact your site administrator or project manager to assign operators.'
                  : 'No operators matching the selected filter or search.'}
              </p>
            </div>
            {operators.length === 0 && isPoolMode && !isDayLocked && (
              <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                {recentPastGang && recentPastGang.operatorCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsOperatorPoolModalOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs transition-colors cursor-pointer"
                  >
                    <History size={14} />
                    <span>Copy Past Operators ({recentPastGang.dayName})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOperatorPoolModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors cursor-pointer"
                >
                  <Plus size={14} className="stroke-[3]" />
                  <span>Add from Site Pool</span>
                </button>
              </div>
            )}
            {operators.length === 0 && !isPoolMode && (
              <div className="pt-1 flex items-center justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  <Info size={14} className="text-blue-500 shrink-0" />
                  <span>Admin Assignment Mode Active</span>
                </span>
              </div>
            )}
          </div>
        ) : (
          filteredOperators.map((operator) => {
                        const isSelected = selectedOperatorIds.includes(operator.id);
            const isExpanded = expandedId === operator.id;
            const { shift, operatingHours, idleHours } = getOperatorHourBreakdown(operator);
            const splits = operator.equipmentSplits || [];

            const isDone = Boolean(operator.inTime) && 
              Boolean(operator.outTime) && 
              operator.status === 'done';

            return (
              <div
                key={operator.id}
                className={[
                  'rounded-2xl border transition-all duration-150 overflow-hidden shadow-2xs',
                  isSelected
                    ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
                    : isDone
                    ? 'border-emerald-500 dark:border-emerald-500 bg-emerald-50/15 dark:bg-emerald-950/20 ring-1 ring-emerald-500/30 shadow-emerald-500/5'
                    : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
                ].join(' ')}
              >
                {/* ── 1. Card Top Row: Checkbox, Operator Identity & Quick Done / Chevron ── */}
                <div className="p-3 pb-2 flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800/80">
                  {/* Selection Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleOperatorSelect(operator.id, e);
                    }}
                    className="p-1 -ml-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none flex-shrink-0 cursor-pointer"
                    aria-label={`Select ${operator.employeeNumber}`}
                  >
                    {isSelected ? (
                      <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square size={20} className="text-slate-400" />
                    )}
                  </button>

                  {/* Operator Identifiers - Clicking expands/collapses the card! */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : operator.id)}
                    className="flex-1 min-w-0 cursor-pointer select-none"
                    title={`Click to ${isExpanded ? 'collapse' : 'expand'} details for ${operator.callingName || operator.employeeNumber}`}
                  >
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                        {operator.employeeNumber}
                      </span>
                      <span className="text-slate-400 dark:text-slate-600 font-bold">·</span>
                      <span className="text-xs text-slate-800 dark:text-slate-200 truncate font-bold">
                        {operator.callingName}
                      </span>
                      {isDone && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 flex items-center gap-0.5 shadow-2xs">
                          <CheckCircle2 size={10} className="text-emerald-600 dark:text-emerald-400" />
                          Done
                        </span>
                      )}
                    </div>

                    {operator.claimedBySupervisor && !operator.claimedByMe && (
                      <div className="mt-1 flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-[10px] text-amber-900 dark:text-amber-200 font-semibold">
                        <Lock size={10} className="text-amber-600 shrink-0" />
                        <span>Logged by Sup. {operator.claimedBySupervisor} ({operator.claimedInTime || '--:--'} - {operator.claimedOutTime || '--:--'}{operator.claimedMachineCodes && operator.claimedMachineCodes.length > 0 ? ` on ${operator.claimedMachineCodes.join(', ')}` : ''})</span>
                      </div>
                    )}
                  </div>

                  {/* Top-Right Controls: Remove, Done Button & Expand Chevron */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Quick Done / Revert Toggle Button */}
                    {!isDayLocked && (
                      <button
                        type="button"
                        onClick={() => handleToggleOperatorDone(operator.id)}
                        className={[
                          'inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-xl shadow-2xs transition-all active:scale-95 cursor-pointer',
                          isDone
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-700 hover:bg-emerald-200'
                            : 'bg-emerald-600 text-white hover:bg-emerald-700'
                        ].join(' ')}
                        title={isDone ? 'Marked as Done. Click to revert back to Draft' : 'Mark operator as Done'}
                      >
                        <Check size={12} className={isDone ? 'stroke-[2.5]' : 'stroke-[3]'} />
                        <span>Done</span>
                      </button>
                    )}

                    {/* Remove Operator button */}
                    {!isDayLocked && (
                      <button
                        type="button"
                        onClick={() => handleRemoveOperator(operator.id)}
                        className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        title={`Remove ${operator.callingName || operator.employeeNumber} from today's list`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}

                    {/* Chevron Button */}
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : operator.id)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer focus:outline-none"
                      aria-label={isExpanded ? "Collapse operator details" : "Expand operator details"}
                      title={isExpanded ? "Collapse details" : "Expand details"}
                    >
                      {isExpanded ? <ChevronUp size={18} className="text-blue-600 dark:text-blue-400" /> : <ChevronDown size={18} />}
                    </button>
                  </div>
                </div>

                {/* ── 2. Card Time & Shift Action Bar (Responsive Mobile Row) ── */}
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
                        value={operator.inTime || ''}
                        onChange={(e) => handleIndividualTimeChange(operator.id, e.target.value, operator.outTime)}
                        className={[
                          'w-[64px] text-xs font-bold rounded-lg px-0.5 py-0.5 border-0 transition-all text-center focus:outline-none focus:ring-1 focus:ring-emerald-500 bg-transparent cursor-pointer',
                          operator.inTime
                            ? 'text-emerald-800 dark:text-emerald-200 font-mono'
                            : 'text-slate-400 dark:text-slate-500'
                        ].join(' ')}
                        title={operator.inTime ? 'In-Time (click to edit)' : 'Click to choose In-Time'}
                      />
                      {!operator.inTime && !isDayLocked && (
                        <button
                          type="button"
                          onClick={() => handleIndividualTimeChange(operator.id, batchInTime, operator.outTime)}
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
                        value={operator.outTime || ''}
                        onChange={(e) => handleIndividualTimeChange(operator.id, operator.inTime, e.target.value)}
                        className={[
                          'w-[64px] text-xs font-bold rounded-lg px-0.5 py-0.5 border-0 transition-all text-center focus:outline-none focus:ring-1 focus:ring-blue-500 bg-transparent cursor-pointer',
                          operator.outTime
                            ? 'text-blue-800 dark:text-blue-200 font-mono'
                            : 'text-slate-400 dark:text-slate-500'
                        ].join(' ')}
                        title={operator.outTime ? 'Out-Time (click to edit)' : 'Click to choose Out-Time'}
                      />
                      {!operator.outTime && !isDayLocked && (
                        <button
                          type="button"
                          onClick={() => handleIndividualTimeChange(operator.id, operator.inTime || batchInTime, batchOutTime)}
                          className="text-[9px] font-bold px-1.5 py-0.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-md cursor-pointer shadow-2xs"
                          title={`Quick set Out to ${batchOutTime}`}
                        >
                          Out
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Shift Hours Badge */}
                  {operator.inTime && operator.outTime && (
                    <span className="text-[11px] font-bold font-mono px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800 shadow-2xs flex-shrink-0" title={`Computed shift: ${shift}h (Operating: ${operatingHours}h, Idle: ${idleHours}h)`}>
                      {formatHhmm(shift)}h
                      {operator.otHours > 0 && <span className="text-[9px] text-amber-600 dark:text-amber-400 ml-0.5">+${operator.otHours}h</span>}
                    </span>
                  )}
                </div>

                {/* Machine Summary Badges in Card Footer (Collapsed View) */}
                {!isExpanded && (
                  <div className="px-3.5 pb-2.5 pt-0.5 flex items-center justify-between gap-2 flex-wrap text-xs bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {splits.length > 0 ? (
                        splits.map((s, idx) => {
                          const eq = allEquipmentOptions.find((e) => e.id === s.equipmentId) || equipment.find((e) => e.id === s.equipmentId);
                          const sharedWith = getSharedEquipmentOperators(s.equipmentId, operator.id);
                          return (
                            <span 
                              key={s.id || idx}
                              className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                            >
                              <Tractor size={11} />
                              <span>{eq ? `${eq.code}` : 'Machine'}: {s.hours}h</span>
                              {sharedWith.length > 0 && (
                                <span className="text-[9px] text-blue-500 font-normal ml-0.5" title={`Also driven by ${sharedWith.join(', ')}`}>
                                  (Shared)
                                </span>
                              )}
                            </span>
                          );
                        })
                      ) : null}

                      {/* Idle Badge (ZXQOPRIDLE) */}
                      {idleHours > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          <PauseCircle size={11} className="text-amber-600" />
                          <span>Idle (ZXQOPRIDLE): {idleHours}h</span>
                        </span>
                      )}

                      {splits.length === 0 && idleHours === 0 && (
                        <span className="text-[10px] text-slate-400 font-medium">
                          No machine logged
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setExpandedId(operator.id)}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 cursor-pointer"
                    >
                      Edit Machines ({splits.length}) →
                    </button>
                  </div>
                )}

                {/* ── Expanded Content: Multi-Vehicle Management & Machine Splits ── */}
                {isExpanded && (
                  <div className="px-3.5 pb-4 pt-3 border-t border-slate-100 dark:border-slate-700/80 space-y-3.5 bg-slate-50/60 dark:bg-slate-900/50">
                    {/* Multi-Vehicle Allocation Section */}
                    <div className="p-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200/90 dark:border-slate-700 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Tractor size={14} className="text-blue-600" />
                          <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100">
                            Assigned Vehicles / Machines
                          </h4>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddEquipmentSplit(operator.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 text-[11px] font-bold transition-colors"
                        >
                          <Plus size={12} />
                          <span>Add Vehicle</span>
                        </button>
                      </div>

                      {/* Vehicle Splits List */}
                      {splits.length === 0 ? (
                        <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs space-y-1">
                          <div className="flex items-center gap-1.5 text-amber-900 dark:text-amber-200 font-bold">
                            <PauseCircle size={14} className="text-amber-600" />
                            <span>100% Idle Shift ({shift}h)</span>
                          </div>
                          <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                            No vehicles currently assigned. All <span className="font-mono font-bold">{shift}h</span> shift time is automatically mapped to <span className="font-mono font-bold">ZXQOPRIDLE</span> (Exter. Equipment Operator Idle).
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2.5 w-full">
                          {splits.map((split, sIdx) => {
                            const sharedWith = getSharedEquipmentOperators(split.equipmentId, operator.id);

                            return (
                              <div 
                                key={split.id || sIdx}
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 flex flex-col gap-2 max-w-full"
                              >
                                {/* Row 1: Equipment Select & Hours Input */}
                                <div className="flex items-center gap-1.5 w-full min-w-0">
                                  <SearchableEquipmentSelect
                                    disabled={isDayLocked}
                                    value={split.equipmentId}
                                    onChange={(eqId) => handleUpdateEquipmentSplit(operator.id, split.id, 'equipmentId', eqId)}
                                    options={allEquipmentOptions}
                                    placeholder="Search & choose vehicle..."
                                  />

                                  <div className="flex items-center gap-1 bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                                    <input
                                      type="number"
                                      min="0"
                                      max="24"
                                      step="0.5"
                                      value={split.hours === 0 ? '0' : (split.hours || '')}
                                      onChange={(e) => handleUpdateEquipmentSplit(operator.id, split.id, 'hours', e.target.value)}
                                      className="w-12 text-center text-xs font-bold text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none"
                                      placeholder="0.0"
                                    />
                                    <span className="text-[10px] text-slate-400 font-medium">hrs</span>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveEquipmentSplit(operator.id, split.id)}
                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors shrink-0"
                                    title="Remove vehicle"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>

                                {/* Row 2: Shared Info */}
                                {sharedWith.length > 0 && (
                                  <div className="flex items-center justify-end gap-1.5 flex-wrap text-[10px] pt-0.5">
                                    <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 shrink-0">
                                      <Sparkles size={10} />
                                      <span>Shared with: <strong>{sharedWith.join(', ')}</strong></span>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* ── Auto-Balanced Idle Calculation Summary ── */}
                      <div className="pt-2.5 border-t border-slate-100 dark:border-slate-700/80 flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            Shift: <strong className="text-slate-800 dark:text-slate-200 font-mono">{formatHhmm(shift)}h</strong>
                          </span>
                          <span className="text-slate-300 dark:text-slate-600">•</span>
                          <span className="text-[11px] text-blue-700 dark:text-blue-300 font-semibold">
                            Operating: <strong className="font-mono">{formatHhmm(operatingHours)}h</strong>
                          </span>
                        </div>

                        {idleHours > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100/70 text-amber-900 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/80 dark:border-amber-800">
                            <PauseCircle size={11} className="text-amber-600" />
                            <span>Auto-Idle (ZXQOPRIDLE): {formatHhmm(idleHours)}h</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <Check size={12} />
                            <span>100% Machine Active</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── Auto-save Status & Done Button ── */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px]">
                          <Check size={13} className="text-emerald-500" />
                          <span>Auto-saved</span>
                        </span>
                        {!isDayLocked && (
                          <button
                            type="button"
                            onClick={() => handleRemoveOperator(operator.id)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                            title="Remove this operator from today's shift"
                          >
                            <Trash2 size={12} />
                            <span>Remove</span>
                          </button>
                        )}
                      </div>
                      {!isDayLocked && (
                        <button
                          type="button"
                          onClick={() => handleToggleOperatorDone(operator.id)}
                          className={[
                            'flex items-center gap-1.5 px-4 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer',
                            isDone
                              ? 'bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                              : 'bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white'
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
      {/* ── Site Operator Pool Modal ── */}
      {isPoolMode && (
        <SiteOperatorPoolModal
          isOpen={isOperatorPoolModalOpen}
          onClose={() => setIsOperatorPoolModalOpen(false)}
          selectedDate={selectedDate || ''}
          currentOperators={operators}
          onAddOperator={handleAddOperatorFromPool}
          onAddOperators={handleAddMultipleOperatorsFromPool}
          projectId={projectId}
        />
      )}
    </div>
  );
}
