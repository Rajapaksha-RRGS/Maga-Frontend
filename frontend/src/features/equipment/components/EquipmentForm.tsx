/**
 * EquipmentForm.tsx — Add/edit form for equipment (name, type).
 */
import { useState, useEffect, type FormEvent } from 'react';
import type { Equipment, EquipmentFormData } from '../services/equipmentService';

interface Props {
  equipment?: Equipment | null;
  onSave: (data: EquipmentFormData) => Promise<void>;
  onDeactivate?: (id: string) => Promise<void>;
  onCancel: () => void;
}

const INPUT_CLASS =
  'w-full px-4 py-3 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm min-h-[44px] focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition-colors placeholder:text-slate-400';

export default function EquipmentForm({ equipment, onSave, onDeactivate, onCancel }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (equipment) { setName(equipment.name); setType(equipment.type); }
    else { setName(''); setType(''); }
  }, [equipment]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSaving(true);
    try { await onSave({ name: name.trim(), type: type.trim() }); }
    finally { setIsSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="equip-name" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Name *</label>
        <input id="equip-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} placeholder="Equipment name" required />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="equip-type" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Type</label>
        <input id="equip-type" type="text" value={type} onChange={(e) => setType(e.target.value)} className={INPUT_CLASS} placeholder="e.g. Heavy machinery" />
      </div>
      <div className="flex flex-col gap-2 pt-2">
        <button type="submit" disabled={isSaving || !name.trim()} className="w-full bg-blue-700 text-white font-medium rounded-lg min-h-[52px] px-4 transition-colors active:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed">
          {isSaving ? 'Saving…' : equipment ? 'Save changes' : 'Add equipment'}
        </button>
        {equipment && equipment.status === 'active' && onDeactivate && (
          <button type="button" onClick={() => onDeactivate(equipment.id)} className="w-full border border-slate-200 text-slate-700 font-medium rounded-lg min-h-[48px] px-4 transition-colors hover:bg-slate-50 active:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-600">
            Deactivate
          </button>
        )}
        <button type="button" onClick={onCancel} className="w-full text-sm text-slate-500 py-2 transition-colors hover:text-slate-700">Cancel</button>
      </div>
    </form>
  );
}
