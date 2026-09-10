import { CheckCircle2, ArrowLeft, Home } from 'lucide-react';
import { StepIndicator, type StepKey } from '../features/time-entries/components/StepIndicator';
import { CheckoutRow }   from '../features/time-entries/components/CheckoutRow';
import type { AssignedEmployee }   from '../features/time-entries/services/timeEntryService';
import type { EmployeeEntryState, SubmitStatus, SubmittedInfo } from '../features/time-entries/hooks/useTimeEntry';
import type { DayType } from '../features/calendar/services/calendarService';

interface CheckoutSubmitPageProps {
  employees: AssignedEmployee[];
  entries: Record<string, EmployeeEntryState>;
  submitStatus: SubmitStatus;
  submittedInfo?: SubmittedInfo | null;
  date?: string;
  dayType?: DayType;
  onOutTimeChange: (employeeId: string, outTime: string) => void;
  onSubmit?: () => void;
  onNext?: () => void;
  onBack: () => void;
  onGoDashboard?: () => void;
  onStepClick?: (step: StepKey) => void;
}

/**
 * CheckoutSubmitPage (step 2 of 3 in Method 1).
 * Shows one CheckoutRow per employee to enter evening out-time and preview shift hours.
 * Non-blocking: employees without a check-in show a warning row but
 * do not prevent proceeding.
 */
export function CheckoutSubmitPage({
  employees,
  entries,
  submitStatus,
  submittedInfo,
  date,
  dayType,
  onOutTimeChange,
  onSubmit,
  onNext,
  onBack,
  onGoDashboard,
  onStepClick,
}: CheckoutSubmitPageProps) {
  const submitted = submitStatus === 'submitted' || submitStatus === 'submitting';
  const isSubmitting = submitStatus === 'submitting';
  const isSubmitted  = submitStatus === 'submitted';

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
                disabled={isSubmitting}
                className={[
                  'w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600',
                  isSubmitting ? 'opacity-40 pointer-events-none' : '',
                ].join(' ')}
                title="Back"
                aria-label="Back"
              >
                <ArrowLeft size={17} aria-hidden="true" />
              </button>

              {onGoDashboard && (
                <button
                  type="button"
                  onClick={onGoDashboard}
                  disabled={isSubmitting}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-slate-200 bg-white text-slate-600 hover:text-blue-700 hover:bg-blue-50 hover:border-blue-200 active:bg-blue-100 transition-colors shadow-xs focus-visible:ring-2 focus-visible:ring-blue-600"
                  title="Dashboard"
                  aria-label="Return to Dashboard"
                >
                  <Home size={15} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* Title */}
            <div className="min-w-0 flex-1 text-right sm:text-left">
              <h1 className="text-sm sm:text-base font-semibold text-slate-900 leading-tight truncate">
                Shift Checkout
              </h1>
              <p className="text-[11px] text-slate-500 truncate">
                Record worker departure times
              </p>
            </div>
          </div>
          <StepIndicator currentStep="checkout" onStepClick={onStepClick} />
        </header>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-36 space-y-3">

          {/* Submitted banner */}
          {isSubmitted && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-start gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200"
            >
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <p className="text-sm font-medium text-green-800">
                  Day submitted successfully. Records are locked.
                </p>
                {submittedInfo?.supervisorName && (
                  <p className="text-xs text-green-700 mt-1">
                    Submitted by <strong>{submittedInfo.supervisorName}</strong>
                    {submittedInfo.username && <span> (@{submittedInfo.username})</span>}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Warning banner if checked-in workers are missing checkout */}
          {employees.some((e) => entries[e.id]?.inTime && !entries[e.id]?.outTime) && !isSubmitted && (
            <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">
              <span className="font-semibold text-amber-900">Attention:</span>
              <span>
                {employees.filter((e) => entries[e.id]?.inTime && !entries[e.id]?.outTime).length} worker(s) checked in but have no check-out time. Please record their Out Time before proceeding to Activities.
              </span>
            </div>
          )}

          {employees.length === 0 ? (
            <p className="text-sm text-slate-400 py-8 text-center">No workers assigned.</p>
          ) : (
            <ul className="space-y-2" aria-label="Employee checkout list">
              {employees.map((emp) => {
                const entry = entries[emp.id];
                return (
                  <li key={emp.id}>
                    <CheckoutRow
                      employee={emp}
                      checkInTime={entry?.inTime ?? null}
                      outTime={entry?.outTime ?? null}
                      date={date}
                      dayType={dayType}
                      onOutTimeChange={onOutTimeChange}
                      submitted={submitted}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </main>

        {/* ── Bottom actions — sticky inside the column ─────────────────────── */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 space-y-2 sticky bottom-0">
          <div className="flex gap-2">
            {/* Back */}
            <button
              type="button"
              onClick={onBack}
              disabled={submitted}
              className={[
                'flex-1 px-4 py-3 rounded-lg border border-slate-200 text-slate-700 font-medium',
                'min-h-[48px] hover:bg-slate-50 active:bg-slate-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                'transition-colors',
                submitted ? 'opacity-40 pointer-events-none' : '',
              ].join(' ')}
            >
              Back
            </button>

            {/* Next: Activities & OT or Submit fallback */}
            {onNext ? (
              <button
                type="button"
                onClick={onNext}
                disabled={
                  isSubmitted ||
                  employees.filter((e) => entries[e.id]?.inTime && entries[e.id]?.outTime).length === 0 ||
                  employees.some((e) => entries[e.id]?.inTime && !entries[e.id]?.outTime)
                }
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium min-h-[48px] transition-colors bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <span>Next: Activities & OT</span>
                <span aria-hidden="true">→</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={isSubmitted ? undefined : onSubmit}
                disabled={isSubmitting || isSubmitted}
                className={[
                  'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium',
                  'min-h-[48px] transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                  isSubmitted
                    ? 'bg-green-600 text-white cursor-default focus-visible:ring-green-600'
                    : isSubmitting
                    ? 'bg-blue-400 text-white cursor-wait focus-visible:ring-blue-600'
                    : 'bg-blue-700 text-white active:bg-blue-800 focus-visible:ring-blue-600',
                ].join(' ')}
                aria-live="polite"
              >
                {isSubmitted ? (
                  <>
                    <CheckCircle2 size={18} aria-hidden="true" />
                    Day submitted
                  </>
                ) : isSubmitting ? (
                  'Submitting…'
                ) : (
                  'Submit day'
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
