import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Lock, X } from 'lucide-react';
import type { DayType } from '../services/calendarService';

interface DayTypeConfirmModalProps {
  isOpen: boolean;
  date: string; // YYYY-MM-DD
  currentDayType?: DayType;
  newDayType?: DayType;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
  isProcessing?: boolean;
  errorMessage?: string | null;
}

function getRuleDescription(dt?: DayType): { cap: string; desc: string; badgeColor: string } {
  if (!dt) return { cap: '8.0h Cap', desc: 'Standard Weekday Rules', badgeColor: 'bg-slate-100 text-slate-700 border-slate-300' };
  const lower = dt.name.toLowerCase();
  if (lower.includes('sunday') || lower.includes('holiday') || lower.includes('poya')) {
    return {
      cap: '0.0h Cap (100% OT)',
      desc: 'All hours worked are calculated as Overtime',
      badgeColor: lower.includes('sunday') ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-amber-100 text-amber-800 border-amber-300',
    };
  }
  if (lower.includes('saturday')) {
    return {
      cap: '6.0h Cap (07:00-13:00)',
      desc: 'Hours exceeding 6.0h are calculated as Overtime',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
    };
  }
  if (lower.includes('shutdown')) {
    return {
      cap: 'Shutdown Day',
      desc: 'Work hours follow day-of-week rules',
      badgeColor: 'bg-rose-100 text-rose-800 border-rose-300',
    };
  }
  return {
    cap: '8.0h Standard Cap',
    desc: 'Hours exceeding 8.0h are calculated as Overtime',
    badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
  };
}

export const DayTypeConfirmModal: React.FC<DayTypeConfirmModalProps> = ({
  isOpen,
  date,
  currentDayType,
  newDayType,
  onConfirm,
  onCancel,
  isProcessing = false,
  errorMessage = null,
}) => {
  if (!isOpen || !newDayType) return null;

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const currentRule = getRuleDescription(currentDayType);
  const newRule = getRuleDescription(newDayType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Confirm Day Type Change</h2>
              <p className="text-xs text-slate-500 font-medium">{formattedDate}</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            disabled={isProcessing}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/50 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Comparison Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center relative">
            {/* Current */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Current Day Type</div>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${currentRule.badgeColor}`}>
                  {currentDayType?.name || 'Default'}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-600">{currentRule.cap}</p>
              <p className="text-[11px] text-slate-500">{currentRule.desc}</p>
            </div>

            {/* Transition Arrow for Desktop */}
            <div className="hidden sm:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border border-slate-200 shadow-xs items-center justify-center text-slate-400 z-10">
              <ArrowRight size={14} />
            </div>

            {/* New */}
            <div className="p-3.5 rounded-xl border-2 border-blue-500 bg-blue-50/40 space-y-1.5 shadow-xs">
              <div className="text-[10px] font-bold uppercase tracking-wider text-blue-600">New Day Type</div>
              <div className="flex items-center gap-1.5">
                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${newRule.badgeColor}`}>
                  {newDayType.name}
                </span>
              </div>
              <p className="text-xs font-bold text-blue-900">{newRule.cap}</p>
              <p className="text-[11px] text-blue-700">{newRule.desc}</p>
            </div>
          </div>

          {/* Cascade Recalculation Notice (ආරක්ෂක පියවර 2 & 3) */}
          <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
              <span>⚡ Automatic Overtime Recalculation</span>
            </div>
            <p className="text-xs leading-relaxed text-amber-800">
              Applying this change will <strong>automatically recalculate Standard and Overtime hours</strong> for all open (draft & submitted) labour time entries on this date.
            </p>
          </div>

          {/* Error Message if Date is Locked */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-2.5">
              <Lock size={16} className="text-rose-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs">
                <span className="font-bold block">Action Blocked</span>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors min-h-[38px]"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isProcessing}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-50 rounded-xl shadow-xs transition-colors min-h-[38px]"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Recalculating...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>Confirm & Recalculate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
