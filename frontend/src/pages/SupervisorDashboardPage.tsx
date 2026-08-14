import { Users, CheckCircle2, Clock, CalendarDays, ChevronRight } from 'lucide-react';
import { StatCard } from '../features/time-entries/components/StatCard';
import type { AssignedEmployee } from '../features/time-entries/services/timeEntryService';

interface SupervisorDashboardPageProps {
  supervisorName: string;
  employees: AssignedEmployee[];
  checkedInCount: number;
  onStartCheckin: () => void;
  /** For bottom nav — currently "today" is the only active tab */
  activeTab?: 'today' | 'history' | 'profile';
  onTabChange?: (tab: 'today' | 'history' | 'profile') => void;
}

/** Format today's date as "Thursday, 14 Aug 2026" */
function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * SupervisorDashboardPage — landing screen after supervisor login.
 * Assembles components from features/time-entries/. No business logic here.
 */
export function SupervisorDashboardPage({
  supervisorName,
  employees,
  checkedInCount,
  onStartCheckin,
  activeTab = 'today',
  onTabChange,
}: SupervisorDashboardPageProps) {
  const today = new Date();
  const assignedCount = employees.length;
  const pendingCount  = assignedCount - checkedInCount;
  const progressPct  = assignedCount > 0 ? Math.round((checkedInCount / assignedCount) * 100) : 0;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-4 pt-6 pb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
          {formatDate(today)}
        </p>
        <h1 className="text-xl font-medium text-slate-900 leading-tight">
          Good morning, {supervisorName}
        </h1>
      </header>

      {/* ── Scrollable body ─────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto px-4 py-5 space-y-5 pb-24">

        {/* Stat grid — 2×2 */}
        <section aria-label="Today's summary">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="Assigned today"
              value={assignedCount}
              icon={<Users size={18} />}
            />
            <StatCard
              label="Checked in"
              value={checkedInCount}
              variant={checkedInCount > 0 ? 'success' : 'default'}
              icon={<CheckCircle2 size={18} />}
            />
            <StatCard
              label="Pending"
              value={pendingCount}
              variant={pendingCount > 0 ? 'warning' : 'default'}
              icon={<Clock size={18} />}
            />
            <StatCard
              label="Progress"
              value={`${progressPct}%`}
              variant={progressPct === 100 ? 'success' : 'default'}
              icon={<CalendarDays size={18} />}
            />
          </div>
        </section>

        {/* Start flow CTA */}
        <button
          type="button"
          onClick={onStartCheckin}
          className={[
            'w-full flex items-center justify-between px-4 py-4 rounded-lg',
            'bg-blue-700 text-white font-medium',
            'min-h-[56px] active:bg-blue-800',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
            'transition-colors',
          ].join(' ')}
          aria-label="Start today's check-in flow"
        >
          <span>Start check-in</span>
          <ChevronRight size={20} aria-hidden="true" />
        </button>

        {/* Employee list */}
        <section aria-label="Assigned employees">
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
            Assigned workers
          </h2>

          {employees.length === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              No workers assigned for today.
            </p>
          ) : (
            <ul className="space-y-2">
              {employees.map((emp) => (
                <li
                  key={emp.id}
                  className="flex items-center gap-3 px-4 py-3 bg-white rounded-lg border border-slate-200"
                >
                  {/* Avatar initial */}
                  <div
                    className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"
                    aria-hidden="true"
                  >
                    <span className="text-sm font-medium text-slate-600">
                      {emp.callingName.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 leading-tight">
                      {emp.callingName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {emp.tradeGroup} · {emp.businessPartner}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* ── Bottom navigation ─────────────────────────────────────────────── */}
      <nav
        aria-label="App navigation"
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex"
        style={{ maxWidth: '100vw' }}
      >
        {(
          [
            { key: 'today',   label: 'Today' },
            { key: 'history', label: 'History' },
            { key: 'profile', label: 'Profile' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => onTabChange?.(tab.key)}
            aria-current={activeTab === tab.key ? 'page' : undefined}
            className={[
              'flex-1 py-3 text-sm font-medium transition-colors',
              'min-h-[52px] focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-blue-600 focus-visible:ring-inset',
              activeTab === tab.key
                ? 'text-blue-700 border-t-2 border-blue-700 -mt-px'
                : 'text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            {tab.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
