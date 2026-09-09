/**
 * TenantStats.tsx
 *
 * Overview statistics cards strictly adhering to design-system.json DNA:
 * - rounded-lg border, min-h-[88px], no shadows
 * - uppercase tracking-wide text-xs text-slate-500 labels
 * - font-medium text-3xl tabular-nums values
 */
import { Building2, CheckCircle2, ShieldCheck } from 'lucide-react';

interface TenantStatsProps {
  stats: {
    total: number;
    active: number;
    suspended: number;
    totalAdmins: number;
  };
}

export default function TenantStats({ stats }: TenantStatsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
      {/* 1. Total Projects */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 min-h-[88px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Registered Projects
          </span>
          <Building2 size={16} className="text-slate-400" />
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-medium text-slate-900 tabular-nums">
            {stats.total}
          </span>
          <span className="text-xs text-slate-500">project sites</span>
        </div>
      </div>

      {/* 2. Active Projects (Semantic Green) */}
      <div className="rounded-lg border border-green-200 bg-green-50/70 p-4 min-h-[88px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-green-700">
            Active Projects
          </span>
          <CheckCircle2 size={16} className="text-green-600" />
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-medium text-green-800 tabular-nums">
            {stats.active}
          </span>
          <span className="text-xs text-green-700">online & active</span>
        </div>
      </div>

      {/* 3. Total Admins Provisioned */}
      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-4 min-h-[88px] flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-blue-700">
            Site Admins
          </span>
          <ShieldCheck size={16} className="text-blue-600" />
        </div>
        <div className="flex items-baseline gap-2 mt-1">
          <span className="text-3xl font-medium text-blue-900 tabular-nums">
            {stats.totalAdmins}
          </span>
          <span className="text-xs text-blue-700">site admin accounts</span>
        </div>
      </div>
    </div>
  );
}
