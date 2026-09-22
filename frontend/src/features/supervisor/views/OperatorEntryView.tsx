import { useState, useMemo } from 'react';
import { 
  HardHat, 
  Tractor, 
  AlertTriangle, 
  Save, 
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
  CheckCircle2
} from 'lucide-react';
import type { 
  OperatorEntry, 
  EquipmentLogEntry 
} from '../services/supervisorStorageService';

interface OperatorEntryViewProps {
  operators: OperatorEntry[];
  equipment: EquipmentLogEntry[];
  onSaveOperators: (updated: OperatorEntry[]) => void;
  searchQuery?: string;
  statusFilter?: 'all' | 'pending' | 'done';
}

function computeHours(inTime: string, outTime: string): { shift: number; ot: number } {
  if (!inTime || !outTime) return { shift: 0, ot: 0 };
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  let totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  if (totalMinutes < 0) totalMinutes += 24 * 60;
  if (totalMinutes >= 300) totalMinutes -= 60; // Lunch deduction

  const shiftHours = totalMinutes > 0 ? parseFloat((totalMinutes / 60).toFixed(1)) : 0;
  const otHours = shiftHours > 8.0 ? parseFloat((shiftHours - 8.0).toFixed(1)) : 0;

  return { shift: shiftHours, ot: otHours };
}

