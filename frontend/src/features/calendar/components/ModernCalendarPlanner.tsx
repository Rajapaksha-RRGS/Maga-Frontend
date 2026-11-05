import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { normalizeDayTypes, type DayType } from '../services/calendarService';
import {
  getLocalEventsForDate,
  fetchEventsForDate,
  addEventToDate,
  deleteEventFromDate,
  getDatesWithEventsForMonth,
  type CalendarEvent,
} from '../services/calendarEventService';
import { getAll as getSupervisors, type Supervisor } from '../../supervisors/services/supervisorService';
import { DayTypeConfirmModal } from './DayTypeConfirmModal';
import { LabourDayTypePanel } from './LabourDayTypePanel';
import { DailyEventsSection } from './DailyEventsSection';

// ─── Constants ────────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Monday-first weekday initials */
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface ModernCalendarPlannerProps {
  year: number;
  month: number; // 0-indexed
  onPrevMonth: () => void;
  onNextMonth: () => void;
  getDayTypeForDate: (date: string) => DayType | undefined;
  dayTypes: DayType[];
  onSetDayType: (date: string, dayTypeId: string) => Promise<any>;
}

// ─── Component ────────────────────────────────────────────────────────────────

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

  // ── Selected date ──────────────────────────────────────────────────────────
  const [selectedDate, setSelectedDate] = useState<string>(() =>
    today.getFullYear() === year && today.getMonth() === month
      ? todayStr
      : formatDate(year, month, 1)
  );

  // ── Events ─────────────────────────────────────────────────────────────────
  const [datesWithEvents, setDatesWithEvents] = useState<Set<string>>(() =>
    getDatesWithEventsForMonth(year, month)
  );
  const [events, setEvents] = useState<CalendarEvent[]>(() =>
    getLocalEventsForDate(selectedDate)
  );

  // ── Supervisors ────────────────────────────────────────────────────────────
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  useEffect(() => {
    let alive = true;
    getSupervisors()
      .then((list) => {
        if (alive && Array.isArray(list))
          setSupervisors(list.filter((s) => s.status === 'active'));
      })
      .catch((err) => console.warn('Could not load supervisors:', err));
    return () => { alive = false; };
  }, []);

  // ── Day type normalisation ─────────────────────────────────────────────────
  const effectiveDayTypes = useMemo(() => normalizeDayTypes(dayTypes), [dayTypes]);
  const currentDayType = getDayTypeForDate(selectedDate);

  // ── Day type confirmation modal ────────────────────────────────────────────
  const [pendingDayType, setPendingDayType] = useState<DayType | null>(null);
  const [isProcessingDayType, setIsProcessingDayType] = useState(false);
  const [dayTypeModalError, setDayTypeModalError] = useState<string | null>(null);

  // ── Sync events on date change ─────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    setEvents(getLocalEventsForDate(selectedDate));

    fetchEventsForDate(selectedDate).then((fetched) => {
      if (alive) {
        setEvents(fetched);
        setDatesWithEvents(getDatesWithEventsForMonth(year, month));
      }
    });

    return () => { alive = false; };
  }, [selectedDate, year, month]);

  // ── Sync dates-with-events on month change ─────────────────────────────────
  useEffect(() => {
    setDatesWithEvents(getDatesWithEventsForMonth(year, month));
    const [selY, selM] = selectedDate.split('-').map(Number);
    if (selY !== year || selM - 1 !== month) {
      setSelectedDate(formatDate(year, month, 1));
    }
  }, [year, month]);

  // ── Calendar grid calculation (Monday-first) ───────────────────────────────
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayRaw = new Date(year, month, 1).getDay(); // 0=Sun
  const firstDayMondayIndex = (firstDayRaw + 6) % 7; // 0=Mon … 6=Sun
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; isCurrentMonth: boolean; dateStr: string }[] = [];

  // Leading (prev month)
  for (let i = firstDayMondayIndex - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const pM = month === 0 ? 11 : month - 1;
    const pY = month === 0 ? year - 1 : year;
    cells.push({ day: d, isCurrentMonth: false, dateStr: formatDate(pY, pM, d) });
  }
  // Current month
  for (let d = 1; d <= daysInMonth; d++)
    cells.push({ day: d, isCurrentMonth: true, dateStr: formatDate(year, month, d) });
  // Trailing (next month)
  const rem = cells.length % 7;
  if (rem !== 0) {
    const fill = 7 - rem;
    for (let d = 1; d <= fill; d++) {
      const nM = month === 11 ? 0 : month + 1;
      const nY = month === 11 ? year + 1 : year;
      cells.push({ day: d, isCurrentMonth: false, dateStr: formatDate(nY, nM, d) });
    }
  }

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleOpenDayTypeChange = (dt: DayType) => {
    if (dt.id === currentDayType?.id) return;
    setDayTypeModalError(null);
    setPendingDayType(dt);
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

  const handleAddEvent = async (data: Parameters<typeof addEventToDate>[1]) => {
    const updated = await addEventToDate(selectedDate, data);
    setEvents(updated);
    setDatesWithEvents(getDatesWithEventsForMonth(year, month));
  };

  const handleDeleteEvent = async (eventId: string) => {
    const updated = await deleteEventFromDate(selectedDate, eventId);
    setEvents(updated);
    setDatesWithEvents(getDatesWithEventsForMonth(year, month));
  };

  // ── Day-cell badge colour helper ───────────────────────────────────────────
  const getDayBadgeClass = (dtCode: string, isCurrentMonth: boolean) => {
    if (!isCurrentMonth)
      return 'text-slate-300 hover:text-slate-500 border border-transparent';
    if (dtCode === 'sunday')
      return 'bg-emerald-50 text-emerald-800 border-2 border-emerald-400 font-bold hover:bg-emerald-100 shadow-2xs';
    if (dtCode === 'saturday')
      return 'bg-blue-50 text-blue-800 border-2 border-blue-400 font-bold hover:bg-blue-100 shadow-2xs';
    if (dtCode === 'poya')
      return 'bg-amber-100 text-amber-950 border-2 border-amber-500 font-black hover:bg-amber-200/80 shadow-2xs';
    if (dtCode === 'public_holiday')
      return 'bg-purple-100 text-purple-950 border-2 border-purple-500 font-black hover:bg-purple-200/80 shadow-2xs';
    if (dtCode === 'shutdown')
      return 'bg-rose-100 text-rose-900 border-2 border-rose-400 font-bold hover:bg-rose-200/80 shadow-2xs';
    return 'text-slate-700 hover:bg-slate-100 border border-slate-200/60 font-semibold bg-white';
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
    {/* Hide webkit scrollbar on right panel */}
    <style>{`.cal-right-col::-webkit-scrollbar{display:none}`}</style>

    {/* Full-height two-column layout: left=fixed, right=scrolls only */}
    <div className="flex flex-col lg:flex-row gap-4 lg:h-[calc(100vh-9rem)]">

      {/* ════ LEFT: Calendar — fills height, never scrolls ═══════════════════ */}
      <div className="w-full lg:w-[55%] lg:flex-shrink-0 lg:h-full lg:overflow-hidden">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-5 flex flex-col gap-5 w-full h-full">

          {/* Month / year header + nav */}
          <div className="flex items-center justify-between">
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

          {/* Weekday labels M T W T F S S */}
          <div>
            <div className="grid grid-cols-7 mb-3">
              {WEEKDAYS.map((w, i) => (
                <div
                  key={i}
                  className="text-center text-xs font-semibold text-slate-400 tracking-wider py-1"
                >
                  {w.label}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-2 gap-x-0.5">
              {cells.map((cell, idx) => {
                const isSelected = cell.dateStr === selectedDate;
                const cellDayType = getDayTypeForDate(cell.dateStr);
                const dtCode = cellDayType?.code || 'normal';
                const hasEvents = datesWithEvents.has(cell.dateStr);

                const badgeClass = getDayBadgeClass(dtCode, cell.isCurrentMonth);
                const selClass = isSelected
                  ? 'ring-[3px] ring-indigo-600 ring-offset-1 scale-110 z-10 shadow-md font-extrabold'
                  : '';

                return (
                  <div key={idx} className="flex flex-col items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setSelectedDate(cell.dateStr)}
                      className={[
                        'relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl flex flex-col items-center justify-center text-sm transition-all duration-150',
                        badgeClass,
                        selClass,
                      ].join(' ')}
                    >
                      <span>{cell.day}</span>
                      {hasEvents && (
                        <span
                          className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-indigo-600 ring-1 ring-white"
                          title="Scheduled site event"
                        />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="pt-4 border-t border-slate-100 flex items-center gap-2 flex-wrap text-[11px] font-semibold text-slate-600">
            {[
              { label: 'Normal',     border: 'border-slate-200',   bg: 'bg-white'      },
              { label: 'Sat',        border: 'border-blue-400',    bg: 'bg-blue-50'    },
              { label: 'Sun (OT)',   border: 'border-emerald-400', bg: 'bg-emerald-50' },
              { label: 'Poya',       border: 'border-amber-500',   bg: 'bg-amber-100'  },
              { label: 'Public Hol', border: 'border-purple-500',  bg: 'bg-purple-100' },
              { label: 'Shutdown',   border: 'border-rose-400',    bg: 'bg-rose-100'   },
            ].map(({ label, border, bg }) => (
              <span key={label} className="flex items-center gap-1.5">
                <span className={['w-4 h-4 rounded-md border-2 shadow-2xs flex-shrink-0', border, bg].join(' ')} />
                <span>{label}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-indigo-600 ring-2 ring-indigo-200 flex-shrink-0" />
              <span>Site Event</span>
            </span>
          </div>

        </div>
      </div>

      {/* ════ RIGHT: Clean 2-card layout (Fixed Day Type + Isolated Events Scroll) ══ */}
      <div className="flex-1 flex flex-col gap-4 min-w-0 lg:h-full lg:overflow-hidden">

        {/* Labour Day Type Panel (Compact, fixed at top) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex-shrink-0">
          <LabourDayTypePanel
            selectedDate={selectedDate}
            currentDayType={currentDayType}
            effectiveDayTypes={effectiveDayTypes}
            onChangeDayType={handleOpenDayTypeChange}
          />
        </div>

        {/* Daily Events Section (Fills remaining height, internal scroll only) */}
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden flex-1 min-h-0">
          <DailyEventsSection
            selectedDate={selectedDate}
            events={events}
            supervisors={supervisors}
            onAddEvent={handleAddEvent}
            onDeleteEvent={handleDeleteEvent}
          />
        </div>

      </div>

      {/* ════ Confirmation Modal ═════════════════════════════════════════════ */}
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
    </>
  );
};
