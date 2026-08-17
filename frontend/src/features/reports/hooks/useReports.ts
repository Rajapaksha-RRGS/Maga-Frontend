/**
 * useReports.ts — Filter state, query execution, export trigger.
 */
import { useState, useCallback } from 'react';
import type { ReportFilters, ReportRow } from '../services/reportService';
import * as svc from '../services/reportService';

export function useReports() {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [results, setResults] = useState<ReportRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasQueried, setHasQueried] = useState(false);

  const updateFilter = (key: keyof ReportFilters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value || undefined }));
  };

  const runQuery = useCallback(async () => {
    setIsLoading(true);
    setHasQueried(true);
    try {
      const rows = await svc.query(filters);
      setResults(rows);
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  const exportExcel = async () => {
    await svc.exportExcel(filters);
  };

  // Compute totals
  const totalHours = results.reduce((sum, r) => sum + r.hours, 0);
  const totalOT = results.reduce((sum, r) => sum + r.overtimeHours, 0);

  return {
    filters, updateFilter,
    results, isLoading, hasQueried,
    totalHours, totalOT,
    runQuery, exportExcel,
  };
}
