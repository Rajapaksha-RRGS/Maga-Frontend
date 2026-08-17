/**
 * AdminDashboardPage.tsx — Admin dashboard.
 * Stat cards, "needs attention" list, quick-action buttons.
 * Assembles feature components — no business logic here.
 */
import { Link } from 'react-router-dom';
import { AlertTriangle, UserX, ClipboardList, BarChart3 } from 'lucide-react';
import { useDashboardStats } from '../features/dashboard/hooks/useDashboardStats';
import StatCard from '../components/StatCard';

export default function AdminDashboardPage() {
  const stats = useDashboardStats();

  if (stats.isLoading) {
    return (
      <div className="px-4 md:px-6 py-5">
        <p className="text-sm text-slate-400 py-8 text-center">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 py-5">
      <h1 className="text-base font-medium text-slate-800 mb-5">Dashboard</h1>

      {/* Stat cards — 2×2 on mobile, 1×4 on wide */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Total employees" value={stats.totalEmployees} />
        <StatCard label="Active supervisors" value={stats.activeSupervisors} variant="success" />
        <StatCard
          label="Unassigned today"
          value={stats.unassignedToday}
          variant={stats.unassignedToday > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Pending submissions"
          value={stats.pendingSubmissions}
          variant={stats.pendingSubmissions > 0 ? 'warning' : 'default'}
        />
      </div>

      {/* Needs attention */}
      {stats.attentionItems.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Needs attention
          </h2>
          <div className="space-y-2">
            {stats.attentionItems.map((item) => (
              <Link
                key={item.id}
                to={item.link}
                className={[
                  'flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-blue-600',
                  item.type === 'unassigned'
                    ? 'bg-amber-50 border-amber-200 hover:bg-amber-100/50'
                    : 'bg-amber-50 border-amber-200 hover:bg-amber-100/50',
                ].join(' ')}
              >
                {item.type === 'unassigned' ? (
                  <UserX size={16} className="text-amber-500 flex-shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800">{item.label}</p>
                  <p className="text-xs text-amber-700">{item.detail}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
        Quick actions
      </h2>
      <div className="flex flex-wrap gap-3">
        <Link
          to="/admin/assignments"
          className="flex items-center gap-2 bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[52px] transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
        >
          <ClipboardList size={16} />
          <span>Daily assignment</span>
        </Link>
        <Link
          to="/admin/reports"
          className="flex items-center gap-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-4 min-h-[52px] transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <BarChart3 size={16} />
          <span>Reports</span>
        </Link>
      </div>
    </div>
  );
}
