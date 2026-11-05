import React from 'react';
import { type DayType } from '../services/calendarService';

interface LabourDayTypePanelProps {
  selectedDate: string;
  currentDayType: DayType | undefined;
  effectiveDayTypes: DayType[];
  onChangeDayType: (dt: DayType) => void;
}

export const LabourDayTypePanel: React.FC<LabourDayTypePanelProps> = ({
  selectedDate,
  currentDayType,
  effectiveDayTypes,
  onChangeDayType,
}) => {
  // Formatted display of selected date
  const formattedDate = React.useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, [selectedDate]);

  // Current badge colour logic
  const badgeClass = React.useMemo(() => {
    const code = currentDayType?.code;
    const name = currentDayType?.name?.toLowerCase() ?? '';
    if (code === 'poya' || name.includes('poya'))
      return 'bg-amber-100 text-amber-950 border-amber-400';
    if (code === 'public_holiday' || name.includes('holiday'))
      return 'bg-purple-100 text-purple-950 border-purple-400';
    if (code === 'sunday')
      return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    if (code === 'saturday')
      return 'bg-blue-50 text-blue-800 border-blue-300';
    if (code === 'shutdown')
      return 'bg-rose-50 text-rose-800 border-rose-300';
    return 'bg-slate-100 text-slate-700 border-slate-300';
  }, [currentDayType]);

  const displayName = React.useMemo(() => {
    const name = currentDayType?.name?.toLowerCase() ?? '';
    if (name.includes('poya')) return 'Poya Day';
    if (name.includes('holiday')) return 'Public Holiday';
    return currentDayType?.name || 'Normal Day';
  }, [currentDayType]);

  return (
    <div className="flex flex-col gap-3">
      {/* Header: Date + Current Badge */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Selected Date
          </p>
          <p className="text-sm font-bold text-slate-800 leading-tight">
            {formattedDate}
          </p>
        </div>

        <span
          className={[
            'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-2xs',
            badgeClass,
          ].join(' ')}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          {displayName}
        </span>
      </div>

      {/* Quick Switcher Chips */}
      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        {effectiveDayTypes.map((dt) => {
          const isActive =
            currentDayType?.id === dt.id ||
            (dt.code === 'poya' &&
              (currentDayType?.code === 'poya' ||
                currentDayType?.name?.toLowerCase().includes('poya'))) ||
            (dt.code === 'public_holiday' &&
              (currentDayType?.code === 'public_holiday' ||
                (currentDayType?.name?.toLowerCase().includes('holiday') &&
                  !currentDayType?.name?.toLowerCase().includes('poya'))));

          const isPoya =
            dt.code === 'poya' || dt.name.toLowerCase().includes('poya');
          const isHol =
            dt.code === 'public_holiday' ||
            (!isPoya && dt.name.toLowerCase().includes('holiday'));
          const isSun = dt.code === 'sunday';
          const isSat = dt.code === 'saturday';
          const isShut = dt.code === 'shutdown';

          return (
            <button
              key={dt.id}
              type="button"
              onClick={() => onChangeDayType(dt)}
              className={[
                'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border cursor-pointer',
                isActive
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs ring-1 ring-slate-900'
                  : isPoya
                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                  : isHol
                  ? 'bg-purple-50 hover:bg-purple-100 text-purple-900 border-purple-300'
                  : isSun
                  ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                  : isSat
                  ? 'bg-blue-50 hover:bg-blue-100 text-blue-800 border-blue-300'
                  : isShut
                  ? 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                  : 'bg-slate-100 hover:bg-slate-200/70 text-slate-700 border-slate-200/60',
              ].join(' ')}
            >
              {dt.name}
            </button>
          );
        })}
      </div>
    </div>
  );
};
