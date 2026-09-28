/**
 * AdminDashboardPage.tsx — Admin dashboard.
 *
 * Assembles feature components — no business logic here.
 * Layout:
 *   - Greeting bar
 *   - 4 stat cards
 *   - [Today's Activity  |  Needs Attention]  (2-col on lg+)
 *   - [Quick Actions     |  Recent Activity]  (2-col on lg+)
 */
import { useDashboardStats } from '../features/dashboard/hooks/useDashboardStats';
import DashboardStatCards from '../features/dashboard/components/DashboardStatCards';
import TodayActivityPanel from '../features/dashboard/components/TodayActivityPanel';
import NeedsAttentionPanel from '../features/dashboard/components/NeedsAttentionPanel';
import QuickActionsGrid from '../features/dashboard/components/QuickActionsGrid';
import RecentActivityFeed from '../features/dashboard/components/RecentActivityFeed';

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

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function AdminDashboardPage() {
  const stats = useDashboardStats();

  if (stats.isLoading) {
    return <DashboardSkeleton />;
  }

  return (
    <div
      className="px-4 md:px-6 py-5 min-h-0 flex flex-col gap-5 " //bg  
     style={{ background: '#F7F8FA' }}
    >
      {/* ── Stat Cards ────────────────────────────────────────────── */}
      <DashboardStatCards
        totalEmployees={stats.totalEmployees}
        activeSupervisors={stats.activeSupervisors}
        unassignedToday={stats.unassignedToday}
        pendingSubmissions={stats.pendingSubmissions}
      />

      {/* ── 1. Quick Actions Grid (Moved to Top) ─────────────────── */}
      <QuickActionsGrid />

      {/* ── 2. Middle Row: Hours by Activity Code + Needs Attention ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TodayActivityPanel
          totalSupervisors={stats.supervisorStatuses.length}
          submittedCount={stats.submittedSupervisors}
          inProgressCount={stats.inProgressSupervisors}
          supervisorStatuses={stats.supervisorStatuses}
          todayEntries={stats.todayEntries}
        />
        <NeedsAttentionPanel items={stats.attentionItems} />
      </div>

      {/* ── 3. Bottom Row: Recent Activity (Full Width / Wide) ─────── */}
      <div className="pb-6">
        <RecentActivityFeed
          entries={stats.todayEntries}
          isLoading={false}
        />
      </div>
    </div>
  );
}
