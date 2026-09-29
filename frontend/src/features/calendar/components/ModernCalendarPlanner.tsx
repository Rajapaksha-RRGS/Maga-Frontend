import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Clock,
  MapPin,
  Sparkles,
} from 'lucide-react';
import type { DayType } from '../services/calendarService';
import {
  getLocalEventsForDate,
  fetchEventsForDate,
  addEventToDate,
  deleteEventFromDate,
  getDatesWithEventsForMonth,
  type CalendarEvent,
} from '../services/calendarEventService';
import { DayTypeConfirmModal } from './DayTypeConfirmModal';

interface ModernCalendarPlannerProps {
  year: number;
  month: number; // 0-indexed
  onPrevMonth: () => void;
  onNextMonth: () => void;
  getDayTypeForDate: (date: string) => DayType | undefined;
  dayTypes: DayType[];
  onSetDayType: (date: string, dayTypeId: string) => Promise<any>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Weekday initials matching Monday-first standard (M, T, W, T, F, S, S)
const WEEKDAYS = [
  { label: 'M', full: 'Mon' },
  { label: 'T', full: 'Tue' },
  { label: 'W', full: 'Wed' },
  { label: 'T', full: 'Thu' },
  { label: 'F', full: 'Fri' },
  { label: 'S', full: 'Sat' },
  { label: 'S', full: 'Sun' },
];

function formatDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const EVENT_COLOR_MAP: Record<CalendarEvent['color'], { border: string; bg: string; text: string; dot: string }> = {
  purple: { border: 'border-l-purple-600', bg: 'bg-purple-50/40', text: 'text-purple-950', dot: 'bg-purple-600' },
  amber:  { border: 'border-l-amber-500',  bg: 'bg-amber-50/40',  text: 'text-amber-950',  dot: 'bg-amber-500' },
  emerald:{ border: 'border-l-emerald-500',bg: 'bg-emerald-50/40',text: 'text-emerald-950',dot: 'bg-emerald-500' },
  blue:   { border: 'border-l-blue-500',   bg: 'bg-blue-50/40',   text: 'text-blue-950',   dot: 'bg-blue-500' },
  rose:   { border: 'border-l-rose-500',   bg: 'bg-rose-50/40',   text: 'text-rose-950',   dot: 'bg-rose-500' },
};

const TIME_PRESETS = [
  '08:00 - 09:00',
  '09:00 - 10:00',
  '11:30 - 12:30',
  '14:00 - 15:30',
];

export const ModernCalendarPlanner: React.FC<ModernCalendarPlannerProps> = ({
  year,
  month,
  onPrevMonth,
  onNextMonth,
  getDayTypeForDate,
  dayTypes,
  onSetDayType,
}) => {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(
    () => formatDate(today.getFullYear(), today.getMonth(), today.getDate()),
    [today]
  );

  // Default selected date: today if in current month/year, else 1st of viewed month
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    if (today.getFullYear() === year && today.getMonth() === month) {
      return todayStr;
    }
    return formatDate(year, month, 1);
  });

  // Track dates with events in this month
  const [datesWithEvents, setDatesWithEvents] = useState<Set<string>>(() =>
    getDatesWithEventsForMonth(year, month)
  );

  // Events for selected date (starts with local cache, then syncs with DB)
  const [events, setEvents] = useState<CalendarEvent[]>(() => getLocalEventsForDate(selectedDate));

  // Add event form state
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTime, setSelectedTime] = useState<string>('09:00 - 10:00');
  const [newLocation, setNewLocation] = useState('');
  const [newColor, setNewColor] = useState<CalendarEvent['color']>('purple');

  // Day type confirmation modal state
  const [pendingDayType, setPendingDayType] = useState<DayType | null>(null);
  const [isProcessingDayType, setIsProcessingDayType] = useState(false);
  const [dayTypeModalError, setDayTypeModalError] = useState<string | null>(null);

  // Synchronize events with PostgreSQL database whenever selected date changes
  useEffect(() => {
    let isMounted = true;
    setEvents(getLocalEventsForDate(selectedDate));
    setIsAddingEvent(false);

    fetchEventsForDate(selectedDate).then((fetched) => {
      if (isMounted) {
        setEvents(fetched);
        setDatesWithEvents(getDatesWithEventsForMonth(year, month));
      }
    });

    return () => {
      isMounted = false;
    };
  }, [selectedDate, year, month]);

  // Synchronize dates with events when month/year changes
  useEffect(() => {
    setDatesWithEvents(getDatesWithEventsForMonth(year, month));
    // If selected date is outside viewed month, set to 1st of month
    const [selY, selM] = selectedDate.split('-').map(Number);
    if (selY !== year || selM - 1 !== month) {
      setSelectedDate(formatDate(year, month, 1));
    }
  }, [year, month]);

  // Current day type of selected date
  const currentDayType = getDayTypeForDate(selectedDate);

  // Month grid calculations (Monday-first: 0 = Mon, ..., 6 = Sun)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayRaw = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
  const firstDayMondayIndex = (firstDayRaw + 6) % 7; // Mon = 0, ..., Sun = 6

  // Previous month trailing days
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

  // 1. Leading days from previous month
  for (let i = firstDayMondayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevM = month === 0 ? 11 : month - 1;
    const prevY = month === 0 ? year - 1 : year;
    cells.push({ day: d, isCurrentMonth: false, dateStr: formatDate(prevY, prevM, d) });
  }

  // 2. Days of current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, isCurrentMonth: true, dateStr: formatDate(year, month, d) });
  }

  // 3. Trailing days from next month to complete 5 or 6 rows (multiple of 7)
  const remainder = cells.length % 7;
  if (remainder !== 0) {
    const fillCount = 7 - remainder;
    for (let d = 1; d <= fillCount; d++) {
      const nextM = month === 11 ? 0 : month + 1;
      const nextY = month === 11 ? year + 1 : year;
      cells.push({ day: d, isCurrentMonth: false, dateStr: formatDate(nextY, nextM, d) });
    }
  }

  // Handlers
  const handleSelectDate = (dateStr: string) => {
    setSelectedDate(dateStr);
  };

  const handleOpenDayTypeChange = (targetDayType: DayType) => {
    if (targetDayType.id === currentDayType?.id) return;
    setDayTypeModalError(null);
    setPendingDayType(targetDayType);
  };

  const handleConfirmDayType = async () => {
    if (!pendingDayType) return;
    setIsProcessingDayType(true);
    setDayTypeModalError(null);
    try {
      await onSetDayType(selectedDate, pendingDayType.id);
      setPendingDayType(null);
    } catch (err: any) {
      setDayTypeModalError(err?.message || 'Failed to update day type');
    } finally {
      setIsProcessingDayType(false);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const title = newTitle.trim();
    const time = selectedTime;
    const location = newLocation.trim() || undefined;
    const color = newColor;

    setNewTitle('');
    setSelectedTime('09:00 - 10:00');
    setNewLocation('');
    setIsAddingEvent(false);

    const updated = await addEventToDate(selectedDate, {
      title,
      time,
      location,
      color,
    });

    setEvents(updated);
    setDatesWithEvents(getDatesWithEventsForMonth(year, month));
  };

  const handleDeleteEvent = async (eventId: string) => {
    const updated = await deleteEventFromDate(selectedDate, eventId);
    setEvents(updated);
    setDatesWithEvents(getDatesWithEventsForMonth(year, month));
  };

  // Formatted date string for side panel header
  const selectedDateObj = useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [selectedDate]);

  const formattedSelectedDate = useMemo(() => {
    return selectedDateObj
      .toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'long',
      })
      .toUpperCase();
  }, [selectedDateObj]);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden transition-all duration-200">
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-100 min-h-[540px]">
        {/* ── LEFT: Modern Month Calendar Grid (7 cols) ────────────────────── */}
        <div className="lg:col-span-7 p-6 sm:p-8 flex flex-col justify-between">
          <div>
            {/* Header: Month & Year + Clean Prev/Next Navigation */}
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {MONTH_NAMES[month]} {year}
              </h2>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onPrevMonth}
                  aria-label="Previous month"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={onNextMonth}
                  aria-label="Next month"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>

            {/* Weekday Labels (M, T, W, T, F, S, S) */}
            <div className="grid grid-cols-7 mb-4">
              {WEEKDAYS.map((w, idx) => (
                <div
                  key={idx}
                  className="text-center text-xs font-semibold text-slate-400 tracking-wider py-1"
                >
                  {w.label}
                </div>
              ))}
            </div>

            {/* Calendar Days Matrix */}
            <div className="grid grid-cols-7 gap-y-3 sm:gap-y-4">
              {cells.map((cell, idx) => {
                const isSelected = cell.dateStr === selectedDate;
                const isCurrentMonth = cell.isCurrentMonth;
                const cellDayType = getDayTypeForDate(cell.dateStr);
                const hasEvents = datesWithEvents.has(cell.dateStr);

                // Day type dot styling
                const dtCode = cellDayType?.code || 'normal';
                let indicatorDotClass = '';
                if (hasEvents) {
                  indicatorDotClass = 'bg-indigo-600 ring-2 ring-indigo-200';
                } else if (dtCode === 'public_holiday') {
                  indicatorDotClass = 'bg-amber-500';
                } else if (dtCode === 'sunday') {
                  indicatorDotClass = 'bg-emerald-500';
                } else if (dtCode === 'saturday') {
                  indicatorDotClass = 'bg-blue-500';
                } else if (dtCode === 'shutdown') {
                  indicatorDotClass = 'bg-rose-500';
                }

                return (
                  <div key={idx} className="flex flex-col items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleSelectDate(cell.dateStr)}
                      className={[
                        'relative w-10 h-10 sm:w-11 sm:h-11 flex flex-col items-center justify-center text-sm font-semibold transition-all duration-150',
                        isSelected
                          ? 'bg-indigo-600 text-white rounded-2xl shadow-md shadow-indigo-500/30 scale-105'
                          : isCurrentMonth
                          ? 'text-slate-700 hover:bg-slate-100/80 rounded-2xl'
                          : 'text-slate-300 hover:text-slate-400 rounded-2xl',
                      ].join(' ')}
                    >
                      <span>{cell.day}</span>

                      {/* Small Indicator Dot below Date Number */}
                      {!isSelected && indicatorDotClass && (
                        <span
                          className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${indicatorDotClass}`}
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Legend at Bottom of Calendar */}
          <div className="pt-6 mt-6 border-t border-slate-100 flex items-center gap-3 sm:gap-4 flex-wrap text-[11px] font-medium text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>Normal</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>Sat (6h)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>Sun (OT)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Poya / Hol</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>Shutdown</span>
            </span>
            <span className="flex items-center gap-1.5 ml-auto">
              <span className="w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-indigo-200" />
              <span>Site Event</span>
            </span>
          </div>
        </div>

        {/* ── RIGHT: Selected Day Details & Admin Planner (5 cols) ──────────── */}
        <div className="lg:col-span-5 p-6 sm:p-8 flex flex-col justify-between bg-slate-50/40">
          <div>
            {/* Header: Date + Event Count */}
            <div className="mb-5">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {formattedSelectedDate}
              </div>
              <div className="flex items-center justify-between mt-1">
                <h3 className="text-lg font-bold text-slate-900">
                  {events.length === 0
                    ? 'No events scheduled'
                    : events.length === 1
                    ? 'One event'
                    : events.length === 2
                    ? 'Two events'
                    : events.length === 3
                    ? 'Three events'
                    : `${events.length} events`}
                </h3>

                <button
                  type="button"
                  onClick={() => setIsAddingEvent(true)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100/80 px-2.5 py-1.5 rounded-xl transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Event</span>
                </button>
              </div>
            </div>

            {/* Day Type Selector Banner (Stable - no jumping!) */}
            <div className="mb-6 p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Labour Day Type
                </span>
                <span
                  className={[
                    'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border',
                    currentDayType?.code === 'public_holiday'
                      ? 'bg-amber-50 text-amber-800 border-amber-300'
                      : currentDayType?.code === 'sunday'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      : currentDayType?.code === 'saturday'
                      ? 'bg-blue-50 text-blue-800 border-blue-300'
                      : currentDayType?.code === 'shutdown'
                      ? 'bg-rose-50 text-rose-800 border-rose-300'
                      : 'bg-slate-100 text-slate-700 border-slate-300',
                  ].join(' ')}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
                  <span>{currentDayType?.name || 'Normal Day'}</span>
                </span>
              </div>

              {/* Day Type Quick Switcher Chips */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {dayTypes.map((dt) => {
                  const isActive = currentDayType?.id === dt.id;
                  return (
                    <button
                      key={dt.id}
                      type="button"
                      onClick={() => handleOpenDayTypeChange(dt)}
                      className={[
                        'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                        isActive
                          ? 'bg-slate-800 text-white shadow-xs'
                          : 'bg-slate-100 hover:bg-slate-200/70 text-slate-600',
                      ].join(' ')}
                    >
                      {dt.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Add Event Form (Inline Modal / Drawer) */}
            {isAddingEvent && (
              <form
                onSubmit={handleCreateEvent}
                className="mb-5 p-4 rounded-2xl bg-white border border-indigo-200 shadow-sm space-y-3 animate-in fade-in duration-150"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">New Site Event / Task</span>
                  <button
                    type="button"
                    onClick={() => setIsAddingEvent(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs"
                  >
                    Cancel
                  </button>
                </div>

                <input
                  type="text"
                  placeholder="Event title (e.g. Standup, Concrete Pouring)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />

                {/* Time Selection: 4 Preset Cards Only */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock size={13} className="text-indigo-600" />
                    <span>Select Event Time</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {TIME_PRESETS.map((slot) => {
                      const isSelected = selectedTime === slot;
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTime(slot)}
                          className={[
                            'px-3 py-2.5 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer',
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm ring-2 ring-indigo-200 scale-[1.02]'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 hover:border-slate-300',
                          ].join(' ')}
                        >
                          {slot}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Location / Work Area Input */}
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-indigo-500">
                  <MapPin size={14} className="text-slate-400" />
                  <input
                    type="text"
                    placeholder="Location / Milestone (e.g. Tower B, Site Office)"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    className="w-full text-xs text-slate-800 bg-transparent focus:outline-none"
                  />
                </div>

                {/* Color Selector */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    {(['purple', 'amber', 'emerald', 'blue', 'rose'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewColor(c)}
                        className={[
                          'w-5 h-5 rounded-full transition-transform',
                          EVENT_COLOR_MAP[c].dot,
                          newColor === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'opacity-70 hover:opacity-100',
                        ].join(' ')}
                      />
                    ))}
                  </div>

                  <button
                    type="submit"
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors"
                  >
                    Save Event
                  </button>
                </div>
              </form>
            )}

            {/* Events List (Clean Cards with vertical accent line matching reference) */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {events.length === 0 && !isAddingEvent && (
                <div className="py-10 text-center space-y-2">
                  <Sparkles size={28} className="mx-auto text-slate-300" />
                  <p className="text-xs text-slate-400 font-medium">
                    No site tasks or meetings scheduled for this date.
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddingEvent(true)}
                    className="text-xs text-indigo-600 font-semibold hover:underline"
                  >
                    + Add first task / reminder
                  </button>
                </div>
              )}

              {events.map((evt: CalendarEvent) => {
                const style = EVENT_COLOR_MAP[evt.color] || EVENT_COLOR_MAP.purple;
                return (
                  <div
                    key={evt.id}
                    className={[
                      'group relative pl-4 pr-3 py-2.5 rounded-xl border-l-[3.5px] transition-all bg-white border border-slate-100 shadow-2xs hover:shadow-xs',
                      style.border,
                    ].join(' ')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-semibold text-slate-900 group-hover:text-indigo-900 transition-colors">
                          {evt.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          {evt.time && <span>{evt.time}</span>}
                          {evt.time && evt.location && <span>·</span>}
                          {evt.location && <span>{evt.location}</span>}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteEvent(evt.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1 rounded-md transition-all"
                        title="Delete event"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-4 mt-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
            <span>Work schedule & Admin planner</span>
            <span className="text-[11px] font-medium text-slate-500">Auto-synced</span>
          </div>
        </div>
      </div>

      {/* Confirmation & Cascade Recalculation Modal (ආරක්ෂක පියවර 2 & 3) */}
      <DayTypeConfirmModal
        isOpen={Boolean(pendingDayType)}
        date={selectedDate}
        currentDayType={currentDayType}
        newDayType={pendingDayType || undefined}
        onConfirm={handleConfirmDayType}
        onCancel={() => {
          if (!isProcessingDayType) {
            setPendingDayType(null);
            setDayTypeModalError(null);
          }
        }}
        isProcessing={isProcessingDayType}
        errorMessage={dayTypeModalError}
      />
    </div>
  );
};
