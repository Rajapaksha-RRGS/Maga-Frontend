/**
 * useCalendar.ts — Month navigation, fixed day type assignment, optimistic updates.
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
  const [dayTypes, setDayTypes] = useState<DayType[]>(() => {
    const cached = cacheManager.get<DayType[]>('calendar:day-types');
    return cached ? svc.normalizeDayTypes(cached) : svc.normalizeDayTypes([...svc.FIXED_DAY_TYPES]);
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !cacheManager.get(monthKey) || !cacheManager.get('calendar:day-types'));
  const [isUpdating, setIsUpdating] = useState<boolean>(false);

  const load = useCallback(async (showLoading = false) => {
    const currentMonthKey = `calendar:month:${year}:${month}`;
    const cachedEntries = cacheManager.get<CalendarEntry[]>(currentMonthKey);
    const cachedDayTypes = cacheManager.get<DayType[]>('calendar:day-types');

    if (showLoading || (!cachedEntries && !cachedDayTypes)) {
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

  useEffect(() => {
    load();
  }, [load]);

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  /**
   * Optimistic update: changes date in local state immediately without full-page reload
   */
  const setDayTypeForDate = async (date: string, dayTypeId: string) => {
    setIsUpdating(true);
    const previousEntries = [...entries];

    // Optimistically update entries
    setEntries((prev) => {
      const exists = prev.some((e) => e.date === date);
      if (exists) {
        return prev.map((e) => (e.date === date ? { ...e, dayTypeId } : e));
      }
      return [...prev, { date, dayTypeId }];
    });

    try {
      const res = await svc.setCalendarDayType(date, dayTypeId);
      return res;
    } catch (err) {
      // Revert if API call fails
      setEntries(previousEntries);
      throw err;
    } finally {
      setIsUpdating(false);
    }
  };

  const markAllSundays = async () => {
    await svc.bulkMarkSundays(year, month);
    await load(false);
  };

  const markAllSaturdays = async () => {
    await svc.bulkMarkSaturdays(year, month);
    await load(false);
  };

  /**
   * Retrieves effective DayType for any date:
   * 1. Returns saved DayType from entries if present
   * 2. Otherwise auto-classifies Sunday or Saturday by default without manual user action
   */
  const getDayTypeForDate = (date: string): DayType | undefined => {
    const entry = entries.find((e) => e.date === date);
    if (entry) {
      const found = dayTypes.find((dt) => dt.id === entry.dayTypeId);
      if (found) return found;
    }

    // Auto-detect weekend without requiring manual intervention
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dow = dateObj.getDay(); // 0 = Sunday, 6 = Saturday

    if (dow === 0) {
      return (
        dayTypes.find((dt) => dt.code === 'sunday') || {
          id: 'dt-sunday',
          name: 'Sunday',
          code: 'sunday',
          rateMultiplier: 1.5,
        }
      );
    }

    if (dow === 6) {
      return (
        dayTypes.find((dt) => dt.code === 'saturday') || {
          id: 'dt-saturday',
          name: 'Saturday',
          code: 'saturday',
          rateMultiplier: 1.0,
        }
      );
    }

    return (
      dayTypes.find((dt) => dt.code === 'normal') || {
        id: 'dt-normal',
        name: 'Normal Day',
        code: 'normal',
        rateMultiplier: 1.0,
      }
    );
  };

  return {
    year,
    month,
    entries,
    dayTypes,
    isLoading,
    isUpdating,
    prevMonth,
    nextMonth,
    setDayTypeForDate,
    markAllSundays,
    markAllSaturdays,
    getDayTypeForDate,
    refresh: load,
  };
}
