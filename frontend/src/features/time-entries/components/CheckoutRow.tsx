import { AlertTriangle } from 'lucide-react';
import type { AssignedEmployee } from '../services/timeEntryService';

interface CheckoutRowProps {
  employee: AssignedEmployee;
  checkInTime: string | null;   // "HH:mm" or null if never checked in
  outTime: string | null;       // "HH:mm" or null
  onOutTimeChange: (employeeId: string, outTime: string) => void;
  submitted: boolean;           // locks all inputs after day submit
}

/** Parse "HH:mm" → total minutes */
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

/** Format decimal hours → "Xh Ym" */
function formatHours(decHours: number): string {
  const h = Math.floor(decHours);
  const m = Math.round((decHours - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * CheckoutRow — one row per employee on the Checkout screen.
 *
 * Has three states:
 *  1. No check-in recorded → warning row (non-blocking)
 *  2. Normal: shows in-time + time input for out-time + live hours
 *  3. Submitted: all locked / read-only
 */
export function CheckoutRow({
  employee,
  checkInTime,
  outTime,
  onOutTimeChange,
  submitted,
}: CheckoutRowProps) {
  const inputId = `checkout-out-${employee.id}`;

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

  // ── Live hours calculation ─────────────────────────────────────────────────
  let liveHours: string | null = null;
  if (outTime) {
    const inMins  = toMinutes(checkInTime);
    const outMins = toMinutes(outTime);
    const diff    = outMins - inMins;
    liveHours = diff > 0 ? formatHours(diff / 60) : null;
  }

  // ── Normal / submitted row ─────────────────────────────────────────────────
  return (
    <div className="px-4 py-3 rounded-lg bg-white border border-slate-200">
      {/* Employee name + trade */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-medium text-slate-800 leading-tight">
            {employee.callingName}
          </p>
          <p className="text-xs text-slate-500">{employee.tradeGroup}</p>
        </div>
        {liveHours && (
          <span className="text-sm font-medium text-blue-700 tabular-nums flex-shrink-0">
            {liveHours}
          </span>
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
            disabled={submitted}
            onChange={(e) => onOutTimeChange(employee.id, e.target.value)}
            className={[
              'flex-1 text-sm font-medium text-slate-800 tabular-nums bg-transparent',
              'border-none outline-none focus:ring-0',
              'min-h-[32px]', // adequate touch height within the row
              submitted ? 'opacity-60 cursor-not-allowed' : '',
            ].join(' ')}
            aria-label={`Out time for ${employee.callingName}`}
          />
        </div>
      </div>
    </div>
  );
}
