import React, { useState, useMemo, useEffect } from 'react';
import {
  Users,
  HardHat,
  Truck,
  CheckCircle2,
  RotateCcw,
  Tag,
  Pencil,
  Check,
  X,
  Loader2,
  Fuel,
  Gauge,
  Filter,
  FileSpreadsheet
} from 'lucide-react';
import {
  adminAdjustWorker,
  type SupervisorApprovalGroup,
  type ApprovalWorkerItem,
  type ApprovalOperatorItem,
  type ApprovalEquipmentItem,
  type ApprovalDayTypeInfo,
} from '../services/approvalService';
import { computeBreakMinutes } from '../../supervisor/utils/timeUtils';
import { formatHoursDisplay, toHhMmTooltip } from './SupervisorApprovalCard';
import { exportConsolidatedLaborToExcel } from '../utils/exportConsolidatedExcel';

export interface ConsolidatedWorkerItem extends ApprovalWorkerItem {
  supervisorId: string;
  supervisorName: string;
  supervisorUsername: string;
}

export interface ConsolidatedOperatorItem extends ApprovalOperatorItem {
  supervisorId: string;
  supervisorName: string;
  supervisorUsername: string;
}

export interface ConsolidatedEquipmentItem extends ApprovalEquipmentItem {
  supervisorId: string;
  supervisorName: string;
  supervisorUsername: string;
}

const isEquipmentLogged = (eq: ApprovalEquipmentItem) =>
  eq.netHours > 0 ||
  eq.workingHours > 0 ||
  eq.loggedQuantity > 0 ||
  eq.fuelLiters > 0 ||
  eq.status === 'approved' ||
  eq.status === 'logged' ||
  Boolean(eq.splits && eq.splits.length > 0 && eq.splits.some((s) => s.utilization > 0));

interface ConsolidatedApprovalViewProps {
  groups: SupervisorApprovalGroup[];
  selectedDate: string;
  dayType?: ApprovalDayTypeInfo;
  isApprovedView?: boolean;
  onApproveSupervisor: (supervisorId: string) => Promise<void>;
  onRejectSupervisor: (supervisorId: string) => Promise<void>;
  onRefresh?: () => void;
  processingId?: string | null;
  searchQuery?: string;
  searchScope?: 'all' | 'labor' | 'operators' | 'equipment';
  onSearchScopeChange?: (scope: 'all' | 'labor' | 'operators' | 'equipment') => void;
}

