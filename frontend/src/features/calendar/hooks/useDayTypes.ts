/**
 * useDayTypes.ts — Hook providing access to the fixed day types list.
 */
import { useState, useEffect } from 'react';
import type { DayType } from '../services/calendarService';
import { getDayTypes } from '../services/calendarService';

export function useDayTypes() {
  const [dayTypes, setDayTypes] = useState<DayType[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getDayTypes().then((types) => {
      setDayTypes(types);
      setIsLoading(false);
    });
  }, []);

  return { dayTypes, isLoading };
}
