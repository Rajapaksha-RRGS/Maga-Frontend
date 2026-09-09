import { AlertTriangle } from 'lucide-react';
import type { AssignedEmployee } from '../services/timeEntryService';
import type { DayType } from '../../calendar/services/calendarService';
import { calculateShiftBreakdown, formatDecimalHours } from '../../../utils/overtimeCalculator';

interface CheckoutRowProps {
  employee: AssignedEmployee;
  checkInTime: string | null;   // "HH:mm" or null if never checked in
  outTime: string | null;       // "HH:mm" or null
  date?: string;                // "YYYY-MM-DD"
  dayType?: DayType;
  onOutTimeChange: (employeeId: string, outTime: string) => void;
  submitted: boolean;           // locks all inputs after day submit
}

/**
 * CheckoutRow — one row per employee on the Checkout screen.
 *
 * Has three states:
 *  1. No check-in recorded → warning row (non-blocking)
 *  2. Normal: shows in-time + time input for out-time + live hours + OT breakdown according to site calendar rules
 *  3. Submitted: all locked / read-only
 */
export function CheckoutRow({
  employee,
  checkInTime,
  outTime,
  date,
  dayType,
  onOutTimeChange,
  submitted,
}: CheckoutRowProps) {
  const inputId = `checkout-out-${employee.id}`;
  const effectiveDate = date || new Date().toISOString().split('T')[0];

  // ── Warning row — no check-in ──────────────────────────────────────────────
  if (!checkInTime) {
    return (
      <div
        role="alert"
        className="flex items-start gap-3 px-4 py-3 rounded-lg bg-amber-50 border border-amber-200"
      >
        <AlertTriangle
          size={20}
          className="text-amber-500 flex-shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 leading-tight">
            {employee.callingName}
          </p>
          <p className="text-xs text-amber-700 mt-0.5">No check-in recorded</p>
        </div>
      </div>
    );
  }

  // ── Live hours & Overtime calculation using Site Rules ────────────────────
  const breakdown = outTime ? calculateShiftBreakdown(effectiveDate, checkInTime, outTime, dayType?.name) : null;

  return (
    <div className="px-4 py-3 rounded-lg bg-white border border-slate-200">
      {/* Employee name + trade + hours badge */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium text-slate-800 leading-tight">
            {employee.callingName}
          </p>
          <p className="text-xs text-slate-500">{employee.tradeGroup}</p>
        </div>

        {/* Live Hours & OT Badge */}
        {breakdown && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {breakdown.isAllOvertime ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200">
                {formatDecimalHours(breakdown.totalHours)} (Full OT)
              </span>
            ) : breakdown.overtimeHours > 0 ? (
              <div className="flex items-center gap-1 text-xs">
                <span className="font-medium text-slate-700">
                  {formatDecimalHours(breakdown.normalHours)} normal
                </span>
                <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                  +{formatDecimalHours(breakdown.overtimeHours)} OT
                </span>
              </div>
            ) : (
              <span className="text-sm font-medium text-blue-700 tabular-nums">
                {formatDecimalHours(breakdown.totalHours)}
              </span>
            )}
          </div>
        )}
      </div>

      {/* In / Out time row */}
      <div className="flex items-center gap-3">
        {/* In time (read-only display) */}
        <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded px-2.5 py-1.5">
          <span className="text-xs text-slate-500">In</span>
          <time
            dateTime={checkInTime}
            className="text-sm font-medium text-slate-800 tabular-nums"
          >
            {checkInTime}
          </time>
        </div>

        <span className="text-slate-300" aria-hidden="true">→</span>

        {/* Out time input */}
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2.5 py-1.5 flex-1">
          <label htmlFor={inputId} className="text-xs text-slate-500">
            Out
          </label>
          <input
            id={inputId}
            type="time"
            value={outTime ?? ''}
            onChange={(e) => onOutTimeChange(employee.id, e.target.value)}
            disabled={submitted}
            className={[
              'w-full bg-transparent text-sm font-medium text-slate-800 tabular-nums outline-none',
              'focus-visible:ring-1 focus-visible:ring-blue-600 rounded',
              submitted ? 'text-slate-400 cursor-not-allowed' : '',
            ].join(' ')}
            aria-label={`Check-out time for ${employee.callingName}`}
          />
        </div>
      </div>
    </div>
  );
}
