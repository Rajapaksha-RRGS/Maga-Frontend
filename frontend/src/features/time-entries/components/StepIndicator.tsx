import { Check } from 'lucide-react';

export type StepKey = 'checkin' | 'activity' | 'checkout';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'checkin',  label: 'Check-in' },
  { key: 'activity', label: 'Activity' },
  { key: 'checkout', label: 'Checkout' },
];

const ORDER: StepKey[] = ['checkin', 'activity', 'checkout'];

interface StepIndicatorProps {
  currentStep: StepKey;
}

/**
 * StepIndicator — three-circle horizontal stepper shown on screens 2–4.
 * - Completed steps: filled blue-700 background + white checkmark
 * - Current step: filled blue-700 background + white step number
 * - Upcoming steps: white background, slate border, muted label
 */
export function StepIndicator({ currentStep }: StepIndicatorProps) {
  const currentIdx = ORDER.indexOf(currentStep);

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center w-full">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent   = idx === currentIdx;
          const isLast      = idx === STEPS.length - 1;

          return (
            <li
              key={step.key}
              className={`flex items-center ${isLast ? '' : 'flex-1'}`}
            >
              {/* Circle */}
              <div className="flex flex-col items-center gap-1">
                <div
                  aria-current={isCurrent ? 'step' : undefined}
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                    'text-sm font-medium transition-colors',
                    isCompleted || isCurrent
                      ? 'bg-blue-700 text-white'
                      : 'bg-white border-2 border-slate-300 text-slate-400',
                  ].join(' ')}
                >
                  {isCompleted ? (
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true">{idx + 1}</span>
                  )}
                </div>
                <span
                  className={`text-xs font-medium whitespace-nowrap ${
                    isCurrent
                      ? 'text-blue-700'
                      : isCompleted
                      ? 'text-slate-600'
                      : 'text-slate-400'
                  }`}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line (not after last step) */}
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={`flex-1 h-px mx-2 mb-5 ${
                    isCompleted ? 'bg-blue-700' : 'bg-slate-200'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
