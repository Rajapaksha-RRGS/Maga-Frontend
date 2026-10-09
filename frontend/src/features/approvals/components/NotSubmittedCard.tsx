import React, { useState } from 'react';
import { Clock, ChevronDown, ChevronUp, Bell, Users, HardHat, Truck } from 'lucide-react';
import type { SupervisorApprovalGroup } from '../services/approvalService';

interface NotSubmittedCardProps {
  group: SupervisorApprovalGroup;
}

export const NotSubmittedCard: React.FC<NotSubmittedCardProps> = ({ group }) => {
  const [expanded, setExpanded] = useState(false);
  const [subTab, setSubTab] = useState<'labor' | 'operators' | 'equipment'>('labor');

  const isDraftInProgress = group.status === 'draft';

  const workersCount = group.counts?.laborWorked ?? group.workedCount ?? 0;
  const workersTotal = group.counts?.laborAssigned ?? group.assignedCount ?? 0;
  const operatorsCount = group.counts?.operatorsWorked ?? (group.operators?.length || 0);
  const operatorsTotal = group.counts?.operatorsAssigned ?? (group.operators?.length || 0);
  const equipmentCount = group.counts?.equipmentRunning ?? (group.equipment?.length || 0);
  const equipmentTotal = group.counts?.equipmentAssigned ?? (group.equipment?.length || 0);

  const workersList = group.workers || [];
  const operatorsList = group.operators || [];
  const equipmentList = group.equipment || [];
  const totalLaborHours = group.totalHours ?? group.totals?.laborHours ?? 0;

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
                {isDraftInProgress ? 'Draft In Progress (Unsubmitted)' : 'Not Started (No Submission)'}
              </span>
            </div>

            <div className="flex items-center gap-3 mt-2 text-xs text-slate-600 flex-wrap">
              <span className="inline-flex items-center gap-1 text-slate-700">
                <Users size={12} className="text-blue-600" />
                Labor: <strong>{workersCount}/{workersTotal}</strong>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <HardHat size={12} className="text-violet-600" />
                Operators: <strong>{operatorsCount}/{operatorsTotal}</strong>
              </span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-slate-700">
                <Truck size={12} className="text-amber-600" />
                Equipment: <strong>{equipmentCount}/{equipmentTotal}</strong>
              </span>
              {isDraftInProgress && (
                <>
                  <span>•</span>
                  <span className="text-blue-700 font-medium flex items-center gap-1">
                    <Clock size={12} />
                    Labor Logged: {totalLaborHours.toFixed(1)}h
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Right action button */}
        <div className="flex items-center gap-2.5 self-end md:self-center">
          <button
            type="button"
            onClick={() => alert(`Reminder alert sent to supervisor ${group.supervisorName} to submit daily operations.`)}
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

      {/* Assigned items waiting for entry */}
      {expanded && (
        <div className="border-t border-slate-200 bg-amber-50/20 p-4 sm:p-5 space-y-3">
          {/* Sub-tabs */}
          <div className="flex items-center gap-2 border-b border-amber-200/60 pb-2.5">
            <button
              type="button"
              onClick={() => setSubTab('labor')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === 'labor'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Users size={12} />
              <span>Assigned Labor ({workersList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('operators')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === 'operators'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <HardHat size={12} />
              <span>Assigned Operators ({operatorsList.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('equipment')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subTab === 'equipment'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              <Truck size={12} />
              <span>Assigned Equipment ({equipmentList.length})</span>
            </button>
          </div>

          {subTab === 'labor' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {workersList.length === 0 ? (
                <div className="col-span-full py-4 text-center text-xs text-slate-400">
                  No workers assigned.
                </div>
              ) : (
                workersList.map((w) => (
                  <div
                    key={w.employeeId}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs shadow-2xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{w.callingName}</div>
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
                ))
              )}
            </div>
          )}

          {subTab === 'operators' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {operatorsList.length === 0 ? (
                <div className="col-span-full py-4 text-center text-xs text-slate-400">
                  No machine operators assigned.
                </div>
              ) : (
                operatorsList.map((op) => (
                  <div
                    key={op.operatorId}
                    className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs shadow-2xs"
                  >
                    <div>
                      <div className="font-semibold text-slate-900">{op.callingName || op.fullName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {op.operatorCode} {op.assignedEquipmentDisplay && op.assignedEquipmentDisplay !== '—' && `• ${op.assignedEquipmentDisplay}`}
                      </div>
                    </div>
                    <div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          op.inTime
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {op.inTime ? 'Draft In' : 'Pending'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {subTab === 'equipment' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {equipmentList.length === 0 ? (
                <div className="col-span-full py-4 text-center text-xs text-slate-400">
                  No equipment assigned.
                </div>
              ) : (
                equipmentList.map((eq) => {
                  const isLogged = (eq.netHours || 0) > 0 || (eq.loggedQuantity || 0) > 0;
                  return (
                    <div
                      key={eq.equipmentId}
                      className="p-3 rounded-xl border border-slate-200 bg-white flex items-center justify-between text-xs shadow-2xs"
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{eq.equipmentName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {eq.equipmentCode} {eq.magaNo && `• ${eq.magaNo}`}
                        </div>
                      </div>
                      <div>
                        <span
                          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            isLogged
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isLogged ? 'Draft Log' : 'Pending'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};


