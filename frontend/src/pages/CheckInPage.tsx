import { ArrowLeft, Home, Lock } from 'lucide-react';
import { StepIndicator, type StepKey } from '../features/time-entries/components/StepIndicator';
import { CheckInRow }     from '../features/time-entries/components/CheckInRow';
import type { AssignedEmployee }    from '../features/time-entries/services/timeEntryService';
import type { EmployeeEntryState, SubmitStatus, SubmittedInfo }  from '../features/time-entries/hooks/useTimeEntry';

interface CheckInPageProps {
  employees: AssignedEmployee[];
  entries: Record<string, EmployeeEntryState>;
  submitStatus?: SubmitStatus;
  submittedInfo?: SubmittedInfo | null;
  onCheckIn: (employeeId: string) => void;
  onBack: () => void;
  onNext: () => void;
  onGoDashboard?: () => void;
  onStepClick?: (step: StepKey) => void;
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
  submitStatus = 'idle',
  submittedInfo,
  onCheckIn,
  onBack,
  onNext,
  onGoDashboard,
  onStepClick,
}: CheckInPageProps) {
  const isSubmitted = submitStatus === 'submitted';
  const checkedInCount = employees.filter((e) => entries[e.id]?.inTime !== null).length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="flex flex-col flex-1 w-full max-w-lg mx-auto">

        {/* ── Top bar (Mobile-optimized) ────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 px-4 pt-3.5 pb-3 sticky top-0 z-20 shadow-xs">
          <div className="flex items-center justify-between gap-3 mb-3">
            {/* Dual navigation icon buttons */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <button
                type="button"
                onClick={onBack}
                className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600"
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </button>

              {onGoDashboard && (
                <button
                  type="button"
                  onClick={onGoDashboard}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100 transition-colors shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600"
                  title="Dashboard"
                  aria-label="Return to Dashboard"
                >
                  <Home size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Page title with worker count */}
            <div className="min-w-0 flex-1 text-right sm:text-left">
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 leading-tight truncate">
                Daily Check-in
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                {checkedInCount} of {employees.length} workers recorded
              </p>
            </div>
          </div>
          <StepIndicator currentStep="checkin" onStepClick={onStepClick} />
        </header>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-32 space-y-3">
          {/* Submitted lock alert banner */}
          {isSubmitted && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 shadow-xs">
              <Lock size={18} className="text-emerald-700 flex-shrink-0 mt-0.5" />
              <div className="min-w-0 text-xs">
                <p className="font-semibold text-emerald-950">Daily Attendance Locked</p>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  Day records have been submitted and locked. New check-ins and edits are disabled.
                </p>
                {submittedInfo?.supervisorName && (
                  <p className="text-emerald-700 text-[11px] mt-1 font-medium">
                    Submitted by {submittedInfo.supervisorName}
                    {submittedInfo.username ? ` (@${submittedInfo.username})` : ''}
                  </p>
                )}
              </div>
            </div>
          )}

          {!isSubmitted && (
            <p className="text-xs sm:text-sm text-slate-600">
              Tap a worker's card when they arrive on site to log their check-in time.
            </p>
          )}

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
                      isLocked={isSubmitted}
                      onCheckIn={onCheckIn}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </main>

        {/* ── Bottom action — sticky inside the column ──────────────────────── */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 sticky bottom-0 z-10 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500">
              {checkedInCount} of {employees.length} checked in
            </span>
            {isSubmitted && (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                <Lock size={10} /> Locked
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onNext}
            className={[
              'w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl font-medium text-sm min-h-[48px] transition-all shadow-xs',
              isSubmitted
                ? 'bg-slate-800 hover:bg-slate-900 text-white'
                : 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
            ].join(' ')}
          >
            {isSubmitted ? 'View Checkout Records →' : 'Next: Check-out →'}
          </button>
        </div>

      </div>
    </div>
  );
}
