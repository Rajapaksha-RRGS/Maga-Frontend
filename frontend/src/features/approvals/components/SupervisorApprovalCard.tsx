import React, { useState, useMemo, useEffect } from 'react';
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
  Gauge,
  Plus,
  Trash2
} from 'lucide-react';
import { 
  adminAdjustWorker, 
  adminAdjustEquipment,
  type SupervisorApprovalGroup, 
  type ApprovalWorkerItem,
  type ApprovalOperatorItem,
  type ApprovalEquipmentItem
} from '../services/approvalService';
import { getAll as getAllActivityCodes } from '../../activity-codes/services/activityCodeService';
import { SearchableActivitySelect } from '../../supervisor/components/SearchableActivitySelect';
import type { ActivityCodeItem } from '../../supervisor/services/supervisorStorageService';
import { TimeInput24 } from '../../../components/TimeInput24';
import type { EditActivitySplit } from './ConsolidatedApprovalView';
import { computeBreakMinutes } from '../../supervisor/utils/timeUtils';

// Formats decimal hours preserving quarter-hours (e.g. 15.75h, 7.25h, 4.5h, 8.0h) instead of rounding to .1
export const formatHoursDisplay = (hours: number | undefined | null): string => {
  if (hours === undefined || hours === null || isNaN(hours)) return '0.0h';
  const num = Math.round(hours * 100) / 100;
  if (Number.isInteger(num)) return `${num.toFixed(1)}h`;
  if (Math.round(num * 10) / 10 === num) return `${num.toFixed(1)}h`;
  return `${num.toFixed(2)}h`;
};

// Returns clear hours and minutes tooltip e.g. "15h 45m"
export const toHhMmTooltip = (decimalHours: number | undefined | null): string => {
  if (decimalHours === undefined || decimalHours === null || isNaN(decimalHours)) return '0h 0m';
  const isNeg = decimalHours < 0;
  const abs = Math.abs(decimalHours);
  const h = Math.floor(abs);
  const m = Math.round((abs - h) * 60);
  return `${isNeg ? '-' : ''}${h}h ${m}m (${Math.round(decimalHours * 100) / 100}h)`;
};

const roundEq5 = (n: unknown): number => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.round(v * 100000) / 100000 : 0;
};

const formatEqDecimal = (n: unknown): string => {
  const r = roundEq5(n);
  return Number(r.toFixed(5)).toString();
};

