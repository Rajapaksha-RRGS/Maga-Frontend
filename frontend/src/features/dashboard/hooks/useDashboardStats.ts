/**
 * useDashboardStats.ts
 *
 * Aggregates data from employee, supervisor, assignment, and time-entry
 * services into dashboard stat counts, "needs attention" items, and
 * supervisor submission status for the activity panel and feed.
 */
import { useState, useEffect, useCallback } from 'react';
import * as empSvc from '../../employees/services/employeeService';
import * as supSvc from '../../supervisors/services/supervisorService';
import * as asgnSvc from '../../assignments/services/assignmentService';
import * as timeEntrySvc from '../../time-entries/services/timeEntryService';
import type { BackendTimeEntry } from '../../time-entries/services/timeEntryService';
import { cacheManager } from '../../../utils/cacheManager';

export interface AttentionItem {
  id: string;
  type: 'unassigned' | 'unsubmitted';
  label: string;
  detail: string;
  link: string;
}

export interface SupervisorStatus {
  id: string;
  name: string;
  status: 'submitted' | 'in-progress' | 'not-started';
}

export interface DashboardStats {
  totalEmployees: number;
  activeSupervisors: number;
  unassignedToday: number;
  pendingSubmissions: number;
  submittedSupervisors: number;
  inProgressSupervisors: number;
  supervisorStatuses: SupervisorStatus[];
  attentionItems: AttentionItem[];
  todayEntries: BackendTimeEntry[];
  isLoading: boolean;
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const INITIAL: DashboardStats = {
  totalEmployees: 0,
  activeSupervisors: 0,
  unassignedToday: 0,
  pendingSubmissions: 0,
  submittedSupervisors: 0,
  inProgressSupervisors: 0,
  supervisorStatuses: [],
  attentionItems: [],
  todayEntries: [],
  isLoading: true,
};

export function useDashboardStats(): DashboardStats {
  const cached = cacheManager.get<DashboardStats>('dashboard:stats');
  const [stats, setStats] = useState<DashboardStats>(() => cached ?? INITIAL);

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

      // Build per-supervisor status
      const supervisorStatuses: SupervisorStatus[] = [];
      let submittedSupervisors = 0;
      let inProgressSupervisors = 0;

      for (const sup of supsWithAssignments) {
        const supEntries = todayEntries.filter((t) => t.supervisorId === sup.id);
        let status: SupervisorStatus['status'];
        if (supEntries.length === 0) {
          status = 'not-started';
        } else if (supEntries.every((t) => t.status === 'submitted' || t.status === 'approved')) {
          status = 'submitted';
          submittedSupervisors++;
        } else {
          status = 'in-progress';
          inProgressSupervisors++;
        }
        supervisorStatuses.push({ id: sup.id, name: sup.fullName, status });
      }

      const pendingSubmissions = supsWithAssignments.length - submittedSupervisors;

      // Build attention items
      const attentionItems: AttentionItem[] = [];

      for (const emp of unassignedEmps.slice(0, 5)) {
        attentionItems.push({
          id: `ua-${emp.id}`,
          type: 'unassigned',
          label: emp.callingName,
          detail: `${emp.tradeGroup} — not assigned today`,
          link: '/admin/assignments/labour',
        });
      }
      if (unassignedEmps.length > 5) {
        attentionItems.push({
          id: 'ua-more',
          type: 'unassigned',
          label: `+${unassignedEmps.length - 5} more unassigned`,
          detail: 'employees not assigned today',
          link: '/admin/assignments/labour',
        });
      }

      const unsubmittedSups = supervisorStatuses.filter((s) => s.status !== 'submitted');
      for (const sup of unsubmittedSups.slice(0, 3)) {
        attentionItems.push({
          id: `us-${sup.id}`,
          type: 'unsubmitted',
          label: sup.name,
          detail: sup.status === 'in-progress' ? 'Sheet is in draft — not submitted yet' : 'No entries recorded today',
          link: '/admin/approvals',
        });
      }

      const newStats: DashboardStats = {
        totalEmployees: activeEmps.length,
        activeSupervisors: activeSups.length,
        unassignedToday: unassignedEmps.length,
        pendingSubmissions,
        submittedSupervisors,
        inProgressSupervisors,
        supervisorStatuses,
        attentionItems,
        todayEntries,
        isLoading: false,
      };

      cacheManager.set('dashboard:stats', newStats, 15_000); // 15s TTL
      setStats(newStats);
    } catch {
      setStats((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return stats;
}
