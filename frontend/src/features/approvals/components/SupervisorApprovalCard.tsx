import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  RotateCcw,
  Clock,
  User,
  Tag,
} from 'lucide-react';
import type { SupervisorApprovalGroup } from '../services/approvalService';

interface SupervisorApprovalCardProps {
  group: SupervisorApprovalGroup;
  onApprove: (supervisorId: string) => Promise<void>;
  onReject: (supervisorId: string) => Promise<void>;
  isProcessing?: boolean;
}

export const SupervisorApprovalCard: React.FC<SupervisorApprovalCardProps> = ({
  group,
  onApprove,
  onReject,
  isProcessing = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const isApproved = group.status === 'approved';
  const isSubmitted = group.status === 'submitted';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden transition-all hover:border-slate-300">
      {/* Header bar */}
      <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Supervisor Info */}
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 flex-shrink-0 font-bold text-base">
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
                  isApproved
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : isSubmitted
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}
              >
                {isApproved ? 'Approved' : isSubmitted ? 'Submitted (Awaiting Approval)' : 'Draft in Progress'}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1">
                <User size={13} className="text-slate-400" />
                <strong>{group.workedCount}</strong> of {group.assignedCount} workers recorded
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock size={13} className="text-slate-400" />
                Total: <strong className="text-slate-900">{group.totalHours.toFixed(1)}h</strong>
              </span>
              <span>•</span>
              <span className="text-amber-600 font-medium">
                OT: {group.totalOvertime.toFixed(1)}h
              </span>
              {group.submittedAt && (
                <>
                  <span>•</span>
                  <span>Submitted: {new Date(group.submittedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2.5 self-end md:self-center">
          {/* Reject / Return to draft */}
          {!isApproved && (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onReject(group.supervisorId)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors disabled:opacity-50 cursor-pointer"
              title="Return back to draft for supervisor to edit"
            >
              <RotateCcw size={14} />
              <span>Send Back</span>
            </button>
          )}

          {/* Approve Button */}
          {!isApproved ? (
            <button
              type="button"
              disabled={isProcessing}
              onClick={() => onApprove(group.supervisorId)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm shadow-blue-600/30 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Approve Day</span>
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl text-emerald-700 bg-emerald-50 border border-emerald-200">
              <CheckCircle2 size={14} />
              <span>Approved</span>
            </span>
          )}

          {/* Expand/Collapse Accordion */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Toggle worker breakdown"
          >
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>
      </div>

      {/* Accordion Worker Table */}
      {expanded && (
        <div className="border-t border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Worker Attendance & Activity Breakdown ({group.workers.length})
            </h4>
            <span className="text-[11px] text-slate-500">
              Verified against {group.assignedCount} admin assignment(s)
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3.5">Worker</th>
                  <th className="py-2.5 px-3">Trade & Partner</th>
                  <th className="py-2.5 px-3">In / Out Time</th>
                  <th className="py-2.5 px-3">Regular Hrs</th>
                  <th className="py-2.5 px-3">OT Hrs</th>
                  <th className="py-2.5 px-3">Activities Worked</th>
                  <th className="py-2.5 px-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {group.workers.map((w) => {
                  const hasAttendance = Boolean(w.inTime && w.outTime);

                  return (
                    <tr
                      key={w.employeeId}
                      className="hover:bg-blue-50/20 transition-colors"
                    >
                      <td className="py-2.5 px-3.5">
                        <div className="font-semibold text-slate-900">
                          {w.callingName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {w.employeeCode}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-800">
                          {w.tradeGroup}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[140px]">
                          {w.businessPartner}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        {hasAttendance ? (
                          <span className="font-mono text-slate-900 font-medium">
                            {w.inTime} – {w.outTime}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-semibold text-[11px]">
                            Not Recorded
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {w.hours > 0 ? `${w.hours.toFixed(1)}h` : '-'}
                      </td>
                      <td className="py-2.5 px-3">
                        {w.otHours > 0 ? (
                          <span className="font-bold text-amber-600">
                            +{w.otHours.toFixed(1)}h
                          </span>
                        ) : (
                          <span className="text-slate-400">0.0h</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {w.activities.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {w.activities.map((act, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200"
                                title={act.description}
                              >
                                <Tag size={10} />
                                {act.code}: {act.hours}h
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            w.status === 'approved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : hasAttendance
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {w.status === 'approved' ? 'Approved' : hasAttendance ? 'Done' : 'Missing'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
