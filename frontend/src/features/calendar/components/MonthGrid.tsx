/**
 * MonthGrid.tsx — Desktop-first month calendar grid.
 * Each cell shows date + day-type label. Clicking a date opens a day-type picker.
 *
 * Color coding per design-system semantic system:
 *   Normal day = neutral (no tint)
 *   Sunday/Poya/Holiday = amber-tinted with different labels
 */
import { useState } from 'react';
import type { DayType } from '../services/calendarService';
import DayTypePicker from './DayTypePicker';

interface Props {
  year: number;
  month: number; // 0-indexed
  getDayTypeForDate: (date: string) => DayType | undefined;
  dayTypes: DayType[];
  onSetDayType: (date: string, dayTypeId: string) => Promise<void>;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function getDayTypeStyle(dt?: DayType): string {
  if (!dt) return 'bg-white';
  if (dt.rateMultiplier > 1) return 'bg-amber-50 border-amber-200';
  return 'bg-white border-slate-200';
}

function getDayTypeLabelStyle(dt?: DayType): string {
  if (!dt) return 'text-slate-400';
  if (dt.rateMultiplier > 1) return 'text-amber-700 bg-amber-50';
  return 'text-slate-500';
}

export default function MonthGrid({ year, month, getDayTypeForDate, dayTypes, onSetDayType }: Props) {
  const [pickerDate, setPickerDate] = useState<string | null>(null);

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  // Build grid cells: leading blanks + days
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const handleDateClick = (day: number) => {
    const dateStr = formatDate(year, month, day);
    setPickerDate(pickerDate === dateStr ? null : dateStr);
  };

  const handlePickerSelect = async (dayTypeId: string) => {
    if (pickerDate) {
      await onSetDayType(pickerDate, dayTypeId);
      setPickerDate(null);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-1 py-2 text-center text-xs font-medium text-slate-500 uppercase tracking-wide">
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} className="border-b border-r border-slate-100 min-h-[72px]" />;
          }

          const dateStr = formatDate(year, month, day);
          const dt = getDayTypeForDate(dateStr);
          const isPickerOpen = pickerDate === dateStr;

          return (
            <div
              key={day}
              className={[
                'relative border-b border-r border-slate-100 min-h-[72px] p-1.5 cursor-pointer transition-colors hover:bg-slate-50',
                getDayTypeStyle(dt),
              ].join(' ')}
              onClick={() => handleDateClick(day)}
            >
              <span className="text-sm font-medium text-slate-800">{day}</span>
              {dt && (
                <span className={['block text-xs mt-0.5 truncate', getDayTypeLabelStyle(dt)].join(' ')}>
                  {dt.name}
                </span>
              )}
              {dt && dt.rateMultiplier > 1 && (
                <span className="text-xs text-amber-500 font-mono">×{dt.rateMultiplier}</span>
              )}

              {/* Inline picker */}
              {isPickerOpen && (
                <div className="absolute top-full left-0 z-20 mt-1" onClick={(e) => e.stopPropagation()}>
                  <DayTypePicker
                    dayTypes={dayTypes}
                    currentId={dt?.id}
                    onSelect={handlePickerSelect}
                    onClose={() => setPickerDate(null)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