export const ConsolidatedApprovalView: React.FC<ConsolidatedApprovalViewProps> = ({
  groups,
  selectedDate,
  dayType,
  isApprovedView = false,
  onApproveSupervisor,
  onRejectSupervisor,
  onRefresh,
  processingId,
  searchQuery = '',
  searchScope = 'all',
  onSearchScopeChange,
}) => {
  // Active Resource Tab (Labor | Operators | Equipment)
  const [activeTab, setActiveTab] = useState<'labor' | 'operators' | 'equipment'>('labor');
  const [selectedSupervisorId, setSelectedSupervisorId] = useState<string | 'all'>('all');

  // Inline editing state for labor
  const [editingKey, setEditingKey] = useState<string | null>(null); // supervisorId_employeeId
  const [editInTime, setEditInTime] = useState<string>('07:30');
  const [editOutTime, setEditOutTime] = useState<string>('17:00');
  const [editAdditionalHours, setEditAdditionalHours] = useState<string>('0.0');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Local state for workers to allow immediate optimistic feedback on edit
  const [localGroups, setLocalGroups] = useState<SupervisorApprovalGroup[]>(groups);

  useEffect(() => {
    setLocalGroups(groups);
  }, [groups]);

  // Sync activeTab with searchScope when searchScope changes externally
  useEffect(() => {
    if (searchScope === 'labor') {
      setActiveTab('labor');
    } else if (searchScope === 'operators') {
      setActiveTab('operators');
    } else if (searchScope === 'equipment') {
      setActiveTab('equipment');
    }
  }, [searchScope]);

  const handleTabChange = (tab: 'labor' | 'operators' | 'equipment') => {
    setActiveTab(tab);
    if (onSearchScopeChange) {
      onSearchScopeChange(tab);
    }
  };

  const q = searchQuery.toLowerCase().trim();

  // 1. Flatten all workers across all groups
  const allWorkers = useMemo<ConsolidatedWorkerItem[]>(() => {
    return localGroups.flatMap((group) =>
      (group.workers || []).map((w) => ({
        ...w,
        supervisorId: group.supervisorId,
        supervisorName: group.supervisorName,
        supervisorUsername: group.username,
      }))
    );
  }, [localGroups]);

  // 2. Flatten all operators across all groups
  const allOperators = useMemo<ConsolidatedOperatorItem[]>(() => {
    return localGroups.flatMap((group) =>
      (group.operators || []).map((op) => ({
        ...op,
        supervisorId: group.supervisorId,
        supervisorName: group.supervisorName,
        supervisorUsername: group.username,
      }))
    );
  }, [localGroups]);

  // 3. Flatten all equipment across all groups
  const allEquipment = useMemo<ConsolidatedEquipmentItem[]>(() => {
    return localGroups.flatMap((group) =>
      (group.equipment || []).filter(isEquipmentLogged).map((eq) => ({
        ...eq,
        supervisorId: group.supervisorId,
        supervisorName: group.supervisorName,
        supervisorUsername: group.username,
      }))
    );
  }, [localGroups]);

  // Filtered workers
  const displayedWorkers = useMemo(() => {
    return allWorkers.filter((w) => {
      if (selectedSupervisorId !== 'all' && w.supervisorId !== selectedSupervisorId) {
        return false;
      }
      if (!q) return true;
      return (
        (w.callingName && w.callingName.toLowerCase().includes(q)) ||
        (w.fullName && w.fullName.toLowerCase().includes(q)) ||
        (w.employeeCode && w.employeeCode.toLowerCase().includes(q)) ||
        (w.tradeGroup && w.tradeGroup.toLowerCase().includes(q)) ||
        (w.businessPartner && w.businessPartner.toLowerCase().includes(q)) ||
        (w.supervisorName && w.supervisorName.toLowerCase().includes(q)) ||
        (w.supervisorUsername && w.supervisorUsername.toLowerCase().includes(q))
      );
    });
  }, [allWorkers, selectedSupervisorId, q]);

  // Filtered operators
  const displayedOperators = useMemo(() => {
    return allOperators.filter((op) => {
      if (selectedSupervisorId !== 'all' && op.supervisorId !== selectedSupervisorId) {
        return false;
      }
      if (!q) return true;
      return (
        (op.callingName && op.callingName.toLowerCase().includes(q)) ||
        (op.fullName && op.fullName.toLowerCase().includes(q)) ||
        (op.operatorCode && op.operatorCode.toLowerCase().includes(q)) ||
        (op.assignedEquipmentDisplay && op.assignedEquipmentDisplay.toLowerCase().includes(q)) ||
        (op.supervisorName && op.supervisorName.toLowerCase().includes(q)) ||
        (op.supervisorUsername && op.supervisorUsername.toLowerCase().includes(q))
      );
    });
  }, [allOperators, selectedSupervisorId, q]);

  // Filtered equipment
  const displayedEquipment = useMemo(() => {
    return allEquipment.filter((eq) => {
      if (selectedSupervisorId !== 'all' && eq.supervisorId !== selectedSupervisorId) {
        return false;
      }
      if (!q) return true;
      return (
        (eq.equipmentCode && eq.equipmentCode.toLowerCase().includes(q)) ||
        (eq.magaNo && eq.magaNo.toLowerCase().includes(q)) ||
        (eq.equipmentName && eq.equipmentName.toLowerCase().includes(q)) ||
        (eq.supervisorName && eq.supervisorName.toLowerCase().includes(q)) ||
        (eq.supervisorUsername && eq.supervisorUsername.toLowerCase().includes(q))
      );
    });
  }, [allEquipment, selectedSupervisorId, q]);

  // Inline edit calculation helper
  const computePreviewHours = (inTime: string, outTime: string, addHours = 0, worker?: ConsolidatedWorkerItem) => {
    if (!inTime || !outTime) return { hours: 0, otHours: 0, effectiveHours: 0, totalHours: 0 };
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const inMins = inH * 60 + (inM || 0);
    const outMins = outH * 60 + (outM || 0);
    let diff = outMins - inMins;
    if (diff <= 0) diff += 24 * 60;
    if (diff <= 0) return { hours: 0, otHours: 0, effectiveHours: 0, totalHours: 0 };

    const totalHours = parseFloat((diff / 60).toFixed(2));
    const { breakMinutes: breakMins } = computeBreakMinutes(inMins, outMins);
    const netMins = Math.max(0, diff - breakMins);
    const rawEffective = netMins > 0 ? parseFloat((netMins / 60).toFixed(2)) : 0;
    const effectiveHours = Math.max(0, parseFloat((rawEffective + (addHours || 0)).toFixed(2)));

    const d = new Date(selectedDate);
    const dow = d.getDay(); // 0 = Sun, 6 = Sat
    const isExt = worker ? Boolean(worker.isExternal || (worker.businessPartner && !worker.businessPartner.toLowerCase().includes('direct'))) : false;

    let ot = 0;
    let reg = effectiveHours;

    if (dayType?.isAllOvertime || dayType?.standardHoursCap === 0 || dow === 0) {
      ot = effectiveHours;
      reg = 0;
    } else if (isExt) {
      const cap = dow === 6 ? 5.5 : 8.0;
      reg = Math.min(effectiveHours, cap);
      ot = effectiveHours > cap ? parseFloat((effectiveHours - cap).toFixed(2)) : 0;
    } else if (dow === 6) {
      reg = Math.min(effectiveHours, 5.5);
      ot = parseFloat((effectiveHours - 5.5).toFixed(2));
    } else {
      if (effectiveHours > 6.0) {
        reg = Math.min(effectiveHours, 8.0);
        ot = parseFloat((effectiveHours - 8.0).toFixed(2));
      } else {
        reg = Math.min(effectiveHours, 4.0);
        ot = parseFloat((effectiveHours - 4.0).toFixed(2));
      }
    }
    return { hours: reg, otHours: ot, effectiveHours, totalHours };
  };

  const startEditing = (w: ConsolidatedWorkerItem) => {
    setEditingKey(`${w.supervisorId}_${w.employeeId}`);
    setEditInTime(w.inTime || '07:30');
    setEditOutTime(w.outTime || '17:00');
    setEditAdditionalHours(w.additionalHours !== undefined ? String(w.additionalHours) : '0.0');
  };

  const cancelEditing = () => {
    setEditingKey(null);
  };

  const handleSaveEdit = async (w: ConsolidatedWorkerItem) => {
    setIsSavingEdit(true);
    try {
      const addVal = parseFloat(editAdditionalHours) || 0;
      const { hours, otHours, effectiveHours, totalHours } = computePreviewHours(editInTime, editOutTime, addVal, w);

      const res = await adminAdjustWorker({
        supervisorId: w.supervisorId,
        employeeId: w.employeeId,
        date: selectedDate,
        inTime: editInTime,
        outTime: editOutTime,
        hours,
        overtimeHours: otHours,
        additionalHours: addVal,
      });

      // Update optimistic local state
      setLocalGroups((prev) =>
        prev.map((group) => {
          if (group.supervisorId !== w.supervisorId) return group;
          return {
            ...group,
            workers: (group.workers || []).map((worker) =>
              worker.employeeId === w.employeeId
                ? {
                    ...worker,
                    inTime: editInTime,
                    outTime: editOutTime,
                    totalHours: res.totalHours ?? totalHours ?? worker.totalHours,
                    hours: res.hours ?? hours,
                    otHours: res.overtimeHours ?? otHours,
                    additionalHours: addVal,
                    shiftHours: res.shiftHours ?? effectiveHours,
                    effectiveHours: res.effectiveHours ?? res.shiftHours ?? effectiveHours,
                    status: 'submitted',
                  }
                : worker
            ),
          };
        })
      );

      setEditingKey(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to save admin adjustments');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleExportExcel = async () => {
    if (activeTab === 'labor') {
      const supGroup = selectedSupervisorId !== 'all' ? localGroups.find((g) => g.supervisorId === selectedSupervisorId) : null;
      const supName = supGroup ? supGroup.supervisorName : 'All_Supervisors';
      await exportConsolidatedLaborToExcel(displayedWorkers, selectedDate, supName);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Resource Sub-Tabs Selector ─────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200 p-2 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left Sub-tabs (Laborers | Machine Operators | Plant & Equipment) */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <button
            type="button"
            onClick={() => handleTabChange('labor')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'labor'
                ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users size={15} />
            <span>Laborers</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'labor' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {allWorkers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('operators')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'operators'
                ? 'bg-violet-600 text-white shadow-xs ring-2 ring-violet-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <HardHat size={15} />
            <span>Machine Operators</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'operators' ? 'bg-violet-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {allOperators.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('equipment')}
            className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'equipment'
                ? 'bg-amber-600 text-white shadow-xs ring-2 ring-amber-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Truck size={15} />
            <span>Plant & Equipment</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                activeTab === 'equipment' ? 'bg-amber-700 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {allEquipment.length}
            </span>
          </button>
        </div>

        {/* Status Count Helper & Export Button */}
        <div className="flex items-center gap-3 text-xs text-slate-500 px-2 flex-wrap">
          <span>
            Showing{' '}
            <strong className="text-slate-800">
              {activeTab === 'labor'
                ? displayedWorkers.length
                : activeTab === 'operators'
                ? displayedOperators.length
                : displayedEquipment.length}
            </strong>{' '}
            of{' '}
            {activeTab === 'labor'
              ? allWorkers.length
              : activeTab === 'operators'
              ? allOperators.length
              : allEquipment.length}{' '}
            record(s)
          </span>

          {activeTab === 'labor' && displayedWorkers.length > 0 && (
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors shadow-2xs cursor-pointer ml-auto"
              title="Download currently filtered worker entries to Excel sheet"
            >
              <FileSpreadsheet size={14} className="text-emerald-600" />
              <span>Export to Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Supervisor Filter & Action Pills Bar ────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 shadow-2xs space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
            <Filter size={14} className="text-blue-600" />
            <span>Filter by Supervisor:</span>
            {selectedSupervisorId !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedSupervisorId('all')}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold underline ml-1 cursor-pointer"
              >
                Clear filter (Show all)
              </button>
            )}
          </div>

          <div className="text-[11px] text-slate-500 font-medium">
            {localGroups.length} supervisor{localGroups.length === 1 ? '' : 's'} submitted
          </div>
        </div>

        {/* Supervisor horizontal chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5">
          {/* ALL SUPERVISORS PILL */}
          <button
            type="button"
            onClick={() => setSelectedSupervisorId('all')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex-shrink-0 ${
              selectedSupervisorId === 'all'
                ? 'bg-slate-900 text-white shadow-2xs ring-2 ring-slate-800/30'
                : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            <span>All Supervisors</span>
            <span
              className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${
                selectedSupervisorId === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {activeTab === 'labor'
                ? allWorkers.length
                : activeTab === 'operators'
                ? allOperators.length
                : allEquipment.length}
            </span>
          </button>

          {/* INDIVIDUAL SUPERVISOR CHIPS */}
          {localGroups.map((group) => {
            const isSelected = selectedSupervisorId === group.supervisorId;
            const isSupervisorProcessing = processingId === group.supervisorId;
            const wCount = group.workers?.length || 0;
            const opCount = group.operators?.length || 0;
            const eqCount = (group.equipment || []).filter(isEquipmentLogged).length;
            const activeItemCount = activeTab === 'labor' ? wCount : activeTab === 'operators' ? opCount : eqCount;

            return (
              <div
                key={group.supervisorId}
                className={`inline-flex items-center gap-1.5 p-1 pr-2.5 rounded-xl text-xs font-semibold transition-all border flex-shrink-0 ${
                  isSelected
                    ? 'bg-blue-50 border-blue-300 text-blue-900 ring-2 ring-blue-500/20'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                }`}
              >
                {/* Supervisor Selector Button */}
                <button
                  type="button"
                  onClick={() => setSelectedSupervisorId(group.supervisorId)}
                  className="flex items-center gap-1.5 text-left cursor-pointer"
                  title={`Filter by ${group.supervisorName}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                    {group.supervisorName ? group.supervisorName.charAt(0).toUpperCase() : 'S'}
                  </div>
                  <span className="font-bold text-slate-900 truncate max-w-[120px]">
                    {group.supervisorName}
                  </span>
                  <span className="px-1.5 py-0.2 rounded-md text-[10px] font-mono bg-slate-100 text-slate-600">
                    {activeItemCount}
                  </span>
                </button>

                {/* Supervisor Approval Actions (when submitted view and not approved) */}
                {!isApprovedView && (
                  <div className="flex items-center gap-1 pl-1 border-l border-slate-200 ml-1">
                    <button
                      type="button"
                      disabled={isSupervisorProcessing}
                      onClick={() => onApproveSupervisor(group.supervisorId)}
                      className="p-1 rounded-md text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
                      title={`Approve all entries for ${group.supervisorName}`}
                    >
                      {isSupervisorProcessing ? (
                        <Loader2 size={12} className="animate-spin text-emerald-600" />
                      ) : (
                        <CheckCircle2 size={12} />
                      )}
                    </button>
                    <button
                      type="button"
                      disabled={isSupervisorProcessing}
                      onClick={() => onRejectSupervisor(group.supervisorId)}
                      className="p-1 rounded-md text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                      title={`Return ${group.supervisorName} entries to draft`}
                    >
                      <RotateCcw size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 1. UNIFIED LABOR TABLE ─────────────────────────────────────────── */}
      {activeTab === 'labor' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  <th className="py-3 px-3.5 min-w-[150px]">Supervisor</th>
                  <th className="py-3 px-3.5 min-w-[150px]">Worker</th>
                  <th className="py-3 px-3 min-w-[140px]">Trade & Partner</th>
                  <th className="py-3 px-3 min-w-[150px]">In / Out Time</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">Total Hours</th>
                  <th className="py-3 px-3">Effective Hours</th>
                  <th className="py-3 px-3">OT Hrs</th>
                  <th className="py-3 px-3 min-w-[170px]">Activities Worked</th>
                  <th className="py-3 px-3 text-right">Status</th>
                  {!isApprovedView && <th className="py-3 px-3 text-center min-w-[80px]">Admin Edit</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={isApprovedView ? 9 : 10} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Users size={28} className="text-slate-300" />
                        <span className="font-medium text-slate-600">
                          {q || selectedSupervisorId !== 'all'
                            ? 'No laborers match the selected filters.'
                            : 'No laborers submitted.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedWorkers.map((w) => {
                    const rowKey = `${w.supervisorId}_${w.employeeId}`;
                    const isEditingThis = editingKey === rowKey;
                    const hasAttendance = Boolean(w.inTime && w.outTime);
                    const preview = isEditingThis ? computePreviewHours(editInTime, editOutTime, parseFloat(editAdditionalHours) || 0, w) : null;
                    const effectiveVal = w.effectiveHours ?? w.shiftHours ?? ((w.hours ?? 0) + (w.otHours ?? 0));

                    return (
                      <tr
                        key={rowKey}
                        className={isEditingThis ? 'bg-blue-50/50' : 'hover:bg-slate-50/70 transition-colors'}
                      >
                        {/* SUPERVISOR BADGE */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-100 border border-blue-200 text-blue-800 flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs">
                              {w.supervisorName ? w.supervisorName.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate max-w-[130px]" title={w.supervisorName}>
                                {w.supervisorName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate max-w-[130px]">
                                @{w.supervisorUsername}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* WORKER DETAILS */}
                        <td className="py-2.5 px-3.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{w.callingName}</span>
                            {!w.isExternal && (w.daysWorked ?? 0) > 0 && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {w.daysWorked === 1 ? '1.0 Day' : `${w.daysWorked} Day`}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {w.employeeCode}
                          </div>
                        </td>

                        {/* TRADE & PARTNER */}
                        <td className="py-2.5 px-3">
                          <div className="font-medium text-slate-800">
                            {w.tradeGroup || '—'}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[140px]" title={w.businessPartner}>
                            {w.businessPartner || 'Direct Mäga'}
                          </div>
                        </td>

                        {/* IN / OUT TIME */}
                        <td className="py-2.5 px-3">
                          {isEditingThis ? (
                            <div className="flex flex-col gap-1">
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
                              <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                                <span>+Add Hrs:</span>
                                <input
                                  type="number"
                                  step="0.5"
                                  min="0"
                                  max="12"
                                  value={editAdditionalHours}
                                  onChange={(e) => setEditAdditionalHours(e.target.value)}
                                  className="w-12 px-1 py-0.5 rounded text-[11px] font-bold font-mono border border-slate-200 focus:outline-none focus:border-blue-500 bg-white"
                                  placeholder="0.0"
                                />
                              </div>
                            </div>
                          ) : hasAttendance ? (
                            <div>
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-mono text-slate-900 font-medium">
                                  {w.inTime} – {w.outTime}
                                </span>
                                {(w.additionalHours ?? 0) > 0 && (
                                  <span
                                    className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200"
                                    title={`Additional Hours: +${w.additionalHours}h`}
                                  >
                                    +{w.additionalHours}h Add
                                  </span>
                                )}
                              </div>
                              {(w.breakHours ?? 0) > 0 && (
                                <div
                                  className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5"
                                  title={`Break deducted: ${w.breakHours}h`}
                                >
                                  <span>Break: -{w.breakHours}h</span>
                                  {w.isLunchDeducted && w.isDinnerDeducted && (
                                    <span className="text-slate-500 font-semibold">(Lunch+Dinner)</span>
                                  )}
                                  {w.isLunchDeducted && !w.isDinnerDeducted && (
                                    <span className="text-slate-500 font-semibold">(Lunch)</span>
                                  )}
                                  {!w.isLunchDeducted && w.isDinnerDeducted && (
                                    <span className="text-slate-500 font-semibold">(Dinner)</span>
                                  )}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-600 font-semibold text-[11px]">
                              Not Recorded
                            </span>
                          )}
                        </td>

                        {/* TOTAL HOURS (GROSS) */}
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            const curIn = isEditingThis ? editInTime : w.inTime;
                            const curOut = isEditingThis ? editOutTime : w.outTime;
                            let grossVal = isEditingThis && preview ? preview.totalHours : (w.totalHours || 0);
                            if (!grossVal && curIn && curOut) {
                              const [inH, inM] = curIn.split(':').map(Number);
                              const [outH, outM] = curOut.split(':').map(Number);
                              if (!isNaN(inH) && !isNaN(outH)) {
                                let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
                                if (diff <= 0) diff += 24 * 60;
                                grossVal = Math.round((diff / 60) * 100) / 100;
                              }
                            }
                            return grossVal > 0 ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs"
                                title={`Total Presence (Gross Out - In): ${formatHoursDisplay(grossVal)}`}
                              >
                                {formatHoursDisplay(grossVal)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">-</span>
                            );
                          })()}
                        </td>

                        {/* EFFECTIVE HOURS */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {isEditingThis && preview ? (
                            <span
                              className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold font-mono"
                              title={toHhMmTooltip(preview.effectiveHours)}
                            >
                              {formatHoursDisplay(preview.effectiveHours)}
                            </span>
                          ) : effectiveVal > 0 ? (
                            <span title={toHhMmTooltip(effectiveVal)}>
                              {formatHoursDisplay(effectiveVal)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* OT HOURS */}
                        <td className="py-2.5 px-3">
                          {isEditingThis && preview ? (
                            <span
                              className={`px-1.5 py-0.5 rounded font-bold font-mono ${
                                preview.otHours > 0
                                  ? 'bg-amber-100 text-amber-800'
                                  : preview.otHours < 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                              title={toHhMmTooltip(preview.otHours)}
                            >
                              {preview.otHours > 0
                                ? `+${formatHoursDisplay(preview.otHours)}`
                                : formatHoursDisplay(preview.otHours)}
                            </span>
                          ) : (w.otHours ?? 0) > 0 ? (
                            <span className="font-bold text-amber-600" title={toHhMmTooltip(w.otHours)}>
                              +{formatHoursDisplay(w.otHours)}
                            </span>
                          ) : (w.otHours ?? 0) < 0 ? (
                            <span className="font-bold text-rose-600" title={toHhMmTooltip(w.otHours)}>
                              {formatHoursDisplay(w.otHours)}
                            </span>
                          ) : (
                            <span className="text-slate-400">0.0h</span>
                          )}
                        </td>

                        {/* ACTIVITIES WORKED */}
                        <td className="py-2.5 px-3">
                          {(() => {
                            const acts = w.activities || [];
                            const hasZidleInActs = acts.some(
                              (a) => a.code === 'ZIDLE' || a.code.toLowerCase().includes('idle')
                            );
                            const effHours = w.effectiveHours ?? w.shiftHours ?? ((w.hours ?? 0) + (w.otHours ?? 0));
                            const totalAllocated = acts.reduce((s, a) => s + (a.hours || 0), 0);
                            const fallbackIdle =
                              !hasZidleInActs && effHours > totalAllocated
                                ? Math.max(0, parseFloat((effHours - totalAllocated).toFixed(2)))
                                : w.idleHours || 0;

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
                                    Idle (ZIDLE): {formatHoursDisplay(idleAmount)}
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
                                      {isIdle
                                        ? `Idle (${act.code}): ${formatHoursDisplay(act.hours)}`
                                        : `${act.code}: ${formatHoursDisplay(act.hours)}`}
                                    </span>
                                  );
                                })}
                                {!hasZidleInActs && fallbackIdle > 0 && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-semibold"
                                    title="Idle / Unallocated Shift Hours"
                                  >
                                    <Tag size={10} className="text-amber-600" />
                                    Idle (ZIDLE): {formatHoursDisplay(fallbackIdle)}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        {/* STATUS */}
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              w.status === 'approved' || isApprovedView
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : hasAttendance
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {w.status === 'approved' || isApprovedView
                              ? 'Approved'
                              : hasAttendance
                              ? 'Done'
                              : 'Missing'}
                          </span>
                        </td>

                        {/* ADMIN INLINE EDIT */}
                        {!isApprovedView && (
                          <td className="py-2.5 px-3 text-center">
                            {isEditingThis ? (
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  disabled={isSavingEdit}
                                  onClick={() => handleSaveEdit(w)}
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

      {/* ── 2. UNIFIED OPERATORS TABLE ─────────────────────────────────────── */}
      {activeTab === 'operators' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  <th className="py-3 px-3.5 min-w-[150px]">Supervisor</th>
                  <th className="py-3 px-3.5 min-w-[150px]">Machine Operator</th>
                  <th className="py-3 px-3 min-w-[140px]">Assigned Machine</th>
                  <th className="py-3 px-3 min-w-[140px]">In / Out Time</th>
                  <th className="py-3 px-3 text-center min-w-[90px]">Total Hours</th>
                  <th className="py-3 px-3">Effective Hours</th>
                  <th className="py-3 px-3">OT Hrs</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedOperators.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <HardHat size={28} className="text-slate-300" />
                        <span className="font-medium text-slate-600">
                          {q || selectedSupervisorId !== 'all'
                            ? 'No machine operators match the selected filters.'
                            : 'No machine operators submitted.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedOperators.map((op) => {
                    const hasAttendance = Boolean(op.inTime && op.outTime);
                    const effectiveVal =
                      op.effectiveHours ?? op.shiftHours ?? ((op.hours ?? 0) + (op.otHours ?? 0));
                    return (
                      <tr
                        key={`${op.supervisorId}_${op.operatorId}`}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* SUPERVISOR BADGE */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-violet-100 border border-violet-200 text-violet-800 flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs">
                              {op.supervisorName ? op.supervisorName.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate max-w-[130px]" title={op.supervisorName}>
                                {op.supervisorName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate max-w-[130px]">
                                @{op.supervisorUsername}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* OPERATOR DETAILS */}
                        <td className="py-2.5 px-3.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <span>{op.callingName || op.fullName}</span>
                            {!op.isExternal && (op.daysWorked ?? 0) > 0 && (
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {op.daysWorked === 1 ? '1.0 Day' : `${op.daysWorked} Day`}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {op.operatorCode}
                          </div>
                        </td>

                        {/* ASSIGNED MACHINE */}
                        <td className="py-2.5 px-3">
                          {op.assignedEquipmentDisplay && op.assignedEquipmentDisplay !== '—' ? (
                            <div
                              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                                op.assignedEquipmentDisplay.includes('ZXQOPRIDLE')
                                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                                  : 'bg-blue-50 text-blue-900 border-blue-200'
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

                        {/* IN / OUT TIME */}
                        <td className="py-2.5 px-3 font-mono">
                          {hasAttendance ? (
                            <div>
                              <span className="text-slate-900 font-medium">
                                {op.inTime} – {op.outTime}
                              </span>
                              {(op.breakHours ?? 0) > 0 && (
                                <div
                                  className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5"
                                  title={`Break deducted: ${op.breakHours}h`}
                                >
                                  <span>Break: -{op.breakHours}h</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-600 font-semibold text-[11px]">
                              Not Recorded
                            </span>
                          )}
                        </td>

                        {/* TOTAL HOURS (GROSS) */}
                        <td className="py-2.5 px-3 text-center">
                          {(() => {
                            let grossVal = op.totalHours || 0;
                            if (!grossVal && op.inTime && op.outTime) {
                              const [inH, inM] = op.inTime.split(':').map(Number);
                              const [outH, outM] = op.outTime.split(':').map(Number);
                              if (!isNaN(inH) && !isNaN(outH)) {
                                let diff = (outH * 60 + (outM || 0)) - (inH * 60 + (inM || 0));
                                if (diff <= 0) diff += 24 * 60;
                                grossVal = Math.round((diff / 60) * 100) / 100;
                              }
                            }
                            return grossVal > 0 ? (
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-slate-100 text-slate-800 border border-slate-200 shadow-2xs"
                                title={`Total Presence (Gross Out - In): ${formatHoursDisplay(grossVal)}`}
                              >
                                {formatHoursDisplay(grossVal)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">-</span>
                            );
                          })()}
                        </td>

                        {/* EFFECTIVE HOURS */}
                        <td className="py-2.5 px-3 font-semibold text-slate-900">
                          {effectiveVal > 0 ? (
                            <span title={toHhMmTooltip(effectiveVal)}>
                              {formatHoursDisplay(effectiveVal)}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>

                        {/* OT HOURS */}
                        <td className="py-2.5 px-3">
                          {(op.otHours ?? 0) > 0 ? (
                            <span className="font-bold text-amber-600" title={toHhMmTooltip(op.otHours)}>
                              +{formatHoursDisplay(op.otHours)}
                            </span>
                          ) : (op.otHours ?? 0) < 0 ? (
                            <span className="font-bold text-rose-600" title={toHhMmTooltip(op.otHours)}>
                              {formatHoursDisplay(op.otHours)}
                            </span>
                          ) : (
                            <span className="text-slate-400">0.0h</span>
                          )}
                        </td>

                        {/* STATUS */}
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              op.status === 'approved' || isApprovedView
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : hasAttendance
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {op.status === 'approved' || isApprovedView
                              ? 'Approved'
                              : hasAttendance
                              ? 'Done'
                              : 'Missing'}
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

      {/* ── 3. UNIFIED PLANT & EQUIPMENT TABLE ─────────────────────────────── */}
      {activeTab === 'equipment' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  <th className="py-3 px-3.5 min-w-[150px]">Supervisor</th>
                  <th className="py-3 px-3.5 min-w-[150px]">Equipment / Machine</th>
                  <th className="py-3 px-3">Condition</th>
                  <th className="py-3 px-3">Logged Usage</th>
                  <th className="py-3 px-3">Meters</th>
                  <th className="py-3 px-3">Fuel (L)</th>
                  <th className="py-3 px-3 min-w-[170px]">Activities Worked</th>
                  <th className="py-3 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedEquipment.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Truck size={28} className="text-slate-300" />
                        <span className="font-medium text-slate-600">
                          {q || selectedSupervisorId !== 'all'
                            ? 'No plant & equipment match the selected filters.'
                            : 'No plant & equipment logged.'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  displayedEquipment.map((eq) => {
                    const isWorking = eq.condition === 'WORKING';
                    const isBreakdown = eq.condition === 'BREAKDOWN';
                    const isLogged = eq.netHours > 0 || eq.loggedQuantity > 0;
                    return (
                      <tr
                        key={`${eq.supervisorId}_${eq.equipmentId}`}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        {/* SUPERVISOR BADGE */}
                        <td className="py-2.5 px-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-amber-100 border border-amber-200 text-amber-800 flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-2xs">
                              {eq.supervisorName ? eq.supervisorName.charAt(0).toUpperCase() : 'S'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs truncate max-w-[130px]" title={eq.supervisorName}>
                                {eq.supervisorName}
                              </div>
                              <div className="text-[10px] text-slate-500 font-mono truncate max-w-[130px]">
                                @{eq.supervisorUsername}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* EQUIPMENT DETAILS */}
                        <td className="py-2.5 px-3.5">
                          <div className="font-semibold text-slate-900">
                            {eq.equipmentName}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                            <span>{eq.equipmentCode}</span>
                            {eq.magaNo && <span>• {eq.magaNo}</span>}
                          </div>
                        </td>

                        {/* CONDITION */}
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

                        {/* LOGGED USAGE */}
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

                        {/* METERS */}
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

                        {/* FUEL */}
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

                        {/* ACTIVITIES */}
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

                        {/* STATUS */}
                        <td className="py-2.5 px-3 text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              eq.status === 'approved' || isApprovedView
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : isLogged
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                          >
                            {eq.status === 'approved' || isApprovedView ? 'Approved' : 'Logged'}
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
  );
};
