/**
 * CalendarPage.tsx — Admin calendar & day types page.
 * Two sections: day type management table at top, month grid below.
 */
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { useCalendar } from '../features/calendar/hooks/useCalendar';
import { useDayTypes } from '../features/calendar/hooks/useDayTypes';
import MonthGrid from '../features/calendar/components/MonthGrid';
import DayTypeTable from '../features/calendar/components/DayTypeTable';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function CalendarPage() {
  const calendar = useCalendar();
  const dayTypesHook = useDayTypes();

  return (
    <div className="px-4 md:px-6 py-5">
      <h1 className="text-base font-medium text-slate-800 mb-5">Calendar</h1>

      {/* Day types table */}
      <div className="mb-6">
        <DayTypeTable
          dayTypes={dayTypesHook.dayTypes}
          onAdd={dayTypesHook.add}
          onEdit={dayTypesHook.edit}
          onDelete={dayTypesHook.remove}
        />
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={calendar.prevMonth}
            aria-label="Previous month"
            className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ChevronLeft size={18} />
          </button>
          <h2 className="text-sm font-medium text-slate-800 min-w-[140px] text-center">
            {MONTH_NAMES[calendar.month]} {calendar.year}
          </h2>
          <button
            onClick={calendar.nextMonth}
            aria-label="Next month"
            className="w-9 h-9 rounded-md flex items-center justify-center text-slate-600 hover:bg-slate-100 active:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        <button
          onClick={calendar.markAllSundays}
          className="flex items-center gap-2 text-sm text-blue-700 font-medium px-3 py-2 rounded-lg hover:bg-blue-50 active:bg-blue-100 transition-colors focus-visible:ring-2 focus-visible:ring-blue-600 min-h-[44px]"
        >
          <CalendarIcon size={16} />
          <span>Mark all Sundays</span>
        </button>
      </div>

      {/* Loading state */}
      {calendar.isLoading && (
        <p className="text-sm text-slate-400 py-8 text-center">Loading calendar…</p>
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
