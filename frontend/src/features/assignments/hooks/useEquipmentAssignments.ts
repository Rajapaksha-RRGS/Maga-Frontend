/**
 * useEquipmentAssignments.ts
 *
 * State management for daily equipment-to-supervisor assignments.
 * Handles selected date, equipment context data, multi-select, assign/unassign/copy.
 */
import { useState, useEffect, useCallback } from 'react';
import type { EquipmentAssignment } from '../services/assignmentService';
import type { Equipment } from '../../equipment/services/equipmentService';
import type { Supervisor } from '../../supervisors/services/supervisorService';
import * as svc from '../services/assignmentService';

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function useEquipmentAssignments(controlledDate?: string, onDateChange?: (date: string) => void) {
  const initialDate = controlledDate || formatDate(new Date());
  const [internalDate, setInternalDate] = useState(initialDate);

  const selectedDate = controlledDate !== undefined ? controlledDate : internalDate;
  const setSelectedDate = onDateChange || setInternalDate;

  const [assignments, setAssignments] = useState<EquipmentAssignment[]>([]);
  const [equipmentList, setEquipmentList] = useState<Equipment[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [selectedEquipmentIds, setSelectedEquipmentIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const load = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const [asgn, ctx] = await Promise.all([
        svc.getEquipmentAssignments(selectedDate, forceRefresh),
        svc.getEquipmentAssignmentContext(forceRefresh),
      ]);
      setAssignments(asgn);
      setEquipmentList(ctx.equipmentList);
      setSupervisors(ctx.supervisors);
      setSelectedEquipmentIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Derived: unassigned equipment
  const assignedEqIds = new Set(assignments.map((a) => a.equipmentId));
  const unassignedEquipment = equipmentList.filter((eq) => {
    if (assignedEqIds.has(eq.id)) return false;
    const q = search.toLowerCase();
    if (
      q &&
      !eq.name.toLowerCase().includes(q) &&
      !(eq.code && eq.code.toLowerCase().includes(q)) &&
      !(eq.type && eq.type.toLowerCase().includes(q))
    ) {
      return false;
    }
    if (typeFilter && eq.type !== typeFilter) return false;
    return true;
  });

  // Derived: supervisor with their assigned equipment
  const supervisorAssignments = supervisors.map((sup) => {
    const supAssignments = assignments.filter((a) => a.supervisorId === sup.id);
    const eqItems = supAssignments
      .map((a) => {
        const found = equipmentList.find((e) => e.id === a.equipmentId);
        const eqData: Equipment = found || {
          id: a.equipmentId,
          code: a.equipmentCode || '',
          name: a.equipmentName || 'Equipment',
          type: a.equipmentType || '',
          costRate: a.costRate || 0,
          status: 'active',
        };
        return {
          assignment: a,
          equipment: eqData,
        };
      })
      .filter((x) => Boolean(x.equipment));

    return {
      supervisor: sup,
      equipmentList: eqItems,
    };
  });

  const unassignedCount = equipmentList.filter((eq) => !assignedEqIds.has(eq.id)).length;
  const assignedCount = equipmentList.length - unassignedCount;

  // Distinct equipment types for filtering
  const distinctTypes = Array.from(new Set(equipmentList.map((e) => e.type).filter(Boolean))).sort() as string[];

  // Actions
  const toggleEquipmentSelection = (eqId: string) => {
    setSelectedEquipmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(eqId)) next.delete(eqId);
      else next.add(eqId);
      return next;
    });
  };

  const selectAllUnassigned = () => {
    setSelectedEquipmentIds(new Set(unassignedEquipment.map((eq) => eq.id)));
  };

  const deselectAll = () => setSelectedEquipmentIds(new Set());

  const assignToSupervisor = async (supervisorId: string) => {
    if (selectedEquipmentIds.size === 0 || isSaving) return;
    setIsSaving(true);
    try {
      await svc.assignEquipment(selectedDate, supervisorId, [...selectedEquipmentIds]);
      await load(true);
    } finally {
      setIsSaving(false);
    }
  };

  const unassignEquipment = async (assignmentId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await svc.unassignEquipment(assignmentId);
      await load(true);
    } finally {
      setIsSaving(false);
    }
  };

  const copyPreviousDay = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const prev = prevDateStr(selectedDate);
      await svc.copyEquipmentGangsFromDate(prev, selectedDate);
      await load(true);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    selectedDate,
    setSelectedDate,
    assignments,
    equipmentList,
    supervisors,
    isLoading,
    isSaving,
    unassignedEquipment,
    supervisorAssignments,
    totalEquipment: equipmentList.length,
    assignedCount,
    unassignedCount,
    selectedEquipmentIds,
    toggleEquipmentSelection,
    selectAllUnassigned,
    deselectAll,
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    distinctTypes,
    assignToSupervisor,
    unassignEquipment,
    copyPreviousDay,
    refresh: () => load(true),
  };
}
