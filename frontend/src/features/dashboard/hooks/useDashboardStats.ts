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
import * as timeEntrySvc from '../../time-entries/services/timeEntryService';
import { cacheManager } from '../../../utils/cacheManager';

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
  const cached = cacheManager.get<DashboardStats>('dashboard:stats');
  const [stats, setStats] = useState<DashboardStats>(() => cached ?? {
    totalEmployees: 0,
    activeSupervisors: 0,
    unassignedToday: 0,
    pendingSubmissions: 0,
    attentionItems: [],
    isLoading: true,
  });

  const load = useCallback(async (forceRefresh = false) => {
    if (forceRefresh || !cacheManager.get('dashboard:stats')) {
      setStats((prev) => ({ ...prev, isLoading: true }));
    }
    try {
      const today = formatDate(new Date());
      const [employees, supervisors, assignments, todayEntries] = await Promise.all([
        empSvc.getAll(undefined, forceRefresh),
        supSvc.getAll(forceRefresh),
        asgnSvc.getForDate(today, forceRefresh),
        timeEntrySvc.getTimeEntries(undefined, today),
      ]);

      const activeEmps = employees.filter((e) => e.status === 'active');
      const activeSups = supervisors.filter((s) => s.status === 'active');
      const assignedEmpIds = new Set(assignments.map((a) => a.employeeId));
      const unassignedEmps = activeEmps.filter((e) => !assignedEmpIds.has(e.id));

      // Active supervisors who have assignments today
      const supsWithAssignments = activeSups.filter((sup) =>
        assignments.some((a) => a.supervisorId === sup.id)
      );

      // A supervisor is pending if they have work assigned today, but either:
      // 1. No time entries exist for them yet today, OR
      // 2. Any of their time entries is still in 'draft' status
      const unsubmittedSupervisors = supsWithAssignments.filter((sup) => {
        const supEntries = todayEntries.filter((t) => t.supervisorId === sup.id);
        if (supEntries.length === 0) return true;
        return supEntries.some((t) => t.status === 'draft');
      });

      const pendingSubmissions = unsubmittedSupervisors.length;

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

      // Supervisors with genuinely unsubmitted daily attendance
      for (const sup of unsubmittedSupervisors.slice(0, 5)) {
        attentionItems.push({
          id: `us-${sup.id}`,
          type: 'unsubmitted',
          label: sup.fullName,
          detail: 'Daily attendance has not been submitted yet',
          link: '/admin/reports',
        });
      }

      const newStats: DashboardStats = {
        totalEmployees: activeEmps.length,
        activeSupervisors: activeSups.length,
        unassignedToday: unassignedEmps.length,
        pendingSubmissions,
        attentionItems,
        isLoading: false,
      };
      cacheManager.set('dashboard:stats', newStats, 15_000); // 15s TTL so fresh submissions show quickly
      setStats(newStats);
    } catch {
      setStats((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return stats;
}
