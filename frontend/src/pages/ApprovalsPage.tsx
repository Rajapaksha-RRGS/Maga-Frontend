import { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  Clock,
  Search,
} from 'lucide-react';
import {
  getApprovalOverview,
  approveSupervisor,
  approveAllSubmitted,
  rejectSupervisor,
  type ApprovalOverviewResponse,
} from '../features/approvals/services/approvalService';
import { ApprovalDayBanner } from '../features/approvals/components/ApprovalDayBanner';
import { ApprovalStatsBar } from '../features/approvals/components/ApprovalStatsBar';
import { SupervisorApprovalCard } from '../features/approvals/components/SupervisorApprovalCard';
import { NotSubmittedCard } from '../features/approvals/components/NotSubmittedCard';

export default function ApprovalsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [activeTab, setActiveTab] = useState<'submitted' | 'notSubmitted' | 'approved'>('submitted');
  const [data, setData] = useState<ApprovalOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch data on date change
  const loadData = async (date: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await getApprovalOverview(date);
      setData(res);
      // Auto-switch to tab with items if current tab is empty
      if (res.submitted.length === 0 && res.notSubmitted.length > 0) {
        // keep activeTab unless user wants
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load approval data for selected date');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  // Date step helpers
  const handlePrevDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleNextDay = () => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  const handleToday = () => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  };

  // Approval actions
  const handleApproveSupervisor = async (supervisorId: string) => {
    setProcessingId(supervisorId);
    try {
      await approveSupervisor(supervisorId, selectedDate);
      await loadData(selectedDate);
    } catch (err: any) {
      alert(err.message || 'Failed to approve supervisor entries');
    } finally {
      setProcessingId(null);
    }
  };

  const handleApproveAll = async () => {
    if (!window.confirm(`Are you sure you want to approve all ${data?.stats.submittedCount} pending supervisor submission(s) for ${selectedDate}?`)) {
      return;
    }
    setLoading(true);
    try {
      await approveAllSubmitted(selectedDate);
      await loadData(selectedDate);
    } catch (err: any) {
      alert(err.message || 'Failed to batch approve entries');
    } finally {
      setLoading(false);
    }
  };

  const handleRejectSupervisor = async (supervisorId: string) => {
    const reason = window.prompt('Enter reason for returning back to draft (visible to supervisor):');
    if (reason === null) return; // user cancelled

    setProcessingId(supervisorId);
    try {
      await rejectSupervisor(supervisorId, selectedDate, reason);
      await loadData(selectedDate);
    } catch (err: any) {
      alert(err.message || 'Failed to return entries to draft');
    } finally {
      setProcessingId(null);
    }
  };

  // Filter lists by search query
  const filterList = (list: NonNullable<typeof data>['submitted']) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (s) =>
        s.supervisorName.toLowerCase().includes(q) ||
        s.username.toLowerCase().includes(q) ||
        s.workers.some((w) => w.callingName.toLowerCase().includes(q) || w.employeeCode.toLowerCase().includes(q))
    );
  };

  const submittedFiltered = data ? filterList(data.submitted) : [];
  const notSubmittedFiltered = data ? filterList(data.notSubmitted) : [];
  const approvedFiltered = data ? filterList(data.approved) : [];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Daily Attendance & Labour Approvals
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Admin Portal
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Review, verify, and approve daily labour attendance submitted by site supervisors.
          </p>
        </div>

        {/* Date Selector Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto bg-white border border-slate-200 p-1.5 rounded-2xl shadow-xs">
          <button
            type="button"
            onClick={handlePrevDay}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="flex items-center gap-2 px-2">
            <Calendar size={16} className="text-blue-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-800 bg-transparent border-none focus:outline-none cursor-pointer"
            />
          </div>

          <button
            type="button"
            onClick={handleNextDay}
            className="p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={18} />
          </button>

          <button
            type="button"
            onClick={handleToday}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => loadData(selectedDate)}
            className="p-2 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Refresh"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Day Type Alert Banner ────────────────────────────────────────────── */}
      <ApprovalDayBanner date={selectedDate} dayType={data?.dayType} />

      {/* ── KPI Stats Bar & Tab Filter ───────────────────────────────────────── */}
      {data && (
        <ApprovalStatsBar
          stats={data.stats}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      )}

      {/* ── Action & Search Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search supervisor, worker, or trade..."
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
          />
        </div>

        {/* Batch Approve Action */}
        {activeTab === 'submitted' && data && data.stats.submittedCount > 0 && (
          <button
            type="button"
            onClick={handleApproveAll}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-sm shadow-emerald-600/30 transition-all active:scale-[0.98] cursor-pointer"
          >
            <CheckCircle2 size={16} />
            <span>Approve All Pending ({data.stats.submittedCount})</span>
          </button>
        )}
      </div>

      {/* ── Error Banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
          {error}
        </div>
      )}

      {/* ── Content View based on Active Tab ─────────────────────────────────── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
          <RefreshCw size={28} className="animate-spin text-blue-600" />
          <p className="text-xs font-semibold">Loading daily records from database...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* TAB 1: PENDING APPROVAL (Submitted) */}
          {activeTab === 'submitted' && (
            <>
              {submittedFiltered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3">
                    <CheckCircle2 size={28} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    No Pending Submissions
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    All submitted supervisor records for this date have been reviewed and approved, or supervisors have not yet submitted.
                  </p>
                </div>
              ) : (
                submittedFiltered.map((group) => (
                  <SupervisorApprovalCard
                    key={group.supervisorId}
                    group={group}
                    onApprove={handleApproveSupervisor}
                    onReject={handleRejectSupervisor}
                    isProcessing={processingId === group.supervisorId}
                  />
                ))
              )}
            </>
          )}

          {/* TAB 2: NOT SUBMITTED / MISSING */}
          {activeTab === 'notSubmitted' && (
            <>
              {notSubmittedFiltered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                    <CheckCircle2 size={28} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    All Supervisors Have Submitted
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Every supervisor who was assigned workers for this date has submitted their attendance sheet.
                  </p>
                </div>
              ) : (
                notSubmittedFiltered.map((group) => (
                  <NotSubmittedCard key={group.supervisorId} group={group} />
                ))
              )}
            </>
          )}

          {/* TAB 3: APPROVED */}
          {activeTab === 'approved' && (
            <>
              {approvedFiltered.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
                  <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                    <Clock size={28} />
                  </div>
                  <h3 className="text-base font-bold text-slate-900">
                    No Approved Records for this Date
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                    Records approved by the admin will appear here permanently locked and verified.
                  </p>
                </div>
              ) : (
                approvedFiltered.map((group) => (
                  <SupervisorApprovalCard
                    key={group.supervisorId}
                    group={group}
                    onApprove={handleApproveSupervisor}
                    onReject={handleRejectSupervisor}
                    isProcessing={processingId === group.supervisorId}
                  />
                ))
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