const formatEqUnitLabel = (unit?: string | null): string => {
  const u = String(unit || 'hrs').trim().toLowerCase();
  if (u === 'mth' || u === 'month') return 'mth';
  if (u === 'day' || u === 'days') return 'Day';
  if (u === 'hrs' || u === 'hr' || u === 'hour' || u === 'hours') return 'Hrs';
  if (u === 'ex.hrs' || u === 'exhrs') return 'EX.hrs';
  if (u === 'km') return 'km';
  if (u === 'm2') return 'm²';
  return unit || 'Hrs';
};

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
  const [editAdditionalHours, setEditAdditionalHours] = useState<string>('0.0');
  const [editActivitySplits, setEditActivitySplits] = useState<EditActivitySplit[]>([]);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [localWorkers, setLocalWorkers] = useState<ApprovalWorkerItem[]>(group.workers || []);
  const [localOperators, setLocalOperators] = useState<ApprovalOperatorItem[]>(group.operators || []);
  const [localEquipment, setLocalEquipment] = useState<ApprovalEquipmentItem[]>(group.equipment || []);

  // Inline editing state for operator
  const [editingOperatorId, setEditingOperatorId] = useState<string | null>(null);
  const [editOpInTime, setEditOpInTime] = useState<string>('07:30');
  const [editOpOutTime, setEditOpOutTime] = useState<string>('17:00');
  const [editOpAdditionalHours, setEditOpAdditionalHours] = useState<string>('0.0');
  const [isSavingOpEdit, setIsSavingOpEdit] = useState(false);

  // Inline editing state for equipment
  const [editingEquipmentId, setEditingEquipmentId] = useState<string | null>(null);
  const [editEqCondition, setEditEqCondition] = useState<string>('WORKING');
  const [editEqNetHours, setEditEqNetHours] = useState<string>('0');
  const [editEqInitialMeter, setEditEqInitialMeter] = useState<string>('0');
  const [editEqFinalMeter, setEditEqFinalMeter] = useState<string>('0');
  const [editEqFuelLiters, setEditEqFuelLiters] = useState<string>('0');
  const [editEqSplits, setEditEqSplits] = useState<EditActivitySplit[]>([]);
  const [isSavingEqEdit, setIsSavingEqEdit] = useState(false);

  const [activityOptions, setActivityOptions] = useState<ActivityCodeItem[]>([]);

  useEffect(() => {
    getAllActivityCodes()
      .then((codes) => {
        setActivityOptions(
          codes.map((c) => ({
            id: c.id,
            code: c.code,
            name: c.description || c.code,
            trade: 'General',
            category: 'Labor',
            projectCode: c.projectCode,
          }))
        );
      })
      .catch((err) => console.error('Failed to load activity codes in approval card:', err));
  }, []);

  const q = searchQuery.toLowerCase().trim();

  // Sync local items when group prop changes and smart-select active tab
  React.useEffect(() => {
    setLocalWorkers(group.workers || []);
    setLocalOperators(group.operators || []);
    setLocalEquipment(group.equipment || []);
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
  const computePreviewHours = (inTime: string, outTime: string, addHours = 0) => {
    if (!inTime || !outTime) return { hours: 0, otHours: 0, effectiveHours: 0, totalHours: 0 };
    const [inH, inM] = inTime.split(':').map(Number);
    const [outH, outM] = outTime.split(':').map(Number);
    const inMins = inH * 60 + (inM || 0);
    const outMins = outH * 60 + (outM || 0);
    let diff = outMins - inMins;
    if (diff <= 0) diff += 24 * 60;
    if (diff <= 0) return { hours: 0, otHours: 0, effectiveHours: 0, totalHours: 0 };

    const totalHours = parseFloat((diff / 60).toFixed(2));
    // Window-based break deduction (12:00-13:00 Lunch, 22:00-23:00 Dinner)
    const { breakMinutes: breakMins } = computeBreakMinutes(inMins, outMins);

    const netMins = Math.max(0, diff - breakMins);
    const rawEffective = netMins > 0 ? parseFloat((netMins / 60).toFixed(2)) : 0;
    const effectiveHours = Math.max(0, parseFloat((rawEffective + (addHours || 0)).toFixed(2)));
    const d = new Date(selectedDate);
    const dow = d.getDay(); // 0 = Sun, 6 = Sat
    const editingWorker = localWorkers.find((w) => w.employeeId === editingEmployeeId);
    const isExt = editingWorker ? Boolean(editingWorker.isExternal || (editingWorker.businessPartner && !editingWorker.businessPartner.toLowerCase().includes('direct'))) : false;

    let ot = 0;
    let reg = effectiveHours;
    if (dow === 0) {
      ot = effectiveHours;
      reg = 0;
    } else if (isExt) {
      const cap = dow === 6 ? 5.5 : 8.0;
      reg = Math.min(effectiveHours, cap);
      ot = effectiveHours > cap ? parseFloat((effectiveHours - cap).toFixed(2)) : 0;
    } else if (dow === 6) {
      // Saturday: Base standard is 5.5 hours
      reg = Math.min(effectiveHours, 5.5);
      ot = parseFloat((effectiveHours - 5.5).toFixed(2));
    } else {
      // Weekday: > 6h => Full Day (8.0h base); <= 6h => Half Day (4.0h base)
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

  const startEditing = (w: ApprovalWorkerItem) => {
    setEditingEmployeeId(w.employeeId);
    setEditInTime(w.inTime || '07:30');
    setEditOutTime(w.outTime || '17:00');
    const addStr = w.additionalHours !== undefined ? String(w.additionalHours) : '0.0';
    setEditAdditionalHours(addStr);

    const preview = computePreviewHours(w.inTime || '07:30', w.outTime || '17:00', parseFloat(addStr) || 0);
    const existingNonIdle = (w.activities || []).filter(
      (a) => a.code !== 'ZIDLE' && !a.code.toLowerCase().includes('idle')
    );

    if (existingNonIdle.length > 0) {
      setEditActivitySplits(
        existingNonIdle.map((a, idx) => ({
          id: `split-${idx}-${Date.now()}`,
          activityCodeId: a.activityCodeId || a.id,
          activityCode: a.code,
          hours: a.hours !== undefined ? String(a.hours) : '0',
        }))
      );
    } else {
      setEditActivitySplits([
        {
          id: `split-0-${Date.now()}`,
          activityCodeId: '',
          activityCode: '',
          hours: String(preview.effectiveHours > 0 ? preview.effectiveHours : 8),
        },
      ]);
    }
  };

  const cancelEditing = () => {
    setEditingEmployeeId(null);
    setEditActivitySplits([]);
  };

  const handleAddSplitRow = (suggestedHours?: number) => {
    setEditActivitySplits((prev) => {
      const sum = prev.reduce((acc, s) => acc + (parseFloat(s.hours) || 0), 0);
      const preview = computePreviewHours(editInTime, editOutTime, parseFloat(editAdditionalHours) || 0);
      const rem =
        suggestedHours !== undefined
          ? suggestedHours
          : Math.max(0, parseFloat((preview.effectiveHours - sum).toFixed(2)));
      return [
        ...prev,
        {
          id: `split-${Date.now()}-${Math.random()}`,
          activityCodeId: '',
          activityCode: '',
          hours: rem > 0 ? String(rem) : '0',
        },
      ];
    });
  };

  const handleRemoveSplitRow = (rowId: string) => {
    setEditActivitySplits((prev) => {
      if (prev.length <= 1) {
        return [{ id: `split-${Date.now()}`, activityCodeId: '', activityCode: '', hours: '0' }];
      }
      return prev.filter((s) => s.id !== rowId);
    });
  };

  const handleUpdateSplitRow = (rowId: string, field: 'activityCode' | 'hours', val: any) => {
    setEditActivitySplits((prev) =>
      prev.map((s) => {
        if (s.id !== rowId) return s;
        if (field === 'activityCode') {
          const matched = activityOptions.find(
            (o) => o.code.toUpperCase() === String(val).trim().toUpperCase()
          );
          return {
            ...s,
            activityCode: val,
            activityCodeId: matched?.id || s.activityCodeId,
          };
        }
        return { ...s, hours: val };
      })
    );
  };

  const handleSaveEdit = async (employeeId: string) => {
    setIsSavingEdit(true);
    try {
      const addVal = parseFloat(editAdditionalHours) || 0;
      const { hours, otHours, effectiveHours, totalHours } = computePreviewHours(editInTime, editOutTime, addVal);

      const validSplits = editActivitySplits
        .filter((s) => s.activityCode && s.activityCode.trim() !== '')
        .map((s) => {
          const matched = activityOptions.find(
            (a) => a.code.toUpperCase() === s.activityCode.trim().toUpperCase()
          );
          return {
            activityCodeId: matched?.id || s.activityCodeId,
            activityCode: s.activityCode.trim(),
            hours: parseFloat(s.hours) || 0,
          };
        });

      const res = await adminAdjustWorker({
        supervisorId: group.supervisorId,
        employeeId,
        date: selectedDate,
        inTime: editInTime,
        outTime: editOutTime,
        hours,
        overtimeHours: otHours,
        additionalHours: addVal,
        activitySplits: validSplits,
        activityCodeId: validSplits[0]?.activityCodeId,
        activityCode: validSplits[0]?.activityCode,
      });

      let nextActivities = res.activities;
      if (!nextActivities || nextActivities.length === 0) {
        if (validSplits.length > 0) {
          nextActivities = validSplits.map((sp) => {
            const opt = activityOptions.find((o) => o.code.toUpperCase() === sp.activityCode.toUpperCase());
            return {
              activityCodeId: sp.activityCodeId,
              id: sp.activityCodeId,
              code: sp.activityCode,
              description: opt?.name || sp.activityCode,
              hours: sp.hours,
            };
          });
        }
      }

      // Update local row immediately for instant feedback
      setLocalWorkers((prev) =>
        prev.map((w) =>
          w.employeeId === employeeId
            ? {
                ...w,
                inTime: editInTime,
                outTime: editOutTime,
                totalHours: res.totalHours ?? totalHours ?? w.totalHours,
                hours: res.hours ?? hours,
                otHours: res.overtimeHours ?? otHours,
                additionalHours: addVal,
                shiftHours: res.shiftHours ?? effectiveHours,
                effectiveHours: res.effectiveHours ?? res.shiftHours ?? effectiveHours,
                activities: nextActivities ?? w.activities,
                idleHours: (nextActivities || w.activities || []).some((a) => a.code === 'ZIDLE') ? w.idleHours : 0,
                status: 'submitted',
              }
            : w
        )
      );

      setEditingEmployeeId(null);
      setEditActivitySplits([]);
      if (onRefresh) {
        onRefresh();
      }
    } catch (err: any) {
      alert(err?.message || 'Failed to save admin adjustments');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // --- Operator Editing Handlers ---
  const startEditingOperator = (op: ApprovalOperatorItem) => {
    setEditingOperatorId(op.operatorId);
    setEditOpInTime(op.inTime || '07:30');
    setEditOpOutTime(op.outTime || '17:00');
    const addStr = op.additionalHours !== undefined ? String(op.additionalHours) : '0.0';
    setEditOpAdditionalHours(addStr);
  };

  const cancelEditingOperator = () => {
    setEditingOperatorId(null);
  };

  const handleSaveOperatorEdit = async (op: ApprovalOperatorItem) => {
    setIsSavingOpEdit(true);
    try {
      const addVal = parseFloat(editOpAdditionalHours) || 0;
      const { hours, otHours, effectiveHours, totalHours } = computePreviewHours(editOpInTime, editOpOutTime, addVal);

      const res = await adminAdjustWorker({
        supervisorId: group.supervisorId,
        employeeId: op.operatorId,
        date: selectedDate,
        inTime: editOpInTime,
        outTime: editOpOutTime,
        hours,
        overtimeHours: otHours,
        additionalHours: addVal,
      });

      setLocalOperators((prev) =>
        prev.map((o) =>
          o.operatorId === op.operatorId
            ? {
                ...o,
                inTime: editOpInTime,
                outTime: editOpOutTime,
                totalHours: res.totalHours ?? totalHours ?? o.totalHours,
                hours: res.hours ?? hours,
                otHours: res.overtimeHours ?? otHours,
                additionalHours: addVal,
                shiftHours: res.shiftHours ?? effectiveHours,
                effectiveHours: res.effectiveHours ?? res.shiftHours ?? effectiveHours,
                status: 'submitted',
              }
            : o
        )
      );

      setEditingOperatorId(null);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Failed to save operator edit:', err);
      alert(err?.message || 'Failed to update operator entry');
    } finally {
      setIsSavingOpEdit(false);
    }
  };

  // --- Equipment Editing Handlers (Direct Unit + 5 Decimals + Splits-Synced Total) ---
  const startEditingEquipment = (eq: ApprovalEquipmentItem) => {
    setEditingEquipmentId(eq.equipmentId);
    setEditEqCondition(eq.condition || 'DRY');
    const splitsSum = eq.splits && eq.splits.length > 0
      ? roundEq5(eq.splits.reduce((acc: number, s: any) => acc + (Number(s.utilization) || 0), 0))
      : 0;
    const baseQty = splitsSum > 0
      ? splitsSum
      : roundEq5(eq.loggedQuantity || eq.netHours || eq.workingHours || 0);
    setEditEqNetHours(formatEqDecimal(baseQty));
    setEditEqInitialMeter(String(eq.initialMeter || 0));
    setEditEqFinalMeter(String(eq.finalMeter || 0));
    setEditEqFuelLiters(String(eq.fuelLiters || 0));

    if (eq.splits && eq.splits.length > 0) {
      setEditEqSplits(
        eq.splits.map((s: any, idx: number) => ({
          id: `eq-split-${idx}-${Date.now()}`,
          activityCodeId: s.activityCodeId || '',
          activityCode: s.activityCode || '',
          hours: s.utilization !== undefined ? formatEqDecimal(s.utilization) : '0',
        }))
      );
    } else {
      setEditEqSplits([
        {
          id: `eq-split-0-${Date.now()}`,
          activityCodeId: '',
          activityCode: '',
          hours: formatEqDecimal(baseQty),
        },
      ]);
    }
  };

  const cancelEditingEquipment = () => {
    setEditingEquipmentId(null);
    setEditEqSplits([]);
  };

  const handleAddEqSplitRow = (suggestedHours?: number) => {
    setEditEqSplits((prev) => {
      const sum = roundEq5(prev.reduce((acc, s) => acc + (parseFloat(s.hours) || 0), 0));
      const netVal = roundEq5(parseFloat(editEqNetHours) || 0);
      const rem =
        suggestedHours !== undefined
          ? roundEq5(suggestedHours)
          : Math.max(0, roundEq5(netVal - sum));
      const next = [
        ...prev,
        {
          id: `eq-split-${Date.now()}-${Math.random()}`,
          activityCodeId: '',
          activityCode: '',
          hours: rem > 0 ? formatEqDecimal(rem) : '0',
        },
      ];
      const nextSum = roundEq5(next.reduce((acc, s) => acc + (parseFloat(s.hours) || 0), 0));
      if (nextSum > 0) setEditEqNetHours(formatEqDecimal(nextSum));
      return next;
    });
  };

  const handleRemoveEqSplitRow = (rowId: string) => {
    setEditEqSplits((prev) => {
      const next = prev.length <= 1
        ? [{ id: `eq-split-${Date.now()}`, activityCodeId: '', activityCode: '', hours: '0' }]
        : prev.filter((s) => s.id !== rowId);
      const nextSum = roundEq5(next.reduce((acc, s) => acc + (parseFloat(s.hours) || 0), 0));
      setEditEqNetHours(formatEqDecimal(nextSum));
      return next;
    });
  };

  const handleUpdateEqSplitRow = (rowId: string, field: 'activityCode' | 'hours', val: any) => {
    setEditEqSplits((prev) => {
      const next = prev.map((s) => {
        if (s.id !== rowId) return s;
        if (field === 'activityCode') {
          const matched = activityOptions.find(
            (o) => o.code.toUpperCase() === String(val).trim().toUpperCase()
          );
          return {
            ...s,
            activityCode: val,
            activityCodeId: matched?.id || s.activityCodeId,
          };
        }
        return { ...s, hours: val };
      });
      if (field === 'hours') {
        const nextSum = roundEq5(next.reduce((acc, s) => acc + (parseFloat(s.hours) || 0), 0));
        setEditEqNetHours(formatEqDecimal(nextSum));
      }
      return next;
    });
  };

  const handleSaveEquipmentEdit = async (eq: ApprovalEquipmentItem) => {
    setIsSavingEqEdit(true);
    try {
      const initMeter = parseFloat(editEqInitialMeter) || 0;
      const finMeter = parseFloat(editEqFinalMeter) || 0;
      const fuelVal = parseFloat(editEqFuelLiters) || 0;

      const validSplits = editEqSplits
        .filter((s) => s.activityCode && s.activityCode.trim() !== '')
        .map((s) => {
          const matched = activityOptions.find(
            (a) => a.code.toUpperCase() === s.activityCode.trim().toUpperCase()
          );
          const util = roundEq5(parseFloat(s.hours) || 0);
          return {
            activityCodeId: matched?.id || s.activityCodeId,
            activityCode: s.activityCode.trim(),
            utilization: util,
            hours: util,
          };
        });

      const splitsSum = roundEq5(validSplits.reduce((acc, s) => acc + s.utilization, 0));
      const finalQty = validSplits.length > 0 ? splitsSum : roundEq5(parseFloat(editEqNetHours) || 0);

      const res = await adminAdjustEquipment({
        supervisorId: group.supervisorId,
        equipmentId: eq.equipmentId,
        date: selectedDate,
        unitCode: eq.primaryUnit,
        totalUtilization: finalQty,
        loggedQuantity: finalQty,
        initialMeter: initMeter,
        finalMeter: finMeter,
        netHours: finalQty,
        workingHours: finalQty,
        fuelLiters: fuelVal,
        condition: editEqCondition,
        splits: validSplits,
      });

      const eqUnit = res.primaryUnit || eq.primaryUnit || 'hrs';
      let nextSplits: Array<{ activityCode: string; activityDesc: string; unit: string; utilization: number }> = [];
      if (res.splits && res.splits.length > 0) {
        nextSplits = res.splits.map((s) => ({
          activityCode: s.activityCode,
          activityDesc: s.activityDesc,
          unit: s.unit || eqUnit,
          utilization: roundEq5(s.utilization),
        }));
      } else if (validSplits.length > 0) {
        nextSplits = validSplits.map((sp) => {
          const opt = activityOptions.find((o) => o.code.toUpperCase() === sp.activityCode.toUpperCase());
          return {
            activityCode: sp.activityCode,
            activityDesc: opt?.name || sp.activityCode,
            unit: eqUnit,
            utilization: sp.utilization,
          };
        });
      } else {
        nextSplits = eq.splits || [];
      }

      const savedTotal = roundEq5(res.loggedQuantity ?? res.totalUtilization ?? finalQty);

      setLocalEquipment((prev) =>
        prev.map((e) =>
          e.equipmentId === eq.equipmentId
            ? {
                ...e,
                condition: editEqCondition,
                netHours: res.netHours ?? savedTotal,
                workingHours: res.workingHours ?? savedTotal,
                loggedQuantity: savedTotal,
                initialMeter: res.initialMeter ?? initMeter,
                finalMeter: res.finalMeter ?? finMeter,
                fuelLiters: res.fuelLiters ?? fuelVal,
                splits: nextSplits,
                status: 'submitted',
              }
            : e
        )
      );

      setEditingEquipmentId(null);
      setEditEqSplits([]);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Failed to save equipment edit:', err);
      alert(err?.message || 'Failed to update equipment log');
    } finally {
      setIsSavingEqEdit(false);
    }
  };

  const workersCount = group.counts?.laborWorked ?? group.workedCount ?? 0;
  const workersTotal = group.counts?.laborAssigned ?? group.assignedCount ?? 0;
  const operatorsCount = group.counts?.operatorsWorked ?? (localOperators.length);
  const operatorsTotal = group.counts?.operatorsAssigned ?? (localOperators.length);

  const workerHours = formatHoursDisplay(group.totals?.laborHours ?? group.totalHours ?? 0);
  const rawLaborOt = group.totals?.laborOvertime ?? group.totalOvertime ?? 0;
  const workerOt = formatHoursDisplay(rawLaborOt);
  const equipmentFuel = group.totals?.equipmentFuel ?? 0;

  // Method 2: Only show logged equipment (machines with actual hours/usage logged)
  const loggedEquipment = useMemo(() => {
    return localEquipment.filter(isEquipmentLogged);
  }, [localEquipment]);

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
    if (!q || (searchScope !== 'all' && searchScope !== 'operators')) {
      return localOperators;
    }
    return localOperators.filter(
      (o) =>
        (o.callingName && o.callingName.toLowerCase().includes(q)) ||
        (o.fullName && o.fullName.toLowerCase().includes(q)) ||
        (o.operatorCode && o.operatorCode.toLowerCase().includes(q)) ||
        (o.assignedEquipmentDisplay && o.assignedEquipmentDisplay.toLowerCase().includes(q))
    );
  }, [localOperators, q, searchScope]);

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
        const hasOpMatch = localOperators.some(
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
  }, [q, searchScope, localWorkers, localOperators, loggedEquipment]);

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
                  Labor: <strong>{q ? displayedWorkers.length : workersCount}/{workersTotal}</strong> ({workerHours}, OT: {rawLaborOt > 0 ? `+${workerOt}` : workerOt})
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
                      <th className="py-2.5 px-3 text-center min-w-[90px]">Total Hours</th>
                      <th className="py-2.5 px-3">Effective Hours</th>
                      <th className="py-2.5 px-3">OT Hrs</th>
                      <th className="py-2.5 px-3 min-w-[290px]">Activities Worked</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                      {!isApproved && <th className="py-2.5 px-3 text-center">Admin Edit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedWorkers.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-6 text-center text-slate-400">
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
                            className={isEditingThis ? 'bg-blue-50/50 relative z-20' : 'hover:bg-blue-50/20 transition-colors'}
                          >
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
                                <div className="flex flex-col gap-1">
                                  <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-blue-300 shadow-2xs">
                                    <TimeInput24
                                      value={editInTime}
                                      onChange={(val) => setEditInTime(val)}
                                      className="w-16 px-1 py-0.5 rounded text-xs font-bold text-slate-900 font-mono border border-slate-200 focus:outline-none focus:border-blue-500"
                                    />
                                    <span className="text-slate-400 font-bold">–</span>
                                    <TimeInput24
                                      value={editOutTime}
                                      onChange={(val) => setEditOutTime(val)}
                                      className="w-16 px-1 py-0.5 rounded text-xs font-bold text-slate-900 font-mono border border-slate-200 focus:outline-none focus:border-blue-500"
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
                                  <div className="flex items-center gap-1">
                                    <span className="font-mono text-slate-900 font-medium">
                                      {w.inTime} – {w.outTime}
                                    </span>
                                    {(w.additionalHours ?? 0) > 0 && (
                                      <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200" title={`Additional Hours: +${w.additionalHours}h`}>
                                        +{w.additionalHours}h Add
                                      </span>
                                    )}
                                  </div>
                                  {(w.breakHours ?? 0) > 0 && (
                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5" title={`Break deducted: ${w.breakHours}h`}>
                                      <span>Break: -{w.breakHours}h</span>
                                      {w.isLunchDeducted && w.isDinnerDeducted && <span className="text-slate-500 font-semibold">(Lunch+Dinner)</span>}
                                      {w.isLunchDeducted && !w.isDinnerDeducted && <span className="text-slate-500 font-semibold">(Lunch)</span>}
                                      {!w.isLunchDeducted && w.isDinnerDeducted && <span className="text-slate-500 font-semibold">(Dinner)</span>}
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
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {isEditingThis && preview ? (
                                <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-bold font-mono" title={toHhMmTooltip(preview.effectiveHours)}>
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
                            <td className="py-2.5 px-3">
                              {isEditingThis && preview ? (
                                <span className={`px-1.5 py-0.5 rounded font-bold font-mono ${
                                  preview.otHours > 0
                                    ? 'bg-amber-100 text-amber-800'
                                    : preview.otHours < 0
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-slate-100 text-slate-700'
                                }`} title={toHhMmTooltip(preview.otHours)}>
                                  {preview.otHours > 0 ? `+${formatHoursDisplay(preview.otHours)}` : formatHoursDisplay(preview.otHours)}
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
                            <td className={`py-2.5 px-3 ${isEditingThis ? 'relative z-30' : ''}`}>
                              {isEditingThis ? (
                                (() => {
                                  const totalAllocated = editActivitySplits.reduce(
                                    (acc, s) => acc + (parseFloat(s.hours) || 0),
                                    0
                                  );
                                  const targetShift = preview?.effectiveHours ?? 0;
                                  const diff = parseFloat((targetShift - totalAllocated).toFixed(2));
                                  const isBalanced = Math.abs(diff) < 0.05;

                                  return (
                                    <div className="flex flex-col gap-1.5 min-w-[280px] max-w-sm bg-white/95 p-2 rounded-xl border border-blue-200 shadow-sm">
                                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 pb-1 border-b border-slate-100">
                                        <span>Activity Allocation</span>
                                        <span
                                          className={`font-mono text-[10px] px-1.5 py-0.5 rounded font-bold border ${
                                            isBalanced
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                              : diff > 0
                                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                                              : 'bg-rose-50 text-rose-700 border-rose-200'
                                          }`}
                                          title={
                                            isBalanced
                                              ? 'Shift hours fully allocated'
                                              : diff > 0
                                              ? `${diff}h unallocated`
                                              : `${Math.abs(diff)}h over-allocated`
                                          }
                                        >
                                          {totalAllocated.toFixed(1)}h / {targetShift.toFixed(1)}h
                                        </span>
                                      </div>

                                      <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5 scrollbar-thin">
                                        {editActivitySplits.map((split, sIdx) => (
                                          <div key={split.id} className="flex items-center gap-1.5">
                                            <div className="flex-1 min-w-0">
                                              <SearchableActivitySelect
                                                value={split.activityCode}
                                                onChange={(code) =>
                                                  handleUpdateSplitRow(split.id, 'activityCode', code)
                                                }
                                                options={activityOptions}
                                                placeholder={`Activity #${sIdx + 1}...`}
                                                className="w-full text-xs shadow-2xs"
                                              />
                                            </div>
                                            <div className="flex items-center gap-0.5 flex-shrink-0">
                                              <input
                                                type="number"
                                                step="0.5"
                                                min="0"
                                                max="24"
                                                value={split.hours}
                                                onChange={(e) =>
                                                  handleUpdateSplitRow(split.id, 'hours', e.target.value)
                                                }
                                                className="w-14 px-1 py-1 rounded text-xs font-bold font-mono text-center border border-slate-200 bg-white focus:outline-none focus:border-blue-500 shadow-2xs"
                                                placeholder="0.0"
                                                title="Hours on this activity"
                                              />
                                              <span className="text-[10px] text-slate-400 font-bold">h</span>
                                            </div>
                                            {editActivitySplits.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() => handleRemoveSplitRow(split.id)}
                                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer flex-shrink-0"
                                                title="Remove this activity split"
                                              >
                                                <Trash2 size={13} />
                                              </button>
                                            )}
                                          </div>
                                        ))}
                                      </div>

                                      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                        <button
                                          type="button"
                                          onClick={() => handleAddSplitRow()}
                                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer"
                                        >
                                          <Plus size={11} />
                                          <span>Add Activity</span>
                                        </button>

                                        {diff > 0.05 && (
                                          <button
                                            type="button"
                                            onClick={() => handleAddSplitRow(diff)}
                                            className="text-[10px] text-amber-600 hover:text-amber-700 font-semibold underline cursor-pointer"
                                            title="Click to add split with remaining unallocated hours"
                                          >
                                            +{diff.toFixed(1)}h unallocated
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })()
                              ) : (
                                (() => {
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
                                            {isIdle ? `Idle (${act.code}): ${formatHoursDisplay(act.hours)}` : `${act.code}: ${formatHoursDisplay(act.hours)}`}
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
                                })()
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
                                {w.status === 'approved' ? 'Approved' : hasAttendance ? 'Done' : 'Absent'}
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
                      <th className="py-2.5 px-3 text-center min-w-[90px]">Total Hours</th>
                      <th className="py-2.5 px-3">Effective Hours</th>
                      <th className="py-2.5 px-3">OT Hrs</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                      {!isApproved && (
                        <th className="py-2.5 px-3 text-center min-w-[80px]">Admin Edit</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!displayedOperators || displayedOperators.length === 0 ? (
                      <tr>
                        <td colSpan={!isApproved ? 8 : 7} className="py-6 text-center text-slate-400">
                          {q ? `No machine operators match "${searchQuery}" for this supervisor.` : 'No machine operators assigned for this supervisor.'}
                        </td>
                      </tr>
                    ) : (
                      displayedOperators.map((op) => {
                        const isEditingThisOp = editingOperatorId === op.operatorId;
                        const preview = isEditingThisOp
                          ? computePreviewHours(editOpInTime, editOpOutTime, parseFloat(editOpAdditionalHours) || 0)
                          : null;
                        const hasAttendance = Boolean(op.inTime && op.outTime);
                        const effectiveVal = op.effectiveHours ?? op.shiftHours ?? ((op.hours ?? 0) + (op.otHours ?? 0));
                        return (
                          <tr
                            key={op.operatorId}
                            className={isEditingThisOp ? 'bg-blue-50/40 transition-colors' : 'hover:bg-slate-50/50 transition-colors'}
                          >
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
                              {isEditingThisOp ? (
                                <div className="flex flex-col gap-1.5 p-1 bg-blue-50/50 rounded-lg border border-blue-200/60">
                                  <div className="flex items-center gap-1">
                                    <TimeInput24
                                      value={editOpInTime}
                                      onChange={(val) => setEditOpInTime(val)}
                                      className="px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 w-[64px]"
                                      title="In Time (24H)"
                                    />
                                    <span className="text-slate-400 font-bold">–</span>
                                    <TimeInput24
                                      value={editOpOutTime}
                                      onChange={(val) => setEditOpOutTime(val)}
                                      className="px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 w-[64px]"
                                      title="Out Time (24H)"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1.5 pt-1 border-t border-blue-100">
                                    <span className="text-[10px] text-slate-500 font-semibold whitespace-nowrap">Add Hrs:</span>
                                    <input
                                      type="number"
                                      step="0.5"
                                      min="0"
                                      max="24"
                                      value={editOpAdditionalHours}
                                      onChange={(e) => setEditOpAdditionalHours(e.target.value)}
                                      className="w-16 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-blue-500 text-center"
                                      title="Additional Shift Hours"
                                    />
                                  </div>
                                </div>
                              ) : hasAttendance ? (
                                <div>
                                  <span className="text-slate-900 font-medium">
                                    {op.inTime} – {op.outTime}
                                  </span>
                                  {(op.breakHours ?? 0) > 0 && (
                                    <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5" title={`Break deducted: ${op.breakHours}h`}>
                                      <span>Break: -{op.breakHours}h</span>
                                      {op.isLunchDeducted && op.isDinnerDeducted && <span className="text-slate-500 font-semibold">(Lunch+Dinner)</span>}
                                      {op.isLunchDeducted && !op.isDinnerDeducted && <span className="text-slate-500 font-semibold">(Lunch)</span>}
                                      {!op.isLunchDeducted && op.isDinnerDeducted && <span className="text-slate-500 font-semibold">(Dinner)</span>}
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
                              {isEditingThisOp && preview ? (
                                <span
                                  className="inline-flex items-center px-2 py-0.5 rounded-md font-mono font-bold text-xs bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs"
                                  title={`Total Presence (Gross Out - In): ${formatHoursDisplay(preview.totalHours)}`}
                                >
                                  {formatHoursDisplay(preview.totalHours)}
                                </span>
                              ) : (() => {
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
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {isEditingThisOp && preview ? (
                                <span className="font-bold text-blue-700 font-mono">
                                  {formatHoursDisplay(preview.effectiveHours)}
                                </span>
                              ) : effectiveVal > 0 ? (
                                <span title={toHhMmTooltip(effectiveVal)}>
                                  {formatHoursDisplay(effectiveVal)}
                                </span>
                              ) : '-'}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditingThisOp && preview ? (
                                preview.otHours > 0 ? (
                                  <span className="font-bold text-amber-600 font-mono">
                                    +{formatHoursDisplay(preview.otHours)}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 font-mono">0.0h</span>
                                )
                              ) : (op.otHours ?? 0) > 0 ? (
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
                                {op.status === 'approved' ? 'Approved' : hasAttendance ? 'Done' : 'Absent'}
                              </span>
                            </td>
                            {!isApproved && (
                              <td className="py-2.5 px-3 text-center">
                                {isEditingThisOp ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={isSavingOpEdit}
                                      onClick={() => handleSaveOperatorEdit(op)}
                                      className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                                      title="Save Changes"
                                    >
                                      {isSavingOpEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSavingOpEdit}
                                      onClick={cancelEditingOperator}
                                      className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={op.status === 'approved'}
                                    onClick={() => startEditingOperator(op)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Edit In/Out times for this operator"
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
                      <th className="py-2.5 px-3 min-w-[290px]">Activities Worked</th>
                      <th className="py-2.5 px-3 text-right">Status</th>
                      {!isApproved && (
                        <th className="py-2.5 px-3 text-center min-w-[80px]">Admin Edit</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {displayedEquipment.length === 0 ? (
                      <tr>
                        <td colSpan={!isApproved ? 8 : 7} className="py-6 text-center text-slate-400">
                          {q ? `No plant & equipment match "${searchQuery}" for this supervisor.` : 'No plant & equipment logged for this supervisor.'}
                        </td>
                      </tr>
                    ) : (
                      displayedEquipment.map((eq) => {
                        const isEditingThisEq = editingEquipmentId === eq.equipmentId;
                        const isWorking = eq.condition === 'WORKING';
                        const isBreakdown = eq.condition === 'BREAKDOWN';
                        const isLogged = eq.netHours > 0 || eq.loggedQuantity > 0;
                        return (
                          <tr
                            key={eq.equipmentId}
                            className={isEditingThisEq ? 'bg-amber-50/40 transition-colors' : 'hover:bg-slate-50/50 transition-colors'}
                          >
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
                              {isEditingThisEq ? (
                                <select
                                  value={editEqCondition}
                                  onChange={(e) => setEditEqCondition(e.target.value)}
                                  className="px-2 py-1 text-[11px] font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 shadow-2xs"
                                >
                                  <option value="WORKING">WORKING</option>
                                  <option value="BREAKDOWN">BREAKDOWN</option>
                                  <option value="STANDBY">STANDBY</option>
                                  <option value="IDLE">IDLE</option>
                                  <option value="DRY">DRY</option>
                                </select>
                              ) : (
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
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditingThisEq ? (
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    min="0"
                                    value={editEqNetHours}
                                    onChange={(e) => setEditEqNetHours(e.target.value)}
                                    className="w-20 px-1.5 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-center"
                                    title={`Logged Usage (${formatEqUnitLabel(eq.primaryUnit)})`}
                                  />
                                  <span className="text-[11px] font-semibold text-slate-600">
                                    {formatEqUnitLabel(eq.primaryUnit)}
                                  </span>
                                </div>
                              ) : (() => {
                                const unitUpper = (eq.primaryUnit || 'hrs').toUpperCase();
                                const splitsSum = eq.splits && eq.splits.length > 0
                                  ? roundEq5(eq.splits.reduce((s, a) => s + (Number(a.utilization) || 0), 0))
                                  : 0;
                                const effectiveQty = splitsSum > 0 ? splitsSum : roundEq5(eq.loggedQuantity ?? 0);
                                if (unitUpper === 'HRS' || unitUpper === 'HR') {
                                  const hrs = effectiveQty > 0 ? effectiveQty : roundEq5(eq.netHours || eq.workingHours || 0);
                                  return (
                                    <>
                                      <div className="font-semibold text-slate-900">{formatEqDecimal(hrs)} Hrs</div>
                                      <span className="text-[10px] text-slate-400 font-mono">Unit: HRS</span>
                                    </>
                                  );
                                }
                                if (unitUpper === 'MTH') {
                                  return (
                                    <>
                                      <div className="font-semibold text-slate-900">{formatEqDecimal(effectiveQty)} mth</div>
                                      <span className="text-[10px] text-violet-600 font-medium">Monthly Hire (mth)</span>
                                    </>
                                  );
                                }
                                if (unitUpper === 'DAYS' || unitUpper === 'DAY') {
                                  return (
                                    <>
                                      <div className="font-semibold text-slate-900">{formatEqDecimal(effectiveQty)} Day{effectiveQty === 1 ? '' : 's'}</div>
                                      <span className="text-[10px] text-slate-400 font-mono">Unit: DAY</span>
                                    </>
                                  );
                                }
                                return (
                                  <>
                                    <div className="font-semibold text-slate-900">{formatEqDecimal(effectiveQty)} {formatEqUnitLabel(eq.primaryUnit)}</div>
                                    <span className="text-[10px] text-slate-400 font-mono">Unit: {unitUpper}</span>
                                  </>
                                );
                              })()}
                            </td>
                            <td className="py-2.5 px-3 font-mono text-[11px]">
                              {isEditingThisEq ? (
                                <div className="flex items-center gap-1 font-mono text-[11px]">
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={editEqInitialMeter}
                                    onChange={(e) => {
                                      setEditEqInitialMeter(e.target.value);
                                      const init = parseFloat(e.target.value) || 0;
                                      const fin = parseFloat(editEqFinalMeter) || 0;
                                      if (fin > init) {
                                        setEditEqNetHours(String(parseFloat((fin - init).toFixed(2))));
                                      }
                                    }}
                                    placeholder="Init"
                                    className="w-14 px-1 py-0.5 text-xs font-mono bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-center"
                                    title="Initial Meter"
                                  />
                                  <span className="text-slate-400">–</span>
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={editEqFinalMeter}
                                    onChange={(e) => {
                                      setEditEqFinalMeter(e.target.value);
                                      const fin = parseFloat(e.target.value) || 0;
                                      const init = parseFloat(editEqInitialMeter) || 0;
                                      if (fin > init) {
                                        setEditEqNetHours(String(parseFloat((fin - init).toFixed(2))));
                                      }
                                    }}
                                    placeholder="Final"
                                    className="w-14 px-1 py-0.5 text-xs font-mono bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-center"
                                    title="Final Meter"
                                  />
                                </div>
                              ) : eq.initialMeter > 0 || eq.finalMeter > 0 ? (
                                <div className="flex items-center gap-1 text-slate-700">
                                  <Gauge size={12} className="text-slate-400" />
                                  <span>{eq.initialMeter} – {eq.finalMeter}</span>
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">
                              {isEditingThisEq ? (
                                <div className="flex items-center gap-1 font-mono text-[11px]">
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={editEqFuelLiters}
                                    onChange={(e) => setEditEqFuelLiters(e.target.value)}
                                    className="w-14 px-1 py-0.5 text-xs font-mono font-bold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-center"
                                    title="Fuel Liters"
                                  />
                                  <span className="text-[11px] font-semibold text-amber-700">L</span>
                                </div>
                              ) : eq.fuelLiters > 0 ? (
                                <span className="inline-flex items-center gap-1 text-amber-700">
                                  <Fuel size={12} />
                                  <span>{eq.fuelLiters} L</span>
                                </span>
                              ) : (
                                <span className="text-slate-400">0 L</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {isEditingThisEq ? (
                                <div className="space-y-1.5 py-1">
                                  {editEqSplits.map((sp) => (
                                    <div key={sp.id} className="flex items-center gap-1.5">
                                      <div className="w-[180px]">
                                        <SearchableActivitySelect
                                          value={sp.activityCode}
                                          options={activityOptions}
                                          onChange={(newCode) => handleUpdateEqSplitRow(sp.id, 'activityCode', newCode)}
                                          placeholder="Activity..."
                                          className="w-full text-xs shadow-2xs"
                                        />
                                      </div>
                                      <input
                                        type="number"
                                        step="any"
                                        min="0"
                                        value={sp.hours}
                                        onChange={(e) => handleUpdateEqSplitRow(sp.id, 'hours', e.target.value)}
                                        className="w-20 px-1 py-1 text-xs font-mono font-semibold bg-white border border-slate-300 rounded focus:ring-1 focus:ring-amber-500 text-center"
                                        placeholder={formatEqUnitLabel(eq.primaryUnit)}
                                        title={`Utilization (${formatEqUnitLabel(eq.primaryUnit)}) — up to 5 decimals`}
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveEqSplitRow(sp.id)}
                                        className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors"
                                        title="Remove activity row"
                                      >
                                        <Trash2 size={13} />
                                      </button>
                                    </div>
                                  ))}
                                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => handleAddEqSplitRow()}
                                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 hover:text-amber-900 transition-colors"
                                    >
                                      <Plus size={12} />
                                      <span>Add Split</span>
                                    </button>
                                    {(() => {
                                      const unitLbl = formatEqUnitLabel(eq.primaryUnit);
                                      const sum = roundEq5(editEqSplits.reduce((acc, s) => acc + (parseFloat(s.hours) || 0), 0));
                                      const netVal = roundEq5(parseFloat(editEqNetHours) || 0);
                                      const isMismatch = Math.abs(sum - netVal) > 0.00001 && netVal > 0;
                                      return (
                                        <span
                                          className={`text-[10px] font-mono font-bold ${
                                            isMismatch ? 'text-amber-600' : 'text-emerald-600'
                                          }`}
                                          title={isMismatch ? `Split total (${formatEqDecimal(sum)} ${unitLbl}) differs from logged usage (${formatEqDecimal(netVal)} ${unitLbl})` : `Split sum matches logged usage (${formatEqDecimal(sum)} ${unitLbl})`}
                                        >
                                          Σ {formatEqDecimal(sum)} / {formatEqDecimal(netVal)} {unitLbl}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                </div>
                              ) : eq.splits && eq.splits.length > 0 ? (
                                <div className="flex flex-wrap gap-1 max-w-xs">
                                  {eq.splits.map((act, i) => (
                                    <span
                                      key={i}
                                      className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200"
                                      title={act.activityDesc}
                                    >
                                      <Tag size={10} />
                                      {act.activityCode}: {formatEqDecimal(act.utilization)} {act.unit}
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
                            {!isApproved && (
                              <td className="py-2.5 px-3 text-center">
                                {isEditingThisEq ? (
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      disabled={isSavingEqEdit}
                                      onClick={() => handleSaveEquipmentEdit(eq)}
                                      className="p-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer disabled:opacity-50"
                                      title="Save Changes"
                                    >
                                      {isSavingEqEdit ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isSavingEqEdit}
                                      onClick={cancelEditingEquipment}
                                      className="p-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 transition-colors cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X size={13} />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={eq.status === 'approved'}
                                    onClick={() => startEditingEquipment(eq)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Edit equipment daily log"
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
        </div>
      )}
    </div>
  );
};


