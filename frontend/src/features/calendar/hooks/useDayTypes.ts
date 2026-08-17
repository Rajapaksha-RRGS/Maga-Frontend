/**
 * useDayTypes.ts — CRUD hook for day types list.
 */
import { useState, useEffect, useCallback } from 'react';
import type { DayType, DayTypeFormData } from '../services/calendarService';
import * as svc from '../services/calendarService';

export function useDayTypes() {
  const [dayTypes, setDayTypes] = useState<DayType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    try { setDayTypes(await svc.getDayTypes()); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const add = async (data: DayTypeFormData) => { await svc.createDayType(data); await load(); };
  const edit = async (id: string, data: Partial<DayTypeFormData>) => { await svc.updateDayType(id, data); await load(); };
  const remove = async (id: string) => { await svc.deleteDayType(id); await load(); };

  return { dayTypes, isLoading, add, edit, remove, refresh: load };
}
