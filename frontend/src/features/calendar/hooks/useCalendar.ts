/**
 * useCalendar.ts — Month navigation, fixed day type assignment, bulk marking.
 */
import { useState, useEffect, useCallback } from 'react';
import type { CalendarEntry, DayType } from '../services/calendarService';
import * as svc from '../services/calendarService';
import { cacheManager } from '../../../utils/cacheManager';

export function useCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const monthKey = `calendar:month:${year}:${month}`;
  const [entries, setEntries] = useState<CalendarEntry[]>(() => cacheManager.get<CalendarEntry[]>(monthKey) || []);
  const [dayTypes, setDayTypes] = useState<DayType[]>(() => cacheManager.get<DayType[]>('calendar:day-types') || []);
  const [isLoading, setIsLoading] = useState<boolean>(() => !cacheManager.get(monthKey) || !cacheManager.get('calendar:day-types'));

  const load = useCallback(async (forceRefresh = false) => {
    const currentMonthKey = `calendar:month:${year}:${month}`;
    if (forceRefresh || !cacheManager.get(currentMonthKey) || !cacheManager.get('calendar:day-types')) {
      setIsLoading(true);
    }
    try {
      const [e, dt] = await Promise.all([
        svc.getCalendarMonth(year, month),
        svc.getDayTypes(),
      ]);
      setEntries(e);
      setDayTypes(dt);
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => { load(); }, [load]);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };

  const setDayTypeForDate = async (date: string, dayTypeId: string) => {
    await svc.setCalendarDayType(date, dayTypeId);
    await load();
  };

  const markAllSundays = async () => {
    await svc.bulkMarkSundays(year, month);
    await load();
  };

  const markAllSaturdays = async () => {
    await svc.bulkMarkSaturdays(year, month);
    await load();
  };

  const getDayTypeForDate = (date: string): DayType | undefined => {
    const entry = entries.find((e) => e.date === date);
    if (!entry) return undefined;
    return dayTypes.find((dt) => dt.id === entry.dayTypeId);
  };

  return {
    year, month, entries, dayTypes, isLoading,
    prevMonth, nextMonth,
    setDayTypeForDate, markAllSundays, markAllSaturdays, getDayTypeForDate,
    refresh: load,
  };
}
