import { useState }           from 'react';
import { ArrowLeft }          from 'lucide-react';
import { StepIndicator }      from '../features/time-entries/components/StepIndicator';
import { ActivityChipSelector } from '../features/time-entries/components/ActivityChipSelector';
import { EmployeeCheckboxRow }  from '../features/time-entries/components/EmployeeCheckboxRow';
import type { AssignedEmployee, ActivityCode } from '../features/time-entries/services/timeEntryService';

interface ActivityAssignPageProps {
  employees: AssignedEmployee[];
  activityCodes: ActivityCode[];
  onSetActivity: (employeeIds: string[], activityId: string, hours: number) => void;
  onBack: () => void;
  onNext: () => void;
}

/**
 * ActivityAssignPage (step 2 of 3).
 * Lets the supervisor pick an activity code, select employees, enter hours,
 * then apply in bulk. Can be applied multiple times (different codes / groups).
 * All state is local UI state — applied entries propagate via onSetActivity.
 *
 * Desktop: centered max-w-lg column; bottom action bar stays within that column.
 */
export function ActivityAssignPage({
  employees,
  activityCodes,
  onSetActivity,
  onBack,
  onNext,
}: ActivityAssignPageProps) {
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [selectedEmployees, setSelectedEmployees]   = useState<Set<string>>(new Set());
  const [hours, setHours] = useState<string>('');
  const [appliedCount, setAppliedCount] = useState(0);

  const selectedCount = selectedEmployees.size;
  const canApply =
    selectedActivityId !== null &&
    selectedCount > 0 &&
    parseFloat(hours) > 0;

  function handleEmployeeToggle(employeeId: string, checked: boolean) {
    setSelectedEmployees((prev) => {
      const next = new Set(prev);
      checked ? next.add(employeeId) : next.delete(employeeId);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedEmployees.size === employees.length) {
      setSelectedEmployees(new Set());
    } else {
      setSelectedEmployees(new Set(employees.map((e) => e.id)));
    }
  }

  function handleApply() {
    if (!canApply || !selectedActivityId) return;
    onSetActivity(Array.from(selectedEmployees), selectedActivityId, parseFloat(hours));
    setAppliedCount((n) => n + selectedCount);
    // Reset selection (keep code + hours in case supervisor repeats for more workers)
    setSelectedEmployees(new Set());
  }

  const allSelected = employees.length > 0 && selectedEmployees.size === employees.length;

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
              aria-label="Back to check-in"
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
            <h1 className="text-base font-medium text-slate-800">Activity</h1>
            {appliedCount > 0 && (
              <span className="ml-auto text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                {appliedCount} applied
              </span>
            )}
          </div>
          <StepIndicator currentStep="activity" />
        </header>

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-36 space-y-5">

          {/* Activity code picker */}
          <section aria-labelledby="activity-code-label">
            <h2 id="activity-code-label" className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
              Activity code
            </h2>
            {activityCodes.length === 0 ? (
              <p className="text-sm text-slate-400">Loading activity codes…</p>
            ) : (
              <ActivityChipSelector
                codes={activityCodes}
                selectedId={selectedActivityId}
                onSelect={setSelectedActivityId}
              />
            )}
          </section>

          {/* Hours input */}
          <section aria-labelledby="hours-label">
            <h2 id="hours-label" className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
              Hours for selected
            </h2>
            <input
              id="hours-input"
              type="number"
              inputMode="decimal"
              min="0.5"
              max="24"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="e.g. 8"
              className={[
                'w-full px-4 py-3 rounded-lg border border-slate-200 bg-white',
                'text-slate-800 font-medium text-lg tabular-nums',
                'placeholder:text-slate-400 placeholder:font-normal placeholder:text-base',
                'min-h-[52px]',
                'focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent',
              ].join(' ')}
              aria-label="Hours worked for selected employees"
            />
          </section>

          {/* Employee selector */}
          <section aria-labelledby="workers-label">
            <div className="flex items-center justify-between mb-3">
              <h2 id="workers-label" className="text-sm font-medium text-slate-500 uppercase tracking-wide">
                Workers
              </h2>
              <button
                type="button"
                onClick={handleSelectAll}
                className={[
                  'text-sm font-medium text-blue-700 px-2 py-1 rounded',
                  'hover:bg-blue-50 active:bg-blue-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                  'transition-colors',
                ].join(' ')}
                aria-label={allSelected ? 'Deselect all workers' : 'Select all workers'}
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            {employees.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">No workers assigned.</p>
            ) : (
              <ul className="space-y-2" aria-label="Worker selection">
                {employees.map((emp) => (
                  <li key={emp.id}>
                    <EmployeeCheckboxRow
                      employee={emp}
                      checked={selectedEmployees.has(emp.id)}
                      onChange={handleEmployeeToggle}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>

        {/* ── Bottom actions — sticky inside the column ─────────────────────── */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 space-y-2 sticky bottom-0">
          {/* Apply button */}
          <button
            type="button"
            onClick={handleApply}
            disabled={!canApply}
            className={[
              'w-full flex items-center justify-center px-4 py-4 rounded-lg',
              'font-medium min-h-[52px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
              canApply
                ? 'bg-blue-700 text-white active:bg-blue-800'
                : 'bg-slate-100 text-slate-400 cursor-not-allowed',
            ].join(' ')}
            aria-disabled={!canApply}
          >
            {selectedCount > 0
              ? `Apply to selected (${selectedCount})`
              : 'Select workers above'}
          </button>

          {/* Back / Next row */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              className={[
                'flex-1 px-4 py-3 rounded-lg border border-slate-200 text-slate-700 font-medium',
                'min-h-[48px] hover:bg-slate-50 active:bg-slate-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                'transition-colors',
              ].join(' ')}
            >
              Back
            </button>
            <button
              type="button"
              onClick={onNext}
              className={[
                'flex-1 px-4 py-3 rounded-lg bg-slate-800 text-white font-medium',
                'min-h-[48px] hover:bg-slate-700 active:bg-slate-900',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                'transition-colors',
              ].join(' ')}
            >
              Next: checkout
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
