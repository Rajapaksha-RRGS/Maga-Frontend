import { useState, useMemo } from 'react';
import { 
  Tractor, 
  AlertTriangle, 
  Save, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  HardHat, 
  Search,
  X,
  Tag,  
  Plus,
  Trash2,
  Lock,
} from 'lucide-react';
import { MASTER_ACTIVITIES } from '../services/supervisorStorageService';
import type { 
  EquipmentLogEntry, 
  OperatorEntry,
  EquipmentRatingUnit 
} from '../services/supervisorStorageService';

interface EquipmentLogsViewProps {
  equipment: EquipmentLogEntry[];
  operators: OperatorEntry[];
  onSaveEquipment: (updated: EquipmentLogEntry[]) => void;
  isDayLocked?: boolean;
}

const UNIT_META: Record<EquipmentRatingUnit, { label: string; sub: string; icon: string }> = {
  'Days': { label: 'Days', sub: 'Day / Shift Rate', icon: '📅' },
  'Hrs': { label: 'Hrs', sub: 'Operating Hours', icon: '⏱️' },
  'EX.hrs': { label: 'EX.hrs', sub: 'Extra / OT Hours', icon: '⚡' },
  'mth': { label: 'mth', sub: 'Meter Hours (SMH)', icon: '⚙️' },
  'm2': { label: 'm²', sub: 'Work Area (Square Meters)', icon: '📐' },
};

function getUnitValueInfo(eq: EquipmentLogEntry, unit: EquipmentRatingUnit): { value: number; label: string; display: string } {
  switch (unit) {
    case 'Days': {
      const v = eq.daysValue ?? 0;
      return { value: v, label: 'Days', display: `${v} Day${v === 1 ? '' : 's'}` };
    }
    case 'Hrs': {
      const v = eq.hoursValue ?? 0;
      return { value: v, label: 'Hrs', display: `${v.toFixed(1)} Hrs` };
    }
    case 'EX.hrs': {
      const v = eq.extraHoursValue ?? 0;
      return { value: v, label: 'EX.hrs', display: `${v.toFixed(1)} EX.hrs` };
    }
    case 'mth': {
      const v = eq.netHours ?? 0;
      return { value: v, label: 'mth', display: `${v.toFixed(1)} mth` };
    }
    case 'm2': {
      const v = eq.areaValue ?? 0;
      return { value: v, label: 'm²', display: `${v} m²` };
    }
    default:
      return { value: eq.netHours ?? 0, label: 'mth', display: `${eq.netHours ?? 0} mth` };
  }
}

function getEquipmentSummary(eq: EquipmentLogEntry): { isDone: boolean; display: string; subText?: string } {
  const pUnit: EquipmentRatingUnit = eq.primaryUnit || eq.activeUnit || 'mth';
  const pInfo = getUnitValueInfo(eq, pUnit);
  const aUnit = eq.additionalUnit;
  const aInfo = aUnit ? getUnitValueInfo(eq, aUnit) : null;

  const hasPrimary = pInfo.value > 0;
  const hasAdditional = aInfo && aInfo.value > 0;

  if (hasPrimary && hasAdditional) {
    return {
      isDone: true,
      display: `${pInfo.display} + ${aInfo.display}`,
      subText: `${pUnit} + ${aUnit}`,
    };
  } else if (hasPrimary) {
    return {
      isDone: true,
      display: pInfo.display,
      subText: pUnit === 'mth' ? `${eq.startMeter} → ${eq.endMeter}` : `Unit: ${pUnit}`,
    };
  } else if (hasAdditional) {
    return {
      isDone: true,
      display: aInfo.display,
      subText: `Unit: ${aUnit}`,
    };
  }
  return { isDone: false, display: 'Pending' };
}

