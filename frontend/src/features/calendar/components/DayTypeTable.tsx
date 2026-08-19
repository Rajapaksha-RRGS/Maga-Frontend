/**
 * DayTypeTable.tsx — Read-only summary table / badge list for fixed calendar day types.
 */
import type { DayType } from '../services/calendarService';

interface Props {
  dayTypes: DayType[];
}

export default function DayTypeTable({ dayTypes }: Props) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs">
      <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">System Day Types</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {dayTypes.map((dt) => (
          <div key={dt.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200/60">
            <span className="text-xs font-medium text-slate-700">{dt.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
