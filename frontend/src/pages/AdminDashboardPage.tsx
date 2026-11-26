/**
 * AdminDashboardPage.tsx — Admin dashboard with Operations & Cost Analytics tabs.
 *
 * Layout:
 *   Tab: Operations Overview (default)
 *     - Greeting bar / Refresh
 *     - 4 stat cards
 *     - Quick Actions
 *     - [Today's Activity  |  Needs Attention]
 *     - Recent Activity
 *
 *   Tab: Cost Analytics (BI Dashboard)
 *     - Period filter bar
 *     - 4 KPI cards with trend %
 *     - [Daily Cost Trend chart  |  Resource Mix donut]
 *     - [Activity Costs  |  Trade Group Costs]
 *     - [BP Spend leaderboard  |  Equipment Efficiency]
 *     - Summary footer
 */
import { useState } from 'react';
import { RotateCw, BarChart3, Activity } from 'lucide-react';
import { useDashboardStats } from '../features/dashboard/hooks/useDashboardStats';
import { useCostDashboard } from '../features/dashboard/hooks/useCostDashboard';
import DashboardStatCards from '../features/dashboard/components/DashboardStatCards';
import TodayActivityPanel from '../features/dashboard/components/TodayActivityPanel';
import NeedsAttentionPanel from '../features/dashboard/components/NeedsAttentionPanel';
import QuickActionsGrid from '../features/dashboard/components/QuickActionsGrid';
import RecentActivityFeed from '../features/dashboard/components/RecentActivityFeed';
import CostDashboardPanel from '../features/dashboard/components/CostDashboardPanel';

type DashboardTab = 'operations' | 'cost';

/* ── Skeleton loader for initial load ─────────────────────────────────── */
function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 shadow-sm animate-pulse ${className}`}>
      <div className="p-5 space-y-3">
        <div className="h-3 bg-slate-100 rounded w-1/3" />
        <div className="h-8 bg-slate-100 rounded w-1/2" />
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="px-4 md:px-6 py-5 min-h-0 flex flex-col gap-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="min-h-[100px]" />)}
      </div>
      {/* Middle row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard className="min-h-[220px]" />
        <SkeletonCard className="min-h-[220px]" />
      </div>
      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonCard className="min-h-[240px]" />
        <SkeletonCard className="min-h-[240px]" />
      </div>
    </div>
  );
}

function CostSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} className="min-h-[120px]" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <SkeletonCard className="lg:col-span-2 min-h-[380px]" />
        <SkeletonCard className="min-h-[380px]" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SkeletonCard className="min-h-[400px]" />
        <SkeletonCard className="min-h-[400px]" />
      </div>
    </div>
  );
}

/* ── Tab Button ────────────────────────────────────────────────────────── */

function TabButton({
  active, label, icon, onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all duration-200
        ${active
          ? 'bg-white text-slate-900 shadow-sm border border-slate-200/80'
          : 'text-slate-500 hover:text-slate-700 hover:bg-white/60 border border-transparent'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<DashboardTab>('operations');
  const stats = useDashboardStats();
  const costDash = useCostDashboard();

  if (activeTab === 'operations' && stats.isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div
      className="px-4 md:px-6 py-5 min-h-0 flex flex-col gap-5"
      style={{ background: '#F7F8FA' }}
    >
      {/* ── Header: Title + Tabs + Refresh ──────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Tab Switcher */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/80 rounded-xl">
            <TabButton
              active={activeTab === 'operations'}
              label="Operations"
              icon={<Activity size={14} />}
              onClick={() => setActiveTab('operations')}
            />
            <TabButton
              active={activeTab === 'cost'}
              label="Cost Analytics"
              icon={<BarChart3 size={14} />}
              onClick={() => setActiveTab('cost')}
            />
          </div>
        </div>

        {activeTab === 'operations' && (
          <div className="flex items-center gap-3">
            <div className="hidden sm:block">
              <p className="text-xs text-slate-500">Click Refresh to pull the latest supervisor & attendance updates.</p>
            </div>
            <button
              type="button"
              onClick={stats.refresh}
              disabled={stats.isRefreshing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-xs disabled:opacity-60 cursor-pointer"
              title="Refresh dashboard stats"
            >
              <RotateCw size={14} className={stats.isRefreshing ? 'animate-spin text-blue-600' : ''} />
              <span>{stats.isRefreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Operations Tab Content ──────────────────────────────────── */}
      {activeTab === 'operations' && (
        <>
          {/* ── Stat Cards ──────────────────────────────────────────── */}
          <DashboardStatCards
            totalEmployees={stats.totalEmployees}
            activeSupervisors={stats.activeSupervisors}
            unassignedToday={stats.unassignedToday}
            pendingSubmissions={stats.pendingSubmissions}
          />

          {/* ── Quick Actions Grid ──────────────────────────────────── */}
          <QuickActionsGrid />

          {/* ── Middle Row ──────────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <TodayActivityPanel
              totalSupervisors={stats.supervisorStatuses.length}
              submittedCount={stats.submittedSupervisors}
              inProgressCount={stats.inProgressSupervisors}
              supervisorStatuses={stats.supervisorStatuses}
              todayEntries={stats.todayEntries}
              activityCodes={stats.activityCodes}
            />
            <NeedsAttentionPanel items={stats.attentionItems} />
          </div>

          {/* ── Bottom Row ──────────────────────────────────────────── */}
          <div className="pb-6">
            <RecentActivityFeed
              entries={stats.todayEntries}
              isLoading={false}
            />
          </div>
        </>
      )}

      {/* ── Cost Analytics Tab Content ─────────────────────────────── */}
      {activeTab === 'cost' && (
        <>
          {costDash.isLoading ? (
            <CostSkeleton />
          ) : costDash.error ? (
            <div className="bg-white rounded-2xl border border-rose-200 shadow-sm p-8 flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center">
                <BarChart3 size={24} className="text-rose-400" />
              </div>
              <p className="text-sm font-semibold text-slate-700">Failed to load cost data</p>
              <p className="text-xs text-slate-400 text-center max-w-sm">{costDash.error}</p>
              <button
                type="button"
                onClick={costDash.refresh}
                className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors"
              >
                <RotateCw size={13} />
                Try Again
              </button>
            </div>
          ) : costDash.data ? (
            <CostDashboardPanel
              data={costDash.data}
              isRefreshing={costDash.isRefreshing}
              onRefresh={costDash.refresh}
              filters={costDash.filters}
              onFiltersChange={costDash.setFilters}
            />
          ) : null}
        </>
      )}
    </div>
  );
}
