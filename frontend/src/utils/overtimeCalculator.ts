/**
 * overtimeCalculator.ts
 *
 * Construction Site Working Hours & Overtime (OT) Engine:
 *
 * 1. Normal Day (Mon - Fri):
 *    - Standard shift: 8.0 hours.
 *    - Hours above 8.0 are credited as Overtime (OT).
 *
 * 2. Saturday (Half-Day):
 *    - Standard morning shift: 6.0 hours (up to 1:00 PM / 13:00).
 *    - Work past 13:00 or above 6.0 hours is credited as Overtime (OT).
 *
 * 3. Sunday:
 *    - Standard normal shift: 0.0 hours.
 *    - ENTIRE DAY IS OVERTIME: 100% of all hours worked are Overtime (OT).
 *
 * 4. Shutdown:
 *    - Follows Normal Day rules: 8.0 hours standard shift.
 *    - Hours above 8.0 are credited as Overtime (OT).
 *
 * 5. Public Holiday:
 *    - Standard normal shift: 0.0 hours.
 *    - ENTIRE DAY IS OVERTIME: 100% of all hours worked are Overtime (OT).
 */

export interface OvertimeBreakdown {
  totalHours: number;
  normalHours: number;
  overtimeHours: number;
  standardCap: number;
  isAllOvertime: boolean;
  dayTypeLabel: string;
}

/**
 * Determine the day type and standard hours cap for a given date.
 */
export function getDayTypeRule(
  dateStr: string,
  explicitDayType?: string
): { standardCap: number; isAllOvertime: boolean; dayTypeLabel: string } {
  // Check explicit day type override (e.g. from calendar)
  if (explicitDayType) {
    const lower = explicitDayType.toLowerCase();
    if (lower.includes('sunday')) {
      return { standardCap: 0.0, isAllOvertime: true, dayTypeLabel: 'Sunday (Full OT)' };
    }
    if (lower.includes('public holiday') || lower.includes('holiday') || lower.includes('poya')) {
      return { standardCap: 0.0, isAllOvertime: true, dayTypeLabel: 'Public Holiday (Full OT)' };
    }
    if (lower.includes('saturday')) {
      return { standardCap: 6.0, isAllOvertime: false, dayTypeLabel: 'Saturday (Half-day)' };
    }
    if (lower.includes('shutdown')) {
      return { standardCap: 8.0, isAllOvertime: false, dayTypeLabel: 'Shutdown (Normal Day Rules)' };
    }
    return { standardCap: 8.0, isAllOvertime: false, dayTypeLabel: 'Normal Day' };
  }

  // Determine from day of the week
  const d = new Date(dateStr);
  const dayOfWeek = d.getUTCDay();

  if (dayOfWeek === 0) {
    // Sunday
    return { standardCap: 0.0, isAllOvertime: true, dayTypeLabel: 'Sunday (Full OT)' };
  }
  if (dayOfWeek === 6) {
    // Saturday
    return { standardCap: 6.0, isAllOvertime: false, dayTypeLabel: 'Saturday (Half-day)' };
  }

  // Monday to Friday
  return { standardCap: 8.0, isAllOvertime: false, dayTypeLabel: 'Normal Day' };
}

/**
 * Calculate Normal vs Overtime hours for an employee on a specific date.
 */
export function calculateDailyHoursAndOT(
  dateStr: string,
  totalHours: number,
  explicitDayType?: string
): OvertimeBreakdown {
  const { standardCap, isAllOvertime, dayTypeLabel } = getDayTypeRule(dateStr, explicitDayType);

  if (isAllOvertime) {
    return {
      totalHours,
      normalHours: 0.0,
      overtimeHours: totalHours,
      standardCap,
      isAllOvertime: true,
      dayTypeLabel,
    };
  }

  const normalHours = Math.min(totalHours, standardCap);
  const overtimeHours = Math.max(0, totalHours - standardCap);

  return {
    totalHours,
    normalHours,
    overtimeHours,
    standardCap,
    isAllOvertime: false,
    dayTypeLabel,
  };
}

/**
 * Helper to parse "HH:mm" to total minutes.
 */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Format decimal hours -> "Xh Ym" or "Xh"
 */
export function formatDecimalHours(decHours: number): string {
  const h = Math.floor(decHours);
  const m = Math.round((decHours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Given check-in time and check-out time (e.g. "07:00" and "17:00"),
 * calculates live total hours, normal hours, and overtime hours according to site rules.
 */
export function calculateShiftBreakdown(
  dateStr: string,
  inTime: string,
  outTime: string,
  explicitDayType?: string
): OvertimeBreakdown | null {
  const inMins = timeToMinutes(inTime);
  const outMins = timeToMinutes(outTime);
  const diffMins = outMins - inMins;

  if (diffMins <= 0) return null;

  const totalHours = Math.round((diffMins / 60) * 100) / 100;
  return calculateDailyHoursAndOT(dateStr, totalHours, explicitDayType);
}
