import { useState, useId } from 'react';
import { ArrowLeft, Plus, Trash2, CheckCircle2, Clock, Users, Layers } from 'lucide-react';
import { StepIndicator } from '../features/time-entries/components/StepIndicator';
import type { AssignedEmployee, ActivityCode } from '../features/time-entries/services/timeEntryService';
import type { EmployeeEntryState, SubmitStatus, ActivityHourItem } from '../features/time-entries/hooks/useTimeEntry';
import type { DayType } from '../features/calendar/services/calendarService';
import { getDayTypeRule, timeToMinutes, formatDecimalHours } from '../utils/overtimeCalculator';

interface ActivityDistributionPageProps {
  employees: AssignedEmployee[];
  activityCodes: ActivityCode[];
  entries: Record<string, EmployeeEntryState>;
  date: string;
  dayType?: DayType;
  submitStatus: SubmitStatus;
  onUpdateActivities: (employeeId: string, activities: ActivityHourItem[]) => void;
  onBulkUpdateActivities: (employeeIds: string[], activities: ActivityHourItem[]) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function ActivityDistributionPage({
  employees,
  activityCodes,
  entries,
  date,
  dayType,
  submitStatus,
  onUpdateActivities,
  onBulkUpdateActivities,
  onSubmit,
  onBack,
}: ActivityDistributionPageProps) {
  const bulkSelectId = useId();
  const dayRule = getDayTypeRule(date, dayType?.name);
  const isSubmitted = submitStatus === 'submitted';
  const isSubmitting = submitStatus === 'submitting';

  // State for bulk assignment section
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkSelectedEmpIds, setBulkSelectedEmpIds] = useState<Set<string>>(new Set());
  const [bulkActivities, setBulkActivities] = useState<ActivityHourItem[]>([
    { activityId: activityCodes[0]?.id || '', hours: dayRule.isAllOvertime ? 0 : Math.min(8, dayRule.standardCap) },
  ]);

  // Filter only workers with check-in recorded
  const checkedInWorkers = employees.filter((e) => entries[e.id]?.inTime);

  // Helper: compute total shift hours from inTime & outTime
  const getShiftHours = (inTime: string | null, outTime: string | null): number => {
    if (!inTime || !outTime) return 0;
    const diff = timeToMinutes(outTime) - timeToMinutes(inTime);
    return diff > 0 ? Math.round((diff / 60) * 100) / 100 : 0;
  };

  // Helper: Get or initialize activities for an employee
  const getEmployeeActivities = (empId: string): ActivityHourItem[] => {
    const entry = entries[empId];
    if (entry?.activities && entry.activities.length > 0) {
      return entry.activities;
    }
    // Default to 1 activity row with standard hours
    const defaultActivityId = entry?.activityId || activityCodes[0]?.id || '';
    const shiftHours = getShiftHours(entry?.inTime, entry?.outTime);
    const defaultHours = dayRule.isAllOvertime ? shiftHours : Math.min(shiftHours || 8, dayRule.standardCap);
    return [{ activityId: defaultActivityId, hours: defaultHours }];
  };

  // Local state to keep activity edits reactive before blur/save
  const [localActivities, setLocalActivities] = useState<Record<string, ActivityHourItem[]>>(() => {
    const map: Record<string, ActivityHourItem[]> = {};
    employees.forEach((emp) => {
      map[emp.id] = getEmployeeActivities(emp.id);
    });
    return map;
  });

  const handleHourChange = (empId: string, index: number, hours: number) => {
    const current = localActivities[empId] ? [...localActivities[empId]] : [{ activityId: activityCodes[0]?.id || '', hours: 0 }];
    current[index] = { ...current[index], hours: isNaN(hours) ? 0 : hours };
    setLocalActivities((prev) => ({ ...prev, [empId]: current }));
    onUpdateActivities(empId, current);
  };

  const handleActivityCodeChange = (empId: string, index: number, activityId: string) => {
    const current = localActivities[empId] ? [...localActivities[empId]] : [{ activityId, hours: 0 }];
    current[index] = { ...current[index], activityId };
    setLocalActivities((prev) => ({ ...prev, [empId]: current }));
    onUpdateActivities(empId, current);
  };

