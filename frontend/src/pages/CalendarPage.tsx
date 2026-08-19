/**
 * CalendarPage.tsx — Admin fixed calendar page.
 * Allows quick selection of fixed day types (Normal Day, Saturday, Sunday, Shutdown, Poya/Holiday).
 */
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, CheckCircle2 } from 'lucide-react';
import { useCalendar } from '../features/calendar/hooks/useCalendar';
import MonthGrid from '../features/calendar/components/MonthGrid';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const LEGEND_ITEMS = [
  { name: 'Normal day',     dot: 'bg-slate-400',   bg: 'bg-slate-100',   text: 'text-slate-700',   border: 'border-slate-200' },
  { name: 'Saturday',       dot: 'bg-blue-500',    bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200' },
  { name: 'Sunday',         dot: 'bg-emerald-500', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  { name: 'Shutdown',       dot: 'bg-rose-500',    bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200' },
  { name: 'Poya / Holiday', dot: 'bg-amber-500',   bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200' },
];

export default function CalendarPage() {
  const calendar = useCalendar();

  return (
    <div className="px-4 md:px-6 py-5 max-w-7xl mx-auto flex flex-col gap-5">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
            <CalendarIcon size={20} className="text-blue-600" />
            Calendar & Day Types
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Click on any date in the calendar below to set or change its day type (Normal, Saturday, Sunday, Shutdown, Poya/Holiday).
          </p>
        </div>

        {/* Quick Batch Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={calendar.markAllSaturdays}
            className="flex items-center gap-1.5 text-xs text-blue-700 font-medium px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200/80 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[38px]"
          >
            <CheckCircle2 size={14} />
            <span>Mark all Saturdays</span>
          </button>
          <button
            onClick={calendar.markAllSundays}
            className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border border-emerald-200/80 transition-colors focus-visible:ring-2 focus-visible:ring-emerald-600 min-h-[38px]"
          >
            <CheckCircle2 size={14} />
            <span>Mark all Sundays</span>
          </button>
        </div>
      </div>

      {/* Legend Bar */}
      <div className="flex items-center gap-2 flex-wrap p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">Day Types:</span>
        {LEGEND_ITEMS.map((item) => (
          <span
            key={item.name}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${item.bg} ${item.text} ${item.border}`}
          >
            <span className={`w-2 h-2 rounded-full ${item.dot}`} />
            {item.name}
          </span>
        ))}
      </div>

      {/* Month navigation header */}
      <div className="flex items-center justify-between bg-white p-3.5 border border-slate-200 rounded-xl shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={calendar.prevMonth}
            aria-label="Previous month"
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-base font-semibold text-slate-800 min-w-[160px] text-center">
            {MONTH_NAMES[calendar.month]} {calendar.year}
          </h2>
          <button
            onClick={calendar.nextMonth}
            aria-label="Next month"
            className="w-9 h-9 rounded-lg border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <span className="text-xs text-slate-400 hidden sm:inline-block">
          Select any date in the grid below to assign a day type
        </span>
      </div>

      {/* Loading state */}
      {calendar.isLoading && (
        <div className="py-12 text-center">
          <div className="inline-block w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-sm text-slate-400">Loading calendar data…</p>
        </div>
      )}

      {/* Month grid */}
      {!calendar.isLoading && (
        <MonthGrid
          year={calendar.year}
          month={calendar.month}
          getDayTypeForDate={calendar.getDayTypeForDate}
          dayTypes={calendar.dayTypes}
          onSetDayType={calendar.setDayTypeForDate}
        />
      )}
    </div>
  );
}
