/**
 * useCostDashboard.ts — React hook for cost dashboard data fetching & state.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchCostDashboard,
  type CostDashboardData,
  type CostDashboardFilters,
} from '../services/costDashboardService';

export interface UseCostDashboardReturn {
  data: CostDashboardData | null;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  filters: CostDashboardFilters;
  setFilters: (f: CostDashboardFilters) => void;
  refresh: () => Promise<void>;
}

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function useCostDashboard(): UseCostDashboardReturn {
  const [data, setData] = useState<CostDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<CostDashboardFilters>({ month: getCurrentMonth() });
  const mountedRef = useRef(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);
    try {
      const result = await fetchCostDashboard(filters);
      if (mountedRef.current) setData(result);
    } catch (e: any) {
      if (mountedRef.current) setError(e.message || 'Failed to load cost data');
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [filters]);

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => { mountedRef.current = false; };
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, isLoading, isRefreshing, error, filters, setFilters, refresh };
}
