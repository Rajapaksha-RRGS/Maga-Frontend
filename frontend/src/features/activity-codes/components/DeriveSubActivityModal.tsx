/**
 * DeriveSubActivityModal.tsx
 *
 * Allows Project Site Engineers and Clerks to break down a high-level
 * Corporate / Master Activity Code into granular, site-specific derived sub-activities.
 *
 * Scoping & Business Rules:
 * - The derived activity is strictly scoped to this site (projectId).
 * - Other sites or global master catalog are not affected.
 * - In Head Office billing and cost control reports, hours automatically roll up
 *   to the parent corporateActivityCodeId.
 */
import React, { useState, useEffect } from 'react';
import {
  X,
  Split,
  FolderGit2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import type { ActivityCode } from '../services/activityCodeService';

interface DeriveSubActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentActivity: ActivityCode | null;
  existingActivities: ActivityCode[];
  onSubmit: (data: {
    code: string;
    description: string;
    unit?: string;
    parentActivityId: string;
    isDerived: boolean;
  }) => Promise<void>;
}

export default function DeriveSubActivityModal({
  isOpen,
  onClose,
  parentActivity,
  existingActivities,
  onSubmit,
}: DeriveSubActivityModalProps) {
  const [subCode, setSubCode] = useState('');
  const [description, setDescription] = useState('');
  const [unit, setUnit] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-suggest next sequential sub-activity code (e.g. ACT-2005/01)
  useEffect(() => {
    if (parentActivity) {
      const parentCode = parentActivity.code.trim();
      // Count existing derived sub-activities under this parent
      const childCount = existingActivities.filter(
        (a) => a.parentActivityId === parentActivity.id || a.code.startsWith(`${parentCode}/`)
      ).length;

      const nextSuffix = String(childCount + 1).padStart(2, '0');
      setSubCode(`${parentCode}/${nextSuffix}`);
      setDescription('');
      setUnit(parentActivity.unit || '');
      setError(null);
    }
  }, [parentActivity, existingActivities, isOpen]);

  if (!isOpen || !parentActivity) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanCode = subCode.trim().toUpperCase();
    const cleanDesc = description.trim();

    if (!cleanCode) {
      setError('Sub-activity code is strictly required.');
      return;
    }
    if (!cleanDesc) {
      setError('Operational sub-task description is strictly required.');
      return;
    }

    // Check uniqueness within the project
    const duplicate = existingActivities.find(
      (a) => a.code.toLowerCase() === cleanCode.toLowerCase()
    );
    if (duplicate) {
      setError(`Activity code "${cleanCode}" already exists in this project site.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit({
        code: cleanCode,
        description: cleanDesc,
        unit: unit.trim() || undefined,
        parentActivityId: parentActivity.id,
        isDerived: true,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create derived sub-activity.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      style={{ colorScheme: 'light' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg my-auto overflow-hidden text-slate-900 font-sans"
        style={{ colorScheme: 'light' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 p-5 text-white flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-xs border border-white/10 text-blue-200">
              <Split size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">Derive Site Sub-Activity</h2>
                <span className="text-[10px] font-semibold bg-blue-500/30 text-blue-200 border border-blue-400/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Site-Only
                </span>
              </div>
              <p className="text-xs text-blue-200/80 mt-0.5">
                Subdivide master activity into field operational tasks.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2.5 animate-shake">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Parent Master Activity Banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                <FolderGit2 size={13} className="text-indigo-600" />
                <span>Parent Master Activity (BOQ Level)</span>
              </span>
              <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.2 rounded-md">
                Master Code
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-sm font-bold text-indigo-900 bg-white border border-indigo-200 px-2 py-0.5 rounded">
                {parentActivity.code}
              </span>
              <span className="text-xs font-semibold text-slate-800">
                {parentActivity.description}
              </span>
            </div>
            {parentActivity.unit && (
              <div className="text-[11px] text-slate-500">
                Standard Unit: <span className="font-semibold text-slate-700">{parentActivity.unit}</span>
              </div>
            )}
          </div>

          {/* Site-Only Isolation Policy Notice */}
          <div className="p-3 bg-blue-50/70 border border-blue-200/80 rounded-xl text-blue-900 text-xs flex items-start gap-2.5">
            <Sparkles size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <div className="text-[11px] leading-relaxed text-blue-800">
              <strong>Site Scoping & HO Roll-up:</strong> This sub-activity will be used exclusively at this site. In Head Office billing and cost summaries, all labor & equipment hours will automatically roll up under <strong>{parentActivity.code}</strong>.
            </div>
          </div>

          {/* Sub-Activity Code Input */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Sub-Activity Code <span className="text-red-500">*</span>
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Suggested format: {parentActivity.code}/01
              </span>
            </div>
            <div className="relative">
              <input
                type="text"
                required
                value={subCode}
                onChange={(e) => setSubCode(e.target.value.toUpperCase())}
                placeholder="e.g. ACT-2005/01"
                className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono uppercase font-bold tracking-wide placeholder:text-slate-400"
              />
            </div>
          </div>

          {/* Sub-Activity Description Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operational Task Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Formwork & Shuttering for Slab B"
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder:text-slate-400"
            />
          </div>

          {/* Sub-Activity Unit of Measurement */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Unit of Measurement (Optional)
            </label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="e.g. m², hrs, m³, kg, loads"
              className="w-full px-3 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-medium placeholder:text-slate-400"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 active:bg-blue-900 rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Deriving Sub-Activity…</span>
                </>
              ) : (
                <>
                  <Split size={14} />
                  <span>Save Site Sub-Activity</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
