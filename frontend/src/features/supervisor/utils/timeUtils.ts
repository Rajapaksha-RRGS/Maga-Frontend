/**
 * timeUtils.ts
 *
 * Dedicated time arithmetic and conversion utilities for Mäga ERP compliance.
 *
 * Rule:
 * In Mäga construction ERP (IFS/SAP), work hours and overtime are entered and
 * processed in Decimal Hours (where 0.50 = 30 minutes, 0.25 = 15 minutes):
 *   - 13 hours 30 minutes -> 13.50
 *   - 8 hours 30 minutes  -> 8.50
 *   - 14 hours 00 minutes -> 14.00
 *   - 6 hours 00 minutes  -> 6.00
 *
 * Live clock calculations convert between standard HH:mm 24h clock strings
 * and ERP decimal hours with accurate rounding to 2 decimal places.
 */

/**
 * Converts decimal hours into total minutes.
 * Examples:
 *   13.50 -> 13.5 * 60 = 810 minutes
 *   0.50  -> 0.5 * 60 = 30 minutes
 *   8.00  -> 8 * 60 = 480 minutes
 */
export function hhmmToMinutes(val: number | string | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return 0;
  return Math.round(num * 60);
}

/**
 * Converts total minutes into decimal hours (rounded to 2 decimal places).
 * Examples:
 *   810 minutes -> 13.50 (13.5)
 *   30 minutes  -> 0.50 (0.5)
 *   480 minutes -> 8.00 (8.0)
 */
export function minutesToHhmm(minutes: number): number {
  if (isNaN(minutes) || minutes === 0) return 0;
  return Math.round((minutes / 60) * 100) / 100;
}

/**
 * Formats a decimal hours number or string into a guaranteed 2-decimal string.
 * Examples:
 *   13.5 -> "13.50"
 *   8    -> "8.00"
 *   0.5  -> "0.50"
 *   0    -> "0.00"
 */
export function formatHhmm(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0.00';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return '0.00';
  return num.toFixed(2);
}

/**
 * Formats decimal hours with an optional clock text explanation for the UI.
 * e.g. 13.50 -> "13.50h (13h 30m)"
 * e.g. 14.00 -> "14.00h"
 * e.g. 0.50  -> "0.50h (30m)"
 */
