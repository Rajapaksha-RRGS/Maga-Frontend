import React from 'react';
import { Users, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
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
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {/* 1. Pending Approval Card */}
      <button
        type="button"
        onClick={() => onTabChange('submitted')}
        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
          activeTab === 'submitted'
            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/20 ring-2 ring-blue-500/30'
            : 'bg-white border-slate-200 hover:border-blue-400 hover:bg-blue-50/20 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${activeTab === 'submitted' ? 'text-blue-100' : 'text-slate-600'}`}>
            Pending Approval
          </span>
          <div className={`p-1.5 rounded-lg ${activeTab === 'submitted' ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600'}`}>
            <Clock size={16} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tracking-tight ${activeTab === 'submitted' ? 'text-white' : 'text-slate-900'}`}>
            {stats.submittedCount}
          </span>
          <span className={`text-xs ${activeTab === 'submitted' ? 'text-blue-100' : 'text-slate-500'}`}>
            supervisors
          </span>
        </div>
        {stats.submittedCount > 0 && (
          <span className="inline-block mt-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-400 text-slate-900">
            Action required
          </span>
        )}
      </button>

      {/* 2. Not Submitted / Missing Card */}
      <button
        type="button"
        onClick={() => onTabChange('notSubmitted')}
        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
          activeTab === 'notSubmitted'
            ? 'bg-amber-600 text-white border-amber-600 shadow-md shadow-amber-500/20 ring-2 ring-amber-500/30'
            : 'bg-white border-slate-200 hover:border-amber-400 hover:bg-amber-50/20 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${activeTab === 'notSubmitted' ? 'text-amber-100' : 'text-slate-600'}`}>
            Not Submitted
          </span>
          <div className={`p-1.5 rounded-lg ${activeTab === 'notSubmitted' ? 'bg-white/20 text-white' : 'bg-amber-50 text-amber-600'}`}>
            <AlertTriangle size={16} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tracking-tight ${activeTab === 'notSubmitted' ? 'text-white' : 'text-slate-900'}`}>
            {stats.notSubmittedCount}
          </span>
          <span className={`text-xs ${activeTab === 'notSubmitted' ? 'text-amber-100' : 'text-slate-500'}`}>
            supervisors
          </span>
        </div>
        <span className={`inline-block mt-2 text-[10px] ${activeTab === 'notSubmitted' ? 'text-amber-100' : 'text-slate-500'}`}>
          Assigned but no records sent
        </span>
      </button>

      {/* 3. Approved Card */}
      <button
        type="button"
        onClick={() => onTabChange('approved')}
        className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
          activeTab === 'approved'
            ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-500/20 ring-2 ring-emerald-500/30'
            : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/20 shadow-xs'
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${activeTab === 'approved' ? 'text-emerald-100' : 'text-slate-600'}`}>
            Approved
          </span>
          <div className={`p-1.5 rounded-lg ${activeTab === 'approved' ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-600'}`}>
            <CheckCircle2 size={16} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className={`text-2xl font-bold tracking-tight ${activeTab === 'approved' ? 'text-white' : 'text-slate-900'}`}>
            {stats.approvedCount}
          </span>
          <span className={`text-xs ${activeTab === 'approved' ? 'text-emerald-100' : 'text-slate-500'}`}>
            supervisors
          </span>
        </div>
        <span className={`inline-block mt-2 text-[10px] ${activeTab === 'approved' ? 'text-emerald-100' : 'text-slate-500'}`}>
          Verified & locked
        </span>
      </button>

      {/* 4. Total Workers Assigned */}
      <div className="p-4 rounded-2xl border bg-white border-slate-200 shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Total Workforce</span>
          <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
            <Users size={16} />
          </div>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight text-slate-900">
            {stats.totalWorkers}
          </span>
          <span className="text-xs text-slate-500">workers assigned</span>
        </div>
        <span className="inline-block mt-2 text-[10px] text-slate-500">
          Across {stats.totalSupervisors} active supervisor(s)
        </span>
      </div>
    </div>
  );
};
