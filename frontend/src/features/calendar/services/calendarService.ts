/**
 * calendarService.ts
 *
 * Mock service for calendar and day types.
 *
 * TODO: Replace with real API calls:
 *   getDayTypes()            → GET    /api/day-types
 *   createDayType(data)      → POST   /api/day-types
 *   updateDayType(id, data)  → PUT    /api/day-types/:id
 *   deleteDayType(id)        → DELETE /api/day-types/:id
 *   getCalendarMonth(y, m)   → GET    /api/calendar?year=Y&month=M
 *   setDayType(date, typeId) → PUT    /api/calendar/:date
 *   bulkSetSundays(y, m)     → POST   /api/calendar/bulk-sundays
 */

export interface DayType {
  id: string;
  name: string;
  rateMultiplier: number;
}

export type DayTypeFormData = Omit<DayType, 'id'>;

export interface CalendarEntry {
  date: string; // YYYY-MM-DD
  dayTypeId: string;
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
let nextDayTypeId = 5;

const DAY_TYPES: DayType[] = [
  { id: 'dt-001', name: 'Normal day',     rateMultiplier: 1.0 },
  { id: 'dt-002', name: 'Sunday',         rateMultiplier: 1.5 },
  { id: 'dt-003', name: 'Poya',           rateMultiplier: 1.5 },
  { id: 'dt-004', name: 'Public holiday', rateMultiplier: 2.0 },
];

// Calendar entries keyed by date string
const CALENDAR: Map<string, string> = new Map(); // date → dayTypeId

// Pre-populate: mark all Sundays in current month
function initCurrentMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = formatDate(date);
    if (date.getDay() === 0) {
      CALENDAR.set(key, 'dt-002'); // Sunday
    } else {
      CALENDAR.set(key, 'dt-001'); // Normal day
    }
  }
}

function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

initCurrentMonth();

// ── Day type CRUD ─────────────────────────────────────────────────────────────

export async function getDayTypes(): Promise<DayType[]> {
  await delay(200);
  return [...DAY_TYPES];
}

export async function createDayType(data: DayTypeFormData): Promise<DayType> {
  await delay(300);
  const dt: DayType = { id: `dt-${String(nextDayTypeId++).padStart(3, '0')}`, ...data };
  DAY_TYPES.push(dt);
  return dt;
}

export async function updateDayType(id: string, data: Partial<DayTypeFormData>): Promise<DayType> {
  await delay(300);
  const idx = DAY_TYPES.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Day type not found');
  DAY_TYPES[idx] = { ...DAY_TYPES[idx], ...data };
  return DAY_TYPES[idx];
}

export async function deleteDayType(id: string): Promise<void> {
  await delay(300);
  const idx = DAY_TYPES.findIndex((d) => d.id === id);
  if (idx === -1) throw new Error('Day type not found');
  DAY_TYPES.splice(idx, 1);
}

// ── Calendar entries ──────────────────────────────────────────────────────────

export async function getCalendarMonth(year: number, month: number): Promise<CalendarEntry[]> {
  await delay(200);
  const entries: CalendarEntry[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const key = formatDate(date);
    entries.push({
      date: key,
      dayTypeId: CALENDAR.get(key) ?? 'dt-001',
    });
  }
  return entries;
}

export async function setCalendarDayType(date: string, dayTypeId: string): Promise<void> {
  await delay(100);
  CALENDAR.set(date, dayTypeId);
}

export async function bulkMarkSundays(year: number, month: number): Promise<number> {
  await delay(300);
  let count = 0;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    if (date.getDay() === 0) {
      CALENDAR.set(formatDate(date), 'dt-002');
      count++;
    }
  }
  return count;
}
