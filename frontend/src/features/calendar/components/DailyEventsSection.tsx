import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  Clock,
  MapPin,
  Sparkles,
  Bell,
  Send,
  AlertCircle,
  Users,
  User,
  X,
} from 'lucide-react';
import { type CalendarEvent } from '../services/calendarEventService';
import { type Supervisor } from '../../supervisors/services/supervisorService';

const EVENT_COLOR_MAP: Record<
  CalendarEvent['color'],
  { border: string; bg: string; text: string; dot: string }
> = {
  purple:  { border: 'border-l-purple-600', bg: 'bg-purple-50/40',  text: 'text-purple-950',  dot: 'bg-purple-600' },
  amber:   { border: 'border-l-amber-500',  bg: 'bg-amber-50/40',   text: 'text-amber-950',   dot: 'bg-amber-500'  },
  emerald: { border: 'border-l-emerald-500',bg: 'bg-emerald-50/40', text: 'text-emerald-950', dot: 'bg-emerald-500'},
  blue:    { border: 'border-l-blue-500',   bg: 'bg-blue-50/40',    text: 'text-blue-950',    dot: 'bg-blue-500'   },
  rose:    { border: 'border-l-rose-500',   bg: 'bg-rose-50/40',    text: 'text-rose-950',    dot: 'bg-rose-500'   },
};

const TIME_PRESETS = [
  '08:00 - 09:00',
  '09:00 - 10:00',
  '11:30 - 12:30',
  '14:00 - 15:30',
];

interface DailyEventsSectionProps {
  selectedDate: string;
  events: CalendarEvent[];
  supervisors: Supervisor[];
  onAddEvent: (data: {
    title: string;
    time: string;
    location?: string;
    color: CalendarEvent['color'];
    notes?: string;
    targetSupervisorId: string;
    targetSupervisorName?: string;
    priority: 'normal' | 'important' | 'urgent';
  }) => Promise<void>;
  onDeleteEvent: (eventId: string) => Promise<void>;
}

