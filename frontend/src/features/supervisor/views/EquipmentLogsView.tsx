import { useState, useMemo } from 'react';
import { 
  Tractor, 
  Gauge, 
  Fuel, 
  AlertTriangle, 
  Save, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  HardHat, 
  PauseCircle, 
  PlayCircle,
  Search,
  X
} from 'lucide-react';
import type { 
  EquipmentLogEntry, 
  OperatorEntry 
} from '../services/supervisorStorageService';

interface EquipmentLogsViewProps {
  equipment: EquipmentLogEntry[];
  operators: OperatorEntry[];
  onSaveEquipment: (updated: EquipmentLogEntry[]) => void;
}

export function EquipmentLogsView({
  equipment,
  operators,
  onSaveEquipment,
}: EquipmentLogsViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'done'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(() => equipment[0]?.id || null);
  const [saveSuccessId, setSaveSuccessId] = useState<string | null>(null);

  // Counts
  const doneCount = equipment.filter((e) => e.netHours > 0).length;
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
      if (statusFilter === 'pending') return eq.netHours === 0;
      if (statusFilter === 'done') return eq.netHours > 0;
      return true;
    });
  }, [equipment, searchQuery, statusFilter]);

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  // Update meter readings & recalculate net hours
  const handleMeterChange = (id: string, start: number, end: number) => {
    const net = end >= start ? parseFloat((end - start).toFixed(1)) : 0;
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;

      // If working hours was previously equal to old net or 0, default working hours to net
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

  const handleHoursBreakdown = (id: string, field: 'workingHours' | 'idleHours' | 'breakdownHours' | 'fuelIssuedLiters', value: number) => {
    const updated = equipment.map((eq) => 
      eq.id === id ? { ...eq, [field]: value, status: 'draft' as const } : eq
    );
    onSaveEquipment(updated);
  };

  const handleOperatorChange = (equipmentId: string, operatorId: string) => {
    const updated = equipment.map((eq) => 
      eq.id === equipmentId ? { ...eq, operatorId, status: 'draft' as const } : eq
    );
    onSaveEquipment(updated);
  };

  const handleRemarksChange = (id: string, remarks: string) => {
    const updated = equipment.map((eq) => 
      eq.id === id ? { ...eq, remarks } : eq
    );
    onSaveEquipment(updated);
  };

  const handleSaveDraft = (id: string) => {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const updated = equipment.map((eq) => {
      if (eq.id !== id) return eq;
      const isComplete = eq.netHours > 0 && eq.operatorId;
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
      {/* ── Top Header Notice ────────────────────────────────────────────────── */}
      

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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── Status Filter Chips ─────────────────────────────────────────────── */}
      <div className="p-2 bg-white dark:bg-slate-850 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
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
            const isMeterInvalid = eq.endMeter < eq.startMeter;
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
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {eq.type}
                      </p>

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
                        {eq.fuelIssuedLiters > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200">
                            <Fuel size={10} /> {eq.fuelIssuedLiters}L
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Net Running Hours Pill */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {eq.netHours > 0 ? (
                      <div className="text-right">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                          {eq.netHours} hrs
                        </span>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {eq.startMeter} → {eq.endMeter}
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

                {/* Expanded Meter Reading Inputs & Utilization */}
                {isExpanded && (
                  <div className="px-3.5 pb-4 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3.5 animate-in slide-in-from-top-1 duration-150">
                    {/* Meter Readings Row */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1">
                          <Gauge size={13} className="text-emerald-600" />
                          Engine Meter Readings (Hours)
                        </label>
                        {eq.lastSavedAt && (
                          <span className="text-[10px] text-slate-400">Saved: {eq.lastSavedAt}</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                            Start / Initial Meter
                          </label>
                          <input
                            type="number"
                            step="0.1"
                            value={eq.startMeter}
                            onChange={(e) => handleMeterChange(eq.id, parseFloat(e.target.value) || 0, eq.endMeter)}
                            className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>

                        <div>
                          <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
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
                                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100'
                            ].join(' ')}
                          />
                        </div>
                      </div>

                      {/* Net Hours Calculation Display */}
                      <div className="mt-2 flex items-center justify-between p-2 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-xs">
                        <span className="text-slate-600 dark:text-slate-300">
                          Net Operating Utilization:
                        </span>
                        {isMeterInvalid ? (
                          <span className="text-red-600 dark:text-red-400 font-bold flex items-center gap-1">
                            <AlertTriangle size={13} /> Final meter cannot be less than initial!
                          </span>
                        ) : (
                          <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                            {eq.netHours.toFixed(1)} Hours
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Operational Hour Breakdown & Fuel */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1.5">
                        Hour Breakdown & Fuel Consumption
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                            <PlayCircle size={11} className="text-emerald-600" /> Working (h)
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={eq.workingHours}
                            onChange={(e) => handleHoursBreakdown(eq.id, 'workingHours', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-center"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                            <PauseCircle size={11} className="text-amber-500" /> Idle / Standby
                          </label>
                          <input
                            type="number"
                            step="0.5"
                            value={eq.idleHours}
                            onChange={(e) => handleHoursBreakdown(eq.id, 'idleHours', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-center"
                          />
                        </div>

                        <div>
                          <label className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mb-1">
                            <Fuel size={11} className="text-blue-600" /> Fuel Issued (L)
                          </label>
                          <input
                            type="number"
                            step="5"
                            value={eq.fuelIssuedLiters}
                            onChange={(e) => handleHoursBreakdown(eq.id, 'fuelIssuedLiters', parseFloat(e.target.value) || 0)}
                            className="w-full px-2.5 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-center"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Linked Operator Selector */}
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider block mb-1">
                        Operating Driver / Heavy Operator
                      </label>
                      <select
                        value={eq.operatorId || ''}
                        onChange={(e) => handleOperatorChange(eq.id, e.target.value)}
                        className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">-- No Operator Linked --</option>
                        {operators.map((op) => (
                          <option key={op.id} value={op.id}>
                            {op.employeeNumber ? `${op.employeeNumber} — ` : ''}{op.callingName} ({op.designation})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Operational Remarks */}
                    <div>
                      <label className="text-xs font-medium text-slate-600 dark:text-slate-400 block mb-1">
                        Work Location & Maintenance Remarks
                      </label>
                      <input
                        type="text"
                        value={eq.remarks || ''}
                        onChange={(e) => handleRemarksChange(eq.id, e.target.value)}
                        placeholder="e.g., Foundation pile excavation, hydraulic hose replaced…"
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    {/* Save Draft Action */}
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
                            <span>Equipment Meter Log Saved!</span>
                          </>
                        ) : (
                          <>
                            <Save size={15} />
                            <span>Save Equipment Draft Entry</span>
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
