import { CheckCircle2 } from 'lucide-react';
import type { AssignedEmployee } from '../services/timeEntryService';

interface CheckInRowProps {
  employee: AssignedEmployee;
  checkedIn: boolean;
  checkInTime: string | null; // "HH:mm"
  onCheckIn: (employeeId: string) => void;
}

/**
 * CheckInRow — one row per assigned employee on the Check-in screen.
 *
 * Not checked-in: full-width tappable button "Tap to mark in" (44px min height).
 * Checked-in: success green row showing checkmark + time. Not tappable again.
 */
export function CheckInRow({
  employee,
  checkedIn,
  checkInTime,
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
        <time
          dateTime={checkInTime}
          className="text-sm font-medium text-green-700 tabular-nums flex-shrink-0"
        >
          {checkInTime}
        </time>
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
