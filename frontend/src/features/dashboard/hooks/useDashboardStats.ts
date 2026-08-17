/**
 * useDashboardStats.ts
 *
 * Aggregates data from employee, supervisor, assignment, and time-entry
 * services into dashboard stat counts and "needs attention" items.
 */
import { useState, useEffect, useCallback } from 'react';
import * as empSvc from '../../employees/services/employeeService';
import * as supSvc from '../../supervisors/services/supervisorService';
import * as asgnSvc from '../../assignments/services/assignmentService';

interface AttentionItem {
  id: string;
  type: 'unassigned' | 'unsubmitted';
  label: string;
  detail: string;
  link: string;
}

interface DashboardStats {
  totalEmployees: number;
  activeSupervisors: number;
  unassignedToday: number;
  pendingSubmissions: number;
  attentionItems: AttentionItem[];
  isLoading: boolean;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function useDashboardStats(): DashboardStats {
  const [stats, setStats] = useState<DashboardStats>({
    totalEmployees: 0,
    activeSupervisors: 0,
    unassignedToday: 0,
    pendingSubmissions: 0,
    attentionItems: [],
    isLoading: true,
  });

  const load = useCallback(async () => {
    try {
      const today = formatDate(new Date());
      const [employees, supervisors, assignments] = await Promise.all([
        empSvc.getAll(),
        supSvc.getAll(),
        asgnSvc.getForDate(today),
      ]);

      const activeEmps = employees.filter((e) => e.status === 'active');
      const activeSups = supervisors.filter((s) => s.status === 'active');
      const assignedEmpIds = new Set(assignments.map((a) => a.employeeId));
      const unassignedEmps = activeEmps.filter((e) => !assignedEmpIds.has(e.id));

      // Mock: some supervisors have "pending" submissions
      const pendingSubmissions = Math.max(0, activeSups.length - 1); // mock: 1 has submitted

      const attentionItems: AttentionItem[] = [];

      // Unassigned employees
      for (const emp of unassignedEmps.slice(0, 5)) {
        attentionItems.push({
          id: `ua-${emp.id}`,
          type: 'unassigned',
          label: emp.callingName,
          detail: `${emp.tradeGroup} — not assigned today`,
          link: '/admin/assignments',
        });
      }
      if (unassignedEmps.length > 5) {
        attentionItems.push({
          id: 'ua-more',
          type: 'unassigned',
          label: `+${unassignedEmps.length - 5} more`,
          detail: 'Unassigned employees',
          link: '/admin/assignments',
        });
      }

      // Mock: supervisors with unsubmitted entries
      for (const sup of activeSups.slice(0, pendingSubmissions)) {
        attentionItems.push({
          id: `us-${sup.id}`,
          type: 'unsubmitted',
          label: sup.fullName,
          detail: 'Has unsubmitted time entries',
          link: '/admin/reports',
        });
      }

      setStats({
        totalEmployees: activeEmps.length,
        activeSupervisors: activeSups.length,
        unassignedToday: unassignedEmps.length,
        pendingSubmissions,
        attentionItems,
        isLoading: false,
      });
    } catch {
      setStats((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return stats;
}
