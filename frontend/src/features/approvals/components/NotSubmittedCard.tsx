import React, { useState } from 'react';
import { AlertTriangle, Clock, ChevronDown, ChevronUp, Bell } from 'lucide-react';
import type { SupervisorApprovalGroup } from '../services/approvalService';

interface NotSubmittedCardProps {
  group: SupervisorApprovalGroup;
}

export const NotSubmittedCard: React.FC<NotSubmittedCardProps> = ({ group }) => {
  const [expanded, setExpanded] = useState(false);

  const isDraftInProgress = group.status === 'draft';

  return (
    <div className="bg-white rounded-2xl border border-amber-200 shadow-xs overflow-hidden transition-all hover:border-amber-300">
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Supervisor info */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 flex-shrink-0 font-bold text-base">
            {group.supervisorName ? group.supervisorName.charAt(0).toUpperCase() : 'S'}
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-900 tracking-tight">
                {group.supervisorName}
              </h3>
              <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-mono">
                @{group.username}
              </span>
              <span
                className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border ${
                  isDraftInProgress
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isDraftInProgress ? 'Draft In Progress (Unsubmitted)' : 'Not Started (No Attendance)'}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                <AlertTriangle size={13} />
                <strong>{group.assignedCount}</strong> worker(s) assigned by admin
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                Recorded: <strong>{group.workedCount}</strong> / {group.assignedCount}
              </span>
              {isDraftInProgress && (
                <>
                  <span>•</span>
                  <span>Recorded Hours: {group.totalHours.toFixed(1)}h</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right action button */}
        <div className="flex items-center gap-2.5 self-end md:self-center">
          <button
            type="button"
            onClick={() => alert(`Reminder alert sent to supervisor ${group.supervisorName} to submit daily attendance records.`)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-amber-800 bg-amber-100 hover:bg-amber-200/80 border border-amber-300 transition-colors cursor-pointer"
          >
            <Bell size={13} />
            <span>Remind Supervisor</span>
          </button>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Assigned workers waiting for entry */}
      {expanded && (
        <div className="border-t border-slate-200 bg-amber-50/20 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Assigned Workers Pending Submission ({group.workers.length})
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
            {group.workers.map((w) => (
              <div
                key={w.employeeId}
                className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs shadow-2xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    {w.callingName}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {w.employeeCode} • {w.tradeGroup}
                  </div>
                </div>
                <div>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      w.inTime
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {w.inTime ? 'Draft In' : 'No Check-in'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
