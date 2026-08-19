/**
 * calendarService.ts
 *
 * Service for fixed calendar day types and monthly schedule entries.
 * Fixed Day Types: Normal Day, Saturday, Sunday, Shutdown, Poya / Holiday.
 */

export interface DayType {
  id: string;
  name: string;
  code: 'normal' | 'saturday' | 'sunday' | 'shutdown' | 'poya';
  rateMultiplier?: number;
}

export interface CalendarEntry {
  date: string; // YYYY-MM-DD
  dayTypeId: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const FIXED_DAY_TYPES: DayType[] = [
  { id: 'dt-normal',   name: 'Normal day',     code: 'normal',   rateMultiplier: 1.0 },
  { id: 'dt-saturday', name: 'Saturday',       code: 'saturday', rateMultiplier: 1.0 },
  { id: 'dt-sunday',   name: 'Sunday',         code: 'sunday',   rateMultiplier: 1.5 },
  { id: 'dt-shutdown', name: 'Shutdown',       code: 'shutdown', rateMultiplier: 1.0 },
  { id: 'dt-poya',     name: 'Poya / Holiday', code: 'poya',     rateMultiplier: 1.5 },
];

// Calendar entries keyed by date string
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

// ── Day types (Fixed list) ───────────────────────────────────────────────────

export async function getDayTypes(): Promise<DayType[]> {
  await delay(100);
  return [...FIXED_DAY_TYPES];
}

// ── Calendar entries ──────────────────────────────────────────────────────────

export async function getCalendarMonth(year: number, month: number): Promise<CalendarEntry[]> {
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
  await delay(100);
  CALENDAR.set(date, dayTypeId);
}

export async function bulkMarkSundays(year: number, month: number): Promise<number> {
  await delay(200);
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 0) {
      CALENDAR.set(formatDate(date), 'dt-sunday');
      count++;
    }
  }
  return count;
}

export async function bulkMarkSaturdays(year: number, month: number): Promise<number> {
  await delay(200);
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 6) {
      CALENDAR.set(formatDate(date), 'dt-saturday');
      count++;
    }
  }
  return count;
}
