import { useState, useMemo, useEffect } from 'react';
import { 
  Tractor, 
  AlertTriangle, 
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
  Users,
  Info,
  Fuel,
} from 'lucide-react';
import { 
  supervisorStorage,
  normalizeRatingUnit,
  type ActivityCodeItem,
  type EquipmentLogEntry, 
  type OperatorEntry,
  type EquipmentRatingUnit,
  type EquipmentActivitySplit,
  type SitePoolEquipmentItem,
} from '../services/supervisorStorageService';
import { SiteEquipmentPoolModal } from '../components/SiteEquipmentPoolModal';
import { useAuth } from '../../../context/AuthContext';

interface EquipmentLogsViewProps {
  equipment: EquipmentLogEntry[];
  operators: OperatorEntry[];
  onSaveEquipment: (updated: EquipmentLogEntry[]) => void;
  isDayLocked?: boolean;
  selectedDate?: string;
  projectId?: string;
}

const UNIT_META: Record<EquipmentRatingUnit, { label: string; sub: string; icon: string }> = {
  'Days': { label: 'Days', sub: 'Day / Shift Rate', icon: '📅' },
  'Hrs': { label: 'Hrs', sub: 'Operating Hours', icon: '⏱️' },
  'EX.hrs': { label: 'EX.hrs', sub: 'Extra / OT Hours', icon: '⚡' },
  'mth': { label: 'Mth', sub: 'Monthly Hire (Standard 26 Days)', icon: '📆' },
  'm2': { label: 'm²', sub: 'Work Area (Square Meters)', icon: '📐' },
  'km': { label: 'km', sub: 'Mileage / Kilometers', icon: '🚗' },
};

function getUnitValueInfo(eq: EquipmentLogEntry, rawUnit: EquipmentRatingUnit | string | undefined): { value: number; label: string; display: string } {
  const unit = normalizeRatingUnit(rawUnit);
  switch (unit) {
    case 'Days': {
      const v = eq.daysValue ?? 0;
      return { value: v, label: 'Days', display: `${v} Day${v === 1 ? '' : 's'}` };
    }
    case 'Hrs': {
      const v = (eq.hoursValue !== undefined && eq.hoursValue > 0) ? eq.hoursValue : (eq.netHours ?? 0);
      return { value: v, label: 'Hrs', display: `${v.toFixed(1)} Hrs` };
    }
    case 'EX.hrs': {
      const v = eq.extraHoursValue ?? 0;
      return { value: v, label: 'EX.hrs', display: `${v.toFixed(1)} EX.hrs` };
    }
    case 'mth': {
      const v = eq.daysValue ?? (eq.netHours && eq.netHours > 0 ? eq.netHours : 0);
      return { value: v, label: 'Days (Mth)', display: `${v} Day${v === 1 ? '' : 's'}` };
    }
    case 'm2': {
      const v = eq.areaValue ?? 0;
      return { value: v, label: 'm²', display: `${v} m²` };
    }
    case 'km': {
      const v = eq.totalMileage ?? (eq.endMileage && eq.startMileage ? Math.max(0, eq.endMileage - eq.startMileage) : 0);
      return { value: v, label: 'km', display: `${v.toFixed(1)} km` };
    }
    default:
      return { value: eq.daysValue ?? eq.hoursValue ?? eq.netHours ?? 0, label: unit, display: `${eq.daysValue ?? eq.hoursValue ?? eq.netHours ?? 0} ${unit}` };
  }
}

