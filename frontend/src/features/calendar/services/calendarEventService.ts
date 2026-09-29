/**
 * calendarEventService.ts
 *
 * Manages daily events, site milestones, and reminders for Admin.
 * Persists in PostgreSQL database via /api/calendar/events with localStorage cache.
 */

import { API_URL, apiFetch } from '../../../config/api';

export interface CalendarEvent {
  id: string;
  title: string;
  time?: string;
  location?: string;
  color: 'purple' | 'amber' | 'emerald' | 'blue' | 'rose';
  notes?: string;
  createdAt: string;
}

const STORAGE_PREFIX = 'maga_calendar_events_';

export function getLocalEventsForDate(dateStr: string): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${dateStr}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Failed to load events for date:', dateStr, err);
    return [];
  }
}

export function saveLocalEventsForDate(dateStr: string, events: CalendarEvent[]): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${dateStr}`, JSON.stringify(events));
  } catch (err) {
    console.warn('Failed to save events for date:', dateStr, err);
  }
}

/**
 * Fetch events from backend PostgreSQL database for a specific date
 */
export async function fetchEventsForDate(dateStr: string): Promise<CalendarEvent[]> {
  try {
    const res = await apiFetch(`${API_URL}/calendar/events?date=${dateStr}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.events)) {
        saveLocalEventsForDate(dateStr, data.events);
        return data.events;
      }
    }
  } catch (err) {
    console.warn('Backend unavailable, using cached events for date:', dateStr, err);
  }
  return getLocalEventsForDate(dateStr);
}

/**
 * Sync events array to PostgreSQL database
 */
export async function syncEventsToDatabase(dateStr: string, events: CalendarEvent[]): Promise<boolean> {
  saveLocalEventsForDate(dateStr, events);
  try {
    const res = await apiFetch(`${API_URL}/calendar/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: dateStr, events }),
    });
    return res.ok;
  } catch (err) {
    console.warn('Failed to persist events to backend database:', err);
    return false;
  }
}

/**
 * Add event to date and persist to PostgreSQL
 */
export async function addEventToDate(
  dateStr: string,
  event: Omit<CalendarEvent, 'id' | 'createdAt'>
): Promise<CalendarEvent[]> {
  const existing = getLocalEventsForDate(dateStr);
  const newEvent: CalendarEvent = {
    ...event,
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };
  const updated = [...existing, newEvent];
  await syncEventsToDatabase(dateStr, updated);
  return updated;
}

/**
 * Delete event from date and persist to PostgreSQL
 */
export async function deleteEventFromDate(dateStr: string, eventId: string): Promise<CalendarEvent[]> {
  const existing = getLocalEventsForDate(dateStr);
  const updated = existing.filter((e) => e.id !== eventId);
  await syncEventsToDatabase(dateStr, updated);
  return updated;
}

/**
 * Returns a set of dates in the given month that have at least one event.
 */
export function getDatesWithEventsForMonth(year: number, month: number): Set<string> {
  const dates = new Set<string>();
  const prefix = `${STORAGE_PREFIX}${year}-${String(month + 1).padStart(2, '0')}`;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const dateStr = key.replace(STORAGE_PREFIX, '');
            dates.add(dateStr);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to scan dates with events:', err);
  }
  return dates;
}

/**
 * Populate local cache from backend month entries with remarks
 */
export function populateEventsFromMonthEntries(
  entries: { date: string; remarks?: string | null }[]
): void {
  entries.forEach((item) => {
    if (item.remarks) {
      try {
        const parsed = JSON.parse(item.remarks);
        if (Array.isArray(parsed)) {
          saveLocalEventsForDate(item.date, parsed);
        }
      } catch {
        // Not a JSON event list
      }
    }
  });
}
