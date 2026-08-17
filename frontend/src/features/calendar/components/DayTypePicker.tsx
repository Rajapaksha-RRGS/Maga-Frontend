/**
 * DayTypePicker.tsx — Small inline picker for setting a date's day type.
 */
import type { DayType } from '../services/calendarService';

interface Props {
  dayTypes: DayType[];
  currentId?: string;
  onSelect: (dayTypeId: string) => void;
  onClose: () => void;
}

export default function DayTypePicker({ dayTypes, currentId, onSelect, onClose }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg w-48 py-1">
      {dayTypes.map((dt) => (
        <button
          key={dt.id}
          onClick={() => onSelect(dt.id)}
          className={[
            'w-full text-left px-3 py-2 text-sm transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[36px]',
            currentId === dt.id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-slate-800',
          ].join(' ')}
        >
          {dt.name}
          <span className="text-xs text-slate-400 ml-2 font-mono">×{dt.rateMultiplier}</span>
        </button>
      ))}
      <div className="border-t border-slate-100 mt-1 pt-1">
        <button
          onClick={onClose}
          className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
