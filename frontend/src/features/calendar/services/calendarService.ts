/**
 * calendarService.ts
 *
 * Real API service for calendar day types and monthly schedule entries connected to backend PostgreSQL,
 * with fallback to mock data when backend is offline.
 *
 * Backend endpoints:
 *   GET  /api/calendar/day-types
 *   GET  /api/calendar?year=&month=
 *   POST /api/calendar/set-day
 *   POST /api/calendar/batch-set
 */

export interface DayType {
  id: string;
  name: string;
  code: 'normal' | 'saturday' | 'sunday' | 'shutdown' | 'public_holiday';
  rateMultiplier?: number;
}

export interface CalendarEntry {
  date: string; // YYYY-MM-DD
  dayTypeId: string;
}

import { API_URL } from '../../../config/api';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const FIXED_DAY_TYPES: DayType[] = [
  { id: 'dt-normal',   name: 'Normal day',     code: 'normal',   rateMultiplier: 1.0 },
  { id: 'dt-saturday', name: 'Saturday',       code: 'saturday', rateMultiplier: 1.0 },
  { id: 'dt-sunday',   name: 'Sunday',         code: 'sunday',   rateMultiplier: 1.5 },
  { id: 'dt-shutdown', name: 'Shutdown',       code: 'shutdown', rateMultiplier: 1.0 },
  { id: 'dt-holiday',  name: 'Public Holiday', code: 'public_holiday', rateMultiplier: 2.0 },
];

// In-memory fallback calendar entries keyed by date string
const CALENDAR: Map<string, string> = new Map(); // date → dayTypeId

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Pre-populate default days in current month
function initCalendarForMonth(year: number, month: number) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = formatDate(date);
    if (!CALENDAR.has(key)) {
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0) {
        CALENDAR.set(key, 'dt-sunday');
      } else if (dayOfWeek === 6) {
        CALENDAR.set(key, 'dt-saturday');
      } else {
        CALENDAR.set(key, 'dt-normal');
      }
    }
  }
}

const now = new Date();
initCalendarForMonth(now.getFullYear(), now.getMonth());

// ── 1. Day types ─────────────────────────────────────────────────────────────

export async function getDayTypes(): Promise<DayType[]> {
  try {
    const res = await fetch(`${API_URL}/calendar/day-types`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using mock day types:', err);
  }

  await delay(100);
  return [...FIXED_DAY_TYPES];
}

// ── 2. Calendar entries ──────────────────────────────────────────────────────

export async function getCalendarMonth(year: number, month: number): Promise<CalendarEntry[]> {
  try {
    const res = await fetch(`${API_URL}/calendar?year=${year}&month=${month}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using mock calendar month:', err);
  }

  await delay(150);
  initCalendarForMonth(year, month);
  const entries: CalendarEntry[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = formatDate(date);
    entries.push({
      date: key,
      dayTypeId: CALENDAR.get(key) ?? (date.getDay() === 0 ? 'dt-sunday' : date.getDay() === 6 ? 'dt-saturday' : 'dt-normal'),
    });
  }
  return entries;
}

export async function setCalendarDayType(date: string, dayTypeId: string): Promise<void> {
  // Update local cache immediately
  CALENDAR.set(date, dayTypeId);

  try {
    await fetch(`${API_URL}/calendar/set-day`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, dayTypeId }),
    });
  } catch (err) {
    console.warn('Backend unavailable, saved calendar day locally:', err);
  }
}

export async function bulkMarkSundays(year: number, month: number): Promise<number> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entries: CalendarEntry[] = [];

  // Get Sunday dayTypeId from backend day-types if available
  const types = await getDayTypes();
  const sunType = types.find((t) => t.code === 'sunday') || { id: 'dt-sunday' };

  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 0) {
      const dateStr = formatDate(date);
      CALENDAR.set(dateStr, sunType.id);
      entries.push({ date: dateStr, dayTypeId: sunType.id });
      count++;
    }
  }

  try {
    await fetch(`${API_URL}/calendar/batch-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
  } catch (err) {
    console.warn('Backend unavailable, marked sundays locally:', err);
  }

  return count;
}

export async function bulkMarkSaturdays(year: number, month: number): Promise<number> {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const entries: CalendarEntry[] = [];

  const types = await getDayTypes();
  const satType = types.find((t) => t.code === 'saturday') || { id: 'dt-saturday' };

  let count = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 6) {
      const dateStr = formatDate(date);
      CALENDAR.set(dateStr, satType.id);
      entries.push({ date: dateStr, dayTypeId: satType.id });
      count++;
    }
  }

  try {
    await fetch(`${API_URL}/calendar/batch-set`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
  } catch (err) {
    console.warn('Backend unavailable, marked saturdays locally:', err);
  }

  return count;
}

export async function getEffectiveDayTypeForDate(dateStr: string): Promise<DayType | undefined> {
  try {
    const d = new Date(dateStr);
    const year = d.getFullYear();
    const month = d.getMonth();
    const [types, entries] = await Promise.all([
      getDayTypes(),
      getCalendarMonth(year, month),
    ]);

    const entry = entries.find((e) => e.date === dateStr);
    if (entry) {
      const found = types.find((t) => t.id === entry.dayTypeId);
      if (found) return found;
    }

    const dow = d.getDay();
    if (dow === 0) return types.find((t) => t.code === 'sunday') || types[2];
    if (dow === 6) return types.find((t) => t.code === 'saturday') || types[1];
    return types.find((t) => t.code === 'normal') || types[0];
  } catch (err) {
    console.warn('Error fetching day type for date:', err);
    return undefined;
  }
}
