import { useState, useEffect, useCallback } from 'react';
import {
  getAssignedEmployees,
  type AssignedEmployee,
} from '../services/timeEntryService';

interface UseAssignedEmployeesReturn {
  employees: AssignedEmployee[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Fetches employees assigned to the given supervisor for the given date.
 * Wraps timeEntryService.getAssignedEmployees with loading / error state.
 */
export function useAssignedEmployees(
  supervisorId: string,
  date: string
): UseAssignedEmployeesReturn {
  const [employees, setEmployees] = useState<AssignedEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!supervisorId || !date) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getAssignedEmployees(supervisorId, date)
      .then((data) => {
        if (!cancelled) {
          setEmployees(data);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load employees'
          );
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [supervisorId, date, tick]);

  return { employees, loading, error, refetch };
}
