/**
 * AssignmentToolbar.tsx — Date picker, past days gang picker modal, copy previous day, bulk-assign controls.
 */
import { useState } from 'react';
import { Copy, Users, History, Calendar, Check, X, ChevronRight } from 'lucide-react';
import type { Supervisor } from '../../supervisors/services/supervisorService';
import type { RecentGangSummary } from '../services/assignmentService';

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onCopyPreviousDay: () => Promise<void>;
  onCopyFromDate?: (sourceDate: string, supervisorIds?: string[]) => Promise<void>;
  supervisors: Supervisor[];
  tradeGroups: string[];
  businessPartners: string[];
  onBulkAssign: (supervisorId: string, filter: { tradeGroup?: string; businessPartner?: string }) => Promise<void>;
  getRecentGangSummaries?: (days?: number) => Promise<RecentGangSummary[]>;
}

const SELECT_CLASS =
  'px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors';

export default function AssignmentToolbar({
  selectedDate,
  onDateChange,
  onCopyPreviousDay,
  onCopyFromDate,
  supervisors,
  tradeGroups,
  businessPartners,
  onBulkAssign,
  getRecentGangSummaries,
}: Props) {
  const [showBulk, setShowBulk] = useState(false);
  const [showPastGangsModal, setShowPastGangsModal] = useState(false);
  const [recentGangs, setRecentGangs] = useState<RecentGangSummary[]>([]);
  const [loadingPastGangs, setLoadingPastGangs] = useState(false);
  const [customPastDate, setCustomPastDate] = useState('');
  const [copySuccessMsg, setCopySuccessMsg] = useState<string | null>(null);

  const [bulkSupervisorId, setBulkSupervisorId] = useState('');
  const [bulkTG, setBulkTG] = useState('');
  const [bulkBP, setBulkBP] = useState('');

  // Fetch recent 5 days gang records when modal opens
  const openPastGangsModal = async () => {
    setShowPastGangsModal(true);
    setLoadingPastGangs(true);
    try {
      if (getRecentGangSummaries) {
        const data = await getRecentGangSummaries(5);
        setRecentGangs(data);
      }
    } catch (err) {
      console.error('Failed to load recent gangs:', err);
    } finally {
      setLoadingPastGangs(false);
    }
  };

  const handleApplyPastGang = async (sourceDate: string) => {
    if (!onCopyFromDate) {
      await onCopyPreviousDay();
      return;
    }
    await onCopyFromDate(sourceDate);
    setCopySuccessMsg(`Gangs from ${sourceDate} copied successfully to ${selectedDate}!`);
    setTimeout(() => {
      setCopySuccessMsg(null);
      setShowPastGangsModal(false);
    }, 1500);
  };

  const handleBulkAssign = async () => {
    if (!bulkSupervisorId) return;
    await onBulkAssign(bulkSupervisorId, {
      tradeGroup: bulkTG || undefined,
      businessPartner: bulkBP || undefined,
    });
    setShowBulk(false);
    setBulkSupervisorId('');
    setBulkTG('');
    setBulkBP('');
  };

  // Helper to format date with day name
  const formatFriendlyDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `${dateStr} (${dayNames[d.getUTCDay()]})`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date picker */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Target Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onDateChange(e.target.value)}
            className={`${SELECT_CLASS} font-mono`}
          />
        </div>

        {/* Copy Gang from Past Days (Modal Trigger) */}
        <button
          type="button"
          onClick={openPastGangsModal}
          className="flex items-center gap-2 border border-blue-200 bg-blue-50/70 text-blue-800 font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-blue-100 active:bg-blue-200 focus-visible:ring-2 focus-visible:ring-blue-600"
          title="Pick and copy gang from past 5 days"
        >
          <History size={16} className="text-blue-700" />
          <span>Copy Gang from Past Days</span>
        </button>

        {/* Quick Copy 1 Day Previous */}
        <button
          type="button"
          onClick={onCopyPreviousDay}
          className="flex items-center gap-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Copy size={16} />
          <span>Copy yesterday</span>
        </button>

        {/* Bulk assign toggle */}
        <button
          type="button"
          onClick={() => setShowBulk(!showBulk)}
          className="flex items-center gap-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Users size={16} />
          <span>Bulk assign</span>
        </button>
      </div>

      {/* Bulk assign controls */}
      {showBulk && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Supervisor</label>
            <select value={bulkSupervisorId} onChange={(e) => setBulkSupervisorId(e.target.value)} className={SELECT_CLASS}>
              <option value="">Select supervisor</option>
              {supervisors.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Trade group</label>
            <select value={bulkTG} onChange={(e) => setBulkTG(e.target.value)} className={SELECT_CLASS}>
              <option value="">Any</option>
              {tradeGroups.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Business partner</label>
            <select value={bulkBP} onChange={(e) => setBulkBP(e.target.value)} className={SELECT_CLASS}>
              <option value="">Any</option>
              {businessPartners.map((bp) => <option key={bp} value={bp}>{bp}</option>)}
            </select>
          </div>
          <button
            onClick={handleBulkAssign}
            disabled={!bulkSupervisorId}
            className="bg-blue-700 text-white font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            Assign matching
          </button>
        </div>
      )}

      {/* ── Past Gangs Selection Modal ── */}
      {showPastGangsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <History size={20} className="text-blue-700" />
                <div>
                  <h2 className="text-base font-semibold text-slate-800">Copy Gang From Past Days</h2>
                  <p className="text-xs text-slate-500">Apply previous gang allocations to {selectedDate}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPastGangsModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Success Toast Banner */}
            {copySuccessMsg && (
              <div className="mx-5 mt-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-sm flex items-center gap-2">
                <Check size={16} className="text-emerald-600" />
                <span>{copySuccessMsg}</span>
              </div>
            )}

            {/* Content List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {loadingPastGangs ? (
                <p className="text-center py-6 text-sm text-slate-400">Loading past gang records…</p>
              ) : recentGangs.length === 0 ? (
                <div className="text-center py-6">
                  <Calendar size={36} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-sm text-slate-600 font-medium">No previous gang records stored yet.</p>
                  <p className="text-xs text-slate-400 mt-1">You can pick any custom date below to check.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
                    Recorded Gangs (Past 5 Days):
                  </p>
                  {recentGangs.map((item) => (
                    <div
                      key={item.date}
                      className="border border-slate-200 rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-slate-800">
                            {formatFriendlyDate(item.date)}
                          </span>
                          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full">
                            {item.totalWorkers} workers
                          </span>
                        </div>
                        {item.gangs && item.gangs.length > 0 && (
                          <p className="text-xs text-slate-500 mt-1 truncate">
                            {item.gangs.map((g) => `${g.supervisorName}: ${g.workerCount}`).join(' • ')}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleApplyPastGang(item.date)}
                        className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors flex-shrink-0"
                      >
                        <span>Apply Gang</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Custom Date Option */}
              <div className="pt-4 border-t border-slate-100">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 block mb-2">
                  Or Pick Any Other Past Date:
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customPastDate}
                    max={selectedDate}
                    onChange={(e) => setCustomPastDate(e.target.value)}
                    className={`${SELECT_CLASS} font-mono flex-1`}
                  />
                  <button
                    type="button"
                    disabled={!customPastDate}
                    onClick={() => handleApplyPastGang(customPastDate)}
                    className="bg-slate-800 hover:bg-slate-900 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-medium px-4 min-h-[44px] rounded-lg transition-colors"
                  >
                    Copy That Date
                  </button>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setShowPastGangsModal(false)}
                className="text-xs font-medium text-slate-600 hover:text-slate-800 px-4 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
