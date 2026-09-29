/**
 * useOperatorAssignments.ts
 *
 * State management for daily operator-to-supervisor assignments.
 * Handles selected date, operator context data, multi-select, assign/unassign/copy.
 */
import { useState, useEffect, useCallback } from 'react';
import type { OperatorAssignment } from '../services/assignmentService';
import type { Employee } from '../../employees/services/employeeService';
import type { Supervisor } from '../../supervisors/services/supervisorService';
import * as svc from '../services/assignmentService';
import { getBusinessPartners } from '../../employees/services/employeeService';

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function useOperatorAssignments() {
  const initialDate = formatDate(new Date());
  const [selectedDate, setSelectedDate] = useState(initialDate);

  const [assignments, setAssignments] = useState<OperatorAssignment[]>([]);
  const [operators, setOperators] = useState<Employee[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [selectedOperatorIds, setSelectedOperatorIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [bpFilter, setBPFilter] = useState('');

  const load = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    try {
      const [asgn, ctx] = await Promise.all([
        svc.getOperatorAssignments(selectedDate, forceRefresh),
        svc.getOperatorAssignmentContext(forceRefresh),
      ]);
      setAssignments(asgn);
      setOperators(ctx.operators);
      setSupervisors(ctx.supervisors);
      setSelectedOperatorIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    load();
  }, [load]);

  // Derived: unassigned operators
  const assignedOpIds = new Set(assignments.map((a) => a.operatorId));
  const unassignedOperators = operators.filter((op) => {
    if (assignedOpIds.has(op.id)) return false;
    const q = search.toLowerCase();
    if (
      q &&
      !op.callingName.toLowerCase().includes(q) &&
      !op.fullName.toLowerCase().includes(q) &&
      !(op.employeeCode && op.employeeCode.toLowerCase().includes(q)) &&
      !(op.licenseNo && op.licenseNo.toLowerCase().includes(q))
    ) {
      return false;
    }
    if (bpFilter && op.businessPartner !== bpFilter) return false;
    return true;
  });

  // Derived: supervisor with their assigned operators
  const supervisorAssignments = supervisors.map((sup) => {
    const supAssignments = assignments.filter((a) => a.supervisorId === sup.id);
    const opList = supAssignments
      .map((a) => {
        const found = operators.find((op) => op.id === a.operatorId);
        // Fallback info if operator was not in the filtered operator list
        const opData: Employee = found || {
          id: a.operatorId,
          employeeCode: a.operatorCode,
          callingName: a.operatorName || 'Operator',
          fullName: a.operatorName || 'Operator',
          businessPartner: a.businessPartner || '',
          tradeGroup: a.operatorTrade || 'Operator',
          nicNo: '',
          licenseNo: a.licenseNo || undefined,
          status: 'active',
        };
        return {
          assignment: a,
          operator: opData,
        };
      })
      .filter((x) => Boolean(x.operator));

    return {
      supervisor: sup,
      operators: opList,
    };
  });

  const unassignedCount = operators.filter((op) => !assignedOpIds.has(op.id)).length;
  const assignedCount = operators.length - unassignedCount;

  // Actions
  const toggleOperatorSelection = (opId: string) => {
    setSelectedOperatorIds((prev) => {
      const next = new Set(prev);
      if (next.has(opId)) next.delete(opId);
      else next.add(opId);
      return next;
    });
  };

  const selectAllUnassigned = () => {
    setSelectedOperatorIds(new Set(unassignedOperators.map((op) => op.id)));
  };

  const deselectAll = () => setSelectedOperatorIds(new Set());

  const assignToSupervisor = async (supervisorId: string) => {
    if (selectedOperatorIds.size === 0 || isSaving) return;
    setIsSaving(true);
    try {
      await svc.assignOperators(selectedDate, supervisorId, [...selectedOperatorIds]);
      await load(true);
    } finally {
      setIsSaving(false);
    }
  };

  const unassignOperator = async (assignmentId: string) => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await svc.unassignOperator(assignmentId);
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
      await svc.copyOperatorGangsFromDate(prev, selectedDate);
      await load(true);
    } finally {
      setIsSaving(false);
    }
  };

  return {
    selectedDate,
    setSelectedDate,
    assignments,
    operators,
    supervisors,
    isLoading,
    isSaving,
    unassignedOperators,
    supervisorAssignments,
    totalOperators: operators.length,
    assignedCount,
    unassignedCount,
    selectedOperatorIds,
    toggleOperatorSelection,
    selectAllUnassigned,
    deselectAll,
    search,
    setSearch,
    bpFilter,
    setBPFilter,
    businessPartners: getBusinessPartners(operators),
    assignToSupervisor,
    unassignOperator,
    copyPreviousDay,
    refresh: () => load(true),
  };
}
