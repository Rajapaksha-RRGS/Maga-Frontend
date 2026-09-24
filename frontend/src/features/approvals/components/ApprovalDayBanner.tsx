import React from 'react';
import { Calendar, AlertCircle, Info } from 'lucide-react';
import type { ApprovalDayTypeInfo } from '../services/approvalService';

interface ApprovalDayBannerProps {
  date: string;
  dayType?: ApprovalDayTypeInfo;
}

export const ApprovalDayBanner: React.FC<ApprovalDayBannerProps> = ({ date, dayType }) => {
  if (!dayType) return null;

  const isHolidayOrSunday = dayType.isAllOvertime || dayType.standardHoursCap === 0;
  const isSaturday = dayType.standardHoursCap === 6;

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div
      className={`rounded-2xl p-4 border transition-all ${
        isHolidayOrSunday
          ? 'bg-amber-50 border-amber-200 text-amber-950'
          : isSaturday
          ? 'bg-blue-50 border-blue-200 text-blue-950'
          : 'bg-emerald-50 border-emerald-200 text-emerald-950'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-xl mt-0.5 sm:mt-0 ${
              isHolidayOrSunday
                ? 'bg-amber-100 text-amber-700'
                : isSaturday
                ? 'bg-blue-100 text-blue-700'
                : 'bg-emerald-100 text-emerald-700'
            }`}
          >
            {isHolidayOrSunday ? <AlertCircle size={20} /> : <Calendar size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-base tracking-tight">{formattedDate}</span>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  isHolidayOrSunday
                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                    : isSaturday
                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                }`}
              >
                Day Type: {dayType.name}
              </span>
            </div>
            <p className="text-xs mt-1 text-slate-600">
              {isHolidayOrSunday ? (
                <span>
                  ⚠️ <strong>Notice for Admin Approval:</strong> This day is configured as{' '}
                  <span className="font-semibold underline">{dayType.name}</span>. Standard hours cap is 0.0h (100% of all hours worked are automatically calculated as Overtime).
                </span>
              ) : isSaturday ? (
                <span>
                  ℹ️ <strong>Saturday Rule:</strong> 6.0 standard hours cap (07:00 – 13:00). All hours beyond 6.0h are calculated as Overtime.
                </span>
              ) : (
                <span>
                  ✓ <strong>Normal Day Rule:</strong> Standard 8.0 hours cap applies. Hours exceeding 8.0h are calculated as Overtime.
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center text-xs font-medium px-3 py-1.5 rounded-xl bg-white border border-slate-200 shadow-xs text-slate-600">
          <Info size={14} className="text-slate-400" />
          <span>Rules auto-applied per Calendar</span>
        </div>
      </div>
    </div>
  );
};
