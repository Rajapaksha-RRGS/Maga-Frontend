import React, { useState, useMemo } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RotateCcw,
  Tag,
  Pencil,
  Check,
  X,
  Loader2,
  Users,
  HardHat,
  Truck,
  Fuel,
  Gauge
} from 'lucide-react';
import { 
  adminAdjustWorker, 
  type SupervisorApprovalGroup, 
  type ApprovalWorkerItem,
  type ApprovalEquipmentItem
} from '../services/approvalService';

const isEquipmentLogged = (eq: ApprovalEquipmentItem) =>
  eq.netHours > 0 ||
  eq.workingHours > 0 ||
  eq.loggedQuantity > 0 ||
  eq.fuelLiters > 0 ||
  eq.status === 'approved' ||
  eq.status === 'logged' ||
  Boolean(eq.splits && eq.splits.length > 0 && eq.splits.some((s) => s.utilization > 0));

interface SupervisorApprovalCardProps {
  group: SupervisorApprovalGroup;
  selectedDate: string;
  onApprove: (supervisorId: string) => Promise<void>;
  onReject: (supervisorId: string) => Promise<void>;
  onRefresh?: () => void;
  isProcessing?: boolean;
  searchQuery?: string;
  searchScope?: 'all' | 'labor' | 'operators' | 'equipment';
}

