/**
 * useAssignments.ts — State management for daily assignments.
 * Handles selected date, context data, multi-select, assign/unassign/copy/bulk.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Assignment } from '../services/assignmentService';
import type { Employee } from '../../employees/services/employeeService';
import type { Supervisor } from '../../supervisors/services/supervisorService';
import * as svc from '../services/assignmentService';
import { getBusinessPartners, getTradeGroups } from '../../employees/services/employeeService';
import { cacheManager } from '../../../utils/cacheManager';

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

export function useAssignments(controlledDate?: string, onDateChange?: (date: string) => void) {
  const initialDate = controlledDate || formatDate(new Date());
  const [internalDate, setInternalDate] = useState(initialDate);

  const selectedDate = controlledDate !== undefined ? controlledDate : internalDate;
  const setSelectedDate = onDateChange || setInternalDate;

  const initialAsgn = cacheManager.get<Assignment[]>(`assignments:date:${initialDate}`) || [];
  const initialCtx = cacheManager.get<{ employees: Employee[]; supervisors: Supervisor[] }>(`assignments:context:${initialDate}`);

  const [assignments, setAssignments] = useState<Assignment[]>(initialAsgn);
  const [employees, setEmployees] = useState<Employee[]>(initialCtx?.employees || []);
  const [supervisors, setSupervisors] = useState<Supervisor[]>(initialCtx?.supervisors || []);
  const [sheetStatuses, setSheetStatuses] = useState<Record<string, svc.DailySheetLockStatus>>({});
  const [isLoading, setIsLoading] = useState<boolean>(() => !cacheManager.get(`assignments:date:${initialDate}`) || !initialCtx);
  const isSavingRef = useRef<boolean>(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeeBPFilter, setEmployeeBPFilter] = useState('');
  const [employeeTGFilter, setEmployeeTGFilter] = useState('');

  const load = useCallback(async (forceRefresh = false, silent = false) => {
    if (!silent) {
      setIsLoading(true);
    }
    try {
      const [asgn, ctx, statuses] = await Promise.all([
        svc.getForDate(selectedDate, forceRefresh),
        svc.getAssignmentContext(selectedDate, forceRefresh),
        svc.getDailySheetStatuses(selectedDate),
      ]);
      setAssignments(asgn);
      setEmployees(ctx.employees);
      setSupervisors(ctx.supervisors);
      setSheetStatuses(statuses);
      if (!silent) {
        setSelectedEmployeeIds(new Set());
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [selectedDate]);

  useEffect(() => {
    load(true, Boolean(cacheManager.get(`assignments:date:${selectedDate}`)));
  }, [load, selectedDate]);

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
    if (selectedEmployeeIds.size === 0 || isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await svc.assign(selectedDate, supervisorId, [...selectedEmployeeIds]);
      await load(true);
    } catch (err: any) {
      alert(err?.message || 'Cannot assign laborers to this supervisor.');
      await load(true);
    } finally {
      isSavingRef.current = false;
    }
  };

  const unassignEmployee = async (assignmentId: string) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await svc.unassign(selectedDate, assignmentId);
      await load(true);
    } catch (err: any) {
      alert(err?.message || 'Cannot remove assignment.');
      await load(true);
    } finally {
      isSavingRef.current = false;
    }
  };

  const copyPreviousDay = async () => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      const prev = prevDateStr(selectedDate);
      await svc.copyFromDate(prev, selectedDate);
      await load(true);
    } catch (err: any) {
      alert(err?.message || 'Cannot copy previous day gang.');
      await load(true);
    } finally {
      isSavingRef.current = false;
    }
  };

  const copyFromSpecificDate = async (sourceDate: string, supervisorIds?: string[]) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await svc.copyFromDate(sourceDate, selectedDate, supervisorIds);
      await load(true);
    } catch (err: any) {
      alert(err?.message || 'Cannot copy gang from selected date.');
      await load(true);
    } finally {
      isSavingRef.current = false;
    }
  };

  const bulkAssignByGroup = async (
    supervisorId: string,
    filter: { tradeGroup?: string; businessPartner?: string }
  ) => {
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    try {
      await svc.bulkAssign(selectedDate, supervisorId, filter);
      await load(true);
    } catch (err: any) {
      alert(err?.message || 'Cannot bulk assign laborers.');
      await load(true);
    } finally {
      isSavingRef.current = false;
    }
  };

  return {
    selectedDate, setSelectedDate,
    assignments, employees, supervisors, sheetStatuses,
    isLoading,
    unassignedEmployees, supervisorAssignments, unassignedCount,
    selectedEmployeeIds, toggleEmployeeSelection, selectAllUnassigned, deselectAll,
    employeeSearch, setEmployeeSearch,
    employeeBPFilter, setEmployeeBPFilter,
    employeeTGFilter, setEmployeeTGFilter,
    businessPartners: getBusinessPartners(employees),
    tradeGroups: getTradeGroups(employees),
    assignToSupervisor, unassignEmployee,
    copyPreviousDay, copyFromSpecificDate, bulkAssignByGroup,
    getRecentGangSummaries: svc.getRecentGangSummaries,
    refresh: load,
  };
}