export function formatHourWithClockText(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0.00h';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num === 0) return '0.00h';

  const formatted = num.toFixed(2);
  const totalMins = Math.round(num * 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;

  if (m === 0) {
    return `${formatted}h`;
  }
  if (h === 0) {
    return `${formatted}h (${m}m)`;
  }
  return `${formatted}h (${h}h ${m}m)`;
}

/**
 * Subtracts two decimal hour values.
 * e.g., subHhmm(14.00, 13.50) = 0.50
 * e.g., subHhmm(14.00, 8.00) = 6.00
 */
export function subHhmm(a: number | string, b: number | string): number {
  const diff = Number(a || 0) - Number(b || 0);
  return Math.round(diff * 100) / 100;
}

/**
 * Adds two decimal hour values.
 * e.g., addHhmm(13.50, 0.50) = 14.00
 * e.g., addHhmm(8.00, 6.00) = 14.00
 */
export function addHhmm(a: number | string, b: number | string): number {
  const sum = Number(a || 0) + Number(b || 0);
  return Math.round(sum * 100) / 100;
}

/**
 * Sums an array of decimal hour numbers or strings.
 * e.g., sumHhmm([13.50, 0.50]) = 14.00
 */
export function sumHhmm(values: (number | string)[]): number {
  const total = values.reduce((sum: number, v) => sum + Number(v || 0), 0);
  return Math.round(total * 100) / 100;
}

export interface SiteMealPolicyConfig {
  lunchBreakEnabled?: boolean;
  lunchStartTime?: string;
  lunchEndTime?: string;
  lunchDuration?: number;
  dinnerBreakEnabled?: boolean;
  dinnerStartTime?: string;
  dinnerEndTime?: string;
  dinnerDuration?: number;
}

export function computeBreakMinutes(
  inMins: number,
  outMins: number,
  policy?: SiteMealPolicyConfig
): { breakMinutes: number; isLunchDeducted: boolean; isDinnerDeducted: boolean } {
  const lunchEnabled = policy?.lunchBreakEnabled ?? true;
  const dinnerEnabled = policy?.dinnerBreakEnabled ?? true;

  const [lStartH, lStartM] = (policy?.lunchStartTime || '12:00').split(':').map(Number);
  const [lEndH, lEndM] = (policy?.lunchEndTime || '13:00').split(':').map(Number);
  const lunchStart = (lStartH || 12) * 60 + (lStartM || 0);
  const lunchEnd = (lEndH || 13) * 60 + (lEndM || 0);
  const lunchDurationMins = Math.round((policy?.lunchDuration ?? 1.0) * 60);

  const [dStartH, dStartM] = (policy?.dinnerStartTime || '22:00').split(':').map(Number);
  const [dEndH, dEndM] = (policy?.dinnerEndTime || '23:00').split(':').map(Number);
  const dinnerStart = (dStartH || 22) * 60 + (dStartM || 0);
  const dinnerEnd = (dEndH || 23) * 60 + (dEndM || 0);
  const dinnerDurationMins = Math.round((policy?.dinnerDuration ?? 1.0) * 60);

  const calcOverlap = (wStart: number, wEnd: number): number => {
    if (outMins > inMins) {
      return Math.max(0, Math.min(outMins, wEnd) - Math.max(inMins, wStart));
    } else {
      const seg1 = Math.max(0, Math.min(1440, wEnd) - Math.max(inMins, wStart));
      const seg2 = Math.max(0, Math.min(outMins, wEnd) - Math.max(0, wStart));
      return seg1 + seg2;
    }
  };

  let isLunchDeducted = false;
  let isDinnerDeducted = false;
  let totalBreakMins = 0;

  if (lunchEnabled) {
    const overlap = calcOverlap(lunchStart, lunchEnd);
    if (overlap > 0) {
      isLunchDeducted = true;
      totalBreakMins += lunchDurationMins;
    }
  }

  if (dinnerEnabled) {
    const overlap = calcOverlap(dinnerStart, dinnerEnd);
    if (overlap > 0) {
      isDinnerDeducted = true;
      totalBreakMins += dinnerDurationMins;
    }
  }

  return { breakMinutes: totalBreakMins, isLunchDeducted, isDinnerDeducted };
}

/**
 * Computes shift and OT hours between two "HH:MM" 24h clock strings according to site rules:
 * 1. Lunch break window: Deducted if shift spans the site lunch window (default: 12:00 - 13:00).
 * 2. Dinner break window: Deducted if shift spans the site dinner window (default: 22:00 - 23:00).
 * Standard shift cap is 8.00 hours (or 5.5h on Saturday, 0.0h on Sunday). Any remaining time is OT.
 */
export function computeHours(
  inTime: string,
  outTime: string,
  dateStr?: string,
  mealPolicy?: SiteMealPolicyConfig,
  additionalHours: number = 0
): {
  shift: number;
  ot: number;
  breakHours: number;
  isLunchDeducted: boolean;
  isDinnerDeducted: boolean;
  additionalHours: number;
} {
  if (!inTime || !outTime) {
    return { shift: 0, ot: 0, breakHours: 0, isLunchDeducted: false, isDinnerDeducted: false, additionalHours: 0 };
  }
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  if (isNaN(inH) || isNaN(outH)) {
    return { shift: 0, ot: 0, breakHours: 0, isLunchDeducted: false, isDinnerDeducted: false, additionalHours: 0 };
  }

  const inMins = inH * 60 + (inM || 0);
  const outMins = outH * 60 + (outM || 0);

  let grossMinutes = outMins - inMins;
  if (grossMinutes <= 0) {
    grossMinutes += 24 * 60;
  }

  if (grossMinutes <= 0) {
    return { shift: 0, ot: 0, breakHours: 0, isLunchDeducted: false, isDinnerDeducted: false, additionalHours: 0 };
  }

  // Window-based Break Deductions
  const { breakMinutes, isLunchDeducted, isDinnerDeducted } = computeBreakMinutes(inMins, outMins, mealPolicy);
  const effectiveBreakMinutes = Math.min(breakMinutes, grossMinutes);
  const netMinutes = Math.max(0, grossMinutes - effectiveBreakMinutes);
  const rawShift = Math.round((netMinutes / 60) * 100) / 100;
  const shift = Math.max(0, Math.round((rawShift + (additionalHours || 0)) * 100) / 100);
  const breakHours = Math.round((effectiveBreakMinutes / 60) * 100) / 100;

  if (shift <= 0) {
    return {
      shift: 0,
      ot: 0,
      breakHours,
      isLunchDeducted,
      isDinnerDeducted,
      additionalHours: 0,
    };
  }
  
  let ot = 0;
  if (dateStr) {
    const d = new Date(dateStr);
    const dow = d.getUTCDay();
    if (dow === 0) {
      // Sunday: 100% OT
      ot = shift;
    } else if (dow === 6) {
      // Saturday: Base standard is 5.5 hours (+OT if > 5.5, -OT if < 5.5)
      ot = Math.round((shift - 5.5) * 100) / 100;
    } else {
      // Weekday: > 6h => Full Day (8.0h base); <= 6h => Half Day (4.0h base)
      if (shift > 6.0) {
        ot = Math.round((shift - 8.0) * 100) / 100;
      } else {
        ot = Math.round((shift - 4.0) * 100) / 100;
      }
    }
  } else {
    // Default weekday rule: base 8.0h (>6h) or 4.0h (<=6h)
    if (shift > 6.0) {
      ot = Math.round((shift - 8.0) * 100) / 100;
    } else {
      ot = Math.round((shift - 4.0) * 100) / 100;
    }
  }

  return { shift, ot, breakHours, isLunchDeducted, isDinnerDeducted, additionalHours };
}
