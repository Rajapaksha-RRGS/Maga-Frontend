import { Check } from 'lucide-react';

export type StepKey = 'checkin' | 'checkout' | 'activity';

const STEPS: { key: StepKey; label: string }[] = [
  { key: 'checkin',  label: 'Check-in' },
  { key: 'checkout', label: 'Checkout' },
  { key: 'activity', label: 'Activities & OT' },
];

const ORDER: StepKey[] = ['checkin', 'checkout', 'activity'];

interface StepIndicatorProps {
  currentStep: StepKey;
  onStepClick?: (step: StepKey) => void;
}

/**
 * StepIndicator — three-circle horizontal stepper shown on screens 2–4.
 * - Completed steps: filled blue-700 background + white checkmark
 * - Current step: filled blue-700 background + white step number
 * - Upcoming steps: white background, slate border, muted label
 */
export function StepIndicator({ currentStep, onStepClick }: StepIndicatorProps) {
  const currentIdx = ORDER.indexOf(currentStep);

  return (
    <nav aria-label="Progress" className="w-full">
      <ol className="flex items-center w-full">
        {STEPS.map((step, idx) => {
          const isCompleted = idx < currentIdx;
          const isCurrent   = idx === currentIdx;
          const isLast      = idx === STEPS.length - 1;

          const content = (
            <div className="flex flex-col items-center gap-1 group">
              {/* Circle */}
              <div
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                  'text-sm font-medium transition-all',
                  isCompleted || isCurrent
                    ? 'bg-blue-700 text-white shadow-xs'
                    : 'bg-white border-2 border-slate-300 text-slate-400 group-hover:border-slate-400',
                  onStepClick ? 'group-hover:scale-105 cursor-pointer' : '',
                ].join(' ')}
              >
                {isCompleted ? (
                  <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                ) : (
                  <span aria-hidden="true">{idx + 1}</span>
                )}
              </div>
              <span
                className={`text-xs font-medium whitespace-nowrap transition-colors ${
                  isCurrent
                    ? 'text-blue-700 font-semibold'
                    : isCompleted
                    ? 'text-slate-600 group-hover:text-slate-900'
                    : 'text-slate-400 group-hover:text-slate-600'
                }`}
              >
                {step.label}
              </span>
            </div>
          );

          return (
            <li
              key={step.key}
              className={`flex items-center ${isLast ? '' : 'flex-1'}`}
            >
              {onStepClick ? (
                <button
                  type="button"
                  onClick={() => onStepClick(step.key)}
                  className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg p-0.5"
                  title={`Go to ${step.label}`}
                >
                  {content}
                </button>
              ) : (
                content
              )}

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