  const handleAddActivityRow = (empId: string) => {
    const current = localActivities[empId] ? [...localActivities[empId]] : [];
    // Suggest unused activity code
    const usedIds = new Set(current.map((a) => a.activityId));
    const nextCode = activityCodes.find((ac) => !usedIds.has(ac.id)) || activityCodes[0];
    const updated = [...current, { activityId: nextCode?.id || '', hours: 0 }];
    setLocalActivities((prev) => ({ ...prev, [empId]: updated }));
    onUpdateActivities(empId, updated);
  };

  const handleRemoveActivityRow = (empId: string, index: number) => {
    const current = localActivities[empId] ? [...localActivities[empId]] : [];
    if (current.length <= 1) return; // Keep at least one
    const updated = current.filter((_, i) => i !== index);
    setLocalActivities((prev) => ({ ...prev, [empId]: updated }));
    onUpdateActivities(empId, updated);
  };

  // Bulk modal actions
  const handleBulkToggle = (empId: string) => {
    setBulkSelectedEmpIds((prev) => {
      const next = new Set(prev);
      next.has(empId) ? next.delete(empId) : next.add(empId);
      return next;
    });
  };

  const handleBulkSelectAll = () => {
    if (bulkSelectedEmpIds.size === checkedInWorkers.length) {
      setBulkSelectedEmpIds(new Set());
    } else {
      setBulkSelectedEmpIds(new Set(checkedInWorkers.map((w) => w.id)));
    }
  };

  const handleApplyBulk = () => {
    if (bulkSelectedEmpIds.size === 0) return;
    const ids = Array.from(bulkSelectedEmpIds);
    setLocalActivities((prev) => {
      const next = { ...prev };
      ids.forEach((id) => {
        next[id] = [...bulkActivities];
      });
      return next;
    });
    onBulkUpdateActivities(ids, bulkActivities);
    setShowBulkModal(false);
    setBulkSelectedEmpIds(new Set());
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <div className="flex flex-col flex-1 w-full max-w-lg mx-auto">
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <header className="bg-white border-b border-slate-200 px-4 pt-5 pb-4 sticky top-0 z-20">
          <div className="flex items-center gap-3 mb-4">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting || isSubmitted}
              className="w-9 h-9 flex items-center justify-center rounded-md text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors flex-shrink-0 disabled:opacity-40"
              aria-label="Back to checkout"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-medium text-slate-800">Distribute Activities & OT</h1>
              <p className="text-xs text-slate-500 truncate">
                {dayRule.dayTypeLabel} • Standard: {dayRule.standardCap}h
              </p>
            </div>
            {/* Bulk Button Trigger */}
            <button
              type="button"
              onClick={() => setShowBulkModal(!showBulkModal)}
              className="flex items-center gap-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors flex-shrink-0"
            >
              <Users size={14} />
              <span>Bulk Split</span>
            </button>
          </div>
          <StepIndicator currentStep="activity" />
        </header>

