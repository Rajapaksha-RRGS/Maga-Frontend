import { Users, CheckCircle2, Clock, CalendarDays, ChevronRight } from 'lucide-react';
import { StatCard } from '../features/time-entries/components/StatCard';
import type { AssignedEmployee } from '../features/time-entries/services/timeEntryService';

interface SupervisorDashboardPageProps {
  supervisorName: string;
  employees: AssignedEmployee[];
  checkedInCount: number;
  submitStatus?: 'idle' | 'submitting' | 'submitted' | 'error';
  submittedInfo?: {
    supervisorName: string;
    username: string;
    submittedAt: string | null;
  } | null;
  entries?: Record<string, any>;
  onStartCheckin: () => void;
  onContinueCheckout?: () => void;
  onContinueActivities?: () => void;
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

function formatTimestamp(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * SupervisorDashboardPage — landing screen after supervisor login.
 * Assembles components from features/time-entries/. No business logic here.
 *
 * Desktop: content centered in a max-w-lg column, bottom nav constrained
 * to the same column so it never spans the full screen width.
 */
export function SupervisorDashboardPage({
  supervisorName,
  employees,
  checkedInCount,
  submitStatus = 'idle',
  submittedInfo,
  entries = {},
  onStartCheckin,
  onContinueCheckout,
  onContinueActivities,
  activeTab = 'today',
  onTabChange,
}: SupervisorDashboardPageProps) {
  const today = new Date();
  const assignedCount = employees.length;
  const pendingCount  = assignedCount - checkedInCount;
  const progressPct  = assignedCount > 0 ? Math.round((checkedInCount / assignedCount) * 100) : 0;
  const isSubmitted = submitStatus === 'submitted';

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">

      {/* ── Centered content column ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 w-full max-w-lg mx-auto">

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

          {/* Submitted Audit Banner */}
          {isSubmitted && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-emerald-900">Day Submitted & Locked</h3>
                  <span className="px-2 py-0.5 bg-emerald-200 text-emerald-800 text-[10px] font-bold uppercase rounded-full tracking-wider">
                    Completed
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-1">
                  Submitted by <span className="font-semibold">{submittedInfo?.supervisorName || supervisorName}</span>
                  {submittedInfo?.username && <span className="text-emerald-600"> (@{submittedInfo.username})</span>}
                  {submittedInfo?.submittedAt && <span> on {formatTimestamp(submittedInfo.submittedAt)}</span>}
                </p>
              </div>
            </div>
          )}

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
                value={`${isSubmitted ? 100 : progressPct}%`}
                variant={isSubmitted || progressPct === 100 ? 'success' : 'default'}
                icon={<CalendarDays size={18} />}
              />
            </div>
          </section>

          {/* Start flow / Continue CTA */}
          {isSubmitted ? (
            <button
              type="button"
              onClick={onContinueActivities || onStartCheckin}
              className="w-full flex items-center justify-between px-4 py-4 rounded-lg font-medium min-h-[56px] transition-colors bg-emerald-700 text-white active:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
              aria-label="View submitted daily summary"
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} />
                <span>View Submitted Day Records</span>
              </div>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          ) : checkedInCount > 0 ? (
            <button
              type="button"
              onClick={onContinueCheckout || onStartCheckin}
              className="w-full flex items-center justify-between px-4 py-4 rounded-lg font-medium min-h-[56px] transition-colors bg-blue-700 text-white active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              aria-label="Continue today's flow"
            >
              <span>Continue: Checkout & Activities</span>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onStartCheckin}
              disabled={employees.length === 0}
              className={[
                'w-full flex items-center justify-between px-4 py-4 rounded-lg font-medium min-h-[56px] transition-colors',
                employees.length === 0
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-blue-700 text-white active:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2',
              ].join(' ')}
              aria-label="Start today's check-in flow"
            >
              <span>Start check-in</span>
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          )}

          {/* Employee list */}
          <section aria-label="Assigned employees">
            <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">
              Assigned workers
            </h2>

            {employees.length === 0 ? (
              <div className="text-center py-10 px-4 bg-white rounded-lg border border-dashed border-slate-300">
                <Users className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-700">No workers assigned for today</p>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  Site administration has not assigned any workers to your gang for today. Once assigned by Admin, they will appear here.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {employees.map((emp) => {
                  const entry = entries[emp.id];
                  return (
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
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-slate-800 leading-tight">
                            {emp.callingName}
                          </p>
                          {entry?.inTime && (
                            <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                              In: {entry.inTime} {entry.outTime ? `· Out: ${entry.outTime}` : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {emp.tradeGroup} · {emp.businessPartner}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </main>

        {/* ── Bottom navigation — constrained to the same column ─────────────── */}
        <nav
          aria-label="App navigation"
          className="bg-white border-t border-slate-200 flex sticky bottom-0"
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

      </div>{/* end centered column */}
    </div>
  );
}
