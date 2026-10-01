/**
 * dateUtils.ts
 *
 * Safe date utilities that work with local browser time and avoid UTC-offset drift
 * caused by .toISOString().split('T')[0].
 */

/**
 * Returns today's date formatted as YYYY-MM-DD in the user's local timezone.
 */
export function getTodayLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format any Date instance into YYYY-MM-DD in the user's local timezone.
 */
export function formatLocalDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Safely parse a 'YYYY-MM-DD' string into a local Date instance without UTC shift.
 */
export function parseLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length < 3) return new Date(dateStr);
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  return new Date(year, month, day);
}

/**
 * Format a 'YYYY-MM-DD' date string into a user-friendly display (e.g. 'Thu, 2 Oct 2026')
 */
export function formatDisplayDate(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  const dateObj = parseLocalDate(dateStr);
  return dateObj.toLocaleDateString('en-GB', options || {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
