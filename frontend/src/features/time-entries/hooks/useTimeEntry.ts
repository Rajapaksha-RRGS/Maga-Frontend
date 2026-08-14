import { useState, useCallback } from 'react';
import {
  checkInEmployee,
  saveTimeEntry,
  submitDay as submitDayService,
} from '../services/timeEntryService';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmployeeEntryState {
  employeeId: string;
  inTime: string | null;       // "HH:mm" or null if not checked in
  outTime: string | null;      // "HH:mm" or null
  activityId: string | null;
  hours: number | null;
  saved: boolean;              // true after saveTimeEntry resolves
}

export type SubmitStatus = 'idle' | 'submitting' | 'submitted' | 'error';

interface UseTimeEntryReturn {
  entries: Record<string, EmployeeEntryState>;
  submitStatus: SubmitStatus;
  checkIn: (employeeId: string) => void;
  setActivity: (employeeIds: string[], activityId: string, hours: number) => void;
  setOutTime: (employeeId: string, outTime: string) => void;
  submitDay: (supervisorId: string, date: string) => Promise<void>;
  checkedInCount: number;
  assignedCount: number;
}

/**
 * Manages the mutable time-entry state for all employees across the
 * 4-screen daily entry flow. All business operations (check-in, activity
 * assignment, out-time, submit) live here — page components only call
 * these callbacks.
 */
export function useTimeEntry(employeeIds: string[]): UseTimeEntryReturn {
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
          saved: false,
        },
      ])
    )
  );
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');

  // Re-initialise entries when employee list changes (e.g. after refetch)
  // without blowing away any state already set for known employees.
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

  // Call this whenever employeeIds list changes to sync state keys
  if (employeeIds.some((id) => !entries[id])) {
    ensureEntries(employeeIds);
  }

  // ── Check-in ──────────────────────────────────────────────────────────────

  const checkIn = useCallback(
    (employeeId: string) => {
      const now = new Date();
      const inTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Optimistic UI update
      setEntries((prev) => ({
        ...prev,
        [employeeId]: { ...prev[employeeId], inTime },
      }));

      // Fire-and-forget API stub
      // TODO: handle error (show toast / retry) when real API is wired
      checkInEmployee(employeeId, 'mock-supervisor-id', todayISO(), inTime).catch(
        console.error
      );
    },
    []
  );

  // ── Activity assignment ────────────────────────────────────────────────────

  const setActivity = useCallback(
    (employeeIds: string[], activityId: string, hours: number) => {
      setEntries((prev) => {
        const next = { ...prev };
        employeeIds.forEach((id) => {
          next[id] = { ...next[id], activityId, hours, saved: false };
        });
        return next;
      });

      // Persist each entry (fire-and-forget stubs)
      // TODO: handle errors when real API is wired
      employeeIds.forEach((id) => {
        saveTimeEntry({
          employeeId: id,
          supervisorId: 'mock-supervisor-id',
          date: todayISO(),
          activityId,
          hours,
        }).catch(console.error);
      });
    },
    []
  );

  // ── Out-time ──────────────────────────────────────────────────────────────

  const setOutTime = useCallback((employeeId: string, outTime: string) => {
    setEntries((prev) => ({
      ...prev,
      [employeeId]: { ...prev[employeeId], outTime },
    }));
  }, []);

  // ── Submit day ────────────────────────────────────────────────────────────

  const submitDay = useCallback(
    async (supervisorId: string, date: string) => {
      setSubmitStatus('submitting');
      try {
        // TODO: replace stub with real API call when backend is ready
        await submitDayService({ supervisorId, date });
        setSubmitStatus('submitted');
      } catch (err) {
        console.error('submitDay failed', err);
        setSubmitStatus('error');
      }
    },
    []
  );

  // ── Derived values ────────────────────────────────────────────────────────

  const checkedInCount = Object.values(entries).filter((e) => e.inTime !== null).length;
  const assignedCount = employeeIds.length;

  return {
    entries,
    submitStatus,
    checkIn,
    setActivity,
    setOutTime,
    submitDay,
    checkedInCount,
    assignedCount,
  };
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0];
}
