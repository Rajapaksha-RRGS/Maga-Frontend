import { useState } from 'react';
import { 
  Calendar as CalendarIcon, 
  X, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays
} from 'lucide-react';

interface SupervisorSubHeaderProps {
  selectedDate: string;
  onDateChange: (date: string) => void;
  rightAction?: React.ReactNode;
}

export function SupervisorSubHeader({
  selectedDate,
  onDateChange,
  rightAction,
}: SupervisorSubHeaderProps) {
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);

  // Format date display
  const dateObj = new Date(selectedDate);

  const formattedDisplayDate = dateObj.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const isToday = new Date().toISOString().split('T')[0] === selectedDate;

  // Date shifting
  const shiftDate = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    onDateChange(d.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 transition-colors shadow-2xs">
      <div className="max-w-md mx-auto px-3.5 py-2.5">
        {/* Row 1: Interactive Date Selector & Action */}
        <div className="flex items-center justify-between gap-2">
          {/* Quick Date Stepper */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <button
              type="button"
              onClick={() => shiftDate(-1)}
              aria-label="Previous day"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              onClick={() => setShowDatePickerModal(true)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <CalendarIcon size={14} className="text-blue-600 dark:text-blue-400" />
              <span className="truncate">{isToday ? 'Today, ' : ''}{formattedDisplayDate}</span>
            </button>

            <button
              type="button"
              onClick={() => shiftDate(1)}
              aria-label="Next day"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {rightAction}
        </div>
      </div>

      {/* Date Picker Modal */}
      {showDatePickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 w-full max-w-xs shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-2">
                <CalendarDays size={18} className="text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Select Work Date
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDatePickerModal(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={16} />
              </button>
            </div>

            {/* Native Date Input with Pre-set Buttons */}
            <div>
              <label className="text-xs text-slate-500 dark:text-slate-400 mb-1.5 block">
                Choose Calendar Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (e.target.value) {
                    onDateChange(e.target.value);
                  }
                }}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-600"
              />
            </div>

            {/* Quick shortcuts */}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  const now = new Date().toISOString().split('T')[0];
                  onDateChange(now);
                  setShowDatePickerModal(false);
                }}
                className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => {
                  const y = new Date();
                  y.setDate(y.getDate() - 1);
                  onDateChange(y.toISOString().split('T')[0]);
                  setShowDatePickerModal(false);
                }}
                className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/60 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100"
              >
                Yesterday
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowDatePickerModal(false)}
              className="w-full py-2.5 rounded-xl bg-blue-700 text-white font-medium text-xs hover:bg-blue-800 transition-colors"
            >
              Done & Load Gang Roster
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