export const DailyEventsSection: React.FC<DailyEventsSectionProps> = ({
  selectedDate,
  events,
  supervisors,
  onAddEvent,
  onDeleteEvent,
}) => {
  // ── Modal & Form state ───────────────────────────────────────────────────
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [selectedTime, setSelectedTime] = useState('09:00 - 10:00');
  const [newLocation, setNewLocation] = useState('');
  const [newColor, setNewColor] = useState<CalendarEvent['color']>('purple');
  const [targetSupervisorId, setTargetSupervisorId] = useState('ALL');
  const [priority, setPriority] = useState<'normal' | 'important' | 'urgent'>('normal');
  const [newNotes, setNewNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when date changes
  React.useEffect(() => {
    setIsAddingEvent(false);
    setNewTitle('');
    setSelectedTime('09:00 - 10:00');
    setNewLocation('');
    setNewNotes('');
    setTargetSupervisorId('ALL');
    setPriority('normal');
    setNewColor('purple');
  }, [selectedDate]);

  // Formatted display label
  const formattedDate = React.useMemo(() => {
    const [y, m, d] = selectedDate.split('-').map(Number);
    return new Date(y, m - 1, d)
      .toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long' })
      .toUpperCase();
  }, [selectedDate]);

  const eventCountLabel =
    events.length === 0
      ? 'No events scheduled'
      : events.length === 1
      ? '1 event scheduled'
      : `${events.length} events scheduled`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    let targetSupervisorName: string | undefined;
    if (targetSupervisorId === 'ADMIN_ONLY') {
      targetSupervisorName = 'Admin Only';
    } else if (targetSupervisorId === 'ALL') {
      targetSupervisorName = 'All Field Supervisors';
    } else {
      const match = supervisors.find((s) => s.id === targetSupervisorId);
      targetSupervisorName = match ? match.fullName : 'Field Supervisor';
    }

    const payload = {
      title: newTitle.trim(),
      time: selectedTime,
      location: newLocation.trim() || undefined,
      color: newColor,
      notes: newNotes.trim() || undefined,
      targetSupervisorId,
      targetSupervisorName,
      priority,
    };

    setIsSubmitting(true);
    try {
      await onAddEvent(payload);
      setNewTitle('');
      setSelectedTime('09:00 - 10:00');
      setNewLocation('');
      setNewNotes('');
      setTargetSupervisorId('ALL');
      setPriority('normal');
      setIsAddingEvent(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full p-5 sm:p-6 overflow-hidden">
      {/* ── Section Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 flex-shrink-0">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {formattedDate}
          </p>
          <h3 className="text-sm font-bold text-slate-900">{eventCountLabel}</h3>
        </div>

        <button
          type="button"
          onClick={() => setIsAddingEvent(true)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 px-3 py-1.5 rounded-xl transition-all shadow-xs cursor-pointer"
        >
          <Plus size={15} />
          <span>Add Event</span>
        </button>
      </div>

      {/* ── Events List (Takes remaining height & scrolls cleanly inside) ───── */}
      <div className="flex-1 min-h-0 overflow-y-auto pt-4 space-y-2.5 pr-1">
        {events.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center py-10 text-center space-y-2.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-500 flex items-center justify-center">
              <Sparkles size={24} />
            </div>
            <p className="text-xs text-slate-500 font-medium max-w-[220px]">
              No site tasks or meetings scheduled for this date.
            </p>
            <button
              type="button"
              onClick={() => setIsAddingEvent(true)}
              className="text-xs text-indigo-600 font-bold hover:text-indigo-800 hover:underline cursor-pointer"
            >
              + Add first event / reminder
            </button>
          </div>
        ) : (
          events.map((evt: CalendarEvent) => {
            const style = EVENT_COLOR_MAP[evt.color] || EVENT_COLOR_MAP.purple;
            const isUrgent = evt.priority === 'urgent';
            const isImportant = evt.priority === 'important';

            return (
              <div
                key={evt.id}
                className={[
                  'group relative pl-3.5 pr-3 py-2.5 rounded-xl border-l-[3.5px] transition-all bg-white border border-slate-200/70 shadow-2xs hover:shadow-xs',
                  style.border,
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    {/* Title + Priority Badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-indigo-900 transition-colors truncate">
                        {evt.title}
                      </h4>
                      {isUrgent && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-200 flex-shrink-0">
                          🔥 Urgent
                        </span>
                      )}
                      {isImportant && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 border border-amber-200 flex-shrink-0">
                          ⚡ Important
                        </span>
                      )}
                    </div>

                    {/* Recipient badge + Time / Location */}
                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      {evt.targetSupervisorId === 'ADMIN_ONLY' ? (
                        <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px] font-medium">
                          🔒 Admin Only
                        </span>
                      ) : evt.targetSupervisorId === 'ALL' ||
                        (!evt.targetSupervisorId &&
                          evt.targetSupervisorName?.includes('All')) ? (
                        <span className="text-indigo-700 bg-indigo-50 border border-indigo-100/80 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                          <Users size={10} />
                          All Supervisors
                        </span>
                      ) : evt.targetSupervisorName ? (
                        <span className="text-emerald-700 bg-emerald-50 border border-emerald-100/80 px-1.5 py-0.5 rounded text-[10px] font-medium flex items-center gap-1">
                          <User size={10} />
                          To: {evt.targetSupervisorName}
                        </span>
                      ) : null}

                      <div className="flex items-center gap-1 text-slate-500">
                        {evt.time && <span>{evt.time}</span>}
                        {evt.time && evt.location && <span>·</span>}
                        {evt.location && <span>{evt.location}</span>}
                      </div>
                    </div>

                    {/* Notes preview */}
                    {evt.notes && (
                      <p className="mt-1 text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed line-clamp-2">
                        {evt.notes}
                      </p>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    type="button"
                    onClick={() => onDeleteEvent(evt.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-500 p-1 rounded-md transition-all self-start flex-shrink-0 cursor-pointer"
                    title="Delete event"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Add Event Pop-up Modal Window ───────────────────────────────────── */}
      {isAddingEvent && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => !isSubmitting && setIsAddingEvent(false)}
        >
          <div
            className="w-full max-w-lg bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                  <Bell size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    New Site Event / Supervisor Reminder
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    {formattedDate}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsAddingEvent(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Event Title */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Event Title *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning Tool-Box Talk, Concrete Pouring, Inspection"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  autoFocus
                  className="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-800"
                />
              </div>

              {/* Two-column: Recipient + Priority */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Send Reminder To */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <Send size={11} className="text-indigo-600" />
                    <span>Send Reminder To</span>
                  </label>
                  <select
                    value={targetSupervisorId}
                    onChange={(e) => setTargetSupervisorId(e.target.value)}
                    className="w-full text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="ALL">📢 All Field Supervisors</option>
                    <option value="ADMIN_ONLY">🔒 Admin Only (Private Note)</option>
                    {supervisors.map((s) => (
                      <option key={s.id} value={s.id}>
                        👷 {s.fullName} ({s.username})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority */}
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                    <AlertCircle size={11} className="text-indigo-600" />
                    <span>Priority Level</span>
                  </label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['normal', 'important', 'urgent'] as const).map((p) => {
                      const labels = { normal: 'Normal', important: '⚡ Imp.', urgent: '🔥 Urgent' };
                      const isSel = priority === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPriority(p)}
                          className={[
                            'py-1.5 px-1 text-xs font-semibold rounded-lg border text-center transition-all cursor-pointer',
                            isSel
                              ? p === 'urgent'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                                : p === 'important'
                                ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                                : 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100',
                          ].join(' ')}
                        >
                          {labels[p]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Time Selection */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock size={13} className="text-indigo-600" />
                  <span>Select Event Time Slot</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {TIME_PRESETS.map((slot) => {
                    const isSel = selectedTime === slot;
                    return (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={[
                          'px-2 py-2 text-xs font-semibold rounded-xl border text-center transition-all cursor-pointer',
                          isSel
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

              {/* Location */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={12} className="text-slate-400" />
                  <span>Location / Milestone (Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tower B, Batching Plant, Site Office"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Instructions / Message for Supervisor (Optional)
                </label>
                <textarea
                  rows={2}
                  placeholder="Special instructions, safety remarks, or supervisor notes..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {/* Color Tag & Modal Actions */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">
                    Tag:
                  </span>
                  {(['purple', 'amber', 'emerald', 'blue', 'rose'] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewColor(c)}
                      className={[
                        'w-5 h-5 rounded-full transition-transform cursor-pointer',
                        EVENT_COLOR_MAP[c].dot,
                        newColor === c
                          ? 'ring-2 ring-offset-2 ring-slate-800 scale-110'
                          : 'opacity-70 hover:opacity-100',
                      ].join(' ')}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsAddingEvent(false)}
                    className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send size={12} />
                    <span>{isSubmitting ? 'Saving…' : 'Save & Notify'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
