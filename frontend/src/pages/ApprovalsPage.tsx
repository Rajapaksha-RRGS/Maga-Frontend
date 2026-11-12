import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  RefreshCw,
  Clock,
  Search,
  AlertCircle,
  Users,
  HardHat,
  Truck,
  X,
} from 'lucide-react';
import {
  getApprovalOverview,
  approveSupervisor,
  approveAllSubmitted,
  rejectSupervisor,
  type ApprovalOverviewResponse,
} from '../features/approvals/services/approvalService';
import { ApprovalStatsBar } from '../features/approvals/components/ApprovalStatsBar';
import { ConsolidatedApprovalView } from '../features/approvals/components/ConsolidatedApprovalView';
import { NotSubmittedCard } from '../features/approvals/components/NotSubmittedCard';
import Breadcrumb from '../components/Breadcrumb';
import { 
  getTodayLocalDateString, 
  formatLocalDateString, 
  parseLocalDate 
} from '../utils/dateUtils';

function ApprovalsSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* 3 KPI Stats Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="p-4 rounded-2xl border bg-white border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex justify-between items-center">
              <div className="h-3.5 bg-slate-200 rounded w-28" />
              <div className="h-3 bg-slate-100 rounded w-16" />
            </div>
            <div className="h-7 bg-slate-200 rounded w-24" />
            <div className="h-3 bg-slate-100 rounded w-full pt-1" />
          </div>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-slate-100" />
            <div className="space-y-1.5 flex-1">
              <div className="h-3 bg-slate-200 rounded w-28" />
              <div className="h-2.5 bg-slate-100 rounded w-36" />
            </div>
          </div>
        ))}
      </div>

      {/* Action / Search Bar Skeleton */}
      <div className="h-10 bg-white border border-slate-200 rounded-xl w-full max-w-md" />

      {/* Card Skeletons */}
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
              <div className="space-y-1.5">
                <div className="h-4 bg-slate-200 rounded w-48" />
                <div className="h-3 bg-slate-100 rounded w-32" />
              </div>
              <div className="h-8 bg-slate-200 rounded-xl w-24" />
            </div>
            <div className="h-28 bg-slate-50 rounded-xl border border-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ApprovalsPage() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return getTodayLocalDateString();
  });

  const [activeTab, setActiveTab] = useState<'submitted' | 'notSubmitted' | 'approved'>('submitted');
  const [data, setData] = useState<ApprovalOverviewResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'all' | 'labor' | 'operators' | 'equipment'>('all');

  const processingIdRef = useRef<string | null>(null);
  processingIdRef.current = processingId;

  // Fetch data on date change (supports silent background revalidation)
  const loadData = useCallback(async (date: string, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const res = await getApprovalOverview(date);
      setData(res);
      setError(null);
    } catch (err: any) {
      if (!silent) {
        setError(err?.message || 'Failed to load approval data for selected date');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadData(selectedDate, false);
  }, [selectedDate, loadData]);

  // Date step helpers
  const handlePrevDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(formatLocalDateString(d));
  };

  const handleNextDay = () => {
    const d = parseLocalDate(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(formatLocalDateString(d));
  };

  const handleToday = () => {
    setSelectedDate(getTodayLocalDateString());
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

  // Targeted filter with useMemo by selected scope (all | labor | operators | equipment)
  const filterListByScope = (
    list: NonNullable<typeof data>['submitted'],
    query: string,
    scope: 'all' | 'labor' | 'operators' | 'equipment'
  ) => {
    if (!query.trim()) return list;
    const q = query.toLowerCase().trim();

    return list.filter((s) => {
      // If scope is 'all', check supervisor name or username
      if (scope === 'all') {
        const matchesSupervisor =
          (s.supervisorName && s.supervisorName.toLowerCase().includes(q)) ||
          (s.username && s.username.toLowerCase().includes(q));
        if (matchesSupervisor) return true;
      }

      // 1. Laborer matching: Employee Code, Calling Name, Full Name, Trade Group, Business Partner
      if (scope === 'all' || scope === 'labor') {
        const matchesWorker = s.workers?.some(
          (w) =>
            (w.callingName && w.callingName.toLowerCase().includes(q)) ||
            (w.fullName && w.fullName.toLowerCase().includes(q)) ||
            (w.employeeCode && w.employeeCode.toLowerCase().includes(q)) ||
            (w.tradeGroup && w.tradeGroup.toLowerCase().includes(q)) ||
            (w.businessPartner && w.businessPartner.toLowerCase().includes(q))
        );
        if (matchesWorker) return true;
      }

      // 2. Operator matching: Operator Code, Calling Name, Full Name, Assigned Equipment Display
      if (scope === 'all' || scope === 'operators') {
        const matchesOperator = s.operators?.some(
          (o) =>
            (o.callingName && o.callingName.toLowerCase().includes(q)) ||
            (o.fullName && o.fullName.toLowerCase().includes(q)) ||
            (o.operatorCode && o.operatorCode.toLowerCase().includes(q)) ||
            (o.assignedEquipmentDisplay && o.assignedEquipmentDisplay.toLowerCase().includes(q))
        );
        if (matchesOperator) return true;
      }

      // 3. Equipment matching: Equipment Code, Maga No, Equipment Name
      if (scope === 'all' || scope === 'equipment') {
        const matchesEquipment = s.equipment?.some(
          (e) =>
            (e.equipmentCode && e.equipmentCode.toLowerCase().includes(q)) ||
            (e.magaNo && e.magaNo.toLowerCase().includes(q)) ||
            (e.equipmentName && e.equipmentName.toLowerCase().includes(q))
        );
        if (matchesEquipment) return true;
      }

      return false;
    });
  };

  const submittedFiltered = useMemo(() => {
    return data ? filterListByScope(data.submitted, searchQuery, searchScope) : [];
  }, [data, searchQuery, searchScope]);

  const notSubmittedFiltered = useMemo(() => {
    return data ? filterListByScope(data.notSubmitted, searchQuery, searchScope) : [];
  }, [data, searchQuery, searchScope]);

  const approvedFiltered = useMemo(() => {
    return data ? filterListByScope(data.approved, searchQuery, searchScope) : [];
  }, [data, searchQuery, searchScope]);

  return (
    <div className="px-4 md:px-6 py-5 w-full min-h-0 flex flex-col gap-5">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              Daily Site Operations & Approvals
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Admin Portal
            </span>
          </div>
          <Breadcrumb items={[{ label: 'Daily Approvals' }]} className="mt-1" />
        </div>

        {/* Date Selector & Day Type Badge */}
        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {/* Day Type Badge (integrated into header) */}
          {data?.dayType && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                data.dayType.isAllOvertime || data.dayType.standardHoursCap === 0
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : data.dayType.standardHoursCap === 5.5 || data.dayType.name?.toLowerCase().includes('saturday')
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-emerald-50 text-emerald-800 border-emerald-200'
              }`}
              title={`Standard Work Cap: ${data.dayType.standardHoursCap}h`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  data.dayType.isAllOvertime || data.dayType.standardHoursCap === 0
                    ? 'bg-amber-500 animate-pulse'
                    : data.dayType.standardHoursCap === 5.5 || data.dayType.name?.toLowerCase().includes('saturday')
                    ? 'bg-blue-500'
                    : 'bg-emerald-500'
                }`}
              />
              <span>{data.dayType.name}</span>
              <span className="text-[10px] text-slate-500 font-normal">
                ({data.dayType.standardHoursCap}h cap)
              </span>
            </div>
          )}

          {/* Date Selector Controls */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-xs">
            <button
              type="button"
              onClick={handlePrevDay}
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft size={16} />
            </button>

            <div className="flex items-center gap-2 px-2">
              <Calendar size={15} className="text-blue-600" />
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
              className="p-1.5 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight size={16} />
            </button>

            <button
              type="button"
              onClick={handleToday}
              className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            >
              Today
            </button>

            <button
              type="button"
              onClick={() => loadData(selectedDate)}
              className="p-1.5 rounded-xl text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition-colors cursor-pointer"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin text-blue-600' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Special Day Notice ONLY if Sunday or Holiday (0.0h standard cap) */}
      {data?.dayType && (data.dayType.isAllOvertime || data.dayType.standardHoursCap === 0) && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs">
          <AlertCircle size={16} className="text-amber-600 flex-shrink-0" />
          <span>
            <strong>Special Calendar Day Notice ({data.dayType.name}):</strong> All hours worked today are automatically calculated as Overtime (0.0h standard daily cap).
          </span>
        </div>
      )}

      {/* ── Error Banner ─────────────────────────────────────────────────────── */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs font-medium">
          {error}
        </div>
      )}

      {/* ── Main View (Skeleton or Content) ─────────────────────────────────── */}
      {loading && !data ? (
        <ApprovalsSkeleton />
      ) : (
        <div className={`space-y-5 transition-opacity duration-150 ${loading ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
          {/* KPI Stats Bar & Tab Filter */}
          {data && (
            <ApprovalStatsBar
              stats={data.stats}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          )}

          {/* Action & Search Bar */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 max-w-2xl">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    searchScope === 'labor'
                      ? 'Search laborers by name or code (e.g. EMP-01)...'
                      : searchScope === 'operators'
                      ? 'Search operators by name or code (e.g. OP-01)...'
                      : searchScope === 'equipment'
                      ? 'Search equipment by Maga No or code (e.g. MG-102)...'
                      : 'Search supervisor, laborer, operator, equipment...'
                  }
                  className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-white border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 shadow-2xs transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                    title="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* Scope Selector Pills (All | Labor | Operators | Equipment) */}
              <div className="flex items-center gap-1 bg-white border border-slate-200 p-1 rounded-xl shadow-2xs self-start sm:self-auto overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setSearchScope('all')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    searchScope === 'all'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  All
                </button>

                <button
                  type="button"
                  onClick={() => setSearchScope('labor')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    searchScope === 'labor'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  <Users size={12} />
                  <span>Labor</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchScope('operators')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    searchScope === 'operators'
                      ? 'bg-violet-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-violet-700 hover:bg-violet-50'
                  }`}
                >
                  <HardHat size={12} />
                  <span>Operators</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchScope('equipment')}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer ${
                    searchScope === 'equipment'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  <Truck size={12} />
                  <span>Equipment</span>
                </button>
              </div>
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

          {/* Content View based on Active Tab */}
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
                  <ConsolidatedApprovalView
                    groups={submittedFiltered}
                    selectedDate={selectedDate}
                    dayType={data?.dayType}
                    isApprovedView={false}
                    onApproveSupervisor={handleApproveSupervisor}
                    onRejectSupervisor={handleRejectSupervisor}
                    onRefresh={() => loadData(selectedDate)}
                    processingId={processingId}
                    searchQuery={searchQuery}
                    searchScope={searchScope}
                    onSearchScopeChange={setSearchScope}
                  />
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
                  <ConsolidatedApprovalView
                    groups={approvedFiltered}
                    selectedDate={selectedDate}
                    dayType={data?.dayType}
                    isApprovedView={true}
                    onApproveSupervisor={handleApproveSupervisor}
                    onRejectSupervisor={handleRejectSupervisor}
                    onRefresh={() => loadData(selectedDate)}
                    processingId={processingId}
                    searchQuery={searchQuery}
                    searchScope={searchScope}
                    onSearchScopeChange={setSearchScope}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
