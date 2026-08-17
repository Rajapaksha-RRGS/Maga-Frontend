/**
 * AssignmentToolbar.tsx — Date picker, copy previous day, bulk-assign controls.
 */
import { useState } from 'react';
import { Copy, Users } from 'lucide-react';
import type { Supervisor } from '../../supervisors/services/supervisorService';

interface Props {
  selectedDate: string;
  onDateChange: (date: string) => void;
  onCopyPreviousDay: () => Promise<void>;
  supervisors: Supervisor[];
  tradeGroups: string[];
  businessPartners: string[];
  onBulkAssign: (supervisorId: string, filter: { tradeGroup?: string; businessPartner?: string }) => Promise<void>;
}

const SELECT_CLASS =
  'px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-800 min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors';

export default function AssignmentToolbar({
  selectedDate, onDateChange, onCopyPreviousDay,
  supervisors, tradeGroups, businessPartners, onBulkAssign,
}: Props) {
  const [showBulk, setShowBulk] = useState(false);
  const [bulkSupervisorId, setBulkSupervisorId] = useState('');
  const [bulkTG, setBulkTG] = useState('');
  const [bulkBP, setBulkBP] = useState('');

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Date picker */}
        <input
          type="date"
          value={selectedDate}
          onChange={(e) => onDateChange(e.target.value)}
          className={`${SELECT_CLASS} font-mono`}
        />

        {/* Copy previous day */}
        <button
          onClick={onCopyPreviousDay}
          className="flex items-center gap-2 border border-slate-200 text-slate-700 font-medium text-sm rounded-lg px-4 min-h-[44px] transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <Copy size={16} />
          <span>Copy previous day</span>
        </button>

        {/* Bulk assign toggle */}
        <button
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
    </div>
  );
}
