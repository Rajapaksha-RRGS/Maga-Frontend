import { useState, useCallback } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  checkInEmployee,
  assignActivityBulk,
  submitDay as submitDayService,
} from '../services/timeEntryService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ActivityHourItem {
  activityId: string;
  hours: number;
}

export interface EmployeeEntryState {
  employeeId: string;
  inTime: string | null;       // "HH:mm" or null if not checked in
  outTime: string | null;      // "HH:mm" or null
  activityId: string | null;   // Primary/legacy activity
  hours: number | null;        // Total activity hours
  activities: ActivityHourItem[]; // Multi-activity list for Method 1
  saved: boolean;              // true after backend sync
}

export type SubmitStatus = 'idle' | 'submitting' | 'submitted' | 'error';

interface UseTimeEntryReturn {
  entries: Record<string, EmployeeEntryState>;
  submitStatus: SubmitStatus;
  checkIn: (employeeId: string) => void;
  setActivity: (employeeIds: string[], activityId: string, hours: number) => void;
  setEmployeeActivities: (employeeId: string, activities: ActivityHourItem[]) => void;
  bulkSetActivities: (employeeIds: string[], activities: ActivityHourItem[]) => void;
  setOutTime: (employeeId: string, outTime: string) => void;
  submitDay: (supervisorId: string, date: string) => Promise<void>;
  checkedInCount: number;
  assignedCount: number;
}

/**
 * Manages the mutable time-entry state for all employees across the
 * daily entry flow. Supports Check-in, Check-out, Multi-Activity distribution,
 * and Day submission.
 */
export function useTimeEntry(employeeIds: string[], supervisorId?: string): UseTimeEntryReturn {
  const { user } = useAuth();
  const effectiveSupervisorId = supervisorId || user?.id || '';

  const [entries, setEntries] = useState<Record<string, EmployeeEntryState>>(
    () => Object.fromEntries(
      employeeIds.map((id) => [
        id,
        {
          employeeId: id,
          inTime: null,
          outTime: null,
          activityId: null,
          hours: null,
          activities: [],
          saved: false,
        },
      ])
    )
  );
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');

  const ensureEntries = useCallback(
    (ids: string[]) => {
      setEntries((prev) => {
        const next = { ...prev };
        let changed = false;
        ids.forEach((id) => {
          if (!next[id]) {
            next[id] = {
              employeeId: id,
              inTime: null,
              outTime: null,
              activityId: null,
              hours: null,
              activities: [],
              saved: false,
            };
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    },
    []
  );

  if (employeeIds.some((id) => !entries[id])) {
    ensureEntries(employeeIds);
  }

  // ── 1. Check-in ────────────────────────────────────────────────────────────

  const checkIn = useCallback(
    (employeeId: string) => {
      const now = new Date();
      const inTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      setEntries((prev) => ({
        ...prev,
        [employeeId]: { ...prev[employeeId], inTime },
      }));

      checkInEmployee(employeeId, effectiveSupervisorId, todayISO(), inTime).catch(
        console.error
      );
    },
    [effectiveSupervisorId]
  );

  // ── 2. Out-time ────────────────────────────────────────────────────────────

  const setOutTime = useCallback((employeeId: string, outTime: string) => {
    setEntries((prev) => ({
      ...prev,
      [employeeId]: { ...prev[employeeId], outTime },
    }));
  }, []);

  // ── 3. Single Activity Assignment (Legacy support) ─────────────────────────

  const setActivity = useCallback(
    (employeeIds: string[], activityId: string, hours: number) => {
      setEntries((prev) => {
        const next = { ...prev };
        employeeIds.forEach((id) => {
          next[id] = {
            ...next[id],
            activityId,
            hours,
            activities: [{ activityId, hours }],
            saved: false,
          };
        });
        return next;
      });

      assignActivityBulk({
        employeeIds,
        activityId,
        hours,
        date: todayISO(),
      })
        .then(() => {
          setEntries((prev) => {
            const next = { ...prev };
            employeeIds.forEach((id) => {
              if (next[id]) next[id] = { ...next[id], saved: true };
            });
            return next;
          });
        })
        .catch(console.error);
    },
    []
  );

  // ── 4. Multi-Activity Distribution for an Employee (Method 1) ─────────────

  const setEmployeeActivities = useCallback(
    (employeeId: string, activities: ActivityHourItem[]) => {
      const totalHours = activities.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
      const primaryActivityId = activities[0]?.activityId || null;

      setEntries((prev) => ({
        ...prev,
        [employeeId]: {
          ...prev[employeeId],
          activities,
          hours: totalHours,
          activityId: primaryActivityId,
          saved: false,
        },
      }));

      // Sync activities to backend
      activities.forEach((act) => {
        if (act.activityId && act.hours > 0) {
          assignActivityBulk({
            employeeIds: [employeeId],
            activityId: act.activityId,
            hours: act.hours,
            date: todayISO(),
          }).catch(console.error);
        }
      });
    },
    []
  );

  // ── 5. Bulk Multi-Activity Distribution for Multiple Employees ─────────────

  const bulkSetActivities = useCallback(
    (employeeIds: string[], activities: ActivityHourItem[]) => {
      const totalHours = activities.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
      const primaryActivityId = activities[0]?.activityId || null;

      setEntries((prev) => {
        const next = { ...prev };
        employeeIds.forEach((id) => {
          next[id] = {
            ...next[id],
            activities: [...activities],
            hours: totalHours,
            activityId: primaryActivityId,
            saved: false,
          };
        });
        return next;
      });

      activities.forEach((act) => {
        if (act.activityId && act.hours > 0) {
          assignActivityBulk({
            employeeIds,
            activityId: act.activityId,
            hours: act.hours,
            date: todayISO(),
          }).catch(console.error);
        }
      });
    },
    []
  );

  // ── 6. Submit Day ──────────────────────────────────────────────────────────

  const submitDay = useCallback(
    async (supervisorId: string, date: string) => {
      setSubmitStatus('submitting');
      try {
        await submitDayService({ supervisorId, date });
        setSubmitStatus('submitted');
      } catch (err) {
        console.error('submitDay failed', err);
        setSubmitStatus('error');
      }
    },
    []
  );

  const checkedInCount = Object.values(entries).filter((e) => e.inTime !== null).length;
  const assignedCount = employeeIds.length;

  return {
    entries,
    submitStatus,
    checkIn,
    setActivity,
    setEmployeeActivities,
    bulkSetActivities,
    setOutTime,
    submitDay,
    checkedInCount,
    assignedCount,
  };
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}
