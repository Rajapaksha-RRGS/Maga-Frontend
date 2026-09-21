import { useState } from 'react';
import { 
  ClipboardCheck, 
  Users, 
  HardHat, 
  Lock, 
  Unlock, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldCheck, 
  Calendar, 
  Building2 
} from 'lucide-react';
import type { 
  LaborerEntry, 
  OperatorEntry, 
  EquipmentLogEntry, 
  SiteProject 
} from '../services/supervisorStorageService';

interface DailySummaryViewProps {
  supervisorName: string;
  currentSite: SiteProject;
  selectedDate: string;
  laborers: LaborerEntry[];
  operators: OperatorEntry[];
  equipment: EquipmentLogEntry[];
  isDayLocked: boolean;
  onLockDay: () => void;
  onUnlockDay: () => void;
  onNavigateTab: (tab: 'labor' | 'operators' | 'equipment') => void;
}

export function DailySummaryView({
  supervisorName,
  currentSite,
  selectedDate,
  laborers,
  operators,
  equipment,
  isDayLocked,
  onLockDay,
  onUnlockDay,
  onNavigateTab,
}: DailySummaryViewProps) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [submitSuccessToast, setSubmitSuccessToast] = useState(false);

  // Aggregated calculations
  const totalLaborers = laborers.length;
  const completedLaborers = laborers.filter((l) => l.inTime && l.outTime).length;
  const totalLaborHours = laborers.reduce((acc, l) => acc + (l.shiftHours || 0), 0);

  const totalOperators = operators.length;
  const completedOperators = operators.filter((o) => o.inTime && o.assignedEquipmentId).length;
  const unmappedOperators = operators.filter((o) => !o.assignedEquipmentId).length;

  // Activity breakdown aggregation
  const activityHoursMap: Record<string, number> = {};
  laborers.forEach((l) => {
    l.activities.forEach((a) => {
      if (a.activityCode && a.hours > 0) {
        activityHoursMap[a.activityCode] = (activityHoursMap[a.activityCode] || 0) + a.hours;
      }
    });
  });

  const hasPendingItems = 
    completedLaborers < totalLaborers || 
    unmappedOperators > 0;

  const handleConfirmSubmit = () => {
    onLockDay();
    setShowConfirmModal(false);
    setSubmitSuccessToast(true);
    setTimeout(() => setSubmitSuccessToast(false), 3000);
  };

  const formattedDate = new Date(selectedDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="space-y-4 pb-24 animate-in fade-in duration-150">
      {/* ── Lock / Verification Status Banner ─────────────────────────────────── */}
      {isDayLocked ? (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 rounded-2xl p-4 shadow-xs flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center flex-shrink-0">
            <Lock size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                Shift Roster Locked & Submitted
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-200 dark:bg-emerald-800 text-emerald-800 dark:text-emerald-100">
                Audited
              </span>
            </div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
              Signed by <strong className="font-semibold">{supervisorName}</strong> for {currentSite.name} on {formattedDate}.
            </p>
            <div className="mt-3">
              <button
                type="button"
                onClick={onUnlockDay}
                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-50"
              >
                <Unlock size={14} />
                <span>Unlock for Corrections</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center flex-shrink-0">
              <ClipboardCheck size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-blue-950 dark:text-blue-100">
                End-of-Day Daily Consolidation
              </h3>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-0.5">
                Review verified hours and machine logs before locking today's shift.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Shift Summary Metadata Card ──────────────────────────────────────── */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Building2 size={14} className="text-blue-600" /> Project Site
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{currentSite.name}</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-700/60 pt-2">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Calendar size={14} className="text-blue-600" /> Work Date
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{formattedDate}</span>
        </div>
        <div className="flex items-center justify-between text-xs border-t border-slate-100 dark:border-slate-700/60 pt-2">
          <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-blue-600" /> Site Supervisor
          </span>
          <span className="font-semibold text-slate-900 dark:text-slate-100">{supervisorName}</span>
        </div>
      </div>

      {/* ── 3 Operational Streams Consolidated ────────────────────────────────── */}
      <div className="space-y-2.5">
        {/* Stream 1: Labor Attendance */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center">
                <Users size={15} />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                1. General  Labor Records ({completedLaborers}/{totalLaborers})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('labor')}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              Edit
            </button>
          </div>

          <div className=" gap-2 text-xs max-h-[220px] overflow-y-auto">
            {/* <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-100 dark:border-slate-700">
              <p className="text-slate-400 text-[10px]">Total Normal Shift Hours</p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                {totalLaborHours.toFixed(1)} hrs
              </p>
            </div>
            <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-100 dark:border-slate-700">
              <p className="text-slate-400 text-[10px]">Total Overtime (OT)</p>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400 tabular-nums mt-0.5">
                +{totalOtHours.toFixed(1)} hrs
              </p>
            </div> */}
            <div className="grid grid-cols-5 px-4 py-2.5 bg-gray-50 border-b dark:bg-slate-800/80 dark:border-gray-700 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div className='text-xs text-left  font-bold text-gray-500 uppercase tracking-wider'>Emp Code</div>
                <div className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider">In</div>
                <div className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Out</div>
                <div className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider">hrs</div>
                <div className="text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Activity</div>
            </div>

            {laborers.map((laborer) => (
              <div key={laborer.id} className="grid grid-cols-5 px-4 py-2.5  bg-white dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 last:border-none text-xs">
                <span className="text-slate-900 dark:text-slate-100 font-medium">
                  {laborer.employeeCode ? `${laborer.employeeCode}` : ''} 
                </span>
                <span className="text-center text-slate-900 dark:text-slate-100">
                  {laborer.inTime || '---'}
                </span>
                <span className="text-center text-slate-900 dark:text-slate-100">
                  {laborer.outTime || '---'}
                </span>
                <span className="text-center text-slate-900 dark:text-slate-100">
                  {laborer.shiftHours || '---'} 
                </span>
                <span className="text-center text-slate-900 dark:text-slate-100">
                  {laborer.activities.length || '0'} 
                </span>
              </div>
            ))}
            




          </div>
        </div>

        {/* Stream 2: Machinery Operators */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 flex items-center justify-center">
                <HardHat size={15} />
              </div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100">
                2. Machinery Operators ({completedOperators}/{totalOperators})
              </h4>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('operators')}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
            >
              Edit
            </button>
          </div>

          <div className="space-y-1.5 text-xs">
            {operators.map((op) => {
              const mapped = equipment.find((e) => e.id === op.assignedEquipmentId);
              return (
                <div key={op.id} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-slate-750 last:border-none">
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {op.employeeNumber ? `${op.employeeNumber} · ` : ''}{op.callingName}
                  </span>
                  <div className="flex items-center gap-2">
                    {mapped ? (
                      <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                        {mapped.code}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold text-red-500">Unmapped</span>
                    )}
                    <span className="font-bold text-slate-700 dark:text-slate-300">{op.shiftHours}h</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Stream 3: Master Activity Breakdown */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 shadow-2xs">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-slate-100 mb-2">
            3. Activity Hours Allocation
          </h4>
          <div className="space-y-1.5">
            {Object.entries(activityHoursMap).map(([code, hrs]) => (
              <div key={code} className="flex items-center justify-between text-xs py-1 border-b border-slate-100 dark:border-slate-750 last:border-none">
                <span className="font-mono font-medium text-slate-700 dark:text-slate-300">{code}</span>
                <span className="font-bold text-slate-900 dark:text-slate-100 tabular-nums">{hrs.toFixed(1)} hrs</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Submit & Lock Day Action Button ──────────────────────────────────── */}
      {!isDayLocked && (
        <div className="pt-2">
          {hasPendingItems && (
            <div className="mb-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle size={15} className="text-amber-600 flex-shrink-0" />
              <span>Some records are still pending in and out times or machine mappings.</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowConfirmModal(true)}
            className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold text-sm shadow-md transition-all active:scale-[0.99]"
          >
            <Lock size={17} />
            <span>Submit & Lock Day Roster</span>
          </button>
        </div>
      )}

      {/* ── Confirmation Modal ──────────────────────────────────────────────── */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center mx-auto">
              <Lock size={24} />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Confirm Daily Submission & Lock
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Are you sure you want to sign off and lock the work records for {formattedDate}?
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <p className="text-slate-600 dark:text-slate-300">
                • <strong>{completedLaborers}</strong> Laborers checked in ({totalLaborHours}h)
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                • <strong>{completedOperators}</strong> Equipment Operators verified
              </p>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Review Again
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className="flex-1 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors"
              >
                Confirm & Lock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {submitSuccessToast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-emerald-700 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 size={16} />
          <span>Shift Roster Locked and verified successfully!</span>
        </div>
      )}
    </div>
  );
}
