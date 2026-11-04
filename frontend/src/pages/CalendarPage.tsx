/**
 * CalendarPage.tsx — Admin working calendar & daily site planner.
 * Features desktop-first split calendar with Day Type engine and daily event/task organizer.
 */
import { Calendar as CalendarIcon } from 'lucide-react';
import { useCalendar } from '../features/calendar/hooks/useCalendar';
import { ModernCalendarPlanner } from '../features/calendar/components/ModernCalendarPlanner';
import Breadcrumb from '../components/Breadcrumb';

export default function CalendarPage() {
  const calendar = useCalendar();

  return (
    <div className="px-4 md:px-6 py-5 max-w-7xl mx-auto flex flex-col gap-5 h-screen overflow-hidden">
      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon size={22} className="text-indigo-600" />
            Calendar & Daily Site Planner
          </h1>
          <Breadcrumb items={[{ label: 'Working Calendar' }]} className="mt-1" />
        </div>

        {/* Live Sync Status */}
        <div className="flex items-center gap-2 flex-wrap">
          {calendar.isUpdating && (
            <div className="inline-flex items-center gap-1.5 text-xs text-indigo-700 font-semibold px-3 py-2 rounded-xl bg-indigo-50 border border-indigo-200 shadow-2xs">
              <div className="w-3.5 h-3.5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span>Syncing…</span>
            </div>
          )}
        </div>
      </div>

      {/* Initial Loading State only when empty */}
      {calendar.isLoading && calendar.entries.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 shadow-sm">
          <div className="inline-block w-7 h-7 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-2" />
          <p className="text-xs font-medium text-slate-500">Loading calendar & schedule data…</p>
        </div>
      ) : (
        /* Modern Split Calendar & Work Organizer (Stays permanently mounted) */
        <ModernCalendarPlanner
          year={calendar.year}
          month={calendar.month}
          onPrevMonth={calendar.prevMonth}
          onNextMonth={calendar.nextMonth}
          getDayTypeForDate={calendar.getDayTypeForDate}
          dayTypes={calendar.dayTypes}
          onSetDayType={calendar.setDayTypeForDate}
        />
      )}
    </div>
  );
}
