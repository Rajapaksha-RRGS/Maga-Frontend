import { useState } from 'react';
import { X, Users, CheckSquare, Square, CheckCircle2 } from 'lucide-react';
import { MASTER_ACTIVITIES, type LaborerEntry } from '../services/supervisorStorageService';

interface BulkUpdateModalProps {
  open: boolean;
  onClose: () => void;
  laborers: LaborerEntry[];
  onApplyBulk: (selectedIds: string[], inTime: string, outTime: string, activityCode: string, hours: number) => void;
}

export function BulkUpdateModal({
  open,
  onClose,
  laborers,
  onApplyBulk,
}: BulkUpdateModalProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => laborers.map((l) => l.id));
  const [bulkIn, setBulkIn] = useState('08:00');
  const [bulkOut, setBulkOut] = useState('17:00');
  const [bulkActivity, setBulkActivity] = useState(MASTER_ACTIVITIES[0].code);
  const [bulkHours, setBulkHours] = useState(8.0);

  if (!open) return null;

  const toggleSelectAll = () => {
    if (selectedIds.length === laborers.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(laborers.map((l) => l.id));
    }
  };

  const toggleWorker = (id: string) => {
    setSelectedIds((prev) => 
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const handleConfirm = () => {
    if (selectedIds.length === 0) return;
    onApplyBulk(selectedIds, bulkIn, bulkOut, bulkActivity, bulkHours);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 w-full max-w-sm shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 flex items-center justify-center">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Bulk Labor Entry Update
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Apply times & activity codes to multiple workers
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

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-0.5">

          {/* Time Inputs */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                In Time
              </label>
              <input
                type="time"
                value={bulkIn}
                onChange={(e) => setBulkIn(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
                Out Time
              </label>
              <input
                type="time"
                value={bulkOut}
                onChange={(e) => setBulkOut(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Activity Code Selection */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Primary Master Activity Code
            </label>
            <select
              value={bulkActivity}
              onChange={(e) => setBulkActivity(e.target.value)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600 font-medium"
            >
              {MASTER_ACTIVITIES.map((act) => (
                <option key={act.code} value={act.code}>
                  {act.code} — {act.name}
                </option>
              ))}
            </select>
          </div>

          {/* Allocated Hours */}
          <div>
            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">
              Allocated Hours for Selected Activity
            </label>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              value={bulkHours}
              onChange={(e) => setBulkHours(parseFloat(e.target.value) || 0)}
              className="w-full px-2.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-600"
            />
          </div>

          {/* Worker Selection List */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Target Laborers ({selectedIds.length}/{laborers.length})
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                {selectedIds.length === laborers.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1 border border-slate-200 dark:border-slate-800 rounded-xl p-1.5 bg-slate-50/50 dark:bg-slate-850">
              {laborers.map((l) => {
                const checked = selectedIds.includes(l.id);
                return (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggleWorker(l.id)}
                    className="w-full text-left p-1.5 rounded-lg flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs"
                  >
                    {checked ? (
                      <CheckSquare size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0" />
                    ) : (
                      <Square size={16} className="text-slate-400 flex-shrink-0" />
                    )}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-bold text-slate-900 dark:text-slate-100 font-mono text-xs">{l.employeeCode || l.id}</span>
                      <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate">({l.callingName})</span>
                    </div>
                    <span className="text-[10px] text-slate-400 ml-auto flex-shrink-0">{l.tradeGroup}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 flex-shrink-0">
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
            disabled={selectedIds.length === 0}
            className="flex-1 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold text-xs disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 size={14} />
            <span>Apply to {selectedIds.length} Workers</span>
          </button>
        </div>
      </div>
    </div>
  );
}