export const SupervisorApprovalCard: React.FC<SupervisorApprovalCardProps> = ({
  group,
  selectedDate,
  onApprove,
  onReject,
  onRefresh,
  isProcessing = false,
  searchQuery = '',
  searchScope = 'all',
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'labor' | 'operators' | 'equipment'>(() => {
    const hasLabor = Boolean(group.workers && group.workers.length > 0);
    const hasOperators = Boolean(group.operators && group.operators.length > 0);
    const hasEquipment = Boolean(group.equipment && group.equipment.some(isEquipmentLogged));

    if (!hasLabor && hasOperators) return 'operators';
    if (!hasLabor && !hasOperators && hasEquipment) return 'equipment';
    return 'labor';
  });
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editInTime, setEditInTime] = useState<string>('07:30');
  const [editOutTime, setEditOutTime] = useState<string>('17:00');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [localWorkers, setLocalWorkers] = useState<ApprovalWorkerItem[]>(group.workers || []);

  const q = searchQuery.toLowerCase().trim();

  // Sync local workers when group prop changes and smart-select active tab
  React.useEffect(() => {
    setLocalWorkers(group.workers || []);
    const hasLabor = Boolean(group.workers && group.workers.length > 0);
    const hasOperators = Boolean(group.operators && group.operators.length > 0);
    const hasEquipment = Boolean(group.equipment && group.equipment.some(isEquipmentLogged));

    if (!hasLabor && hasOperators) {
      setActiveTab((prev) => (prev === 'labor' ? 'operators' : prev));
    } else if (!hasLabor && !hasOperators && hasEquipment) {
      setActiveTab((prev) => (prev === 'labor' ? 'equipment' : prev));
    }
  }, [group.workers, group.operators, group.equipment]);

  const isApproved = group.status === 'approved';
  const isSubmitted = group.status === 'submitted';

  // Preview hours calculation (1-hr standard break deduction; 2-hr deduction if shift passes 11:00 PM / 23:00)
  const computePreviewHours = (inTime: string, outTime: string) => {
    if (!inTime || !outTime) return { hours: 0, otHours: 0, effectiveHours: 0 };
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const inMins = inH * 60 + (inM || 0);
    const outMins = outH * 60 + (outM || 0);
    let diff = outMins - inMins;
    if (diff < 0) diff += 24 * 60;
    if (diff <= 0) return { hours: 0, otHours: 0, effectiveHours: 0 };

    // Standard 1 hour break deduction
    let breakMins = 60;
    const isPast11PM = (outMins >= inMins)
      ? (outMins >= 23 * 60)
      : (inMins <= 23 * 60 || outMins >= 23 * 60);
    if (isPast11PM) {
      breakMins = 120; // 2 hours break if passes 11:00 PM
    }

    const netMins = Math.max(0, diff - breakMins);
    const effectiveHours = netMins > 0 ? parseFloat((netMins / 60).toFixed(2)) : 0;
    const ot = effectiveHours > 8.0 ? parseFloat((effectiveHours - 8.0).toFixed(2)) : 0;
    const reg = Math.max(0, parseFloat((effectiveHours - ot).toFixed(2)));
    return { hours: reg, otHours: ot, effectiveHours };
  };

  const startEditing = (w: ApprovalWorkerItem) => {
    setEditingEmployeeId(w.employeeId);
    setEditInTime(w.inTime || '07:30');
    setEditOutTime(w.outTime || '17:00');
  };

  const cancelEditing = () => {
    setEditingEmployeeId(null);
  };

  const handleSaveEdit = async (employeeId: string) => {
    setIsSavingEdit(true);
    try {
      const { hours, otHours, effectiveHours } = computePreviewHours(editInTime, editOutTime);
      const res = await adminAdjustWorker({
        supervisorId: group.supervisorId,
        employeeId,
        date: selectedDate,
        inTime: editInTime,
        outTime: editOutTime,
        hours,
        overtimeHours: otHours,
      });

      // Update local row immediately for instant feedback
      setLocalWorkers((prev) =>
        prev.map((w) =>
          w.employeeId === employeeId
            ? {
                ...w,
                inTime: editInTime,
                outTime: editOutTime,
                hours: res.hours ?? hours,
                otHours: res.overtimeHours ?? otHours,
                shiftHours: res.shiftHours ?? effectiveHours,
                effectiveHours: res.effectiveHours ?? res.shiftHours ?? effectiveHours,
                status: 'submitted',
              }
            : w
        )
      );

      setEditingEmployeeId(null);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save admin adjustments');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const workersCount = group.counts?.laborWorked ?? group.workedCount ?? 0;
  const workersTotal = group.counts?.laborAssigned ?? group.assignedCount ?? 0;
  const operatorsCount = group.counts?.operatorsWorked ?? (group.operators?.length || 0);
  const operatorsTotal = group.counts?.operatorsAssigned ?? (group.operators?.length || 0);

  const workerHours = (group.totals?.laborHours ?? group.totalHours ?? 0).toFixed(1);
  const workerOt = (group.totals?.laborOvertime ?? group.totalOvertime ?? 0).toFixed(1);
  const equipmentFuel = group.totals?.equipmentFuel ?? 0;

  // Method 2: Only show logged equipment (machines with actual hours/usage logged)
  const loggedEquipment = useMemo(() => {
    return (group.equipment || []).filter(isEquipmentLogged);
  }, [group.equipment]);

  // ── Targeted scope & query filtering with useMemo ───────────────────────────
  // 1. Laborers Filter
  const displayedWorkers = useMemo(() => {
    if (!q || (searchScope !== 'all' && searchScope !== 'labor')) {
      return localWorkers;
    }
    return localWorkers.filter(
      (w) =>
        (w.callingName && w.callingName.toLowerCase().includes(q)) ||
        (w.fullName && w.fullName.toLowerCase().includes(q)) ||
        (w.employeeCode && w.employeeCode.toLowerCase().includes(q)) ||
        (w.tradeGroup && w.tradeGroup.toLowerCase().includes(q)) ||
        (w.businessPartner && w.businessPartner.toLowerCase().includes(q))
    );
  }, [localWorkers, q, searchScope]);

  // 2. Operators Filter
  const displayedOperators = useMemo(() => {
    const list = group.operators || [];
    if (!q || (searchScope !== 'all' && searchScope !== 'operators')) {
      return list;
    }
    return list.filter(
      (o) =>
        (o.callingName && o.callingName.toLowerCase().includes(q)) ||
        (o.fullName && o.fullName.toLowerCase().includes(q)) ||
        (o.operatorCode && o.operatorCode.toLowerCase().includes(q)) ||
        (o.assignedEquipmentDisplay && o.assignedEquipmentDisplay.toLowerCase().includes(q))
    );
  }, [group.operators, q, searchScope]);

  // 3. Equipment Filter
  const displayedEquipment = useMemo(() => {
    if (!q || (searchScope !== 'all' && searchScope !== 'equipment')) {
      return loggedEquipment;
    }
    return loggedEquipment.filter(
      (e) =>
        (e.equipmentCode && e.equipmentCode.toLowerCase().includes(q)) ||
        (e.magaNo && e.magaNo.toLowerCase().includes(q)) ||
        (e.equipmentName && e.equipmentName.toLowerCase().includes(q))
    );
  }, [loggedEquipment, q, searchScope]);

  // Auto-expand card and auto-switch tab to the relevant resource when search is active
  React.useEffect(() => {
    if (q) {
      setExpanded(true);
      if (searchScope === 'labor') {
        setActiveTab('labor');
      } else if (searchScope === 'operators') {
        setActiveTab('operators');
      } else if (searchScope === 'equipment') {
        setActiveTab('equipment');
      } else {
        // 'all' scope: automatically activate tab that actually contains the matching result
        const hasWorkerMatch = localWorkers.some(
          (w) =>
            (w.callingName && w.callingName.toLowerCase().includes(q)) ||
            (w.fullName && w.fullName.toLowerCase().includes(q)) ||
            (w.employeeCode && w.employeeCode.toLowerCase().includes(q))
        );
        const hasOpMatch = (group.operators || []).some(
          (o) =>
            (o.callingName && o.callingName.toLowerCase().includes(q)) ||
            (o.fullName && o.fullName.toLowerCase().includes(q)) ||
            (o.operatorCode && o.operatorCode.toLowerCase().includes(q))
        );
        const hasEqMatch = loggedEquipment.some(
          (e) =>
            (e.equipmentCode && e.equipmentCode.toLowerCase().includes(q)) ||
            (e.magaNo && e.magaNo.toLowerCase().includes(q)) ||
            (e.equipmentName && e.equipmentName.toLowerCase().includes(q))
        );

        if (hasOpMatch && !hasWorkerMatch) {
          setActiveTab('operators');
        } else if (hasEqMatch && !hasWorkerMatch && !hasOpMatch) {
          setActiveTab('equipment');
        } else if (hasWorkerMatch) {
          setActiveTab('labor');
        }
      }
    }
  }, [q, searchScope, localWorkers, group.operators, loggedEquipment]);

  console.log("Current op data:", group.operators);
  console.log(group.counts);
  

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300">
      {/* Header bar */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Supervisor Info */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 flex-shrink-0 font-bold text-base">
            {group.supervisorName ? group.supervisorName.charAt(0).toUpperCase() : 'S'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {group.supervisorName}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                @{group.username}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  isApproved
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isSubmitted
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isApproved ? 'Approved' : isSubmitted ? 'Submitted (Awaiting Approval)' : 'Draft in Progress'}
              </span>
            </div>

            {/* 3 Pillars Summary Badges */}
            <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 flex-wrap">
              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-medium transition-all ${
                q && (searchScope === 'labor' || searchScope === 'all') && displayedWorkers.length > 0
                  ? 'bg-blue-100 border-blue-300 text-blue-900 ring-2 ring-blue-400/30 font-semibold'
                  : 'bg-blue-50 border-blue-100'
              }`}>
                <Users size={12} className="text-blue-600" />
                <span>
                  Labor: <strong>{q ? displayedWorkers.length : workersCount}/{workersTotal}</strong> ({workerHours}h, OT: {workerOt}h)
                </span>
              </div>

              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-medium transition-all ${
                q && (searchScope === 'operators' || searchScope === 'all') && displayedOperators.length > 0
                  ? 'bg-violet-100 border-violet-300 text-violet-900 ring-2 ring-violet-400/30 font-semibold'
                  : 'bg-violet-50 border-violet-100'
              }`}>
                <HardHat size={12} className="text-violet-600" />
                <span>
                  Operators: <strong>{q ? displayedOperators.length : operatorsCount}/{operatorsTotal}</strong>
                </span>
              </div>

              <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border font-medium transition-all ${
                q && (searchScope === 'equipment' || searchScope === 'all') && displayedEquipment.length > 0
                  ? 'bg-amber-100 border-amber-300 text-amber-900 ring-2 ring-amber-400/30 font-semibold'
                  : 'bg-amber-50 border-amber-100'
              }`}>
                <Truck size={12} className="text-amber-600" />
                <span>
                  Equipment: <strong>{q ? displayedEquipment.length : loggedEquipment.length}</strong> ({equipmentFuel}L Fuel)
                </span>
              </div>

              {group.submittedAt && (
                <span className="text-[11px] text-slate-400">
                  Submitted: {new Date(group.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 self-end md:self-center">
          {/* Reject / Return to draft */}
          {!isApproved && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onReject(group.supervisorId)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              title="Return back to draft for supervisor to edit"
            >
              <RotateCcw size={14} />
              <span>Send Back</span>
            </button>
          )}

          {/* Approve Button */}
          {!isApproved ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onApprove(group.supervisorId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Approve All</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-emerald-700 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 size={14} />
              <span>Approved</span>
            </span>
          )}

          {/* Expand/Collapse Accordion */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle details breakdown"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Accordion Detail Tables */}
      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5 space-y-4">
          {/* Sub-tab navigation */}
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab('labor')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'labor'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Users size={14} />
              <span>
                Laborers ({displayedWorkers.length}
                {q && (searchScope === 'all' || searchScope === 'labor') && displayedWorkers.length !== localWorkers.length
                  ? ` of ${localWorkers.length}`
                  : ''})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('operators')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'operators'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <HardHat size={14} />
              <span>
                Machine Operators ({displayedOperators.length}
                {q && (searchScope === 'all' || searchScope === 'operators') && displayedOperators.length !== (group.operators?.length || 0)
                  ? ` of ${group.operators?.length || 0}`
                  : ''})
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('equipment')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'equipment'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Truck size={14} />
              <span>
                Plant & Equipment ({displayedEquipment.length}
                {q && (searchScope === 'all' || searchScope === 'equipment') && displayedEquipment.length !== loggedEquipment.length
                  ? ` of ${loggedEquipment.length}`
                  : ''})
              </span>
            </button>
          </div>

          {/* TAB 1: LABORERS */}
          {activeTab === 'labor' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  {q && (searchScope === 'all' || searchScope === 'labor') ? (
                    <span className="text-blue-700 font-bold">
                      Filtered: Showing {displayedWorkers.length} of {localWorkers.length} laborer(s) matching "{searchQuery}"
                    </span>
                  ) : (
                    `Verified against ${workersTotal} worker assignment(s) · ${isApproved ? 'Locked' : 'Click Edit to adjust In/Out'}`
                  )}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3.5">Worker</th>
                      <th className="py-2.5 px-3">Trade & Partner</th>
                      <th className="py-2.5 px-3 min-w-[140px]">In / Out Time</th>
                      <th className="py-2.5 px-3">Effective Hours</th>
                      <th className="py-2.5 px-3">OT Hrs</th>
                      <th className="py-2.5 px-3">Activities Worked</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                      {!isApproved && <th className="py-2.5 px-3 text-center">Admin Edit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedWorkers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          {q ? `No laborers match "${searchQuery}" for this supervisor.` : 'No workers assigned for this supervisor.'}
                        </td>
                      </tr>
                    ) : (
                      displayedWorkers.map((w) => {
                        const isEditingThis = editingEmployeeId === w.employeeId;
                        const hasAttendance = Boolean(w.inTime && w.outTime);
                        const preview = isEditingThis ? computePreviewHours(editInTime, editOutTime) : null;
                        const effectiveVal = w.effectiveHours ?? w.shiftHours ?? ((w.hours ?? 0) + (w.otHours ?? 0));

                        return (
                          <tr
                            key={w.employeeId}
                            className={isEditingThis ? 'bg-blue-50/50' : 'hover:bg-blue-50/20 transition-colors'}
                          >
                            <td className="py-2.5 px-3.5">
                              <div className="font-semibold text-slate-900">
                                {w.callingName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {w.employeeCode}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-slate-800">
                                {w.tradeGroup}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                                {w.businessPartner}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditingThis ? (
                                <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-blue-300 shadow-2xs">
                                  <input
                                    type="time"
                                    value={editInTime}
                                    onChange={(e) => setEditInTime(e.target.value)}
                                    className="w-18 px-1 py-0.5 rounded text-xs font-bold text-slate-900 font-mono border border-slate-200 focus:outline-none focus:border-blue-500"
                                  />
                                  <span className="text-slate-400 font-bold">–</span>
                                  <input
                                    type="time"
                                    value={editOutTime}
                                    onChange={(e) => setEditOutTime(e.target.value)}
                                    className="w-18 px-1 py-0.5 rounded text-xs font-bold text-slate-900 font-mono border border-slate-200 focus:outline-none focus:border-blue-500"
                                  />
                                </div>
                              ) : hasAttendance ? (
                                <span className="font-mono text-slate-900 font-medium">
                                  {w.inTime} – {w.outTime}
                                </span>
                              ) : (
                                <span className="text-amber-600 font-semibold text-[11px]">
                                  Not Recorded
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {isEditingThis && preview ? (
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold font-mono">
                                  {(preview.effectiveHours ?? 0).toFixed(1)}h
                                </span>
                              ) : effectiveVal > 0 ? (
                                `${effectiveVal.toFixed(1)}h`
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditingThis && preview ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold font-mono">
                                  +{(preview.otHours ?? 0).toFixed(1)}h
                                </span>
                              ) : (w.otHours ?? 0) > 0 ? (
                                <span className="font-bold text-amber-600">
                                  +{(w.otHours ?? 0).toFixed(1)}h
                                </span>
                              ) : (
                                <span className="text-slate-400">0.0h</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {(() => {
                                const acts = w.activities || [];
                                const hasZidleInActs = acts.some((a) => a.code === 'ZIDLE' || a.code.toLowerCase().includes('idle'));
                                const effHours = w.effectiveHours ?? w.shiftHours ?? ((w.hours ?? 0) + (w.otHours ?? 0));
                                const totalAllocated = acts.reduce((s, a) => s + (a.hours || 0), 0);
                                const fallbackIdle = !hasZidleInActs && effHours > totalAllocated
                                  ? Math.max(0, parseFloat((effHours - totalAllocated).toFixed(2)))
                                  : (w.idleHours || 0);

                                if (acts.length === 0 && fallbackIdle === 0 && !hasAttendance) {
                                  return <span className="text-slate-400 text-[11px]">-</span>;
                                }

                                if (acts.length === 0 && (fallbackIdle > 0 || effHours > 0)) {
                                  const idleAmount = fallbackIdle > 0 ? fallbackIdle : effHours;
                                  return (
                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-semibold"
                                        title="Idle / Unallocated Shift Hours"
                                      >
                                        <Tag size={10} className="text-amber-600" />
                                        Idle (ZIDLE): {idleAmount.toFixed(1)}h
                                      </span>
                                    </div>
                                  );
                                }

                                return (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {acts.map((act, i) => {
                                      const isIdle = act.code === 'ZIDLE' || act.code.toLowerCase().includes('idle');
                                      return (
                                        <span
                                          key={i}
                                          className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded font-medium border ${
                                            isIdle
                                              ? 'bg-amber-50 text-amber-800 border-amber-300 font-semibold'
                                              : 'bg-blue-50 text-blue-700 border-blue-200'
                                          }`}
                                          title={act.description || (isIdle ? 'Idle / Unallocated Hours' : '')}
                                        >
                                          <Tag size={10} className={isIdle ? 'text-amber-600' : 'text-blue-500'} />
                                          {isIdle ? `Idle (${act.code}): ${act.hours}h` : `${act.code}: ${act.hours}h`}
                                        </span>
                                      );
                                    })}
                                    {!hasZidleInActs && fallbackIdle > 0 && (
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-semibold"
                                        title="Idle / Unallocated Shift Hours"
                                      >
                                        <Tag size={10} className="text-amber-600" />
                                        Idle (ZIDLE): {fallbackIdle.toFixed(1)}h
                                      </span>
                                    )}
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  w.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : hasAttendance
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {w.status === 'approved' ? 'Approved' : hasAttendance ? 'Done' : 'Missing'}
                              </span>
                            </td>

                            {/* Admin Inline Edit Actions */}
                            {!isApproved && (
                              <td className="py-2.5 px-3 text-center">
                                {isEditingThis ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={isSavingEdit}
                                      onClick={() => handleSaveEdit(w.employeeId)}
                                      className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
                                      title="Save adjustments"
                                    >
                                      {isSavingEdit ? (
                                        <Loader2 size={13} className="animate-spin" />
                                      ) : (
                                        <Check size={13} />
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSavingEdit}
                                      onClick={cancelEditing}
                                      className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => startEditing(w)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                                    title="Edit In/Out times for this worker"
                                  >
                                    <Pencil size={11} />
                                    <span>Edit</span>
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: OPERATORS */}
          {activeTab === 'operators' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  {q && (searchScope === 'all' || searchScope === 'operators') ? (
                    <span className="text-violet-700 font-bold">
                      Filtered: Showing {displayedOperators.length} of {group.operators?.length || 0} operator(s) matching "{searchQuery}"
                    </span>
                  ) : (
                    `Assigned Machine Operators (${group.operators?.length || 0})`
                  )}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3.5">Operator</th>
                      <th className="py-2.5 px-3">Assigned Machine</th>
                      <th className="py-2.5 px-3 min-w-[130px]">In / Out Time</th>
                      <th className="py-2.5 px-3">Effective Hours</th>
                      <th className="py-2.5 px-3">OT Hrs</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!displayedOperators || displayedOperators.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          {q ? `No machine operators match "${searchQuery}" for this supervisor.` : 'No machine operators assigned for this supervisor.'}
                        </td>
                      </tr>
                    ) : (
                      displayedOperators.map((op) => {
                        const hasAttendance = Boolean(op.inTime && op.outTime);
                        const effectiveVal = op.effectiveHours ?? op.shiftHours ?? ((op.hours ?? 0) + (op.otHours ?? 0));
                        return (
                          <tr key={op.operatorId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 px-3.5">
                              <div className="font-semibold text-slate-900">
                                {op.callingName || op.fullName}
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {op.operatorCode}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              {op.assignedEquipmentDisplay && op.assignedEquipmentDisplay !== '—' ? (
                                <div
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                    op.assignedEquipmentDisplay.includes('ZXQOPRIDLE')
                                      ? 'bg-amber-50 text-amber-900 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800'
                                      : 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800'
                                  }`}
                                >
                                  <Truck
                                    size={12}
                                    className={
                                      op.assignedEquipmentDisplay.includes('ZXQOPRIDLE')
                                        ? 'text-amber-600'
                                        : 'text-blue-600'
                                    }
                                  />
                                  <span>{op.assignedEquipmentDisplay}</span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-slate-400 text-[11px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                  Unassigned Machine
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-mono">
                              {hasAttendance ? (
                                <span className="text-slate-900 font-medium">
                                  {op.inTime} – {op.outTime}
                                </span>
                              ) : (
                                <span className="text-amber-600 font-semibold text-[11px]">
                                  Not Recorded
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {effectiveVal > 0 ? `${effectiveVal.toFixed(1)}h` : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {(op.otHours ?? 0) > 0 ? (
                                <span className="font-bold text-amber-600">
                                  +{(op.otHours ?? 0).toFixed(1)}h
                                </span>
                              ) : (
                                <span className="text-slate-400">0.0h</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  op.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : hasAttendance
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {op.status === 'approved' ? 'Approved' : hasAttendance ? 'Done' : 'Missing'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: EQUIPMENT */}
          {activeTab === 'equipment' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  {q && (searchScope === 'all' || searchScope === 'equipment') ? (
                    <span className="text-amber-800 font-bold">
                      Filtered: Showing {displayedEquipment.length} of {loggedEquipment.length} equipment matching "{searchQuery}"
                    </span>
                  ) : (
                    `Logged Plant & Equipment Daily Logs (${loggedEquipment.length})`
                  )}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3.5">Equipment / Machine</th>
                      <th className="py-2.5 px-3">Condition</th>
                      <th className="py-2.5 px-3">Logged Usage</th>
                      <th className="py-2.5 px-3">Meters</th>
                      <th className="py-2.5 px-3">Fuel (L)</th>
                      <th className="py-2.5 px-3">Activities Worked</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedEquipment.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          {q ? `No plant & equipment match "${searchQuery}" for this supervisor.` : 'No plant & equipment logged for this supervisor.'}
                        </td>
                      </tr>
                    ) : (
                      displayedEquipment.map((eq) => {
                        const isWorking = eq.condition === 'WORKING';
                        const isBreakdown = eq.condition === 'BREAKDOWN';
                        const isLogged = eq.netHours > 0 || eq.loggedQuantity > 0;
                        return (
                          <tr key={eq.equipmentId} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-2.5 px-3.5">
                              <div className="font-semibold text-slate-900">
                                {eq.equipmentName}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                                <span>{eq.equipmentCode}</span>
                                {eq.magaNo && <span>• {eq.magaNo}</span>}
                              </div>
                            </td>
                            <td className="py-2.5 px-3">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  isWorking
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isBreakdown
                                    ? 'bg-red-50 text-red-700 border-red-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {eq.condition || 'DRY'}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              {(() => {
                                const unitUpper = (eq.primaryUnit || 'hrs').toUpperCase();
                                if (unitUpper === 'HRS') {
                                  const hrs = Number(eq.netHours || eq.workingHours || eq.loggedQuantity || 0);
                                  return (
                                    <>
                                      <div className="font-semibold text-slate-900">{hrs.toFixed(1)} Hrs</div>
                                      <span className="text-[10px] text-slate-400 font-mono">Unit: HRS</span>
                                    </>
                                  );
                                }
                                if (unitUpper === 'MTH') {
                                  const qty = Number(eq.loggedQuantity ?? 0);
                                  return (
                                    <>
                                      <div className="font-semibold text-slate-900">{qty} mth</div>
                                      <span className="text-[10px] text-violet-600 font-medium">Monthly Hire (mth)</span>
                                    </>
                                  );
                                }
                                if (unitUpper === 'DAYS' || unitUpper === 'DAY') {
                                  const days = Number(eq.loggedQuantity || 1);
                                  return (
                                    <>
                                      <div className="font-semibold text-slate-900">{days} Day{days === 1 ? '' : 's'}</div>
                                      <span className="text-[10px] text-slate-400 font-mono">Unit: DAY</span>
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <div className="font-semibold text-slate-900">{eq.loggedQuantity ?? 0} {unitUpper}</div>
                                    <span className="text-[10px] text-slate-400 font-mono">Unit: {unitUpper}</span>
                                  </>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {eq.initialMeter > 0 || eq.finalMeter > 0 ? (
                                <div className="flex items-center gap-1 text-slate-700">
                                  <Gauge size={12} className="text-slate-400" />
                                  <span>{eq.initialMeter} – {eq.finalMeter}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {eq.fuelLiters > 0 ? (
                                <span className="inline-flex items-center gap-1 text-amber-700">
                                  <Fuel size={12} />
                                  <span>{eq.fuelLiters} L</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">0 L</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {eq.splits && eq.splits.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {eq.splits.map((act, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                                      title={act.activityDesc}
                                    >
                                      <Tag size={10} />
                                      {act.activityCode}: {act.utilization} {act.unit}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-slate-400 text-[11px]">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                  eq.status === 'approved'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isLogged
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}
                              >
                                {eq.status === 'approved' ? 'Approved' : 'Logged'}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};


