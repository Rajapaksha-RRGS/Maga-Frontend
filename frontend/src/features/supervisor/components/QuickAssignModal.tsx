import { useState } from 'react';
import { X, Search, UserPlus, CheckCircle2 } from 'lucide-react';
import { STANDBY_WORKERS_POOL, type LaborerEntry } from '../services/supervisorStorageService';

interface QuickAssignModalProps {
  open: boolean;
  onClose: () => void;
  onAssignWorker: (worker: Omit<LaborerEntry, 'status'>) => void;
  alreadyAssignedIds: string[];
}

export function QuickAssignModal({
  open,
  onClose,
  onAssignWorker,
  alreadyAssignedIds,
}: QuickAssignModalProps) {
  const [search, setSearch] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);

  if (!open) return null;

  const availableWorkers = STANDBY_WORKERS_POOL.filter((w) => {
    const isAlreadyIn = alreadyAssignedIds.includes(w.id);
    const matchesSearch = 
      w.callingName.toLowerCase().includes(search.toLowerCase()) ||
      w.tradeGroup.toLowerCase().includes(search.toLowerCase()) ||
      w.businessPartner.toLowerCase().includes(search.toLowerCase());
    return !isAlreadyIn && matchesSearch;
  });

  const handleConfirm = () => {
    if (!selectedWorkerId) return;
    const found = STANDBY_WORKERS_POOL.find((w) => w.id === selectedWorkerId);
    if (!found) return;

    onAssignWorker({
      id: found.id,
      employeeCode: (found as any).employeeCode || `EMP-${found.id.slice(-3)}`,
      callingName: found.callingName,
      tradeGroup: found.tradeGroup,
      businessPartner: found.businessPartner,
      nic: found.nic,
      inTime: '08:00',
      outTime: '17:00',
      shiftHours: 8.0,
      otHours: 0,
      activities: [{ id: `act-${Date.now()}`, activityCode: 'ACT-101', hours: 8.0 }],
      isStandbyAssigned: true,
      lastSavedAt: 'Just now',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 w-full max-w-sm shadow-2xl space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <UserPlus size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Quick Assign Laborer
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Add standby workers to today's site gang
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search standby worker by name or trade…"
            className="w-full pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        {/* Worker List */}
        <div className="max-h-56 overflow-y-auto space-y-1.5 pr-0.5">
          {availableWorkers.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No standby workers found matching criteria.
            </div>
          ) : (
            availableWorkers.map((w) => {
              const isSelected = selectedWorkerId === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setSelectedWorkerId(w.id)}
                  className={[
                    'w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between',
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-mono font-bold text-slate-700 dark:text-slate-300 text-[10px]">
                      {(w as any).employeeCode ? (w as any).employeeCode.slice(-3) : w.callingName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-slate-100 font-mono">{(w as any).employeeCode || w.id}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">({w.callingName})</span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">{w.tradeGroup} · {w.businessPartner}</p>
                    </div>
                  </div>
                  {isSelected && <CheckCircle2 size={16} className="text-blue-600 dark:text-blue-400" />}
                </button>
              );
            })
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!selectedWorkerId}
            className="flex-1 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-medium text-xs disabled:opacity-50 transition-colors"
          >
            Assign to Today
          </button>
        </div>
      </div>
    </div>
  );
}
