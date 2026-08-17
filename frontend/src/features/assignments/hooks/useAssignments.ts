/**
 * useAssignments.ts — State management for daily assignments.
 * Handles selected date, context data, multi-select, assign/unassign/copy/bulk.
 */
import { useState, useEffect, useCallback } from 'react';
import type { Assignment } from '../services/assignmentService';
import type { Employee } from '../../employees/services/employeeService';
import type { Supervisor } from '../../supervisors/services/supervisorService';
import * as svc from '../services/assignmentService';
import { getBusinessPartners, getTradeGroups } from '../../employees/services/employeeService';

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDateStr(dateStr: string): string {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return formatDate(d);
}

export function useAssignments() {
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeBPFilter, setEmployeeBPFilter] = useState('');
  const [employeeTGFilter, setEmployeeTGFilter] = useState('');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const [asgn, ctx] = await Promise.all([
        svc.getForDate(selectedDate),
        svc.getAssignmentContext(),
      ]);
      setAssignments(asgn);
      setEmployees(ctx.employees);
      setSupervisors(ctx.supervisors);
      setSelectedEmployeeIds(new Set());
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => { load(); }, [load]);

  // Derived: unassigned employees
  const assignedEmpIds = new Set(assignments.map((a) => a.employeeId));
  const unassignedEmployees = employees.filter((e) => {
    if (assignedEmpIds.has(e.id)) return false;
    const q = employeeSearch.toLowerCase();
    if (q && !e.callingName.toLowerCase().includes(q) && !e.fullName.toLowerCase().includes(q)) return false;
    if (employeeBPFilter && e.businessPartner !== employeeBPFilter) return false;
    if (employeeTGFilter && e.tradeGroup !== employeeTGFilter) return false;
    return true;
  });

  // Derived: supervisor with their assigned employees
  const supervisorAssignments = supervisors.map((sup) => {
    const supAssignments = assignments.filter((a) => a.supervisorId === sup.id);
    const empList = supAssignments.map((a) => ({
      assignment: a,
      employee: employees.find((e) => e.id === a.employeeId),
    })).filter((x) => x.employee !== undefined);
    return { supervisor: sup, employees: empList as { assignment: Assignment; employee: Employee }[] };
  });

  const unassignedCount = employees.filter((e) => !assignedEmpIds.has(e.id)).length;

  // Actions
  const toggleEmployeeSelection = (empId: string) => {
    setSelectedEmployeeIds((prev) => {
      const next = new Set(prev);
      if (next.has(empId)) next.delete(empId); else next.add(empId);
      return next;
    });
  };

  const selectAllUnassigned = () => {
    setSelectedEmployeeIds(new Set(unassignedEmployees.map((e) => e.id)));
  };

  const deselectAll = () => setSelectedEmployeeIds(new Set());

  const assignToSupervisor = async (supervisorId: string) => {
    if (selectedEmployeeIds.size === 0) return;
    await svc.assign(selectedDate, supervisorId, [...selectedEmployeeIds]);
    await load();
  };

  const unassignEmployee = async (assignmentId: string) => {
    await svc.unassign(selectedDate, assignmentId);
    await load();
  };

  const copyPreviousDay = async () => {
    const prev = prevDateStr(selectedDate);
    await svc.copyFromDate(prev, selectedDate);
    await load();
  };

  const bulkAssignByGroup = async (
    supervisorId: string,
    filter: { tradeGroup?: string; businessPartner?: string }
  ) => {
    await svc.bulkAssign(selectedDate, supervisorId, filter);
    await load();
  };

  return {
    selectedDate, setSelectedDate,
    assignments, employees, supervisors,
    isLoading,
    unassignedEmployees, supervisorAssignments, unassignedCount,
    selectedEmployeeIds, toggleEmployeeSelection, selectAllUnassigned, deselectAll,
    employeeSearch, setEmployeeSearch,
    employeeBPFilter, setEmployeeBPFilter,
    employeeTGFilter, setEmployeeTGFilter,
    businessPartners: getBusinessPartners(),
    tradeGroups: getTradeGroups(),
    assignToSupervisor, unassignEmployee,
    copyPreviousDay, bulkAssignByGroup,
    refresh: load,
  };
}
