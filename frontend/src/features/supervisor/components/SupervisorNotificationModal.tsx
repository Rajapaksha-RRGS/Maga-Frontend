import React from 'react';
import { 
  X, 
  Bell, 
  Clock, 
  MapPin, 
  CheckCheck, 
  AlertCircle, 
  Users, 
  Calendar as CalendarIcon,
  Sparkles,
  Check
} from 'lucide-react';
import type { CalendarEvent } from '../../calendar/services/calendarEventService';

interface SupervisorNotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  reminders: CalendarEvent[];
  selectedDate: string;
  readReminderIds: Set<string>;
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
}

export const SupervisorNotificationModal: React.FC<SupervisorNotificationModalProps> = ({
  isOpen,
  onClose,
  reminders,
  selectedDate,
  readReminderIds,
  onMarkAsRead,
  onMarkAllAsRead,
}) => {
  if (!isOpen) return null;

  const unreadCount = reminders.filter((r) => !readReminderIds.has(r.id)).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[82vh] transition-colors"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-2xs">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Admin Tasks & Reminders
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-2xs">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                <CalendarIcon size={12} />
                <span>Date: {selectedDate}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={onMarkAllAsRead}
                className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline px-2 py-1 flex items-center gap-1"
                title="Mark all as read"
              >
                <CheckCheck size={14} />
                <span className="hidden sm:inline">Mark read</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content / Reminders List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 divide-y divide-slate-100 dark:divide-slate-800/60">
          {reminders.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400 dark:text-slate-500">
                <Sparkles size={24} />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No Pending Reminders
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto">
                  You are all caught up! Head office or admin hasn&apos;t posted any specific tasks or reminders for this date.
                </p>
              </div>
            </div>
          ) : (
            reminders.map((reminder) => {
              const isRead = readReminderIds.has(reminder.id);
              const isUrgent = reminder.priority === 'urgent';
              const isImportant = reminder.priority === 'important';

              return (
                <div
                  key={reminder.id}
                  className={[
                    'pt-3.5 first:pt-0 rounded-2xl transition-all',
                    isRead ? 'opacity-75' : '',
                  ].join(' ')}
                >
                  <div
                    className={[
                      'p-4 rounded-2xl border transition-all',
                      isRead
                        ? 'bg-slate-50/60 dark:bg-slate-800/30 border-slate-200/70 dark:border-slate-800'
                        : isUrgent
                        ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60 shadow-xs'
                        : isImportant
                        ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/60 shadow-xs'
                        : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-2xs',
                    ].join(' ')}
                  >
                    {/* Top Row: Title, Priority, Target */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                            {reminder.title}
                          </h4>
                          {isUrgent && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500 text-white shadow-2xs flex items-center gap-1">
                              <AlertCircle size={10} />
                              URGENT
                            </span>
                          )}
                          {isImportant && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500 text-white shadow-2xs">
                              IMPORTANT
                            </span>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                          {reminder.time && (
                            <span className="flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                              <Clock size={12} className="text-blue-500" />
                              {reminder.time}
                            </span>
                          )}
                          {reminder.location && (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} className="text-rose-500" />
                              {reminder.location}
                            </span>
                          )}
                          {reminder.targetSupervisorId === 'ALL' ? (
                            <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                              <Users size={12} />
                              All Field Supervisors
                            </span>
                          ) : (
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Direct to You
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Read status button / acknowledge */}
                      <button
                        type="button"
                        onClick={() => onMarkAsRead(reminder.id)}
                        className={[
                          'flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex-shrink-0 cursor-pointer',
                          isRead
                            ? 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs active:scale-95',
                        ].join(' ')}
                        title={isRead ? 'Acknowledged' : 'Mark as Acknowledged'}
                      >
                        <Check size={13} />
                        <span>{isRead ? 'Acknowledged' : 'Acknowledge'}</span>
                      </button>
                    </div>

                    {/* Detailed Notes if present */}
                    {reminder.notes && (
                      <div className="mt-3 p-2.5 rounded-xl bg-slate-100/70 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                        <span className="font-semibold text-slate-900 dark:text-slate-200 block mb-0.5">
                          Instructions:
                        </span>
                        {reminder.notes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Updates automatically with Head Office Planner</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl font-semibold bg-slate-800 dark:bg-slate-700 text-white hover:bg-slate-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