export function EquipmentLogsView({
  equipment,
  operators,
  onSaveEquipment,
  isDayLocked = false,
}: EquipmentLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);

  // Counts based on whether equipment has any logged quantity
  const doneCount = equipment.filter((e) => getEquipmentSummary(e).isDone).length;
  const pendingCount = equipment.length - doneCount;

  // Filtered machinery
  const filteredEquipment = useMemo(() => {
    return equipment.filter((eq) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = 
        !q ||
        eq.name.toLowerCase().includes(q) ||
        eq.code.toLowerCase().includes(q) ||
        eq.type.toLowerCase().includes(q);
      
      if (!matchesSearch) return false;
      const isDone = getEquipmentSummary(eq).isDone;
      if (statusFilter === 'pending') return !isDone;
      if (statusFilter === 'done') return isDone;
      return true;
    });
  }, [equipment, searchQuery, statusFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ── Days Rate Handler ──
  const handleDaysChange = (id: string, days: number) => {
    const safeDays = Math.max(0, days);
    const updated = equipment.map((eq) => 
      eq.id === id ? { 
        ...eq, 
        daysValue: safeDays, 
        status: (safeDays > 0 ? 'draft' : 'pending') as 'draft' | 'pending' | 'done' 
      } : eq
    );
    onSaveEquipment(updated);
  };

  // ── Operating Hours (Hrs) Handler ──
  const handleHoursChange = (id: string, hours: number) => {
    const safeHours = Math.max(0, hours);
    const updated = equipment.map((eq) => 
      eq.id === id ? { 
        ...eq, 
        hoursValue: safeHours, 
        status: (safeHours > 0 ? 'draft' : 'pending') as 'draft' | 'pending' | 'done' 
      } : eq
    );
    onSaveEquipment(updated);
  };

  // ── Extra Hours (EX.hrs) Handler ──
  const handleExtraHoursChange = (id: string, exHours: number) => {
    const safeEx = Math.max(0, exHours);
    const updated = equipment.map((eq) => 
      eq.id === id ? { 
        ...eq, 
        extraHoursValue: safeEx, 
        status: (safeEx > 0 ? 'draft' : 'pending') as 'draft' | 'pending' | 'done' 
      } : eq
    );
    onSaveEquipment(updated);
  };

  // ── Square Meters (m2) Handler ──
  const handleAreaChange = (id: string, area: number) => {
    const safeArea = Math.max(0, area);
    const updated = equipment.map((eq) => 
      eq.id === id ? { 
        ...eq, 
        areaValue: safeArea, 
        status: (safeArea > 0 ? 'draft' : 'pending') as 'draft' | 'pending' | 'done' 
      } : eq
    );
    onSaveEquipment(updated);
  };

  // ── Meter Readings (mth) Handler ──
  const handleMeterChange = (id: string, start: number, end: number) => {
    const net = end >= start ? parseFloat((end - start).toFixed(1)) : 0;
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      const working = eq.workingHours === eq.netHours || eq.workingHours === 0 ? net : eq.workingHours;
      const idle = Math.max(0, parseFloat((net - working).toFixed(1)));

      return {
        ...eq,
        startMeter: start,
        endMeter: end,
        netHours: net,
        workingHours: working,
        idleHours: idle,
        status: (net > 0 ? 'draft' : 'pending') as 'draft' | 'pending' | 'done',
      };
    });
    onSaveEquipment(updated);
  };

  // ── Add Additional Unit Handler ──
  const handleAddAdditionalUnit = (id: string, unit: EquipmentRatingUnit) => {
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      let daysVal = eq.daysValue;
      if (unit === 'Days' && (daysVal === undefined || daysVal === 0)) {
        daysVal = 1; // 1-click default for 1 Day
      }
      return {
        ...eq,
        additionalUnit: unit,
        daysValue: daysVal,
        status: 'draft' as const,
      };
    });
    onSaveEquipment(updated);
  };

  // ── Remove Additional Unit Handler ──
  const handleRemoveAdditionalUnit = (id: string) => {
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      return {
        ...eq,
        additionalUnit: null,
        status: 'draft' as const,
      };
    });
    onSaveEquipment(updated);
  };

  // ── Save Draft Action ──
  const handleSaveDraft = (id: string) => {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      const isComplete = getEquipmentSummary(eq).isDone;
      return {
        ...eq,
        status: (isComplete ? 'done' : 'draft') as 'draft' | 'pending' | 'done',
        lastSavedAt: now,
      };
    });
    onSaveEquipment(updated);
    setSaveSuccessId(id);
    setTimeout(() => setSaveSuccessId(null), 2000);
  };

  const handleActivityCodeChange = (id: string, code: string) => {
    const update = equipment.map((eq) => 
      eq.id === id ? { ...eq, activityCode: code, status: 'draft' as const } : eq
    );
    onSaveEquipment(update);
  };

  // ── Render Input Box for Specific Unit ──
  const renderUnitInputs = (
    eq: EquipmentLogEntry,
    unit: EquipmentRatingUnit,
    isAdditional: boolean
  ) => {
    const isMeterInvalid = unit === 'mth' && eq.endMeter < eq.startMeter;

    return (
      <div 
        key={`${eq.id}-${unit}-${isAdditional ? 'add' : 'prim'}`}
        className={[
          'space-y-2.5 p-3 rounded-xl border shadow-2xs transition-all',
          isAdditional
            ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/90 dark:border-amber-900/60'
            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        ].join(' ')}
      >
        {/* Unit Block Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-base">{UNIT_META[unit]?.icon || '⚙️'}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                  {UNIT_META[unit]?.label}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:inline">
                  — {UNIT_META[unit]?.sub}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAdditional ? (
              <button
                type="button"
                onClick={() => handleRemoveAdditionalUnit(eq.id)}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50 dark:bg-red-950/60 hover:bg-red-100 px-2 py-0.5 rounded-lg border border-red-200 dark:border-red-900 transition-colors"
                title="Remove additional unit"
              >
                <Trash2 size={11} />
                <span>Remove</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-200 dark:border-emerald-800">
                <Lock size={10} />
                <span>Primary (Fixed)</span>
              </span>
            )}
          </div>
        </div>

        {/* ── Inputs by Unit Type ── */}

        {/* DAYS RATE */}
        {unit === 'Days' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Logged Days:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">
                {eq.daysValue ?? 0} Day{(eq.daysValue ?? 0) === 1 ? '' : 's'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Quick Select:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 0.5, 1.5, 2].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleDaysChange(eq.id, d)}
                    className={[
                      'py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center active:scale-95',
                      (eq.daysValue ?? 0) === d
                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs ring-1 ring-emerald-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    ].join(' ')}
                  >
                    {d === 1 ? '1 Day' : d === 0.5 ? '½ Day' : `${d} Days`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Or custom days:
              </span>
              <div className="w-24">
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={eq.daysValue ?? 0}
                  onChange={(e) => handleDaysChange(eq.id, parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* SERVICE METER HOURS (mth) */}
        {unit === 'mth' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                  Start / Initial Meter
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={eq.startMeter}
                  onChange={(e) => handleMeterChange(eq.id, parseFloat(e.target.value) || 0, eq.endMeter)}
                  className="w-full px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-500 dark:text-slate-400 block mb-1">
                  End / Final Meter
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={eq.endMeter}
                  onChange={(e) => handleMeterChange(eq.id, eq.startMeter, parseFloat(e.target.value) || 0)}
                  className={[
                    'w-full px-3 py-1.5 text-xs font-bold rounded-xl border focus:ring-2 focus:ring-emerald-500 transition-colors',
                    isMeterInvalid
                      ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                  ].join(' ')}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs">
              <span className="text-slate-600 dark:text-slate-400">Net SMH Utilization:</span>
              {isMeterInvalid ? (
                <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1 text-[11px]">
                  <AlertTriangle size={12} /> Final meter cannot be less than initial!
                </span>
              ) : (
                <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                  {eq.netHours.toFixed(1)} mth
                </span>
              )}
            </div>
          </div>
        )}

        {/* OPERATING HOURS (Hrs) */}
        {unit === 'Hrs' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Recorded Hours:</span>
              <span className="font-bold text-blue-700 dark:text-blue-400">
                {(eq.hoursValue ?? 0).toFixed(1)} Hrs
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Quick Select:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[4, 8, 9, 10].map((h) => (
                  <button
                    key={h}
                    type="button"
                    onClick={() => handleHoursChange(eq.id, h)}
                    className={[
                      'py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center active:scale-95',
                      (eq.hoursValue ?? 0) === h
                        ? 'bg-blue-600 border-blue-600 text-white shadow-xs ring-1 ring-blue-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    ].join(' ')}
                  >
                    {h}.0h
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Exact Operating Hours:
              </span>
              <div className="w-24">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={eq.hoursValue ?? 0}
                  onChange={(e) => handleHoursChange(eq.id, parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* EXTRA / OVERTIME HOURS (EX.hrs) */}
        {unit === 'EX.hrs' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Overtime / Extra Hours:</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">
                {(eq.extraHoursValue ?? 0).toFixed(1)} EX.hrs
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Quick Select:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[1, 1.5, 2, 3].map((ex) => (
                  <button
                    key={ex}
                    type="button"
                    onClick={() => handleExtraHoursChange(eq.id, ex)}
                    className={[
                      'py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center active:scale-95',
                      (eq.extraHoursValue ?? 0) === ex
                        ? 'bg-amber-600 border-amber-600 text-white shadow-xs ring-1 ring-amber-500/20'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    ].join(' ')}
                  >
                    +{ex}h
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Custom Extra Hours:
              </span>
              <div className="w-24">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={eq.extraHoursValue ?? 0}
                  onChange={(e) => handleExtraHoursChange(eq.id, parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* WORK AREA (m2) */}
        {unit === 'm2' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Area Completed:</span>
              <span className="font-bold text-purple-700 dark:text-purple-400">
                {eq.areaValue ?? 0} m²
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Quick Add:</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[50, 100, 250, 500].map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => handleAreaChange(eq.id, (eq.areaValue ?? 0) + area)}
                    className="py-1.5 rounded-lg text-xs font-bold transition-all border bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 active:scale-95"
                  >
                    +{area} m²
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Total Area (m²):
              </span>
              <div className="w-28">
                <input
                  type="number"
                  step="10"
                  min="0"
                  value={eq.areaValue ?? 0}
                  onChange={(e) => handleAreaChange(eq.id, parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-3 pb-24 animate-in fade-in duration-150">
      {/* ── 0. Locked State Banner ────────────────────────────────────────── */}
      {isDayLocked && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2.5 text-amber-800 text-xs font-medium">
          <Lock size={16} className="text-amber-600 shrink-0" />
          <span>Daily records have been submitted and locked. Equipment logs are in read-only mode.</span>
        </div>
      )}

      {/* ── Search Bar ──────────────────────────────────────────────────────── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search machinery code, name, type..."
          className="w-full pl-9 pr-9 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-emerald-600 focus:outline-none shadow-2xs transition-colors"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Status Filter Chips ─────────────────────────────────────────────── */}
      <div className="p-2 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none text-xs"> 
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={[
              'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
              statusFilter === 'all'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
            ].join(' ')}
          >
            All Machines ({equipment.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('done')}
            className={[
              'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
              statusFilter === 'done'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
            ].join(' ')}
          >
            Active / Logged ({doneCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending')}
            className={[
              'py-1.5 px-3 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0',
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200/80 dark:border-slate-700'
            ].join(' ')}
          >
            Pending / Idle ({pendingCount})
          </button>
        </div>
      </div>

      {/* ── Equipment Cards List ────────────────────────────────────────────── */}
      <div className="space-y-2.5">
        {filteredEquipment.length === 0 ? (
          <div className="py-12 px-4 text-center bg-white dark:bg-slate-850 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
            <Tractor className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              No equipment found
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Verify search query or site machinery allocation.
            </p>
          </div>
        ) : (
          filteredEquipment.map((eq) => {
            const isExpanded = expandedId === eq.id;
            const mappedOp = operators.find((o) => o.id === eq.operatorId);
            const primaryUnit: EquipmentRatingUnit = eq.primaryUnit || 'mth';
            const additionalUnit = eq.additionalUnit;
            const summary = getEquipmentSummary(eq);
            const isSavedJustNow = saveSuccessId === eq.id;

            // Compute available additional units (all allowed units excluding primary)
            const allAllowedUnits: EquipmentRatingUnit[] = eq.availableUnits && eq.availableUnits.length > 0
              ? eq.availableUnits
              : ['mth', 'Hrs', 'Days', 'EX.hrs', 'm2'];
            const availableAdditionalUnits = allAllowedUnits.filter((u) => u !== primaryUnit);

            return (
              <div
                key={eq.id}
                className={[
                  'rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs',
                  isExpanded
                    ? 'border-emerald-500 dark:border-emerald-500 ring-2 ring-emerald-500/10 bg-white dark:bg-slate-850'
                    : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/80 hover:border-slate-300'
                ].join(' ')}
              >
                {/* Accordion Header */}
                <button
                  type="button"
                  onClick={() => toggleExpand(eq.id)}
                  className="w-full text-left p-3.5 flex items-center justify-between gap-3 focus:outline-none"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold flex items-center justify-center text-sm flex-shrink-0 border border-emerald-200 dark:border-emerald-800">
                      {eq.code.slice(0, 2)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                          {eq.name}
                        </span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                          {eq.code}
                        </span>
                        
                        {/* Primary Unit Badge (FIXED — never changes) */}
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-mono flex items-center gap-0.5">
                          {UNIT_META[primaryUnit]?.icon || '⚙️'} {primaryUnit}
                        </span>

                        {/* Additional Unit Badge (shows if supervisor added one) */}
                        {additionalUnit && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono flex items-center gap-0.5">
                            +{additionalUnit}
                          </span>
                        )}
                      </div>

                      {/* Operator Link Badge */}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {mappedOp ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <HardHat size={11} /> {mappedOp.employeeNumber ? `${mappedOp.employeeNumber} · ` : ''}{mappedOp.callingName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                            No Operator Linked
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Active Rating Unit Result Pill */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {summary.isDone ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-mono">
                          {summary.display}
                        </span>
                        {summary.subText && (
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                            {summary.subText}
                          </p>
                        )}
                      </div>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                        Pending
                      </span>
                    )}

                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>
                </button>

                {/* ── Expanded Content ── */}
                {isExpanded && (
                  <div className="px-3.5 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in slide-in-from-top-1 duration-150">
                    
                    {/* ── Mode Status Banner ── */}
                    <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                          Primary:
                        </span>
                        <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono flex items-center gap-1">
                          {UNIT_META[primaryUnit]?.icon || '⚙️'} {primaryUnit}
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                          Fixed
                        </span>
                      </div>

                      {additionalUnit ? (
                        <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                          ⚡ Dual Units: {primaryUnit} + {additionalUnit}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">
                          Single Unit Mode
                        </span>
                      )}
                    </div>

                    {/* ── 1. PRIMARY UNIT SECTION (Fixed - Always Present) ── */}
                    {renderUnitInputs(eq, primaryUnit, false)}

                    {/* ── 2. ADDITIONAL UNIT SECTION (Optional) ── */}
                    {additionalUnit ? (
                      renderUnitInputs(eq, additionalUnit, true)
                    ) : (
                      /* "+ Add Additional Unit" Quick Buttons */
                      availableAdditionalUnits.length > 0 && (
                        <div className="p-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/40 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                              <Plus size={13} className="text-emerald-600 dark:text-emerald-400" />
                              Add Additional Unit (e.g. Overtime / Shift Rate)?
                            </span>
                            <span className="text-[10px] text-slate-400">Optional</span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {availableAdditionalUnits.map((unit) => (
                              <button
                                key={unit}
                                type="button"
                                onClick={() => handleAddAdditionalUnit(eq.id, unit)}
                                className="py-1 px-2.5 rounded-lg text-xs font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-slate-750 dark:hover:text-emerald-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 shadow-2xs transition-all active:scale-95"
                              >
                                <Plus size={11} className="text-emerald-600" />
                                <span>{UNIT_META[unit]?.icon || '⚙️'}</span>
                                <span>{unit}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    )}

                    {/* ── Combined Summary Pill (Shown when both primary & additional have values) ── */}
                    {summary.isDone && additionalUnit && (
                      <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between text-xs">
                        <span className="font-semibold text-emerald-900 dark:text-emerald-200">
                          Total Logged Output:
                        </span>
                        <span className="font-bold text-emerald-800 dark:text-emerald-300 font-mono">
                          {summary.display}
                        </span>
                      </div>
                    )}

                    {/* ── Activity Code for Equipment ── */}
                    <div className="p-3 border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label htmlFor={`activityCode-${eq.id}`} className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                          <Tag className="text-emerald-600" size={12} />
                          Activity Code
                        </label>
                        {eq.activityCode && (
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">
                            {eq.activityCode}
                          </span>
                        )}
                      </div>
                      
                      <select 
                        id={`activityCode-${eq.id}`}
                        name="activityCode" 
                        value={eq.activityCode || ''} 
                        onChange={(e) => handleActivityCodeChange(eq.id, e.target.value)} 
                        className="w-full px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                      >
                        <option value="">-- Select Activity Code --</option>
                        {MASTER_ACTIVITIES.map((act) => (
                          <option key={act.code} value={act.code}>
                            {act.code} - {act.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ── 3. Save Draft Action ── */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleSaveDraft(eq.id)}
                        className={[
                          'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs transition-all shadow-xs active:scale-[0.99]',
                          isSavedJustNow
                            ? 'bg-emerald-700 text-white'
                            : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        ].join(' ')}
                      >
                        {isSavedJustNow ? (
                          <>
                            <Check size={16} />
                            <span>Equipment Log Saved!</span>
                          </>
                        ) : (
                          <>
                            <Save size={15} />
                            <span>Save Equipment Entry</span>
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
