import { useState, useMemo } from 'react';
import { 
  Tractor, 
  Gauge, 
  AlertTriangle, 
  Save, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  HardHat, 
  Search,
  X,
  Calendar,
  Clock,
  Zap,
  Maximize2,
  Sliders
} from 'lucide-react';
import type { 
  EquipmentLogEntry, 
  OperatorEntry,
  EquipmentRatingUnit 
} from '../services/supervisorStorageService';

interface EquipmentLogsViewProps {
  equipment: EquipmentLogEntry[];
  operators: OperatorEntry[];
  onSaveEquipment: (updated: EquipmentLogEntry[]) => void;
}

const UNIT_META: Record<EquipmentRatingUnit, { label: string; sub: string; icon: string }> = {
  'Days': { label: 'Days', sub: 'Day / Shift Rate', icon: '📅' },
  'Hrs': { label: 'Hrs', sub: 'Operating Hours', icon: '⏱️' },
  'EX.hrs': { label: 'EX.hrs', sub: 'Extra / OT Hours', icon: '⚡' },
  'mth': { label: 'mth', sub: 'Meter Hours (SMH)', icon: '⚙️' },
  'm2': { label: 'm²', sub: 'Work Area (Square Meters)', icon: '📐' },
};

function getEquipmentActiveValue(eq: EquipmentLogEntry): { value: number; label: string; display: string } {
  const unit: EquipmentRatingUnit = eq.activeUnit || 'mth';
  switch (unit) {
    case 'Days': {
      const v = eq.daysValue ?? (eq.netHours > 0 ? 1 : 0);
      return { value: v, label: 'Days', display: `${v} Day${v === 1 ? '' : 's'}` };
    }
    case 'Hrs': {
      const v = eq.hoursValue ?? eq.netHours;
      return { value: v, label: 'Hrs', display: `${v.toFixed(1)} Hrs` };
    }
    case 'EX.hrs': {
      const v = eq.extraHoursValue ?? 0;
      return { value: v, label: 'EX.hrs', display: `${v.toFixed(1)} EX.hrs` };
    }
    case 'mth': {
      const v = eq.netHours;
      return { value: v, label: 'mth', display: `${v.toFixed(1)} mth` };
    }
    case 'm2': {
      const v = eq.areaValue ?? 0;
      return { value: v, label: 'm²', display: `${v} m²` };
    }
    default:
      return { value: eq.netHours, label: 'mth', display: `${eq.netHours} mth` };
  }
}

