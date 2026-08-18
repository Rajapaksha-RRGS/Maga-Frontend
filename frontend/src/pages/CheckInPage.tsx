import { ArrowLeft } from 'lucide-react';
import { StepIndicator } from '../features/time-entries/components/StepIndicator';
import { CheckInRow }     from '../features/time-entries/components/CheckInRow';
import type { AssignedEmployee }    from '../features/time-entries/services/timeEntryService';
import type { EmployeeEntryState }  from '../features/time-entries/hooks/useTimeEntry';

interface CheckInPageProps {
  employees: AssignedEmployee[];
  entries: Record<string, EmployeeEntryState>;
  onCheckIn: (employeeId: string) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * CheckInPage (step 1 of 3 in the stepper).
 * Assembles StepIndicator + CheckInRow list + primary action button.
 * No business logic — delegates everything to props from SupervisorFlowPage.
 *
 * Desktop: centered max-w-lg column; bottom action bar stays within that column.
 */
export function CheckInPage({
  employees,
  entries,
  onCheckIn,
  onBack,
  onNext,
}: CheckInPageProps) {
  const checkedInCount = employees.filter((e) => entries[e.id]?.inTime !== null).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="flex flex-col flex-1 w-full max-w-lg mx-auto">

        {/* ── Top bar ──────────────────────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 px-4 pt-5 pb-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={onBack}
              className={[
                'w-9 h-9 flex items-center justify-center rounded-md',
                'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                'transition-colors flex-shrink-0',
              ].join(' ')}
              aria-label="Back to dashboard"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <h1 className="text-base font-medium text-slate-800">Check-in</h1>
          </div>
          <StepIndicator currentStep="checkin" />
        </header>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-32 space-y-3">
          <p className="text-sm text-slate-600">
            Tap a name as each worker arrives to record their check-in time.
          </p>

          {employees.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">
              No workers assigned for today.
            </p>
          ) : (
            <ul className="space-y-2" aria-label="Employee check-in list">
              {employees.map((emp) => {
                const entry = entries[emp.id];
                return (
                  <li key={emp.id}>
                    <CheckInRow
                      employee={emp}
                      checkedIn={!!entry?.inTime}
                      checkInTime={entry?.inTime ?? null}
                      onCheckIn={onCheckIn}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </main>

        {/* ── Bottom action — sticky inside the column ──────────────────────── */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 sticky bottom-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-500">
              {checkedInCount} of {employees.length} checked in
            </span>
          </div>
          <button
            type="button"
            onClick={onNext}
            className={[
              'w-full flex items-center justify-center gap-2 px-4 py-4 rounded-lg',
              'bg-blue-700 text-white font-medium min-h-[52px]',
              'active:bg-blue-800 transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
            ].join(' ')}
          >
            Next: activity
          </button>
        </div>

      </div>
    </div>
  );
}