export function OperatorEntryView({
  operators,
  equipment,
  onSaveOperators,
  searchQuery: externalSearchQuery = '',
  statusFilter: externalStatusFilter = 'all',
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

  // Save feedback state
  const [individualSaveId, setIndividualSaveId] = useState<string | null>(null);

  // ── IN MODE BATCH STATE ──
  const [batchInTime, setBatchInTime] = useState('07:00');

  // ── OUT MODE BATCH STATE (Equipment only, no activity codes) ──
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
      const mappedEquip = equipment.find((e) => e.id === o.assignedEquipmentId);

      const matchesSearch = 
        !search ||
        (o.employeeNumber && o.employeeNumber.toLowerCase().includes(search)) ||
        o.callingName.toLowerCase().includes(search) ||
        o.designation.toLowerCase().includes(search) ||
        (o.licenseNo && o.licenseNo.toLowerCase().includes(search)) ||
        (mappedEquip && mappedEquip.code.toLowerCase().includes(search)) ||
        (mappedEquip && mappedEquip.name.toLowerCase().includes(search));

      if (!matchesSearch) return false;

      // Role filter
      if (selectedRole !== 'all' && o.designation !== selectedRole) {
        return false;
      }

      // Status filter
      const isComplete = o.inTime && o.outTime && o.assignedEquipmentId;
      if (effectiveStatus === 'pending') {
        return !isComplete;
      }
      if (effectiveStatus === 'done') {
        return isComplete;
      }

      return true;
    });
  }, [operators, equipment, effectiveSearch, selectedRole, effectiveStatus]);

  // Check if an equipment is already mapped by another operator
  const getMappedConflict = (equipmentId: string, currentOperatorId: string): OperatorEntry | undefined => {
    if (!equipmentId) return undefined;
    return operators.find((o) => o.id !== currentOperatorId && o.assignedEquipmentId === equipmentId);
  };

  // Stats
  const inMarkedCount = operators.filter((o) => !!o.inTime).length;
  const outMarkedCount = operators.filter((o) => !!o.outTime && !!o.assignedEquipmentId).length;
  const completedCount = operators.filter((o) => o.inTime && o.outTime && o.assignedEquipmentId).length;
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
      const isComplete = inTime && outTime && o.assignedEquipmentId;

      return {
        ...o,
        inTime,
        shiftHours: shift,
        otHours: ot,
        status: (isComplete ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
        lastSavedAt: `In: ${batchInTime}`,
      };
    });

    onSaveOperators(updated);
  };

  // ── APPLY BATCH OUT TIME & EQUIPMENT (No activity codes) ──
  const handleApplyBatchOut = () => {
    if (selectedOperatorIds.length === 0) return;

    const updated = operators.map((o) => {
      if (!selectedOperatorIds.includes(o.id)) return o;
      const inTime = o.inTime || '07:00';
      const outTime = batchOutTime;
      const { shift, ot } = computeHours(inTime, outTime);

      return {
        ...o,
        inTime,
        outTime,
        shiftHours: shift,
        otHours: ot,
        assignedEquipmentId: o.assignedEquipmentId,
        status: o.assignedEquipmentId ? ('done' as const) : ('draft' as const),
        lastSavedAt: `Out: ${batchOutTime}`,
      };
    });

    onSaveOperators(updated);
  };

  // ── INDIVIDUAL UPDATES ──
  const handleIndividualTimeChange = (id: string, inTime: string, outTime: string) => {
    const { shift, ot } = computeHours(inTime, outTime);
    const updated = operators.map((o) => {
      if (o.id !== id) return o;
      const isComplete = inTime && outTime && o.assignedEquipmentId;
      return {
        ...o,
        inTime,
        outTime,
        shiftHours: shift,
        otHours: ot,
        status: (isComplete ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
      };
    });
    onSaveOperators(updated);
  };

  const handleIndividualEquipmentChange = (id: string, equipmentId: string) => {
    const updated = operators.map((o) => {
      if (o.id !== id) return o;
      const isComplete = o.inTime && o.outTime && equipmentId;
      return {
        ...o,
        assignedEquipmentId: equipmentId,
        status: (isComplete ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
      };
    });
    onSaveOperators(updated);
  };

  const handleIndividualSave = (id: string) => {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const updated = operators.map((o) => {
      if (o.id !== id) return o;
      const isComplete = o.inTime && o.outTime && o.assignedEquipmentId;
      return {
        ...o,
        status: (isComplete ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
        lastSavedAt: now,
      };
    });
    onSaveOperators(updated);
    setIndividualSaveId(id);
    setTimeout(() => setIndividualSaveId(null), 2000);
  };

  const isAllFilteredSelected = 
    filteredOperators.length > 0 && 
    filteredOperators.every((o) => selectedOperatorIds.includes(o.id));

  return (
    <div className="space-y-3 pb-16 animate-in fade-in duration-150">
      {/* ── 1. IN / OUT Dual Tabs (Compact, Matches Labor View) ─────────────────── */}
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
          <span>OUT TIME</span>
          <span className={[
            'px-1.5 py-0.2 rounded-full text-[10px] font-mono',
            tabMode === 'out' ? 'bg-blue-700/80 text-blue-100' : 'bg-slate-300 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
          ].join(' ')}>
            {outMarkedCount}/{operators.length}
          </span>
        </button>
      </div>

      {/* ── 2. Search Bar ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          placeholder="Search operator code, name, machine, license..."
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

      {/* ── 3. Role & Status Filter Chips ─────────────────────────────────────── */}
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

      {/* ── 4. Dynamic Action Bar (Minimal Text) ───────────────────────────────── */}
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
        /* ── OUT & MACHINE PAIRING ACTION BAR (No Activity Codes) ── */
        <div className="p-3.5 rounded-2xl bg-blue-50/90 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 shadow-2xs space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                <LogOut size={15} />
              </div>
              <h3 className="text-xs font-bold text-blue-950 dark:text-blue-200">
                Out-Time & Machine Pairing
              </h3>
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
              <span>Apply to {selectedOperatorIds.length} Operators</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 5. Operator Cards List ────────────────────────────────────────────── */}
      <div className="space-y-2">
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
            const mappedEquip = equipment.find((e) => e.id === operator.assignedEquipmentId);
            const conflict = getMappedConflict(operator.assignedEquipmentId, operator.id);
            const isSavedJustNow = individualSaveId === operator.id;

            return (
              <div
                key={operator.id}
                className={[
                  'rounded-2xl border transition-all duration-150 overflow-hidden shadow-2xs',
                  isSelected
                    ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/40 ring-1 ring-blue-500/20'
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
                    {/* <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-bold flex items-center justify-center text-[10px] tracking-tight flex-shrink-0 border border-amber-300 dark:border-amber-800 font-mono">
                      {operator.employeeNumber}
                    </div> */}

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
                        {operator.designation}
                      </p>
                    </div>
                  </div>

                  {/* Badges based on mode */}
                  <div 
                    onClick={() => setExpandedId(isExpanded ? null : operator.id)}
                    className="flex items-center gap-2 flex-shrink-0 cursor-pointer text-right"
                  >
                    <div>
                      {operator.inTime ? (
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
                            <span className="font-medium text-slate-700 dark:text-slate-300">Out: {operator.outTime}</span>
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

                {/* Machine Assignment Badge (Shown on OUT mode or if assigned) */}
                {tabMode === 'out' && !isExpanded && (
                  <div className="px-3.5 pb-2.5 pt-0.5 flex items-center gap-2 flex-wrap text-xs">
                    {mappedEquip ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        <Tractor size={12} /> {mappedEquip.code} · {mappedEquip.name}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800">
                        <AlertTriangle size={11} /> Unmapped Machine
                      </span>
                    )}

                    {conflict && (
                      <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                        <AlertTriangle size={11} /> Also mapped: {conflict.employeeNumber}
                      </span>
                    )}
                  </div>
                )}

                {/* ── Expanded Content: Single Operator Edit ── */}
                {isExpanded && (
                  <div className="px-3.5 pb-4 pt-2 border-t border-slate-100 dark:border-slate-700/80 space-y-3 bg-slate-50/50 dark:bg-slate-900/40">
                    {/* <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400 block tracking-wider">
                          Full Name
                        </span>
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {operator.callingName}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                          License No
                        </span>
                        <span className="text-[11px] font-mono font-medium text-slate-700 dark:text-slate-300">
                          {operator.licenseNo}
                        </span>
                      </div>
                    </div> */}

                    {/* In / Out Pickers */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                          In Time
                        </label>
                        <input
                          type="time"
                          value={operator.inTime}
                          onChange={(e) => handleIndividualTimeChange(operator.id, e.target.value, operator.outTime)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                          Out Time
                        </label>
                        <input
                          type="time"
                          value={operator.outTime}
                          onChange={(e) => handleIndividualTimeChange(operator.id, operator.inTime, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                        />
                      </div>
                    </div>

                    {/* Assigned Equipment Dropdown */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1 flex items-center gap-1">
                        <Tractor size={12} className="text-blue-600" />
                        Assigned Equipment / Machine:
                      </label>
                      <select
                        value={operator.assignedEquipmentId}
                        onChange={(e) => handleIndividualEquipmentChange(operator.id, e.target.value)}
                        className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
                      >
                        <option value="">-- No Equipment Assigned --</option>
                        {equipment.map((eq) => (
                          <option key={eq.id} value={eq.id}>
                            {eq.code}
                          </option>
                        ))}
                      </select>
                    </div>

                   

                    {/* Individual Save Button */}
                    <button
                      type="button"
                      onClick={() => handleIndividualSave(operator.id)}
                      className={[
                        'w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl font-semibold text-xs transition-colors shadow-xs',
                        isSavedJustNow
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900'
                      ].join(' ')}
                    >
                      {isSavedJustNow ? (
                        <>
                          <Check size={14} />
                          <span>Saved Successfully!</span>
                        </>
                      ) : (
                        <>
                          <Save size={14} />
                          <span>Save Operator Entry</span>
                        </>
                      )}
                    </button>
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
