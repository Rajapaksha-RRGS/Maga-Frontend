import { CheckCircle2, Lock } from 'lucide-react';
import type { AssignedEmployee } from '../services/timeEntryService';

interface CheckInRowProps {
  employee: AssignedEmployee;
  checkedIn: boolean;
  checkInTime: string | null; // "HH:mm"
  isLocked?: boolean;
  onCheckIn: (employeeId: string) => void;
}

/**
 * CheckInRow — one row per assigned employee on the Check-in screen.
 *
 * Not checked-in: full-width tappable button "Tap to mark in" (44px min height).
 * Checked-in: success green row showing checkmark + time. Not tappable again.
 * Locked (after day submit): all interactions disabled. Unchecked workers marked as locked absent.
 */
export function CheckInRow({
  employee,
  checkedIn,
  checkInTime,
  isLocked = false,
  onCheckIn,
}: CheckInRowProps) {
  if (checkedIn && checkInTime) {
    return (
      <div
        role="status"
        aria-label={`${employee.callingName} checked in at ${checkInTime}`}
        className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200"
      >
        <CheckCircle2
          size={22}
          className="text-green-600 flex-shrink-0"
          aria-hidden="true"
        />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-800 leading-tight">
            {employee.callingName}
          </p>
          <p className="text-xs text-slate-500 truncate">{employee.tradeGroup}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <time
            dateTime={checkInTime}
            className="text-sm font-medium text-green-700 tabular-nums"
          >
            {checkInTime}
          </time>
          {isLocked && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              <Lock size={11} aria-hidden="true" />
              Locked
            </span>
          )}
        </div>
      </div>
    );
  }

  // If the day is submitted & locked, unchecked employees are locked as absent
  if (isLocked) {
    return (
      <div
        role="status"
        aria-label={`${employee.callingName} was not checked in (locked)`}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-100/70 border border-slate-200 text-left min-h-[56px] opacity-80 select-none"
      >
        <div className="w-9 h-9 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-medium text-slate-500" aria-hidden="true">
            {employee.callingName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-slate-600 leading-tight">
            {employee.callingName}
          </p>
          <p className="text-xs text-slate-400 truncate">{employee.tradeGroup}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-white border border-slate-200 px-2.5 py-1 rounded-md flex-shrink-0">
          <Lock size={12} className="text-slate-400" aria-hidden="true" />
          Not Checked In (Locked)
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCheckIn(employee.id)}
      className={[
        'w-full flex items-center gap-3 px-4 py-3 rounded-lg',
        'bg-white border border-slate-200 text-left',
        'min-h-[56px]', // generous touch target
        'hover:bg-slate-50 active:bg-slate-100',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
        'transition-colors',
      ].join(' ')}
      aria-label={`Mark ${employee.callingName} as checked in`}
    >
      <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-medium text-slate-600" aria-hidden="true">
          {employee.callingName.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 leading-tight">
          {employee.callingName}
        </p>
        <p className="text-xs text-slate-500 truncate">{employee.tradeGroup}</p>
      </div>
      <span className="text-sm font-medium text-blue-700 flex-shrink-0">
        Tap to mark in
      </span>
    </button>
  );
}
