/**
 * MonthGrid.tsx — Desktop-first month calendar grid.
 * Each cell shows date + fixed day-type label. Clicking a date opens a day-type picker.
 */
import { useState } from 'react';
import type { DayType } from '../services/calendarService';
import DayTypePicker from './DayTypePicker';
import { DayTypeConfirmModal } from './DayTypeConfirmModal';

interface Props {
  year: number;
  month: number; // 0-indexed
  getDayTypeForDate: (date: string) => DayType | undefined;
  dayTypes: DayType[];
  onSetDayType: (date: string, dayTypeId: string) => Promise<any>;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const BADGE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  'dt-normal':      { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200/80' },
  'normal':         { bg: 'bg-slate-100',   text: 'text-slate-600',   border: 'border-slate-200/80' },
  'dt-saturday':    { bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200' },
  'saturday':       { bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200' },
  'dt-sunday':      { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  'sunday':         { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  'dt-shutdown':    { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200' },
  'shutdown':       { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200' },
  'dt-holiday':     { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200' },
  'public_holiday': { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200' },
  'dt-poya':        { bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200' },
};

export default function MonthGrid({ year, month, getDayTypeForDate, dayTypes, onSetDayType }: Props) {
  const [pickerDate, setPickerDate] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{
    date: string;
    currentDayType?: DayType;
    newDayType?: DayType;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const today = new Date();
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

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

  const handlePickerSelect = (dayTypeId: string) => {
    if (pickerDate) {
      const currentDt = getDayTypeForDate(pickerDate);
      const newDt = dayTypes.find((d) => d.id === dayTypeId);

      if (currentDt?.id === dayTypeId) {
        setPickerDate(null);
        return;
      }

      setPickerDate(null);
      setModalError(null);
      setPendingChange({
        date: pickerDate,
        currentDayType: currentDt,
        newDayType: newDt,
      });
    }
  };

  const handleConfirmChange = async () => {
    if (!pendingChange?.newDayType) return;
    setIsProcessing(true);
    setModalError(null);
    try {
      await onSetDayType(pendingChange.date, pendingChange.newDayType.id);
      setPendingChange(null);
    } catch (err: any) {
      setModalError(err?.message || 'Failed to update day type on server');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelModal = () => {
    if (isProcessing) return;
    setPendingChange(null);
    setModalError(null);
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-visible">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/80 rounded-t-xl">
        {WEEKDAYS.map((w, index) => (
          <div
            key={w}
            className={[
              'px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider',
              index === 0 ? 'text-emerald-700' : index === 6 ? 'text-blue-700' : 'text-slate-600',
            ].join(' ')}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
        {cells.map((day, idx) => {
          if (day === null) {
            return <div key={`blank-${idx}`} className="min-h-[85px] bg-slate-50/40" />;
          }

          const dateStr = formatDate(year, month, day);
          const dt = getDayTypeForDate(dateStr);
          const isPickerOpen = pickerDate === dateStr;
          const isToday = dateStr === todayStr;
          const badge = (dt && (BADGE_STYLES[dt.id] || (dt.code && BADGE_STYLES[dt.code]))) || BADGE_STYLES['dt-normal'];

          return (
            <div
              key={day}
              className={[
                'relative min-h-[85px] p-2 cursor-pointer transition-all duration-150 flex flex-col justify-between group',
                isToday ? 'bg-blue-50/30 ring-1 ring-inset ring-blue-400' : 'hover:bg-slate-50/80 bg-white',
              ].join(' ')}
              onClick={() => handleDateClick(day)}
            >
              {/* Day header: Number + Today indicator */}
              <div className="flex items-center justify-between">
                <span
                  className={[
                    'text-sm font-semibold inline-flex items-center justify-center w-6 h-6 rounded-full',
                    isToday ? 'bg-blue-600 text-white font-bold' : 'text-slate-800',
                  ].join(' ')}
                >
                  {day}
                </span>
                {isToday && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-100/60 px-1.5 py-0.2 rounded">
                    Today
                  </span>
                )}
              </div>

              {/* Day Type Badge */}
              <div className="mt-2">
                {dt ? (
                  <span
                    className={[
                      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border w-full justify-center truncate',
                      badge.bg,
                      badge.text,
                      badge.border,
                    ].join(' ')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
                    <span className="truncate">{dt.name}</span>
                  </span>
                ) : (
                  <span className="text-xs text-slate-300 italic group-hover:text-slate-400">Click to set</span>
                )}
              </div>

              {/* Inline DayTypePicker popover */}
              {isPickerOpen && (
                <div
                  className="absolute top-12 left-2 z-40"
                  onClick={(e) => e.stopPropagation()}
                >
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

      {/* Confirmation & Cascade Recalculation Modal (ආරක්ෂක පියවර 2 & 3) */}
      <DayTypeConfirmModal
        isOpen={Boolean(pendingChange)}
        date={pendingChange?.date || ''}
        currentDayType={pendingChange?.currentDayType}
        newDayType={pendingChange?.newDayType}
        onConfirm={handleConfirmChange}
        onCancel={handleCancelModal}
        isProcessing={isProcessing}
        errorMessage={modalError}
      />
    </div>
  );
}
