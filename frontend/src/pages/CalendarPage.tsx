/**
 * CalendarPage.tsx — Admin working calendar & daily site planner.
 * Features desktop-first split calendar with Day Type engine and daily event/task organizer.
 */
import { Calendar as CalendarIcon } from 'lucide-react';
import { useCalendar } from '../features/calendar/hooks/useCalendar';
import { ModernCalendarPlanner } from '../features/calendar/components/ModernCalendarPlanner';
import Breadcrumb from '../components/Breadcrumb';

function CalendarSkeleton() {
  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-9rem)] animate-pulse">
      {/* Left calendar skeleton */}
      <div className="w-full lg:w-[55%] bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-5 h-full">
        <div className="flex justify-between items-center pb-2">
          <div className="h-7 bg-slate-200 rounded w-36" />
          <div className="flex gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100" />
            <div className="w-8 h-8 rounded-xl bg-slate-100" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 flex-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <div key={i} className="bg-slate-50 border border-slate-100 rounded-2xl min-h-[60px]" />
          ))}
        </div>
      </div>

      {/* Right panel skeleton */}
      <div className="w-full lg:flex-1 bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-4 h-full">
        <div className="h-6 bg-slate-200 rounded w-44" />
        <div className="h-20 bg-slate-50 rounded-2xl border border-slate-100" />
        <div className="h-40 bg-slate-50 rounded-2xl border border-slate-100" />
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const calendar = useCalendar();

  return (
    <div className="px-4 md:px-6 py-5 w-full flex flex-col gap-5 h-screen overflow-hidden">
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
        <CalendarSkeleton />
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
