import { useState, useMemo } from 'react';
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
  Sparkles
} from 'lucide-react';
import type { 
  OperatorEntry, 
  EquipmentLogEntry,
  OperatorEquipmentSplit 
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
  searchQuery?: string;
  statusFilter?: 'all' | 'pending' | 'done';
  isDayLocked?: boolean;
}

// Helper to get logged working hours on a machine from equipment logs
function getEquipmentLoggedHours(eq?: EquipmentLogEntry): number {
  if (!eq) return 0;
  if (typeof eq.workingHours === 'number' && eq.workingHours > 0) return eq.workingHours;
  if (typeof eq.netHours === 'number' && eq.netHours > 0) return eq.netHours;
  if (typeof eq.hoursValue === 'number' && eq.hoursValue > 0) return eq.hoursValue;
  if (typeof eq.daysValue === 'number' && eq.daysValue > 0) return eq.daysValue * 8.0;
  return 0;
}

export function OperatorEntryView({
  operators,
  equipment,
  onSaveOperators,
  searchQuery: externalSearchQuery = '',
  statusFilter: externalStatusFilter = 'all',
  isDayLocked = false,
}: OperatorEntryViewProps) {
  // Mode: In Time or Out Time (matching Labor view layout)
  const [tabMode, setTabMode] = useState<'in' | 'out'>('in');

  // Internal search and filters
  const [localSearch, setLocalSearch] = useState('');
  const [selectedRole, setSelectedRole] = useState<string>('all');
  const [localStatusFilter, setLocalStatusFilter] = useState<'all' | 'pending' | 'done'>('all');

  // Selection state for batch actions
  const [selectedOperatorIds, setSelectedOperatorIds] = useState<string[]>([]);

  // Expanded card state
  const [expandedId, setExpandedId] = useState<string | null>(null);

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
        const eq = equipment.find((e) => e.id === s.equipmentId);
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
  const pendingCount = operators.length - completedCount;

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
      
      const defaultEq = equipment.find((eq) => !currentSplits.some((s) => s.equipmentId === eq.id)) || equipment[0];
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
      } else if (currentSplits.length === 1) {
        // Thawa wahanayak add kaloth dekata bedenna (50/50 split)
        const targetMins = hhmmToMinutes(targetShift);
        const halfMins = Math.round(targetMins / 2);
        const half1 = minutesToHhmm(halfMins);
        const half2 = minutesToHhmm(targetMins - halfMins);

        const updatedFirst: OperatorEquipmentSplit = {
          ...currentSplits[0],
          hours: half1,
        };
        const newSplit: OperatorEquipmentSplit = {
          id: `split-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
          equipmentId: defaultEqId,
          hours: half2,
        };
        newSplits = [updatedFirst, newSplit];
      } else {
        // 3rd or more vehicle: assign remaining hours if any
        const currentSum = sumHhmm(currentSplits.map((s) => s.hours));
        const remMins = Math.max(0, hhmmToMinutes(targetShift) - hhmmToMinutes(currentSum));
        const remainingHours = minutesToHhmm(remMins);
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
      const targetShift = Number(o.shiftHours) || 8.0;
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

      // field === 'hours'
      const valNum = value === '' ? 0 : parseFloat(value);
      const newHours = isNaN(valNum) ? 0 : Math.max(0, valNum);

      let splits: OperatorEquipmentSplit[];
      if (currentSplits.length === 2) {
        // Auto-balance the other vehicle to take remaining shift hours
        const balancedMins = Math.max(0, hhmmToMinutes(targetShift) - hhmmToMinutes(newHours));
        const balancedHours = minutesToHhmm(balancedMins);
        splits = currentSplits.map((s) => {
          if (s.id === splitId) {
            return { ...s, hours: newHours };
          } else {
            return { ...s, hours: balancedHours };
          }
        });
      } else {
        splits = currentSplits.map((s) => {
          if (s.id !== splitId) return s;
          return { ...s, hours: newHours };
        });
      }

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

      {/* ── 1. IN / OUT Dual Tabs ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-200/70 dark:bg-slate-900/90 rounded-2xl border border-slate-300/80 dark:border-slate-800 shadow-inner">
        <button
          type="button"
          onClick={() => {
            setTabMode('in');
            setExpandedId(null);
          }}
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
            {inMarkedCount}/{operators.length}
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
          <span>OUT & VEHICLES</span>
          <span className={[
            'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
            tabMode === 'out' ? 'bg-blue-700/80 text-blue-100' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          ].join(' ')}>
            {outMarkedCount}/{operators.length}
          </span>
        </button>
      </div>

      {/* ── 2. Search Bar ─────────────────────────────────────────────────── */}
      <div className="relative">
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
        </div>
      </div>

      {/* ── 4. Dynamic Action Bar ─────────────────────────────────────────── */}
      {tabMode === 'in' ? (
        /* ── IN MODE ACTION BAR ── */
        <div className="p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
                <LogIn size={15} />
              </div>
              <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200">
                Morning In-Time
              </h3>
            </div>

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
              <span>{isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredOperators.length})`}</span>
            </button>

            <button
              type="button"
              onClick={handleApplyBatchIn}
              disabled={selectedOperatorIds.length === 0}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-xs active:scale-[0.98]"
            >
              <Check size={14} />
              <span>Apply In-Time ({selectedOperatorIds.length})</span>
            </button>
          </div>
        </div>
      ) : (
        /* ── OUT ACTION BAR ── */
        <div className="p-3.5 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <LogOut size={15} />
              </div>
              <div>
                <h3 className="text-xs font-bold text-blue-950 dark:text-blue-200">
                  Bulk Out-Time Quick Apply
                </h3>
                <p className="text-[10px] text-blue-700/80 dark:text-blue-300/80">
                  Set shift out-time for selected operators. Assign machines individually in each card below.
                </p>
              </div>
            </div>

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
              <span>{isAllFilteredSelected ? 'Deselect All' : `Select All (${filteredOperators.length})`}</span>
            </button>

            <button
              type="button"
              onClick={handleApplyBatchOut}
              disabled={selectedOperatorIds.length === 0}
              className="flex items-center gap-1.5 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold text-xs transition-colors shadow-xs active:scale-[0.98]"
            >
              <Check size={14} />
              <span>Apply Out-Time ({selectedOperatorIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 5. Operator Cards List ────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {filteredOperators.length === 0 ? (
          <div className="py-12 px-4 text-center bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <HardHat className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No operators found
            </p>
          </div>
        ) : (
          filteredOperators.map((operator) => {
            const isSelected = selectedOperatorIds.includes(operator.id);
            const isExpanded = tabMode === 'out' && expandedId === operator.id;
            const { shift, operatingHours, idleHours } = getOperatorHourBreakdown(operator);
            const splits = operator.equipmentSplits || [];

            const isDone = tabMode === 'out' && 
              Boolean(operator.inTime) && 
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
                {/* Main Card Header */}
                <div className="p-3 flex items-center justify-between gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => handleToggleOperatorSelect(operator.id, e)}
                    className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none"
                    aria-label={`Select ${operator.employeeNumber}`}
                  >
                    {isSelected ? (
                      <CheckSquare size={20} className="text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square size={20} className="text-slate-400" />
                    )}
                  </button>

                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : operator.id)}
                    className="flex-1 min-w-0 flex items-center gap-2.5 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs text-slate-900 dark:text-slate-100 font-mono">
                          {operator.employeeNumber}
                        </span>
                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate">
                          {operator.callingName}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {operator.designation} {operator.licenseNo ? `· Lic: ${operator.licenseNo}` : ''}
                      </p>
                    </div>
                  </div>

                  {/* Badges based on mode */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : operator.id)}
                    className="flex items-center gap-2 flex-shrink-0 cursor-pointer text-right"
                  >
                    <div>
                      {isDone && tabMode === 'out' ? (
                        <button
                          type="button"
                          disabled={isDayLocked}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleOperatorDone(operator.id);
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900/60 hover:bg-emerald-200 dark:hover:bg-emerald-800/80 px-2 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-700 shadow-2xs transition-colors cursor-pointer"
                          title="Click to revert back to Draft"
                        >
                          <Check size={11} className="stroke-[3]" /> Done
                        </button>
                      ) : operator.inTime ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          In: {operator.inTime}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-200 dark:border-amber-800">
                          Pending In
                        </span>
                      )}

                      {tabMode === 'out' && (
                        <div className="text-[10px] mt-0.5 text-slate-400">
                          {operator.outTime ? (
                            <span className="font-medium text-slate-700 dark:text-slate-300">Out: {operator.outTime} ({shift}h)</span>
                          ) : (
                            <span>Pending Out</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Quick Done button on card header if not yet done */}
                    {tabMode === 'out' && !isDayLocked && !isDone && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMarkOperatorDone(operator.id);
                        }}
                        className="flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 px-2 py-1 rounded-lg shadow-2xs transition-all cursor-pointer"
                        title="Quick mark Done"
                      >
                        <Check size={11} className="stroke-[3]" />
                        <span>Done</span>
                      </button>
                    )}

                    {/* Chevron Icon */}
                    {tabMode === 'out' && (
                      <div className="text-slate-400 pl-0.5">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </div>
                    )}
                  </div>
                </div>

                {/* Machine Summary Badges in Card Footer (Shown on OUT mode when collapsed) */}
                {tabMode === 'out' && !isExpanded && (
                  <div className="px-3.5 pb-2.5 pt-0.5 flex items-center justify-between gap-2 flex-wrap text-xs bg-slate-50/50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {splits.length > 0 ? (
                        splits.map((s, idx) => {
                          const eq = equipment.find((e) => e.id === s.equipmentId);
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
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      Edit Machines ({splits.length}) →
                    </button>
                  </div>
                )}

                {/* ── Expanded Content: Multi-Vehicle Management & Times ── */}
                {isExpanded && (
                  <div className="px-3.5 pb-4 pt-3 border-t border-slate-100 dark:border-slate-700/80 space-y-3.5 bg-slate-50/60 dark:bg-slate-900/50">
                    {/* In / Out Pickers */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                          In Time
                        </label>
                        <input
                          type="time"
                          value={operator.inTime}
                          onChange={(e) => handleIndividualTimeChange(operator.id, e.target.value, operator.outTime)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 shadow-2xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mb-1">
                          Out Time
                        </label>
                        <input
                          type="time"
                          value={operator.outTime}
                          onChange={(e) => handleIndividualTimeChange(operator.id, operator.inTime, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 shadow-2xs"
                        />
                      </div>
                    </div>

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
                            const matchedEq = equipment.find((e) => e.id === split.equipmentId);
                            const eqLoggedHours = getEquipmentLoggedHours(matchedEq);

                            return (
                              <div 
                                key={split.id || sIdx}
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-700 flex flex-col gap-2 max-w-full overflow-hidden"
                              >
                                {/* Row 1: Equipment Select & Hours Input */}
                                <div className="flex items-center gap-1.5 w-full min-w-0">
                                  <select
                                    value={split.equipmentId}
                                    onChange={(e) => handleUpdateEquipmentSplit(operator.id, split.id, 'equipmentId', e.target.value)}
                                    className="flex-1 min-w-0 w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 truncate"
                                  >
                                    <option value="">-- Choose Equipment --</option>
                                    {equipment.map((eq) => {
                                      const lh = getEquipmentLoggedHours(eq);
                                      const lhStr = lh > 0 ? ` · [${lh}h logged]` : '';
                                      return (
                                        <option key={eq.id} value={eq.id}>
                                          {eq.code} · {eq.name} {eq.vehicleNo ? `(${eq.vehicleNo})` : ''}{lhStr}
                                        </option>
                                      );
                                    })}
                                  </select>

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

                                {/* Row 2: Equipment Logged Hours Hint & Quick Fill Buttons */}
                                <div className="flex items-center justify-between gap-1.5 flex-wrap text-[10px] pt-0.5">
                                  {matchedEq && (
                                    <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 flex-wrap">
                                      <span>Machine Logged:</span>
                                      <strong className="text-blue-700 dark:text-blue-300 font-mono">
                                        {eqLoggedHours > 0 ? `${eqLoggedHours}h` : '0h (Pending)'}
                                      </strong>
                                      {eqLoggedHours > 0 && split.hours !== eqLoggedHours && (
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateEquipmentSplit(operator.id, split.id, 'hours', eqLoggedHours)}
                                          className="text-[9px] font-bold text-blue-600 dark:text-blue-400 underline hover:text-blue-800 ml-1"
                                        >
                                          Set to {eqLoggedHours}h
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {sharedWith.length > 0 && (
                                    <div className="flex items-center gap-1 text-[10px] text-blue-600 dark:text-blue-400 shrink-0">
                                      <Sparkles size={10} />
                                      <span>Shared with: <strong>{sharedWith.join(', ')}</strong></span>
                                    </div>
                                  )}
                                </div>
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
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-[10px]">
                        <Check size={13} className="text-emerald-500" />
                        <span>Auto-saved</span>
                      </span>
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
    </div>
  );
}
