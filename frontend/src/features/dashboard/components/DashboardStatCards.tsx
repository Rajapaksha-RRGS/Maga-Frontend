/**
 * DashboardStatCards.tsx
 *
 * Four key-metric stat cards for the admin dashboard.
 * Emerald = good/total, green = active, amber = warning/action needed.
 */
import { Users, UserCog, UserX, Clock } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor: string;
  badge?: string;
  badgeColor?: string;
}

function StatCard({ label, value, icon, iconBg, valueColor, badge, badgeColor }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-3 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}>
            {badge}
          </span>
        )}
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
        <p className={`text-3xl font-semibold tabular-nums leading-none ${valueColor}`}>{value}</p>
      </div>
    </div>
  );
}

interface Props {
  totalEmployees: number;
  activeSupervisors: number;
  unassignedToday: number;
  pendingSubmissions: number;
}

export default function DashboardStatCards({
  totalEmployees,
  activeSupervisors,
  unassignedToday,
  pendingSubmissions,
}: Props) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        label="Active employees"
        value={totalEmployees}
        icon={<Users size={18} className="text-emerald-600" />}
        iconBg="bg-emerald-50"
        valueColor="text-slate-800"
      />
      <StatCard
        label="Active supervisors"
        value={activeSupervisors}
        icon={<UserCog size={18} className="text-blue-600" />}
        iconBg="bg-blue-50"
        valueColor="text-slate-800"
        badge={activeSupervisors > 0 ? 'Online' : undefined}
        badgeColor="bg-emerald-50 text-emerald-700 border-emerald-200"
      />
      <StatCard
        label="Unassigned today"
        value={unassignedToday}
        icon={<UserX size={18} className={unassignedToday > 0 ? 'text-amber-600' : 'text-emerald-600'} />}
        iconBg={unassignedToday > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
        valueColor={unassignedToday > 0 ? 'text-amber-700' : 'text-emerald-700'}
        badge={unassignedToday > 0 ? 'Action' : 'Clear'}
        badgeColor={
          unassignedToday > 0
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }
      />
      <StatCard
        label="Pending submissions"
        value={pendingSubmissions}
        icon={<Clock size={18} className={pendingSubmissions > 0 ? 'text-amber-600' : 'text-emerald-600'} />}
        iconBg={pendingSubmissions > 0 ? 'bg-amber-50' : 'bg-emerald-50'}
        valueColor={pendingSubmissions > 0 ? 'text-amber-700' : 'text-emerald-700'}
        badge={pendingSubmissions > 0 ? 'Pending' : 'All done'}
        badgeColor={
          pendingSubmissions > 0
            ? 'bg-amber-50 text-amber-700 border-amber-200'
            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
        }
      />
    </div>
  );
}
