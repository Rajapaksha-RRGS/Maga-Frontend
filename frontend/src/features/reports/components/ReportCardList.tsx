/**
 * ReportCardList.tsx — Mobile card rendering for report results.
 */
import CardList from '../../../components/CardList';
import type { ReportRow } from '../services/reportService';

interface Props { data: ReportRow[]; }

export default function ReportCardList({ data }: Props) {
  return (
    <CardList data={data} keyField="id" renderCard={(row) => (
      <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-slate-800">{row.employeeName}</span>
          <span className="font-mono text-xs text-slate-500">{row.date}</span>
        </div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-mono text-sm font-medium text-slate-800">{row.activityCode}</span>
          <span className="text-xs text-slate-400">{row.activityDescription}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-slate-600 tabular-nums">{row.hours.toFixed(1)}h</span>
          {row.overtimeHours > 0 && (
            <span className="text-amber-700 font-medium tabular-nums">+{row.overtimeHours.toFixed(1)} OT</span>
          )}
        </div>
        {row.remarks && (
          <p className="text-xs text-slate-400 mt-1">{row.remarks}</p>
        )}
      </div>
    )} />
  );
}
