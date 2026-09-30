import React from 'react';
import { Users, HardHat, Truck, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ApprovalStats } from '../services/approvalService';

interface ApprovalStatsBarProps {
  stats: ApprovalStats;
  activeTab: 'submitted' | 'notSubmitted' | 'approved';
  onTabChange: (tab: 'submitted' | 'notSubmitted' | 'approved') => void;
}

export const ApprovalStatsBar: React.FC<ApprovalStatsBarProps> = ({
  stats,
  activeTab,
  onTabChange,
}) => {
  const laborAttended = stats.labor?.attendedCount ?? stats.totalWorkers;
  const laborAssigned = stats.labor?.totalAssigned ?? stats.totalWorkers;
  const laborNormal = stats.labor?.totalNormalHours ?? 0;
  const laborOt = stats.labor?.totalOtHours ?? 0;

  const opDeployed = stats.operators?.deployedCount ?? 0;
  const opAssigned = stats.operators?.totalAssigned ?? 0;
  const opMapped = stats.operators?.mappedCount ?? 0;

  const eqRunning = stats.equipment?.runningCount ?? 0;
  const eqAssigned = stats.equipment?.totalAssigned ?? 0;
  const eqDays = stats.equipment?.totalDays ?? 0;
  const eqFuel = stats.equipment?.totalFuelLiters ?? 0;

  return (
    <div className="space-y-3">
      {/* ── 3 Resource Pillars: Labor | Machine Operators | Equipment ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* 1. Labor Card */}
        <div className="p-4 rounded-2xl border bg-white border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 flex items-center gap-1.5">
              <Users size={15} className="text-blue-600" />
              <span>Labor Attendance</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {laborAttended}/{laborAssigned} Active
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {laborAttended}
            </span>
            <span className="text-xs text-slate-500">workers on site</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-600">
              Normal: <strong className="text-slate-900">{laborNormal.toFixed(1)}h</strong>
            </span>
            <span className="text-amber-700">
              OT: <strong>{laborOt.toFixed(1)}h</strong>
            </span>
          </div>
        </div>

        {/* 2. Machine Operators Card */}
        <div className="p-4 rounded-2xl border bg-white border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
              <HardHat size={15} className="text-emerald-600" />
              <span>Machine Operators</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {opDeployed}/{opAssigned} Deployed
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {opDeployed}
            </span>
            <span className="text-xs text-slate-500">operators checked-in</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-600">
              Mapped Machines: <strong className="text-emerald-700">{opMapped}</strong>
            </span>
            <span className="text-slate-400">
              {opAssigned > 0 ? `${Math.round((opDeployed / opAssigned) * 100)}% deployed` : '—'}
            </span>
          </div>
        </div>

        {/* 3. Plant & Equipment Card */}
        <div className="p-4 rounded-2xl border bg-white border-slate-200/90 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
              <Truck size={15} className="text-orange-600" />
              <span>Plant & Equipment</span>
            </span>
            <span className="text-[11px] font-semibold text-slate-500">
              {eqRunning}/{eqAssigned} Running
            </span>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 tabular-nums">
              {eqRunning}
            </span>
            <span className="text-xs text-slate-500">units operating</span>
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs font-mono">
            <span className="text-slate-600">
              Days Logged: <strong className="text-slate-900">{eqDays.toFixed(1)}d</strong>
            </span>
            <span className="text-orange-700">
              Fuel: <strong>{eqFuel > 0 ? `${eqFuel.toFixed(1)}L` : '—'}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* ── Approval Status Tabs Selector ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* Tab 1: Pending Approval */}
        <button
          type="button"
          onClick={() => onTabChange('submitted')}
          className={`px-4 py-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'submitted'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20 ring-2 ring-blue-500/30'
              : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-blue-50/20 text-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${activeTab === 'submitted' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
              <Clock size={16} />
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">Pending Approval</div>
              <div className={`text-[11px] ${activeTab === 'submitted' ? 'text-blue-100' : 'text-slate-500'}`}>
                {stats.submittedCount} supervisor{stats.submittedCount === 1 ? '' : 's'} waiting
              </div>
            </div>
          </div>
          {stats.submittedCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400 text-slate-900 shadow-xs">
              Action Req.
            </span>
          )}
        </button>

        {/* Tab 2: Not Submitted */}
        <button
          type="button"
          onClick={() => onTabChange('notSubmitted')}
          className={`px-4 py-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'notSubmitted'
              ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-500/20 ring-2 ring-amber-500/30'
              : 'bg-white border-slate-200 hover:border-amber-300 hover:bg-amber-50/20 text-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${activeTab === 'notSubmitted' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'}`}>
              <AlertTriangle size={16} />
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">Not Submitted</div>
              <div className={`text-[11px] ${activeTab === 'notSubmitted' ? 'text-amber-100' : 'text-slate-500'}`}>
                {stats.notSubmittedCount} supervisor{stats.notSubmittedCount === 1 ? '' : 's'} pending entry
              </div>
            </div>
          </div>
        </button>

        {/* Tab 3: Approved */}
        <button
          type="button"
          onClick={() => onTabChange('approved')}
          className={`px-4 py-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'approved'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-500/20 ring-2 ring-emerald-500/30'
              : 'bg-white border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/20 text-slate-700 shadow-2xs'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <div className={`p-1.5 rounded-lg ${activeTab === 'approved' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
              <CheckCircle2 size={16} />
            </div>
            <div>
              <div className="text-xs font-bold leading-tight">Approved & Locked</div>
              <div className={`text-[11px] ${activeTab === 'approved' ? 'text-emerald-100' : 'text-slate-500'}`}>
                {stats.approvedCount} supervisor{stats.approvedCount === 1 ? '' : 's'} verified
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