export function EquipmentLogsView({
  equipment,
  operators,
  onSaveEquipment,
}: EquipmentLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);

  // Counts based on active unit value
  const doneCount = equipment.filter((e) => getEquipmentActiveValue(e).value > 0).length;
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
      const isDone = getEquipmentActiveValue(eq).value > 0;
      if (statusFilter === 'pending') return !isDone;
      if (statusFilter === 'done') return isDone;
      return true;
    });
  }, [equipment, searchQuery, statusFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // ── Unit Switching Handler ──
  const handleUnitChange = (id: string, newUnit: EquipmentRatingUnit) => {
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      let daysVal = eq.daysValue;
      if (newUnit === 'Days' && (daysVal === undefined || daysVal === 0)) {
        daysVal = 1; // 1-click default for 1 Day
      }
      return {
        ...eq,
        activeUnit: newUnit,
        daysValue: daysVal,
        status: 'draft' as const,
      };
    });
    onSaveEquipment(updated);
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

  const handleSaveDraft = (id: string) => {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      const activeInfo = getEquipmentActiveValue(eq);
      const isComplete = activeInfo.value > 0;
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

  return (
    <div className="space-y-3 pb-24 animate-in fade-in duration-150">
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
            Active / Operating ({doneCount})
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
            const activeVal = getEquipmentActiveValue(eq);
            const activeUnit: EquipmentRatingUnit = eq.activeUnit || 'mth';
            const isMeterInvalid = activeUnit === 'mth' && eq.endMeter < eq.startMeter;
            const isSavedJustNow = saveSuccessId === eq.id;

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
                    {activeVal.value > 0 ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 font-mono">
                          {activeVal.display}
                        </span>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                          {activeUnit === 'mth' ? `${eq.startMeter} → ${eq.endMeter}` : `Unit: ${activeUnit}`}
                        </p>
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

                {/* ── Expanded Content: Dynamic Rating Unit Selection & Inputs ── */}
                {isExpanded && (
                  <div className="px-3.5 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in slide-in-from-top-1 duration-150">
                    
                    {/* ── 1. Horizontal Rating Unit Selector ── */}
                    <div className="bg-slate-100/90 dark:bg-slate-900/70 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between px-0.5">
                        <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-400 tracking-wider flex items-center gap-1">
                          <Sliders size={12} className="text-emerald-600 dark:text-emerald-400" />
                          Rating Unit
                        </span>
                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                          Active: {activeUnit}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                        {(eq.availableUnits || ['mth', 'Days', 'Hrs']).map((unit) => {
                          const isSelected = activeUnit === unit;
                          return (
                            <button
                              key={unit}
                              type="button"
                              onClick={() => handleUnitChange(eq.id, unit)}
                              className={[
                                'py-1.5 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 flex-shrink-0 shadow-2xs',
                                isSelected
                                  ? 'bg-emerald-600 text-white shadow-xs scale-[1.02] ring-2 ring-emerald-500/20'
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-750 border border-slate-200 dark:border-slate-700'
                              ].join(' ')}
                            >
                              <span>{UNIT_META[unit]?.icon || '⚙️'}</span>
                              <span>{unit}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── 2. Dynamic Input Section Based on Active Unit ── */}
                    
                    {/* CASE A: DAYS (Day rate: 1-click select for 1 Day, 0.5 Day, etc.) */}
                    {activeUnit === 'Days' && (
                      <div className="space-y-2.5 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar size={13} className="text-emerald-600" />
                            Daily Rate Log
                          </label>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {eq.daysValue ?? 1} Day{(eq.daysValue ?? 1) === 1 ? '' : 's'}
                          </span>
                        </div>

                        {/* 1-Click Quick Select: "day ekak nm eka click ekaki 1 day" */}
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-1">1-Click Quick Select:</span>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[1, 0.5, 1.5, 2].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={() => handleDaysChange(eq.id, d)}
                                className={[
                                  'py-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center active:scale-95',
                                  (eq.daysValue ?? 1) === d
                                    ? 'bg-emerald-600 border-emerald-600 text-white shadow-xs ring-1 ring-emerald-500/20'
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                ].join(' ')}
                              >
                                {d === 1 ? '1 Day' : d === 0.5 ? '½ Day' : `${d} Days`}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Custom Day Input */}
                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-750">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Or enter custom days:
                          </span>
                          <div className="w-24">
                            <input
                              type="number"
                              step="0.25"
                              min="0"
                              value={eq.daysValue ?? 1}
                              onChange={(e) => handleDaysChange(eq.id, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CASE B: MTH (Service Meter Hours: Start Meter -> End Meter) */}
                    {activeUnit === 'mth' && (
                      <div className="space-y-2.5 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Gauge size={13} className="text-emerald-600" />
                            Service Meter Hours (mth)
                          </label>
                          {eq.lastSavedAt && (
                            <span className="text-[10px] text-slate-400">Saved: {eq.lastSavedAt}</span>
                          )}
                        </div>

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
                              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
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
                                'w-full px-3 py-2 text-xs font-bold rounded-xl border focus:ring-2 focus:ring-emerald-500 transition-colors',
                                isMeterInvalid
                                  ? 'border-red-500 bg-red-50 dark:bg-red-950/40 text-red-900'
                                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100'
                              ].join(' ')}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-900/60 text-xs">
                          <span className="text-slate-600 dark:text-slate-400">Net Utilization:</span>
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

                    {/* CASE C: HRS (Direct Operating Hours) */}
                    {activeUnit === 'Hrs' && (
                      <div className="space-y-2.5 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Clock size={13} className="text-blue-600" />
                            Operating Hours (Hrs)
                          </label>
                          <span className="text-xs font-bold text-blue-700 dark:text-blue-400">
                            {(eq.hoursValue ?? 8).toFixed(1)} Hrs
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
                                  'py-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center active:scale-95',
                                  (eq.hoursValue ?? 8) === h
                                    ? 'bg-blue-600 border-blue-600 text-white shadow-xs ring-1 ring-blue-500/20'
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                ].join(' ')}
                              >
                                {h}.0h
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-750">
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                            Exact Operating Hours:
                          </span>
                          <div className="w-24">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              value={eq.hoursValue ?? 8}
                              onChange={(e) => handleHoursChange(eq.id, parseFloat(e.target.value) || 0)}
                              className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CASE D: EX.HRS (Extra / Overtime Hours) */}
                    {activeUnit === 'EX.hrs' && (
                      <div className="space-y-2.5 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Zap size={13} className="text-amber-500" />
                            Extra / Overtime Hours (EX.hrs)
                          </label>
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400">
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
                                  'py-2 rounded-lg text-xs font-bold transition-all border flex items-center justify-center active:scale-95',
                                  (eq.extraHoursValue ?? 0) === ex
                                    ? 'bg-amber-600 border-amber-600 text-white shadow-xs ring-1 ring-amber-500/20'
                                    : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                                ].join(' ')}
                              >
                                +{ex}h
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-750">
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
                              className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* CASE E: M2 (Square Meters / Area Output) */}
                    {activeUnit === 'm2' && (
                      <div className="space-y-2.5 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                            <Maximize2 size={13} className="text-purple-600" />
                            Work Area Output (m²)
                          </label>
                          <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
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
                                className="py-2 rounded-lg text-xs font-bold transition-all border bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-750 text-slate-700 dark:text-slate-300 hover:bg-slate-100 active:scale-95"
                              >
                                +{area} m²
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-750">
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
                              className="w-full px-2 py-1 text-xs font-bold text-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* ── 3. Save Draft Action ── */}
                    <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => handleSaveDraft(eq.id)}
                        className={[
                          'w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl font-semibold text-xs transition-all shadow-xs active:scale-[0.99]',
                          isSavedJustNow
                            ? 'bg-emerald-600 text-white'
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