        {/* ── Main Body ────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-40 space-y-4">
          {/* Submitted banner */}
          {isSubmitted && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-green-50 border border-green-200">
              <CheckCircle2 size={20} className="text-green-600 flex-shrink-0" />
              <p className="text-sm font-medium text-green-800">
                Daily attendance & activities submitted and locked successfully.
              </p>
            </div>
          )}

          {/* Bulk Split Panel (collapsible) */}
          {showBulkModal && (
            <div className="bg-white border border-blue-200 rounded-xl p-4 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <Layers size={18} className="text-blue-700" />
                  <span className="text-sm font-semibold text-slate-800">Bulk Activity Split</span>
                </div>
                <button
                  type="button"
                  onClick={handleBulkSelectAll}
                  className="text-xs text-blue-700 hover:underline font-medium"
                >
                  {bulkSelectedEmpIds.size === checkedInWorkers.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              {/* Workers Picker Pills */}
              <div>
                <p id={bulkSelectId} className="text-xs font-medium text-slate-500 mb-2">Select workers to apply:</p>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto" role="group" aria-labelledby={bulkSelectId}>
                  {checkedInWorkers.map((w) => {
                    const isSelected = bulkSelectedEmpIds.has(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => handleBulkToggle(w.id)}
                        className={[
                          'text-xs px-2.5 py-1 rounded-md border transition-all flex items-center gap-1',
                          isSelected
                            ? 'bg-blue-700 text-white border-blue-700 font-medium'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100',
                        ].join(' ')}
                      >
                        <span>{w.callingName}</span>
                        <span className="opacity-70 text-[10px]">({w.tradeGroup})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bulk Activity Rows */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <p className="text-xs font-medium text-slate-500">Activities & Hours to apply:</p>
                {bulkActivities.map((act, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <select
                      value={act.activityId}
                      onChange={(e) => {
                        const updated = [...bulkActivities];
                        updated[idx].activityId = e.target.value;
                        setBulkActivities(updated);
                      }}
                      className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs text-slate-800 min-h-[40px] focus:ring-2 focus:ring-blue-600 outline-none"
                    >
                      {activityCodes.map((ac) => (
                        <option key={ac.id} value={ac.id}>
                          {ac.code} — {ac.description}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="24"
                      value={act.hours}
                      onChange={(e) => {
                        const updated = [...bulkActivities];
                        updated[idx].hours = parseFloat(e.target.value) || 0;
                        setBulkActivities(updated);
                      }}
                      placeholder="Hours"
                      className="w-20 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-800 min-h-[40px] text-center focus:ring-2 focus:ring-blue-600 outline-none"
                    />
                    {bulkActivities.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setBulkActivities(bulkActivities.filter((_, i) => i !== idx))}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() =>
                    setBulkActivities([
                      ...bulkActivities,
                      { activityId: activityCodes[1]?.id || activityCodes[0]?.id || '', hours: 0 },
                    ])
                  }
                  className="flex items-center gap-1.5 text-xs text-blue-700 font-medium hover:underline pt-1"
                >
                  <Plus size={14} />
                  <span>+ Add another activity for group</span>
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={bulkSelectedEmpIds.size === 0}
                  onClick={handleApplyBulk}
                  className="px-4 py-2 text-xs font-medium bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition-colors"
                >
                  Apply to {bulkSelectedEmpIds.size} worker{bulkSelectedEmpIds.size !== 1 ? 's' : ''}
                </button>
              </div>
            </div>
          )}

          {/* List of Workers with Dynamic Activity Hour Distribution */}
          {checkedInWorkers.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
              <Clock size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-700">No checked-in workers for today.</p>
              <p className="text-xs text-slate-400 mt-1">Go back to Check-in to record morning arrival.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {checkedInWorkers.map((emp) => {
                const entry = entries[emp.id];
                const shiftHours = getShiftHours(entry?.inTime, entry?.outTime);
                const acts = localActivities[emp.id] || [{ activityId: activityCodes[0]?.id || '', hours: 0 }];
                const allocatedHours = acts.reduce((s, a) => s + (Number(a.hours) || 0), 0);

                // Auto OT calculation
                let calculatedOt = 0;
                if (dayRule.isAllOvertime) {
                  calculatedOt = shiftHours || allocatedHours;
                } else if (shiftHours > dayRule.standardCap) {
                  calculatedOt = parseFloat((shiftHours - dayRule.standardCap).toFixed(2));
                } else if (allocatedHours > dayRule.standardCap) {
                  calculatedOt = parseFloat((allocatedHours - dayRule.standardCap).toFixed(2));
                }

                return (
                  <div
                    key={emp.id}
                    className="bg-white border border-slate-200 rounded-xl p-4 shadow-none transition-all space-y-3"
                  >
                    {/* Worker Header & Shift Details */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800">{emp.callingName}</span>
                          <span className="text-xs text-slate-400 font-mono">({emp.id})</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{emp.tradeGroup} • {emp.businessPartner}</p>
                      </div>

                      {/* Shift Hours & Status Pill */}
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                            Shift: {formatDecimalHours(shiftHours)}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                          {entry?.inTime || '--:--'} → {entry?.outTime || 'ongoing'}
                        </p>
                      </div>
                    </div>

                    {/* Dynamic Activity Rows */}
                    <div className="space-y-2">
                      {acts.map((act, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          {/* Activity Code Dropdown */}
                          <div className="flex-1 min-w-0">
                            <select
                              value={act.activityId}
                              disabled={isSubmitted}
                              onChange={(e) => handleActivityCodeChange(emp.id, idx, e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50/60 text-xs font-medium text-slate-800 min-h-[40px] focus:ring-2 focus:ring-blue-600 focus:bg-white outline-none transition-colors"
                            >
                              {activityCodes.map((ac) => (
                                <option key={ac.id} value={ac.id}>
                                  {ac.code} — {ac.description}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Hours Input */}
                          <div className="w-20 flex-shrink-0">
                            <input
                              type="number"
                              step="0.5"
                              min="0"
                              max="24"
                              disabled={isSubmitted}
                              value={act.hours === 0 ? '' : act.hours}
                              onChange={(e) => handleHourChange(emp.id, idx, parseFloat(e.target.value))}
                              placeholder="0.0h"
                              className="w-full px-2 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 min-h-[40px] text-center focus:ring-2 focus:ring-blue-600 outline-none"
                            />
                          </div>

                          {/* Delete row button (only if > 1 activity) */}
                          {acts.length > 1 && !isSubmitted && (
                            <button
                              type="button"
                              onClick={() => handleRemoveActivityRow(emp.id, idx)}
                              className="p-2 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
                              title="Remove this activity"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Add another activity affordance */}
                      {!isSubmitted && (
                        <button
                          type="button"
                          onClick={() => handleAddActivityRow(emp.id)}
                          className="flex items-center gap-1.5 text-xs text-blue-700 font-medium hover:underline pt-1 transition-colors"
                        >
                          <Plus size={14} />
                          <span>+ Add another activity (Task switch)</span>
                        </button>
                      )}
                    </div>

                    {/* Summary Footer: Allocated vs Overtime breakdown */}
                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Allocated:</span>
                        <span
                          className={[
                            'font-semibold px-2 py-0.5 rounded text-xs',
                            allocatedHours >= dayRule.standardCap
                              ? 'bg-green-50 text-green-800 border border-green-200'
                              : 'bg-slate-100 text-slate-700',
                          ].join(' ')}
                        >
                          {formatDecimalHours(allocatedHours)}
                        </span>
                      </div>

                      {/* Auto OT Badge */}
                      <div className="flex items-center gap-1">
                        {dayRule.isAllOvertime ? (
                          <span className="font-semibold text-purple-800 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded text-[11px]">
                            {formatDecimalHours(calculatedOt)} Sunday OT
                          </span>
                        ) : calculatedOt > 0 ? (
                          <span className="font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                            +{formatDecimalHours(calculatedOt)} Auto OT
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">No OT</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>

        {/* ── Bottom Action Bar ────────────────────────────────────────────── */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 space-y-2 sticky bottom-0 z-20">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting || isSubmitted}
              className="border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-4 min-h-[52px] hover:bg-slate-50 active:bg-slate-100 transition-colors flex-1 disabled:opacity-40"
            >
              Back to checkout
            </button>

            <button
              type="button"
              onClick={onSubmit}
              disabled={isSubmitting || isSubmitted || checkedInWorkers.length === 0}
              className={[
                'font-medium text-sm rounded-lg px-4 min-h-[52px] transition-colors flex-[2] text-white',
                isSubmitted
                  ? 'bg-green-600'
                  : 'bg-blue-700 hover:bg-blue-800 active:bg-blue-900 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed',
              ].join(' ')}
            >
              {isSubmitted
                ? '✓ Day Submitted'
                : isSubmitting
                ? 'Submitting records…'
                : 'Submit Day & Lock Records'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
