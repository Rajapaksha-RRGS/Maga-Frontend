import { CheckCircle2, ArrowLeft } from 'lucide-react';
import { StepIndicator } from '../features/time-entries/components/StepIndicator';
import { CheckoutRow }   from '../features/time-entries/components/CheckoutRow';
import type { AssignedEmployee }   from '../features/time-entries/services/timeEntryService';
import type { EmployeeEntryState, SubmitStatus } from '../features/time-entries/hooks/useTimeEntry';

interface CheckoutSubmitPageProps {
  employees: AssignedEmployee[];
  entries: Record<string, EmployeeEntryState>;
  submitStatus: SubmitStatus;
  onOutTimeChange: (employeeId: string, outTime: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

/**
 * CheckoutSubmitPage (step 3 of 3).
 * Shows one CheckoutRow per employee. On submit, locks all inputs.
 * Non-blocking: employees without a check-in show a warning row but
 * do not prevent submission.
 */
export function CheckoutSubmitPage({
  employees,
  entries,
  submitStatus,
  onOutTimeChange,
  onSubmit,
  onBack,
}: CheckoutSubmitPageProps) {
  const submitted = submitStatus === 'submitted' || submitStatus === 'submitting';
  const isSubmitting = submitStatus === 'submitting';
  const isSubmitted  = submitStatus === 'submitted';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-4 pt-5 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button
            type="button"
            onClick={onBack}
            disabled={submitted}
            className={[
              'w-9 h-9 flex items-center justify-center rounded-md',
              'text-slate-600 hover:bg-slate-100 active:bg-slate-200',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
              'transition-colors flex-shrink-0',
              submitted ? 'opacity-40 pointer-events-none' : '',
            ].join(' ')}
            aria-label="Back to activity"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <h1 className="text-base font-medium text-slate-800">Checkout</h1>
        </div>
        <StepIndicator currentStep="checkout" />
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-36 space-y-3">

        {/* Submitted banner */}
        {isSubmitted && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200"
          >
            <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm font-medium text-green-800">
              Day submitted successfully. Records are locked.
            </p>
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
                    onOutTimeChange={onOutTimeChange}
                    submitted={submitted}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {/* ── Bottom actions ────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 space-y-2">
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

          {/* Submit / submitted */}
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
            aria-label={
              isSubmitted
                ? 'Day submitted'
                : isSubmitting
                ? 'Submitting…'
                : 'Submit day'
            }
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
        </div>
      </div>
    </div>
  );
}
