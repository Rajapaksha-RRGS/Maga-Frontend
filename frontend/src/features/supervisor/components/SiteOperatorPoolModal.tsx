import { useState, useEffect, useMemo } from 'react';
import {
  HardHat,
  Search,
  X,
  Plus,
  Lock,
  UserCheck,
} from 'lucide-react';
import {
  supervisorStorage,
  type OperatorEntry,
} from '../services/supervisorStorageService';
import { useAuth } from '../../../context/AuthContext';

interface SiteOperatorPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string;
  currentOperators: OperatorEntry[];
  onAddOperator: (newOperator: OperatorEntry) => void;
  projectId?: string;
}

export function SiteOperatorPoolModal({
  isOpen,
  onClose,
  selectedDate,
  currentOperators,
  onAddOperator,
  projectId,
}: SiteOperatorPoolModalProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState('');
  const [poolOperators, setPoolOperators] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    supervisorStorage
      .fetchSiteOperatorPool(projectId, selectedDate, user?.id)
      .then((items) => setPoolOperators(items))
      .catch((err) => console.warn('Could not load operator pool:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen, selectedDate, projectId, user?.id]);

  // Set of IDs already in the current supervisor's active daily list
  const currentIds = useMemo(() => {
    return new Set(currentOperators.map((o) => o.id));
  }, [currentOperators]);

  // Filtered pool operators
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return poolOperators.filter((op) => {
      if (!q) return true;
      return (
        op.callingName?.toLowerCase().includes(q) ||
        op.fullName?.toLowerCase().includes(q) ||
        op.employeeCode?.toLowerCase().includes(q) ||
        op.tradeGroup?.toLowerCase().includes(q)
      );
    });
  }, [poolOperators, search]);

  const handleAddSingle = (op: any) => {
    const newEntry: OperatorEntry = {
      id: op.id,
      callingName: op.callingName || op.fullName || 'Operator',
      employeeNumber: op.employeeCode || '',
      licenseNo: op.nicNo || '',
      designation: op.tradeGroup || 'Machine Operator',
      inTime: '',
      outTime: '',
      shiftHours: 0,
      otHours: 0,
      assignedEquipmentId: '',
      equipmentSplits: [],
      status: 'pending',
      claimedBySupervisor: op.claimedBySupervisor,
      claimedSupervisorId: op.claimedSupervisorId,
      claimedInTime: op.claimedInTime,
      claimedOutTime: op.claimedOutTime,
      claimedHours: op.claimedHours,
      claimedMachineCodes: op.claimedMachineCodes,
      claimedByMe: op.claimedByMe,
    };
    onAddOperator(newEntry);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[85vh] overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 bg-white dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/80 flex items-center justify-center shadow-xs">
              <HardHat size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Site Operator Pool
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-900/60">
                  Self-Dispatch
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Select machinery operators allocated to this site for your shift.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Search Bar ── */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Operator Code or Name..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 shadow-2xs"
              autoFocus
            />
          </div>
        </div>

        {/* ── Operator List ── */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px]">
          {isLoading ? (
            <div className="py-12 text-center text-xs text-slate-400 space-y-2">
              <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin mx-auto" />
              <p>Fetching active site operators...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center bg-slate-50 dark:bg-slate-850 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-6">
              <HardHat className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                No operators found in site pool
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Make sure operators are allocated to this site project.
              </p>
            </div>
          ) : (
            filtered.map((op) => {
              const isAlreadyAdded = currentIds.has(op.id);

              return (
                <div
                  key={op.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    isAlreadyAdded
                      ? 'bg-slate-50/70 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 opacity-60'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 dark:text-slate-100">
                        {op.employeeCode}
                      </span>
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {op.callingName}
                      </span>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200">
                        {op.tradeGroup}
                      </span>
                    </div>

                    {op.fullName && op.fullName !== op.callingName && (
                      <p className="text-[11px] text-slate-400 truncate">
                        {op.fullName}
                      </p>
                    )}

                    {/* Claimed / Shared Info */}
                    {op.claimedBySupervisor && !op.claimedByMe && (
                      <div className="flex items-center gap-1 text-[10px] text-amber-700 dark:text-amber-300 font-semibold pt-0.5">
                        <Lock size={10} className="text-amber-600" />
                        <span>Logged by Sup. {op.claimedBySupervisor} ({op.claimedInTime || '--:--'} - {op.claimedOutTime || '--:--'}{op.claimedMachineCodes && op.claimedMachineCodes.length > 0 ? ` on ${op.claimedMachineCodes.join(', ')}` : ''})</span>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isAlreadyAdded ? (
                      <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <UserCheck size={14} className="text-blue-500" /> Added
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleAddSingle(op)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-2xs transition-colors cursor-pointer"
                      >
                        <Plus size={13} className="stroke-[3]" />
                        <span>Add</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Footer ── */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

