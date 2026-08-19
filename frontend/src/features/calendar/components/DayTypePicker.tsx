/**
 * DayTypePicker.tsx — Inline picker for choosing fixed day types on the calendar.
 */
import { Check, X } from 'lucide-react';
import type { DayType } from '../services/calendarService';

interface Props {
  dayTypes: DayType[];
  currentId?: string;
  onSelect: (dayTypeId: string) => void;
  onClose: () => void;
}

const COLOR_MAP: Record<string, { dot: string; hoverBg: string; activeBg: string; activeText: string }> = {
  'dt-normal':   { dot: 'bg-slate-400',   hoverBg: 'hover:bg-slate-50',   activeBg: 'bg-slate-100',   activeText: 'text-slate-800 font-semibold' },
  'dt-saturday': { dot: 'bg-blue-500',    hoverBg: 'hover:bg-blue-50',    activeBg: 'bg-blue-50',    activeText: 'text-blue-700 font-semibold' },
  'dt-sunday':   { dot: 'bg-emerald-500', hoverBg: 'hover:bg-emerald-50', activeBg: 'bg-emerald-50', activeText: 'text-emerald-700 font-semibold' },
  'dt-shutdown': { dot: 'bg-rose-500',    hoverBg: 'hover:bg-rose-50',    activeBg: 'bg-rose-50',    activeText: 'text-rose-700 font-semibold' },
  'dt-poya':     { dot: 'bg-amber-500',   hoverBg: 'hover:bg-amber-50',   activeBg: 'bg-amber-50',   activeText: 'text-amber-700 font-semibold' },
};

export default function DayTypePicker({ dayTypes, currentId, onSelect, onClose }: Props) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-xl w-52 py-1.5 z-40 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
      <div className="px-3 py-1.5 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Set Day Type</span>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 p-0.5 rounded transition-colors"
          aria-label="Close picker"
        >
          <X size={13} />
        </button>
      </div>

      <div className="p-1 flex flex-col gap-0.5">
        {dayTypes.map((dt) => {
          const isSelected = currentId === dt.id;
          const styling = COLOR_MAP[dt.id] || { dot: 'bg-blue-500', hoverBg: 'hover:bg-slate-50', activeBg: 'bg-blue-50', activeText: 'text-blue-700 font-semibold' };

          return (
            <button
              key={dt.id}
              onClick={() => onSelect(dt.id)}
              className={[
                'w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg transition-colors text-left min-h-[38px]',
                styling.hoverBg,
                isSelected ? `${styling.activeBg} ${styling.activeText}` : 'text-slate-700 font-medium',
              ].join(' ')}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-2.5 h-2.5 rounded-full ${styling.dot} flex-shrink-0 shadow-sm`} />
                <span>{dt.name}</span>
              </div>
              {isSelected && <Check size={14} className="text-current flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
