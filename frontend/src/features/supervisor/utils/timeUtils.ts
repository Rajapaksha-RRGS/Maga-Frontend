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

/**
 * Computes shift and OT hours between two "HH:MM" 24h clock strings according to site rules:
 * 1. Standard lunch break: 1.0 hour (60 mins) deducted if gross shift >= 5.0 hours (300 mins).
 * 2. Late night / Dinner break: Additional 1.0 hour (60 mins) deducted if out-time passes or reaches 11:00 PM (23:00).
 * Standard shift cap is 8.00 hours (480 minutes). Any remaining time is OT.
 * Output is in Decimal Hours (0.50 = 30 minutes, 1.00 = 60 minutes):
 *   e.g. 06:30 to 21:30 -> gross 15h - 1h lunch = 14h -> shift: 14.00, ot: 6.00
 *   e.g. 07:00 to 17:00 -> gross 10h - 1h lunch = 9h -> shift: 9.00, ot: 1.00
 *   e.g. 07:00 to 23:00 -> gross 16h - 1h lunch - 1h night meal = 14h -> shift: 14.00, ot: 6.00
 */
export function computeHours(inTime: string, outTime: string): { shift: number; ot: number } {
  if (!inTime || !outTime) return { shift: 0, ot: 0 };
  const [inH, inM] = inTime.split(':').map(Number);
  const [outH, outM] = outTime.split(':').map(Number);

  if (isNaN(inH) || isNaN(outH)) return { shift: 0, ot: 0 };

  const inMins = inH * 60 + (inM || 0);
  const outMins = outH * 60 + (outM || 0);

  let grossMinutes = outMins - inMins;
  if (grossMinutes < 0) grossMinutes += 24 * 60; // Crosses midnight

  if (grossMinutes <= 0) return { shift: 0, ot: 0 };

  // Break Deductions:
  // 1. Standard lunch break: 1 hour if gross >= 5 hours (300 mins)
  let breakMinutes = 0;
  if (grossMinutes >= 300) {
    breakMinutes += 60;
  }

  // 2. Late night deduction: if out time passes or reaches 11:00 PM (23:00), deduct an additional 1 hour (60 mins)
  const isPast11PM = (outMins >= inMins)
    ? (outMins >= 23 * 60)
    : (inMins <= 23 * 60 || outMins >= 23 * 60);
  if (isPast11PM) {
    breakMinutes += 60;
  }

  const netMinutes = Math.max(0, grossMinutes - breakMinutes);
  if (netMinutes <= 0) return { shift: 0, ot: 0 };

  const shift = Math.round((netMinutes / 60) * 100) / 100;
  const otMinutes = netMinutes > 480 ? netMinutes - 480 : 0;
  const ot = Math.round((otMinutes / 60) * 100) / 100;

  return { shift, ot };
}
