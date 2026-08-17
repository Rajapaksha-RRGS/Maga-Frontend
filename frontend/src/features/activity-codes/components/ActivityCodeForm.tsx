/**
 * ActivityCodeForm.tsx — Add/edit form for activity codes with uniqueness validation.
 */
import { useState, useEffect, type FormEvent } from 'react';
import { AlertCircle } from 'lucide-react';
import type { ActivityCode, ActivityCodeFormData } from '../services/activityCodeService';

interface Props {
  activityCode?: ActivityCode | null;
  onSave: (data: ActivityCodeFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCancel: () => void;
  checkUnique: (code: string, excludeId?: string) => boolean;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400';

export default function ActivityCodeForm({ activityCode, onSave, onDelete, onCancel, checkUnique }: Props) {
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (activityCode) { setCode(activityCode.code); setDescription(activityCode.description); }
    else { setCode(''); setDescription(''); }
    setError(null);
  }, [activityCode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;

    // Client-side uniqueness check
    if (!checkUnique(code.trim(), activityCode?.id)) {
      setError(`Code "${code.trim()}" is already in use.`);
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({ code: code.trim().toUpperCase(), description: description.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
          <AlertCircle size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-amber-700">{error}</p>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor="ac-code" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Code *</label>
        <input id="ac-code" type="text" value={code} onChange={(e) => setCode(e.target.value)} className={`${INPUT_CLASS} font-mono`} placeholder="e.g. EW-01" required />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="ac-desc" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Description</label>
        <input id="ac-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={INPUT_CLASS} placeholder="Describe the activity" />
      </div>
      <div className="flex flex-col gap-2 pt-2">
        <button type="submit" disabled={isSaving || !code.trim()} className="w-full bg-blue-700 text-white font-medium rounded-lg min-h-[52px] px-4 transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
          {isSaving ? 'Saving…' : activityCode ? 'Save changes' : 'Add activity code'}
        </button>
        {activityCode && onDelete && (
          <button type="button" onClick={() => onDelete(activityCode.id)} className="w-full border border-slate-200 text-slate-700 font-medium rounded-lg min-h-[48px] px-4 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600">
            Delete
          </button>
        )}
        <button type="button" onClick={onCancel} className="w-full text-sm text-slate-500 py-2 transition-colors hover:text-slate-700">Cancel</button>
      </div>
    </form>
  );
}