function getEquipmentSummary(eq: EquipmentLogEntry): { isDone: boolean; display: string; subText?: string } {
  const pUnit: EquipmentRatingUnit = normalizeRatingUnit(eq.primaryUnit || eq.activeUnit);
  const pInfo = getUnitValueInfo(eq, pUnit);
  const aUnit = eq.additionalUnit ? normalizeRatingUnit(eq.additionalUnit) : null;
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
      subText: pUnit === 'mth' 
        ? (eq.endMeter > eq.startMeter ? `${eq.startMeter} → ${eq.endMeter} Meter` : 'Monthly Contract (Days)')
        : `Unit: ${pUnit}`,
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
  selectedDate = '',
  projectId,
}: EquipmentLogsViewProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activityOptions, setActivityOptions] = useState<ActivityCodeItem[]>([]);
  const [showMeterMap, setShowMeterMap] = useState<Record<string, boolean>>({});
  const [isPoolMode, setIsPoolMode] = useState<boolean>(false);
  const [isPoolModalOpen, setIsPoolModalOpen] = useState<boolean>(false);
  const [sitePoolMap, setSitePoolMap] = useState<Record<string, SitePoolEquipmentItem>>({});

  useEffect(() => {
    supervisorStorage.isEquipmentPoolModeEnabled(projectId)
      .then(setIsPoolMode)
      .catch(() => setIsPoolMode(false));
  }, [projectId]);

  useEffect(() => {
    supervisorStorage.fetchSiteEquipmentPool(projectId, selectedDate).then((items) => {
      if (Array.isArray(items)) {
        const map: Record<string, SitePoolEquipmentItem> = {};
        items.forEach((it) => {
          map[it.id] = it;
          if (it.code) map[it.code] = it;
        });
        setSitePoolMap(map);
      }
    }).catch(() => {});
  }, [projectId, selectedDate]);

  const handleAddFromPool = (newEntry: EquipmentLogEntry) => {
    const exists = equipment.some((e) => e.id === newEntry.id);
    if (!exists) {
      const updated = [newEntry, ...equipment];
      onSaveEquipment(updated);
    }
    setExpandedId(newEntry.id);
  };

  useEffect(() => {
    supervisorStorage.getActivityCodes().then((codes) => {
      if (Array.isArray(codes) && codes.length > 0) {
        setActivityOptions(codes);
      }
    }).catch(() => {});
  }, []);

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
    // Strictly max 1.0 Day for daily equipment entry (never 1.5, 2, etc.)
    const safeDays = Math.min(1.0, Math.max(0, parseFloat(days.toFixed(2))));
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;

      const pUnit = normalizeRatingUnit(eq.primaryUnit || eq.activeUnit);
      const isDayOrMth = pUnit === 'Days' || pUnit === 'mth';
      let splits = eq.activitySplits || [];
      const daySplits = splits.filter((s) => normalizeRatingUnit(s.unit) === pUnit || normalizeRatingUnit(s.unit) === 'Days' || normalizeRatingUnit(s.unit) === 'mth');

      // If only 1 activity split exists, keep it equal to safeDays (e.g. 1.0 Day)
      if (isDayOrMth) {
        if (daySplits.length === 1) {
          splits = splits.map((s) =>
            (normalizeRatingUnit(s.unit) === pUnit || normalizeRatingUnit(s.unit) === 'Days' || normalizeRatingUnit(s.unit) === 'mth')
              ? { ...s, utilization: safeDays, unit: pUnit }
              : s
          );
        } else if (daySplits.length === 0 && safeDays > 0) {
          splits = [
            ...splits,
            {
              id: `split-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
              activityCode: activityOptions[0]?.code || '',
              unit: pUnit,
              utilization: safeDays,
            },
          ];
        }
      }

      return {
        ...eq,
        daysValue: safeDays,
        activitySplits: splits,
        status: (safeDays > 0 ? 'draft' : 'pending') as 'draft' | 'pending' | 'done',
      };
    });
    onSaveEquipment(updated);
  };

  // ── Operating Hours (Hrs) Handler ──
  const handleHoursChange = (id: string, hours: number) => {
    const safeHours = Math.max(0, hours);
    const updated = equipment.map((eq) => 
      eq.id === id ? { 
        ...eq, 
        hoursValue: safeHours, 
        netHours: safeHours,
        workingHours: safeHours,
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


  // ── Mileage (km) Handler ──
  const handleMileageChange = (id: string, mileage: number) => {
    const safeMileage = Math.max(0, mileage);
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      return {
        ...eq,
        totalMileage: safeMileage,
        status: (safeMileage > 0 ? 'draft' : 'pending') as 'draft' | 'pending' | 'done',
      };
    });
    onSaveEquipment(updated);
  };

  const handleMileageMeterChange = (id: string, start: number, end: number) => {
    const total = end >= start ? parseFloat((end - start).toFixed(1)) : 0;
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      return {
        ...eq,
        startMileage: start,
        endMileage: end,
        totalMileage: total,
        status: (total > 0 ? 'draft' : 'pending') as 'draft' | 'pending' | 'done',
      };
    });
    onSaveEquipment(updated);
  };

  // ── Fuel Liters Handler ──
  const handleFuelChange = (id: string, fuel: number) => {
    const safeFuel = Math.max(0, parseFloat((Number(fuel) || 0).toFixed(2)));
    const updated = equipment.map((eq) =>
      eq.id === id ? { ...eq, fuelIssuedLiters: safeFuel, status: 'draft' as const } : eq
    );
    onSaveEquipment(updated);
  };

  // ── Unit-Specific Activity Split Handlers ──
  const handleAddActivitySplit = (eqId: string, rawUnit: EquipmentRatingUnit | string) => {
    const eq = equipment.find((e) => e.id === eqId);
    if (!eq) return;

    const unit = normalizeRatingUnit(rawUnit);
    const isDayUnit = unit === 'Days' || unit === 'mth';
    const totalTarget = isDayUnit
      ? ((eq.daysValue !== undefined && eq.daysValue > 0) ? Math.min(1.0, eq.daysValue) : 1.0)
      : getUnitValueInfo(eq, unit).value;

    const existingSplits = (eq.activitySplits || []).filter((s) => normalizeRatingUnit(s.unit) === unit);
    const allocated = existingSplits.reduce((sum, s) => sum + (Number(s.utilization) || 0), 0);
    let remaining = Math.max(0, parseFloat((totalTarget - allocated).toFixed(2)));

    let updatedExistingSplits = [...(eq.activitySplits || [])];

    // If first activity took the full amount (e.g. 1.0 Day) and supervisor adds 2nd activity,
    // split 50/50 so first becomes 0.5 and new gets remaining 0.5!
    if (isDayUnit && existingSplits.length === 1 && remaining <= 0.001 && existingSplits[0].utilization >= totalTarget) {
      const half = parseFloat((totalTarget / 2).toFixed(2));
      const balance = parseFloat((totalTarget - half).toFixed(2));
      updatedExistingSplits = updatedExistingSplits.map((s) =>
        s.id === existingSplits[0].id ? { ...s, utilization: half } : s
      );
      remaining = balance;
    }

    const defaultAct = activityOptions.find((a) => !existingSplits.some((s) => s.activityCode === a.code))?.code || activityOptions[0]?.code || '';

    const newSplit: EquipmentActivitySplit = {
      id: `split-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      activityCode: defaultAct,
      unit,
      utilization: remaining > 0 ? remaining : (isDayUnit ? 0.2 : 1),
    };

    const updated = equipment.map((e) => {
      if (e.id !== eqId) return e;
      const splits = [...updatedExistingSplits, newSplit];
      return {
        ...e,
        activitySplits: splits,
        status: 'draft' as const,
      };
    });
    onSaveEquipment(updated);
  };

  const handleRemoveActivitySplit = (eqId: string, splitId: string) => {
    const updated = equipment.map((e) => {
      if (e.id !== eqId) return e;
      return {
        ...e,
        activitySplits: (e.activitySplits || []).filter((s) => s.id !== splitId),
        status: 'draft' as const,
      };
    });
    onSaveEquipment(updated);
  };

  const handleUpdateActivitySplit = (
    eqId: string,
    splitId: string,
    updates: Partial<EquipmentActivitySplit>
  ) => {
    const updated = equipment.map((e) => {
      if (e.id !== eqId) return e;
      let splits = [...(e.activitySplits || [])];

      const targetSplit = splits.find((s) => s.id === splitId);
      if (!targetSplit) return e;

      const isDayUnit = targetSplit.unit === 'Days' || targetSplit.unit === 'mth';
      const totalTarget = isDayUnit
        ? ((e.daysValue !== undefined && e.daysValue > 0) ? Math.min(1.0, e.daysValue) : 1.0)
        : getUnitValueInfo(e, targetSplit.unit).value;

      const sameUnitSplits = splits.filter((s) => s.unit === targetSplit.unit);

      // If updating utilization in Day unit and exactly 2 splits exist:
      // When supervisor updates one split (e.g. 0.7), automatically calculate the remaining balance on the other (0.3)
      if (isDayUnit && updates.utilization !== undefined && sameUnitSplits.length === 2) {
        const newUtil = Math.min(totalTarget, Math.max(0, parseFloat(Number(updates.utilization).toFixed(2))));
        const otherSplit = sameUnitSplits.find((s) => s.id !== splitId);
        if (otherSplit) {
          const autoBalance = Math.max(0, parseFloat((totalTarget - newUtil).toFixed(2)));
          splits = splits.map((s) => {
            if (s.id === splitId) return { ...s, ...updates, utilization: newUtil };
            if (s.id === otherSplit.id) return { ...s, utilization: autoBalance };
            return s;
          });
          return { ...e, activitySplits: splits, status: 'draft' as const };
        }
      }

      splits = splits.map((s) => (s.id === splitId ? { ...s, ...updates } : s));
      return {
        ...e,
        activitySplits: splits,
        status: 'draft' as const,
      };
    });
    onSaveEquipment(updated);
  };

  // ── Render Input Box for Specific Unit ──
  const renderUnitInputs = (
    eq: EquipmentLogEntry,
    rawUnit: EquipmentRatingUnit | string,
    isAdditional: boolean
  ) => {
    const unit = normalizeRatingUnit(rawUnit);
    const isMeterInvalid = unit === 'mth' && eq.endMeter < eq.startMeter;
    const unitInfo = getUnitValueInfo(eq, unit);
    const unitSplits = (eq.activitySplits || []).filter((s) => normalizeRatingUnit(s.unit) === unit);
    const allocatedSum = unitSplits.reduce((sum, s) => sum + (Number(s.utilization) || 0), 0);
    const meterKey = `${eq.id}-${unit}`;
    const showMeter = !!showMeterMap[meterKey];

    return (
      <div 
        key={`${eq.id}-${unit}-${isAdditional ? 'add' : 'prim'}`}
        // className={[
        //   'space-y-3 p-3.5 rounded-2xl border shadow-xs transition-all',
        //   isAdditional
        //     ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200/90 dark:border-amber-900/60'
        //     : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
        // ].join(' ')}
      >
        {/* Unit Block Header */}
        {/* <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg p-1.5 rounded-xl bg-slate-100 dark:bg-slate-700/60">{UNIT_META[unit]?.icon || '⚙️'}</span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
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
                <span>Primary Unit</span>
              </span>
            )}
          </div>
        </div> */}

        {/* ── Inputs by Unit Type ── */}

        {/* DAYS RATE */}
        {unit === 'Days' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Logged Days (Max 1 Day):</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-sm">
                {eq.daysValue ?? 0} Day{(eq.daysValue ?? 0) === 1 ? '' : 's'}
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Quick Select Days (Max 1 Day):</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { d: 1, label: '1 Day' },
                  { d: 0.75, label: '¾ Day' },
                  { d: 0.5, label: '½ Day' },
                  { d: 0.25, label: '¼ Day' }
                ].map(({ d, label }) => (
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
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Or custom days (max 1.0):
              </span>
              <div className="w-24">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={eq.daysValue ?? 0}
                  onChange={(e) => handleDaysChange(eq.id, parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* MONTHLY HIRE (mth) - Logged in Days (Standard 26 days/month) */}
        {unit === 'mth' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Logged Days (Monthly Hire):</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400 font-mono text-sm">
                {eq.daysValue ?? 0} {(eq.daysValue ?? 0) === 1 ? 'Day' : 'Days'}
                <span className="text-[11px] text-slate-500 font-normal ml-1.5">
                  ({(((eq.daysValue ?? 0) / 26) * 1.0).toFixed(2)} mth)
                </span>
              </span>
            </div>

            {/* Quick Days Select */}
            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Quick Select Days (Max 1 Day):</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { d: 1, label: '1 Day' },
                  { d: 0.75, label: '¾ Day' },
                  { d: 0.5, label: '½ Day' },
                  { d: 0.25, label: '¼ Day' }
                ].map(({ d, label }) => (
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
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Or custom days (max 1.0):
              </span>
              <div className="w-24">
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  max="1"
                  value={eq.daysValue ?? 0}
                  onChange={(e) => handleDaysChange(eq.id, parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Optional Collapsible Meter Readings Toggle */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowMeterMap((prev) => ({ ...prev, [meterKey]: !prev[meterKey] }))}
                className="text-[10px] text-slate-500 hover:text-emerald-600 dark:text-slate-400 flex items-center gap-1 font-medium transition-colors"
              >
                <span>{showMeter ? '▼ Hide Meter Readings' : '▶ Optional: Enter Meter Readings (Start / End)'}</span>
              </button>

              {showMeter && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-750 space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Start Meter</label>
                      <input
                        type="number"
                        step="0.1"
                        value={eq.startMeter}
                        onChange={(e) => handleMeterChange(eq.id, parseFloat(e.target.value) || 0, eq.endMeter)}
                        className="w-full px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">End Meter</label>
                      <input
                        type="number"
                        step="0.1"
                        value={eq.endMeter}
                        onChange={(e) => handleMeterChange(eq.id, eq.startMeter, parseFloat(e.target.value) || 0)}
                        className={[
                          'w-full px-2 py-1 text-xs font-bold rounded-lg border font-mono',
                          isMeterInvalid
                            ? 'border-red-500 bg-red-50 text-red-900'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                        ].join(' ')}
                      />
                    </div>
                  </div>
                  {isMeterInvalid && (
                    <span className="text-red-600 text-[10px] font-bold flex items-center gap-1">
                      <AlertTriangle size={11} /> End meter cannot be less than start meter!
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* MILEAGE (km) */}
        {unit === 'km' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Logged Distance:</span>
              <span className="font-bold text-sky-700 dark:text-sky-400 font-mono text-sm">
                {(eq.totalMileage ?? 0).toFixed(1)} km
              </span>
            </div>

            <div>
              <span className="text-[10px] text-slate-400 block mb-1">Quick Select (km):</span>
              <div className="grid grid-cols-4 gap-1.5">
                {[10, 25, 50, 100].map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => handleMileageChange(eq.id, k)}
                    className={[
                      'py-1.5 rounded-lg text-xs font-bold transition-all border flex items-center justify-center active:scale-95',
                      (eq.totalMileage ?? 0) === k
                        ? 'bg-sky-600 border-sky-600 text-white shadow-xs'
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
                    ].join(' ')}
                  >
                    {k} km
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Direct Distance (km):
              </span>
              <div className="w-28">
                <input
                  type="number"
                  step="1"
                  min="0"
                  value={eq.totalMileage ?? 0}
                  onChange={(e) => handleMileageChange(eq.id, parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-sky-500 font-mono"
                />
              </div>
            </div>

            {/* Optional Collapsible Odometer Readings */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => setShowMeterMap((prev) => ({ ...prev, [meterKey]: !prev[meterKey] }))}
                className="text-[10px] text-slate-500 hover:text-sky-600 dark:text-slate-400 flex items-center gap-1 font-medium transition-colors"
              >
                <span>{showMeter ? '▼ Hide Odometer Readings' : '▶ Optional: Enter Start / End Mileage'}</span>
              </button>

              {showMeter && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-750 space-y-2">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">Start Mileage</label>
                      <input
                        type="number"
                        step="1"
                        value={eq.startMileage ?? 0}
                        onChange={(e) => handleMileageMeterChange(eq.id, parseFloat(e.target.value) || 0, eq.endMileage ?? 0)}
                        className="w-full px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-1">End Mileage</label>
                      <input
                        type="number"
                        step="1"
                        value={eq.endMileage ?? 0}
                        onChange={(e) => handleMileageMeterChange(eq.id, eq.startMileage ?? 0, parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OPERATING HOURS (Hrs) */}
        {unit === 'Hrs' && (
          <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-750">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-medium">Recorded Hours:</span>
              <span className="font-bold text-blue-700 dark:text-blue-400 font-mono text-sm">
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
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 font-mono"
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
              <span className="font-bold text-amber-700 dark:text-amber-400 font-mono text-sm">
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
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-mono"
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
              <span className="font-bold text-purple-700 dark:text-purple-400 font-mono text-sm">
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
                  className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500 font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIVITY SPLITS FOR THIS SPECIFIC UNIT ── */}
        {(() => {
          const isDayUnit = unit === 'Days' || unit === 'mth';
          const targetValue = isDayUnit
            ? ((eq.daysValue !== undefined && eq.daysValue > 0) ? Math.min(1.0, eq.daysValue) : 1.0)
            : unitInfo.value;
          const unassigned = Math.max(0, parseFloat((targetValue - allocatedSum).toFixed(2)));
          const isFullySplit = Math.abs(allocatedSum - targetValue) < 0.02;

          return (
            <div className="mt-3 pt-3 border-t border-slate-200/90 dark:border-slate-700/80 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Tag size={13} className="text-blue-600 dark:text-blue-400" />
                  <span>Activity  ({isDayUnit ? 'Days' : unit})</span>
                </span>

                {targetValue > 0 && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isFullySplit
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300'
                      : 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                  }`}>
                    {allocatedSum.toFixed(2)} / {targetValue.toFixed(2)} {isDayUnit ? 'Day(s)' : unit}
                    {isFullySplit ? ' (100% Split)' : ` (${unassigned.toFixed(2)} unassigned)`}
                  </span>
                )}
              </div>

              {/* If no splits yet, provide quick 1-click button to assign 1st activity as 1 Day */}
              {unitSplits.length === 0 && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-dashed border-slate-200 dark:border-slate-700 text-center space-y-2">
                  <p className="text-[11px] text-slate-500">No activity assigned yet for this machine.</p>
                  <button
                    type="button"
                    onClick={() => handleAddActivitySplit(eq.id, unit)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-2xs cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Assign 1st Activity ({isDayUnit ? `${targetValue.toFixed(2)} Day` : `${targetValue} ${unit}`})</span>
                  </button>
                </div>
              )}

              {/* List of activity splits */}
              {unitSplits.length > 0 && (
                <div className="space-y-1.5">
                  {unitSplits.map((split, sIdx) => (
                    <div key={split.id} className="flex items-center gap-1.5 p-1.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-750">
                      <span className="text-[10px] font-mono font-bold text-slate-400 w-4 text-center">
                        {sIdx + 1}
                      </span>
                      <select
                        value={split.activityCode}
                        onChange={(e) => handleUpdateActivitySplit(eq.id, split.id, { activityCode: e.target.value })}
                        className="flex-1 min-w-0 px-2 py-1.5 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-850 text-white-800 dark:text-slate-100 truncate focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="">-- Select Activity Code --</option>
                        {activityOptions.map((act) => (
                          <option key={act.code} value={act.code}>
                            {act.code} - {act.name || act.code}
                          </option>
                        ))}
                      </select>

                      <div className="w-28 flex-shrink-0 flex items-center gap-1 bg-white dark:bg-slate-850 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                        <input
                          type="number"
                          step={isDayUnit ? "0.05" : "0.1"}
                          min="0"
                          max={isDayUnit ? "1" : undefined}
                          placeholder={isDayUnit ? 'Days' : 'Qty'}
                          value={split.utilization}
                          onChange={(e) => {
                            let val = parseFloat(e.target.value) || 0;
                            if (isDayUnit) val = Math.min(1.0, Math.max(0, parseFloat(val.toFixed(2))));
                            handleUpdateActivitySplit(eq.id, split.id, { utilization: val });
                          }}
                          className="w-full text-xs font-bold text-center bg-transparent text-slate-800 dark:text-slate-100 outline-none font-mono"
                        />
                        <span className="text-[10px] font-semibold text-slate-400">
                          {isDayUnit ? 'Day' : unit}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveActivitySplit(eq.id, split.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/60 transition-colors cursor-pointer"
                        title="Remove split"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {unitSplits.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleAddActivitySplit(eq.id, unit)}
                  className="w-full py-1.5 px-3 rounded-xl text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-50/80 dark:hover:bg-blue-950/40 border border-dashed border-blue-300 dark:border-blue-800 flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <Plus size={13} />
                  <span>+ Add Activity Split ({isDayUnit ? 'Days' : unit})</span>
                </button>
              )}
            </div>
          );
        })()}
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

      {/* ── Site Equipment Pool Quick Add Banner (When Pool Mode is Active) ── */}
      {isPoolMode && !isDayLocked && (
        <div className="p-3 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-white dark:to-slate-800 border border-amber-200 dark:border-amber-900/60 rounded-2xl flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-xs">
              <Tractor size={16} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                  Site Equipment Pool
                </h4>

              </div>

            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsPoolModalOpen(true)}
            className="flex-shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus size={14} />
            <span>Add from Pool</span>
          </button>
        </div>
      )}

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
            {isPoolMode && !isDayLocked && (
              <button
                type="button"
                onClick={() => setIsPoolModalOpen(true)}
                className="mt-3.5 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold shadow-xs cursor-pointer transition-all"
              >
                <Plus size={14} />
                <span>Add Equipment from Site Pool</span>
              </button>
            )}
          </div>
        ) : (
          filteredEquipment.map((eq) => {
            const isExpanded = expandedId === eq.id;
            const mappedOp = operators.find((o) => o.id === eq.operatorId);
            const primaryUnit: EquipmentRatingUnit = normalizeRatingUnit(eq.primaryUnit || eq.activeUnit);
            const additionalUnit = eq.additionalUnit ? normalizeRatingUnit(eq.additionalUnit) : null;
            const summary = getEquipmentSummary(eq);

            // Multi-Supervisor & Conflict Detection Context
            const poolItem = sitePoolMap[eq.id] || (eq.code ? sitePoolMap[eq.code] : undefined);
            
            // CRITICAL FIX: Only consider usages logged by OTHER supervisors to avoid double-counting current supervisor's own entry!
            const otherUsages = (poolItem?.existingUsages || []).filter((u) => {
              if (user?.id && u.supervisorId === user.id) return false;
              if (user?.fullName && u.supervisorName && u.supervisorName.trim().toLowerCase() === user.fullName.trim().toLowerCase()) return false;
              if (user?.username && u.supervisorName && u.supervisorName.trim().toLowerCase() === user.username.trim().toLowerCase()) return false;
              return true;
            });

            const isShared = otherUsages.length > 0;
            const sharedSupervisors = Array.from(new Set(otherUsages.map((u) => u.supervisorName)));

            // Calculate only what OTHER supervisors have logged
            let existingDays = 0;
            let existingHours = 0;
            let handoverMeter = 0;
            let handoverMileage = 0;

            for (const u of otherUsages) {
              const uCode = (u.unitCode || primaryUnit || '').toLowerCase();
              const uUtil = u.totalUtilization ?? 0;
              if (uCode === 'days' || uCode === 'day') {
                existingDays += uUtil;
              } else if (uCode === 'hrs' || uCode === 'hr' || uCode === 'ex.hrs') {
                existingHours += (u.workingHours || uUtil);
              } else if (uUtil <= 1.5 && (primaryUnit.toLowerCase() === 'days' || primaryUnit.toLowerCase() === 'mth')) {
                existingDays += uUtil;
              } else {
                existingHours += (u.workingHours || uUtil);
              }
              if (u.finalMeter && u.finalMeter > handoverMeter) {
                handoverMeter = u.finalMeter;
              }
              if (u.endMileage && u.endMileage > handoverMileage) {
                handoverMileage = u.endMileage;
              }
            }

            // Fallback handover to historical if no OTHER supervisor logged one today
            if (!handoverMeter) {
              handoverMeter = poolItem?.latestMeter ?? eq.previousFinalMeter ?? 0;
            }
            if (!handoverMileage) {
              handoverMileage = poolItem?.latestMileage ?? eq.previousEndMileage ?? 0;
            }

            const existingActivities = otherUsages.flatMap((u) => (u.activities || []).map((a) => a.code));

            // Unit-specific capacity validations (ONLY active if another supervisor actually logged on this vehicle!)
            const currentDays = eq.daysValue ?? 0;
            const totalDays = currentDays + existingDays;
            const isDaysExceeded = isShared && existingDays > 0 && totalDays > 1.001;

            const currentHours = (eq.hoursValue ?? 0) + (eq.extraHoursValue ?? 0);
            const totalHours = currentHours + existingHours;
            const isHoursExceeded = isShared && existingHours > 0 && totalHours > 24;

            // Meter & Mileage sequence checks (only if handover was from another supervisor)
            const isMeterConflict = isShared && handoverMeter > 0 && eq.startMeter > 0 && eq.startMeter < handoverMeter;
            const isMileageConflict = isShared && handoverMileage > 0 && (eq.startMileage ?? 0) > 0 && (eq.startMileage ?? 0) < handoverMileage;

            // Duplicate activity check ("ekama wade")
            const hasDuplicateActivity = Boolean(
              isShared && eq.activityCode && existingActivities.includes(eq.activityCode)
            );

            const hasAnyConflict = isDaysExceeded || isHoursExceeded || isMeterConflict || isMileageConflict;

            return (
              <div
                key={eq.id}
                className={[
                  'rounded-2xl border transition-all duration-200 overflow-hidden shadow-2xs',
                  hasAnyConflict
                    ? 'border-red-400 dark:border-red-600 bg-white dark:bg-slate-850'
                    : isExpanded
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
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-650">
                          {eq.vehicleNo || eq.code}
                        </span>
                        {eq.magaNo && eq.magaNo !== (eq.vehicleNo || eq.code) && (
                          <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                            ERP: {eq.magaNo}
                          </span>
                        )}
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          (eq.condition || 'DRY').toUpperCase() === 'WET'
                            ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                            : 'bg-sky-50 text-sky-700 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300'
                        }`}>
                          {(eq.condition || 'DRY').toUpperCase()}
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

                      {/* Operator & Shared Shift Badges */}
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

                        {/* Multi-Supervisor Sharing Badge */}
                        {isShared && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                            <Users size={11} /> Shared: {sharedSupervisors.join(', ') || 'Another Supervisor'}
                          </span>
                        )}

                        {/* Fuel Pumped Badge */}
                        {Number(eq.fuelIssuedLiters || 0) > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 font-mono">
                            <Fuel size={11} className="text-amber-600 dark:text-amber-400" /> {eq.fuelIssuedLiters}L
                          </span>
                        )}

                        {/* Capacity Exceeded Warning Pill */}
                        {isDaysExceeded && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 animate-pulse">
                            <AlertTriangle size={11} /> Exceeds 1.0 Day ({totalDays.toFixed(2)}d)
                          </span>
                        )}

                        {isHoursExceeded && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700 animate-pulse">
                            <AlertTriangle size={11} /> Exceeds 24h ({totalHours.toFixed(1)}h)
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

                    {/* Shared Machinery Shift Handover Banner */}
                    {isShared && (
                      <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-200">
                          <div className="flex items-center gap-1.5">
                            <Users size={13} className="text-blue-600" />
                            <span>Shared Machinery (Multi-Supervisor Shift Handover)</span>
                          </div>
                          <div className="flex items-center gap-1 flex-wrap">
                            {otherUsages.map((u, idx) => (
                              <span key={idx} className="text-[10px] px-2 py-0.5 rounded-full bg-blue-200/80 dark:bg-blue-900 text-blue-800 dark:text-blue-200 font-bold">
                                {u.supervisorName} <span className="opacity-75 font-normal">({u.status === 'submitted' || u.status === 'approved' ? 'Submitted' : 'Draft'})</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        
                        <div className="text-[11px] text-blue-700 dark:text-blue-300 flex items-center gap-2 flex-wrap">
                          {existingDays > 0 && (
                            <span className="bg-white/80 dark:bg-blue-900/50 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 font-mono">
                              Logged by other: <strong>{existingDays} Days</strong> · Rem: <strong>{Math.max(0, 1 - existingDays).toFixed(2)} Days</strong>
                            </span>
                          )}
                          {existingHours > 0 && (
                            <span className="bg-white/80 dark:bg-blue-900/50 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 font-mono">
                              Logged by other: <strong>{existingHours} Hrs</strong>
                            </span>
                          )}
                          {handoverMeter > 0 && (
                            <span className="bg-white/80 dark:bg-blue-900/50 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 font-mono">
                              Handover Meter: <strong>{handoverMeter}</strong>
                            </span>
                          )}
                          {handoverMileage > 0 && (
                            <span className="bg-white/80 dark:bg-blue-900/50 px-2 py-0.5 rounded border border-blue-100 dark:border-blue-800 font-mono">
                              Handover Mileage: <strong>{handoverMileage} km</strong>
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Conflict Alerts */}
                    {isDaysExceeded && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-800 dark:text-red-200 text-xs flex items-start gap-2.5">
                        <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold">Daily Capacity Exceeded ({totalDays.toFixed(2)} Days / Max 1.0 Day)</p>
                          <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                            {sharedSupervisors.join(', ')} has already logged <strong>{existingDays} Day(s)</strong> today. With your entry of <strong>{currentDays} Day(s)</strong>, total machinery allocation becomes <strong>{totalDays.toFixed(2)} Days</strong>. One machine cannot exceed 1.0 Day in a single calendar day.
                          </p>
                        </div>
                      </div>
                    )}

                    {isHoursExceeded && (
                      <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800/80 text-red-800 dark:text-red-200 text-xs flex items-start gap-2.5">
                        <AlertTriangle size={16} className="text-red-600 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-bold">24-Hour Daily Capacity Exceeded ({totalHours.toFixed(1)}h / Max 24h)</p>
                          <p className="text-[11px] leading-relaxed text-red-700 dark:text-red-300">
                            {sharedSupervisors.join(', ')} logged <strong>{existingHours}h</strong>. Your entry of <strong>{currentHours}h</strong> pushes total machinery hours to <strong>{totalHours.toFixed(1)}h</strong>, which exceeds 24 hours in a day.
                          </p>
                        </div>
                      </div>
                    )}

                    {isMeterConflict && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                        <span>
                          Start Meter ({eq.startMeter}) is lower than previous supervisor&apos;s final meter ({handoverMeter}). Check your meter reading.
                        </span>
                      </div>
                    )}

                    {isMileageConflict && (
                      <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800/80 text-amber-800 dark:text-amber-200 text-xs flex items-center gap-2">
                        <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                        <span>
                          Start Mileage ({eq.startMileage} km) is lower than previous supervisor&apos;s end mileage ({handoverMileage} km).
                        </span>
                      </div>
                    )}

                    {hasDuplicateActivity && (
                      <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800/80 text-blue-800 dark:text-blue-200 text-xs flex items-center gap-2">
                        <Info size={14} className="text-blue-600 flex-shrink-0" />
                        <span>
                          Activity Notice: <strong>{sharedSupervisors.join(', ')}</strong> also worked on activity &quot;{eq.activityCode}&quot; today. Ensure work locations or shift sections are differentiated.
                        </span>
                      </div>
                    )}
                    
                    {/* ── Mode Status Banner ── */}
                    {/* <div className="flex items-center justify-between p-2 rounded-xl bg-slate-100/90 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 text-xs">
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
                    </div> */}

                    
                    {renderUnitInputs(eq, primaryUnit, false)}

                    {/* ── 2. Fuel Refueling Section (DB field: fuel_liters) ── */}
                    <div className="p-3 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/60 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0 shadow-2xs">
                            <Fuel size={13} />
                          </div>
                          <div>
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100 block">
                              Fuel Issued
                            </span>
                            
                          </div>
                        </div>

                        {Number(eq.fuelIssuedLiters || 0) > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-mono">
                            {eq.fuelIssuedLiters} L
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-3 pt-1">
                        <div className="relative flex-1 max-w-[180px]">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            disabled={isDayLocked}
                            placeholder="0.0"
                            value={eq.fuelIssuedLiters ? eq.fuelIssuedLiters : ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              handleFuelChange(eq.id, val);
                            }}
                            className="w-full pl-3 pr-5 py-1.5 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 font-mono disabled:opacity-60"
                          />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 pointer-events-none">
                            L
                          </span>
                        </div>

                        {!isDayLocked && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {[20, 50, 100, 200].map((qty) => (
                              <button
                                key={qty}
                                type="button"
                                onClick={() => handleFuelChange(eq.id, qty)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                                  Number(eq.fuelIssuedLiters || 0) === qty
                                    ? 'bg-amber-600 border-amber-600 text-white shadow-2xs'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-amber-50 hover:border-amber-300'
                                }`}
                              >
                                +{qty}L
                              </button>
                            ))}
                            {Number(eq.fuelIssuedLiters || 0) > 0 && (
                              <button
                                type="button"
                                onClick={() => handleFuelChange(eq.id, 0)}
                                className="text-[10px] text-slate-400 hover:text-red-500 font-semibold px-1.5 py-1 cursor-pointer transition-colors"
                                title="Clear Fuel"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* ── 2. ADDITIONAL UNIT SECTION (Optional) ── */}
                    {/* {additionalUnit ? (
                      renderUnitInputs(eq, additionalUnit, true)
                    ) : (
                      
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
                    )} */}

                    

                    {/* ── Auto-save Status ── */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500">
                      <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                        <Check size={13} className="text-emerald-500" />
                        <span>Auto-saved</span>
                      </span>
                      <span className="text-[10px]">Changes save automatically</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Site Equipment Pool Selector Modal ── */}
      <SiteEquipmentPoolModal
        isOpen={isPoolModalOpen}
        onClose={() => setIsPoolModalOpen(false)}
        selectedDate={selectedDate}
        currentEquipment={equipment}
        onAddEquipment={handleAddFromPool}
      />
    </div>
  );
}
