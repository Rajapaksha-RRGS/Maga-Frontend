/**
 * EquipmentForm.tsx — Add/edit form for equipment with primary unit + available units.
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

const ALL_RATING_UNITS = [
  { code: 'mth',    label: 'mth – Service Meter Hours',  icon: '⚙️' },
  { code: 'Days',   label: 'Days – Day / Shift Rate',    icon: '📅' },
  { code: 'Hrs',    label: 'Hrs – Operating Hours',      icon: '⏱️' },
  { code: 'EX.hrs', label: 'EX.hrs – Extra / OT Hours', icon: '⚡' },
  { code: 'm2',     label: 'm² – Work Area (Sq. Meters)',icon: '📐' },
] as const;

export default function EquipmentForm({ equipment, onSave, onDeactivate, onCancel }: Props) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('');
  const [costRate, setCostRate] = useState<string>('');
  const [primaryUnit, setPrimaryUnit] = useState<string>('mth');
  const [availableUnits, setAvailableUnits] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (equipment) {
      setCode(equipment.code || '');
      setName(equipment.name);
      setType(equipment.type || '');
      setCostRate(equipment.costRate !== undefined && equipment.costRate !== null ? String(equipment.costRate) : '');
      setPrimaryUnit(equipment.primaryUnit || 'mth');
      setAvailableUnits(Array.isArray(equipment.availableUnits) && equipment.availableUnits.length > 0
        ? equipment.availableUnits
        : []);
    } else {
      setCode('');
      setName('');
      setType('');
      setCostRate('');
      setPrimaryUnit('mth');
      setAvailableUnits([]);
    }
  }, [equipment]);

  const toggleUnit = (unitCode: string) => {
    // Primary unit is always implicitly included — don't toggle it off
    if (unitCode === primaryUnit) return;
    setAvailableUnits((prev) =>
      prev.includes(unitCode) ? prev.filter((u) => u !== unitCode) : [...prev, unitCode]
    );
  };

  const handleChangePrimaryUnit = (newPrimary: string) => {
    setPrimaryUnit(newPrimary);
    // Ensure primary unit is removed from available list (it's always available by definition)
    setAvailableUnits((prev) => prev.filter((u) => u !== newPrimary));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim()) return;
    setIsSaving(true);
    try {
      await onSave({
        code: code.trim().toUpperCase(),
        name: name.trim(),
        type: type.trim(),
        costRate: costRate.trim() ? Number(costRate) : 0,
        primaryUnit,
        // Save the additional units (excluding primary which is always available)
        availableUnits: availableUnits.filter((u) => u !== primaryUnit),
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Units available for additional selection (excluding primary)
  const additionalUnitOptions = ALL_RATING_UNITS.filter((u) => u.code !== primaryUnit);

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Code */}
      <div className="flex flex-col gap-1">
        <label htmlFor="equip-code" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Code *</label>
        <input id="equip-code" type="text" value={code} onChange={(e) => setCode(e.target.value)} className={`${INPUT_CLASS} font-mono`} placeholder="e.g. MACM0075" required />
      </div>

      {/* Name */}
      <div className="flex flex-col gap-1">
        <label htmlFor="equip-name" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Name *</label>
        <input id="equip-name" type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} placeholder="Equipment name" required />
      </div>

      {/* Type */}
      <div className="flex flex-col gap-1">
        <label htmlFor="equip-type" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Type</label>
        <input id="equip-type" type="text" value={type} onChange={(e) => setType(e.target.value)} className={INPUT_CLASS} placeholder="e.g. Heavy machinery" />
      </div>

      {/* Cost Rate */}
      <div className="flex flex-col gap-1">
        <label htmlFor="equip-cost-rate" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cost Rate (LKR)</label>
        <input id="equip-cost-rate" type="number" step="0.01" min="0" value={costRate} onChange={(e) => setCostRate(e.target.value)} className={`${INPUT_CLASS} font-mono`} placeholder="e.g. 1500.00" />
      </div>

      {/* ── Primary Unit Selector ── */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            ⚙️ Primary Rating Unit
          </label>
          <span className="text-[10px] text-slate-500 font-medium">
            Card opens on this unit
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          The supervisor's card will pre-select this unit when it opens.
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {ALL_RATING_UNITS.map((unit) => (
            <label
              key={unit.code}
              className={[
                'flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg border transition-all text-sm',
                primaryUnit === unit.code
                  ? 'bg-emerald-600 border-emerald-600 text-white font-semibold shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50',
              ].join(' ')}
            >
              <input
                type="radio"
                name="primaryUnit"
                value={unit.code}
                checked={primaryUnit === unit.code}
                onChange={() => handleChangePrimaryUnit(unit.code)}
                className="sr-only"
              />
              <span className="text-base leading-none">{unit.icon}</span>
              <span className="font-mono text-xs font-bold">{unit.code}</span>
              <span className="text-xs">{unit.label.split('–')[1]?.trim()}</span>
              {primaryUnit === unit.code && (
                <span className="ml-auto text-[10px] bg-emerald-700/50 px-1.5 py-0.2 rounded font-bold">PRIMARY</span>
              )}
            </label>
          ))}
        </div>
      </div>

      {/* ── Additional Available Units ── */}
      <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            ➕ Additional Units
          </label>
          <span className="text-[10px] text-slate-500 font-medium">
            Supervisor can switch to these
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Tick units the supervisor is allowed to also log this machine under. Primary unit is always available.
          {availableUnits.length === 0 && ' (None ticked = all 5 units shown)'}
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {additionalUnitOptions.map((unit) => {
            const checked = availableUnits.includes(unit.code);
            return (
              <label
                key={unit.code}
                className={[
                  'flex items-center gap-2.5 cursor-pointer px-3 py-2 rounded-lg border transition-all text-sm',
                  checked
                    ? 'bg-blue-50 border-blue-300 text-blue-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleUnit(unit.code)}
                  className="w-4 h-4 rounded accent-blue-600 cursor-pointer flex-shrink-0"
                />
                <span className="text-base leading-none">{unit.icon}</span>
                <span className="font-mono text-xs font-bold">{unit.code}</span>
                <span className="text-xs">{unit.label.split('–')[1]?.trim()}</span>
              </label>
            );
          })}
        </div>
        {availableUnits.length > 0 && (
          <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-200">
            Allowed in supervisor view: <strong className="text-emerald-700">{primaryUnit}</strong>
            {availableUnits.map((u) => (
              <strong key={u} className="text-blue-700">, {u}</strong>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
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
