import React, { useState } from 'react';
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
  type ApprovalWorkerItem 
} from '../services/approvalService';

interface SupervisorApprovalCardProps {
  group: SupervisorApprovalGroup;
  selectedDate: string;
  onApprove: (supervisorId: string) => Promise<void>;
  onReject: (supervisorId: string) => Promise<void>;
  onRefresh?: () => void;
  isProcessing?: boolean;
}

export const SupervisorApprovalCard: React.FC<SupervisorApprovalCardProps> = ({
  group,
  selectedDate,
  onApprove,
  onReject,
  onRefresh,
  isProcessing = false,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'labor' | 'operators' | 'equipment'>('labor');
  const [editingEmployeeId, setEditingEmployeeId] = useState<string | null>(null);
  const [editInTime, setEditInTime] = useState<string>('07:30');
  const [editOutTime, setEditOutTime] = useState<string>('17:00');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [localWorkers, setLocalWorkers] = useState<ApprovalWorkerItem[]>(group.workers);

  // Sync local workers when group prop changes
  React.useEffect(() => {
    setLocalWorkers(group.workers);
  }, [group.workers]);

  const isApproved = group.status === 'approved';
  const isSubmitted = group.status === 'submitted';

  // Preview hours calculation (1-hr lunch deduction if >= 5 hours, + 1-hr late night break if out-time passes 11:00 PM)
  const computePreviewHours = (inTime: string, outTime: string) => {
    if (!inTime || !outTime) return { hours: 0, otHours: 0 };
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const inMins = inH * 60 + (inM || 0);
    const outMins = outH * 60 + (outM || 0);
    let diff = outMins - inMins;
    if (diff < 0) diff += 24 * 60;
    if (diff <= 0) return { hours: 0, otHours: 0 };

    let breakMins = 0;
    if (diff >= 300) breakMins += 60; // 1-hour lunch break deduction
    const isPast11PM = (outMins >= inMins)
      ? (outMins >= 23 * 60)
      : (inMins <= 23 * 60 || outMins >= 23 * 60);
    if (isPast11PM) breakMins += 60; // 1-hour late night break deduction

    const netMins = Math.max(0, diff - breakMins);
    const net = netMins > 0 ? parseFloat((netMins / 60).toFixed(2)) : 0;
    const ot = net > 8.0 ? parseFloat((net - 8.0).toFixed(2)) : 0;
    return { hours: net, otHours: ot };
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
      const { hours, otHours } = computePreviewHours(editInTime, editOutTime);
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
                hours: res.hours,
                otHours: res.overtimeHours,
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

  const workersCount = group.counts?.laborWorked ?? group.workedCount;
  const workersTotal = group.counts?.laborAssigned ?? group.assignedCount;
  const operatorsCount = group.counts?.operatorsWorked ?? (group.operators?.length || 0);
  const operatorsTotal = group.counts?.operatorsAssigned ?? (group.operators?.length || 0);
  const equipmentCount = group.counts?.equipmentRunning ?? (group.equipment?.length || 0);
  const equipmentTotal = group.counts?.equipmentAssigned ?? (group.equipment?.length || 0);

  const workerHours = (group.totals?.laborHours ?? group.totalHours).toFixed(1);
  const workerOt = (group.totals?.laborOvertime ?? group.totalOvertime).toFixed(1);
  const equipmentFuel = group.totals?.equipmentFuel ?? 0;

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
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-50 border border-blue-100 font-medium">
                <Users size={12} className="text-blue-600" />
                <span>Labor: <strong>{workersCount}/{workersTotal}</strong> ({workerHours}h, OT: {workerOt}h)</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-violet-50 border border-violet-100 font-medium">
                <HardHat size={12} className="text-violet-600" />
                <span>Operators: <strong>{operatorsCount}/{operatorsTotal}</strong></span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-100 font-medium">
                <Truck size={12} className="text-amber-600" />
                <span>Equipment: <strong>{equipmentCount}/{equipmentTotal}</strong> ({equipmentFuel}L Fuel)</span>
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
          <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
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
              <span>Laborers ({localWorkers.length})</span>
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
              <span>Machine Operators ({group.operators?.length || 0})</span>
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
              <span>Plant & Equipment ({group.equipment?.length || 0})</span>
            </button>
          </div>

          {/* TAB 1: LABORERS */}
          {activeTab === 'labor' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-semibold text-slate-500">
                  Verified against {workersTotal} worker assignment(s) · {isApproved ? 'Locked' : 'Click Edit to adjust In/Out'}
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3.5">Worker</th>
                      <th className="py-2.5 px-3">Trade & Partner</th>
                      <th className="py-2.5 px-3 min-w-[140px]">In / Out Time</th>
                      <th className="py-2.5 px-3">Regular Hrs</th>
                      <th className="py-2.5 px-3">OT Hrs</th>
                      <th className="py-2.5 px-3">Activities Worked</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                      {!isApproved && <th className="py-2.5 px-3 text-center">Admin Edit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {localWorkers.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-6 text-center text-slate-400">
                          No workers assigned for this supervisor.
                        </td>
                      </tr>
                    ) : (
                      localWorkers.map((w) => {
                        const isEditingThis = editingEmployeeId === w.employeeId;
                        const hasAttendance = Boolean(w.inTime && w.outTime);
                        const preview = isEditingThis ? computePreviewHours(editInTime, editOutTime) : null;

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
                                  {preview.hours.toFixed(1)}h
                                </span>
                              ) : w.hours > 0 ? (
                                `${w.hours.toFixed(1)}h`
                              ) : (
                                '-'
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditingThis && preview ? (
                                <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-bold font-mono">
                                  +{preview.otHours.toFixed(1)}h
                                </span>
                              ) : w.otHours > 0 ? (
                                <span className="font-bold text-amber-600">
                                  +{w.otHours.toFixed(1)}h
                                </span>
                              ) : (
                                <span className="text-slate-400">0.0h</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {w.activities.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {w.activities.map((act, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                                      title={act.description}
                                    >
                                      <Tag size={10} />
                                      {act.code}: {act.hours}h
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
                  Assigned Machine Operators ({group.operators?.length || 0})
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                      <th className="py-2.5 px-3.5">Operator</th>
                      <th className="py-2.5 px-3">Assigned Machine</th>
                      <th className="py-2.5 px-3 min-w-[130px]">In / Out Time</th>
                      <th className="py-2.5 px-3">Regular Hrs</th>
                      <th className="py-2.5 px-3">OT Hrs</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!group.operators || group.operators.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400">
                          No machine operators assigned for this supervisor.
                        </td>
                      </tr>
                    ) : (
                      group.operators.map((op) => {
                        const hasAttendance = Boolean(op.inTime && op.outTime);
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
                              {op.hours > 0 ? `${op.hours.toFixed(1)}h` : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {op.otHours > 0 ? (
                                <span className="font-bold text-amber-600">
                                  +{op.otHours.toFixed(1)}h
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
                  Assigned Plant & Equipment Daily Logs ({group.equipment?.length || 0})
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
                    {!group.equipment || group.equipment.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-400">
                          No plant & equipment assigned for this supervisor.
                        </td>
                      </tr>
                    ) : (
                      group.equipment.map((eq) => {
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
                              <div className="font-semibold text-slate-900">
                                {eq.primaryUnit.toUpperCase() === 'HRS'
                                  ? `${eq.netHours} Hrs`
                                  : `${eq.loggedQuantity} ${eq.primaryUnit.toUpperCase()}`}
                              </div>
                              <span className="text-[10px] text-slate-400 font-mono">Unit: {eq.primaryUnit.toUpperCase()}</span>
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
                                {eq.status === 'approved' ? 'Approved' : isLogged ? 'Logged' : 'Assigned'}
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


