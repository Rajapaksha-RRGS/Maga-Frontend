import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import {
  checkInEmployee,
  checkOutEmployee,
  assignActivityBulk,
  getTimeEntries,
  submitDay as submitDayService,
  type BackendTimeEntry,
} from '../services/timeEntryService';

function todayISO(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

export interface SubmittedInfo {
  supervisorName: string;
  username: string;
  submittedAt: string | null;
}

interface UseTimeEntryReturn {
  entries: Record<string, EmployeeEntryState>;
  submitStatus: SubmitStatus;
  submittedInfo: SubmittedInfo | null;
  isLoadingEntries: boolean;
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
 * daily entry flow. Automatically restores saved entries from backend on mount,
 * supports Check-in, Check-out, Multi-Activity distribution, and Day submission.
 */
export function useTimeEntry(
  employeeIds: string[],
  supervisorId?: string,
  date?: string
): UseTimeEntryReturn {
  const { user } = useAuth();
  const effectiveSupervisorId = supervisorId || user?.id || '';
  const effectiveDate = date || todayISO();

  const [entries, setEntries] = useState<Record<string, EmployeeEntryState>>({});
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>('idle');
  const [submittedInfo, setSubmittedInfo] = useState<SubmittedInfo | null>(null);
  const [isLoadingEntries, setIsLoadingEntries] = useState<boolean>(true);

  // Helper to ensure blank entries exist for all assigned employees
  const ensureEntries = useCallback((ids: string[]) => {
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
  }, []);

  // ── Load existing saved entries from backend ────────────────────────────────
  useEffect(() => {
    if (!effectiveSupervisorId) {
      setIsLoadingEntries(false);
      return;
    }

    let isMounted = true;
    setIsLoadingEntries(true);

    getTimeEntries(effectiveSupervisorId, effectiveDate)
      .then((records: BackendTimeEntry[]) => {
        if (!isMounted) return;

        // Check if any record is marked as submitted
        const submittedRecord = records.find((r) => r.status === 'submitted');
        if (submittedRecord) {
          setSubmitStatus('submitted');
          setSubmittedInfo({
            supervisorName: submittedRecord.supervisor?.fullName || user?.fullName || 'Supervisor',
            username: submittedRecord.supervisor?.username || user?.username || '',
            submittedAt: submittedRecord.submittedAt,
          });
        } else {
          setSubmitStatus('idle');
          setSubmittedInfo(null);
        }

        // Group records by employeeId
        const recordsByEmp: Record<string, BackendTimeEntry[]> = {};
        records.forEach((rec) => {
          if (!recordsByEmp[rec.employeeId]) {
            recordsByEmp[rec.employeeId] = [];
          }
          recordsByEmp[rec.employeeId].push(rec);
        });

        setEntries((prev) => {
          const next: Record<string, EmployeeEntryState> = { ...prev };

          // 1. Initialize all assigned employees
          employeeIds.forEach((empId) => {
            if (!next[empId]) {
              next[empId] = {
                employeeId: empId,
                inTime: null,
                outTime: null,
                activityId: null,
                hours: null,
                activities: [],
                saved: false,
              };
            }
          });

          // 2. Overlay loaded backend data
          Object.entries(recordsByEmp).forEach(([empId, empRecords]) => {
            const firstWithInTime = empRecords.find((r) => r.inTime)?.inTime || null;
            const firstWithOutTime = empRecords.find((r) => r.outTime)?.outTime || null;

            const activities: ActivityHourItem[] = empRecords
              .filter((r) => Number(r.hours) > 0)
              .map((r) => ({
                activityId: r.activityId,
                hours: Number(r.hours),
              }));

            const totalHours = activities.reduce((sum, a) => sum + a.hours, 0);
            const primaryActivityId = activities[0]?.activityId || empRecords[0]?.activityId || null;

            next[empId] = {
              employeeId: empId,
              inTime: firstWithInTime,
              outTime: firstWithOutTime,
              activityId: primaryActivityId,
              hours: totalHours > 0 ? totalHours : null,
              activities,
              saved: true,
            };
          });

          return next;
        });
      })
      .catch((err) => {
        console.error('Failed to load existing time entries:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingEntries(false);
      });

    return () => {
      isMounted = false;
    };
  }, [effectiveSupervisorId, effectiveDate, employeeIds.join(',')]);

  if (employeeIds.some((id) => !entries[id])) {
    ensureEntries(employeeIds);
  }

  // ── 1. Check-in ────────────────────────────────────────────────────────────

  const checkIn = useCallback(
    (employeeId: string) => {
      if (submitStatus === 'submitted') {
        console.warn('Cannot check in: Day entries are already submitted and locked.');
        return;
      }

      const now = new Date();
      const inTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      setEntries((prev) => ({
        ...prev,
        [employeeId]: { ...prev[employeeId], inTime, saved: true },
      }));

      checkInEmployee(employeeId, effectiveSupervisorId, effectiveDate, inTime).catch(
        console.error
      );
    },
    [effectiveSupervisorId, effectiveDate, submitStatus]
  );

  // ── 2. Out-time ────────────────────────────────────────────────────────────

  const setOutTime = useCallback(
    (employeeId: string, outTime: string) => {
      if (submitStatus === 'submitted') {
        console.warn('Cannot record checkout: Day entries are already submitted and locked.');
        return;
      }

      setEntries((prev) => ({
        ...prev,
        [employeeId]: { ...prev[employeeId], outTime, saved: true },
      }));

      checkOutEmployee(employeeId, effectiveSupervisorId, effectiveDate, outTime).catch(
        console.error
      );
    },
    [effectiveSupervisorId, effectiveDate, submitStatus]
  );

  // ── 3. Single Activity Assignment (Legacy support) ─────────────────────────

  const setActivity = useCallback(
    (employeeIdsToSet: string[], activityId: string, hours: number) => {
      if (submitStatus === 'submitted') return;

      setEntries((prev) => {
        const next = { ...prev };
        employeeIdsToSet.forEach((id) => {
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
        employeeIds: employeeIdsToSet,
        activityId,
        hours,
        date: effectiveDate,
        supervisorId: effectiveSupervisorId,
      })
        .then(() => {
          setEntries((prev) => {
            const next = { ...prev };
            employeeIdsToSet.forEach((id) => {
              if (next[id]) next[id] = { ...next[id], saved: true };
            });
            return next;
          });
        })
        .catch(console.error);
    },
    [effectiveDate, effectiveSupervisorId, submitStatus]
  );

  // ── 4. Multi-Activity Distribution for an Employee (Method 1) ─────────────

  const setEmployeeActivities = useCallback(
    (employeeId: string, activities: ActivityHourItem[]) => {
      if (submitStatus === 'submitted') {
        console.warn('Cannot update activities: Day entries are already submitted and locked.');
        return;
      }

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
            date: effectiveDate,
            supervisorId: effectiveSupervisorId,
          })
            .then(() => {
              setEntries((prev) => ({
                ...prev,
                [employeeId]: { ...prev[employeeId], saved: true },
              }));
            })
            .catch(console.error);
        }
      });
    },
    [effectiveDate, effectiveSupervisorId, submitStatus]
  );

  // ── 5. Bulk Multi-Activity Distribution for Multiple Employees ─────────────

  const bulkSetActivities = useCallback(
    (employeeIdsToSet: string[], activities: ActivityHourItem[]) => {
      if (submitStatus === 'submitted') return;
      const totalHours = activities.reduce((sum, a) => sum + (Number(a.hours) || 0), 0);
      const primaryActivityId = activities[0]?.activityId || null;

      setEntries((prev) => {
        const next = { ...prev };
        employeeIdsToSet.forEach((id) => {
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
            employeeIds: employeeIdsToSet,
            activityId: act.activityId,
            hours: act.hours,
            date: effectiveDate,
            supervisorId: effectiveSupervisorId,
          })
            .then(() => {
              setEntries((prev) => {
                const next = { ...prev };
                employeeIdsToSet.forEach((id) => {
                  if (next[id]) next[id] = { ...next[id], saved: true };
                });
                return next;
              });
            })
            .catch(console.error);
        }
      });
    },
    [effectiveDate, effectiveSupervisorId]
  );

  // ── 6. Submit Day ──────────────────────────────────────────────────────────

  const submitDay = useCallback(
    async (supId: string, dt: string) => {
      // Validate that all checked-in workers have check-out time recorded
      const missingCheckout = Object.values(entries).filter((e) => e.inTime && !e.outTime);
      if (missingCheckout.length > 0) {
        alert('Cannot submit day: All checked-in workers must have their check-out time recorded before submission.');
        return;
      }

      setSubmitStatus('submitting');
      try {
        const res = await submitDayService({ supervisorId: supId, date: dt });
        setSubmitStatus('submitted');
        setSubmittedInfo({
          supervisorName: res.supervisor?.fullName || user?.fullName || 'Supervisor',
          username: res.supervisor?.username || user?.username || '',
          submittedAt: res.submittedAt || new Date().toISOString(),
        });
        setEntries((prev) => {
          const next = { ...prev };
          Object.keys(next).forEach((id) => {
            if (next[id]) next[id] = { ...next[id], saved: true };
          });
          return next;
        });
      } catch (err) {
        console.error('submitDay failed', err);
        setSubmitStatus('error');
      }
    },
    [user]
  );

  const checkedInCount = employeeIds.filter((id) => entries[id]?.inTime != null).length;
  const assignedCount = employeeIds.length;

  return {
    entries,
    submitStatus,
    submittedInfo,
    isLoadingEntries,
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
